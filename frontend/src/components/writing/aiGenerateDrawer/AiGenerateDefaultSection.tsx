import type { Dispatch, SetStateAction } from "react";

import type { Character } from "../../../types";
import type { GenerateForm } from "../types";
import { AI_GENERATE_DRAWER_COPY } from "./aiGenerateDrawerCopy";
import { AI_GENERATE_CONTEXT_TOGGLES, type ContextToggleKey, type WritingStyle } from "./aiGenerateDrawerModels";

type Props = {
  generating: boolean;
  genForm: GenerateForm;
  setGenForm: Dispatch<SetStateAction<GenerateForm>>;
  characters: Character[];
  entries: { id: string; title: string; tags: string[] }[];
  stylesLoading: boolean;
  presets: WritingStyle[];
  userStyles: WritingStyle[];
  styleHelperText: string;
};

export function AiGenerateDefaultSection(props: Props) {
  const selectedCharacterIds = new Set(props.genForm.context.character_ids);
  const selectedEntryIds = new Set(props.genForm.context.entry_ids);
  const allEntriesSelected = props.entries.length > 0 && props.entries.every((entry) => selectedEntryIds.has(entry.id));

  const updateContextToggle = (key: ContextToggleKey, checked: boolean) => {
    props.setGenForm((current) => ({
      ...current,
      context: { ...current.context, [key]: checked },
    }));
  };

  return (
    <>
      <div className="panel p-3">
        <div className="text-sm font-medium text-ink">{AI_GENERATE_DRAWER_COPY.basicSection.title}</div>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.basicSection.instructionLabel}</span>
            <textarea
              className="textarea atelier-content"
              disabled={props.generating}
              name="instruction"
              rows={5}
              value={props.genForm.instruction}
              onChange={(event) => {
                const value = event.target.value;
                props.setGenForm((current) => ({ ...current, instruction: value }));
              }}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.basicSection.targetWordCountLabel}</span>
            <input
              className="input"
              disabled={props.generating}
              min={100}
              name="target_word_count"
              type="number"
              value={props.genForm.target_word_count ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.valueAsNumber;
                props.setGenForm((current) => ({
                  ...current,
                  target_word_count: Number.isNaN(next) ? null : next,
                }));
              }}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.basicSection.styleLabel}</span>
            <select
              className="select"
              disabled={props.generating || props.stylesLoading}
              name="style_id"
              value={props.genForm.style_id ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                props.setGenForm((current) => ({ ...current, style_id: value || null }));
              }}
              aria-label="gen_style_id"
            >
              <option value="">{AI_GENERATE_DRAWER_COPY.basicSection.styleAutoOption}</option>
              <optgroup label={AI_GENERATE_DRAWER_COPY.basicSection.systemStylesLabel}>
                {props.presets.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={AI_GENERATE_DRAWER_COPY.basicSection.userStylesLabel}>
                {props.userStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="text-[11px] text-subtext">{props.styleHelperText}</div>
          </label>
        </div>
      </div>

      <div className="panel p-3">
        <details>
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink">
            <span>{AI_GENERATE_DRAWER_COPY.memorySection.title}</span>
            <span className="text-xs text-subtext">
              {props.genForm.memory_injection_enabled ? "已开启" : "已关闭"}
            </span>
          </summary>

          <div className="mt-3 grid gap-3">
            <div className="grid gap-1">
              <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.memorySection.previousModeLabel}</div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-ink">
                  <input
                    className="radio"
                    type="radio"
                    name="previous_mode"
                    checked={props.genForm.previous_mode === "full"}
                    disabled={props.generating}
                    onChange={() => {
                      props.setGenForm((current) => ({ ...current, previous_mode: "full" as const }));
                    }}
                  />
                  {AI_GENERATE_DRAWER_COPY.memorySection.previousModeFull}
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink">
                  <input
                    className="radio"
                    type="radio"
                    name="previous_mode"
                    checked={props.genForm.previous_mode === "summary"}
                    disabled={props.generating}
                    onChange={() => {
                      props.setGenForm((current) => ({ ...current, previous_mode: "summary" as const }));
                    }}
                  />
                  {AI_GENERATE_DRAWER_COPY.memorySection.previousModeSummary}
                </label>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm text-ink">
              <span>{AI_GENERATE_DRAWER_COPY.memorySection.ragLabel}</span>
              <input
                className="checkbox"
                type="checkbox"
                checked={props.genForm.rag_enabled}
                disabled={props.generating}
                onChange={(event) => {
                  const checked = event.target.checked;
                  props.setGenForm((current) => ({ ...current, rag_enabled: checked }));
                }}
              />
            </label>
          </div>
        </details>
      </div>

      <div className="panel p-3">
        <div className="text-sm font-medium text-ink">{AI_GENERATE_DRAWER_COPY.contextSection.title}</div>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2">
            <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.injectionLabel}</div>
            {AI_GENERATE_CONTEXT_TOGGLES.map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  className="checkbox"
                  checked={props.genForm.context[toggle.key]}
                  disabled={props.generating}
                  name={toggle.inputName}
                  onChange={(event) => updateContextToggle(toggle.key, event.target.checked)}
                  type="checkbox"
                />
                {toggle.label}
              </label>
            ))}
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.charactersLabel}</div>
            {props.characters.length === 0 ? (
              <div className="text-sm text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.charactersEmpty}</div>
            ) : null}
            <div className="max-h-40 overflow-auto rounded-atelier border border-border bg-surface p-2">
              {props.characters.map((character) => (
                <label key={character.id} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
                  <input
                    className="checkbox"
                    checked={selectedCharacterIds.has(character.id)}
                    disabled={props.generating}
                    name={`character_${character.id}`}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      props.setGenForm((current) => {
                        const next = new Set(current.context.character_ids);
                        if (checked) next.add(character.id);
                        else next.delete(character.id);
                        return {
                          ...current,
                          context: { ...current.context, character_ids: Array.from(next) },
                        };
                      });
                    }}
                    type="checkbox"
                  />
                  <span className="truncate">{character.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.entriesLabel}</div>
              {props.entries.length > 0 ? (
                <button
                  className="btn btn-ghost px-2 py-1 text-xs"
                  disabled={props.generating}
                  onClick={() => {
                    props.setGenForm((current) => ({
                      ...current,
                      context: {
                        ...current.context,
                        entry_ids: allEntriesSelected ? [] : props.entries.map((entry) => entry.id),
                      },
                    }));
                  }}
                  type="button"
                >
                  {allEntriesSelected ? "取消全选" : "全选"}
                </button>
              ) : null}
            </div>
            {props.entries.length === 0 ? (
              <div className="text-sm text-subtext">{AI_GENERATE_DRAWER_COPY.contextSection.entriesEmpty}</div>
            ) : null}
            <div className="max-h-40 overflow-auto rounded-atelier border border-border bg-surface p-2">
              {props.entries.map((entry) => (
                <label key={entry.id} className="flex items-center gap-2 px-2 py-1 text-sm text-ink">
                  <input
                    className="checkbox"
                    checked={selectedEntryIds.has(entry.id)}
                    disabled={props.generating}
                    name={`entry_${entry.id}`}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      props.setGenForm((current) => {
                        const next = new Set(current.context.entry_ids);
                        if (checked) next.add(entry.id);
                        else next.delete(entry.id);
                        return {
                          ...current,
                          context: { ...current.context, entry_ids: Array.from(next) },
                        };
                      });
                    }}
                    type="checkbox"
                  />
                  <span className="truncate">{entry.title}</span>
                  {entry.tags.length > 0 ? (
                    <span className="ml-auto shrink-0 text-[10px] text-subtext">{entry.tags.join("·")}</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
