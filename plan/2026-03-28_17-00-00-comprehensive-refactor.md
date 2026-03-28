# Plan: Comprehensive Codebase Refactoring

## Goal
- Transform the AI Novel project into an enterprise-grade, maintainable, extensible codebase
- Frontend: Multi-theme design system architecture enabling rapid theme switching (e.g. ink-wash/water-ink style)
- Backend: Clean service architecture, optimized DB operations, extensibility for future multi-agent/prompt modules
- All core functionality preserved; zero feature regression

## Scope
- In:
  - Dead code removal from prior feature removals (WorldBook, StructuredMemory, PlotAnalysis, etc.)
  - Backend session management centralization
  - Backend service decomposition (break monoliths)
  - Frontend theme system architecture (multi-theme infrastructure)
  - Backend extensibility layer (LLM strategy, agent abstraction)
  - N+1 query elimination, enum standardization
  - Full regression verification
- Out:
  - New feature development (no new user-facing features)
  - Database engine migration (stay on SQLite)
  - Full async/await migration (too large; prep only)
  - Docker/deployment changes

## Assumptions / Dependencies
- Current branch: `test/issue-001-foundation` (will create fresh branch from main)
- All code changes executed via Codex (full access, gpt-5.2, xhigh thinking)
- Backend Python 3.13+, Frontend React 19 + TypeScript 5.9 + Vite 7
- SQLite with WAL mode, single worker constraint
- 14 empty test stubs from feature removal need cleanup
- 19 direct SessionLocal() calls need centralization

## Phases

### Phase 1: Codebase Hygiene (RF-001 ~ RF-005)
Remove dead code from feature removal, clean empty tests, remove orphaned references.
- Verify each file is truly dead before removal (grep for imports/references)
- Remove 14 empty test stubs
- Remove orphaned models, services, routes
- Clean dead imports across codebase

### Phase 2: Backend DB & Session Foundation (RF-006 ~ RF-009)
Fix the most critical backend architectural debt.
- Eliminate all 19 direct SessionLocal() calls → use dependency-injected sessions
- Add eager loading to critical query paths
- Standardize enum types (ProjectTask.kind, etc.)
- Establish Alembic migration workflow

### Phase 3: Backend Service Decomposition (RF-010 ~ RF-014)
Break monolithic services into focused, maintainable modules.
- Split vector_rag_service.py (2439 LOC) → retrieval, rerank, budget modules
- Split batch_generation_service.py (969 LOC) → orchestration + execution
- Consolidate outline generation (10+ scattered files)
- Consolidate chapter generation services
- Unify error handling patterns

### Phase 4: Frontend Theme Architecture (RF-015 ~ RF-019)
Build enterprise-grade multi-theme design system.
- Theme registry with runtime theme switching
- Unify motion token system (CSS ↔ JS deduplication)
- Split types.ts into domain modules
- Standardize UI component contracts
- Add ink-wash (水墨) theme as proof-of-concept for rapid theme creation

### Phase 5: Backend Extensibility Layer (RF-020 ~ RF-023)
Prepare backend for future multi-agent, prompt module, and model integration capabilities.
- LLM client → strategy pattern with provider plugins
- Abstract agent interface for multi-agent support
- Modularize prompt system for template composition
- API route module registration pattern

### Phase 6: Verification & Regression (RF-024 ~ RF-026)
Full test suite, build verification, final cleanup.
- Backend: compileall + unittest discover
- Frontend: lint + test + build
- Integration check: all existing tests pass

## Tests & Verification
- Backend compilation: `.venv/Scripts/python.exe -m compileall -q app alembic`
- Backend tests: `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v`
- Frontend lint: `npm run lint`
- Frontend tests: `npm test`
- Frontend build: `npm run build`
- Per-phase: Each issue verified via its Test_Method before commit

## Issue CSV
- Path: issues/2026-03-28_17-00-00-comprehensive-refactor.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- Codex CLI (full access, gpt-5.2, xhigh thinking) for all code modifications
- Codex CLI (review mode) for code review after each phase
- grep/rg for dead code verification before removal
- Python compileall for backend syntax validation
- npm run build for frontend validation

## Acceptance Checklist
- [ ] All 14 empty test stubs removed
- [ ] Zero direct SessionLocal() calls outside db/session.py
- [ ] vector_rag_service.py split into 3+ focused modules (each <500 LOC)
- [ ] batch_generation_service.py split into 2+ modules
- [ ] Frontend supports 2+ themes (paper-ink + ink-wash) with runtime switching
- [ ] Motion tokens unified (single source of truth)
- [ ] types.ts split into domain modules
- [ ] LLM client uses strategy pattern
- [ ] All backend tests pass
- [ ] Frontend build succeeds with zero errors
- [ ] All existing functionality preserved

## Risks / Blockers
- Orphaned code may have hidden references → must verify with grep before removal
- Service decomposition may introduce import cycle breaks → careful dependency ordering
- Theme system refactoring may affect all component files → must preserve visual parity
- Codex availability: if Codex fails, STOP and ask user (never self-implement)

## Rollback / Recovery
- Each phase committed separately; can git revert per-phase
- Branch-based: all work on test/* branch; main untouched
- Per-issue commits enable surgical rollback

## Checkpoints
- Commit after: Each individual issue (RF-001 through RF-026)
- Phase checkpoint: Backend tests + Frontend build after each phase
- Final checkpoint: Full regression after Phase 6

## References
- Frontend CSS: frontend/src/index.css (336 lines, theme definitions)
- Frontend types: frontend/src/types.ts (326 lines)
- Backend session: backend/app/db/session.py
- Backend largest service: backend/app/services/vector_rag_service.py (2439 LOC)
- Backend config: backend/app/core/config.py (616 lines)
- AGENTS.md: Project constraints and git workflow rules
- .codex/: Codex skills and prompt templates
