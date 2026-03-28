import type { LLMProvider } from "../../../types";

import type { ModelSelectorCardProps } from "./cardTypes";

const PROVIDER_OPTIONS: Array<{ value: LLMProvider; label: string }> = [
  { value: "openai", label: "openai（官方）" },
  { value: "openai_responses", label: "openai_responses（官方 /v1/responses）" },
  { value: "openai_compatible", label: "openai_compatible（中转/本地）" },
  { value: "openai_responses_compatible", label: "openai_responses_compatible（中转 /v1/responses）" },
  { value: "anthropic", label: "anthropic（Claude）" },
  { value: "gemini", label: "gemini" },
];

function providerLabel(provider: LLMProvider): string {
  if (provider === "openai") return "OpenAI Chat";
  if (provider === "openai_responses") return "OpenAI Responses";
  if (provider === "openai_compatible") return "OpenAI Compatible Chat";
  if (provider === "openai_responses_compatible") return "OpenAI Compatible Responses";
  if (provider === "anthropic") return "Anthropic";
  return "Gemini";
}

export function ModelSelectorCard(props: ModelSelectorCardProps) {
  const datalistId = `${props.moduleId}_models`;
  const isCompatibleProvider =
    props.form.provider === "openai_compatible" || props.form.provider === "openai_responses_compatible";

  return (
    <section className="surface rounded-atelier border border-border p-4" aria-label="模型选择">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-ink">模型选择</div>
        <div className="text-xs text-subtext">选择服务商、模型和接口地址</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">服务商（provider）</span>
          <select
            className="select"
            disabled={props.saving}
            name={`${props.moduleId}_provider`}
            value={props.form.provider}
            onChange={(event) => {
              const provider = event.currentTarget.value as LLMProvider;
              props.setForm((value) => ({
                ...value,
                provider: provider,
                max_tokens: "",
                text_verbosity: "",
                reasoning_effort: "",
                anthropic_thinking_enabled: false,
                anthropic_thinking_budget_tokens: "",
                gemini_thinking_budget: "",
                gemini_include_thoughts: false,
              }));
            }}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-subtext">
            当前：{providerLabel(props.form.provider)}。兼容网关通常需要可访问的 `base_url`。
          </div>
        </label>

        <label className="grid gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-subtext">模型（model）</span>
            <button
              className="btn btn-secondary px-3 py-2 text-xs"
              disabled={props.modelList.loading || Boolean(props.actionBlockedReason)}
              onClick={props.onReloadModels}
              title={props.actionBlockedReason ?? undefined}
              type="button"
            >
              {props.modelList.loading ? "拉取中..." : "拉取模型列表"}
            </button>
          </div>
          <input
            className="input"
            disabled={props.saving}
            list={datalistId}
            name={`${props.moduleId}_model`}
            value={props.form.model}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              props.setForm((value) => ({ ...value, model: nextValue }));
            }}
          />
          <datalist id={datalistId}>
            {props.modelList.options.map((option) => (
              <option key={`${props.moduleId}-${option.id}`} value={option.id}>
                {option.display_name}
              </option>
            ))}
          </datalist>
          <div className="text-[11px] text-subtext">{props.modelListHelpText}</div>
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs text-subtext">接口地址（base_url）</span>
          <input
            className="input"
            disabled={props.saving}
            name={`${props.moduleId}_base_url`}
            placeholder={isCompatibleProvider ? "https://your-gateway.example.com/v1" : undefined}
            value={props.form.base_url}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              props.setForm((value) => ({ ...value, base_url: nextValue }));
            }}
          />
          <div className="text-[11px] text-subtext">
            OpenAI / OpenAI-compatible 一般包含 `/v1`；Anthropic/Gemini 一般为 host。
          </div>
        </label>
      </div>
    </section>
  );
}
