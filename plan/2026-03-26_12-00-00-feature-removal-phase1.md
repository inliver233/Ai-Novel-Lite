# Plan: Feature Removal Phase 1 — 10-Module Pruning

## Goal
- Delete 10 redundant feature modules (Glossary, ChapterReader, Advanced Debug/TaskCenter, Fractal, Graph, NumericTables, RAG Page, Foreshadows, StructuredMemory, WorldBook) while preserving core writing/outline/characters/preview/export/model-config functionality.
- System must compile and run correctly after each step.
- Only delete; no refactoring of retained features.

## Scope
- In: All 10 modules listed in 功能去除文档.md; backend routes/models/services/config, frontend pages/components/routes/types/copy, navigation restructuring, Alembic reverse migration
- Out: No refactoring of retained features; no backend vector capability removal (Phase 1 keeps backend RAG); no story_memory is_foreshadow field removal (方案A: just stop sending it)

## Assumptions / Dependencies
- Steps must execute in order (Step 1→10) due to interdependencies
- Step 9 (StructuredMemory) requires Steps 5 (Graph) and 8 (Foreshadows) completed first
- Step 10 (WorldBook) requires ProjectTask type migration before file deletion
- Frontend build: `cd frontend && npm run build`
- Backend compile check: `cd backend && .\.venv\Scripts\python.exe -m compileall -q app alembic`
- MemoryUpdateDrawer is kept; MemoryChangeSet/MemoryChangeSetItem models preserved but with reduced target_table scope

## Phases
1. **Low Risk (Steps 1-2)**: Glossary + ChapterReader — independent modules, no cross-cutting concerns
2. **Medium Risk (Steps 3-4,7)**: AdvancedDebug/TaskCenter + Fractal + RAG Page — UI framework changes, memory system edge modules
3. **High Risk (Steps 5-6,8)**: Graph + NumericTables + Foreshadows — generation context injection, memory update integration
4. **Highest Risk (Steps 9-10)**: StructuredMemory + WorldBook — deepest integration in generation pipeline, import/export, search index
5. **Cleanup**: Alembic migration + final navigation verification + full build

## Tests & Verification
- After each step: `cd frontend && npm run build` (frontend compilation)
- After each step: `cd backend && .\.venv\Scripts\python.exe -m compileall -q app alembic` (backend compilation)
- After Step 10: Full navigation state matches expected final layout
- After final: `cd frontend && npm run lint` (lint check)

## Issue CSV
- Path: issues/2026-03-26_12-00-00-feature-removal-phase1.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Codex CLI (`ccw cli --tool codex --mode write`): Primary implementation tool for all code changes
- Codex CLI (`ccw cli --tool codex --mode review`): Post-implementation review
- Manual verification: `npm run build`, `python -m compileall`

## Acceptance Checklist
- [ ] All 10 modules fully removed (no dead imports, no orphan files)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend compiles without errors (`python -m compileall -q app alembic`)
- [ ] Navigation sidebar matches expected final state (workbench/view/aiConfig groups only)
- [ ] Search page moved from advancedDebug to workbench group
- [ ] No TypeScript errors in retained features
- [ ] ProjectTask type preserved for projectTaskStore/Runtime after worldbookApi.ts deletion
- [ ] Alembic reverse migration created for dropped tables
- [ ] Each step has a local git commit on test branch

## Risks / Blockers
- WorldBook deep integration in generation pipeline — careful service-level cleanup needed
- StructuredMemory models shared by MemoryUpdate — must preserve ChangeSet/ChangeSetItem
- NumericTables integrated in search index, project seed, memory update — multiple touch points
- Foreshadows spans two data systems (StoryMemory + StructuredMemory)

## Rollback / Recovery
- Each step is committed separately on test branch → `git revert <sha>` for any step
- Initial baseline commit exists on master branch as safe fallback
- `git reset --hard master` to fully revert all changes if needed

## Checkpoints
- Commit after: Each step (Steps 1-10) individually
- Commit after: Alembic migration creation
- Commit after: Final verification pass

## References
- 全面文档/功能去除文档.md: Master reference for all deletion instructions
- AGENTS.md: Git workflow and testing constraints
- issues/README.md: CSV format specification
