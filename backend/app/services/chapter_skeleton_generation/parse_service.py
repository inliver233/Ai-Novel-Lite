from __future__ import annotations

import json
import re
from typing import Any

from app.services.output_parsers import extract_json_value, likely_truncated_json


def _find_chapters_in_nested(value: dict[str, Any]) -> list[Any] | None:
    """Search for a 'chapters' array in nested dict structures."""
    chapters = value.get("chapters")
    if isinstance(chapters, list) and chapters:
        return chapters
    # Search one level deeper (e.g. {"result": {"chapters": [...]}})
    for v in value.values():
        if isinstance(v, dict):
            chapters = v.get("chapters")
            if isinstance(chapters, list) and chapters:
                return chapters
    return None


def _recover_partial_skeleton_chapters(text: str) -> list[dict[str, Any]]:
    """Recover individual chapter objects from truncated/malformed JSON."""
    decoder = json.JSONDecoder()
    chapters: dict[int, dict[str, Any]] = {}
    for m in re.finditer(r'\{\s*"number"\s*:', text):
        try:
            obj, _ = decoder.raw_decode(text, m.start())
        except (json.JSONDecodeError, ValueError):
            continue
        if not isinstance(obj, dict):
            continue
        try:
            number = int(obj.get("number"))
        except (TypeError, ValueError):
            continue
        if number > 0:
            chapters[number] = obj
    return [chapters[n] for n in sorted(chapters)]


def parse_chapter_skeleton_output(
    text: str,
) -> tuple[str, list[dict[str, Any]], list[str], dict[str, Any] | None]:
    """Parse chapter skeleton JSON output from the LLM."""
    warnings: list[str] = []
    raw_text = str(text or "")

    if not raw_text.strip():
        return "", [], warnings, {
            "code": "CHAPTER_SKELETON_PARSE_ERROR",
            "message": "LLM output is empty",
        }

    value, _raw_json = extract_json_value(raw_text)
    if not isinstance(value, dict):
        # Full JSON parse failed — try partial recovery
        if likely_truncated_json(raw_text):
            warnings.append("output_possibly_truncated")
        recovered = _recover_partial_skeleton_chapters(raw_text)
        if recovered:
            warnings.append("partial_json_recovery")
            chapters = _normalize_skeleton_chapters(recovered)
            if chapters:
                content_md = _build_content_md_from_chapters(chapters)
                return content_md, chapters, warnings, None
        return raw_text, [], warnings, {
            "code": "CHAPTER_SKELETON_PARSE_ERROR",
            "message": "Failed to extract JSON structure from LLM output",
        }

    # Try to find chapters in top-level or nested structure
    chapters_raw = _find_chapters_in_nested(value)
    if not chapters_raw:
        # JSON found but no chapters key — try partial recovery from raw text
        if likely_truncated_json(raw_text):
            warnings.append("output_possibly_truncated")
        recovered = _recover_partial_skeleton_chapters(raw_text)
        if recovered:
            warnings.append("partial_json_recovery")
            chapters = _normalize_skeleton_chapters(recovered)
            if chapters:
                content_md = _build_content_md_from_chapters(chapters)
                return content_md, chapters, warnings, None
        return str(value.get("content_md") or value.get("outline_md") or raw_text), [], warnings, {
            "code": "CHAPTER_SKELETON_PARSE_ERROR",
            "message": "JSON found but missing 'chapters' array",
        }

    chapters = _normalize_skeleton_chapters(chapters_raw)
    if not chapters:
        if likely_truncated_json(raw_text):
            warnings.append("output_possibly_truncated")
        return "", [], warnings, {
            "code": "CHAPTER_SKELETON_PARSE_ERROR",
            "message": "No valid chapters found in JSON output",
        }

    content_md = _build_content_md_from_chapters(chapters)
    return content_md, chapters, warnings, None


def _normalize_skeleton_chapters(chapters_raw: list[Any]) -> list[dict[str, Any]]:
    """Normalize chapter skeleton objects while preserving extra keys."""
    normalized_by_number: dict[int, dict[str, Any]] = {}

    for item in chapters_raw:
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("number", 0))
        except (TypeError, ValueError):
            continue
        if number <= 0:
            continue

        title = str(item.get("title") or "")
        summary = str(item.get("summary") or "")
        beats_raw = item.get("beats") or []

        beats: list[str] = []
        if isinstance(beats_raw, list):
            beats = [str(beat) for beat in beats_raw if beat is not None]
        elif str(beats_raw).strip():
            beats = [str(beats_raw)]

        entry: dict[str, Any] = {
            "number": number,
            "title": title,
            "summary": summary,
            "beats": beats,
        }
        for key, value in item.items():
            if key in entry:
                continue
            entry[key] = value

        normalized_by_number[number] = entry

    return [normalized_by_number[number] for number in sorted(normalized_by_number)]


def _build_content_md_from_chapters(chapters: list[dict[str, Any]]) -> str:
    """Build markdown content from normalized chapter skeletons."""
    parts: list[str] = []

    for chapter in chapters:
        number = chapter.get("number", "")
        title = str(chapter.get("title") or "").strip()
        heading = f"### 第{number}章"
        if title:
            heading = f"{heading} {title}"

        body_parts: list[str] = []
        summary = str(chapter.get("summary") or "").strip()
        if summary:
            body_parts.append(summary)

        beats = chapter.get("beats")
        if isinstance(beats, list):
            beat_lines = [f"- {str(beat)}" for beat in beats if str(beat).strip()]
            if beat_lines:
                body_parts.append("关键节拍：\n" + "\n".join(beat_lines))

        scenes = chapter.get("scenes")
        if isinstance(scenes, list):
            scene_lines = [f"- {str(scene)}" for scene in scenes if str(scene).strip()]
            if scene_lines:
                body_parts.append("场景：\n" + "\n".join(scene_lines))

        conflict = str(chapter.get("conflict") or "").strip()
        if conflict:
            body_parts.append(f"冲突：{conflict}")

        resolution = str(chapter.get("resolution") or "").strip()
        if resolution:
            body_parts.append(f"解决：{resolution}")

        pov = str(chapter.get("pov") or "").strip()
        if pov:
            body_parts.append(f"视角：{pov}")

        word_count_target = chapter.get("word_count_target")
        if word_count_target not in (None, ""):
            body_parts.append(f"目标字数：{word_count_target}")

        parts.append(heading if not body_parts else f"{heading}\n\n" + "\n\n".join(body_parts))

    return "\n\n".join(parts)
