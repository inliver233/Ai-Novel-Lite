# Codex Task: OPA-001 + OPA-002 — Backend Agent Framework + Text Chunker

## TASK OVERVIEW
Create the multi-agent framework base classes for the outline parsing agent system.
This is an independent module at `backend/app/services/outline_parsing_agent/`.

## EXISTING PATTERNS TO FOLLOW

### Agent Foundation (read first)
File: `backend/app/llm/agent.py` — Contains `AgentCapability` Protocol, `AgentConfig` dataclass, `Agent` Protocol.
Your code EXTENDS this pattern (does NOT modify it).

### LLM Strategy (read first)
File: `backend/app/llm/strategy.py` — Contains `LLMStrategy` Protocol with `chat_completion()` and `stream_completion()`.
Your agents will use this to call LLMs.

### Existing Generation Service Pattern (read first)
File: `backend/app/services/generation_service.py` — Contains `call_llm_and_record()`.
File: `backend/app/services/outline_generation/app_service.py` — Shows how LLM calls are structured.

### LLM Task Preset Resolver (read first)
File: `backend/app/services/llm_task_preset_resolver.py` — Resolves `(api_key, provider, model, PreparedLlmCall)` for a given task key.

## FILES TO CREATE (6 files total)

### 1. `backend/app/services/outline_parsing_agent/__init__.py`

```python
"""Multi-agent outline parsing system.

Public API:
- parse_outline(...)  -> ParseResult
- parse_outline_stream_events(...)  -> AsyncIterator of SSE events
"""
from __future__ import annotations

from app.services.outline_parsing_agent.coordinator import (
    parse_outline,
    parse_outline_stream_events,
)
from app.services.outline_parsing_agent.models import ParseResult

__all__ = ["parse_outline", "parse_outline_stream_events", "ParseResult"]
```

### 2. `backend/app/services/outline_parsing_agent/config.py`

Create `AgentPipelineConfig` dataclass:

```python
from __future__ import annotations
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class AgentPipelineConfig:
    """Configuration for the multi-agent outline parsing pipeline."""
    max_context_tokens: int = 200_000
    timeout_seconds: int = 3600
    chunk_size_tokens: int = 50_000
    chunk_overlap_tokens: int = 2_000
    parallel_extraction: bool = True
    max_retries_per_agent: int = 2
    # Token estimation: 1 CJK char ≈ 1.5 tokens, 1 Latin word ≈ 1.3 tokens
    cjk_chars_per_token: float = 0.67  # chars per token for CJK
    latin_chars_per_token: float = 4.0  # chars per token for Latin

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for mixed CJK/Latin text."""
        cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3400' <= c <= '\u4dbf')
        latin_count = len(text) - cjk_count
        return int(cjk_count / self.cjk_chars_per_token + latin_count / self.latin_chars_per_token)

    def chunk_size_chars(self) -> int:
        """Approximate chunk size in characters (using CJK estimate as conservative)."""
        return int(self.chunk_size_tokens * self.cjk_chars_per_token)

    def chunk_overlap_chars(self) -> int:
        """Approximate overlap in characters."""
        return int(self.chunk_overlap_tokens * self.cjk_chars_per_token)
```

### 3. `backend/app/services/outline_parsing_agent/models.py`

Create data models:

