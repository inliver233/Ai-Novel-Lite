# Plan: Feature Removal Phase 2 — Help Drawer + ChapterAnalysis + MemoryUpdate

## Goal
- 删除侧边栏「术语/帮助」Drawer（含按钮和所有 UI 文案）
- 删除「查看」分组中的「剧情记忆」(ChapterAnalysis) 页面及全部前后端代码
- 删除写作页面的「记忆更新」(MemoryUpdate) Drawer 及全部前后端代码（含 MemoryTask、MemoryChangeSet 模型）
- 系统在每步删除后仍可正常编译运行

## Scope
- In: Help Drawer UI + uiCopy; ChapterAnalysis page + backend routes/services/schemas/tests + annotations_service; MemoryUpdate Drawer + backend services/routes/schemas/models/presets/tests; MemoryTask model; MemoryChangeSet/MemoryChangeSetItem models; Alembic 反向迁移
- Out: StoryMemory CRUD（保留，仍用于写作流程）; story_memory.py 路由（保留）; 不重构保留功能

## Assumptions / Dependencies
- Phase 1（10 模块删除）已全部完成
- StoryMemory CRUD 被写作流程使用，不删除
- annotations_service 仅被 chapter_analysis 使用，可随之删除
- MemoryChangeSet/MemoryChangeSetItem 仅被 memory_update 使用，可删除
- MemoryTask 仅被 memory_update 使用，可删除
- PromptStudioPage.tsx 引用了 UI_COPY.help.title，需替换为硬编码字符串

## Phases
1. **Help Drawer 删除**: AppShell.tsx 帮助按钮 + Drawer + uiCopy.ts help 对象 + PromptStudioPage 修复
2. **ChapterAnalysis 前端删除**: 页面/组件/路由/导航/类型/文案
3. **ChapterAnalysis 后端删除**: 路由/服务/Schema/测试/annotations_service
4. **MemoryUpdate 前端删除**: MemoryUpdateDrawer + WritingToolbar/PageSections/State/Copy
5. **MemoryUpdate 后端删除**: 服务/路由/Schema/模型/预设/测试
6. **Alembic 迁移 + 最终验证**: 创建反向迁移 + 全量构建验证 + 死引用清理

## Tests & Verification
- 每步后: `cd frontend && npm run build`
- 每步后: `cd backend && python -m compileall -q app alembic` (如 venv 可用)
- 最终: `cd frontend && npm run lint`
- 最终: grep 检查无死引用

## Issue CSV
- Path: issues/2026-03-26_16-00-00-feature-removal-phase2.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Codex CLI (`ccw cli --tool codex --mode write`): 所有代码变更
- Codex CLI (`ccw cli --tool codex --mode review`): 实现后审查

## Acceptance Checklist
- [ ] 侧边栏无「术语/帮助」按钮和 Drawer
- [ ] 导航无「剧情记忆」入口，ChapterAnalysis 所有文件已删
- [ ] 写作页面无「记忆更新」按钮和 Drawer，MemoryUpdate 所有文件已删
- [ ] Frontend npm run build 通过
- [ ] Backend compileall 通过
- [ ] 无 TypeScript/Python 死引用
- [ ] Alembic 反向迁移已创建
- [ ] 每步有独立 git commit

## Risks / Blockers
- PromptStudioPage 引用 UI_COPY.help.title — 删除 help 对象前必须修复
- chapter_analysis_app_service 集成了 auto memory update — 两者都删除则无冲突
- memory.py 路由文件同时包含 story_memory 和 memory_update 端点 — 仅删除 memory_update 端点

## Rollback / Recovery
- 每步独立 commit → `git revert <sha>` 可回滚单步
- `git reset --hard c417b88` 回到 Phase 1 完成状态

## Checkpoints
- Commit after: Help Drawer 删除
- Commit after: ChapterAnalysis 前端删除
- Commit after: ChapterAnalysis 后端删除
- Commit after: MemoryUpdate 前端删除
- Commit after: MemoryUpdate 后端删除
- Commit after: Alembic 迁移 + 最终验证

## References
- 全面文档/功能去除文档.md: 总体指导纲领
- issues/2026-03-26_12-00-00-feature-removal-phase1.csv: Phase 1 已完成任务参考
