# Plan: Multi-Agent Outline Parsing System (智能大纲解析)

## Goal
- Build an independent multi-agent system that parses external outlines (text/files up to 100K+ chars) into the project's native format: outline (content_md + chapters[]), character cards, entries, and chapter skeleton
- Inspired by claude-code-source agent architecture (coordinator pattern, fork/parallel execution, task lifecycle, adaptive context)
- Preserve all existing outline features; add as independent "智能解析 (Beta)" button on outline page
- Support adaptive context window (default 200K tokens) and timeout (default 3600s)

## Scope
- In:
  - Backend multi-agent framework (BaseAgent, Orchestrator, Chunker, Config)
  - 5 specialized agents: Analysis, Structure, Character, Entry, Validation
  - Agent prompt templates (system + user per agent)
  - New API endpoints: POST /outline/parse and /outline/parse-stream
  - Frontend: "智能解析" button, parsing modal with text input + file upload + progress + result preview
  - Frontend: result application (save outline, create characters, create entries)
  - SSE streaming for real-time progress
- Out:
  - Modifying existing outline generation logic
  - Database schema changes (uses existing models)
  - Modifying LLM strategy/registry (uses existing infrastructure)

## Assumptions / Dependencies
- Existing LLM strategy pattern (app.llm.strategy) works for all agent calls
- Existing LLM task preset resolver can resolve "outline_parse" task key (or fallback to project main preset)
- Character, Entry, Outline, Chapter models and APIs already exist and are stable
- Frontend SSE client (SSEPostClient) can be reused
- No new database tables needed — agents are stateless, results go through existing models

## Architecture

### Multi-Agent Pipeline (inspired by claude-code-source)

```
User Input (text/file, up to 100K+ chars)
  ↓
TextChunker: Split into chunks if > context limit (~50K tokens/chunk, overlap 2K)
  ↓
AnalysisAgent (Phase 1): Analyze input format, identify content types, plan extraction
  ↓
Parallel Extraction (Phase 2): Three agents run concurrently
  ├── StructureExtractionAgent → {outline_md, chapters[{number, title, beats[]}]}
  ├── CharacterExtractionAgent → [{name, role, profile, notes}]
  └── EntryExtractionAgent → [{title, content, tags[]}]
  ↓
ValidationAgent (Phase 3): Merge results, validate cross-references, fix gaps
  ↓
Final Output: {outline, characters, entries, agent_log}
```

### Key Design Decisions (from claude-code-source learnings)

1. **Agent Protocol**: Strongly-typed dataclass config + Protocol interface (extends existing app.llm.agent)
2. **Coordinator Pattern**: Central orchestrator manages agent lifecycle, progress, errors
3. **Parallel Execution**: asyncio.gather for independent extraction agents
4. **Chunked Processing**: Each agent processes all chunks, accumulating and deduplicating results
5. **Adaptive Context**: Auto-detect model context limits from LLM registry, chunk accordingly
6. **Error Recovery**: Per-agent retry with backoff, partial results on failure
7. **Streaming Progress**: SSE events per agent phase (start/progress/complete/error)
8. **Prompt Caching**: System prompts shared across chunks for same agent

### File Structure

```
backend/app/services/outline_parsing_agent/
  __init__.py                          # Public API: parse_outline(), parse_outline_stream()
  config.py                            # AgentPipelineConfig, defaults
  models.py                            # ParseResult, AgentStepResult, ChunkInfo
  chunker.py                           # TextChunker: token-aware splitting
  coordinator.py                       # OutlineParsingOrchestrator: pipeline execution
  agents/
    __init__.py
    base.py                            # BaseExtractionAgent: shared LLM call + parse logic
    analysis_agent.py                  # Analyze input, determine extraction plan
    structure_agent.py                 # Extract outline_md + chapters
    character_agent.py                 # Extract character cards
    entry_agent.py                     # Extract entries
    validation_agent.py                # Merge + validate results
  prompts/
    analysis_system.md                 # Analysis agent system prompt
    analysis_user.md                   # Analysis agent user template
    structure_system.md                # Structure agent system prompt
    structure_user.md                  # Structure agent user template
    character_system.md                # Character agent system prompt
    character_user.md                  # Character agent user template
    entry_system.md                    # Entry agent system prompt
    entry_user.md                      # Entry agent user template
    validation_system.md               # Validation agent system prompt
    validation_user.md                 # Validation agent user template

backend/app/api/routes/outline_parse.py    # New API endpoints
backend/app/schemas/outline_parse.py       # Request/response schemas

frontend/src/pages/outline/
  OutlineParsingSection.tsx                # Parsing modal UI
  outlineParsingModels.ts                  # Types and defaults
  useOutlineParsingState.ts                # State management hook
  outlineParsingCopy.ts                    # UI copy/text constants
  (modified) OutlinePageSections.tsx       # Add "智能解析" button to OutlineActionsBar
  (modified) useOutlinePageState.ts        # Wire up parsing state
```