```python
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ChunkInfo:
    """A text chunk with metadata."""
    text: str
    chunk_index: int
    total_chunks: int
    start_offset: int
    end_offset: int

@dataclass
class AgentStepResult:
    """Result from a single agent execution step."""
    agent_name: str
    status: str  # "success" | "error" | "partial"
    data: dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0
    tokens_used: int = 0
    error_message: str | None = None
    warnings: list[str] = field(default_factory=list)

@dataclass
class ParsedOutline:
    """Extracted outline structure."""
    outline_md: str = ""
    chapters: list[dict[str, Any]] = field(default_factory=list)
    # Each chapter: {number: int, title: str, beats: list[str]}

@dataclass
class ParsedCharacter:
    """Extracted character card."""
    name: str = ""
    role: str | None = None
    profile: str | None = None
    notes: str | None = None

@dataclass
class ParsedEntry:
    """Extracted worldbuilding entry."""
    title: str = ""
    content: str = ""
    tags: list[str] = field(default_factory=list)

@dataclass
class ParseResult:
    """Final result from the multi-agent parsing pipeline."""
    outline: ParsedOutline = field(default_factory=ParsedOutline)
    characters: list[ParsedCharacter] = field(default_factory=list)
    entries: list[ParsedEntry] = field(default_factory=list)
    agent_log: list[AgentStepResult] = field(default_factory=list)
    total_duration_ms: int = 0
    total_tokens_used: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dict for API response."""
        return {
            "outline": {
                "outline_md": self.outline.outline_md,
                "chapters": self.outline.chapters,
            },
            "characters": [
                {"name": c.name, "role": c.role, "profile": c.profile, "notes": c.notes}
                for c in self.characters
            ],
            "entries": [
                {"title": e.title, "content": e.content, "tags": e.tags}
                for e in self.entries
            ],
            "agent_log": [
                {
                    "agent_name": s.agent_name,
                    "status": s.status,
                    "duration_ms": s.duration_ms,
                    "tokens_used": s.tokens_used,
                    "error_message": s.error_message,
                    "warnings": s.warnings,
                }
                for s in self.agent_log
            ],
            "total_duration_ms": self.total_duration_ms,
            "total_tokens_used": self.total_tokens_used,
            "warnings": self.warnings,
        }
```

### 4. `backend/app/services/outline_parsing_agent/agents/__init__.py`

```python
"""Parsing agents for the multi-agent outline parsing system."""
```

### 5. `backend/app/services/outline_parsing_agent/agents/base.py`

Create `BaseExtractionAgent`:

```python
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from app.llm.strategy import LLMStrategy
from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import AgentStepResult, ChunkInfo

logger = logging.getLogger("ainovel.parsing_agent")

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    path = PROMPTS_DIR / filename
    return path.read_text(encoding="utf-8")


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
            self.user_template
            .replace("{{chunk_text}}", chunk.text)
            .replace("{{chunk_index}}", str(chunk.chunk_index + 1))
            .replace("{{total_chunks}}", str(chunk.total_chunks))
            .replace("{{analysis_context}}", analysis_context)
        )

    def _call_llm(self, user_prompt: str) -> tuple[str, int]:
        """Call LLM and return (response_text, tokens_used)."""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        result = self.strategy.chat_completion(
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
                        warnings.append(f"{self.agent_name}: chunk {chunk.chunk_index + 1} JSON parse failed")
                        if retries < self.config.max_retries_per_agent:
                            retries += 1
                            continue
                        break

                    result = self.parse_response(parsed_json)
                    chunk_results.append(result)
                    break
                except Exception as exc:
                    logger.warning(
                        "%s: chunk %d/%d error (retry %d): %s",
                        self.agent_name,
                        chunk.chunk_index + 1,
                        chunk.total_chunks,
                        retries,
                        str(exc),
                    )
                    if retries < self.config.max_retries_per_agent:
                        retries += 1
                        continue
                    warnings.append(f"{self.agent_name}: chunk {chunk.chunk_index + 1} failed after retries: {exc}")
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
```

### 6. `backend/app/services/outline_parsing_agent/chunker.py`

Create `TextChunker`:

