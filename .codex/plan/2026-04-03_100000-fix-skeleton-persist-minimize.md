# Plan: 修复骨架生成Bug + 状态持久化 + 后台运行最小化

## Goal

修复三个核心问题：
1. **DB_ERROR Bug**: 骨架生成后点击"从细纲创建章节"报数据库错误
2. **流式显示缺失**: 章节骨架生成过程无JSON流式展示
3. **状态持久化**: 各生成页面关闭后结果丢失
4. **后台运行**: 生成页面关闭应最小化而非停止（参照写作页面模式）

## Scope (In/Out)

### In Scope
- Backend: `create_chapters_from_detailed_outline()` 冲突检查
- Frontend: 骨架生成流式JSON展示 (onChunk handler + UI)
- Frontend: 所有生成Modal状态持久化 (大纲生成/智能解析/细纲生成/骨架生成)
- Frontend: 后台运行浮动卡片 (参照 WritingStreamFloatingCard)
- Frontend: useOutlinePageState 集成浮动卡片

### Out of Scope
- 大纲生成核心逻辑修改
- 写作页面修改
- 新功能开发
- 数据库迁移

## Assumptions / Dependencies

- 写作页面的 `WritingStreamFloatingCard` 是参考实现
- SSEPostClient 已支持所需的事件处理
- Chapter 模型的唯一约束 `(outline_id, number)` 是正确的设计

## Phases

### Phase 1: Bug Fix — DB_ERROR (FIX-001)

**文件**: `backend/app/services/detailed_outline_generation/app_service.py`

**修改**: `create_chapters_from_detailed_outline()` 函数 (line 597-684)

当 `replace=False` 时，在创建章节前检查是否已存在同 outline_id 的章节。如果存在，raise `AppError(code="CONFLICT", status_code=409)` 而非让DB报 IntegrityError。

前端 `useDetailedOutlineState.ts:362-401` 已有 409 CONFLICT 处理逻辑（显示替换确认弹窗），所以后端只需正确返回 409 即可。

具体修改：
```python
# 在 line 641 (created: list[dict] = []) 之前添加
if not replace:
    existing_numbers = {
        row[0]
        for row in db.execute(
            select(Chapter.number)
            .where(Chapter.outline_id == detail.outline_id)
            .where(Chapter.project_id == detail.project_id)
        ).all()
    }
    if existing_numbers:
        raise AppError(
            code="CONFLICT",
            message=f"该大纲已有 {len(existing_numbers)} 个章节，请选择替换",
            status_code=409,
        )
```

### Phase 2: Bug Fix — 骨架流式JSON显示 (FIX-002)

**文件**:
- `frontend/src/pages/outline/useDetailedOutlineState.ts`
- `frontend/src/pages/outline/DetailedOutlineSection.tsx`

**Hook 修改** (useDetailedOutlineState.ts):
1. 新增状态: `skeletonStreamRawText`, `skeletonStreamResult` (保存最终解析结果)
2. `onChunk` handler: 累积 raw text，更新 `skeletonStreamRawText`
3. `onResult` handler: 捕获解析结果，更新 `skeletonStreamResult`
4. 导出新状态到 DetailedOutlineState type

**UI 修改** (DetailedOutlineSection.tsx):
1. `ChapterSkeletonGenerationModal` 新增流式内容区域:
   - 折叠面板显示 raw streaming text（最多36000字符）
   - 折叠面板显示 JSON 预览（解析后的 chapters）
2. 生成完成后显示结果摘要

### Phase 3: 状态持久化 (PERSIST-001)

所有生成页面需要保留完成后的结果，关闭再打开显示上次结果。

**大纲生成** (useOutlineGenerationState.ts):
- `genPreview` 已持久化 ✓
- `streamProgress/streamRawText/streamPreviewJson` 在 finally 中清除 → 不要在 finally 中清除这些（仅在新生成开始时清除）
- `closeModal` 不再清除 preview

