import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_LLM_FORM } from "../../../pages/prompts/models";
import { ModelSelectorCard } from "./ModelSelectorCard";

describe("ModelSelectorCard", () => {
  it("disables reload button and exposes tooltip when actions are blocked", () => {
    const html = renderToStaticMarkup(
      <ModelSelectorCard
        actionBlockedReason="请先绑定主模块 profile。"
        form={DEFAULT_LLM_FORM}
        modelList={{ loading: false, options: [], warning: null, error: null, requestId: null }}
        modelListHelpText="当前不可拉取模型列表：请先绑定主模块 profile。"
        moduleId="main-module"
        saving={false}
        setForm={() => undefined}
        onReloadModels={() => undefined}
      />,
    );

    expect(html).toMatch(
      /<button(?=[^>]*class="btn btn-secondary px-3 py-2 text-xs")(?=[^>]*disabled="")(?=[^>]*title="请先绑定主模块 profile。")[^>]*>拉取模型列表<\/button>/,
    );
  });
});
