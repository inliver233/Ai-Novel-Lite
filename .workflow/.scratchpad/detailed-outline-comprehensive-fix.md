# Comprehensive fix for detailed outline generation

## Problem
1. After outline generation or intelligent parsing, the system triggers a SEPARATE LLM call for detailed outlines. But the outline already has chapter-level structure (chapters with number, title, summary, beats). This LLM call is unnecessary and it also fails with LLM_UPSTREAM_ERROR.
2. The LLM call fails because the provider (openai-compatible proxy serving claude-opus-4-6) returns a server error.

## Primary fix: Create detailed outlines from outline structure (no LLM)

File: `backend/app/services/detailed_outline_generation/app_service.py`

In function `generate_all_detailed_outlines`, AFTER extracting volumes (after `volumes = extract_volumes_from_outline(outline, db)`) and BEFORE the LLM config resolution section, add a check:

If the outline's `structure_json` contains a `chapters` array, create DetailedOutline records directly from those chapters and return early (skip LLM entirely).

### Logic:
```python
    # -- try to create from existing outline structure (no LLM needed) --
    structure = _parse_structure_json(outline.structure_json)
    outline_chapters = None
    if isinstance(structure, dict):
        raw_ch = structure.get("chapters")
        if isinstance(raw_ch, list) and raw_ch:
            outline_chapters = [ch for ch in raw_ch if isinstance(ch, dict) and int(ch.get("number", 0)) > 0]

    if outline_chapters:
        # Outline already has chapter structure - convert directly to detailed outlines
        total_chapters = 0
        for idx, vol in enumerate(volumes):
            yield {
                "type": "volume_start",
                "volume_number": vol.number,
                "volume_title": vol.title,
            }
            # Assign chapters to volume
            if total_volumes == 1:
                vol_chapters = outline_chapters
            else:
                vol_chapters = [
                    ch for ch in outline_chapters
                    if vol.chapter_range_start <= int(ch.get("number", 0)) <= (vol.chapter_range_end if vol.chapter_range_end > 0 else 999999)
                ]
                if not vol_chapters:
                    vol_chapters = outline_chapters  # fallback: assign all

            # Build content_md from chapters
            content_parts: list[str] = []
            for ch in vol_chapters:
                ch_num = ch.get("number", "?")
                ch_title = str(ch.get("title", ""))
                ch_summary = str(ch.get("summary", ""))
                beats = ch.get("beats")
                parts = []
                if ch_summary:
                    parts.append(ch_summary)
                if isinstance(beats, list) and beats:
                    parts.append("\n".join(f"- {str(b)}" for b in beats if b is not None))
                content_parts.append(f"### {ch_num}. {ch_title}\n" + "\n\n".join(parts))
            content_md = "\n\n".join(content_parts)

            structure_data = {"chapters": _normalize_chapters(vol_chapters)}
            detailed_outline_id = _upsert_detailed_outline(
                db,
                outline_id=outline.id,
                project_id=project_id,
                volume_number=vol.number,
                volume_title=vol.title or "",
                content_md=content_md,
                structure=structure_data,
            )
            chapter_count = len(vol_chapters)
            total_chapters += chapter_count
            yield {
                "type": "volume_complete",
                "volume_number": vol.number,
                "chapter_count": chapter_count,
                "detailed_outline_id": detailed_outline_id,
            }

        yield {
            "type": "complete",
            "total_volumes": total_volumes,
            "total_chapters": total_chapters,
        }
        return  # No LLM generation needed
```

This block goes AFTER:
```python
    volumes = extract_volumes_from_outline(outline, db)
    total_volumes = len(volumes)
    yield {"type": "start", "total_volumes": total_volumes}
```

And BEFORE:
```python
    # -- resolve LLM config --
    resolved = None
```

### Key points:
- `_parse_structure_json` already exists in the same file
- `_normalize_chapters` already exists in the same file
- `_upsert_detailed_outline` already exists in the same file
- The early `return` after yield "complete" prevents the LLM code from running
- When `total_volumes == 1`, assign ALL chapters to that single volume
- When multiple volumes, filter by chapter range; fallback to all chapters if filtering yields empty

## Secondary fix: LLM call compatibility

The `call_llm_and_record` was already fixed (previous commit) to not pass `prompt_messages`. Keep that fix.

Additionally, in `generate_detailed_outline_for_volume`, add a fallback: if the outline has chapters for this volume, use them directly instead of calling LLM. This provides another safety net.

## Verification
After making changes:
1. `cd backend && python -m compileall -q app/`
2. Verify the generate_all_detailed_outlines function flow is correct
