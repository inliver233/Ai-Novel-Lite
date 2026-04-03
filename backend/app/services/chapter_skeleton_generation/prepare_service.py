from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.detailed_outline import DetailedOutline
from app.models.outline import Outline
from app.models.project import Project
from app.models.project_settings import ProjectSettings
from app.services.prompt_store import format_characters


def _parse_structure_json(raw: str | None) -> Any | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def prepare_chapter_skeleton_render_values(
    detailed_outline: DetailedOutline,
    outline: Outline,
    project: Project,
    db: Session,
    *,
    neighbor_summaries: dict[str, str] | None = None,
    chapters_count: int | None = None,
    instruction: str | None = None,
    context_flags: dict[str, Any] | None = None,
) -> dict[str, object]:
    """Build the render_values dict for chapter skeleton generation."""
    flags = context_flags or {}
    neighbor_values = neighbor_summaries or {}

    values: dict[str, object] = {
        "project_name": project.name or "",
        "genre": project.genre or "",
        "logline": project.logline or "",
    }

    world_setting = ""
    style_guide = ""
    constraints = ""
    if flags.get("include_world_setting", True):
        settings_row = db.get(ProjectSettings, project.id)
        if settings_row is not None:
            world_setting = (settings_row.world_setting or "").strip()
            style_guide = (settings_row.style_guide or "").strip()
            constraints = (settings_row.constraints or "").strip()
    values["world_setting"] = world_setting
    values["style_guide"] = style_guide
    values["constraints"] = constraints

    characters_text = ""
    if flags.get("include_characters", True):
        chars: list[Character] = (
            db.execute(select(Character).where(Character.project_id == project.id))
            .scalars()
            .all()
        )
        characters_text = format_characters(chars)
    values["characters"] = characters_text

    parsed_structure = _parse_structure_json(detailed_outline.structure_json)

    values["outline"] = outline.content_md or ""
    values["volume_number"] = detailed_outline.volume_number
    values["volume_title"] = detailed_outline.volume_title or ""
    values["detailed_outline_content"] = detailed_outline.content_md or ""
    values["detailed_outline_structure"] = (
        json.dumps(parsed_structure, ensure_ascii=False, indent=2)
        if parsed_structure is not None
        else ""
    )
    values["previous_volume_summary"] = str(
        neighbor_values.get("previous_volume_summary")
        or neighbor_values.get("previous")
        or ""
    )
    values["next_volume_summary"] = str(
        neighbor_values.get("next_volume_summary")
        or neighbor_values.get("next")
        or ""
    )
    values["chapters_count"] = int(chapters_count) if chapters_count is not None else ""
    values["instruction"] = instruction or ""

    return values
