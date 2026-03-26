# Codex Fix Resume State — 2026-03-26

## 阻塞原因
Codex CLI 运行在 `sandbox: read-only` + `approval: never` 模式，`--mode write` 参数只影响 ccw 的 prompt 模板，不影响 Codex 实际的文件写入权限。需要配置 Codex CLI 允许文件写入。

## 已完成
- [x] Phase 1: 10个模块功能删除（Steps 1-10），代码已提交在 test 分支
- [x] Codex Review: 3个 review 任务完成，发现残留问题
- [ ] Codex Fix Batch 1: 前端运行时死链修复 — **被 sandbox 阻止**
- [ ] Codex Fix Batch 2: 后端残留逻辑清理 — **被 sandbox 阻止**
- [ ] Codex Fix Batch 3: 测试/契约清理 — **等待中**

## 待修复问题清单（Codex Review 发现）

### Batch 1: 前端运行时死链（优先级最高）
1. TaskCenter 死链:
   - frontend/src/pages/writing/writingPageModels.ts:16-28
   - frontend/src/pages/writing/useWritingPageState.ts:32-34,300-302,388-390,465
   - frontend/src/components/writing/MemoryUpdateDrawer.tsx:377-381,401
   - frontend/src/components/writing/BatchGenerationModal.tsx:80,147-153
   - frontend/src/components/writing/WritingToolbar.tsx:19,94
   - frontend/src/pages/writing/writingPageCopy.ts:25
   - frontend/src/lib/uiCopy.ts:255-260,58

2. RAG 死链:
   - frontend/src/pages/ImportPage.tsx:361,369-371

3. StructuredMemory 死链:
   - frontend/src/components/writing/MemoryUpdateDrawer.tsx:61-64,148-150,354-365
   - frontend/src/pages/SearchPage.tsx:32-35,128-133,148-150,176-178
   - frontend/src/pages/settings/SettingsCoreSections.tsx:241

4. Graph 死链:
   - frontend/src/pages/settings/useSettingsPageState.ts:372-380
   - frontend/src/pages/settings/settingsCopy.ts:12-16

5. NumericTables 残留:
   - frontend/src/types.ts:34 (auto_update_tables_enabled)

### Batch 2: 后端残留逻辑
1. Graph: memory_update_service.py:786-807,890-892
2. Foreshadow: memory_route_story_mappers.py:29-30, memory_retrieval_service.py:224, plot_analysis_service.py:44,429,453-454
3. WorldBook/Structured stubs: memory_pack.py:8,11,38,41, memory_retrieval_service.py:187,379,423-426,452-455,486,489
4. StructuredMemory: memory_update_service.py:601-657
5. Comment: structured_memory.py:12

### Batch 3: 测试/契约清理
1. 删除整个 spec 文件: task-center, fractal-page, fractal-v2, graph-page, graph-*.spec, rag-page, rag-*.spec, foreshadows-page, foreshadow-drawer, structured-memory, worldbook*.spec, tables-panel
2. db_schema.json: 删除 fractal_memory 表定义, auto_update_* 列
3. 修改共享 spec: navigation, visual, memory-preview, memory-retrieve, search-page, import, a11y-form-fields, chapter-generate-precheck, writing-auto-updates

## 恢复方法
1. 修复 Codex 沙箱配置，使其允许文件写入
2. 重新执行 3 个 Codex write 任务（ID 可复用 prompt）
3. 或手动执行以上清单

## Git 状态
- 分支: test
- 最新 commit: 380f21c (Final verification pass)
- 需要新的 commit: [FIX] Clean up residual references found by Codex review
