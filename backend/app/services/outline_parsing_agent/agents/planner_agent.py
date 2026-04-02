"""Planner agent: analyzes content and produces a dynamic task plan.

Extends the analysis phase to also determine how to decompose extraction work
into multiple focused sub-tasks, enabling the coordinator to spawn the right
number of agents dynamically.
"""

from __future__ import annotations

from typing import Any

from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent

_VALID_TASK_TYPES = frozenset({"structure", "character", "entry"})

# Fallback plan when the LLM fails to produce a valid one
_DEFAULT_TASK_PLAN: list[dict[str, str]] = [
    {
        "id": "structure",
        "type": "structure",
        "display_name": "大纲骨架",
        "scope": "提取全部章节结构，包括章节编号、标题和情节节拍",
    },
    {
        "id": "character",
        "type": "character",
        "display_name": "角色卡",
        "scope": "提取全部角色信息，包括姓名、角色定位、背景描述和发展方向",
    },
    {
        "id": "entry",
        "type": "entry",
        "display_name": "世界条目",
        "scope": "提取全部世界观设定条目，包括体系、势力、地点、物品等",
    },
]


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes", "y", "是", "有"):
            return True
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
        if text:
            try:
                return int(float(text))
            except Exception:
                pass
    return 0


def _validate_task_plan(raw_plan: Any) -> list[dict[str, str]]:
    """Validate and normalize the task_plan from the LLM response.

    Returns the default plan if the input is invalid.
    """
    if not isinstance(raw_plan, list) or not raw_plan:
        return list(_DEFAULT_TASK_PLAN)

    tasks: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    has_structure = False

    for item in raw_plan:
        if not isinstance(item, dict):
            continue

        task_id = str(item.get("id") or "").strip()
        task_type = str(item.get("type") or "").strip()
        display_name = str(item.get("display_name") or "").strip()
        scope = str(item.get("scope") or "").strip()

        if not task_id or not task_type or not scope:
            continue
        if task_type not in _VALID_TASK_TYPES:
            continue
        if task_id in seen_ids:
            continue

        seen_ids.add(task_id)
        if task_type == "structure":
            has_structure = True

        tasks.append({
            "id": task_id,
            "type": task_type,
            "display_name": display_name or task_type,
            "scope": scope,
        })

    if not tasks:
        return list(_DEFAULT_TASK_PLAN)

    # Ensure at least one structure task
    if not has_structure:
        tasks.insert(0, _DEFAULT_TASK_PLAN[0])

    return tasks


class PlannerAgent(BaseExtractionAgent):
    """Analyzes content and produces a task decomposition plan."""

    agent_name = "planner"
    system_prompt_file = "planner_system.md"
    user_prompt_file = "planner_user.md"

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        if not isinstance(raw_json, dict):
            return self._fallback_result()

        content_types_raw = raw_json.get("content_types")
        content_types: list[str] = []
        if isinstance(content_types_raw, list):
            for item in content_types_raw:
                if item is None:
                    continue
                text = str(item).strip()
                if text and text not in content_types:
                    content_types.append(text)

        complexity = str(raw_json.get("complexity") or "medium").strip().lower()
        if complexity not in ("low", "medium", "high"):
            complexity = "medium"

        task_plan = _validate_task_plan(raw_json.get("task_plan"))

        return {
            "content_types": content_types,
            "has_chapters": _coerce_bool(raw_json.get("has_chapters")),
            "has_characters": _coerce_bool(raw_json.get("has_characters")),
            "has_entries": _coerce_bool(raw_json.get("has_entries")),
            "estimated_chapter_count": max(0, _coerce_int(raw_json.get("estimated_chapter_count"))),
            "estimated_character_count": max(0, _coerce_int(raw_json.get("estimated_character_count"))),
            "estimated_entry_count": max(0, _coerce_int(raw_json.get("estimated_entry_count"))),
            "complexity": complexity,
            "format_description": str(raw_json.get("format_description") or "").strip(),
            "task_plan": task_plan,
        }

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        """Use the first chunk's analysis (planner only runs on the first chunk)."""
        if not chunk_results:
            return self._fallback_result()
        return chunk_results[0]

    @staticmethod
    def _fallback_result() -> dict[str, Any]:
        return {
            "content_types": [],
            "has_chapters": False,
            "has_characters": False,
            "has_entries": False,
            "estimated_chapter_count": 0,
            "estimated_character_count": 0,
            "estimated_entry_count": 0,
            "complexity": "medium",
            "format_description": "",
            "task_plan": list(_DEFAULT_TASK_PLAN),
        }
