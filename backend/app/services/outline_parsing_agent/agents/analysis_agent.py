from __future__ import annotations

from typing import Any

from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes", "y", "是", "有"):
            return True
        if normalized in ("false", "0", "no", "n", "否", "无"):
            return False
    return False


def _coerce_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0
        try:
            return int(float(text))
        except Exception:
            return 0
    return 0


class AnalysisAgent(BaseExtractionAgent):
    agent_name = "analysis"
    system_prompt_file = "analysis_system.md"
    user_prompt_file = "analysis_user.md"

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        if not isinstance(raw_json, dict):
            return {
                "content_types": [],
                "has_chapters": False,
                "has_characters": False,
                "has_entries": False,
                "estimated_chapter_count": 0,
                "format_description": "",
            }

        content_types_raw = raw_json.get("content_types")
        content_types: list[str] = []
        if isinstance(content_types_raw, list):
            for item in content_types_raw:
                if item is None:
                    continue
                text = str(item).strip()
                if text and text not in content_types:
                    content_types.append(text)

        return {
            "content_types": content_types,
            "has_chapters": _coerce_bool(raw_json.get("has_chapters")),
            "has_characters": _coerce_bool(raw_json.get("has_characters")),
            "has_entries": _coerce_bool(raw_json.get("has_entries")),
            "estimated_chapter_count": max(0, _coerce_int(raw_json.get("estimated_chapter_count"))),
            "format_description": str(raw_json.get("format_description") or "").strip(),
        }

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        if not chunk_results:
            return {
                "content_types": [],
                "has_chapters": False,
                "has_characters": False,
                "has_entries": False,
                "estimated_chapter_count": 0,
                "format_description": "",
            }

        content_types: list[str] = []
        has_chapters = False
        has_characters = False
        has_entries = False
        estimated_chapter_count = 0
        format_description = ""

        for result in chunk_results:
            types = result.get("content_types")
            if isinstance(types, list):
                for item in types:
                    if item is None:
                        continue
                    text = str(item).strip()
                    if text and text not in content_types:
                        content_types.append(text)

            has_chapters = has_chapters or _coerce_bool(result.get("has_chapters"))
            has_characters = has_characters or _coerce_bool(result.get("has_characters"))
            has_entries = has_entries or _coerce_bool(result.get("has_entries"))
            estimated_chapter_count = max(estimated_chapter_count, _coerce_int(result.get("estimated_chapter_count")))

            desc = str(result.get("format_description") or "").strip()
            if len(desc) > len(format_description):
                format_description = desc

        return {
            "content_types": content_types,
            "has_chapters": has_chapters,
            "has_characters": has_characters,
            "has_entries": has_entries,
            "estimated_chapter_count": max(0, estimated_chapter_count),
            "format_description": format_description,
        }

