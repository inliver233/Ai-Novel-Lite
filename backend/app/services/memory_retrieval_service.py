from __future__ import annotations

import re
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.secrets import redact_api_keys
from app.models.chapter import Chapter
from app.models.project_settings import ProjectSettings
from app.models.story_memory import StoryMemory
from app.schemas.memory_pack import MemoryContextPackOut
from app.services.prompt_budget import estimate_tokens
from app.services.vector_rerank_overrides import vector_rerank_overrides
from app.services.vector_embedding_overrides import vector_embedding_overrides
from app.services.vector_rag_service import query_project, vector_rag_status


_MEMORY_TEXT_MD_CHAR_LIMIT = 6000
_TRUNCATION_MARK = "\n…(truncated)\n"
_ALLOWED_SECTIONS = {
    "story_memory",
    "semantic_history",
    "vector_rag",
}
_MAX_BUDGET_CHAR_LIMIT = 50000


def _clamp_char_limit(value: object, *, default: int) -> int:
    try:
        raw = int(value)  # type: ignore[arg-type]
    except Exception:
        return int(default)
    if raw < 0:
        return int(default)
    return max(0, min(int(raw), int(_MAX_BUDGET_CHAR_LIMIT)))


def _unwrap_text_md_block(*, text_md: str, tag: str) -> str:
    prefix = f"<{tag}>\n"
    suffix = f"\n</{tag}>"
    if text_md.startswith(prefix) and text_md.endswith(suffix):
        return text_md[len(prefix) : -len(suffix)]
    return text_md


def _wrap_block_with_inner_limit(*, tag: str, inner: str, char_limit: int, ellipsis: bool) -> tuple[str, bool]:
    prefix = f"<{tag}>\n"
    suffix = f"\n</{tag}>"

    body = (inner or "").strip()
    if not body:
        return "", False

    truncated = False
    if char_limit >= 0 and len(body) > char_limit:
        body = body[:char_limit].rstrip()
        if ellipsis and body:
            body = body + "…"
        truncated = True

    return f"{prefix}{body}{suffix}", truncated


def _vector_rerank_config(*, db: Session, project_id: str) -> dict[str, object]:
    return vector_rerank_overrides(db.get(ProjectSettings, project_id))


def _wrap_and_truncate_block(*, tag: str, inner: str, char_limit: int) -> tuple[str, bool]:
    prefix = f"<{tag}>\n"
    suffix = f"\n</{tag}>"

    body = (inner or "").strip()
    if not body:
        return "", False

    raw = f"{prefix}{body}{suffix}"
    if char_limit <= 0 or len(raw) <= char_limit:
        return raw, False

    budget = max(0, int(char_limit) - len(prefix) - len(suffix))
    if budget <= 0:
        return "", True

    marker = _TRUNCATION_MARK
    if budget <= len(marker):
        clipped_inner = marker[:budget]
    else:
        clipped_inner = body[: max(0, budget - len(marker))].rstrip() + marker
    clipped = f"{prefix}{clipped_inner}{suffix}"
    if len(clipped) > char_limit:
        clipped = clipped[:char_limit]
    return clipped, True


def _format_story_memory_text_md(*, memories: list[StoryMemory], char_limit: int) -> tuple[str, bool]:
    parts: list[str] = []
    for m in memories:
        mem_type = str(m.memory_type or "").strip() or "memory"
        title = str(m.title or "").strip() or "Untitled"
        content = str(m.content or "").strip()
        if len(content) > 800:
            content = content[:800].rstrip() + "…"
        parts.append(f"### [{mem_type}] {title}\n{content}".rstrip())
    return _wrap_and_truncate_block(tag="StoryMemory", inner="\n\n".join(parts), char_limit=char_limit)


