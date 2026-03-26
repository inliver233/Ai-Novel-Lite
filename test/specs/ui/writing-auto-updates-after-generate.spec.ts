import { test, expect } from "../../lib/ui-test";

import { bootstrapProject } from "../../lib/bootstrap";
import { loadState } from "../../lib/state";

type ApiOk<T> = { ok: true; data: T; request_id: string };

test("ui: writing generate -> save -> trigger remaining background tasks", async ({ page, request }) => {
  const state = loadState();
  const { projectId } = await bootstrapProject(request);

  const createChapterRes = await request.post(`${state.backendUrl}/api/projects/${projectId}/chapters`, {
    data: { number: 1, title: "E2E 无感更新", plan: "" },
  });
  expect(createChapterRes.ok()).toBeTruthy();
  const createChapterJson = (await createChapterRes.json()) as { ok: boolean; data: { chapter: { id: string } } };
  const chapterId = createChapterJson.data.chapter.id;

  await page.goto(`/projects/${projectId}/writing?chapterId=${chapterId}`);
  await expect(page.getByRole("textbox", { name: "标题", exact: true })).toHaveValue("E2E 无感更新", { timeout: 60_000 });

  await page.getByRole("button", { name: "AI 生成", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "AI 生成" });
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "生成", exact: true }).click();

  const content = page.locator('textarea[name="content_md"]');
  await expect(content).not.toHaveValue("", { timeout: 60_000 });

  await drawer.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(drawer).toBeHidden();

  const saveAndTrigger = page.getByRole("button", { name: "一键保存并触发更新", exact: true });
  await expect(saveAndTrigger).toBeEnabled();
  await saveAndTrigger.click();

  await expect(page.getByText("已保存并创建无感更新任务", { exact: true })).toBeVisible({ timeout: 60_000 });

  await expect
    .poll(
      async () => {
        const res = await request.get(`${state.backendUrl}/api/projects/${projectId}/tasks?limit=20`);
        if (!res.ok()) return false;
        const json = (await res.json()) as ApiOk<{ items: Array<{ kind?: string | null }> }>;
        const kinds = new Set((json.data?.items ?? []).map((item) => String(item?.kind ?? "")));
        return kinds.has("vector_rebuild") && kinds.has("search_rebuild");
      },
      { timeout: 60_000 },
    )
    .toBe(true);
});
