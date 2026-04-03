from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class ChapterSkeletonResult:
    """Result of generating chapter skeleton for one volume."""

    detailed_outline_id: str
    volume_number: int
    volume_title: str
    content_md: str
    chapters: list[dict[str, Any]]
    chapter_count: int
    run_id: str
    warnings: list[str] = field(default_factory=list)
    parse_error: dict[str, Any] | None = None
