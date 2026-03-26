from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.db.utils import new_id
from app.models.story_memory import StoryMemory


def _build_story_memory_import_row(*, project_id: str, item: Any, now: datetime) -> StoryMemory | None:
    title = str(getattr(item, 'title', None) or '').strip() or None
    content = str(getattr(item, 'content', '') or '').strip()
    if not content:
        return None
    return StoryMemory(
        id=new_id(),
        project_id=project_id,
        chapter_id=None,
        memory_type=str(getattr(item, 'memory_type', '') or '').strip(),
        title=title,
        content=content,
        full_context_md=None,
        importance_score=float(getattr(item, 'importance_score', 0.0) or 0.0),
        tags_json=None,
        story_timeline=int(getattr(item, 'story_timeline', 0) or 0),
        text_position=-1,
        text_length=0,
        metadata_json=json.dumps({'source': 'import_all'}, ensure_ascii=False),
        created_at=now,
        updated_at=now,
    )
