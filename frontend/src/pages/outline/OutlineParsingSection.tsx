import clsx from "clsx";

import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";

import { OUTLINE_COPY } from "./outlineCopy";
import { OUTLINE_PARSING_COPY } from "./outlineParsingCopy";
import type { OutlineParseAgentConfig, OutlineParseForm, OutlineParseProgress, OutlineParseResult } from "./outlineParsingModels";

type ParseTab = "outline" | "characters" | "entries";

export type OutlineParsingModalProps = {
  open: boolean;
  parsing: boolean;
  parseForm: OutlineParseForm;
  parseProgress: OutlineParseProgress | null;
  parseResult: OutlineParseResult | null;
  activeTab: ParseTab;
  onClose: () => void;
  onCancelParse: () => void;
  onContentChange: (value: string) => void;
  onFileUpload: (file: File | null) => void;
  onAgentConfigChange: (patch: Partial<OutlineParseAgentConfig>) => void;
  onStartParse: () => void;
  onTabChange: (tab: ParseTab) => void;
  onApplyOutline: () => void;
  onApplyCharacters: () => void;
  onApplyEntries: () => void;
  onApplyAll: () => void;
};

function safeCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function OutlineParsingModal(props: OutlineParsingModalProps) {
  const chapterCount = safeCount(props.parseResult?.outline?.chapters);
  const characterCount = safeCount(props.parseResult?.characters);
  const entryCount = safeCount(props.parseResult?.entries);

  const canStartParse = Boolean(props.parseForm.content.trim() || props.parseForm.file_content);
  const canApplyOutline = Boolean(props.parseResult);
  const canApplyCharacters = Boolean(props.parseResult && characterCount > 0);
  const canApplyEntries = Boolean(props.parseResult && entryCount > 0);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      panelClassName="surface max-w-3xl p-6"
      ariaLabel={OUTLINE_PARSING_COPY.parseTitle}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-content text-2xl">{OUTLINE_PARSING_COPY.parseTitle}</div>
          <div className="mt-1 text-xs text-subtext">{OUTLINE_PARSING_COPY.parseHint}</div>
        </div>
        <button className="btn btn-secondary" onClick={props.onClose} type="button">
          {OUTLINE_COPY.close}
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">{OUTLINE_PARSING_COPY.parseInputLabel}</span>
          <textarea
            className="textarea atelier-content min-h-[180px] resize-y"
            disabled={props.parsing}
            name="outline_parse_content"
            value={props.parseForm.content}
            onChange={(event) => props.onContentChange(event.target.value)}
            placeholder={OUTLINE_PARSING_COPY.parseInputPlaceholder}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">{OUTLINE_PARSING_COPY.parseFileLabel}</span>
          <input
            className="input"
            disabled={props.parsing}
            type="file"
            accept={OUTLINE_PARSING_COPY.parseFileAccept}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              props.onFileUpload(file);
            }}
          />
          <div className="text-[11px] text-subtext">
            {OUTLINE_PARSING_COPY.parseFileHint}
            {props.parseForm.file_name ? `：${props.parseForm.file_name}` : ""}
          </div>
        </label>

        <details className="rounded-atelier border border-border bg-canvas p-4">
          <summary className="ui-transition-fast cursor-pointer text-sm text-ink hover:text-ink">
            {OUTLINE_PARSING_COPY.parseAdvancedTitle}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-subtext">{OUTLINE_PARSING_COPY.parseContextTokens}</span>
              <input
                className="input"
                disabled={props.parsing}
                type="number"
                min={8000}
                name="max_context_tokens"
                value={props.parseForm.agent_config.max_context_tokens}
                onChange={(event) =>
                  props.onAgentConfigChange({ max_context_tokens: Math.max(1, Number(event.target.value)) })
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-subtext">{OUTLINE_PARSING_COPY.parseTimeout}</span>
              <input
                className="input"
                disabled={props.parsing}
                type="number"
                min={60}
                name="timeout_seconds"
                value={props.parseForm.agent_config.timeout_seconds}
                onChange={(event) =>
                  props.onAgentConfigChange({ timeout_seconds: Math.max(1, Number(event.target.value)) })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-3">
              <input
                className="checkbox"
                disabled={props.parsing}
                checked={props.parseForm.agent_config.parallel_extraction}
                name="parallel_extraction"
                onChange={(event) => props.onAgentConfigChange({ parallel_extraction: event.target.checked })}
                type="checkbox"
              />
              {OUTLINE_PARSING_COPY.parseParallel}
            </label>
          </div>
        </details>
      </div>

      {props.parseProgress ? (
        <div className="panel mt-4 p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-subtext">
            <span className="truncate">{props.parseProgress.message}</span>
            <span className="shrink-0">{props.parseProgress.progress}%</span>
          </div>
          <ProgressBar ariaLabel="大纲解析进度" value={props.parseProgress.progress} />
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        {props.parsing || props.parseProgress?.status === "processing" ? (
          <button className="btn btn-secondary" onClick={props.onCancelParse} type="button">
            {OUTLINE_PARSING_COPY.parseCancelButton}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          disabled={props.parsing || !canStartParse}
          onClick={props.onStartParse}
          type="button"
        >
          {props.parsing ? OUTLINE_PARSING_COPY.parsingButton : OUTLINE_PARSING_COPY.parseButton}
        </button>
      </div>

      {props.parseResult ? (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-ink">{OUTLINE_PARSING_COPY.parseResultTitle}</div>
              {props.parseResult.warnings?.length ? (
                <div className="mt-1 text-xs text-danger">{props.parseResult.warnings.join("；")}</div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={clsx(props.activeTab === "outline" ? "btn btn-primary" : "btn btn-secondary")}
                onClick={() => props.onTabChange("outline")}
                type="button"
              >
                {OUTLINE_PARSING_COPY.parseResultOutline} ({chapterCount})
              </button>
              <button
                className={clsx(props.activeTab === "characters" ? "btn btn-primary" : "btn btn-secondary")}
                onClick={() => props.onTabChange("characters")}
                type="button"
              >
                {OUTLINE_PARSING_COPY.parseResultCharacters} ({characterCount})
              </button>
              <button
                className={clsx(props.activeTab === "entries" ? "btn btn-primary" : "btn btn-secondary")}
                onClick={() => props.onTabChange("entries")}
                type="button"
              >
                {OUTLINE_PARSING_COPY.parseResultEntries} ({entryCount})
              </button>
            </div>
          </div>

          <div className="rounded-atelier border border-border bg-canvas p-4">
            {props.activeTab === "outline" ? (
              chapterCount > 0 ? (
                <div className="grid gap-2">
                  {props.parseResult.outline.chapters.map((chapter) => (
                    <div key={`${chapter.number}-${chapter.title}`} className="panel p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-ink">
                            {chapter.number}. {chapter.title || "（未命名章节）"}
                          </div>
                          <div className="mt-1 text-[11px] text-subtext">beats: {chapter.beats?.length ?? 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-subtext">未解析到章节结构。</div>
              )
            ) : null}

            {props.activeTab === "characters" ? (
              characterCount > 0 ? (
                <div className="grid gap-2">
                  {props.parseResult.characters.map((c) => (
                    <div key={c.name} className="panel p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-ink">{c.name}</div>
                          <div className="mt-1 text-[11px] text-subtext">{c.role ? `角色：${c.role}` : "角色：—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-subtext">未解析到角色信息。</div>
              )
            ) : null}

            {props.activeTab === "entries" ? (
              entryCount > 0 ? (
                <div className="grid gap-2">
                  {props.parseResult.entries.map((e) => (
                    <div key={e.title} className="panel p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{e.title}</div>
                        <div className="mt-1 text-[11px] text-subtext">
                          tags: {Array.isArray(e.tags) && e.tags.length ? e.tags.join(" / ") : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-subtext">未解析到条目信息。</div>
              )
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn btn-secondary" disabled={!canApplyOutline} onClick={props.onApplyOutline} type="button">
              {OUTLINE_PARSING_COPY.parseApplyOutline}
            </button>
            <button
              className="btn btn-secondary"
              disabled={!canApplyCharacters}
              onClick={props.onApplyCharacters}
              type="button"
            >
              {OUTLINE_PARSING_COPY.parseApplyCharacters}
            </button>
            <button className="btn btn-secondary" disabled={!canApplyEntries} onClick={props.onApplyEntries} type="button">
              {OUTLINE_PARSING_COPY.parseApplyEntries}
            </button>
            <button className="btn btn-primary" disabled={!props.parseResult} onClick={props.onApplyAll} type="button">
              {OUTLINE_PARSING_COPY.parseApplyAll}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