```python
from __future__ import annotations

import re

from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import ChunkInfo


class TextChunker:
    """Split long text into overlapping chunks for multi-agent processing.

    Strategy:
    1. If text fits in single chunk, return as-is.
    2. Split at paragraph boundaries (double newline) first.
    3. If paragraph is too long, split at sentence boundaries.
    4. Maintain overlap between chunks for context continuity.
    """

    def __init__(self, config: AgentPipelineConfig) -> None:
        self.config = config

    def chunk(self, text: str) -> list[ChunkInfo]:
        """Split text into chunks based on config token limits."""
        estimated_tokens = self.config.estimate_tokens(text)
        if estimated_tokens <= self.config.chunk_size_tokens:
            return [
                ChunkInfo(
                    text=text,
                    chunk_index=0,
                    total_chunks=1,
                    start_offset=0,
                    end_offset=len(text),
                )
            ]

        max_chars = self.config.chunk_size_chars()
        overlap_chars = self.config.chunk_overlap_chars()
        paragraphs = self._split_paragraphs(text)

        chunks: list[ChunkInfo] = []
        current_parts: list[str] = []
        current_len = 0
        current_start = 0
        offset = 0

        for para in paragraphs:
            para_len = len(para)

            if current_len + para_len > max_chars and current_parts:
                chunk_text = "\n\n".join(current_parts)
                chunks.append(
                    ChunkInfo(
                        text=chunk_text,
                        chunk_index=len(chunks),
                        total_chunks=0,  # updated below
                        start_offset=current_start,
                        end_offset=current_start + len(chunk_text),
                    )
                )
                # Overlap: keep last portion
                overlap_text = chunk_text[-overlap_chars:] if overlap_chars > 0 else ""
                current_parts = [overlap_text] if overlap_text else []
                current_len = len(overlap_text)
                current_start = offset - len(overlap_text)

            current_parts.append(para)
            current_len += para_len
            offset += para_len + 2  # +2 for \n\n separator

        if current_parts:
            chunk_text = "\n\n".join(current_parts)
            chunks.append(
                ChunkInfo(
                    text=chunk_text,
                    chunk_index=len(chunks),
                    total_chunks=0,
                    start_offset=current_start,
                    end_offset=current_start + len(chunk_text),
                )
            )

        # Update total_chunks
        total = len(chunks)
        for chunk in chunks:
            chunk.total_chunks = total

        return chunks

    def _split_paragraphs(self, text: str) -> list[str]:
        """Split text into paragraphs at double newlines."""
        parts = re.split(r"\n\s*\n", text)
        return [p.strip() for p in parts if p.strip()]
```

## INSTRUCTIONS FOR CODEX

1. Read the existing files mentioned above (agent.py, strategy.py, etc.) to understand patterns.
2. Create ALL 6 files exactly as specified above.
3. Ensure all imports resolve correctly.
4. Do NOT modify any existing files.
5. Create the `prompts/` directory (empty for now — it will be populated in the next phase).
6. Create `backend/app/services/outline_parsing_agent/prompts/` as an empty directory with a placeholder.
7. After creating files, run: `python -m compileall backend/app/services/outline_parsing_agent/`
8. Fix any compilation errors.

## DIRECTORY STRUCTURE TO CREATE
```
backend/app/services/outline_parsing_agent/
├── __init__.py
├── config.py
├── models.py
├── chunker.py
├── coordinator.py  (just a stub for now — import stubs)
├── agents/
│   ├── __init__.py
│   └── base.py
└── prompts/
    └── .gitkeep
```

For coordinator.py, create a STUB that satisfies the import in __init__.py:

```python
"""Outline parsing orchestrator (stub — full implementation in OPA-003)."""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.services.outline_parsing_agent.models import ParseResult


def parse_outline(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None = None,
    x_llm_api_key: str | None = None,
    agent_config: dict[str, Any] | None = None,
) -> ParseResult:
    """Parse external outline text into project format using multi-agent pipeline."""
    raise NotImplementedError("Full implementation in OPA-003")


async def parse_outline_stream_events(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None = None,
    x_llm_api_key: str | None = None,
    agent_config: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream parsing progress events."""
    raise NotImplementedError("Full implementation in OPA-003")
    yield  # make it an async generator
```
