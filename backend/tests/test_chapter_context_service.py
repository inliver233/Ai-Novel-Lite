from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.schemas.chapter_generate import ChapterGenerateContext
from app.services.chapter_context_service import _format_entries, assemble_chapter_generate_render_values


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
