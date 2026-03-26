import { type Page } from "@playwright/test";
import { test, expect } from "../../lib/ui-test";

import { bootstrapProject } from "../../lib/bootstrap";
import { loadState } from "../../lib/state";

async function stabilizeUi(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function hideWritingUpdatedAt(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("div")) {
      const text = (el.textContent || "").trim();
      if (!text.startsWith("updated_at:")) continue;
      el.remove();
    }
  });
}

test("ui: visual smoke (update with --update-snapshots)", async ({ page, request }) => {
  const state = loadState();
  const { projectId } = await bootstrapProject(request);

  await page.setViewportSize({ width: 1280, height: 720 });

  // Make the dashboard stable: keep a single project so the page height/layout is deterministic.
  const projectsRes = await request.get(`${state.backendUrl}/api/projects`);
  const projectsJson = (await projectsRes.json()) as { ok: boolean; data: { projects: Array<{ id: string }> } };
  for (const p of projectsJson.data.projects) {
    if (p.id === projectId) continue;
    await request.delete(`${state.backendUrl}/api/projects/${p.id}`);
  }

  await page.goto("/");
  await stabilizeUi(page);
  await expect(page.getByRole("button", { name: /E2E Project 类型：Test/ })).toBeVisible();
  await expect(page.getByText("计算完成度...", { exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot("dashboard.png");

  await page.goto(`/projects/${projectId}/outline`);
  await stabilizeUi(page);
  await expect(page.getByText("当前大纲", { exact: true })).toBeVisible();
  await expect(page.locator('select[name="active_outline_id"]')).toHaveValue(/.+/);
  await expect(page).toHaveScreenshot("outline.png");

  await page.goto(`/projects/${projectId}/writing`);
  await stabilizeUi(page);
  await expect(page.getByText("请选择或新建章节开始写作。", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("writing-empty.png");

  await page.goto(`/projects/${projectId}/prompt-studio`);
  await stabilizeUi(page);
  await expect(page.getByText("提示词工作室（beta）", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("prompt-studio.png");

  await page.goto(`/projects/${projectId}/settings`);
  await stabilizeUi(page);
  await expect(page.getByText("项目信息", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("settings.png");

  // Additional visual baselines: Search / Writing.
  const token = `VISUAL_${Date.now()}`;

  const createChapterRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/chapters`, {
    data: { number: 1, title: "Visual Chapter", plan: "Visual plan", status: "drafting" },
  });
  expect(createChapterRes.ok()).toBeTruthy();
  const createChapterJson = (await createChapterRes.json()) as { ok: boolean; data: { chapter: { id: string } } };
  const chapterId = createChapterJson.data.chapter.id;

  const contentMd = [
    "# Visual Chapter",
    "",
    // Make the editor area scrollable (helps catch scrollbar/overflow regressions).
    ...Array.from({ length: 48 }, (_, i) => `line_${i + 1}: ${token}`),
    "",
  ].join("\n");
  const putRes = await request.put(`${state.backendUrl}/api/chapters/${chapterId}`, {
    data: { content_md: contentMd, status: "drafting" },
  });
  expect(putRes.ok()).toBeTruthy();

  // Wait until search index can find the chapter content (inline queue executes async in a background worker).
  await expect
    .poll(
      async () => {
        const res = await request.post(`${state.backendUrl}/api/projects/${projectId}/search/query`, {
          data: { q: token, limit: 20, offset: 0 },
        });
        if (!res.ok()) return 0;
        const json = (await res.json()) as { ok: boolean; data: { items?: Array<{ source_type: string }> } };
        return (json.data.items || []).length;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);

  await page.goto(`/projects/${projectId}/search`);
  const queryInput = page.getByLabel("search_query", { exact: true });
  await expect(queryInput).toBeVisible();
  await queryInput.fill(token);
  await page.getByLabel("search_submit", { exact: true }).click();
  const results = page.getByLabel("search_results", { exact: true });
  await expect.poll(async () => await results.locator(".panel").count()).toBeGreaterThan(0);
  await stabilizeUi(page);
  await expect(page.locator("main")).toHaveScreenshot("search.png");

  await page.goto(`/projects/${projectId}/writing?chapterId=${chapterId}`);
  await expect(page.locator('textarea[name=\"content_md\"]')).toContainText(token);
  await stabilizeUi(page);
  await hideWritingUpdatedAt(page);
  await expect(page.locator("main")).toHaveScreenshot("writing.png");
});
