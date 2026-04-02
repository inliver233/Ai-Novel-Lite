from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.schemas.chapter_generate import ChapterGenerateContext
from app.services.chapter_context_service import (
    _format_entries,
    _parse_detailed_structure_chapters,
    assemble_chapter_generate_render_values,
    load_detailed_outline_context,
)


class TestParseDetailedStructureChapters(unittest.TestCase):
    def test_none_input(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters(None), [])

    def test_empty_string(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters(""), [])

    def test_invalid_json(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters("not-json"), [])

    def test_json_not_dict(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters("[1,2]"), [])

    def test_no_chapters_key(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters('{"other": 1}'), [])

    def test_chapters_not_list(self) -> None:
        self.assertEqual(_parse_detailed_structure_chapters('{"chapters": "bad"}'), [])

    def test_valid_chapters(self) -> None:
        data = {"chapters": [
            {"number": 1, "title": "A", "summary": "S1", "beats": ["b1"]},
            {"number": 2, "title": "B", "summary": "S2", "beats": []},
            "not-a-dict",
        ]}
        result = _parse_detailed_structure_chapters(json.dumps(data))
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["number"], 1)
        self.assertEqual(result[1]["title"], "B")


class TestLoadDetailedOutlineContext(unittest.TestCase):
    def _make_outline_row(self, volume_number, volume_title, chapters):
        row = SimpleNamespace(
            volume_number=volume_number,
            volume_title=volume_title,
            structure_json=json.dumps({"chapters": chapters}),
            status="done",
        )
        return row

    def _make_db_mock(self, rows):
        db = MagicMock()
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = rows
        execute_mock = MagicMock()
        execute_mock.scalars.return_value = scalars_mock
        db.execute.return_value = execute_mock
        return db

    def test_no_rows_returns_empty(self) -> None:
        db = self._make_db_mock([])
        result = load_detailed_outline_context(1, "outline-1", db)
        self.assertEqual(result, "")

    def test_chapter_not_in_any_volume(self) -> None:
        row = self._make_outline_row(1, "First", [
            {"number": 1, "title": "Ch1", "summary": "S1", "beats": ["b1"]},
            {"number": 2, "title": "Ch2", "summary": "S2", "beats": []},
        ])
        db = self._make_db_mock([row])
        result = load_detailed_outline_context(99, "outline-1", db)
        self.assertEqual(result, "")

    def test_basic_output_format(self) -> None:
        chapters = [
            {"number": 1, "title": "Ch1", "summary": "S1", "beats": ["b1", "b2"]},
            {"number": 2, "title": "Ch2", "summary": "S2", "beats": ["b3"]},
            {"number": 3, "title": "Ch3", "summary": "S3", "beats": []},
            {"number": 4, "title": "Ch4", "summary": "S4", "beats": []},
            {"number": 5, "title": "Ch5", "summary": "S5", "beats": []},
        ]
        row = self._make_outline_row(1, "First Vol", chapters)
        db = self._make_db_mock([row])

        result = load_detailed_outline_context(3, "outline-1", db)

        # Volume header
        self.assertIn("\u7b2c1\u5377", result)
        self.assertIn("First Vol", result)
        # Current chapter plan
        self.assertIn("\u7b2c3\u7ae0", result)
        self.assertIn("S3", result)
        # Previous chapters (1, 2)
        self.assertIn("\u7b2c1\u7ae0", result)
        self.assertIn("S1", result)
        self.assertIn("\u7b2c2\u7ae0", result)
        self.assertIn("S2", result)
        # Next chapters (4, 5)
        self.assertIn("\u7b2c4\u7ae0", result)
        self.assertIn("S4", result)
        self.assertIn("\u7b2c5\u7ae0", result)
        self.assertIn("S5", result)

    def test_first_chapter_no_previous(self) -> None:
        chapters = [
            {"number": 1, "title": "Ch1", "summary": "S1", "beats": ["b1"]},
            {"number": 2, "title": "Ch2", "summary": "S2", "beats": []},
        ]
        row = self._make_outline_row(1, "Vol", chapters)
        db = self._make_db_mock([row])

        result = load_detailed_outline_context(1, "outline-1", db)

        self.assertIn("S1", result)
        self.assertNotIn("\u524d\u6587\u8d70\u5411", result)
        self.assertIn("\u540e\u6587\u8d70\u5411", result)
        self.assertIn("S2", result)

    def test_last_chapter_no_next(self) -> None:
        chapters = [
            {"number": 1, "title": "Ch1", "summary": "S1", "beats": []},
            {"number": 2, "title": "Ch2", "summary": "S2", "beats": ["b1"]},
        ]
        row = self._make_outline_row(1, "Vol", chapters)
        db = self._make_db_mock([row])

        result = load_detailed_outline_context(2, "outline-1", db)

        self.assertIn("\u524d\u6587\u8d70\u5411", result)
        self.assertIn("S1", result)
        self.assertNotIn("\u540e\u6587\u8d70\u5411", result)

    def test_beats_in_output(self) -> None:
        chapters = [
            {"number": 5, "title": "Ch5", "summary": "S5", "beats": ["beat-a", "beat-b"]},
        ]
        row = self._make_outline_row(2, "Vol2", chapters)
        db = self._make_db_mock([row])

        result = load_detailed_outline_context(5, "outline-1", db)

        self.assertIn("- beat-a", result)
        self.assertIn("- beat-b", result)

    def test_extra_keys_characters_and_emotion(self) -> None:
        chapters = [
            {
                "number": 3,
                "title": "Ch3",
                "summary": "S3",
                "beats": [],
                "characters": ["Alice", "Bob"],
                "emotional_arc": "rising tension",
            },
        ]
        row = self._make_outline_row(1, "Vol", chapters)
        db = self._make_db_mock([row])

        result = load_detailed_outline_context(3, "outline-1", db)

        self.assertIn("Alice", result)
        self.assertIn("Bob", result)
        self.assertIn("rising tension", result)


