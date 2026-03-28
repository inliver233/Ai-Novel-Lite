---
mode: plan
task: Settings Page Simplification
created_at: "2026-03-27T19:12:14+08:00"
complexity: complex
---

# Plan: Settings Page Simplification (项目设置页面简约化)

## Goal
- Simplify the Settings page to only retain: **项目信息** + **创作设定** + **协作成员**
- Remove: 自动更新、上下文优化、向量检索、Query 预处理、默认行为 sections
- Vector RAG already has its own section in PromptsPage (模型配置) -- no migration needed, just remove duplicate from Settings
- Backend auto-update flags keep defaults at `true`; context_optimizer / query_preprocessing remain functional in backend, just no UI toggle in Settings

## Scope
- In: Frontend settings page cleanup, state cleanup, dead UI removal, skeleton simplification, settingsCopy/uiCopy cleanup
- Out: Backend schema changes, DB migrations, PromptsPage modifications (it already has its own vector section)

## Assumptions / Dependencies
- PromptsPage already has independent `PromptsVectorRagSection` -- confirmed
- Backend auto_update flags default to `true` in DB model -- no functional regression
- `auto_update_story_memory_enabled` is dead (ChapterAnalysis + MemoryUpdate removed in Phase 2) but the DB column stays
- `context_optimizer_enabled` is used by backend chapter generation services -- keep backend support, just remove UI toggle
- `query_preprocessing` backend functionality stays intact -- just remove settings page UI

## Current Settings Page Layout (BEFORE)
1. 项目信息 (Project Info) -- **KEEP**
2. 创作设定 (Creative Settings) -- **KEEP**
3. 自动更新 (Auto Update) -- **REMOVE** (3 of 4 flags still functional, but set to default `true`)
4. 上下文优化 (Context Optimizer) -- **REMOVE** (default `false`, keep backend)
5. 协作成员 (Memberships) -- **KEEP**
6. 向量检索 (Vector RAG) -- **REMOVE** (duplicate; PromptsPage has its own)
7. Query 预处理 (Query Preprocessing) -- **REMOVE** (default disabled, keep backend)
8. WizardNextBar -- **KEEP**
9. 默认行为 (Feature Defaults) -- **REMOVE** (default enabled)

## Target Settings Page Layout (AFTER)
1. 项目信息 (Project Info)
2. 创作设定 (Creative Settings)
3. 协作成员 (Memberships)
4. WizardNextBar
5. 快捷键提示

## Phases

### Phase 1: Remove SettingsVectorRagSection (duplicate of PromptsPage section)
- Delete `SettingsVectorRagSection.tsx`
- Remove vector RAG state/props from `useSettingsPageState.ts`
- Remove vector_* fields from `SettingsForm` in `models.ts`
- Remove vectorRag entries from `settingsCopy.ts`
- Remove vector_* dirty checks and save logic from `useSettingsPageState.ts`

### Phase 2: Remove SettingsQueryPreprocessingSection
- Delete `SettingsQueryPreprocessingSection.tsx`
- Delete `queryPreprocessing.ts` utility and `queryPreprocessing.test.ts`
- Remove query_preprocessing* fields from `SettingsForm` in `models.ts`
- Remove query_preprocessing state/props from `useSettingsPageState.ts`
- Remove queryPreprocess entries from `settingsCopy.ts`

### Phase 3: Remove SettingsFeatureDefaultsSection
- Delete `SettingsFeatureDefaultsSection.tsx`
- Remove writingMemoryInjection state from `useSettingsPageState.ts`
- Remove featureDefaults entries from `uiCopy.ts`
- Remove featureDefaults entries from `settingsCopy.ts`

### Phase 4: Remove Auto-Update + Context Optimizer from SettingsCoreSections
- Remove "自动更新" section (lines 156-234 in SettingsCoreSections.tsx)
- Remove "上下文优化" collapsible section (lines 236-265)
- Remove autoUpdate* props from SettingsCoreSections type and component
- Remove context_optimizer_enabled from SettingsCoreSections
- Remove auto_update_* and context_optimizer_enabled from `SettingsForm` in `models.ts`
- Remove from useSettingsPageState auto-update state/logic
- Remove contextOptimizer entries from `settingsCopy.ts`

### Phase 5: Simplify SettingsPage + Skeleton + Save logic
- Remove VectorRag/QueryPreprocessing/FeatureDefaults imports from `SettingsPage.tsx`
- Simplify `SettingsPageSkeleton` to 2 section panels (project info + creative settings)
- Simplify save() in `useSettingsPageState.ts` -- only save project + creative settings
- Simplify dirty check -- only project fields + creative settings
- Simplify autoSave deps
- Clean up `settingsCopy.test.ts` if it references removed entries

### Phase 6: Build verification + dead reference cleanup
- `npm run build` passes
- Grep for dead references to removed components/fields
- Backend `compileall` still passes (no backend changes needed)

## Tests & Verification
- Frontend `npm run build` passes after each phase
- No dead imports or type errors
- Settings page still loads and saves project info + creative settings + memberships
- PromptsPage vector RAG section unaffected
- Backend settings API unchanged (accepts same fields, returns same response)

## Issue CSV
- Path: issues/2026-03-27_19-12-14-settings-page-simplification.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- codex (full access mode, 5.4 model, xhigh thinking budget)

## Acceptance Checklist
- [ ] Settings page only shows: 项目信息 + 创作设定 + 协作成员 + WizardNextBar
- [ ] SettingsVectorRagSection.tsx deleted
- [ ] SettingsQueryPreprocessingSection.tsx deleted
- [ ] SettingsFeatureDefaultsSection.tsx deleted
- [ ] queryPreprocessing.ts + test deleted
- [ ] All removed fields cleaned from models.ts, useSettingsPageState.ts, settingsCopy.ts
- [ ] Skeleton simplified to match new layout
- [ ] npm run build passes
- [ ] PromptsPage vector RAG section unaffected

## Risks / Blockers
- **Low risk**: Auto-update flags remain in backend defaults; no functional regression
- **Low risk**: context_optimizer_enabled remains functional in backend; settings API still accepts it
- **Medium risk**: Save logic must be carefully pruned to avoid sending stale fields

## Rollback / Recovery
- Git revert to pre-change commit

## Checkpoints
- Commit after: Phase 1-2 (file deletions)
- Commit after: Phase 3-4 (SettingsCoreSections cleanup)
- Commit after: Phase 5-6 (final simplification + verification)

## References
- frontend/src/pages/SettingsPage.tsx
- frontend/src/pages/settings/SettingsCoreSections.tsx:156 (auto-update section)
- frontend/src/pages/settings/SettingsCoreSections.tsx:236 (context optimizer section)
- frontend/src/pages/settings/SettingsVectorRagSection.tsx
- frontend/src/pages/settings/SettingsQueryPreprocessingSection.tsx
- frontend/src/pages/settings/SettingsFeatureDefaultsSection.tsx
- frontend/src/pages/settings/useSettingsPageState.ts
- frontend/src/pages/settings/models.ts
- frontend/src/pages/settings/settingsCopy.ts
- frontend/src/pages/settings/queryPreprocessing.ts
- frontend/src/pages/PromptsPage.tsx:86 (existing PromptsVectorRagSection)
- frontend/src/lib/uiCopy.ts:72 (vectorRag) + :188 (featureDefaults)
