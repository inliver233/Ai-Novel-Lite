# Plan: OPA Multi-Agent 大纲解析系统全面优化

## Goal
- 修复多 Agent 大纲解析系统的三大核心问题：中间过程不可视、超时错误频发、整体稳定性不足
- 实现多 Agent 实时可视化仪表板，替换单一进度条
- 根治 LLM 调用超时的根本原因（同步阻塞调用 → 流式传输）
- 全面提升 Agent 系统的稳定性、重试逻辑和中文化程度

## Scope
- In:
  - Backend: `outline_parsing_agent/` 全部文件（coordinator、base、各 agent、config、models、prompts）
  - Backend: `api/routes/outline_parse.py`（SSE 事件路由）
  - Frontend: `pages/outline/OutlineParsingSection.tsx`（UI 组件）
  - Frontend: `pages/outline/useOutlineParsingState.ts`（状态管理）
  - Frontend: `pages/outline/outlineParsingModels.ts`（类型定义）
  - Frontend: `pages/outline/outlineParsingCopy.ts`（文案）
- Out:
  - 大纲生成模块（`outline_generation/`）不在本次范围
  - LLM client 核心逻辑（`llm/client.py`）不做结构变更
  - 数据库 schema 不变
  - 其他页面/模块不受影响

## Assumptions / Dependencies
- LLM provider 支持 streaming（SSE/chunked response）
- Codex CLI (gpt-5.4) 可用于所有代码修改
- 当前 test 分支可用于提交

## Root Cause Analysis

### 问题一：超时错误
- **根因**: `BaseExtractionAgent._call_llm()` 使用 `strategy.chat_completion()`（同步非流式）
- 同步调用等待完整响应，对于大 prompt（50K token chunk），LLM 需要较长生成时间
- 部分 LLM provider 的 HTTP 反向代理层有 30-60s 超时限制，非流式请求被中间层截断
- Agent 重试之间无退避延迟（立即重试），导致快速耗尽重试次数
- **修复方案**: 切换为流式调用 + 累积响应，中间层的 chunk 传输保持连接活跃，避免超时

### 问题二：过程不可视
- **根因**: 后端仅发送 `phase_start` 和 `agent_complete` 两种 SSE 事件
- 前端仅显示单一 `ProgressBar`，无 per-agent 状态
- Agent 名称全部使用英文（structure/character/entry）
- **修复方案**: 添加 `agent_start`/`agent_streaming`/`agent_retry`/`agent_error` 细粒度事件 + 前端多卡片仪表板

### 问题三：稳定性
- **根因**: 重试无退避、JSON 解析容错不足、验证消息全英文、无 Agent 级错误隔离
- **修复方案**: 指数退避重试、增强 JSON 解析、中文化消息、独立错误处理

## Phases
1. **Phase 1 (P0-Backend)**: OPA-001 + OPA-002 — 修复核心超时 Bug + 添加细粒度 SSE 事件
2. **Phase 2 (P0-Frontend)**: OPA-003 + OPA-004 — 前端状态管理 + 多 Agent 卡片 UI
3. **Phase 3 (P1-Polish)**: OPA-005 + OPA-006 — 验证消息中文化 + UI 动画打磨
4. **Phase 4 (Review)**: OPA-007 — Codex 代码审查 + 回归测试

## Tests & Verification
- OPA-001: 后端单元测试 — Python 编译通过 + 流式调用路径可执行
- OPA-002: SSE 事件格式验证 — 手动 curl/httpie 测试 parse-stream 端点
- OPA-003: TypeScript 编译通过 + lint 通过
- OPA-004: 前端构建通过 + 视觉检查多卡片布局
- OPA-005: Python 编译通过 + 验证中文消息输出
- OPA-006: 前端构建通过 + 视觉检查动画效果
- OPA-007: Codex review 通过 + 前后端构建通过

## Issue CSV
- Path: issues/2026-04-02_00-30-50-opa-agent-overhaul.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- codex: 所有代码实现（full access, gpt-5.4, xhigh thinking）
- codex: 代码审查（review mode）
- manual: 视觉验证

## Acceptance Checklist
- [ ] 多 Agent 解析过程中，前端显示每个 Agent 的独立状态卡片（中文名称）
- [ ] Agent 卡片实时显示流式输出预览文本
- [ ] LLM 调用使用流式传输，不再出现 "请求超时" 错误（正常网络下）
- [ ] Agent 重试使用指数退避策略
- [ ] 验证/警告消息使用中文
- [ ] 整体进度条保留 + Agent 卡片仪表板新增
- [ ] 后端 Python 编译通过
- [ ] 前端 TypeScript 编译 + lint + build 通过
- [ ] 向后兼容：非流式 `/parse` 端点仍然可用

## Risks / Blockers
- Codex CLI 不可用 → 停止实现，等待用户确认
- LLM provider 不支持 streaming → 保留同步 fallback
- 中间过程的 SSE 事件过多可能影响性能 → 限制 streaming 事件频率（每 500ms 一次）

## Rollback / Recovery
- 每个 Issue 一个 commit，可独立 revert
- Phase 1 (后端) 失败 → revert OPA-001/002，前端不受影响
- Phase 2 (前端) 失败 → revert OPA-003/004，后端新事件被前端忽略

## Checkpoints
- Commit after: OPA-001 (核心超时修复)
- Commit after: OPA-002 (SSE 事件增强)
- Commit after: OPA-003 + OPA-004 (前端仪表板)
- Commit after: OPA-005 + OPA-006 (打磨)
- Commit after: OPA-007 (审查通过)

## References
- backend/app/services/outline_parsing_agent/agents/base.py:84-113 (同步 LLM 调用 — 超时根因)
- backend/app/services/outline_parsing_agent/agents/base.py:153-224 (重试逻辑 — 无退避)
- backend/app/services/outline_parsing_agent/config.py:9 (timeout_seconds=3600)
- backend/app/services/outline_parsing_agent/coordinator.py:306-437 (流式事件生成)
- backend/app/api/routes/outline_parse.py:36-121 (SSE 事件路由)
- frontend/src/pages/outline/OutlineParsingSection.tsx:143-151 (单一进度条)
- frontend/src/pages/outline/useOutlineParsingState.ts:135-253 (SSE 状态管理)
- frontend/src/pages/outline/outlineParsingModels.ts (类型定义)
- backend/app/llm/client.py:130-136 (httpx timeout 配置)
