## Task: DETAILED-017 — Fix "创建章节骨架" to call LLM when structure_json is empty

### Problem
When user clicks "从细纲创建章节", the backend calls `create_chapters_from_detailed_outline()` which reads `structure_json.chapters`. But the volumes fast-path saves DetailedOutline with `structure_json=None` (only `content_md` has the 细纲 summary). So it fails with `DETAILED_OUTLINE_NO_STRUCTURE`.

### Correct flow
1. 大纲生成 → volumes[].summary = 细纲 → saved as DetailedOutline.content_md (no LLM) ✅
2. "创建章节骨架" → call LLM to generate chapters from 大纲+细纲 → save to structure_json → create Chapter records ❌ broken

### Fix
Modify the `create_chapters` route handler in `backend/app/api/routes/detailed_outlines.py` (around line 513-532) to auto-generate chapters via LLM when `structure_json` has no chapters.

Replace the current route handler:
```python
@router.post("/detailed_outlines/{detailed_outline_id}/create_chapters")
def create_chapters(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    detailed_outline_id: str,
    replace: bool = Query(default=False),
) -> dict:
    request_id = request.state.request_id
    _require_detailed_outline_editor(db, detailed_outline_id=detailed_outline_id, user_id=user_id)

    chapters = create_chapters_from_detailed_outline(
        detailed_outline_id,
        db,
        replace=replace,
    )
    return ok_payload(
        request_id=request_id,
        data={"chapters": chapters, "count": len(chapters)},
    )
```

With:
```python
@router.post("/detailed_outlines/{detailed_outline_id}/create_chapters")
def create_chapters(
    request: Request,
    db: DbDep,
    user_id: UserIdDep,
    detailed_outline_id: str,
    replace: bool = Query(default=False),
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-Api-Key"),
) -> dict:
    request_id = request.state.request_id
    _require_detailed_outline_editor(db, detailed_outline_id=detailed_outline_id, user_id=user_id)

    detail = db.get(DetailedOutline, detailed_outline_id)
    if detail is None:
        raise AppError.not_found("DetailedOutline not found")

    # Check if structure_json already has chapters
    needs_generation = True
    if detail.structure_json:
        try:
            structure = json.loads(detail.structure_json)
            if isinstance(structure, dict):
                ch = structure.get("chapters")
                if isinstance(ch, list) and len(ch) > 0:
                    needs_generation = False
        except Exception:
            pass

    if needs_generation:
        # Generate chapters via LLM from 大纲 + 细纲 content
        outline = db.get(Outline, detail.outline_id)
        project = db.get(Project, detail.project_id)
        if outline is None or project is None:
            raise AppError.not_found("Outline or Project not found")

        from app.services.detailed_outline_generation.models import VolumeInfo

        vol_info = VolumeInfo(
            number=detail.volume_number,
            title=detail.volume_title or "",
            beats_text=detail.content_md or "",
            chapter_range_start=1,
            chapter_range_end=0,
        )

        resolved = None
        for task_key in ("detailed_outline_generate", "outline_generate"):
            try:
                resolved = resolve_task_llm_config(
                    db, project=project, user_id=user_id,
                    task_key=task_key, header_api_key=x_llm_api_key,
                )
            except AppError:
                resolved = None
            if resolved is not None:
                break

        if resolved is None:
            raise AppError(
                code="LLM_CONFIG_NOT_FOUND",
                message="LLM 配置未找到，请先在 Prompts 页保存 LLM 配置",
                status_code=400,
            )

        generate_detailed_outline_for_volume(
            outline, vol_info, project,
            resolved.llm_call, str(resolved.api_key),
            request_id, user_id, db,
        )
        db.refresh(detail)

    chapters = create_chapters_from_detailed_outline(
        detailed_outline_id,
        db,
        replace=replace,
    )
    return ok_payload(
        request_id=request_id,
        data={"chapters": chapters, "count": len(chapters)},
    )
```

### Key points
- `json` is already imported at line 3
- `generate_detailed_outline_for_volume` is already imported at line 36
- `resolve_task_llm_config` is already imported at line 38
- `Outline` and `Project` models are already imported at lines 21-22
- `VolumeInfo` needs a local import (to avoid circular import risk)
- The `Header` import from fastapi is already at line 7

### Constraints
- Only modify this ONE route handler in this ONE file
- Do NOT change `create_chapters_from_detailed_outline()` in app_service.py
- Do NOT change any frontend code
