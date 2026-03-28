# Plan: Fix Prompts Page Crash — event.currentTarget null in setState updater

## Goal
- Fix the `Cannot read properties of null (reading 'value')` crash on the Prompts (model config) page
- Ensure all model config fields can be edited without crashing
- Comprehensive fix across all affected card components

## Scope
- In: All `event.currentTarget.value` / `.checked` / `.valueAsNumber` usages inside functional `setState` updaters in `frontend/src/components/prompts/cards/`
- In: Remove the no-deps `useLayoutEffect` in `LlmPresetPanel.tsx` that unnecessarily renames DOM attributes every render
- Out: Backend code, other pages (settings page uses `e.target.value` correctly), test infrastructure

## Assumptions / Dependencies
- React 18 automatic batching defers functional updater execution to the render phase when other state updates are pending (30+ useState hooks in `usePromptsPageState`)
- `event.currentTarget` is set to `null` by the browser after event dispatch completes (W3C DOM spec)
- The fix pattern is to capture the value before the closure: `const v = event.currentTarget.value; setForm(prev => ({ ...prev, field: v }))`

## Phases
1. **Phase 1 (ISSUE-001)**: Fix `ModelSelectorCard.tsx` — the primary crash site (3 onChange handlers)
2. **Phase 2 (ISSUE-002)**: Fix `ParameterTunerCard.tsx` — 5 onChange handlers with same pattern
3. **Phase 3 (ISSUE-003)**: Fix `ThinkingConfigCard.tsx` — 5 onChange handlers (value + checked)
4. **Phase 4 (ISSUE-004)**: Fix `AdvancedConfigCard.tsx` — 2 onChange handlers
5. **Phase 5 (ISSUE-005)**: Fix `TaskOverrideSection.tsx` — 18+ onChange handlers in task module forms
6. **Phase 6 (ISSUE-006)**: Remove no-deps `useLayoutEffect` in `LlmPresetPanel.tsx` (lines 96-112) that renames DOM name attributes every render — unnecessary and potentially destabilizing

## Tests & Verification
- ISSUE-001~005: Navigate to `/projects/:id/prompts`, edit each field type (provider select, model input, base_url, temperature, max_tokens, reasoning_effort, stop, extra JSON, checkboxes), verify no crash
- ISSUE-006: Verify form fields still function after removing the useLayoutEffect
- All: TypeScript compilation passes (`npx tsc --noEmit`)

## Issue CSV
- Path: issues/2026-03-28_09-30-00-prompts-page-currenttarget-crash.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Chrome DevTools MCP: runtime crash reproduction and verification
- Codex CLI: code modification (full access, 5.4 model, xhigh thinking)

## Acceptance Checklist
- [ ] All model config fields (provider, model, base_url, temperature, top_p, max_tokens, timeout, penalties, top_k, stop, extra, reasoning_effort, thinking toggles/budgets) can be edited without crash
- [ ] Task module override fields also work without crash
- [ ] TypeScript compilation passes
- [ ] No-deps useLayoutEffect removed from LlmPresetPanel
- [ ] Verified via Chrome DevTools: edit base_url field, page does not crash

## Risks / Blockers
- Low risk: mechanical find-and-replace pattern, unlikely to introduce regressions
- The `useLayoutEffect` removal (ISSUE-006) needs verification that no downstream code depends on the renamed `name` attributes

## Rollback / Recovery
- `git revert` any individual commit if regression found

## Checkpoints
- Commit after: each ISSUE (one commit per issue)

## References
- Stack trace: `ModelSelectorCard.tsx:179` -> `basicStateReducer` -> `updateReducerImpl` -> `useState` -> `usePromptsPageState:80`
- React 18 batching: https://react.dev/blog/2022/03/08/react-18-upgrade-guide#automatic-batching
- W3C DOM Event spec: `currentTarget` is null outside event dispatch
- `frontend/src/components/prompts/cards/ModelSelectorCard.tsx:46,87,107`
- `frontend/src/components/prompts/cards/ParameterTunerCard.tsx:54,66,80,93,106`
- `frontend/src/components/prompts/cards/ThinkingConfigCard.tsx:26,46,62,81,119`
- `frontend/src/components/prompts/cards/AdvancedConfigCard.tsx:74,95`
- `frontend/src/components/prompts/cards/TaskOverrideSection.tsx:226,255,279,295,311,327,349,367,383,400,416,432,455,472,495,509,528`
- `frontend/src/components/prompts/LlmPresetPanel.tsx:96-112`
