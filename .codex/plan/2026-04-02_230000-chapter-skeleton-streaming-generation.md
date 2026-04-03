# Plan: Chapter Skeleton Streaming Generation — 章节骨架流式生成重构

## Goal
将章节骨架生成从同步创建重构为基于 LLM 的 SSE 流式生成，类似于大纲生成和章节正文生成的模式。基于大纲 + 细纲调用 LLM，流式输出每卷的章节骨架（章节数、章节标题、摘要、beats等），AI 自主把控章节数量和内容，同时支持用户指定章节数。

## Root Cause Analysis

### 当前问题
`POST /detailed_outlines/{id}/create_chapters` 是同步接口：
1. 如果 `structure_json` 已有 chapters → 直接创建 Chapter 记录（无 LLM 调用）
2. 如果无 chapters → 调用 `generate_detailed_outline_for_volume()`（阻塞式 LLM，非流式）
3. 无 SSE 流式传输、无实时进度、无 AI 自主控制章节输出

### 期望行为
1. 前端细纲页面点击「生成章节骨架」→ 打开配置弹窗
2. 调用新的流式 API → SSE 实时显示 LLM 输出进度
3. AI 基于大纲 + 细纲内容，自主决定章节数量/内容/前后文衔接
4. 支持可选的章节数输入（默认 AI 自主把控）
5. 生成完成后自动创建 Chapter 记录

### 数据流设计

```
Frontend: 点击「生成章节骨架」→ 配置弹窗(可选章节数/指令)
    ↓ POST /detailed_outlines/{id}/generate_chapters_stream
    ↓
Backend Route (detailed_outlines.py):
    ↓ 加载 DetailedOutline + Outline + Project
    ↓ 获取邻卷细纲摘要（上下文衔接）
    ↓
Chapter Skeleton Generation Service (新):
    ↓ 组装 render_values: outline + detailed_outline + neighbors + config
    ↓ 渲染 prompt preset: 'chapter_skeleton_generate'
    ↓ call_llm_stream_messages() → SSE chunks
    ↓
    ↓ SSE Events:
    ↓   start → progress → chunk(token) → progress → result → done
    ↓
    ↓ 解析 JSON → 提取 chapters 数组
    ↓ 创建/更新 Chapter 记录
    ↓ 更新 DetailedOutline.structure_json
    ↓
Frontend: SSE 实时显示 → 完成后刷新章节列表
```

## Scope

### In Scope
1. **Backend**: 新增章节骨架流式生成 API 端点 + 服务层
2. **Backend**: 新增 prompt preset task `chapter_skeleton_generate`（prompt 渲染）
3. **Backend**: 流式 LLM 调用 + JSON 解析 + Chapter 记录创建
4. **Frontend**: 细纲页面新增流式生成 UI（弹窗 + 进度条 + SSE）
5. **Frontend**: 新增 API 调用函数
6. **保留向后兼容**: 现有 `create_chapters` 同步接口保持不变

### Out of Scope
- 大纲生成逻辑（已完善）
- 细纲生成逻辑（已完善）
- 章节正文生成逻辑（无需改动）
- 数据库 schema 变更（不需要）
- Prompt 内容撰写（只做框架，使用现有 prompt preset 机制）

## Assumptions / Dependencies
- LLM prompt preset 系统正常工作（`render_preset_for_task`）
- SSE 基础设施已就绪（`SSEPostClient`, `create_sse_response`, `format_sse`）
- 现有 `call_llm_stream_messages` 可复用
- `DetailedOutline` 数据库模型不需要修改

## Phases

### Phase 1: SKELETON-001 — Backend 流式生成服务 (核心)
创建章节骨架流式生成的核心服务层：
- `backend/app/services/chapter_skeleton_generation/` (新目录)
  - `__init__.py`
  - `models.py` — `ChapterSkeletonResult` 数据类
  - `prepare_service.py` — 组装 render_values
  - `stream_service.py` — 流式 LLM 调用 + SSE 事件生成
  - `parse_service.py` — JSON 输出解析

