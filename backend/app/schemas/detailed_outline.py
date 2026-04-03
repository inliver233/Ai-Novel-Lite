from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.limits import MAX_OUTLINE_MD_CHARS, MAX_OUTLINE_STRUCTURE_JSON_CHARS, validate_json_chars

DetailedOutlineStatus = Literal["planned", "generating", "done"]


class DetailedOutlineOut(BaseModel):
    id: str
    outline_id: str
    project_id: str
    volume_number: int
    volume_title: str
    content_md: str | None = None
    structure: Any | None = None
    status: DetailedOutlineStatus
    created_at: datetime
    updated_at: datetime


class DetailedOutlineCreate(BaseModel):
    volume_number: int = Field(ge=1)
    volume_title: str = Field(min_length=1, max_length=255)
    content_md: str | None = Field(default=None, max_length=MAX_OUTLINE_MD_CHARS)
    structure: Any | None = None

    @field_validator("structure")
    @classmethod
    def _validate_structure(cls, v: Any | None) -> Any | None:
        return validate_json_chars(v, max_chars=MAX_OUTLINE_STRUCTURE_JSON_CHARS, field_name="structure")


class DetailedOutlineUpdate(BaseModel):
    volume_title: str | None = Field(default=None, min_length=1, max_length=255)
    content_md: str | None = Field(default=None, max_length=MAX_OUTLINE_MD_CHARS)
    structure: Any | None = None
    status: DetailedOutlineStatus | None = None

    @field_validator("structure")
    @classmethod
    def _validate_structure(cls, v: Any | None) -> Any | None:
        return validate_json_chars(v, max_chars=MAX_OUTLINE_STRUCTURE_JSON_CHARS, field_name="structure")


class DetailedOutlineListItem(BaseModel):
    id: str
    outline_id: str
    volume_number: int
    volume_title: str
    status: DetailedOutlineStatus
    chapter_count: int = 0
    updated_at: datetime


class DetailedOutlineGenerateRequest(BaseModel):
    chapters_per_volume: int | None = Field(default=None, ge=3, le=30)
    instruction: str | None = Field(default=None, max_length=4000)
    context: DetailedOutlineGenerateContext | None = None


class DetailedOutlineGenerateContext(BaseModel):
    include_world_setting: bool = True
    include_characters: bool = True
    include_style_guide: bool = False


class DetailedOutlineBatchItem(BaseModel):
    """A single parsed detailed outline volume to save."""

    volume_number: int = Field(ge=1)
    volume_title: str = Field(default="", max_length=255)
    volume_summary: str = Field(default="", max_length=4000)
    chapters: list[dict[str, Any]] = Field(default_factory=list)


class DetailedOutlineBatchCreateRequest(BaseModel):
    """Batch-create detailed outlines from parsed data (no LLM call)."""

    detailed_outlines: list[DetailedOutlineBatchItem] = Field(min_length=1, max_length=50)


class ChapterSkeletonGenerateRequest(BaseModel):
    """Request to generate chapter skeleton for a detailed outline volume."""

    chapters_count: int | None = Field(default=None, ge=3, le=50)
    instruction: str | None = Field(default=None, max_length=4000)
    context: DetailedOutlineGenerateContext | None = None
    replace_chapters: bool = Field(default=True)
