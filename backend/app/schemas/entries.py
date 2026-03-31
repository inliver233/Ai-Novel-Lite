from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.base import ORMModel
from app.schemas.limits import MAX_TEXT_CHARS


MAX_ENTRY_TAG_CHARS = 64


def _normalize_entry_title(value: str) -> str:
    title = str(value or '').strip()
    if not title:
        raise ValueError('title cannot be blank')
    return title


def _normalize_entry_tags(value: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in value or []:
        tag = str(raw or '').strip()
        if not tag:
            continue
        if len(tag) > MAX_ENTRY_TAG_CHARS:
            raise ValueError('tag too long')
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(tag)
        if len(out) >= 80:
            break
    return out


class EntryCreate(ORMModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(default='', max_length=MAX_TEXT_CHARS)
    tags: list[str] = Field(default_factory=list, max_length=80)

    @field_validator('title')
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _normalize_entry_title(value)

    @field_validator('tags')
    @classmethod
    def _validate_tags(cls, value: list[str]) -> list[str]:
        return _normalize_entry_tags(value)


class EntryUpdate(ORMModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    tags: list[str] | None = Field(default=None, max_length=80)

    @field_validator('title')
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_entry_title(value)

    @field_validator('tags')
    @classmethod
    def _validate_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _normalize_entry_tags(value)


class EntryOut(ORMModel):
    id: str
    project_id: str
    title: str
    content: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
