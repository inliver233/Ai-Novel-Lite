from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class VolumeInfo:
    """Lightweight representation of a single volume extracted from an outline."""

    number: int
    title: str
    beats_text: str
    chapter_range_start: int
    chapter_range_end: int


@dataclass(frozen=True, slots=True)
class DetailedOutlineResult:
    """Result of generating a detailed outline for one volume."""

    detailed_outline_id: str
    volume_number: int
    volume_title: str
    content_md: str
    structure: dict[str, Any] | None
    chapter_count: int
    run_id: str
    warnings: list[str] = field(default_factory=list)
    parse_error: dict[str, Any] | None = None
