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
        paragraphs = self._split_paragraphs(text, max_chars=max_chars)

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

    def _split_paragraphs(self, text: str, *, max_chars: int) -> list[str]:
        """Split text into paragraphs and further segment oversized paragraphs."""

        parts = re.split(r"\n\s*\n", text)
        normalized: list[str] = []
        for part in parts:
            paragraph = part.strip()
            if not paragraph:
                continue
            if len(paragraph) <= max_chars:
                normalized.append(paragraph)
                continue
            normalized.extend(self._split_oversized_paragraph(paragraph, max_chars=max_chars))
        return normalized

    def _split_oversized_paragraph(self, text: str, *, max_chars: int) -> list[str]:
        """Split an oversized paragraph by sentence boundaries, then hard-slice as fallback."""

        if max_chars <= 0:
            return [text]

        sentences = [s.strip() for s in re.split(r"(?<=[。！？!?；;])", text) if s.strip()]
        if len(sentences) <= 1:
            return self._slice_text(text, max_chars=max_chars)

        chunks: list[str] = []
        current = ""
        for sentence in sentences:
            if len(sentence) > max_chars:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.extend(self._slice_text(sentence, max_chars=max_chars))
                continue

            candidate = f"{current}{sentence}" if current else sentence
            if len(candidate) > max_chars:
                if current:
                    chunks.append(current)
                current = sentence
                continue

            current = candidate

        if current:
            chunks.append(current)

        return chunks or self._slice_text(text, max_chars=max_chars)

    def _slice_text(self, text: str, *, max_chars: int) -> list[str]:
        """Hard-slice text when no better structural boundary exists."""

        if max_chars <= 0:
            return [text]
        return [text[i : i + max_chars].strip() for i in range(0, len(text), max_chars) if text[i : i + max_chars].strip()]
