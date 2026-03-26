import type { ParameterTunerCardProps } from "./cardTypes";
import { SliderInput } from "./SliderInput";

function formatCapabilitiesHint(capabilities: ParameterTunerCardProps["capabilities"]): string {
  if (!capabilities) return "";

  const parts: string[] = [];
  if (capabilities.max_tokens_recommended) parts.push(`推荐 ${capabilities.max_tokens_recommended}`);
  if (capabilities.max_tokens_limit) parts.push(`上限 ${capabilities.max_tokens_limit}`);
  if (capabilities.context_window_limit) parts.push(`上下文 ${capabilities.context_window_limit}`);
  return parts.join(" · ");
}

export function ParameterTunerCard(props: ParameterTunerCardProps) {
  const tokenHint = formatCapabilitiesHint(props.capabilities);
  const showPenaltyInputs = props.form.provider === "openai" || props.form.provider === "openai_compatible";

  return (
    <section className="surface border border-border p-4 rounded-atelier" aria-label="参数调节">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-ink">参数调节</div>
        <div className="text-xs text-subtext">调节模型生成参数</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SliderInput
          disabled={props.saving}
          label="temperature"
          max={2}
          min={0}
          step={0.05}
          value={props.form.temperature}
          onChange={(value) => props.setForm((prev) => ({ ...prev, temperature: value }))}
        />
        <SliderInput
          disabled={props.saving}
          label="top_p"
          max={1}
          min={0}
          step={0.05}
          value={props.form.top_p}
          onChange={(value) => props.setForm((prev) => ({ ...prev, top_p: value }))}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">max_tokens / max_output_tokens</span>
          <input
            className="input"
            disabled={props.saving}
            type="text"
            value={props.form.max_tokens}
            onChange={(event) => props.setForm((prev) => ({ ...prev, max_tokens: event.currentTarget.value }))}
          />
          {tokenHint ? <div className="text-[11px] text-subtext">{tokenHint}</div> : null}
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">timeout_seconds (秒)</span>
          <input
            className="input"
            disabled={props.saving}
            type="text"
            value={props.form.timeout_seconds}
            onChange={(event) => props.setForm((prev) => ({ ...prev, timeout_seconds: event.currentTarget.value }))}
          />
        </label>

        {showPenaltyInputs ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs text-subtext">presence_penalty</span>
              <input
                className="input"
                disabled={props.saving}
                type="text"
                value={props.form.presence_penalty}
                onChange={(event) =>
                  props.setForm((prev) => ({ ...prev, presence_penalty: event.currentTarget.value }))
                }
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-subtext">frequency_penalty</span>
              <input
                className="input"
                disabled={props.saving}
                type="text"
                value={props.form.frequency_penalty}
                onChange={(event) =>
                  props.setForm((prev) => ({ ...prev, frequency_penalty: event.currentTarget.value }))
                }
              />
            </label>
          </>
        ) : (
          <label className="grid gap-1">
            <span className="text-xs text-subtext">top_k</span>
            <input
              className="input"
              disabled={props.saving}
              type="text"
              value={props.form.top_k}
              onChange={(event) => props.setForm((prev) => ({ ...prev, top_k: event.currentTarget.value }))}
            />
          </label>
        )}
      </div>
    </section>
  );
}
