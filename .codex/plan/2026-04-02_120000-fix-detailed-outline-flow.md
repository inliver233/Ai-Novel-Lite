# Plan: Fix Detailed Outline Generation Flow

## Goal
- AI生成大纲 and 智能解析 both produce complete outline + detailed outlines
- After generation/parsing, 细纲 tab auto-populates with content
- No SSE_SERVER_ERROR when generating detailed outlines
- Chapter skeleton creation works from 细纲 tab

## Scope
- In:
  - Backend: LLM config fallback for detailed_outline_generate task
  - Frontend: applyAll flow to include detailed outlines
  - Frontend: auto-trigger detailed outline generation after AI outline gen
  - Frontend: auto-tab-switch to 细纲 after completion
  - Frontend: flow cleanup (button visibility, error handling)
- Out:
  - Prompt/template rewrite for outline generation (prompts already work)
  - Database schema changes (schema is correct)
  - New features beyond flow fix

## Root Cause Analysis

### SSE_SERVER_ERROR Root Cause
`resolve_task_llm_config(db, task_key="detailed_outline_generate")` returns `None` when:
1. No task-specific `LLMTaskPreset` exists for `detailed_outline_generate`
2. No project-level `LLMPreset` exists either

The function at `app_service.py:338` then yields `{"type":"error","message":"LLM config not found"}` which the frontend receives as `SSE_SERVER_ERROR`.

**Fix**: Fall back to `outline_generate` task key, since both tasks use similar LLM configs.

### Smart Parse Flow Root Cause
`useOutlineParsingState.ts:508-516` `applyAll()` calls:
1. `applyOutline()` ✓
2. `applyCharacters()` ✓
3. `applyEntries()` ✓
4. `applyDetailedOutlines()` ✗ MISSING

The detailed outline saving is done separately in `useOutlinePageState.ts:528-556` via complex setTimeout chains, which is fragile and sometimes fails silently.

### Auto-Tab-Switch Root Cause
No mechanism exists to switch from "outline" tab to "detailed" tab after generation/parsing completes.

## Phases
1. **A1 - Backend LLM config fallback** (critical path)
2. **A2 - Frontend applyAll fix** (critical path)
3. **A3 - Frontend auto-trigger + auto-tab-switch** (UX flow)
4. **A4 - Code review via Codex**
5. **A5 - Commit to GitHub**

## Tests & Verification
- A1: Generate detailed outline when only outline_generate LLM config exists -> no error
- A2: Smart parse applyAll -> detailed outlines saved to DB -> visible in 细纲 tab
- A3: After AI outline gen -> detailed outlines auto-generated -> auto-switch to 细纲 tab
- A3: After smart parse -> detailed outlines auto-saved -> auto-switch to 细纲 tab

## Issue CSV
- Path: issues/2026-04-02_120000-fix-detailed-outline-flow.csv

## Acceptance Checklist
- [ ] AI生成大纲 → 覆盖/另存 → 细纲自动生成 → 自动切到细纲tab → 看到细纲内容
- [ ] 智能解析 → 应用全部 → 细纲自动保存 → 自动切到细纲tab → 看到细纲内容
- [ ] 细纲tab → 从细纲创建章节 → 章节骨架创建成功
- [ ] No SSE_SERVER_ERROR
- [ ] 当只有 outline_generate LLM 配置时, 细纲生成也能正常工作

## Risks / Blockers
- Codex CLI availability (if fails, stop and ask user)
- LLM API key configuration per project (user must have at least outline_generate configured)

## Rollback / Recovery
- All changes are git-tracked, can revert per-issue commit

## Checkpoints
- Commit after: A1 (backend fix)
- Commit after: A2+A3 (frontend fixes)
- Commit after: A4 review findings (if any)

## References
- backend/app/services/detailed_outline_generation/app_service.py:305-414 (generate_all)
- backend/app/services/llm_task_preset_resolver.py:99-133 (resolve_task_llm_config)
- frontend/src/pages/outline/useOutlineParsingState.ts:508-516 (applyAll)
- frontend/src/pages/outline/useOutlinePageState.ts:486-556 (auto-trigger)
- frontend/src/pages/OutlinePage.tsx:42-117 (tab management)
