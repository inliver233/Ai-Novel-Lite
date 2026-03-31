from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from app.core.logging import redact_secrets_text
from app.llm.messages import ChatMessage
from app.llm.strategy import LLMStrategy
from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import AgentStepResult, ChunkInfo

logger = logging.getLogger("ainovel.parsing_agent")

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    """Load a prompt template from the prompts directory."""

    path = PROMPTS_DIR / filename
    return path.read_text(encoding="utf-8")


def _safe_error_text(exc: object) -> str:
    text = redact_secrets_text(str(exc or "")).replace("\n", " ").strip()
    return text[:500] or "unknown error"


class BaseExtractionAgent:
    """Base class for all extraction agents.

    Handles: LLM calling, JSON response parsing, multi-chunk processing, retry logic.
    Subclasses override: agent_name, system_prompt_file, user_prompt_file, parse_response(), merge_results().
    """

    agent_name: str = "base"
    system_prompt_file: str = ""
    user_prompt_file: str = ""

    def __init__(
        self,
        strategy: LLMStrategy,
        *,
        base_url: str,
        api_key: str,
        model: str,
        config: AgentPipelineConfig,
        provider: str = "openai_compatible",
    ) -> None:
        self.strategy = strategy
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.config = config
        self.provider = provider
        self._system_prompt: str | None = None
        self._user_template: str | None = None

    @property
    def system_prompt(self) -> str:
        if self._system_prompt is None:
            self._system_prompt = _load_prompt(self.system_prompt_file)
        return self._system_prompt

    @property
    def user_template(self) -> str:
        if self._user_template is None:
            self._user_template = _load_prompt(self.user_prompt_file)
        return self._user_template

    def build_user_prompt(self, chunk: ChunkInfo, analysis_context: str = "") -> str:
        """Build user prompt from template, injecting chunk text and metadata."""

        return (
            self.user_template.replace("{{chunk_text}}", chunk.text)
            .replace("{{chunk_index}}", str(chunk.chunk_index + 1))
            .replace("{{total_chunks}}", str(chunk.total_chunks))
            .replace("{{analysis_context}}", analysis_context)
        )

    def _call_llm(self, user_prompt: str) -> tuple[str, int]:
        """Call LLM and return (response_text, tokens_used)."""

        messages = [
            ChatMessage(role="system", content=self.system_prompt),
            ChatMessage(role="user", content=user_prompt),
        ]
        try:
            result = self.strategy.chat_completion(
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                params={"temperature": 0.2, "max_tokens": 16384},
                timeout_seconds=self.config.timeout_seconds,
                extra={"provider": self.provider},
            )
        except TypeError:
            # Backward/alternate interface compatibility (older signature).
            result = self.strategy.chat_completion(  # type: ignore[call-arg]
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                extra_params={"temperature": 0.2, "max_tokens": 16384},
                timeout_seconds=self.config.timeout_seconds,
            )

        tokens = getattr(result, "tokens_used", 0) or 0
        return result.text, tokens

    def _parse_json_from_text(self, text: str) -> dict[str, Any] | list[Any] | None:
        """Extract JSON from LLM response text. Tries code fence first, then raw JSON."""

        # Try code fence extraction
        import re

        fence_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try raw JSON extraction
        trimmed = text.strip()
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            first = trimmed.find(start_char)
            last = trimmed.rfind(end_char)
            if first >= 0 and last > first:
                try:
                    return json.loads(trimmed[first : last + 1])
                except json.JSONDecodeError:
                    pass

        return None

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        """Parse the JSON response into agent-specific data. Override in subclass."""

        return raw_json if isinstance(raw_json, dict) else {}

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        """Merge results from multiple chunks. Override in subclass."""

        if len(chunk_results) == 1:
            return chunk_results[0]
        return chunk_results[-1]  # Default: last chunk wins

    def run_on_chunks(
        self,
        chunks: list[ChunkInfo],
        analysis_context: str = "",
    ) -> AgentStepResult:
        """Run agent on all chunks and merge results."""

        start_time = time.time()
        chunk_results: list[dict[str, Any]] = []
        total_tokens = 0
        warnings: list[str] = []

        for chunk in chunks:
            retries = 0
            while retries <= self.config.max_retries_per_agent:
                try:
                    user_prompt = self.build_user_prompt(chunk, analysis_context)
                    raw_text, tokens = self._call_llm(user_prompt)
                    total_tokens += tokens

                    parsed_json = self._parse_json_from_text(raw_text)
                    if parsed_json is None:
                        warnings.append(
                            f"{self.agent_name}: chunk {chunk.chunk_index + 1} JSON parse failed"
                        )
                        if retries < self.config.max_retries_per_agent:
                            retries += 1
                            continue
                        break

                    result = self.parse_response(parsed_json)
                    chunk_results.append(result)
                    break
                except Exception as exc:
                    safe_error = _safe_error_text(exc)
                    logger.warning(
                        "%s: chunk %d/%d error (retry %d): %s",
                        self.agent_name,
                        chunk.chunk_index + 1,
                        chunk.total_chunks,
                        retries,
                        safe_error,
                    )
                    if retries < self.config.max_retries_per_agent:
                        retries += 1
                        continue
                    warnings.append(
                        f"{self.agent_name}: chunk {chunk.chunk_index + 1} failed after retries: {safe_error}"
                    )
                    break

        duration_ms = int((time.time() - start_time) * 1000)

        if not chunk_results:
            return AgentStepResult(
                agent_name=self.agent_name,
                status="error",
                duration_ms=duration_ms,
                tokens_used=total_tokens,
                error_message=f"No successful results from {len(chunks)} chunks",
                warnings=warnings,
            )

        merged = self.merge_results(chunk_results)
        return AgentStepResult(
            agent_name=self.agent_name,
            status="success" if len(chunk_results) == len(chunks) else "partial",
            data=merged,
            duration_ms=duration_ms,
            tokens_used=total_tokens,
            warnings=warnings,
        )
