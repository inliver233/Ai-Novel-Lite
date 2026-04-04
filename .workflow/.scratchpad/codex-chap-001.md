## 任务: CHAP-001 — 多卷章节编号偏移 + 卷级replace

### 背景
AI小说项目中，每个DetailedOutline代表一"卷"。每卷的骨架生成输出的章节编号是卷内本地编号(1,2,3...)。
Chapter模型有UniqueConstraint(outline_id, number)。当第1卷创建章节1-9后，第2卷也试图创建编号1-10，导致冲突。
正确行为：第2卷应从编号10开始(偏移量=前面所有卷的章节数之和)。

### 需要修改的文件

#### 文件1: backend/app/services/detailed_outline_generation/app_service.py

**1. 新增辅助函数 `_compute_chapter_offset`** (在 `create_chapters_from_detailed_outline` 函数之前):

```python
def _compute_chapter_offset(db: Session, detail: DetailedOutline) -> int:
    """计算当前卷的章节编号偏移量。
    
    基于同一 outline 中 volume_number 更小的所有卷的 structure_json 中的章节数之和。
    """
    earlier_volumes = db.execute(
        select(DetailedOutline)
        .where(DetailedOutline.outline_id == detail.outline_id)
        .where(DetailedOutline.volume_number < detail.volume_number)
        .order_by(DetailedOutline.volume_number)
    ).scalars().all()

    offset = 0
    for vol in earlier_volumes:
        if not vol.structure_json:
            continue
        try:
            structure = json.loads(vol.structure_json)
            chapters = structure.get("chapters") if isinstance(structure, dict) else None
            if isinstance(chapters, list):
                offset += len(chapters)
        except Exception:
            pass
    return offset
```

确保文件顶部已导入 DetailedOutline: `from app.models.detailed_outline import DetailedOutline` (检查是否已有)。

**2. 重写 `create_chapters_from_detailed_outline` 函数** (约 line 597-696):

将整个函数替换为以下实现（保持函数签名不变）：

```python
def create_chapters_from_detailed_outline(
    detailed_outline_id: str,
    db: Session,
    *,
    replace: bool = False,
) -> list[dict]:
    """Create Chapter records from a DetailedOutline's structure_json.

    Chapters are numbered globally across volumes: volume 1 gets 1..N,
    volume 2 gets N+1..N+M, etc.  When ``replace=True`` only the
    chapters that belong to *this* volume's number range are deleted.
    """
    detail = db.get(DetailedOutline, detailed_outline_id)
    if detail is None:
        raise AppError.not_found("DetailedOutline not found")

    structure = _parse_structure_json(detail.structure_json)
    if not isinstance(structure, dict):
        raise AppError(
            code="DETAILED_OUTLINE_NO_STRUCTURE",
            message="DetailedOutline has no valid structure_json",
        )

    chapters_raw = structure.get("chapters")
    if not isinstance(chapters_raw, list) or not chapters_raw:
        raise AppError(
            code="DETAILED_OUTLINE_NO_CHAPTERS",
            message="structure_json contains no chapters",
        )

    # 计算偏移量
    offset = _compute_chapter_offset(db, detail)
    volume_chapter_count = len(chapters_raw)
    range_start = offset + 1
    range_end = offset + volume_chapter_count

    if replace:
        # 只删除当前卷范围内的章节
        existing = (
            db.execute(
                select(Chapter)
                .where(Chapter.outline_id == detail.outline_id)
                .where(Chapter.project_id == detail.project_id)
                .where(Chapter.number >= range_start)
                .where(Chapter.number <= range_end)
            )
            .scalars()
            .all()
        )
        for ch in existing:
            db.delete(ch)
        db.flush()
    else:
        # 检查当前卷范围内是否已有章节
        conflict_count = db.execute(
            select(func.count())
            .select_from(Chapter)
            .where(Chapter.outline_id == detail.outline_id)
            .where(Chapter.project_id == detail.project_id)
            .where(Chapter.number >= range_start)
            .where(Chapter.number <= range_end)
        ).scalar() or 0
        if conflict_count > 0:
            raise AppError(
                code="CONFLICT",
                message=f"第{detail.volume_number}卷已有 {conflict_count} 个章节(编号{range_start}-{range_end})，请选择替换",
                status_code=409,
            )

    created: list[dict] = []
    for ch_raw in chapters_raw:
        if not isinstance(ch_raw, dict):
            continue
        try:
            local_number = int(ch_raw.get("number", 0))
        except (TypeError, ValueError):
            continue
        if local_number <= 0:
            continue

        global_number = offset + local_number
        title = str(ch_raw.get("title") or "")
        summary_text = str(ch_raw.get("summary") or "")
        beats = ch_raw.get("beats") or []
        beats_text = ""
        if isinstance(beats, list) and beats:
            beats_text = "\n".join(f"- {str(b)}" for b in beats if b is not None)

        plan_parts: list[str] = []
        if summary_text.strip():
            plan_parts.append(summary_text.strip())
        if beats_text.strip():
            plan_parts.append(beats_text.strip())
        plan = "\n\n".join(plan_parts) if plan_parts else ""

        chapter = Chapter(
            id=new_id(),
            project_id=detail.project_id,
            outline_id=detail.outline_id,
            number=global_number,
            title=title,
            plan=plan,
            status="planned",
        )
        db.add(chapter)
        created.append({
            "id": chapter.id,
            "number": global_number,
            "title": title,
            "plan": plan,
        })

    db.commit()
    return created
```

