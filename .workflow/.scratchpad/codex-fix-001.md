## 任务: FIX-001 — 修复 create_chapters_from_detailed_outline 唯一约束冲突

### 背景
文件 backend/app/services/detailed_outline_generation/app_service.py 中的 create_chapters_from_detailed_outline() 函数(约line 597-684)，当 replace=False 时，不检查是否已存在同 outline_id 的章节。骨架生成(stream_service.py的_create_chapter_records)已在DB中创建了Chapter记录，再调用此函数会触发(outline_id, number)唯一约束冲突 → 未捕获的IntegrityError → DB_ERROR。

前端 useDetailedOutlineState.ts:362-401 已有 409 CONFLICT 处理逻辑（显示替换确认弹窗），所以后端只需正确返回 409。

### 精确修改要求

**文件**: backend/app/services/detailed_outline_generation/app_service.py

**修改位置**: create_chapters_from_detailed_outline() 函数，在 `if replace:` 块之后(db.flush()那行之后)、`created: list[dict] = []` 之前

**添加**: 当 replace=False 时，查询是否已存在同 outline_id+project_id 的 Chapter 记录。如果存在，raise AppError(code="CONFLICT", status_code=409)。

**具体代码**: 在replace块结束后，创建章节循环之前，添加:

```python
    if not replace:
        conflict_count = db.execute(
            select(func.count())
            .select_from(Chapter)
            .where(Chapter.outline_id == detail.outline_id)
            .where(Chapter.project_id == detail.project_id)
        ).scalar() or 0
        if conflict_count > 0:
            raise AppError(
                code="CONFLICT",
                message=f"该大纲已有 {conflict_count} 个章节，请选择替换",
                status_code=409,
            )
```

**确保导入**: 检查文件顶部的import，确保有 `func` 的导入。如果只有 `from sqlalchemy import select`，需要改为 `from sqlalchemy import select, func`。不要重复添加已有的import。

### 约束
- 只修改 app_service.py 这一个文件
- 只修改 create_chapters_from_detailed_outline 这一个函数(加上可能的import)
- 不改变函数签名
- 不改变 replace=True 分支的逻辑
- 使用项目已有的 AppError 模式
- 不做任何其他修改
