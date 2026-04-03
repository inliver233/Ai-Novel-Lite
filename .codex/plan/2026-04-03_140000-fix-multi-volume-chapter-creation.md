# Plan: 修复多卷章节创建逻辑 — 编号偏移 + 卷级作用域 + 弹窗竞态

## Goal

修复"从细纲创建章节"的多卷逻辑：
1. 多卷章节应合并（第1卷9章+第2卷10章=19章），而非冲突
2. 替换应仅影响当前卷的章节，不影响其他卷
3. 冲突检查应卷级作用域
4. 确认弹窗不应自动消失

## Scope (In/Out)

### In Scope
- Backend: `create_chapters_from_detailed_outline()` 章节偏移+卷级replace
- Backend: `_create_chapter_records()` 章节偏移
- Backend: `/create_chapters` 路由调整
- Frontend: ConfirmProvider 竞态修复
- Frontend: createChapters 错误提示优化

### Out of Scope
- 数据库迁移（不新增列）
- 骨架生成 prompt/解析逻辑
- 大纲页面其他功能

## Phases

### Phase 1: Backend — 章节偏移计算 (CHAP-001)

**核心算法**: `_compute_chapter_offset(db, detail: DetailedOutline) -> int`

```python
def _compute_chapter_offset(db: Session, detail: DetailedOutline) -> int:
    """计算当前卷的章节编号偏移量。
    
    基于同一 outline 中 volume_number 更小的所有卷的章节数之和。
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

**修改 `create_chapters_from_detailed_outline()`**:

1. 调用 `_compute_chapter_offset()` 获取偏移量
2. 每个章节的 global_number = offset + local_number
3. replace 时只删除当前卷范围内的章节（offset+1 到 offset+len(chapters)）
4. conflict 检查只针对当前卷范围

**修改 `_create_chapter_records()` (stream_service.py)**:

1. 新增 `chapter_offset: int = 0` 参数
2. 实际 number = chapter_offset + local_number
3. replace 和 skip 检查也要用偏移后的 number

**修改 `generate_chapter_skeleton_stream_events()`**:

在调用 `_create_chapter_records()` 前计算偏移量。

### Phase 2: Frontend — ConfirmProvider 竞态修复 (CHAP-002)

**根因**: `close()` 中的 `window.setTimeout(() => setOptions(null), 400)` 会与紧接着的下一次 `confirm()` 竞争。

**修复**: 用 ref 保存 timeout ID，在 `confirm()`/`choose()` 开头 `clearTimeout`。

```typescript
const clearOptionsTimerRef = useRef<number | null>(null);

const confirm = useCallback(async (opts: ConfirmOptions) => {
    if (clearOptionsTimerRef.current !== null) {
        window.clearTimeout(clearOptionsTimerRef.current);
        clearOptionsTimerRef.current = null;
    }
    setVariant("confirm");
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve as (value: unknown) => void;
    });
}, []);

// choose 同理

const close = useCallback((value: unknown) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
    clearOptionsTimerRef.current = window.setTimeout(() => {
        setOptions(null);
        clearOptionsTimerRef.current = null;
    }, 400);
}, []);
```

### Phase 3: Frontend — createChapters 逻辑优化 (CHAP-002 延续)

当前 `createChapters` 对 409 的处理是"替换所有章节"。需改为：
- 409 提示信息改为卷级："第X卷已有N个章节，是否重新创建？"
- replace 只影响该卷

由于后端已做卷级 replace，前端只需更新提示文案即可。

## Issue CSV

Path: `.codex/issues/2026-04-03_140000-fix-multi-volume-chapter-creation.csv`

## Acceptance Checklist

- [ ] 第1卷9章创建成功（编号1-9）
- [ ] 第2卷10章创建成功（编号10-19），第1卷章节不受影响
- [ ] 重新创建第1卷时只替换1-9，不影响10-19
- [ ] 确认弹窗不再自动消失
- [ ] npm run build 和 python compileall 通过

## References

- Chapter model: `backend/app/models/chapter.py` — UniqueConstraint(outline_id, number)
- create_chapters_from_detailed_outline: `backend/app/services/detailed_outline_generation/app_service.py:597`
- _create_chapter_records: `backend/app/services/chapter_skeleton_generation/stream_service.py:372`
- ConfirmProvider: `frontend/src/components/ui/ConfirmProvider.tsx`
- createChapters hook: `frontend/src/pages/outline/useDetailedOutlineState.ts:362`
