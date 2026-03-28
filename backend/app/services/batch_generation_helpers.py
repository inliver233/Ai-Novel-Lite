from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.utils import new_id, utc_now
from app.models.batch_generation_task import BatchGenerationTask, BatchGenerationTaskItem
from app.models.project_task import ProjectTask
from app.services.project_task_event_service import append_project_task_event, reset_project_task_to_queued
from app.services.project_task_runtime_service import touch_project_task_heartbeat

BATCH_GENERATION_PROJECT_TASK_KIND = "batch_generation_orchestrator"


@dataclass(frozen=True, slots=True)
class BatchGenerateParams:
    instruction: str
    target_word_count: int | None
    plan_first: bool
    post_edit: bool
    post_edit_sanitize: bool
    content_optimize: bool
    style_id: str | None
    include_world_setting: bool
    include_style_guide: bool
    include_constraints: bool
    include_outline: bool
    include_smart_context: bool
    character_ids: list[str]
    previous_chapter: str


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z")


def build_batch_generation_checkpoint(task: BatchGenerationTask) -> dict[str, Any]:
    return {
        "batch_task_id": str(task.id),
        "project_task_id": str(task.project_task_id) if task.project_task_id else None,
        "status": str(task.status),
        "total_count": int(task.total_count or 0),
        "completed_count": int(task.completed_count or 0),
        "failed_count": int(getattr(task, "failed_count", 0) or 0),
        "skipped_count": int(getattr(task, "skipped_count", 0) or 0),
        "cancel_requested": bool(task.cancel_requested),
        "pause_requested": bool(getattr(task, "pause_requested", False)),
        "updated_at": _iso(task.updated_at),
    }


def sync_batch_generation_checkpoint(task: BatchGenerationTask) -> None:
    task.checkpoint_json = _json_dumps(build_batch_generation_checkpoint(task))


def _load_batch_project_task(db: Session, *, batch_task: BatchGenerationTask) -> ProjectTask | None:
    task_id = str(batch_task.project_task_id or "").strip()
    if not task_id:
        return None
    return db.get(ProjectTask, task_id)


def ensure_batch_generation_project_task(
    db: Session,
    *,
    batch_task: BatchGenerationTask,
    chapter_numbers: list[int],
    request_id: str | None,
) -> ProjectTask:
    existing = _load_batch_project_task(db, batch_task=batch_task)
    if existing is not None:
        return existing
    task = ProjectTask(
        id=new_id(),
        project_id=str(batch_task.project_id),
        actor_user_id=batch_task.actor_user_id,
        kind=BATCH_GENERATION_PROJECT_TASK_KIND,
        status="queued",
        idempotency_key=f"batch_generation:{batch_task.id}",
        params_json=_json_dumps(
            {
                "batch_task_id": str(batch_task.id),
                "request_id": request_id,
                "chapter_numbers": list(chapter_numbers),
                "runtime_version": "wave_c2_v1",
            }
        ),
        result_json=None,
        error_json=None,
    )
    db.add(task)
    db.flush()
    batch_task.project_task_id = str(task.id)
    sync_batch_generation_checkpoint(batch_task)
    append_project_task_event(
        db,
        task=task,
        event_type="queued",
        source="batch_generation_create",
        payload={
            "reason": "batch_generation_create",
            "checkpoint": build_batch_generation_checkpoint(batch_task),
        },
    )
    db.flush()
    return task


def mark_batch_project_task_running(db: Session, *, batch_task: BatchGenerationTask) -> None:
    task = _load_batch_project_task(db, batch_task=batch_task)
    if task is None:
        return
    now = utc_now()
    task.status = "running"
    task.started_at = task.started_at or now
    task.heartbeat_at = now
    task.updated_at = now
    task.attempt = int(task.attempt or 0) + 1
    append_project_task_event(
        db,
        task=task,
        event_type="running",
        source="batch_generation_worker",
        payload={
            "reason": "batch_generation_worker_start",
            "checkpoint": build_batch_generation_checkpoint(batch_task),
        },
    )


def touch_batch_project_task(db: Session, *, batch_task: BatchGenerationTask) -> None:
    task = _load_batch_project_task(db, batch_task=batch_task)
    if task is None:
        return
    now = utc_now()
    task.heartbeat_at = now
    task.updated_at = now
    touch_project_task_heartbeat(task_id=str(task.id))


def append_batch_project_task_event(
    db: Session,
    *,
    batch_task: BatchGenerationTask,
    event_type: str,
    source: str,
    payload: dict[str, Any] | None = None,
) -> None:
    task = _load_batch_project_task(db, batch_task=batch_task)
    if task is None:
        return
    append_project_task_event(db, task=task, event_type=event_type, source=source, payload=payload)


def build_batch_step_payload(item: BatchGenerationTaskItem | None) -> dict[str, Any] | None:
    if item is None:
        return None
    return {
        "item_id": str(item.id),
        "chapter_id": str(item.chapter_id) if item.chapter_id else None,
        "chapter_number": int(item.chapter_number),
        "status": str(item.status),
        "attempt_count": int(getattr(item, "attempt_count", 0) or 0),
        "generation_run_id": str(item.generation_run_id) if item.generation_run_id else None,
        "last_request_id": str(getattr(item, "last_request_id", "") or "") or None,
        "error_message": str(item.error_message or "") or None,
        "started_at": _iso(getattr(item, "started_at", None)),
        "finished_at": _iso(getattr(item, "finished_at", None)),
    }


