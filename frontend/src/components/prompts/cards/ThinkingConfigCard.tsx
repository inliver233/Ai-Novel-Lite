import type { ThinkingConfigCardProps } from "./cardTypes";
import { SliderInput } from "./SliderInput";

export function ThinkingConfigCard(props: ThinkingConfigCardProps) {
  const isOpenAiProvider = props.form.provider === "openai" || props.form.provider === "openai_compatible";
  const isResponsesProvider =
    props.form.provider === "openai_responses" || props.form.provider === "openai_responses_compatible";
  const isAnthropicProvider = props.form.provider === "anthropic";
  const isGeminiProvider = props.form.provider === "gemini";

  return (
    <section className="surface border border-border p-4 rounded-atelier" aria-label="推理配置">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-ink">推理配置</div>
        <div className="text-xs text-subtext">配置模型思考与推理参数（按服务商自动显示）</div>
      </div>

      {isOpenAiProvider ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">reasoning_effort</span>
            <select
              className="select"
              disabled={props.saving}
              value={props.form.reasoning_effort}
              onChange={(event) => {
                const value = event.currentTarget.value;
                props.setForm((prev) => ({ ...prev, reasoning_effort: value }));
              }}
            >
              <option value="">默认</option>
              <option value="minimal">minimal</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
      ) : null}

      {isResponsesProvider ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">reasoning_effort</span>
            <select
              className="select"
              disabled={props.saving}
              value={props.form.reasoning_effort}
              onChange={(event) => {
                const value = event.currentTarget.value;
                props.setForm((prev) => ({ ...prev, reasoning_effort: value }));
              }}
            >
              <option value="">默认</option>
              <option value="minimal">minimal</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">text_verbosity</span>
            <select
              className="select"
              disabled={props.saving}
              value={props.form.text_verbosity}
              onChange={(event) => {
                const value = event.currentTarget.value;
                props.setForm((prev) => ({ ...prev, text_verbosity: value }));
              }}
            >
              <option value="">默认</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
      ) : null}

      {isAnthropicProvider ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              checked={props.form.anthropic_thinking_enabled}
              disabled={props.saving}
              type="checkbox"
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                props.setForm((prev) => ({ ...prev, anthropic_thinking_enabled: checked }));
              }}
            />
            <span className="text-sm text-ink">启用 thinking</span>
          </label>

          <SliderInput
            className="md:col-span-1"
            disabled={props.saving || !props.form.anthropic_thinking_enabled}
            hint={props.form.anthropic_thinking_enabled ? undefined : "启用后可设置思考预算"}
            label="thinking.budget_tokens"
            max={32768}
            min={128}
            step={128}
            value={props.form.anthropic_thinking_budget_tokens}
            onChange={(value) => props.setForm((prev) => ({ ...prev, anthropic_thinking_budget_tokens: value }))}
          />
        </div>
      ) : null}

      {isGeminiProvider ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SliderInput
            disabled={props.saving}
            label="thinkingConfig.thinkingBudget"
            max={32768}
            min={128}
            step={128}
            value={props.form.gemini_thinking_budget}
            onChange={(value) => props.setForm((prev) => ({ ...prev, gemini_thinking_budget: value }))}
          />

          <label className="flex items-center gap-2">
            <input
              checked={props.form.gemini_include_thoughts}
              disabled={props.saving}
              type="checkbox"
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                props.setForm((prev) => ({ ...prev, gemini_include_thoughts: checked }));
              }}
            />
            <span className="text-sm text-ink">thinkingConfig.includeThoughts</span>
          </label>
        </div>
      ) : null}

      {!isOpenAiProvider && !isResponsesProvider && !isAnthropicProvider && !isGeminiProvider ? (
        <div className="mt-4 text-xs text-subtext">当前服务商暂无专属推理配置</div>
      ) : null}
    </section>
  );
}
