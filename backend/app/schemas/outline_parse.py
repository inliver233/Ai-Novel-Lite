from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OutlineParseAgentConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_context_tokens: int = Field(default=200000, ge=8000, le=2_000_000)
    timeout_seconds: int = Field(default=3600, ge=30, le=7200)
    parallel_extraction: bool = True


class OutlineParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str | None = Field(default=None, max_length=4000000)
    file_content: str | None = Field(default=None, max_length=8000000)
    file_name: str | None = Field(default=None, max_length=255)
    agent_config: OutlineParseAgentConfig = Field(default_factory=OutlineParseAgentConfig)

    @model_validator(mode="after")
    def _validate_input(self) -> "OutlineParseRequest":
        if not (self.content or "").strip() and not (self.file_content or "").strip():
            raise ValueError("content or file_content is required")
        return self
