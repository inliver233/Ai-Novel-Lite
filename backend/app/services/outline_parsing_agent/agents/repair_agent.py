"""Repair agent: attempts to fix broken JSON output from extraction agents.

When an extraction agent produces text that fails JSON parsing after all
retries, the coordinator can invoke this agent to attempt recovery by using
the LLM to re-extract / fix the JSON structure.
"""

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

logger = logging.getLogger("ainovel.parsing_agent")

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

# Expected schema snippets for each task type
_SCHEMA_HINTS: dict[str, str] = {
    "structure": (
        '{"outline_md": "...", '
        '"volumes": [{"number": 1, "title": "...", "summary": "..."}], '
        '"chapters": [{"number": 1, "title": "...", "beats": ["..."]}]}'
    ),
    "character": '{"characters": [{"name": "...", "role": "...", "profile": "...", "notes": "..."}]}',
    "entry": '{"entries": [{"title": "...", "content": "...", "tags": ["..."]}]}',
}


def _load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    return path.read_text(encoding="utf-8")


class RepairAgent:
    """Uses LLM to repair broken JSON output."""

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
            self._system_prompt = _load_prompt("repair_system.md")
        return self._system_prompt

    @property
    def user_template(self) -> str:
        if self._user_template is None:
            self._user_template = _load_prompt("repair_user.md")
        return self._user_template

    def repair(
        self,
        raw_text: str,
        task_type: str,
        *,
        on_streaming: Any | None = None,
    ) -> dict[str, Any] | list[Any] | None:
        """Attempt to repair broken JSON.

        Returns the parsed JSON dict/list on success, or None if repair fails.
        """
        if not raw_text or not raw_text.strip():
            return None

        # Truncate very long outputs to avoid exceeding context limits
        max_chars = 12000
        truncated = raw_text[:max_chars] if len(raw_text) > max_chars else raw_text

        schema_hint = _SCHEMA_HINTS.get(task_type, '{"data": [...]}')
        user_prompt = (
            self.user_template
            .replace("{{raw_text}}", truncated)
            .replace("{{expected_schema}}", schema_hint)
            .replace("{{task_type}}", task_type)
        )

        messages = [
            ChatMessage(role="system", content=self.system_prompt),
            ChatMessage(role="user", content=user_prompt),
        ]

        start = time.time()
        try:
            from app.llm.client import call_llm_messages
            result = call_llm_messages(
                provider=self.provider,
                base_url=self.base_url,
                model=self.model,
                api_key=self.api_key,
                messages=messages,
                params={"temperature": 0.0, "max_tokens": 8192},
                timeout_seconds=min(self.config.timeout_seconds, 120),
            )
            text = result.text
        except Exception as exc:
            safe_err = redact_secrets_text(str(exc))[:200]
            logger.warning("repair_agent: LLM call failed: %s", safe_err)
            return None

        duration_ms = int((time.time() - start) * 1000)
        logger.info(
            "repair_agent: attempt for %s completed in %dms",
            task_type,
            duration_ms,
        )

        # Try to parse the repaired output
        parsed = self._try_parse(text)
        if parsed is not None and not (isinstance(parsed, dict) and parsed.get("error")):
            return parsed

        logger.warning("repair_agent: repair attempt failed for %s", task_type)
        return None

    @staticmethod
    def _try_parse(text: str) -> dict[str, Any] | list[Any] | None:
        """Multi-level JSON extraction from repair agent output."""
        import re

        text = text.strip()

        # Level 1: Code fence
        fence_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
        if fence_match:
            raw = fence_match.group(1).strip()
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                pass

        # Level 2: Raw JSON block
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            first = text.find(start_char)
            last = text.rfind(end_char)
            if first >= 0 and last > first:
                try:
                    return json.loads(text[first: last + 1])
                except (json.JSONDecodeError, ValueError):
                    pass

        # Level 3: Fix common issues and retry
        cleaned = re.sub(r",\s*([}\]])", r"\1", text)
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            first = cleaned.find(start_char)
            last = cleaned.rfind(end_char)
            if first >= 0 and last > first:
                try:
                    return json.loads(cleaned[first: last + 1])
                except (json.JSONDecodeError, ValueError):
                    pass

        return None
