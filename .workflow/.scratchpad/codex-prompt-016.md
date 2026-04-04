## Task: DETAILED-016 — Restore volumes fast path in generate_all_detailed_outlines

### Problem
The previous Codex review incorrectly removed the volumes fast-path from `generate_all_detailed_outlines()`. When `structure_json` contains `volumes` with `summary` fields (the 细纲 content), the system should directly save them as `DetailedOutline` records WITHOUT calling the LLM. Instead, it currently falls through to the LLM generation path, causing LLM_TIMEOUT errors.

The user's point is correct: the outline generation already produces volumes with summary (细纲 content) in the JSON. Just parse and save — no LLM call needed.

### File to modify
`backend/app/services/detailed_outline_generation/app_service.py`

### Required Change
In the function `generate_all_detailed_outlines()`, AFTER line 363 (`raw_vols = structure.get("volumes")`), and BEFORE the `if not (isinstance(raw_vols, list) and raw_vols):` block, add BACK the volumes fast-path.

Replace the current code at lines 362-380:
```python
    if isinstance(structure, dict):
        raw_vols = structure.get("volumes")
        if not (isinstance(raw_vols, list) and raw_vols):
            raw_ch = structure.get("chapters")
            if isinstance(raw_ch, list) and raw_ch:
                # Accept chapters even without valid number — assign sequential if missing
                patched: list[dict[str, Any]] = []
                for _i, _ch in enumerate(raw_ch):
                    if not isinstance(_ch, dict):
                        continue
                    cp = dict(_ch)
                    try:
                        _num = int(cp.get("number", 0))
                    except (TypeError, ValueError):
                        _num = 0
                    if _num <= 0:
                        cp["number"] = _i + 1
                    patched.append(cp)
                outline_chapters = _normalize_chapters(patched) if patched else []
```

With:
```python
    if isinstance(structure, dict):
        raw_vols = structure.get("volumes")
        if isinstance(raw_vols, list) and raw_vols:
            # Fast path: volumes with summary = 细纲 content, save directly without LLM
            patched_vols: list[dict[str, Any]] = []
            for _i, _vol in enumerate(raw_vols):
                if not isinstance(_vol, dict):
                    continue
                cp = dict(_vol)
                try:
                    _num = int(cp.get("number", 0))
                except (TypeError, ValueError):
                    _num = 0
                if _num <= 0:
                    cp["number"] = _i + 1
                else:
                    cp["number"] = _num
                cp["title"] = str(cp.get("title") or "")
                cp["summary"] = str(cp.get("summary") or "")
                patched_vols.append(cp)
            outline_volumes = sorted(patched_vols, key=lambda v: int(v.get("number", 0))) if patched_vols else []

            if outline_volumes:
                for vol in outline_volumes:
                    vol_number = int(vol.get("number", 0) or 0)
                    vol_title = str(vol.get("title") or "")
                    vol_summary = str(vol.get("summary") or "")

                    yield {
                        "type": "volume_start",
                        "volume_number": vol_number,
                        "volume_title": vol_title,
                    }

                    detailed_outline_id = _upsert_detailed_outline(
                        db,
                        outline_id=outline.id,
                        project_id=project_id,
                        volume_number=vol_number,
                        volume_title=vol_title,
                        content_md=vol_summary,
                        structure=None,
                    )

                    yield {
                        "type": "volume_complete",
                        "volume_number": vol_number,
                        "chapter_count": 0,
                        "detailed_outline_id": detailed_outline_id,
                    }

                yield {
                    "type": "complete",
                    "total_volumes": total_volumes,
                    "total_chapters": 0,
                }
                return
        else:
            raw_ch = structure.get("chapters")
            if isinstance(raw_ch, list) and raw_ch:
                patched: list[dict[str, Any]] = []
                for _i, _ch in enumerate(raw_ch):
                    if not isinstance(_ch, dict):
                        continue
                    cp = dict(_ch)
                    try:
                        _num = int(cp.get("number", 0))
                    except (TypeError, ValueError):
                        _num = 0
                    if _num <= 0:
                        cp["number"] = _i + 1
                    patched.append(cp)
                outline_chapters = _normalize_chapters(patched) if patched else []
```

### Why chapter_count=0 is CORRECT
The pipeline is: 大纲(volumes with summary) → 细纲(DetailedOutline with content_md) → 章节骨架(chapters created later from 细纲 page by user action). At the 细纲 stage, there are no chapters yet — they're created later when the user clicks "从细纲创建章节骨架" in the UI. So `chapter_count=0` is the correct value.

### Constraints
- Only modify the `generate_all_detailed_outlines()` function in this one file
- Keep the chapters fast-path as fallback (for old data)
- Keep the LLM generation path as final fallback
- Do NOT modify any other files
