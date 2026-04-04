## Task: DETAILED-013 — Frontend preserve volumes in save flow

The frontend currently strips the `volumes` array from generated outlines, only saving `chapters`. This must be fixed so `volumes` is preserved in `structure_json` for downstream 细纲 generation.

### Files to modify (exactly 3 files):

#### File 1: `frontend/src/pages/outlineParsing.ts`

Current content has types and functions that only handle `chapters`. Need to add `volumes` support.

**Change 1**: Update `OutlineGenResult` type (line 1-7) to:
```typescript
export type OutlineGenVolume = { number: number; title: string; summary: string };
export type OutlineGenChapter = { number: number; title: string; beats: string[] };
export type OutlineGenResult = {
  outline_md: string;
  volumes: OutlineGenVolume[];
  chapters: OutlineGenChapter[];
  raw_output: string;
  parse_error?: { code: string; message: string };
};
```

**Change 2**: Add a new function `extractOutlineVolumes` RIGHT BEFORE the existing `extractOutlineChapters` function (before line 9):
```typescript
export function extractOutlineVolumes(structure: unknown): OutlineGenVolume[] {
  if (!structure || typeof structure !== "object") return [];
  const maybe = structure as { volumes?: unknown };
  if (!Array.isArray(maybe.volumes)) return [];
  return maybe.volumes
    .map((item) => {
      const raw = item as { number?: unknown; title?: unknown; summary?: unknown };
      const number = typeof raw.number === "number" ? raw.number : Number(raw.number);
      if (!Number.isFinite(number) || number <= 0) return null;
      const title = typeof raw.title === "string" ? raw.title : "";
      const summary = typeof raw.summary === "string" ? raw.summary : "";
      return { number, title, summary } satisfies OutlineGenVolume;
    })
    .filter((v): v is OutlineGenVolume => Boolean(v));
}
```

**Change 3**: Update `normalizeOutlineGenResult` (line 25-45) to also extract volumes. Change the function to:
```typescript
export function normalizeOutlineGenResult(raw: unknown, fallbackRawOutput = ""): OutlineGenResult | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as {
    outline_md?: unknown;
    volumes?: unknown;
    chapters?: unknown;
    raw_output?: unknown;
    parse_error?: unknown;
  };
  const outline_md = typeof data.outline_md === "string" ? data.outline_md : "";
  const volumes = extractOutlineVolumes({ volumes: data.volumes });
  const chapters = extractOutlineChapters({ chapters: data.chapters });
  const raw_output = typeof data.raw_output === "string" ? data.raw_output : fallbackRawOutput;
  const parse_error =
    data.parse_error && typeof data.parse_error === "object"
      ? {
          code: String((data.parse_error as { code?: unknown }).code ?? ""),
          message: String((data.parse_error as { message?: unknown }).message ?? ""),
        }
      : undefined;
  if (!outline_md && volumes.length === 0 && chapters.length === 0 && !raw_output) return null;
  return { outline_md, volumes, chapters, raw_output, parse_error };
}
```

**Change 4**: Update `deriveOutlineFromStoredContent` (line 68-87) to also return volumes:
```typescript
export function deriveOutlineFromStoredContent(
  contentMd: string,
  structure: unknown,
): {
  normalizedContentMd: string;
  volumes: OutlineGenVolume[];
  chapters: OutlineGenChapter[];
} {
  const storedVolumes = extractOutlineVolumes(structure);
  const storedChapters = extractOutlineChapters(structure);
  if (storedChapters.length > 0 || storedVolumes.length > 0) {
    return { normalizedContentMd: contentMd, volumes: storedVolumes, chapters: storedChapters };
  }
  const parsed = parseOutlineGenResultFromText(contentMd);
  if (parsed && (parsed.chapters.length > 0 || parsed.volumes.length > 0)) {
    return {
      normalizedContentMd: parsed.outline_md || contentMd,
      volumes: parsed.volumes,
      chapters: parsed.chapters,
    };
  }
  return { normalizedContentMd: contentMd, volumes: [], chapters: [] };
}
```

#### File 2: `frontend/src/pages/outline/outlineModels.ts`

Update `toFinalPreviewJson` (line 28-38) to include volumes:
```typescript
export function toFinalPreviewJson(result: OutlineGenResult): string {
  return JSON.stringify(
    {
      outline_md: result.outline_md,
      volumes: result.volumes,
      chapters: result.chapters,
      parse_error: result.parse_error ?? undefined,
    },
    null,
    2,
  );
}
```

#### File 3: `frontend/src/pages/outline/useOutlineGenerationState.ts`

**Change 1**: Update line 78 in `overwriteCurrentOutline` from:
```typescript
    const savedOk = await save(preview.outline_md, { chapters: preview.chapters });
```
to:
```typescript
    const savedOk = await save(preview.outline_md, { volumes: preview.volumes, chapters: preview.chapters });
```

**Change 2**: Update line 98 in `saveAsNewOutline` from:
```typescript
    const created = await createOutline(buildGeneratedOutlineTitle(), preview.outline_md, { chapters: preview.chapters });
```
to:
```typescript
    const created = await createOutline(buildGeneratedOutlineTitle(), preview.outline_md, { volumes: preview.volumes, chapters: preview.chapters });
```

### Constraints
- Do NOT change any other files
- Do NOT add any new imports
- Preserve exact existing code structure and formatting style
- The `volumes` field must always be included alongside `chapters` for backward compatibility
- Do NOT modify `useOutlinePageState.ts` — it reads from `deriveOutlineFromStoredContent` which we're updating
