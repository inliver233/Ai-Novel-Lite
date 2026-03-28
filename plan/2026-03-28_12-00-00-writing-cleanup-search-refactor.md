# Plan: Writing Page Cleanup + Search Engine Refactor

## Goal
- Remove residual unused features from the Writing page (Context Preview drawer, dead advanced generation parameters)
- Refactor the project search engine from complex FTS5/intermediate-table approach to a simple direct-query model
- Make the writing page right-side panel cleaner and more practical
- Make search functional, lightweight, and always up-to-date

## Scope
- In:
  - WritingToolbar "上下文预览" button removal
  - ContextPreviewDrawer + contextPreview/ subfolder deletion
  - Advanced params cleanup (keep stream only; remove plan_first/post_edit/post_edit_sanitize/content_optimize UI)
  - PostEditCompareDrawer + ContentOptimizeCompareDrawer removal
  - GenerateForm type + useChapterGeneration cleanup for removed fields
  - SearchPage: default sources to all-selected, simplified UI
  - Backend search: replace search_documents/FTS approach with direct source-table queries
- Out:
  - Backend post_edit/plan_first/content_optimize pipeline code (kept for now; fields still sent to API but ignored by frontend)
  - Alembic migrations (no table drops needed)
  - Any feature additions beyond cleanup/refactor

## Assumptions / Dependencies
- Backend post_edit/plan_first/content_optimize endpoints still exist but are effectively dead; frontend removal is sufficient
- search_documents table stays in DB but the query path bypasses it
- All source tables (chapters, characters, outlines, story_memory, project_source_documents) have project_id FK

## Phases
1. **Writing cleanup - Context Preview removal** (ISSUE-001)
2. **Writing cleanup - Dead advanced params UI removal** (ISSUE-002)
3. **Writing cleanup - PostEdit/ContentOptimize compare drawers removal** (ISSUE-003)
4. **Writing cleanup - GenerateForm type + generation hook cleanup** (ISSUE-004)
5. **Search frontend - sources default all + UI simplification** (ISSUE-005)
6. **Search backend - direct-query refactor** (ISSUE-006)
7. **Build verification + dead reference cleanup + Codex review** (ISSUE-007)

## Tests & Verification
- npm run build passes after each issue
- Backend python -m compileall passes after ISSUE-006
- Search returns results for known project data after refactor
- No dead references for removed components

## Issue CSV
- Path: issues/2026-03-28_12-00-00-writing-cleanup-search-refactor.csv

## Tools / MCP
- codex: full access mode, gpt-5.2, xhigh thinking for implementation + review

## Acceptance Checklist
- [ ] "上下文预览" button gone from WritingToolbar
- [ ] ContextPreviewDrawer.tsx + contextPreview/ folder deleted
- [ ] Advanced params shows only "流式生成" checkbox
- [ ] PostEditCompareDrawer + ContentOptimizeCompareDrawer deleted
- [ ] GenerateForm type has no plan_first/post_edit/post_edit_sanitize/content_optimize fields
- [ ] Search sources default to all selected
- [ ] Search returns results (not "暂无结果") for existing project data
- [ ] Backend search uses direct source table queries
- [ ] npm run build passes
- [ ] python -m compileall passes

## Risks / Blockers
- GenerateForm field removal may break useChapterGeneration API call payload; must ensure backend handles missing fields gracefully
- Direct-query search may be slower for very large projects; acceptable for demo scope

## Rollback / Recovery
- Each issue is a separate commit on test branch; can revert individually

## Checkpoints
- Commit after: each individual issue (7 commits total)

## References
- frontend/src/components/writing/WritingToolbar.tsx:81-83
- frontend/src/components/writing/ContextPreviewDrawer.tsx (entire file)
- frontend/src/components/writing/aiGenerateDrawer/AiGenerateAdvancedSection.tsx:67-131
- frontend/src/components/writing/types.ts:25-28
- frontend/src/pages/SearchPage.tsx:58 (sources default state)
- backend/app/services/search_index_service.py:476-595 (query function)
- backend/app/api/routes/search.py (search endpoint)
