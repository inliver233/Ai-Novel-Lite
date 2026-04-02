export type OutlineGenVolume = { number: number; title: string; summary: string };
export type OutlineGenChapter = { number: number; title: string; beats: string[] };
export type OutlineGenResult = {
  outline_md: string;
  volumes: OutlineGenVolume[];
  chapters: OutlineGenChapter[];
  raw_output: string;
  parse_error?: { code: string; message: string };
};

function synthesizeCompatChapters(volumes: OutlineGenVolume[]): OutlineGenChapter[] {
  return volumes.map((volume) => ({
    number: volume.number,
    title: volume.title,
    beats: volume.summary ? [volume.summary] : [],
  }));
}

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

export function extractOutlineChapters(structure: unknown): OutlineGenChapter[] {
  if (!structure || typeof structure !== "object") return [];
  const maybe = structure as { chapters?: unknown };
  if (!Array.isArray(maybe.chapters)) return [];
  return maybe.chapters
    .map((item) => {
      const raw = item as { number?: unknown; title?: unknown; beats?: unknown };
      const number = typeof raw.number === "number" ? raw.number : Number(raw.number);
      if (!Number.isFinite(number) || number <= 0) return null;
      const title = typeof raw.title === "string" ? raw.title : "";
      const beats = Array.isArray(raw.beats) ? raw.beats.map((b) => String(b)).filter(Boolean) : [];
      return { number, title, beats } satisfies OutlineGenChapter;
    })
    .filter((v): v is OutlineGenChapter => Boolean(v));
}

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
  const parsedChapters = extractOutlineChapters({ chapters: data.chapters });
  const chapters = parsedChapters.length > 0 ? parsedChapters : synthesizeCompatChapters(volumes);
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

export function parseOutlineGenResultFromText(text: string): OutlineGenResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const candidates: string[] = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const normalized = normalizeOutlineGenResult(parsed, text);
      if (normalized) return normalized;
    } catch {
      // ignore and continue fallback parsing
    }
  }
  return null;
}

export function deriveOutlineFromStoredContent(
  contentMd: string,
  structure: unknown,
): {
  normalizedContentMd: string;
  volumes: OutlineGenVolume[];
  chapters: OutlineGenChapter[];
} {
  const storedVolumes = extractOutlineVolumes(structure);
  const parsedStoredChapters = extractOutlineChapters(structure);
  const storedChapters = parsedStoredChapters.length > 0
    ? parsedStoredChapters
    : synthesizeCompatChapters(storedVolumes);
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
