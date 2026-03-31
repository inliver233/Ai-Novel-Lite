"""Multi-agent outline parsing system.

Public API:
- parse_outline(...)  -> ParseResult
- parse_outline_stream_events(...)  -> AsyncIterator of SSE events
"""
from __future__ import annotations

from app.services.outline_parsing_agent.coordinator import (
    parse_outline,
    parse_outline_stream_events,
)
from app.services.outline_parsing_agent.models import ParseResult

__all__ = ["parse_outline", "parse_outline_stream_events", "ParseResult"]