#### 文件2: backend/app/services/chapter_skeleton_generation/stream_service.py

**1. 修改 `_create_chapter_records` 函数** (约 line 372-454):

添加 `chapter_offset: int = 0` 参数，并在所有使用 number 的地方应用偏移。

函数签名改为:
```python
def _create_chapter_records(
    db: Session,
    detailed_outline: DetailedOutline,
    chapters: list[dict[str, Any]],
    *,
    replace: bool = True,
    chapter_offset: int = 0,
) -> list[dict[str, Any]]:
```

在函数体内:
- `new_numbers` 的计算要加偏移: `new_numbers = {chapter_offset + int(ch.get("number", 0)) for ch in chapters if int(ch.get("number", 0)) > 0}`
- replace 和 skip 的查询使用偏移后的 new_numbers (已经是偏移后的了)
- 创建 Chapter 时 number 使用 `chapter_offset + number`: 把 `number = int(item.get("number", 0))` 之后加 `number = chapter_offset + number`（在 `if number <= 0:` 检查之前先获取 local_number，然后偏移）

具体修改 _create_chapter_records 的循环部分:
```python
    created: list[dict[str, Any]] = []
    for item in chapters:
        try:
            local_number = int(item.get("number", 0))
        except (TypeError, ValueError):
            continue
        if local_number <= 0:
            continue
        
        number = chapter_offset + local_number
        
        if not replace and number in existing_numbers:
            continue
        
        # ... 后续创建逻辑中使用 number（已是全局编号）
```

**注意**: `new_numbers` 集合也需要使用偏移后的编号:
```python
    new_numbers = set()
    for ch in chapters:
        try:
            local_n = int(ch.get("number", 0))
        except (TypeError, ValueError):
            continue
        if local_n > 0:
            new_numbers.add(chapter_offset + local_n)
```

**2. 修改 `generate_chapter_skeleton_stream_events` 函数**:

在调用 `_create_chapter_records()` 之前(约 line 254)，计算偏移量。

需要导入或在此文件中也添加偏移计算逻辑。最简单的方式：
```python
# 在 _create_chapter_records 调用之前
from app.services.detailed_outline_generation.app_service import _compute_chapter_offset
chapter_offset = _compute_chapter_offset(db, detailed_outline)
```

但为避免循环导入，更好的方式是在 stream_service.py 中也实现一个简单的偏移计算，或者将 `_compute_chapter_offset` 移到一个公共模块。

**推荐做法**: 在 stream_service.py 中内联计算偏移:
```python
# 计算章节偏移
_earlier_vols = db.execute(
    select(DetailedOutline)
    .where(DetailedOutline.outline_id == detailed_outline.outline_id)
    .where(DetailedOutline.volume_number < detailed_outline.volume_number)
    .order_by(DetailedOutline.volume_number)
).scalars().all()
chapter_offset = 0
for _vol in _earlier_vols:
    if _vol.structure_json:
        try:
            _struct = json.loads(_vol.structure_json)
            _chs = _struct.get("chapters") if isinstance(_struct, dict) else None
            if isinstance(_chs, list):
                chapter_offset += len(_chs)
        except Exception:
            pass

created_chapters = _create_chapter_records(
    db,
    detailed_outline,
    chapters,
    replace=replace_chapters,
    chapter_offset=chapter_offset,
)
```

确保 stream_service.py 顶部导入了 DetailedOutline 模型: `from app.models.detailed_outline import DetailedOutline` (检查是否已有)。
确保有 `from sqlalchemy import select` (检查是否已有)。

### 约束
- 不改变函数对外签名（create_chapters_from_detailed_outline 保持 (id, db, replace) 签名）
- _create_chapter_records 新增 chapter_offset 参数有默认值 0，向后兼容
- 不修改 Chapter 模型
- 不做数据库迁移
- 运行 `cd backend && .venv/Scripts/python.exe -m compileall -q app alembic` 验证
