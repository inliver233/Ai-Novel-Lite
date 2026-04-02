"""Dynamic extraction agent: configurable agent with scoped task definition.

Instead of fixed roles (one agent = all characters), a DynamicExtractionAgent
receives a specific scope (e.g., "extract protagonist faction characters") and
focuses only on that subset. Multiple instances can run in parallel with
different scopes.
"""

from __future__ import annotations

from typing import Any

from app.llm.strategy import LLMStrategy
from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent, _load_prompt
from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import ChunkInfo

# Task type → Chinese display name (for prompt injection)
_TYPE_NAME_MAP: dict[str, str] = {
    "structure": "章节结构",
    "character": "角色",
    "entry": "世界观条目",
    "detailed_outline": "细纲",
}


# ---------------------------------------------------------------------------
# Reusable parse / merge helpers (extracted from original agent classes)
# ---------------------------------------------------------------------------

def _clean_str(value: Any) -> str:
    return str(value or "").strip()


def _maybe_text(value: Any) -> str | None:
    text = _clean_str(value)
    return text or None


def _merge_text(existing: str | None, incoming: str | None) -> str | None:
    if not incoming:
        return existing
    if not existing:
        return incoming
    if incoming in existing:
        return existing
    return f"{existing}\n{incoming}"


def _coerce_int(value: Any) -> int | None:
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
    return None


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


# --- Structure ---

def _parse_structure(raw_json: Any) -> dict[str, Any]:
    if not isinstance(raw_json, dict):
        return {"outline_md": "", "volumes": [], "chapters": []}
    outline_md = _clean_str(raw_json.get("outline_md"))

    volumes_raw = raw_json.get("volumes")
    volumes: list[dict[str, Any]] = []
    if isinstance(volumes_raw, list):
        for item in volumes_raw:
            if not isinstance(item, dict):
                continue
            number = _coerce_int(item.get("number"))
            if number is None:
                continue
            volumes.append({
                "number": number,
                "title": _clean_str(item.get("title")),
                "summary": _clean_str(item.get("summary")),
            })

    chapters_raw = raw_json.get("chapters")
    chapters: list[dict[str, Any]] = []
    if isinstance(chapters_raw, list):
        for item in chapters_raw:
            if not isinstance(item, dict):
                continue
            number = _coerce_int(item.get("number"))
            if number is None:
                continue
            chapters.append({
                "number": number,
                "title": _clean_str(item.get("title")),
                "beats": _clean_beats(item.get("beats")),
            })

    if volumes and not chapters:
        chapters = [
            {
                "number": volume["number"],
                "title": volume["title"],
                "beats": [volume["summary"]] if volume.get("summary") else [],
            }
            for volume in volumes
        ]

    return {"outline_md": outline_md, "volumes": volumes, "chapters": chapters}


