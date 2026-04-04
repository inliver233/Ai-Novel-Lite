# Planning Context — Cache Refresh & Chapter Numbering Fix

## Bug 1: Writing page cache not refreshing after outline creates chapters

### Evidence Path
- `frontend/src/pages/outline/useDetailedOutlineState.ts:301,391` — calls `chapterStore.invalidateProjectChapters(projectId)` after skeleton/chapter creation
- `frontend/src/services/chapterStore.ts:330-337` — `invalidateProjectChapters()` sets `stale: true` and emits to subscribers
- `frontend/src/hooks/useChapterMetaList.ts:43-46` — `useEffect` only depends on `[projectId]`; never re-fires when stale changes
- `frontend/src/hooks/useChapterMetaList.ts:41` — `useSyncExternalStore` correctly re-renders when stale changes, but no effect triggers refetch

### Root Cause
The `useEffect` at L43-46 calls `loadProjectChapterMeta(projectId)` with dependency `[projectId]`. When `invalidateProjectChapters` is called from the outline page, it sets `stale: true` and emits, which triggers a re-render via `useSyncExternalStore`. However, since `projectId` hasn't changed, the loading effect doesn't re-fire. The `loadMeta` function (L223-225) checks for stale and WOULD refetch, but nobody calls it.

### Fix
Add an effect that watches `snapshot.stale` and calls `loadProjectChapterMeta` when stale becomes true.

---

## Bug 2: Cross-volume chapter numbering gap

### Evidence Path
- `backend/app/resources/prompt_presets/detailed_outline_generate_v1/templates/sys.story.volume_context.md:23-25` — prompt: "章节编号起始：第 {{chapter_number_start}} 章"
- `backend/app/services/detailed_outline_generation/prepare_service.py:76` — `chapter_number_start` = `volume_info.chapter_range_start`
- `backend/app/services/detailed_outline_generation/app_service.py:640-663` — `_compute_chapter_offset` uses `max()` of chapter numbers from structure_json
- `backend/app/services/detailed_outline_generation/app_service.py:697,763` — `global_number = offset + local_number` where local_number is raw from structure_json
- `backend/app/services/chapter_skeleton_generation/stream_service.py:119-137,473` — duplicated offset + numbering logic

### Root Cause
The prompt tells the LLM to start numbering at a global number (e.g., "第 7 章" for volume 2). The LLM generates chapters with GLOBAL numbers [7, 8, 9...] stored in structure_json. But `_compute_chapter_offset` reads these and uses `max()` (=6 for volume 1), then chapter creation does `offset(6) + raw_number(7) = 13`. This double-counts the offset.

The actual user symptom (#8 instead of #7) suggests the LLM generates slightly off numbers depending on the exact prompt/generation path.

### Fix
1. Change `_compute_chapter_offset` in BOTH files to use `len()` (count) instead of `max()`
2. In chapter creation, normalize to sequential 1-based local numbers (sort by raw number, assign 1, 2, 3...)