def _format_semantic_history_text_md(
    *,
    memories: list[StoryMemory],
    chapters_by_id: dict[str, Chapter],
    char_limit: int,
) -> tuple[str, bool]:
    parts: list[str] = []
    for m in memories:
        chapter_id = str(m.chapter_id or "").strip()
        chapter = chapters_by_id.get(chapter_id) if chapter_id else None
        title = str(getattr(chapter, "title", "") or "").strip() or "Untitled"
        number = getattr(chapter, "number", None)
        try:
            number_int = int(number) if number is not None else None
        except Exception:
            number_int = None

        header = f"第 {number_int} 章：{title}".strip("：") if number_int is not None else f"章节：{title}".strip("：")
        content = str(m.content or "").strip()
        if len(content) > 1000:
            content = content[:1000].rstrip() + "…"
        parts.append(f"### {header}\n{content}".rstrip())
    return _wrap_and_truncate_block(tag="SemanticHistory", inner="\n\n".join(parts), char_limit=char_limit)


def _extract_query_tokens(query_text: str, *, limit: int) -> list[str]:
    q = (query_text or "").strip()
    if not q:
        return []
    tokens = [t.strip() for t in re.split(r"[^0-9A-Za-z\u4e00-\u9fff]+", q) if t and t.strip()]
    out: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        if len(t) < 2:
            continue
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= int(limit):
            break
    return out