**智能解析** (useOutlineParsingState.ts):
- `closeParseModal()` 显式清除所有状态 → 只关闭 modal，不清除 result
- 新增 `lastParseResult` 保存上次完成的结果
- `openParseModal` 时如果有 lastParseResult 则显示

**细纲生成** (useDetailedOutlineState.ts):
- `progress` 在 finally 中被 `setProgress(null)` → 保留最终 progress 消息
- 新增 `lastGenerateResult` 标记是否完成过

**骨架生成** (useDetailedOutlineState.ts):
- `skeletonProgress` 在 finally 中被清除 → 保留
- 新增 `lastSkeletonResult` 保存解析结果

### Phase 4: 后台运行最小化 (MINIMIZE-001)

参照写作页面 `WritingStreamFloatingCard` 实现模式:

**核心原则**:
- 关闭 Modal != 取消生成（分离 onClose 和 onCancel）
- SSE client 在 useRef 中，不因 Modal unmount 而中断
- 浮动卡片在 Modal 关闭但仍在生成时显示

**新增组件**: `frontend/src/components/ui/GenerationFloatingCard.tsx`
- 通用浮动卡片，显示: 标题 + 进度消息 + 进度条 + 展开/取消按钮
- Props: `open, title, message, progress, onExpand, onCancel`
- 样式参照 WritingStreamFloatingCard

**Hook 修改 — 所有生成 hooks**:
1. `closeModal` 只设置 `setModalOpen(false)`，不调用 `abort()`
2. 只有 `cancelGenerate` 调用 `abort()`
3. 导出 `generating` + `modalOpen` 供浮动卡片判断

**useOutlinePageState.ts 集成**:
- 新增 `outlineGenFloatingProps` — 大纲生成浮动卡片
- 新增 `parsingFloatingProps` — 智能解析浮动卡片
- 新增 `detailedGenFloatingProps` — 细纲生成浮动卡片
- 新增 `skeletonGenFloatingProps` — 骨架生成浮动卡片

条件: `open: generating && !modalOpen`

**OutlinePage.tsx** (如果存在):
- 渲染 4 个 GenerationFloatingCard

## Tests & Verification

- 手动测试: 生成骨架 → 点击"从细纲创建章节" → 应显示替换确认
- 手动测试: 骨架流式生成 → Modal 中应显示实时JSON
- 手动测试: 任何生成完成 → 关闭 → 重新打开 → 显示上次结果
- 手动测试: 生成进行中 → 关闭 Modal → 应显示浮动卡片 → 点击展开恢复

## Issue CSV

Path: `.codex/issues/2026-04-03_100000-fix-skeleton-persist-minimize.csv`

## Acceptance Checklist

- [ ] 骨架生成后"从细纲创建章节"返回409而非DB_ERROR
- [ ] 骨架生成流式显示JSON内容
- [ ] 所有生成Modal关闭后保留结果
- [ ] 所有生成Modal关闭时不中断生成
- [ ] 浮动卡片在Modal关闭+生成中时显示
- [ ] 浮动卡片展开按钮重新打开Modal
- [ ] 浮动卡片取消按钮停止生成
- [ ] Codex代码审查通过
- [ ] 所有修改自查符合原始需求

## Risks / Blockers

- Codex CLI 或 gpt-5.4 模型不可用 → 停下询问用户
- 浮动卡片布局可能与现有UI冲突 → 参照写作页面已验证的样式
- 解析Modal状态持久化可能影响agent cards → 需要区分"上次结果"和"当前生成"

## References

- 写作页面参考: `frontend/src/pages/writing/useChapterGeneration.ts`
- 浮动卡片参考: `frontend/src/pages/writing/WritingPageSections.tsx` (WritingStreamFloatingCard)
- 骨架后端: `backend/app/services/chapter_skeleton_generation/stream_service.py`
- 骨架前端: `frontend/src/pages/outline/useDetailedOutlineState.ts`
- 大纲生成: `frontend/src/pages/outline/useOutlineGenerationState.ts`
- 解析状态: `frontend/src/pages/outline/useOutlineParsingState.ts`
- 页面状态: `frontend/src/pages/outline/useOutlinePageState.ts`
