from __future__ import annotations

import inspect
import json
import logging
import random
import time
from collections.abc import Callable, Iterator
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

    def _call_llm_stream(
        self,
        user_prompt: str,
        on_streaming: Callable[[str], None] | None = None,
    ) -> tuple[str, int]:
        """Call LLM with streaming and accumulate response.

        Uses a sync strategy stream when available. The default
        `_ClientLLMStrategy.stream_completion` is async and cannot be consumed
        from synchronous `run_on_chunks`, so built-in providers use
        `call_llm_stream_messages` directly. Falls back to `self._call_llm`
        only when the streaming client cannot be initialized.
        """

        from app.llm.client import call_llm_stream_messages

        messages = [
            ChatMessage(role="system", content=self.system_prompt),
            ChatMessage(role="user", content=user_prompt),
        ]
        params = {"temperature": 0.2, "max_tokens": 16384}

        iterator: Iterator[str] | None = None
        state: Any | None = None
        stream_completion = getattr(self.strategy, "stream_completion", None)
        strategy_stream_impl = getattr(type(self.strategy), "stream_completion", None)
        if callable(stream_completion) and not (
            inspect.iscoroutinefunction(stream_completion)
            or inspect.isasyncgenfunction(stream_completion)
            or inspect.iscoroutinefunction(strategy_stream_impl)
            or inspect.isasyncgenfunction(strategy_stream_impl)
        ):
            try:
                iterator = stream_completion(
                    base_url=self.base_url,
                    api_key=self.api_key,
                    model=self.model,
                    messages=messages,
                    params=params,
                    timeout_seconds=self.config.timeout_seconds,
                    extra={"provider": self.provider},
                )
            except TypeError:
                iterator = stream_completion(  # type: ignore[misc,call-arg]
                    base_url=self.base_url,
                    api_key=self.api_key,
                    model=self.model,
                    messages=messages,
                    extra_params=params,
                    timeout_seconds=self.config.timeout_seconds,
                )

        if iterator is None:
            try:
                iterator, state = call_llm_stream_messages(
                    provider=self.provider,
                    base_url=self.base_url,
                    model=self.model,
                    api_key=self.api_key,
                    messages=messages,
                    params=params,
                    timeout_seconds=self.config.timeout_seconds,
                    extra={"provider": self.provider},
                )
            except Exception:
                # Fallback to sync if streaming is unavailable.
                return self._call_llm(user_prompt)

        accumulated: list[str] = []
        try:
            for delta in iterator:
                accumulated.append(delta)
                if on_streaming is not None:
                    on_streaming(delta)
        except Exception as exc:
            # Always re-raise — partial content is unreliable for JSON parsing.
            # The caller (run_on_chunks) will handle retry with backoff.
            logger.warning(
                "%s: 流式传输中断，已接收 %d 段: %s",
                self.agent_name,
                len(accumulated),
                str(exc)[:200],
            )
            raise

        text = "".join(accumulated)
        # Note: tokens_used is not populated for streaming responses; it
        # requires provider-specific usage reporting after the stream ends.
        tokens = getattr(state, "tokens_used", 0) or 0
        if not text.strip():
            raise RuntimeError(f"{self.agent_name}: 流式响应为空")
        return text, tokens

    def _parse_json_from_text(self, text: str) -> dict[str, Any] | list[Any] | None:
        """Extract JSON from LLM response text.

        Multi-level extraction strategy:
        1. Code fence → json.loads
        2. Raw JSON extraction → json.loads
        3. Fix raw newlines inside JSON strings → retry
        4. Fix trailing commas → retry
        """

        import re

        # --- Level 1: Code fence extraction ---
        fence_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
        if fence_match:
            raw = fence_match.group(1).strip()
            result = self._try_parse_json(raw)
            if result is not None:
                return result

        # --- Level 2: Raw JSON extraction ---
        trimmed = text.strip()
        result = self._extract_json_block(trimmed)
        if result is not None:
            return result

        # --- Level 3: Fix raw newlines inside JSON string values ---
        # LLM often puts literal newlines in strings instead of \n
        fixed = self._fix_raw_newlines_in_json(trimmed)
        if fixed != trimmed:
            result = self._extract_json_block(fixed)
            if result is not None:
                return result

        # --- Level 4: Fix trailing commas ---
        cleaned = re.sub(r",\s*([}\]])", r"\1", fixed)
        if cleaned != fixed:
            result = self._extract_json_block(cleaned)
            if result is not None:
                return result

        return None

    @staticmethod
    def _try_parse_json(raw: str) -> dict[str, Any] | list[Any] | None:
        """Attempt json.loads, return None on failure."""
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return None

    def _extract_json_block(self, text: str) -> dict[str, Any] | list[Any] | None:
        """Find and parse the outermost JSON object or array in text."""
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            first = text.find(start_char)
            last = text.rfind(end_char)
            if first >= 0 and last > first:
                result = self._try_parse_json(text[first : last + 1])
                if result is not None:
                    return result
        return None

    @staticmethod
    def _fix_raw_newlines_in_json(text: str) -> str:
        """Replace literal newlines inside JSON string values with \\n.

        This handles the most common LLM JSON error: putting actual newlines
        inside string values instead of the escaped \\n sequence.
        """
        import re

        # Strategy: find content between quotes and escape newlines within
        result: list[str] = []
        in_string = False
        escape_next = False
        i = 0
        while i < len(text):
            ch = text[i]
            if escape_next:
                result.append(ch)
                escape_next = False
                i += 1
                continue
            if ch == "\\":
                escape_next = True
                result.append(ch)
                i += 1
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
                i += 1
                continue
            if in_string and ch == "\n":
                result.append("\\n")
                i += 1
                continue
            if in_string and ch == "\r":
                i += 1
                continue
            result.append(ch)
            i += 1
        return "".join(result)

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
        on_streaming: Callable[[str], None] | None = None,
    ) -> AgentStepResult:
        """Run agent on all chunks and merge results."""

        start_time = time.time()
        chunk_results: list[dict[str, Any]] = []
        total_tokens = 0
        warnings: list[str] = []
        last_raw_output: str | None = None  # Preserve for repair agent

        for chunk in chunks:
            retries = 0
            while retries <= self.config.max_retries_per_agent:
                try:
                    user_prompt = self.build_user_prompt(chunk, analysis_context)
                    raw_text, tokens = self._call_llm_stream(user_prompt, on_streaming=on_streaming)
                    total_tokens += tokens
                    last_raw_output = raw_text

                    parsed_json = self._parse_json_from_text(raw_text)
                    if parsed_json is None:
                        warnings.append(
                            f"{self.agent_name}: 分块 {chunk.chunk_index + 1} JSON 解析失败"
                        )
                        if retries < self.config.max_retries_per_agent:
                            backoff = min(8.0, 1.0 * (2**retries)) * (1.0 + random.uniform(-0.2, 0.2))
                            logger.info(
                                "%s: chunk %d JSON 解析失败，%.1f 秒后重试...",
                                self.agent_name,
                                chunk.chunk_index + 1,
                                backoff,
                            )
                            time.sleep(backoff)
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
                        backoff = min(8.0, 1.0 * (2**retries)) * (1.0 + random.uniform(-0.2, 0.2))
                        logger.info(
                            "%s: chunk %d 调用失败，%.1f 秒后重试...",
                            self.agent_name,
                            chunk.chunk_index + 1,
                            backoff,
                        )
                        time.sleep(backoff)
                        retries += 1
                        continue
                    warnings.append(
                        f"{self.agent_name}: 分块 {chunk.chunk_index + 1} 重试后仍失败: {safe_error}"
                    )
                    break

        duration_ms = int((time.time() - start_time) * 1000)

        if not chunk_results:
            step = AgentStepResult(
                agent_name=self.agent_name,
                status="error",
                duration_ms=duration_ms,
                tokens_used=total_tokens,
                error_message=f"{len(chunks)} 个分块全部失败，无有效结果",
                warnings=warnings,
            )
            step._raw_output = last_raw_output
            return step

        merged = self.merge_results(chunk_results)
        return AgentStepResult(
            agent_name=self.agent_name,
            status="success" if len(chunk_results) == len(chunks) else "partial",
            data=merged,
            duration_ms=duration_ms,
            tokens_used=total_tokens,
            warnings=warnings,
        )
