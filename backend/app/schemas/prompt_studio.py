from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import RequestModel
from app.schemas.limits import MAX_TEMPLATE_CHARS


class PromptStudioPresetSummary(BaseModel):
    id: str
    name: str
    is_active: bool = False


class PromptStudioPresetDetail(BaseModel):
    id: str
    name: str
    content: str
    is_active: bool = False


class PromptStudioPresetCreate(RequestModel):
    name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=MAX_TEMPLATE_CHARS)

    @field_validator("name", "content")
    @classmethod
    def _validate_required_text(cls, value: str) -> str:
        out = value.strip()
        if not out:
            raise ValueError("字段不能为空")
        return out


class PromptStudioPresetUpdate(RequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1, max_length=MAX_TEMPLATE_CHARS)

    @field_validator("name", "content")
    @classmethod
    def _validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        out = value.strip()
        if not out:
            raise ValueError("字段不能为空")
        return out


class PromptStudioCategory(BaseModel):
    key: str
    label: str
    task: str | None = None
    presets: list[PromptStudioPresetSummary] = Field(default_factory=list)