def recalculate_batch_generation_counts(db: Session, *, batch_task: BatchGenerationTask) -> None:
    db.flush()
    statuses = (
        db.execute(select(BatchGenerationTaskItem.status).where(BatchGenerationTaskItem.task_id == str(batch_task.id)))
        .scalars()
        .all()
    )
    batch_task.total_count = len(statuses)
    batch_task.completed_count = sum(1 for status in statuses if str(status) == "succeeded")
    batch_task.failed_count = sum(1 for status in statuses if str(status) == "failed")
    batch_task.skipped_count = sum(1 for status in statuses if str(status) == "skipped")
    sync_batch_generation_checkpoint(batch_task)


def requeue_batch_project_task(
    db: Session,
    *,
    batch_task: BatchGenerationTask,
    event_type: str,
    source: str,
    payload: dict[str, Any] | None = None,
    increment_retry_count: bool = True,
) -> None:
    task = _load_batch_project_task(db, batch_task=batch_task)
    if task is None:
        return
    reset_project_task_to_queued(task=task, increment_retry_count=increment_retry_count)
    append_project_task_event(
        db,
        task=task,
        event_type=event_type,
        source=source,
        payload={**dict(payload or {}), "checkpoint": build_batch_generation_checkpoint(batch_task)},
    )


def pause_batch_generation(
    db: Session,
    *,
    batch_task: BatchGenerationTask,
    reason: str,
    source: str,
    error: dict[str, Any] | None = None,
    item: BatchGenerationTaskItem | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    batch_task.status = "paused"
    batch_task.pause_requested = True
    batch_task.error_json = _json_dumps(error) if error is not None else None
    recalculate_batch_generation_counts(db, batch_task=batch_task)
    step = build_batch_step_payload(item)
    if step is not None:
        append_batch_project_task_event(
            db,
            batch_task=batch_task,
            event_type="step_failed" if error is not None else "checkpoint",
            source=source,
            payload={
                "reason": reason,
                "step": step,
                "checkpoint": build_batch_generation_checkpoint(batch_task),
                "error": error,
            },
        )
    finalize_batch_project_task(
        db,
        batch_task=batch_task,
        status="paused",
        event_type="paused",
        result={"paused": True, "batch_task_id": str(batch_task.id)},
        error=error,
        payload={**dict(payload or {}), "reason": reason, "step": step},
    )


def finalize_batch_project_task(
    db: Session,
    *,
    batch_task: BatchGenerationTask,
    status: str,
    event_type: str,
    result: dict[str, Any] | None = None,
    error: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    task = _load_batch_project_task(db, batch_task=batch_task)
    if task is None:
        return
    now = utc_now()
    task.status = status
    task.heartbeat_at = now
    task.finished_at = now
    task.updated_at = now
    if result is not None:
        task.result_json = _json_dumps(result)
        task.error_json = None
    if error is not None:
        task.error_json = _json_dumps(error)
    append_project_task_event(
        db,
        task=task,
        event_type=event_type,
        source="batch_generation_worker",
        payload={
            **dict(payload or {}),
            "checkpoint": build_batch_generation_checkpoint(batch_task),
            "result": result,
            "error": error,
        },
    )


def _parse_params(task: BatchGenerationTask) -> BatchGenerateParams:
    raw = {}
    if task.params_json:
        try:
            parsed = json.loads(task.params_json)
            if isinstance(parsed, dict):
                raw = parsed
        except Exception:
            raw = {}

    ctx = raw.get("context")
    ctx_obj = ctx if isinstance(ctx, dict) else {}

    character_ids = ctx_obj.get("character_ids")
    if not isinstance(character_ids, list):
        character_ids = []
    character_ids2 = [str(x) for x in character_ids if x is not None]

    return BatchGenerateParams(
        instruction=str(raw.get("instruction") or "").strip(),
        target_word_count=(int(raw["target_word_count"]) if isinstance(raw.get("target_word_count"), int) else None),
        plan_first=bool(raw.get("plan_first")),
        post_edit=bool(raw.get("post_edit")),
        post_edit_sanitize=bool(raw.get("post_edit_sanitize")),
        content_optimize=bool(raw.get("content_optimize")),
        style_id=(str(raw.get("style_id")) if raw.get("style_id") is not None else None),
        include_world_setting=bool(ctx_obj.get("include_world_setting", True)),
        include_style_guide=bool(ctx_obj.get("include_style_guide", True)),
        include_constraints=bool(ctx_obj.get("include_constraints", True)),
        include_outline=bool(ctx_obj.get("include_outline", True)),
        include_smart_context=bool(ctx_obj.get("include_smart_context", True)),
        character_ids=character_ids2,
        previous_chapter=str(ctx_obj.get("previous_chapter") or "none"),
    )

