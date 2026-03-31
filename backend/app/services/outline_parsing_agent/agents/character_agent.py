from __future__ import annotations

from typing import Any

from app.services.outline_parsing_agent.agents.base import BaseExtractionAgent


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


class CharacterExtractionAgent(BaseExtractionAgent):
    agent_name = "character"
    system_prompt_file = "character_system.md"
    user_prompt_file = "character_user.md"

    def parse_response(self, raw_json: Any) -> dict[str, Any]:
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
                characters.append(
                    {
                        "name": name,
                        "role": _maybe_text(item.get("role")),
                        "profile": _maybe_text(item.get("profile")),
                        "notes": _maybe_text(item.get("notes")),
                    }
                )

        return {"characters": characters}

    def merge_results(self, chunk_results: list[dict[str, Any]]) -> dict[str, Any]:
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

