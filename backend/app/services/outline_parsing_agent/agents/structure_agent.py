from __future__ import annotations

from typing import Any

from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent


def _coerce_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(float(text))
        except Exception:
            return None
    return None


def _clean_str(value: Any) -> str:
    return str(value or "").strip()


def _clean_beats(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    beats: list[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            beats.append(text)
    return beats


class StructureExtractionAgent(BaseExtractionAgent):
    agent_name = "structure"
    system_prompt_file = "structure_system.md"
    user_prompt_file = "structure_user.md"

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        if not isinstance(raw_json, dict):
            return {"outline_md": "", "volumes": [], "chapters": []}

        outline_md = _clean_str(raw_json.get("outline_md"))

        # Prefer new volumes format
        volumes_raw = raw_json.get("volumes")
        volumes: list[dict[str, Any]] = []
        if isinstance(volumes_raw, list):
            for item in volumes_raw:
                if not isinstance(item, dict):
                    continue
                number = _coerce_int(item.get("number"))
                if number is None:
                    continue
                volumes.append(
                    {
                        "number": number,
                        "title": _clean_str(item.get("title")),
                        "summary": _clean_str(item.get("summary")),
                    }
                )

        # Fallback: extract chapters (backward compat)
        chapters_raw = raw_json.get("chapters")
        chapters: list[dict[str, Any]] = []
        if isinstance(chapters_raw, list):
            for item in chapters_raw:
                if not isinstance(item, dict):
                    continue
                number = _coerce_int(item.get("number"))
                if number is None:
                    continue
                chapters.append(
                    {
                        "number": number,
                        "title": _clean_str(item.get("title")),
                        "beats": _clean_beats(item.get("beats")),
                    }
                )

        # If we got volumes but no chapters, synthesize compat chapters
        if volumes and not chapters:
            chapters = [
                {
                    "number": v["number"],
                    "title": v["title"],
                    "beats": [v["summary"]] if v.get("summary") else [],
                }
                for v in volumes
            ]

        return {"outline_md": outline_md, "volumes": volumes, "chapters": chapters}

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        if not chunk_results:
            return {"outline_md": "", "volumes": [], "chapters": []}

        outline_parts: list[str] = []
        volumes_by_number: dict[int, dict[str, Any]] = {}
        chapters_by_number: dict[int, dict[str, Any]] = {}

        for result in chunk_results:
            outline_md = _clean_str(result.get("outline_md"))
            if outline_md:
                outline_parts.append(outline_md)

            # Merge volumes
            volumes_raw = result.get("volumes")
            if isinstance(volumes_raw, list):
                for item in volumes_raw:
                    if not isinstance(item, dict):
                        continue
                    number = _coerce_int(item.get("number"))
                    if number is None:
                        continue
                    volume: dict[str, Any] = {
                        "number": number,
                        "title": _clean_str(item.get("title")),
                        "summary": _clean_str(item.get("summary")),
                    }
                    existing = volumes_by_number.get(number)
                    if existing is None:
                        volumes_by_number[number] = volume
                    elif len(_clean_str(volume.get("summary"))) > len(_clean_str(existing.get("summary"))):
                        volumes_by_number[number] = volume

            # Merge chapters (backward compat)
            chapters_raw = result.get("chapters")
            if not isinstance(chapters_raw, list):
                continue

            for item in chapters_raw:
                if not isinstance(item, dict):
                    continue
                number = _coerce_int(item.get("number"))
                if number is None:
                    continue

                chapter: dict[str, Any] = {
                    "number": number,
                    "title": _clean_str(item.get("title")),
                    "beats": _clean_beats(item.get("beats")),
                }

                existing = chapters_by_number.get(number)
                if existing is None:
                    chapters_by_number[number] = chapter
                    continue

                existing_beats = existing.get("beats")
                new_beats = chapter.get("beats")
                existing_len = len(existing_beats) if isinstance(existing_beats, list) else 0
                new_len = len(new_beats) if isinstance(new_beats, list) else 0

                if new_len > existing_len:
                    chapters_by_number[number] = chapter
                    continue

                if not _clean_str(existing.get("title")) and _clean_str(chapter.get("title")):
                    existing["title"] = _clean_str(chapter.get("title"))

        outline_md = "\n\n---\n\n".join([p for p in outline_parts if p.strip()])
        merged_volumes = [volumes_by_number[n] for n in sorted(volumes_by_number)]
        merged_chapters = [chapters_by_number[n] for n in sorted(chapters_by_number)]

        # If we got volumes but no chapters, synthesize compat chapters
        if merged_volumes and not merged_chapters:
            merged_chapters = [
                {
                    "number": v["number"],
                    "title": v["title"],
                    "beats": [v["summary"]] if v.get("summary") else [],
                }
                for v in merged_volumes
            ]

        return {"outline_md": outline_md, "volumes": merged_volumes, "chapters": merged_chapters}
