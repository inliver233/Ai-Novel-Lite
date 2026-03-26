import { test, expect } from "../../lib/ui-test";

import { bootstrapProject } from "../../lib/bootstrap";
import { loadState } from "../../lib/state";

test("ui: global search hits multi-sources and can jump", async ({ page, request }) => {
  const state = loadState();
  const { projectId } = await bootstrapProject(request);

  const token = `e2esearch${Date.now()}`;
  const characterName = `E2E Search Char ${Date.now()}`;
  const importFilename = `e2e-import-${token}.txt`;

  const charRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/characters`, {
    data: {
      name: characterName,
      role: "test",
      profile: `profile ${token}`,
      notes: `notes ${token}`,
    },
  });
  expect(charRes.ok()).toBeTruthy();

  const outlineRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/outlines`, {
    data: { title: "E2E Search Outline", content_md: `Outline ${token}` },
  });
  expect(outlineRes.ok()).toBeTruthy();
  const outlineJson = (await outlineRes.json()) as { ok: boolean; data: { outline: { id: string } } };
  const outlineId = outlineJson.data.outline.id;

  const createChapterRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/chapters`, {
    data: { number: 1, title: "E2E Search Chapter", plan: "", status: "done" },
  });
  expect(createChapterRes.ok()).toBeTruthy();
  const createChapterJson = (await createChapterRes.json()) as { ok: boolean; data: { chapter: { id: string } } };
  const chapterId = createChapterJson.data.chapter.id;

  const chapterContent = `# E2E Search Chapter\n\n${token}\n`;
  const putRes = await request.put(`${state.backendUrl}/api/chapters/${chapterId}`, {
    data: { content_md: chapterContent, status: "done" },
  });
  expect(putRes.ok()).toBeTruthy();

  const storyRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/story_memories`, {
    data: {
      chapter_id: chapterId,
      memory_type: "event",
      title: "E2E story_memory",
      content: `Story memory ${token}`,
      importance_score: 0.1,
      tags: [token],
      story_timeline: 0,
      text_position: -1,
      text_length: 0,
      is_foreshadow: false,
    },
  });
  expect(storyRes.ok()).toBeTruthy();

  const importRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/imports`, {
    data: { filename: importFilename, content_text: `import ${token}`, content_type: "txt" },
  });
  expect(importRes.ok()).toBeTruthy();
  const importJson = (await importRes.json()) as { ok: boolean; data: { document: { id: string } } };
  const importDocId = importJson.data.document.id;

  // Trigger a rebuild after all data is present (imports do not schedule search rebuild directly).
  const triggerRes = await request.put(`${state.backendUrl}/api/projects/${projectId}/outlines/${encodeURIComponent(outlineId)}`, {
    data: { content_md: `Outline ${token} trigger` },
  });
  expect(triggerRes.ok()).toBeTruthy();

  const expectedTypes = [
    "chapter",
    "outline",
    "character",
    "story_memory",
    "source_document",
  ];
  await expect
    .poll(
      async () => {
        const q = await request.post(`${state.backendUrl}/api/projects/${projectId}/search/query`, {
          data: { q: token, limit: 200, offset: 0 },
        });
        if (!q.ok()) return false;
        const j = (await q.json()) as { ok: boolean; data: { items?: Array<{ source_type: string }> } };
        const items = j.data.items ?? [];
        const types = new Set(items.map((it) => String(it.source_type || "")));
        return expectedTypes.every((t) => types.has(t));
      },
      { timeout: 60_000 },
    )
    .toBe(true);

  const runSearch = async () => {
    await page.goto(`/projects/${projectId}/search`);
    const queryInput = page.getByLabel("search_query", { exact: true });
    await expect(queryInput).toBeVisible();

    // Atelier UI guardrails (avoid default blue / missing btn base class regressions).
    const clearBtn = page.getByLabel("search_clear", { exact: true });
    await expect(clearBtn).toHaveClass(/\bbtn\b/);
    await expect(clearBtn).toHaveClass(/\bbtn-secondary\b/);

    const submitBtn = page.getByLabel("search_submit", { exact: true });
    await expect(submitBtn).toHaveClass(/\bbtn\b/);
    await expect(submitBtn).toHaveClass(/\bbtn-primary\b/);

    const chapterSource = page.getByLabel("search_source_chapter", { exact: true });
    await expect(chapterSource).toHaveClass(/\bcheckbox\b/);
    await expect(chapterSource).toHaveAttribute("name", "search_source_chapter");

    const outlineSource = page.getByLabel("search_source_outline", { exact: true });
    await expect(outlineSource).toHaveClass(/\bcheckbox\b/);
    await expect(outlineSource).toHaveAttribute("name", "search_source_outline");

    await expect(page.getByLabel("search_source_source_document", { exact: true })).toHaveClass(/\bcheckbox\b/);

    await queryInput.fill(token);
    await page.getByLabel("search_submit", { exact: true }).click();

    const results = page.getByLabel("search_results", { exact: true });
    await expect.poll(async () => await results.locator(".panel").count()).toBeGreaterThanOrEqual(expectedTypes.length);

    const loadMore = page.getByLabel("search_load_more", { exact: true });
    if ((await loadMore.count()) > 0) {
      await expect(loadMore).toHaveClass(/\bbtn\b/);
      await expect(loadMore).toHaveClass(/\bbtn-secondary\b/);
    }
    return results;
  };

  // chapter -> writing
  const results1 = await runSearch();
  const chapterCard = results1.locator(".panel").filter({ hasText: "chapter" }).first();
  await expect(chapterCard).toBeVisible();
  await expect(chapterCard.getByLabel("search_copy_id", { exact: true })).toHaveClass(/\bbtn\b/);
  await expect(chapterCard.getByLabel("search_copy_id", { exact: true })).toHaveClass(/\bbtn-secondary\b/);
  await expect(chapterCard.getByLabel("search_copy_locator", { exact: true })).toHaveClass(/\bbtn\b/);
  await expect(chapterCard.getByLabel("search_copy_locator", { exact: true })).toHaveClass(/\bbtn-secondary\b/);
  await expect(chapterCard.getByLabel("search_copy_locator", { exact: true })).toBeEnabled();
  await expect(chapterCard.getByLabel("search_jump", { exact: true })).toHaveClass(/\bbtn\b/);
  await expect(chapterCard.getByLabel("search_jump", { exact: true })).toHaveClass(/\bbtn-primary\b/);
  await chapterCard.getByLabel("search_jump", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/writing\\?chapterId=${chapterId}$`));
  await expect(page.locator('textarea[name="content_md"]')).toContainText(token);

  // outline -> outline page
  const resultsOutline = await runSearch();
  const outlineCard = resultsOutline.locator(".panel").filter({ hasText: "outline" }).first();
  await expect(outlineCard).toBeVisible();
  await outlineCard.getByLabel("search_jump", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outline$`));

  // character -> characters list
  const results2 = await runSearch();
  const characterCard = results2.locator(".panel").filter({ hasText: characterName }).first();
  await expect(characterCard).toBeVisible();
  await characterCard.getByLabel("search_jump", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/characters$`));
  await expect(page.getByText(characterName, { exact: true })).toBeVisible();

  // story_memory -> no jump target after feature cleanup
  const resultsMem = await runSearch();
  const memCard = resultsMem.locator(".panel").filter({ hasText: "story_memory" }).first();
  await expect(memCard).toBeVisible();
  await expect(memCard.getByLabel("search_jump", { exact: true })).toBeDisabled();

  // source_document -> import page (auto-open docId)
  const resultsImport = await runSearch();
  const importCard = resultsImport.locator(".panel").filter({ hasText: "source_document" }).first();
  await expect(importCard).toBeVisible();
  await importCard.getByLabel("search_jump", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/import\\?docId=${importDocId}$`));
  await expect(page.getByRole("button", { name: new RegExp(importFilename.replaceAll(".", "\\.")) }).first()).toBeVisible();
});
