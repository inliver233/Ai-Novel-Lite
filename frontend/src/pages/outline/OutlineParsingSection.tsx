import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Globe,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";

import { OUTLINE_COPY } from "./outlineCopy";
import { OUTLINE_PARSING_COPY } from "./outlineParsingCopy";
import {
  type AgentCardState,
  type AgentCardStatus,
  type OutlineParseAgentConfig,
  type OutlineParseForm,
  type OutlineParseProgress,
  type OutlineParseResult,
} from "./outlineParsingModels";

type ParseTab = "outline" | "characters" | "entries";

export type OutlineParsingModalProps = {
  open: boolean;
  parsing: boolean;
  parseForm: OutlineParseForm;
  parseProgress: OutlineParseProgress | null;
  parseResult: OutlineParseResult | null;
  agentCards: AgentCardState[];
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

/** Dynamic icon mapping based on agent type */
const AGENT_TYPE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  planner: Sparkles,
  structure: FileText,
  character: User,
  entry: Globe,
  detailed_outline: BarChart3,
  validation: CheckCircle2,
  repair: Wrench,
  default: BookOpen,
};

function getAgentIcon(card: AgentCardState): React.ComponentType<{ size?: number; className?: string }> {
  // Use agentType if available, otherwise infer from id
  const agentType = card.agentType || card.id;
  return AGENT_TYPE_ICON_MAP[agentType] ?? AGENT_TYPE_ICON_MAP.default ?? Circle;
}

function AgentStatusBadge({ status }: { status: AgentCardStatus }) {
  const map: Record<AgentCardStatus, { tone: "neutral" | "info" | "success" | "danger"; text: string }> = {
    pending: { tone: "neutral", text: OUTLINE_PARSING_COPY.agentStatusPending },
    running: { tone: "info", text: OUTLINE_PARSING_COPY.agentStatusRunning },
    complete: { tone: "success", text: OUTLINE_PARSING_COPY.agentStatusComplete },
    error: { tone: "danger", text: OUTLINE_PARSING_COPY.agentStatusError },
  };
  const { tone, text } = map[status];
  return (
    <Badge tone={tone} className={status === "running" ? "animate-pulse" : undefined}>
      {text}
    </Badge>
  );
}

