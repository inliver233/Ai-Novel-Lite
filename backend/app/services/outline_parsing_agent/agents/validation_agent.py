from __future__ import annotations

import re
import time
from collections import Counter
from typing import Any

from app.services.outline_parsing_agent.models import (
    AgentStepResult,
    ParseResult,
    ParsedCharacter,
    ParsedEntry,
    ParsedOutline,
)

MAX_ENTRY_TAGS = 80
MAX_ENTRY_TAG_CHARS = 64


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


def _safe_int(value: Any) -> int | None:
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


def _normalize_entry_tags(value: Any, *, title: str, warnings: list[str]) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        warnings.append(f"条目: '{title or '（无标题）'}' 的标签格式错误（非列表）")
        return []

    tags: list[str] = []
    seen: set[str] = set()
    for raw_tag in value:
        text = _clean_str(raw_tag)
        if not text:
            continue
        if len(text) > MAX_ENTRY_TAG_CHARS:
            warnings.append(
                f"条目: '{title or '（无标题）'}' 的标签过长: '{text[:32]}'"
            )
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        tags.append(text)
        if len(tags) >= MAX_ENTRY_TAGS:
            warnings.append(f"条目: '{title or '（无标题）'}' 标签过多")
            break
    return tags


class ValidationAgent:
    agent_name = "validation"

    def validate(
        self,
        structure_result: AgentStepResult,
        character_result: AgentStepResult,
        entry_result: AgentStepResult,
        analysis_result: AgentStepResult | None = None,
    ) -> ParseResult:
        start = time.time()
        warnings: list[str] = []

        agent_log: list[AgentStepResult] = []
        if analysis_result is not None:
            agent_log.append(analysis_result)
        agent_log.extend([structure_result, character_result, entry_result])

        warnings.extend(self._collect_agent_warnings(agent_log))

        outline = self._build_outline(structure_result, warnings=warnings)
        characters, known_names = self._build_characters(character_result, warnings=warnings)
        entries = self._build_entries(entry_result, warnings=warnings)

        self._validate_chapter_continuity(outline, warnings=warnings)
        self._validate_character_references(outline, known_names=known_names, warnings=warnings)

        duration_ms = int((time.time() - start) * 1000)
        validation_step = AgentStepResult(
            agent_name=self.agent_name,
            status="success",
            duration_ms=duration_ms,
            tokens_used=0,
            warnings=[w for w in warnings if w.startswith("校验:")],
        )

        return ParseResult(
            outline=outline,
            characters=characters,
            entries=entries,
            agent_log=[*agent_log, validation_step],
            warnings=warnings,
        )

    def _collect_agent_warnings(self, agent_log: list[AgentStepResult]) -> list[str]:
        collected: list[str] = []
        for step in agent_log:
            if step.warnings:
                collected.extend([str(w) for w in step.warnings if str(w).strip()])
            if step.status == "error" and step.error_message:
                collected.append(f"{step.agent_name}: {step.error_message}")
        return collected

    def _build_outline(self, structure_result: AgentStepResult, *, warnings: list[str]) -> ParsedOutline:
        data = structure_result.data if isinstance(structure_result.data, dict) else {}

        outline_md = _clean_str(data.get("outline_md"))
        if not outline_md:
            warnings.append("结构: 大纲摘要为空")

        volumes_raw = data.get("volumes")
        volumes: list[dict[str, Any]] = []
        if isinstance(volumes_raw, list):
            for item in volumes_raw:
                if not isinstance(item, dict):
                    warnings.append("结构: 无效卷条目（非对象）")
                    continue

                number = _safe_int(item.get("number"))
                if number is None or number <= 0:
                    warnings.append(f"结构: 卷编号必须为正整数，当前值: {item.get('number')}")
                    continue

                title = _clean_str(item.get("title"))
                summary = _clean_str(item.get("summary"))
                if not title:
                    warnings.append(f"结构: 第 {number} 卷缺少标题")
                if not summary:
                    warnings.append(f"结构: 第 {number} 卷缺少摘要")

                volumes.append({"number": number, "title": title, "summary": summary})
            volumes.sort(key=lambda v: int(v.get("number") or 0))
        elif "volumes" in data and data.get("volumes") is not None:
            warnings.append("结构: 卷数据格式错误（非列表）")

        chapters_raw = data.get("chapters")
        chapters: list[dict[str, Any]] = []
        if chapters_raw is None and volumes:
            chapters_raw = []

        if not isinstance(chapters_raw, list):
            warnings.append("结构: 章节数据格式错误（非列表）")
            return ParsedOutline(outline_md=outline_md, volumes=volumes, chapters=[])

        for item in chapters_raw:
            if not isinstance(item, dict):
                warnings.append("结构: 无效章节条目（非对象）")
                continue

            number = _safe_int(item.get("number"))
            if number is None or number <= 0:
                warnings.append(f"结构: 章节编号必须为正整数，当前值: {item.get('number')}")
                continue

            title = _clean_str(item.get("title"))
            if not title:
                warnings.append(f"结构: 第 {number} 章缺少标题")

            beats = _clean_beats(item.get("beats"))
            if not beats:
                warnings.append(f"结构: 第 {number} 章没有情节节拍")

            chapters.append({"number": number, "title": title, "beats": beats})

        chapters.sort(key=lambda c: int(c.get("number") or 0))

        if volumes and not chapters:
            chapters = [
                {
                    "number": volume["number"],
                    "title": volume["title"],
                    "beats": [volume["summary"]] if volume.get("summary") else [],
                }
                for volume in volumes
            ]

        if not chapters and not volumes:
            warnings.append("结构: 未提取到任何章节")

        return ParsedOutline(outline_md=outline_md, volumes=volumes, chapters=chapters)

    def _build_characters(
        self, character_result: AgentStepResult, *, warnings: list[str]
    ) -> tuple[list[ParsedCharacter], frozenset[str]]:
        data = character_result.data if isinstance(character_result.data, dict) else {}
        characters_raw = data.get("characters")
        if not isinstance(characters_raw, list):
            warnings.append("角色: 角色数据格式错误（非列表）")
            return [], frozenset()

        characters: list[ParsedCharacter] = []
        known_names: set[str] = set()
        for item in characters_raw:
            if not isinstance(item, dict):
                warnings.append("角色: 无效角色条目（非对象）")
                continue

            name = _clean_str(item.get("name"))
            if not name:
                warnings.append("角色: 角色名称为空")
                continue

            key = name.casefold()
            if key in known_names:
                warnings.append(f"角色: 重复角色名: {name}")
            known_names.add(key)

            role = _clean_str(item.get("role")) or None
            profile = _clean_str(item.get("profile")) or None
            notes = _clean_str(item.get("notes")) or None
            characters.append(ParsedCharacter(name=name, role=role, profile=profile, notes=notes))

        characters.sort(key=lambda c: c.name)
        return characters, frozenset(known_names)

    def _build_entries(self, entry_result: AgentStepResult, *, warnings: list[str]) -> list[ParsedEntry]:
        data = entry_result.data if isinstance(entry_result.data, dict) else {}
        entries_raw = data.get("entries")
        if not isinstance(entries_raw, list):
            warnings.append("条目: 条目数据格式错误（非列表）")
            return []

        entries: list[ParsedEntry] = []
        for item in entries_raw:
            if not isinstance(item, dict):
                warnings.append("条目: 无效条目（非对象）")
                continue

            title = _clean_str(item.get("title"))
            content = _clean_str(item.get("content"))
            tags = _normalize_entry_tags(item.get("tags"), title=title, warnings=warnings)

            if not title:
                warnings.append("条目: 条目标题为空")
                continue
            if not content:
                warnings.append(f"条目: '{title}' 缺少内容")
                continue

            entries.append(ParsedEntry(title=title, content=content, tags=tags))

        entries.sort(key=lambda e: e.title)
        return entries

    def _validate_chapter_continuity(self, outline: ParsedOutline, *, warnings: list[str]) -> None:
        numbers = [c.get("number") for c in outline.chapters if isinstance(c, dict)]
        valid_numbers = [n for n in numbers if isinstance(n, int) and n > 0]
        if not valid_numbers:
            return

        max_n = max(valid_numbers)
        missing = [n for n in range(1, max_n + 1) if n not in set(valid_numbers)]
        if missing:
            warnings.append(f"校验: 章节编号不连续，缺少: {missing}")

        if min(valid_numbers) != 1:
            warnings.append(f"校验: 章节编号未从 1 开始（最小值={min(valid_numbers)}）")

    def _validate_character_references(
        self,
        outline: ParsedOutline,
        *,
        known_names: frozenset[str],
        warnings: list[str],
    ) -> None:
        if not known_names:
            return

        candidates = self._extract_candidate_names(outline)
        unknown = [name for name, count in candidates.items() if name.casefold() not in known_names and count >= 2]
        unknown = [n for n in unknown if n and not self._is_common_non_name(n)]
        if unknown:
            preview = sorted(unknown)[:30]
            warnings.append(f"校验: 情节中引用了可能缺失的角色: {preview}")

    def _extract_candidate_names(self, outline: ParsedOutline) -> Counter[str]:
        counts: Counter[str] = Counter()
        for chapter in outline.chapters:
            if not isinstance(chapter, dict):
                continue
            beats = chapter.get("beats")
            if not isinstance(beats, list):
                continue
            for beat in beats:
                if not isinstance(beat, str):
                    continue
                for name in self._candidate_names_from_beat(beat):
                    counts[name] += 1
        return counts

    def _candidate_names_from_beat(self, beat: str) -> list[str]:
        text = beat.strip()
        if not text:
            return []

        # Remove leading annotation like "[信息+]" to better isolate the subject.
        text = re.sub(r"^\[[^\]]+\]\s*", "", text)

        # Take the left side of "→" as the candidate "actor" segment.
        left = re.split(r"→|->|=>", text, maxsplit=1)[0].strip()
        if not left:
            return []

        # Split possible multiple actors.
        parts = re.split(r"[、,，&和与\s]+", left)
        names: list[str] = []
        for part in parts:
            candidate = part.strip()
            if not candidate:
                continue
            if len(candidate) > 10:
                continue
            if re.fullmatch(r"[0-9]+", candidate):
                continue
            names.append(candidate)
        return names

    def _is_common_non_name(self, text: str) -> bool:
        common = {
            "主角",
            "反派",
            "配角",
            "导师",
            "势力",
            "组织",
            "地点",
            "世界",
            "王国",
            "帝国",
            "魔法",
            "力量",
        }
        return text in common