### Phase 2: SKELETON-002 — Backend API 路由
在 `detailed_outlines.py` 新增流式端点：
- `POST /detailed_outlines/{id}/generate_chapters_stream`
- Request schema: `ChapterSkeletonGenerateRequest`
- SSE response 使用 `create_sse_response`

### Phase 3: SKELETON-003 — Backend Prompt Preset 注册
- 在 prompt preset 系统注册 `chapter_skeleton_generate` task
- 使用 `render_preset_for_task` 渲染 prompt
- Fallback: 如果无自定义 preset，使用内置默认 prompt

### Phase 4: SKELETON-004 — Frontend API 层
- `detailedOutlinesApi.ts` 新增类型定义和请求函数
- 复用 `SSEPostClient` 进行流式调用

### Phase 5: SKELETON-005 — Frontend UI 组件
- `DetailedOutlineSection.tsx` 新增「生成章节骨架」流式按钮和弹窗
- `useDetailedOutlineState.ts` 新增流式生成状态管理
- 进度条 + 实时 token 预览 + 完成通知

### Phase 6: SKELETON-006 — Codex Code Review
- 使用 Codex full access + gpt-5.4 xhigh 对所有变更进行代码审查

### Phase 7: SKELETON-007 — 验证、提交与推送
- 我自己最终审查所有变更是否符合原始需求
- 按 issue 分别 commit 到 GitHub

## Tests & Verification
- Backend: `python -m compileall -q app` — 编译检查
- Frontend: `npm run build` — 构建检查
- Manual: 细纲页面点击「生成章节骨架」→ 能看到 SSE 流式进度 → 完成后生成 Chapter 记录
- Manual: 可选章节数输入 → AI 按指定数量生成
- Manual: 不输入章节数 → AI 自主决定数量
- Manual: 现有 `create_chapters` 同步接口仍正常工作（向后兼容）

## Issue CSV
- Path: .codex/issues/2026-04-02_230000-chapter-skeleton-streaming-generation.csv

## Tools / MCP
- Codex CLI: `codex exec -m gpt-5.4 --sandbox danger-full-access --json` — 代码实现和审查

## Acceptance Checklist
- [ ] 新增 `POST /detailed_outlines/{id}/generate_chapters_stream` SSE 流式端点
- [ ] 流式 LLM 调用正确发出 SSE events (start, progress, chunk, result, done)
- [ ] AI 输出的 JSON 被正确解析为 chapters 数组
- [ ] Chapter 记录自动创建/更新
- [ ] DetailedOutline.structure_json 更新包含 chapters
- [ ] 前端弹窗配置：可选章节数 + 指令 + 上下文开关
- [ ] 前端进度条实时显示生成进度
- [ ] 现有 create_chapters 同步接口不受影响
- [ ] Codex review 通过
- [ ] 我自己最终审查通过

## Risks / Blockers
- Codex CLI 不可用 → 停下询问用户，不自行修改
- Prompt preset 注册可能需要数据库 seed → 使用 fallback 内置 prompt
- LLM 输出 JSON 格式不规范 → 复用现有 `extract_json_value` + `likely_truncated_json` 容错

## Rollback / Recovery
- 所有变更在 `test/issue-001-foundation` 分支
- 每个 issue 一个 commit，可单独 revert

## Checkpoints
- Commit after: SKELETON-001 + SKELETON-002 + SKELETON-003 (backend complete)
- Commit after: SKELETON-004 + SKELETON-005 (frontend complete)
- Commit after: SKELETON-006 (review)
- Commit after: SKELETON-007 (final verification)

## References
- `backend/app/services/outline_generation/stream_service.py` — 大纲流式生成参考
- `backend/app/services/chapter_generation/stream_service.py` — 章节正文流式生成参考
- `backend/app/services/detailed_outline_generation/app_service.py` — 现有细纲服务
- `frontend/src/pages/outline/useDetailedOutlineState.ts` — 现有细纲状态管理
- `frontend/src/services/sseClient.ts` — SSE 客户端
- `backend/app/utils/sse_response.py` — SSE 响应工具
