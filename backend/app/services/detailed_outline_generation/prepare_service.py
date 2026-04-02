from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.outline import Outline
from app.models.project import Project
from app.models.project_settings import ProjectSettings
from app.services.detailed_outline_generation.models import VolumeInfo
from app.services.prompt_store import format_characters


def prepare_detailed_outline_render_values(
    outline: Outline,
    volume_info: VolumeInfo,
    project: Project,
    db: Session,
    *,
    previous_volume_summary: str | None = None,
    next_volume_summary: str | None = None,
    chapters_per_volume: int | None = None,
    instruction: str | None = None,
    context_flags: dict | None = None,
) -> dict:
    """Build the render_values dict for detailed outline generation.

    Assembles project metadata, outline content, volume context, and optional
    world-setting / character information into a flat dict that the prompt
    template engine can consume.
    """
    flags = context_flags or {}

    # -- project metadata --
    values: dict[str, object] = {
        "project_name": project.name or "",
        "genre": project.genre or "",
        "logline": project.logline or "",
    }

    # -- optional world setting / style guide / constraints --
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

    # -- optional characters --
    characters_text = ""
    if flags.get("include_characters", True):
        chars: list[Character] = (
            db.execute(select(Character).where(Character.project_id == project.id))
            .scalars()
            .all()
        )
        characters_text = format_characters(chars)
    values["characters"] = characters_text

    # -- outline content --
    values["outline"] = outline.content_md or ""

    # -- volume-specific context --
    values["volume_number"] = volume_info.number
    values["volume_title"] = volume_info.title
    values["current_volume_beats"] = volume_info.beats_text
    values["previous_volume_summary"] = previous_volume_summary or ""
    values["next_volume_summary"] = next_volume_summary or ""
    values["chapter_number_start"] = volume_info.chapter_range_start
    values["chapters_per_volume"] = chapters_per_volume or ""

    # -- user instruction --
    values["instruction"] = instruction or ""

    return values
