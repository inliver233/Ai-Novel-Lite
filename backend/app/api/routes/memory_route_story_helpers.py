from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.utils import utc_now
from app.models.project_settings import ProjectSettings
from app.models.story_memory import StoryMemory
from app.services.search_index_service import schedule_search_rebuild_task
from app.services.vector_rag_service import schedule_vector_rebuild_task


def _validate_story_memory_import_schema_version(schema_version: str | None) -> None:
    if str(schema_version or '').strip() != 'story_memory_import_v1':
        raise AppError.validation(details={'reason': 'unsupported_schema_version', 'schema_version': schema_version})


def _ensure_story_memory_rebuild_dirty(db: Session, *, project_id: str, flush_on_create: bool = False) -> None:
    settings_row = db.get(ProjectSettings, project_id)
    if settings_row is None:
        settings_row = ProjectSettings(project_id=project_id)
        db.add(settings_row)
        if flush_on_create:
            db.flush()
    settings_row.vector_index_dirty = True


def _import_story_memories_payload(
    db: Session,
    *,
    project_id: str,
    schema_version: str | None,
    items: list[object],
    actor_user_id: str,
    request_id: str,
    row_builder,
) -> dict[str, object]:
    _validate_story_memory_import_schema_version(schema_version)
    now = utc_now()
    rows = []
    for item in items:
        row = row_builder(project_id=project_id, item=item, now=now)
        if row is not None:
            rows.append(row)
            db.add(row)

    created_ids = [str(row.id) for row in rows]
    if not created_ids:
        raise AppError.validation(message='未导入任何 story_memories', details={'reason': 'empty'})

    _ensure_story_memory_rebuild_dirty(db, project_id=project_id)
    db.commit()
    schedule_vector_rebuild_task(
        db=db,
        project_id=project_id,
        actor_user_id=actor_user_id,
        request_id=request_id,
        reason='story_memory_import_all',
    )
    schedule_search_rebuild_task(
        db=db,
        project_id=project_id,
        actor_user_id=actor_user_id,
        request_id=request_id,
        reason='story_memory_import_all',
    )
    return {'created': len(created_ids), 'ids': created_ids}
