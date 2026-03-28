import { useCallback, useMemo } from "react";

import type { AdvancedConfigCardProps } from "./cardTypes";

function getJsonParseErrorPosition(message: string): number | null {
  const match = message.match(/\bposition\s+(\d+)\b/i);
  if (!match) return null;
  const position = Number(match[1]);
  return Number.isFinite(position) ? position : null;
}

function getLineAndColumnFromPosition(text: string, position: number): { line: number; column: number } | null {
  if (!Number.isFinite(position) || position < 0 || position > text.length) return null;

  const before = text.slice(0, position);
  const lines = before.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function validateExtraJson(
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string; position?: number; line?: number; column?: number } {
  const trimmed = (raw ?? "").trim();
  const effective = trimmed ? raw : "{}";

  try {
    return { ok: true, value: JSON.parse(effective) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = getJsonParseErrorPosition(message);
    const lineAndColumn = position !== null ? getLineAndColumnFromPosition(effective, position) : null;

    return {
      ok: false,
      message,
      ...(position !== null ? { position } : {}),
      ...(lineAndColumn ?? {}),
    };
  }
}

export function AdvancedConfigCard(props: AdvancedConfigCardProps) {
  const extraValidation = useMemo(() => validateExtraJson(props.form.extra), [props.form.extra]);
  const extraErrorText = extraValidation.ok
    ? ""
    : `extra JSON 无效${extraValidation.line ? `（第 ${extraValidation.line} 行，第 ${extraValidation.column ?? 1} 列）` : ""}：${extraValidation.message}`;

  const handleFormatExtra = useCallback(() => {
    const parsed = validateExtraJson(props.form.extra);
    if (!parsed.ok) return;

    props.setForm((previous) => ({
      ...previous,
      extra: JSON.stringify(parsed.value, null, 2),
    }));
  }, [props.form.extra, props.setForm]);

  return (
    <section className="surface border border-border p-4 rounded-atelier" aria-label="高级配置">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-ink">高级配置</div>
        <div className="text-xs text-subtext">扩展参数与自定义 JSON</div>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">stop（逗号分隔）</span>
          <input
            className="input"
            disabled={props.saving}
            value={props.form.stop}
            onChange={(event) => {
              const value = event.currentTarget.value;
              props.setForm((previous) => ({ ...previous, stop: value }));
            }}
          />
        </label>

        <label className="grid gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-subtext">extra（JSON，高级扩展）</span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={props.saving || !extraValidation.ok}
              onClick={handleFormatExtra}
              type="button"
            >
              一键格式化
            </button>
          </div>
          <textarea
            className="textarea atelier-mono"
            disabled={props.saving}
            rows={6}
            value={props.form.extra}
            onChange={(event) => {
              const value = event.currentTarget.value;
              props.setForm((previous) => ({ ...previous, extra: value }));
            }}
          />
          <div className="text-[11px] text-subtext">
            保留自定义 provider 字段；推理参数建议优先用上面的结构化控件。
          </div>
          {extraErrorText ? <div className="text-xs text-warning">{extraErrorText}</div> : null}
        </label>
      </div>
    </section>
  );
}
