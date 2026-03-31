from __future__ import annotations

import json

from fastapi import APIRouter, Query, Request
from sqlalchemy import select

from app.api.deps import DbDep, UserIdDep, require_entry_editor, require_project_editor, require_project_viewer
from app.core.errors import ok_payload
from app.db.utils import new_id
from app.models.entry import Entry
from app.schemas.entries import EntryCreate, EntryOut, EntryUpdate

router = APIRouter()


def _parse_json_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except Exception:
        return []
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and item.strip()]


def _tags_to_json(tags: list[str] | None) -> str:
    seen: set[str] = set()
    out: list[str] = []
    for raw in tags or []:
        t = str(raw or '').strip()
        if not t:
            continue
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
        if len(out) >= 80:
            break
    return json.dumps(out, ensure_ascii=False, separators=(',', ':')) if out else '[]'


def _escape_like_fragment(value: str) -> str:
    return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def _tag_to_like_pattern(tag: str) -> str:
    return f"%{_escape_like_fragment(json.dumps(tag, ensure_ascii=False))}%"


def _to_out(row: Entry) -> dict[str, object]:
    return EntryOut(
        id=str(row.id),
        project_id=str(row.project_id),
        title=str(row.title or ''),
        content=str(row.content or ''),
        tags=_parse_json_list(getattr(row, 'tags_json', None)),
        created_at=row.created_at,
        updated_at=row.updated_at,
    ).model_dump(mode='json')


@router.get('/projects/{project_id}/entries')
def list_entries(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    project_id: str,
    tag: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    request_id = request.state.request_id
    require_project_viewer(db, project_id=project_id, user_id=user_id)

    stmt = select(Entry).where(Entry.project_id == project_id)
    if tag and tag.strip():
        stmt = stmt.where(Entry.tags_json.like(_tag_to_like_pattern(tag.strip()), escape='\\'))
    stmt = stmt.order_by(Entry.updated_at.desc(), Entry.id.desc()).limit(limit + 1).offset(offset)

    rows = db.execute(stmt).scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    items = [_to_out(r) for r in rows]
    next_offset = (offset + limit) if has_more else None
    return ok_payload(request_id=request_id, data={'items': items, 'next_offset': next_offset})


@router.post('/projects/{project_id}/entries')
def create_entry(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    project_id: str,
    body: EntryCreate,
) -> dict:
    request_id = request.state.request_id
    require_project_editor(db, project_id=project_id, user_id=user_id)

    row = Entry(
        id=new_id(),
        project_id=project_id,
        title=body.title,
        content=body.content,
        tags_json=_tags_to_json(body.tags),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok_payload(request_id=request_id, data={'entry': _to_out(row)})


@router.put('/entries/{entry_id}')
def update_entry(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    entry_id: str,
    body: EntryUpdate,
) -> dict:
    request_id = request.state.request_id
    row = require_entry_editor(db, entry_id=entry_id, user_id=user_id)

    if body.title is not None:
        row.title = body.title
    if body.content is not None:
        row.content = body.content
    if body.tags is not None:
        row.tags_json = _tags_to_json(body.tags)

    db.commit()
    db.refresh(row)
    return ok_payload(request_id=request_id, data={'entry': _to_out(row)})


@router.delete('/entries/{entry_id}')
def delete_entry(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    entry_id: str,
) -> dict:
    request_id = request.state.request_id
    row = require_entry_editor(db, entry_id=entry_id, user_id=user_id)

    db.delete(row)
    db.commit()
    return ok_payload(request_id=request_id, data={})
