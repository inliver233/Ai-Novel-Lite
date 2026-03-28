from __future__ import annotations

import re
from typing import Any

from app.services.rerank_service import rerank_candidates as rerank_candidates_with_providers

_RERANK_TOKEN_RE = re.compile("[A-Za-z0-9\u4e00-\u9fff]+")


def _rerank_tokens(text: str) -> set[str]:
    if not text:
        return set()
    return {t.lower() for t in _RERANK_TOKEN_RE.findall(text) if t.strip()}


def _rerank_score(*, method: str, query_text: str, candidate_text: str) -> float:
    qtext = (query_text or "").strip()
    if not qtext:
        return 0.0

    if method == "rapidfuzz_token_set_ratio":
        from rapidfuzz import fuzz  # type: ignore[import-not-found]

        return float(fuzz.token_set_ratio(qtext, candidate_text or "")) / 100.0

    q_tokens = _rerank_tokens(qtext)
    if not q_tokens:
        return 0.0
    c_tokens = _rerank_tokens(candidate_text or "")
    if not c_tokens:
        return 0.0
    return float(len(q_tokens & c_tokens)) / float(len(q_tokens))


def _rerank_candidates(
    *,
    query_text: str,
    candidates: list[dict[str, Any]],
    method: str,
    top_k: int,
    hybrid_alpha: float | None = None,
    external: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return rerank_candidates_with_providers(
        query_text=query_text,
        candidates=candidates,
        method=method,
        top_k=top_k,
        hybrid_alpha=hybrid_alpha,
        external=external,
        score_fn=_rerank_score,
    )

