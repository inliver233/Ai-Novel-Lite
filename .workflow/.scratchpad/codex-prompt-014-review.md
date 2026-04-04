## Task: DETAILED-014 — Full Code Review of Outline Volumes Pipeline Fix

Review ALL uncommitted changes in this repository for correctness, consistency, and potential issues. The changes implement support for the new `volumes` format in the outline generation pipeline (大纲→细纲→章节骨架).

### Changes Overview

**Backend changes:**
1. `backend/app/services/detailed_outline_generation/app_service.py:131` — Added `vol.get("summary")` to beats_raw extraction chain
2. `backend/app/services/outline_parsing_agent/prompts/structure_system.md` — Rewrote prompt from chapters to volumes format
3. `backend/app/services/outline_parsing_agent/agents/structure_agent.py` — Updated parse_response() and merge_results() to handle volumes+chapters
4. `backend/app/services/outline_parsing_agent/models.py` — Added volumes field to ParsedOutline, updated to_dict()

**Frontend changes:**
5. `frontend/src/pages/outlineParsing.ts` — Added OutlineGenVolume type, extractOutlineVolumes(), updated normalizeOutlineGenResult() and deriveOutlineFromStoredContent()
6. `frontend/src/pages/outline/outlineModels.ts` — Updated toFinalPreviewJson() to include volumes
7. `frontend/src/pages/outline/useOutlineGenerationState.ts` — Updated overwriteCurrentOutline() and saveAsNewOutline() to pass volumes in structure
8. `frontend/src/pages/outline/useOutlinePageState.ts` — Updated structure reconstruction to preserve volumes on load

### Review Checklist
Please verify:

1. **Backward compatibility**: Can the system still handle old `chapters`-only format data? Are there any code paths that will break if structure_json has no `volumes` key?

2. **Data flow completeness**: Trace the full data flow:
   - AI generates outline → parse_outline_output() → frontend normalizeOutlineGenResult() → save to DB → extract_volumes_from_outline() → generate_all_detailed_outlines()
   - Smart parse → structure_agent → ParsedOutline → frontend → save to DB → same downstream

3. **Consistency**: Do all files agree on the volumes format? Is {number, title, summary} used consistently?

4. **Edge cases**: What happens when:
   - volumes array is empty?
   - volumes have no summary?
   - Old chapters-only data is loaded?
   - LLM outputs chapters instead of volumes?

5. **Missing changes**: Are there any other files that reference `chapters` in a way that should also handle `volumes`?

6. **TypeScript correctness**: Are all type signatures correct? Any implicit `any` or missing types?

7. **Python correctness**: Any potential None/type errors?

### Specific concern
Check if `frontend/src/pages/outline/useOutlineParsingState.ts` needs updates too — it handles the "智能解析" apply flow and may need to pass volumes when saving parsed results.

### Output format
Report findings as:
- CRITICAL: Must fix before commit
- WARNING: Should fix but not blocking
- INFO: Informational notes

If you find CRITICAL issues, fix them. If only WARNING/INFO, report without fixing.
