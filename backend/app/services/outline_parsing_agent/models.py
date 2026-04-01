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
            "entries": [{"title": e.title, "content": e.content, "tags": e.tags} for e in self.entries],
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


# Agent display names (Chinese)
AGENT_DISPLAY_NAMES: dict[str, str] = {
    "analysis": "分析引擎",
    "structure": "大纲骨架",
    "character": "角色卡",
    "entry": "世界条目",
    "validation": "校验合并",
}


def get_agent_display_name(agent_name: str) -> str:
    """Return Chinese display name for an agent."""

    return AGENT_DISPLAY_NAMES.get(agent_name, agent_name)
