# Plan: Fix LLM Config Persistence Bug & Default Values

## Goal
- Fix the bug where modified `max_tokens` and `timeout_seconds` values revert to their unmodified state after saving config, switching profiles, and switching back
- Update default `max_tokens` to 120000 and default `timeout_seconds` to 1200
- Comprehensive review of the model config persistence code to prevent similar issues

## Scope
- In:
  - Backend: `backend/app/api/routes/llm_profiles.py` (update_profile normalization, _to_out)
  - Backend: `backend/app/api/routes/llm_preset.py` (_default_preset timeout)
  - Backend: `backend/app/services/llm_profile_template.py` (DEFAULT_TIMEOUT_SECONDS, apply_profile_template_to_llm_row)
  - Frontend: `frontend/src/pages/prompts/models.ts` (DEFAULT_LLM_FORM defaults)
  - Frontend: `frontend/src/pages/prompts/usePromptsPageState.ts` (saveAll profile sync logic)
- Out:
  - LLM registry model contracts (max_output_tokens per model is correct by design)
  - UI layout/styling changes
  - Database migration (existing columns are compatible)

## Assumptions / Dependencies
- SQLite database columns `max_tokens` and `timeout_seconds` are nullable Integer, no migration needed
- `normalize_max_tokens_for_provider` capping per model is correct behavior (not a bug)
- The `saveAll()` function should sync parameter changes back to the bound profile

## Phases

### Phase 1: Backend Default Values Fix (A1-A3)
1. Update `DEFAULT_TIMEOUT_SECONDS` from 180 to 1200
2. Update `_default_preset` in `llm_preset.py` to use 1200 timeout
3. Fix `_to_out` in `llm_profiles.py` to use updated default

### Phase 2: Backend Profile Update Normalization Fix (B1-B2)
1. Remove redundant double-normalization of `max_tokens` and `timeout_seconds` in `update_profile` (lines 191-197)
2. Fix `apply_profile_template_to_llm_row` to use updated default

### Phase 3: Frontend saveAll Profile Sync Fix (C1)
1. Fix `saveAll()` to sync ALL parameter fields (including max_tokens, timeout_seconds) to the bound profile, not just provider/model/base_url

### Phase 4: Frontend Default Values Fix (D1)
1. Update `DEFAULT_LLM_FORM` defaults to match new values

## Tests & Verification
- Manual test: modify max_tokens and timeout_seconds → save → switch profile → switch back → values should persist
- Verify default values display correctly for new projects/profiles
- Verify backend normalization still caps max_tokens correctly per model

## Issue CSV
- Path: issues/2026-04-01_01-00-00-llm-config-persist-defaults-fix.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Codex CLI (`codex exec -m gpt-5.4 --sandbox danger-full-access --json`) for all code modifications
- Codex CLI for code review

## Acceptance Checklist
- [ ] Default max_tokens is 120000 in frontend form
- [ ] Default timeout_seconds is 1200 in both frontend and backend
- [ ] Backend DEFAULT_TIMEOUT_SECONDS = 1200
- [ ] Modified max_tokens/timeout_seconds persist after save → switch profile → switch back
- [ ] saveAll() syncs parameter changes to bound profile
- [ ] No double-normalization of max_tokens/timeout_seconds in update_profile
- [ ] Code review passed via Codex

## Risks / Blockers
- Codex CLI availability
- Existing data in production may have old defaults (180 timeout) - this is acceptable, only affects new profiles

## Rollback / Recovery
- Git revert to pre-fix commit

## Checkpoints
- Commit after: Phase 1+2 (backend fixes)
- Commit after: Phase 3+4 (frontend fixes)

## References
- backend/app/api/routes/llm_profiles.py:142-202 (update_profile bug)
- backend/app/api/routes/llm_profiles.py:37-64 (_to_out normalization)
- backend/app/services/llm_profile_template.py:14 (DEFAULT_TIMEOUT_SECONDS)
- backend/app/services/llm_profile_template.py:57-70 (apply_profile_template_to_llm_row)
- backend/app/api/routes/llm_preset.py:15-31 (_default_preset)
- frontend/src/pages/prompts/models.ts:82-101 (DEFAULT_LLM_FORM)
- frontend/src/pages/prompts/usePromptsPageState.ts:360-458 (saveAll)
- frontend/src/pages/prompts/usePromptsPageState.ts:1055-1093 (selectProfile)
