你是 AI 编码代理。根据代码审查结果，修复以下 Critical 和 High 级别问题。

## Critical Fix 1: stream_service.py — 不覆写 DetailedOutline 原始内容

问题: 生成章节骨架后直接覆写 DetailedOutline.content_md 和 structure_json，导致原始细纲内容丢失。

修复方案: 只更新 structure_json（添加/更新 chapters 键），保留原始 content_md 不变。

在 backend/app/services/chapter_skeleton_generation/stream_service.py 中:
- 找到 `detailed_outline.structure_json = json.dumps({"chapters": chapters}, ensure_ascii=False)`
- 修改为: 解析现有 structure_json，合并 chapters 键，保留其他键
- 删除 `detailed_outline.content_md = content_md` 这一行（不覆写原始细纲内容）

```python
# 替换这段:
# detailed_outline.structure_json = json.dumps({"chapters": chapters}, ensure_ascii=False)
# detailed_outline.content_md = content_md
# detailed_outline.status = "done"

# 改为:
existing_structure = {}
if detailed_outline.structure_json:
    try:
        existing_structure = json.loads(detailed_outline.structure_json)
        if not isinstance(existing_structure, dict):
            existing_structure = {}
    except Exception:
        existing_structure = {}
existing_structure["chapters"] = chapters
detailed_outline.structure_json = json.dumps(existing_structure, ensure_ascii=False)
# 不覆写 content_md — 保留原始细纲内容
```

## Critical Fix 2: stream_service.py — replace_chapters 范围限定为当前卷

问题: replace_chapters 删除整个 outline 下所有 Chapter，单卷生成会清空其他卷章节。

修复方案: 只删除属于当前卷的章节（根据 detailed_outline 的 structure_json 中的 chapter numbers）。

在 _create_chapter_records 函数中:
- 如果 replace=True，只删除 chapter number 在新生成范围内的章节
- 或者更安全的方式：只删除 number 在新 chapters 列表中的同号章节

```python
def _create_chapter_records(
    db: Session,
    detailed_outline: DetailedOutline,
    chapters: list[dict[str, Any]],
    *,
    replace: bool = True,
) -> list[dict[str, Any]]:
    new_numbers = {int(ch.get("number", 0)) for ch in chapters if int(ch.get("number", 0)) > 0}

    if replace and new_numbers:
        # 只删除与新生成章节同号的现有章节，不影响其他卷的章节
        existing = (
            db.execute(
                select(Chapter)
                .where(Chapter.outline_id == detailed_outline.outline_id)
                .where(Chapter.project_id == detailed_outline.project_id)
                .where(Chapter.number.in_(new_numbers))
            )
            .scalars()
            .all()
        )
        for row in existing:
            db.delete(row)
        db.flush()

    # ... 创建新章节的代码不变 ...
```

## High Fix 1: stream_service.py — 添加 start 事件，修正事件顺序

问题: 缺少 start 事件，且 result 在 progress("完成") 之前发送。

修复方案:
- 在函数开头 yield sse_start() 或 sse_progress(progress=0) 之后，发送一个明确的 start 事件
- 在函数末尾，先 yield sse_progress("完成", 100, "success")，再 yield sse_result(result_data)，最后 yield sse_done()

在 generate_chapter_skeleton_stream_events 中:
- 第一个 yield 改为: `yield sse_progress(message="准备生成章节骨架...", progress=0)` （已有，保留）
- 在 result_data 返回前，修正顺序:
```python
yield sse_progress(message="完成", progress=100, status="success")
yield sse_result(result_data)
yield sse_done()
```
（当前是 result -> progress -> done，改为 progress -> result -> done）

## High Fix 2: stream_service.py — replace_chapters=false 时处理冲突

在 _create_chapter_records 中，当 replace=False 时:
- 在 db.add 之前检查是否已存在同号章节
- 如果存在，跳过该章节（不创建）

```python
    if not replace:
        # 检查已有章节号
        existing_numbers = set(
            row[0] for row in db.execute(
                select(Chapter.number)
                .where(Chapter.outline_id == detailed_outline.outline_id)
                .where(Chapter.project_id == detailed_outline.project_id)
                .where(Chapter.number.in_(new_numbers))
            ).all()
        )
    else:
        existing_numbers = set()
    
    # 在创建循环中:
    # if number in existing_numbers:
    #     continue
```

## High Fix 3: frontend — 刷新 selected 细纲详情

在 frontend/src/pages/outline/useDetailedOutlineState.ts 的 generateChapterSkeleton 成功回调中:
- 在 await refresh() 之后，如果 selected 不为空，重新 selectVolume(selected.id) 刷新详情

```typescript
await refresh();
// 刷新当前选中的细纲详情
if (detailedOutlineId) {
  try {
    const updated = await getDetailedOutline(detailedOutlineId);
    setSelected(updated);
  } catch {
    // ignore
  }
}
```

## 严格要求
1. 只修改 stream_service.py 和 useDetailedOutlineState.ts 这两个文件
2. 不修改其他文件
3. 不创建新文件
4. 保持现有代码风格
5. 修复后运行 python -m compileall -q 验证后端
6. 修复后运行 npm run build 验证前端
