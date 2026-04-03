import { apiJson } from "./apiClient";

export type DetailedOutlineStatus = "planned" | "generating" | "done";

export type DetailedOutlineListItem = {
  id: string;
  outline_id: string;
  volume_number: number;
  volume_title: string;
  status: DetailedOutlineStatus;
  chapter_count: number;
  updated_at: string;
};

export type DetailedOutline = {
  id: string;
  outline_id: string;
  project_id: string;
  volume_number: number;
  volume_title: string;
  content_md: string | null;
  structure: unknown | null;
  status: DetailedOutlineStatus;
  created_at: string;
  updated_at: string;
};

export type DetailedOutlineGenerateRequest = {
  chapters_per_volume?: number | null;
  instruction?: string | null;
  context?: {
    include_world_setting?: boolean;
    include_characters?: boolean;
    include_style_guide?: boolean;
  };
};

export async function listDetailedOutlines(projectId: string, outlineId: string): Promise<DetailedOutlineListItem[]> {
  const res = await apiJson<{ detailed_outlines: DetailedOutlineListItem[] }>(
    `/api/projects/${projectId}/outlines/${outlineId}/detailed_outlines`,
  );
  return res.data.detailed_outlines;
}

export async function getDetailedOutline(id: string): Promise<DetailedOutline> {
  const res = await apiJson<{ detailed_outline: DetailedOutline }>(`/api/detailed_outlines/${id}`);
  return res.data.detailed_outline;
}

export async function updateDetailedOutline(
  id: string,
  data: { volume_title?: string; content_md?: string; structure?: unknown; status?: string },
): Promise<DetailedOutline> {
  const res = await apiJson<{ detailed_outline: DetailedOutline }>(`/api/detailed_outlines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data.detailed_outline;
}

export async function deleteDetailedOutline(id: string): Promise<void> {
  await apiJson<Record<string, never>>(`/api/detailed_outlines/${id}`, { method: "DELETE" });
}

export type DetailedOutlineBatchItem = {
  volume_number: number;
  volume_title: string;
  volume_summary: string;
  chapters: Record<string, unknown>[];
};

export async function batchCreateDetailedOutlines(
  projectId: string,
  outlineId: string,
  items: DetailedOutlineBatchItem[],
): Promise<{ count: number; ids: string[] }> {
  const res = await apiJson<{ count: number; ids: string[] }>(
    `/api/projects/${projectId}/outlines/${outlineId}/detailed_outlines/batch`,
    { method: "POST", body: JSON.stringify({ detailed_outlines: items }) },
  );
  return res.data;
}

export async function createChaptersFromDetailedOutline(
  id: string,
  replace = false,
): Promise<{ chapters: unknown[]; count: number }> {
  const params = new URLSearchParams();
  if (replace) params.set("replace", "true");
  const query = params.toString();
  const res = await apiJson<{ chapters: unknown[]; count: number }>(
    `/api/detailed_outlines/${id}/create_chapters${query ? `?${query}` : ""}`,
    { method: "POST" },
  );
  return res.data;
}

export type ChapterSkeletonGenerateRequest = {
  chapters_count?: number | null;
  instruction?: string | null;
  context?: {
    include_world_setting?: boolean;
    include_characters?: boolean;
    include_style_guide?: boolean;
  };
  replace_chapters?: boolean;
};