function AgentCard({ card }: { card: AgentCardState }) {
  const IconComp = getAgentIcon(card);
  const isRunning = card.status === "running";
  const isRepair = card.agentType === "repair" || card.id.startsWith("repair");

  return (
    <div
      className={clsx(
        "panel p-3 transition-all",
        isRunning && "border-accent/40",
        card.status === "complete" && "border-success/30",
        card.status === "error" && "border-danger/30",
        isRepair && "border-warning/30 bg-warning/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <IconComp
            size={14}
            className={clsx(
              "shrink-0",
              isRunning && "text-accent",
              card.status === "complete" && "text-success",
              card.status === "error" && "text-danger",
              card.status === "pending" && "text-subtext",
            )}
          />
          <span className="font-medium text-ink">{card.displayName}</span>
        </div>
        <AgentStatusBadge status={card.status} />
      </div>

      {card.streamingText ? (
        <div className="mt-2 max-h-[40px] overflow-hidden rounded-atelier bg-canvas p-1.5 font-mono text-[10px] leading-tight text-subtext sm:max-h-[60px]">
          {card.streamingText.slice(-200)}
        </div>
      ) : null}

      {card.error ? <div className="mt-1.5 text-[10px] text-danger">{card.error}</div> : null}

      {card.status === "complete" || card.status === "error" ? (
        <>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-subtext">
            {card.durationMs > 0 ? <span>{(card.durationMs / 1000).toFixed(1)}s</span> : null}
            {card.tokensUsed > 0 ? <span>{card.tokensUsed.toLocaleString()} tokens</span> : null}
            {card.warnings.length > 0 ? <span className="text-warning">{card.warnings.length} 警告</span> : null}
          </div>
          {card.status === "error" && card.warnings.length > 0 ? (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[10px] text-danger hover:underline">
                查看错误详情 ({card.warnings.length})
              </summary>
              <ul className="mt-1 list-inside list-disc text-[10px] text-subtext">
                {card.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function AgentDashboard({ cards }: { cards: AgentCardState[] }) {
  if (cards.length === 0) return null;

  const hasAnyActivity = cards.some((card) => card.status !== "pending");
  if (!hasAnyActivity) return null;
  const totalTokens = cards.reduce((sum, card) => sum + card.tokensUsed, 0);
  const totalDuration = cards.reduce((sum, card) => sum + card.durationMs, 0);
  const completedCount = cards.filter((card) => card.status === "complete").length;
  const errorCount = cards.filter((card) => card.status === "error").length;

  // Adaptive grid: more columns for more agents
  const gridCols =
    cards.length <= 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : cards.length <= 6
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-subtext">
        <span>{OUTLINE_PARSING_COPY.agentDashboardTitle}</span>
        <span className="text-[10px] text-subtext/60">{cards.length} 个 Agent</span>
      </div>
      <div className={clsx("grid gap-2", gridCols)}>
        {cards.map((card) => (
          <AgentCard key={card.id} card={card} />
        ))}
      </div>
      {completedCount > 0 || errorCount > 0 ? (
        <div className="mt-2 flex items-center gap-4 text-[10px] text-subtext">
          <span>
            {completedCount}/{cards.length} 完成
          </span>
          {errorCount > 0 ? <span className="text-danger">{errorCount} 错误</span> : null}
          {totalDuration > 0 ? <span>总耗时 {(totalDuration / 1000).toFixed(1)}s</span> : null}
          {totalTokens > 0 ? <span>总 tokens {totalTokens.toLocaleString()}</span> : null}
        </div>
      ) : null}
    </div>
  );
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
      panelClassName="surface max-w-3xl p-4 sm:p-6"
      ariaLabel={OUTLINE_PARSING_COPY.parseTitle}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-content text-xl sm:text-2xl">{OUTLINE_PARSING_COPY.parseTitle}</div>
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
            className="textarea atelier-content min-h-[120px] resize-y sm:min-h-[180px]"
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

      <AgentDashboard cards={props.agentCards} />

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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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

          {props.parseResult.agent_log?.length ? (
            <details className="rounded-atelier border border-border bg-canvas p-3">
              <summary className="cursor-pointer text-xs text-subtext hover:text-ink">
                Agent 执行日志 ({props.parseResult.agent_log.length} 条)
              </summary>
              <div className="mt-2 grid gap-1">
                {props.parseResult.agent_log.map((log, index) => (
                  <div key={index} className="flex items-center gap-2 text-[10px]">
                    <span
                      className={clsx(
                        "inline-block w-14 shrink-0 rounded px-1 py-0.5 text-center font-medium",
                        log.status === "success" && "bg-success/10 text-success",
                        log.status === "error" && "bg-danger/10 text-danger",
                        log.status === "partial" &&
                          "bg-warning/10 text-warning",
                      )}
                    >
                      {log.status}
                    </span>
                    <span className="text-ink">{log.agent_name}</span>
                    {log.duration_ms > 0 ? <span className="text-subtext">{(log.duration_ms / 1000).toFixed(1)}s</span> : null}
                    {log.tokens_used > 0 ? <span className="text-subtext">{log.tokens_used} tok</span> : null}
                    {log.error_message ? <span className="truncate text-danger">{log.error_message}</span> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              className="btn btn-secondary"
              disabled={!canApplyOutline}
              onClick={props.onApplyOutline}
              type="button"
            >
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
            <button
              className="btn btn-secondary"
              disabled={!canApplyEntries}
              onClick={props.onApplyEntries}
              type="button"
            >
              {OUTLINE_PARSING_COPY.parseApplyEntries}
            </button>
            <button
              className="btn btn-primary col-span-2 sm:col-span-1"
              disabled={!props.parseResult}
              onClick={props.onApplyAll}
              type="button"
            >
              {OUTLINE_PARSING_COPY.parseApplyAll}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
