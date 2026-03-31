from __future__ import annotations

import unittest

from app.api.routes.entries import _tag_to_like_pattern
from app.schemas.entries import EntryCreate, EntryUpdate


class TestEntries(unittest.TestCase):
    def test_entry_create_normalizes_title_and_tags(self) -> None:
        body = EntryCreate(
            title='  雨夜相遇  ',
            content='内容',
            tags=[' 设定 ', '设定', ' ', '伏笔'],
        )

        self.assertEqual(body.title, '雨夜相遇')
        self.assertEqual(body.tags, ['设定', '伏笔'])

    def test_entry_update_rejects_blank_title_after_trim(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            EntryUpdate(title='   ')

        self.assertIn('title cannot be blank', str(ctx.exception))

    def test_tag_like_pattern_escapes_sql_wildcards(self) -> None:
        pattern = _tag_to_like_pattern('线索_100%')

        self.assertTrue(pattern.startswith('%'))
        self.assertTrue(pattern.endswith('%'))
        self.assertIn('\\_', pattern)
        self.assertIn('\\%', pattern)


if __name__ == '__main__':
    unittest.main()
