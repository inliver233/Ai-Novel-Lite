你是 AI 编码代理。按照以下指令修改 2 个文件。

重要：工作区中的未提交改动是本次任务的前序步骤产出，你可以安全地直接修改。不需要确认，直接执行。

## 修改 1: backend/app/services/chapter_skeleton_generation/stream_service.py

### Fix A: 不覆写 content_md（保留原始细纲内容）
找到这段代码:
```python
        detailed_outline.structure_json = json.dumps({"chapters": chapters}, ensure_ascii=False)
        detailed_outline.content_md = content_md
        detailed_outline.status = "done"
```

替换为:
```python
        # 合并 chapters 到现有 structure_json，保留原始细纲内容
        existing_structure: dict[str, Any] = {}
        if detailed_outline.structure_json:
            try:
                parsed = json.loads(detailed_outline.structure_json)
                if isinstance(parsed, dict):
                    existing_structure = parsed
            except Exception:
                pass
        existing_structure["chapters"] = chapters
        detailed_outline.structure_json = json.dumps(existing_structure, ensure_ascii=False)
        # 不覆写 content_md — 保留原始细纲内容
```

### Fix B: replace_chapters 只删除同号章节
找到 _create_chapter_records 函数中的这段代码:
```python
    if replace:
        existing = (
            db.execute(
                select(Chapter)
                .where(Chapter.outline_id == detailed_outline.outline_id)
                .where(Chapter.project_id == detailed_outline.project_id)
            )
            .scalars()
            .all()
        )
        for row in existing:
            db.delete(row)
        db.flush()
```

替换为:
```python
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
    elif not replace and new_numbers:
        # 跳过已存在的同号章节
        existing_numbers = {
            row[0]
            for row in db.execute(
                select(Chapter.number)
                .where(Chapter.outline_id == detailed_outline.outline_id)
                .where(Chapter.project_id == detailed_outline.project_id)
                .where(Chapter.number.in_(new_numbers))
            ).all()
        }
```

然后在创建循环中，在 `if number <= 0: continue` 之后，添加:
```python
        if not replace and number in existing_numbers:
            continue
```

需要在函数参数之后（`new_numbers` 之前）初始化 `existing_numbers`:
```python
    existing_numbers: set[int] = set()
```

### Fix C: 修正 SSE 事件顺序（result 在 progress 之前）
找到:
```python
        yield sse_result(result_data)
        yield sse_progress(message="完成", progress=100, status="success")
        yield sse_done()
```

替换为:
```python
        yield sse_progress(message="完成", progress=100, status="success")
        yield sse_result(result_data)
        yield sse_done()
```

## 修改 2: frontend/src/pages/outline/useDetailedOutlineState.ts

### Fix: 刷新 selected 细纲详情
在 generateChapterSkeleton 回调中，找到:
```typescript
      await refresh();
      toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateSkeletonDone);
```

替换为:
```typescript
      await refresh();
      // 刷新当前选中的细纲详情
      try {
        const updated = await getDetailedOutline(detailedOutlineId);
        setSelected(updated);
      } catch {
        // ignore — list already refreshed
      }
      toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateSkeletonDone);
```

## 验证
修改完成后运行:
1. cd backend && .venv/Scripts/python.exe -m compileall -q app/services/chapter_skeleton_generation/
2. cd frontend && npm run build

## 严格要求
- 只修改这 2 个文件
- 不需要确认，直接修改
- 工作区中的未提交改动是安全的，是本次任务的前序产出