class TestAssembleRenderValuesIncludesDetailedOutline(unittest.TestCase):
    def test_detailed_outline_context_in_values(self) -> None:
        values, _ = assemble_chapter_generate_render_values(
            project=SimpleNamespace(name="P", genre="G", logline="L"),
            mode="replace",
            chapter_number=1,
            chapter_title="T",
            chapter_plan="",
            world_setting="",
            style_guide="",
            constraints="",
            characters_text="",
            entries_text="",
            outline_text="",
            instruction="I",
            target_word_count=None,
            previous_chapter="",
            previous_chapter_ending="",
            current_draft_tail="",
            smart_context_recent_summaries="",
            smart_context_recent_full="",
            smart_context_story_skeleton="",
            detailed_outline_context="test-context",
        )

        self.assertEqual(values["detailed_outline_context"], "test-context")
        self.assertEqual(values["story"]["detailed_outline_context"], "test-context")

    def test_default_empty_when_omitted(self) -> None:
        values, _ = assemble_chapter_generate_render_values(
            project=SimpleNamespace(name="P", genre="G", logline="L"),
            mode="replace",
            chapter_number=1,
            chapter_title="T",
            chapter_plan="",
            world_setting="",
            style_guide="",
            constraints="",
            characters_text="",
            entries_text="",
            outline_text="",
            instruction="I",
            target_word_count=None,
            previous_chapter="",
            previous_chapter_ending="",
            current_draft_tail="",
            smart_context_recent_summaries="",
            smart_context_recent_full="",
            smart_context_story_skeleton="",
        )

        self.assertEqual(values["detailed_outline_context"], "")


class TestChapterContextService(unittest.TestCase):
    def test_chapter_generate_context_trims_entry_ids(self) -> None:
        ctx = ChapterGenerateContext(entry_ids=[" entry-1 ", "entry-2"])
        self.assertEqual(ctx.entry_ids, ["entry-1", "entry-2"])

    def test_chapter_generate_context_rejects_blank_entry_ids(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            ChapterGenerateContext(entry_ids=[" "])

        self.assertIn("entry_ids cannot contain empty strings", str(ctx.exception))

    def test_format_entries_and_render_values_include_entries(self) -> None:
        entries_text = _format_entries(
            [
                SimpleNamespace(title="线索A", tags_json='["设定", "伏笔"]', content="内容A"),
                SimpleNamespace(title="", tags_json="not-json", content=""),
            ]
        )

        self.assertEqual(entries_text, "### [设定、伏笔] 线索A\n内容A\n\n### 无标题")

        values, _requirements = assemble_chapter_generate_render_values(
            project=SimpleNamespace(name="项目", genre="幻想", logline="一句话"),
            mode="replace",
            chapter_number=1,
            chapter_title="第一章",
            chapter_plan="",
            world_setting="",
            style_guide="",
            constraints="",
            characters_text="",
            entries_text=entries_text,
            outline_text="",
            instruction="写作",
            target_word_count=None,
            previous_chapter="",
            previous_chapter_ending="",
            current_draft_tail="",
            smart_context_recent_summaries="",
            smart_context_recent_full="",
            smart_context_story_skeleton="",
        )

        self.assertEqual(values["entries"], entries_text)
        self.assertEqual(values["project"]["entries"], entries_text)


if __name__ == "__main__":
    unittest.main()
