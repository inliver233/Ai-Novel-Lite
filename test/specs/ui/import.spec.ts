import { test, expect } from "../../lib/ui-test";

import { bootstrapProject } from "../../lib/bootstrap";
import { loadState } from "../../lib/state";

test("ui: import page uploads and applies story_memory proposals", async ({ page, request }) => {
  const { projectId } = await bootstrapProject(request);
  const state = loadState();

  const filename = "import-demo.txt";
  const marker = "海边小镇";
  const content = `${marker}的灯塔\n这是导入测试内容，用于验证 story_memory 提案应用。`;

  await page.goto(`/projects/${projectId}/import`);
  await expect(page.getByText("导入小说/资料", { exact: true })).toBeVisible();

  const fileInput = page.getByLabel("import_file", { exact: true });
  await fileInput.setInputFiles({ name: filename, mimeType: "text/plain", buffer: Buffer.from(content, "utf-8") });

  await page.getByRole("button", { name: "开始导入", exact: true }).click();

  const docButton = page.getByRole("button", { name: new RegExp(filename.replaceAll(".", "\\.")) });
  await expect(docButton.first()).toBeVisible();
  await docButton.first().click();

  const applyStoryMemory = page.getByRole("button", { name: "应用到 story_memory", exact: true });

  await expect(docButton.first()).toContainText("完成");
  await expect(applyStoryMemory).toBeEnabled();

  await page.getByLabel("import_refresh", { exact: true }).click();
  await expect(docButton.first()).toBeVisible();
  await expect(docButton.first()).toContainText("完成");
  await expect(page.getByText("暂无导入记录。请先上传 txt/md 文件。", { exact: true })).toHaveCount(0);

  await expect(applyStoryMemory).toBeVisible();
  await page.getByRole("button", { name: "应用到 story_memory", exact: true }).click();

  const memPreview = await request.post(`${state.backendUrl}/api/projects/${projectId}/memory/preview`, {
    data: {
      query_text: marker,
      section_enabled: {
        story_memory: true,
        semantic_history: false,
        foreshadow_open_loops: false,
        structured: false,
      },
    },
  });
  expect(memPreview.ok()).toBeTruthy();
  const memJson = (await memPreview.json()) as any;
  expect(memJson.ok).toBe(true);
  const textMd = String(memJson.data?.story_memory?.text_md ?? "");
  expect(textMd).toContain(marker);
  expect(textMd).toContain("import_summary");
});