def retrieve_memory_context_pack(
    *,
    db: Session,
    project_id: str,
    query_text: str = "",
    include_deleted: bool = False,
    section_enabled: dict[str, bool] | None = None,
    budget_overrides: dict[str, int] | None = None,
) -> MemoryContextPackOut:
    """
    Must be safe when memory dependencies (vector DB / embeddings / etc.) are missing.
    """
    enabled_map = section_enabled or {}
    budgets_raw = budget_overrides or {}
    budgets = {str(k): v for k, v in budgets_raw.items() if str(k) in _ALLOWED_SECTIONS}
    story_memory_enabled = bool(enabled_map.get("story_memory", True))
    semantic_history_enabled = bool(enabled_map.get("semantic_history", False))
    vector_rag_enabled = bool(enabled_map.get("vector_rag", True))
    story_memory_budget = (
        _clamp_char_limit(budgets.get("story_memory"), default=_MEMORY_TEXT_MD_CHAR_LIMIT)
        if "story_memory" in budgets
        else _MEMORY_TEXT_MD_CHAR_LIMIT
    )
    semantic_history_budget = (
        _clamp_char_limit(budgets.get("semantic_history"), default=_MEMORY_TEXT_MD_CHAR_LIMIT)
        if "semantic_history" in budgets
        else _MEMORY_TEXT_MD_CHAR_LIMIT
    )
    vector_rag_budget = (
        _clamp_char_limit(budgets.get("vector_rag"), default=int(getattr(settings, "vector_final_char_limit", 6000) or 6000))
        if "vector_rag" in budgets
        else int(getattr(settings, "vector_final_char_limit", 6000) or 6000)
    )
    story_memory: dict[str, Any] = {"enabled": False, "disabled_reason": "empty", "items": [], "text_md": ""}
    if not story_memory_enabled:
        story_memory = {"enabled": False, "disabled_reason": "disabled", "items": [], "text_md": ""}
    else:
        try:
            limit_plus_one = 41
            tokens = _extract_query_tokens(query_text, limit=6)
            stmt = (
                select(StoryMemory)
                .where(StoryMemory.project_id == project_id)
                .order_by(StoryMemory.importance_score.desc(), StoryMemory.updated_at.desc())
            )
            if tokens:
                conds = []
                for t in tokens:
                    like_term = f"%{t}%"
                    conds.append(StoryMemory.content.like(like_term))
                    conds.append(StoryMemory.title.like(like_term))
                filtered = db.execute(stmt.where(or_(*conds)).limit(limit_plus_one)).scalars().all()
                rows = filtered if filtered else db.execute(stmt.limit(limit_plus_one)).scalars().all()
            else:
                rows = db.execute(stmt.limit(limit_plus_one)).scalars().all()
            truncated = len(rows) > (limit_plus_one - 1)
            rows = rows[: limit_plus_one - 1]
            enabled = bool(rows)
            items = []
            for m in rows[:20]:
                items.append(
                    {
                        "id": m.id,
                        "chapter_id": m.chapter_id,
                        "memory_type": m.memory_type,
                        "title": m.title,
                        "importance_score": float(m.importance_score or 0.0),
                        "story_timeline": int(m.story_timeline or 0),
                        "content_preview": (str(m.content or "").strip()[:200] + "…")
                        if len(str(m.content or "").strip()) > 200
                        else str(m.content or "").strip(),
                    }
                )
            text_md, text_truncated = _format_story_memory_text_md(
                memories=rows[:12], char_limit=int(story_memory_budget)
            )
            story_memory = {
                "enabled": enabled,
                "disabled_reason": None if enabled else "empty",
                "query_text": query_text,
                "filter_tokens": tokens,
                "items": items,
                "truncated": bool(truncated or text_truncated),
                "text_md": text_md,
            }
        except Exception:
            story_memory = {
                "enabled": False,
                "disabled_reason": "error",
                "items": [],
                "text_md": "",
                "error": "story_memory_query_failed",
            }

    vector_query_text = (query_text or "").strip()
    embedding_overrides = vector_embedding_overrides(db.get(ProjectSettings, project_id))
    rerank_config = _vector_rerank_config(db=db, project_id=project_id)

    semantic_history: dict[str, Any] = {"enabled": False, "disabled_reason": "empty", "items": [], "text_md": ""}
    if not semantic_history_enabled:
        semantic_history = {"enabled": False, "disabled_reason": "disabled", "items": [], "text_md": ""}
    elif not vector_query_text:
        semantic_history = {"enabled": False, "disabled_reason": "empty_query", "items": [], "text_md": "", "query_text": ""}
    else:
        vector_out: dict[str, Any] | None = None
        try:
            out = query_project(
                project_id=project_id,
                query_text=vector_query_text,
                sources=["story_memory"],
                embedding=embedding_overrides,
                rerank=rerank_config,
            )
            vector_out = out if isinstance(out, dict) else None
        except Exception as exc:
            vector_out = vector_rag_status(
                project_id=project_id,
                sources=["story_memory"],
                embedding=embedding_overrides,
                rerank=rerank_config,
            )
            vector_out["enabled"] = False
            vector_out["disabled_reason"] = "error"
            vector_out["query_text"] = vector_query_text
            vector_out["error"] = f"semantic_history_vector_query_failed:{type(exc).__name__}"

        if not vector_out or not bool(vector_out.get("enabled")):
            semantic_history = {
                "enabled": False,
                "disabled_reason": (vector_out or {}).get("disabled_reason") or "vector_disabled",
                "items": [],
                "text_md": "",
                "query_text": vector_query_text,
            }
        else:
            candidates = vector_out.get("candidates") if isinstance(vector_out.get("candidates"), list) else []
            picked_memory_ids: list[str] = []
            seen: set[str] = set()
            for c in candidates:
                if not isinstance(c, dict):
                    continue
                meta = c.get("metadata") if isinstance(c.get("metadata"), dict) else {}
                if str(meta.get("source") or "") != "story_memory":
                    continue
                if str(meta.get("memory_type") or "").strip() != "chapter_summary":
                    continue
                mem_id = str(meta.get("source_id") or "").strip()
                chapter_id = str(meta.get("chapter_id") or "").strip()
                if not mem_id or not chapter_id:
                    continue
                if mem_id in seen:
                    continue
                seen.add(mem_id)
                picked_memory_ids.append(mem_id)
                if len(picked_memory_ids) >= 8:
                    break

            if not picked_memory_ids:
                has_any_summary = (
                    db.execute(
                        select(StoryMemory.id)
                        .where(StoryMemory.project_id == project_id)
                        .where(StoryMemory.memory_type == "chapter_summary")
                        .limit(1)
                    ).first()
                    is not None
                )
                semantic_history = {
                    "enabled": False,
                    "disabled_reason": "index_not_built" if has_any_summary else "empty",
                    "items": [],
                    "hits": 0,
                    "query_text": vector_query_text,
                    "text_md": "",
                }
            else:
                mem_rows = (
                    db.execute(select(StoryMemory).where(StoryMemory.id.in_(picked_memory_ids))).scalars().all()
                )
                by_id = {str(m.id): m for m in mem_rows}
                memories = [by_id[mid] for mid in picked_memory_ids if mid in by_id]

                chapter_ids = [str(m.chapter_id) for m in memories if m.chapter_id]
                chapter_rows = db.execute(select(Chapter).where(Chapter.id.in_(chapter_ids))).scalars().all() if chapter_ids else []
                chapters_by_id = {str(c.id): c for c in chapter_rows}

                items: list[dict[str, Any]] = []
                for m in memories[:6]:
                    chapter_id = str(m.chapter_id or "").strip() or None
                    chapter = chapters_by_id.get(str(chapter_id or "")) if chapter_id else None
                    title = str(getattr(chapter, "title", "") or "").strip() or None
                    number = getattr(chapter, "number", None)
                    try:
                        number_int = int(number) if number is not None else None
                    except Exception:
                        number_int = None
                    items.append(
                        {
                            "story_memory_id": m.id,
                            "chapter_id": chapter_id,
                            "chapter_number": number_int,
                            "chapter_title": title,
                            "story_timeline": int(m.story_timeline or 0),
                        }
                    )

                text_md, text_truncated = _format_semantic_history_text_md(
                    memories=memories[:6],
                    chapters_by_id=chapters_by_id,
                    char_limit=int(semantic_history_budget),
                )
                semantic_history = {
                    "enabled": bool(memories),
                    "disabled_reason": None if memories else "empty",
                    "query_text": vector_query_text,
                    "hits": len(memories[:6]),
                    "items": items,
                    "truncated": bool(text_truncated),
                    "text_md": text_md,
                }
                semantic_history["text_chars"] = len(str(text_md or ""))

    try:
        if not vector_rag_enabled:
            vector_rag = vector_rag_status(project_id=project_id, embedding=embedding_overrides, rerank=rerank_config)
            vector_rag["enabled"] = False
            vector_rag["disabled_reason"] = "disabled"
            vector_rag["query_text"] = vector_query_text
        elif vector_query_text:
            vector_rag = query_project(
                project_id=project_id, query_text=vector_query_text, embedding=embedding_overrides, rerank=rerank_config
            )
        else:
            vector_rag = vector_rag_status(project_id=project_id, embedding=embedding_overrides, rerank=rerank_config)
    except Exception as exc:
        vector_rag = vector_rag_status(project_id=project_id, embedding=embedding_overrides, rerank=rerank_config)
        vector_rag["enabled"] = False
        vector_rag["disabled_reason"] = "error"
        vector_rag["query_text"] = vector_query_text
        vector_rag["error"] = f"vector_query_failed:{type(exc).__name__}"
    if isinstance(vector_rag, dict):
        vector_rag["query_text"] = vector_query_text
        pb = vector_rag.get("prompt_block") if isinstance(vector_rag.get("prompt_block"), dict) else {}
        text_md = str(pb.get("text_md") or "")
        if "vector_rag" in budgets and text_md:
            inner = _unwrap_text_md_block(text_md=text_md, tag="VECTOR_RAG")
            clipped, was_truncated = _wrap_block_with_inner_limit(
                tag="VECTOR_RAG", inner=inner, char_limit=int(vector_rag_budget), ellipsis=False
            )
            text_md = clipped
            pb = dict(pb) if isinstance(pb, dict) else {}
            pb["text_md"] = text_md
            vector_rag["prompt_block"] = pb
            final = vector_rag.get("final") if isinstance(vector_rag.get("final"), dict) else None
            if isinstance(final, dict):
                final = dict(final)
                final["text_md"] = text_md
                if was_truncated:
                    final["truncated"] = True
                vector_rag["final"] = final
        vector_rag["text_md"] = text_md

    logs: list[dict[str, Any]] = [
        {
            "section": "story_memory",
            "enabled": bool(story_memory.get("enabled")),
            "disabled_reason": story_memory.get("disabled_reason"),
            "note": "story_memories (top by importance)",
            "token_estimate": estimate_tokens(str(story_memory.get("text_md") or "")),
            "truncated": bool(story_memory.get("truncated")) if "truncated" in story_memory else None,
            "budget_char_limit": int(story_memory_budget),
            "budget_source": "override" if "story_memory" in budgets else "default",
        },
        {
            "section": "semantic_history",
            "enabled": bool(semantic_history.get("enabled")),
            "disabled_reason": semantic_history.get("disabled_reason"),
            "note": "vector_rag_service.query_project(source=story_memory,memory_type=chapter_summary)",
            "hits": int(semantic_history.get("hits") or 0),
            "text_chars": int(semantic_history.get("text_chars") or len(str(semantic_history.get("text_md") or ""))),
            "token_estimate": estimate_tokens(str(semantic_history.get("text_md") or "")),
            "truncated": bool(semantic_history.get("truncated")) if "truncated" in semantic_history else None,
            "budget_char_limit": int(semantic_history_budget),
            "budget_source": "override" if "semantic_history" in budgets else "default",
        },
        {
            "section": "vector_rag",
            "enabled": bool(vector_rag.get("enabled")),
            "disabled_reason": vector_rag.get("disabled_reason"),
            "note": "vector_rag_service.query_project",
            "timings_ms": vector_rag.get("timings_ms"),
            "counts": vector_rag.get("counts"),
            "budget_observability": vector_rag.get("budget_observability")
            if isinstance(vector_rag.get("budget_observability"), dict)
            else None,
            "rerank": vector_rag.get("rerank"),
            "dropped_total": int(vector_rag.get("counts", {}).get("dropped_total", 0))
            if isinstance(vector_rag.get("counts"), dict)
            else 0,
            "backend": vector_rag.get("backend") or vector_rag.get("backend_preferred"),
            "hybrid_enabled": bool(vector_rag.get("hybrid_enabled"))
            if "hybrid_enabled" in vector_rag
            else bool(vector_rag.get("hybrid", {}).get("enabled")) if isinstance(vector_rag.get("hybrid"), dict) else None,
            "token_estimate": estimate_tokens(str(vector_rag.get("text_md") or "")),
            "truncated": bool(vector_rag.get("truncated")) if "truncated" in vector_rag else None,
            "budget_char_limit": int(vector_rag_budget),
            "budget_source": "override" if "vector_rag" in budgets else "default",
        },
    ]

    return MemoryContextPackOut.model_validate(
        redact_api_keys(
            {
                "story_memory": story_memory,
                "semantic_history": semantic_history,
                "vector_rag": vector_rag,
                "logs": logs,
            }
        )
    )


def placeholder_memory_retrieval_log(*, enabled: bool) -> dict[str, Any]:
    """
    Phase 0 placeholder for `memory_retrieval_log_json`.

    Spec reference: `长期记忆系统完整实现规划.md` §14.2.
    """
    return {
        "phase": "0.1",
        "enabled": bool(enabled),
        "query_text": "",
        "per_section": {},
        "budgets": {},
        "overfilter": {},
        "errors": [],
    }


def build_memory_retrieval_log_json(
    *,
    enabled: bool,
    query_text: str,
    pack: MemoryContextPackOut | None,
    errors: list[str] | None = None,
) -> dict[str, Any]:
    per_section: dict[str, Any] = {}
    if pack is not None:
        for item in pack.logs:
            per_section[str(item.section)] = item.model_dump()

    safe_errors = [str(e).strip() for e in (errors or []) if str(e).strip()]
    return {
        "phase": "1.0",
        "enabled": bool(enabled),
        "query_text": str(query_text or ""),
        "per_section": per_section,
        "budgets": {},
        "overfilter": {},
        "errors": safe_errors,
    }
