from __future__ import annotations

from typing import Any

from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent


def _clean_str(value: Any) -> str:
    return str(value or "").strip()


def _clean_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text and text not in tags:
            tags.append(text)
    return tags


def _merge_text(existing: str, incoming: str) -> str:
    if not incoming:
        return existing
    if not existing:
        return incoming
    if incoming in existing:
        return existing
    return f"{existing}\n{incoming}"


class EntryExtractionAgent(BaseExtractionAgent):
    agent_name = "entry"
    system_prompt_file = "entry_system.md"
    user_prompt_file = "entry_user.md"

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        if not isinstance(raw_json, dict):
            return {"entries": []}

        entries_raw = raw_json.get("entries")
        entries: list[dict[str, Any]] = []
        if isinstance(entries_raw, list):
            for item in entries_raw:
                if not isinstance(item, dict):
                    continue
                title = _clean_str(item.get("title"))
                content = _clean_str(item.get("content"))
                if not title and not content:
                    continue
                entries.append({"title": title, "content": content, "tags": _clean_tags(item.get("tags"))})

        return {"entries": entries}

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        merged: dict[str, dict[str, Any]] = {}

        for result in chunk_results:
            entries = result.get("entries")
            if not isinstance(entries, list):
                continue

            for item in entries:
                if not isinstance(item, dict):
                    continue
                title = _clean_str(item.get("title"))
                if not title:
                    continue

                key = title.casefold()
                content = _clean_str(item.get("content"))
                tags = _clean_tags(item.get("tags"))

                if key not in merged:
                    merged[key] = {"title": title, "content": content, "tags": tags}
                    continue

                existing = merged[key]
                existing["content"] = _merge_text(_clean_str(existing.get("content")), content)

                existing_tags = existing.get("tags")
                existing_list = existing_tags if isinstance(existing_tags, list) else []
                for tag in tags:
                    if tag not in existing_list:
                        existing_list.append(tag)
                existing["tags"] = existing_list

        entries = list(merged.values())
        entries.sort(key=lambda e: str(e.get("title") or ""))
        return {"entries": entries}

