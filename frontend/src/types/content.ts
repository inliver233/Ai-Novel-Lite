export type ChapterStatus = "planned" | "drafting" | "done";

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role?: string | null;
  profile?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface Entry {
  id: string;
  project_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Outline {
  id: string;
  project_id: string;
  title: string;
  content_md: string;
  structure?: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface OutlineListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  has_chapters: boolean;
}

export interface ChapterBase {
  id: string;
  project_id: string;
  outline_id: string;
  number: number;
  title?: string | null;
  status: ChapterStatus;
  updated_at: string;
}

export interface ChapterDetail extends ChapterBase {
  plan?: string | null;
  content_md?: string | null;
  summary?: string | null;
}

export type Chapter = ChapterDetail;

export interface ChapterListItem extends ChapterBase {
  has_plan: boolean;
  has_summary: boolean;
  has_content: boolean;
}

export interface ChapterMetaPage {
  chapters: ChapterListItem[];
  next_cursor: number | null;
  has_more: boolean;
  returned: number;
  total: number;
}

export interface CreateChapterInput {
  number: number;
  title?: string | null;
  plan?: string | null;
  status?: ChapterStatus;
}

export interface UpdateChapterInput {
  title?: string | null;
  plan?: string | null;
  content_md?: string | null;
  summary?: string | null;
  status?: ChapterStatus;
}

export interface BulkCreateChapterInput {
  chapters: Array<{
    number: number;
    title?: string | null;
    plan?: string | null;
  }>;
}
