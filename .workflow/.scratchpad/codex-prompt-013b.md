## Task: DETAILED-013b — Fix useOutlinePageState.ts dropping volumes on load

In `frontend/src/pages/outline/useOutlinePageState.ts`, lines 114-117 reconstruct the structure without volumes:

```typescript
      structure:
        normalizedStored.chapters.length > 0
          ? { chapters: normalizedStored.chapters }
          : outlineQuery.data.outline.structure,
```

This drops `volumes` from the local state when loading from the server. Now that `deriveOutlineFromStoredContent` returns `volumes`, we need to preserve them.

### Required Change

In file `frontend/src/pages/outline/useOutlinePageState.ts`, replace lines 114-117:
```typescript
      structure:
        normalizedStored.chapters.length > 0
          ? { chapters: normalizedStored.chapters }
          : outlineQuery.data.outline.structure,
```

with:
```typescript
      structure:
        normalizedStored.chapters.length > 0 || normalizedStored.volumes.length > 0
          ? { volumes: normalizedStored.volumes, chapters: normalizedStored.chapters }
          : outlineQuery.data.outline.structure,
```

### Constraints
- Only change these 3 lines (114-117)
- Do NOT change any other code in this file
- Do NOT add imports or comments
