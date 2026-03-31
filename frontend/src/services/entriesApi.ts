import type { Entry } from "../types";
import { apiJson } from "./apiClient";

export type EntryItem = Entry;

export type EntryListResponse = {
  items: EntryItem[];
  next_offset: number | null;
};

export async function listEntries(
  projectId: string,
  opts?: { tag?: string; limit?: number; offset?: number },
): Promise<EntryListResponse> {
  const params = new URLSearchParams();
  if (opts?.tag) params.set("tag", opts.tag);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const url = `/api/projects/${encodeURIComponent(projectId)}/entries${qs ? `?${qs}` : ""}`;
  const res = await apiJson<EntryListResponse>(url);
  return res.data;
}

export async function createEntry(
  projectId: string,
  body: { title: string; content?: string; tags?: string[] },
): Promise<EntryItem> {
  const res = await apiJson<{ entry: EntryItem }>(`/api/projects/${encodeURIComponent(projectId)}/entries`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data.entry;
}

export async function updateEntry(
  entryId: string,
  body: { title?: string; content?: string; tags?: string[] },
): Promise<EntryItem> {
  const res = await apiJson<{ entry: EntryItem }>(`/api/entries/${encodeURIComponent(entryId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.data.entry;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await apiJson(`/api/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
}