def _merge_structure(chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
    if not chunk_results:
        return {"outline_md": "", "volumes": [], "chapters": []}
    outline_parts: list[str] = []
    volumes_by_number: dict[int, dict[str, Any]] = {}
    chapters_by_number: dict[int, dict[str, Any]] = {}
    for result in chunk_results:
        outline_md = _clean_str(result.get("outline_md"))
        if outline_md:
            outline_parts.append(outline_md)

        volumes_raw = result.get("volumes")
        if isinstance(volumes_raw, list):
            for item in volumes_raw:
                if not isinstance(item, dict):
                    continue
                number = _coerce_int(item.get("number"))
                if number is None:
                    continue
                volume = {
                    "number": number,
                    "title": _clean_str(item.get("title")),
                    "summary": _clean_str(item.get("summary")),
                }
                existing_volume = volumes_by_number.get(number)
                if existing_volume is None:
                    volumes_by_number[number] = volume
                elif len(_clean_str(volume.get("summary"))) > len(_clean_str(existing_volume.get("summary"))):
                    volumes_by_number[number] = volume
                elif not _clean_str(existing_volume.get("title")) and _clean_str(volume.get("title")):
                    existing_volume["title"] = _clean_str(volume.get("title"))

        chapters_raw = result.get("chapters")
        if not isinstance(chapters_raw, list):
            continue
        for item in chapters_raw:
            if not isinstance(item, dict):
                continue
            number = _coerce_int(item.get("number"))
            if number is None:
                continue
            chapter = {
                "number": number,
                "title": _clean_str(item.get("title")),
                "beats": _clean_beats(item.get("beats")),
            }
            existing = chapters_by_number.get(number)
            if existing is None:
                chapters_by_number[number] = chapter
            elif len(chapter.get("beats", [])) > len(existing.get("beats", [])):
                chapters_by_number[number] = chapter
            elif not _clean_str(existing.get("title")) and _clean_str(chapter.get("title")):
                existing["title"] = _clean_str(chapter.get("title"))
    outline_md = "\n\n---\n\n".join([p for p in outline_parts if p.strip()])
    merged_volumes = [volumes_by_number[n] for n in sorted(volumes_by_number)]
    merged_chapters = [chapters_by_number[n] for n in sorted(chapters_by_number)]

    if merged_volumes and not merged_chapters:
        merged_chapters = [
            {
                "number": volume["number"],
                "title": volume["title"],
                "beats": [volume["summary"]] if volume.get("summary") else [],
            }
            for volume in merged_volumes
        ]

    return {"outline_md": outline_md, "volumes": merged_volumes, "chapters": merged_chapters}


# --- Character ---

def _parse_characters(raw_json: Any) -> dict[str, Any]:
    if not isinstance(raw_json, dict):
        return {"characters": []}
    characters_raw = raw_json.get("characters")
    characters: list[dict[str, Any]] = []
    if isinstance(characters_raw, list):
        for item in characters_raw:
            if not isinstance(item, dict):
                continue
            name = _clean_str(item.get("name"))
            if not name:
                continue
            characters.append({
                "name": name,
                "role": _maybe_text(item.get("role")),
                "profile": _maybe_text(item.get("profile")),
                "notes": _maybe_text(item.get("notes")),
            })
    return {"characters": characters}


def _merge_characters(chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, dict[str, Any]] = {}
    for result in chunk_results:
        chars = result.get("characters")
        if not isinstance(chars, list):
            continue
        for item in chars:
            if not isinstance(item, dict):
                continue
            name = _clean_str(item.get("name"))
            if not name:
                continue
            key = name.casefold()
            role = _maybe_text(item.get("role"))
            profile = _maybe_text(item.get("profile"))
            notes = _maybe_text(item.get("notes"))
            if key not in merged:
                merged[key] = {"name": name, "role": role, "profile": profile, "notes": notes}
                continue
            existing = merged[key]
            existing_role = _maybe_text(existing.get("role"))
            if role and (not existing_role or len(role) > len(existing_role)):
                existing["role"] = role
            existing["profile"] = _merge_text(_maybe_text(existing.get("profile")), profile)
            existing["notes"] = _merge_text(_maybe_text(existing.get("notes")), notes)
    characters = list(merged.values())
    characters.sort(key=lambda c: str(c.get("name") or ""))
    return {"characters": characters}


# --- Entry ---

def _parse_entries(raw_json: Any) -> dict[str, Any]:
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


def _merge_entries(chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
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
            existing["content"] = _merge_text(_clean_str(existing.get("content")), content) or ""
            existing_tags = existing.get("tags", [])
            for tag in tags:
                if tag not in existing_tags:
                    existing_tags.append(tag)
            existing["tags"] = existing_tags
    entries = list(merged.values())
    entries.sort(key=lambda e: str(e.get("title") or ""))
    return {"entries": entries}


# --- Detailed Outline ---

def _parse_detailed_outlines(raw_json: Any) -> dict[str, Any]:
    if not isinstance(raw_json, dict):
        return {"detailed_outlines": []}
    outlines_raw = raw_json.get("detailed_outlines")
    outlines: list[dict[str, Any]] = []
    if isinstance(outlines_raw, list):
        for item in outlines_raw:
            if not isinstance(item, dict):
                continue
            vol_num = _coerce_int(item.get("volume_number"))
            if vol_num is None:
                continue
            chapters_raw = item.get("chapters")
            chapters: list[dict[str, Any]] = []
            if isinstance(chapters_raw, list):
                for ch in chapters_raw:
                    if not isinstance(ch, dict):
                        continue
                    ch_num = _coerce_int(ch.get("number"))
                    if ch_num is None:
                        continue
                    chapters.append({
                        "number": ch_num,
                        "title": _clean_str(ch.get("title")),
                        "summary": _clean_str(ch.get("summary")),
                        "beats": _clean_beats(ch.get("beats")),
                        "characters": _clean_tags(ch.get("characters")),
                        "emotional_arc": _clean_str(ch.get("emotional_arc")),
                        "foreshadowing": _clean_tags(ch.get("foreshadowing")),
                    })
            outlines.append({
                "volume_number": vol_num,
                "volume_title": _clean_str(item.get("volume_title")),
                "volume_summary": _clean_str(item.get("volume_summary")),
                "chapters": chapters,
            })
    return {"detailed_outlines": outlines}


def _merge_detailed_outlines(chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
    by_volume: dict[int, dict[str, Any]] = {}
    for result in chunk_results:
        outlines = result.get("detailed_outlines")
        if not isinstance(outlines, list):
            continue
        for item in outlines:
            if not isinstance(item, dict):
                continue
            vol_num = _coerce_int(item.get("volume_number"))
            if vol_num is None:
                continue
            if vol_num not in by_volume:
                by_volume[vol_num] = {
                    "volume_number": vol_num,
                    "volume_title": _clean_str(item.get("volume_title")),
                    "volume_summary": _clean_str(item.get("volume_summary")),
                    "chapters": [],
                }
            existing = by_volume[vol_num]
            # Prefer longer summary
            incoming_summary = _clean_str(item.get("volume_summary"))
            if incoming_summary and len(incoming_summary) > len(_clean_str(existing.get("volume_summary"))):
                existing["volume_summary"] = incoming_summary
            # Merge chapters by number
            chapters_raw = item.get("chapters")
            if isinstance(chapters_raw, list):
                existing_ch_nums = {c.get("number") for c in existing["chapters"] if isinstance(c, dict)}
                for ch in chapters_raw:
                    if isinstance(ch, dict) and ch.get("number") not in existing_ch_nums:
                        existing["chapters"].append(ch)
    # Sort volumes and their chapters
    merged = [by_volume[n] for n in sorted(by_volume)]
    for vol in merged:
        vol["chapters"].sort(key=lambda c: int(c.get("number") or 0))
    return {"detailed_outlines": merged}


# Dispatch tables
_PARSE_DISPATCH: dict[str, Any] = {
    "structure": _parse_structure,
    "character": _parse_characters,
    "entry": _parse_entries,
    "detailed_outline": _parse_detailed_outlines,
}

_MERGE_DISPATCH: dict[str, Any] = {
    "structure": _merge_structure,
    "character": _merge_characters,
    "entry": _merge_entries,
    "detailed_outline": _merge_detailed_outlines,
}


class DynamicExtractionAgent(BaseExtractionAgent):
    """Configurable extraction agent with scoped task definition.

    Uses the existing system prompts (character_system.md, etc.) but with a
    scoped user prompt that focuses extraction on a specific subset of content.
    """

    def __init__(
        self,
        strategy: LLMStrategy,
        *,
        base_url: str,
        api_key: str,
        model: str,
        config: AgentPipelineConfig,
        provider: str = "openai_compatible",
        task_id: str,
        task_type: str,
        scope: str,
        display_name: str,
    ) -> None:
        super().__init__(
            strategy,
            base_url=base_url,
            api_key=api_key,
            model=model,
            config=config,
            provider=provider,
        )
        self.agent_name = task_id
        self._task_type = task_type
        self._scope = scope
        self._display_name = display_name
        # Reuse existing system prompts for domain expertise
        self.system_prompt_file = f"{task_type}_system.md"
        # Use the scoped user prompt template
        self.user_prompt_file = "dynamic_extraction_user.md"

    def build_user_prompt(self, chunk: ChunkInfo, analysis_context: str = "") -> str:
        """Build user prompt with scope injection."""
        template = self.user_template
        type_name = _TYPE_NAME_MAP.get(self._task_type, self._task_type)
        return (
            template
            .replace("{{task_type_name}}", type_name)
            .replace("{{scope}}", self._scope)
            .replace("{{chunk_text}}", chunk.text)
            .replace("{{chunk_index}}", str(chunk.chunk_index + 1))
            .replace("{{total_chunks}}", str(chunk.total_chunks))
            .replace("{{analysis_context}}", analysis_context)
        )

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
        """Delegate to type-specific parsing."""
        parser = _PARSE_DISPATCH.get(self._task_type)
        if parser:
            return parser(raw_json)
        return raw_json if isinstance(raw_json, dict) else {}

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
        """Delegate to type-specific merging."""
        if not chunk_results:
            return {}
        merger = _MERGE_DISPATCH.get(self._task_type)
        if merger:
            return merger(chunk_results)
        return chunk_results[-1]