## Phases

### Phase 1: Backend Agent Framework (OPA-001, OPA-002)
- Create base agent infrastructure: config, models, chunker, base agent class
- Establish patterns for LLM calling, response parsing, error handling
- TextChunker with token-aware splitting and overlap

### Phase 2: Backend Agents + Prompts (OPA-003 ~ OPA-007)
- Implement Orchestrator (coordinator.py)
- Implement all 5 agents with dedicated prompt templates
- Each agent: system prompt, user template, JSON output contract
- Parallel execution with asyncio.gather

### Phase 3: Backend API Endpoints (OPA-008)
- POST /projects/{project_id}/outline/parse (sync)
- POST /projects/{project_id}/outline/parse-stream (SSE)
- Request schema with text/file input + agent config
- Response schema with outline + characters + entries + agent log
- Register route in app router

### Phase 4: Frontend UI + Integration (OPA-009, OPA-010)
- "智能解析 (Beta)" button in OutlineActionsBar
- Parsing modal: text input, file upload (.txt/.md), advanced config
- SSE-based progress display (per-agent status)
- Result preview with tabs (outline/characters/entries)
- Apply actions: save outline, create characters, create entries

### Phase 5: Integration Testing & Review (OPA-011)
- End-to-end flow testing
- Code review via Codex gpt-5.4 xhigh

## Tests & Verification
- Backend: python -m compileall backend/app/services/outline_parsing_agent/ (syntax check)
- Backend: manual API test with sample outline text via curl
- Frontend: vite build (compile check)
- Frontend: manual UI test through browser
- E2E: Manual flow — paste outline → parse → preview → apply → verify saved data

## Issue CSV
- Path: issues/2026-03-31_20-00-00-outline-parsing-agent.csv
- Must share the same timestamp/slug as this plan.

## Tools / MCP
- none (manual testing for this experimental feature)

## Acceptance Checklist
- [ ] All existing outline features preserved (generation, edit, save, switch, delete)
- [ ] "智能解析 (Beta)" button visible on outline page
- [ ] Text input and file upload (.txt/.md) working in parsing modal
- [ ] Multi-agent pipeline executes: analysis → parallel extraction → validation
- [ ] Parsed results include: outline (outline_md + chapters), characters, entries
- [ ] SSE streaming shows real-time agent progress
- [ ] Results can be applied to project (save outline, create characters, create entries)
- [ ] Handles 100K+ char input without crash (chunking works)
- [ ] Default 200K token context window and 3600s timeout configurable
- [ ] Code compiles: python compileall + vite build
- [ ] Independent module — no coupling to existing outline generation code

## Risks / Blockers
- LLM API rate limits may affect parallel agent execution (mitigation: sequential fallback)
- Very long inputs (>200K tokens) may require many chunks, increasing latency (mitigation: configurable limits)
- Agent prompt quality determines parsing accuracy (mitigation: iterative prompt tuning)

## Rollback / Recovery
- All new code is in new files (no existing files significantly modified)
- Only 2 existing files minimally modified: OutlinePageSections.tsx (add button), useOutlinePageState.ts (wire hook)
- Rollback: delete new files, revert 2 modified files

## Checkpoints
- Commit after: OPA-001 + OPA-002 (framework)
- Commit after: OPA-003 ~ OPA-007 (agents)
- Commit after: OPA-008 (API)
- Commit after: OPA-009 + OPA-010 (frontend)
- Commit after: OPA-011 (review)

## References
- backend/app/llm/agent.py:1-89 — Existing agent foundation (Protocol + Config)
- backend/app/llm/strategy.py — LLM Strategy pattern
- backend/app/services/outline_generation/app_service.py — Current outline generation flow
- claude-code-source/src/tools/AgentTool/ — Agent orchestration patterns
- claude-code-source/src/coordinator/ — Coordinator mode
- frontend/src/pages/outline/OutlinePageSections.tsx — Current outline UI sections
- frontend/src/pages/outline/useOutlinePageState.ts — Current outline page state
