from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class AgentPipelineConfig:
    """Configuration for the multi-agent outline parsing pipeline."""

    max_context_tokens: int = 200_000
    timeout_seconds: int = 300
    chunk_size_tokens: int = 50_000
    chunk_overlap_tokens: int = 2_000
    parallel_extraction: bool = True
    max_retries_per_agent: int = 2
    # Token estimation: 1 CJK char ≈ 1.5 tokens, 1 Latin word ≈ 1.3 tokens
    cjk_chars_per_token: float = 0.67  # chars per token for CJK
    latin_chars_per_token: float = 4.0  # chars per token for Latin

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for mixed CJK/Latin text."""

        cjk_count = sum(1 for c in text if "\u4e00" <= c <= "\u9fff" or "\u3400" <= c <= "\u4dbf")
        latin_count = len(text) - cjk_count
        return int(cjk_count / self.cjk_chars_per_token + latin_count / self.latin_chars_per_token)

    def chunk_size_chars(self) -> int:
        """Approximate chunk size in characters (using CJK estimate as conservative)."""

        return int(self.chunk_size_tokens * self.cjk_chars_per_token)

    def chunk_overlap_chars(self) -> int:
        """Approximate overlap in characters."""

        return int(self.chunk_overlap_tokens * self.cjk_chars_per_token)
