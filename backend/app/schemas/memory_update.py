from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MemoryUpdateSchemaVersion = Literal["memory_update_v1"]
MemoryTargetTable = str  # previously Literal["entities","relations","events","evidence"]; structured tables removed
MemoryOpType = Literal["upsert", "delete"]

MAX_OPS_V1 = 50
MAX_EVIDENCE_IDS_PER_OP = 20

MAX_MD_CHARS = 40000


AFTER_MODEL_BY_TABLE: dict[str, type[BaseModel]] = {}


class MemoryUpdateOpV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: MemoryOpType
    target_table: MemoryTargetTable
    target_id: str | None = Field(default=None, max_length=64)
    after: dict[str, Any] | None = None
    evidence_ids: list[str] = Field(default_factory=list, max_length=MAX_EVIDENCE_IDS_PER_OP)

    @field_validator("evidence_ids")
    @classmethod
    def _validate_evidence_ids(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for item in v or []:
            if not isinstance(item, str):
                raise ValueError("evidence_ids must be strings")
            item = item.strip()
            if not item:
                raise ValueError("evidence_ids cannot contain empty strings")
            if len(item) > 64:
                raise ValueError("evidence_id too long")
            out.append(item)
        return out

    @model_validator(mode="after")
    def _validate_op(self) -> "MemoryUpdateOpV1":
        if self.op == "delete":
            if not (self.target_id or "").strip():
                raise ValueError("target_id is required for delete")
            if self.after is not None:
                raise ValueError("after must be null for delete")
            return self

        if self.after is None:
            raise ValueError("after is required for upsert")

        model_cls = AFTER_MODEL_BY_TABLE.get(self.target_table)
        if model_cls is None:
            raise ValueError("unsupported target_table")
        model_cls.model_validate(self.after)
        return self


class MemoryUpdateV1Request(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: MemoryUpdateSchemaVersion = "memory_update_v1"
    idempotency_key: str = Field(min_length=8, max_length=64)
    title: str | None = Field(default=None, max_length=255)
    summary_md: str | None = Field(default=None, max_length=MAX_MD_CHARS)
    # Fail-soft: allow empty ops for no-op updates (contract parser may return ops_empty/ops_missing warnings).
    ops: list[MemoryUpdateOpV1] = Field(default_factory=list, max_length=MAX_OPS_V1)
