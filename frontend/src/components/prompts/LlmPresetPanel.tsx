import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { LLMProfile, LLMProvider, LLMTaskCatalogItem } from "../../types";
import { TaskOverrideSection } from "./cards";
import { SliderInput } from "./cards/SliderInput";
import { deriveLlmModuleAccessState } from "./llmConnectionState";
import type { LlmForm, LlmModelListState } from "./types";

const PROVIDER_OPTIONS: Array<{ value: LLMProvider; label: string }> = [
  { value: "openai", label: "openai（官方）" },
  { value: "openai_responses", label: "openai_responses（官方 /v1/responses）" },
  { value: "openai_compatible", label: "openai_compatible（中转/本地）" },
  { value: "openai_responses_compatible", label: "openai_responses_compatible（中转 /v1/responses）" },
  { value: "anthropic", label: "anthropic（Claude）" },
  { value: "gemini", label: "gemini" },
];

type TaskModuleView = {
  task_key: string;
  label: string;
  group: string;
  description: string;
  llm_profile_id: string | null;
  form: LlmForm;
  dirty: boolean;
  saving: boolean;
  deleting: boolean;
  modelList: LlmModelListState;
};

type Props = {
  llmForm: LlmForm;
  setLlmForm: Dispatch<SetStateAction<LlmForm>>;
  presetDirty: boolean;
  saving: boolean;
  testing: boolean;
  capabilities: {
    max_tokens_limit: number | null;
    max_tokens_recommended: number | null;
    context_window_limit: number | null;
  } | null;
  onTestConnection: () => void;
  onSave: () => void;
  mainModelList: LlmModelListState;
  onReloadMainModels: () => void;
  profiles: LLMProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string | null) => void;
  profileName: string;
  onChangeProfileName: (value: string) => void;
  profileBusy: boolean;
  onCreateProfile: () => void;
  onUpdateProfile: () => void;
  onDeleteProfile: () => void;
  apiKey: string;
  onChangeApiKey: (value: string) => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
  taskModules: TaskModuleView[];
  addableTasks: LLMTaskCatalogItem[];
  selectedAddTaskKey: string;
  onSelectAddTaskKey: (taskKey: string) => void;
  onAddTaskModule: () => void;
  onTaskProfileChange: (taskKey: string, profileId: string | null) => void;
  onTaskFormChange: (taskKey: string, updater: (prev: LlmForm) => LlmForm) => void;
  taskTesting: Record<string, boolean>;
  onTestTaskConnection: (taskKey: string) => void;
  taskApiKeyDrafts: Record<string, string>;
  onTaskApiKeyDraftChange: (taskKey: string, value: string) => void;
  taskProfileBusy: Record<string, boolean>;
  onSaveTaskApiKey: (taskKey: string) => void;
  onClearTaskApiKey: (taskKey: string) => void;
  onSaveTask: (taskKey: string) => void;
  onDeleteTask: (taskKey: string) => void;
  onReloadTaskModels: (taskKey: string) => void;
};

export function LlmPresetPanel(props: Props) {
  const selectedProfile = props.selectedProfileId
    ? (props.profiles.find((p) => p.id === props.selectedProfileId) ?? null)
    : null;
  const sharedSaving = props.saving || props.profileBusy;
  const mainAccessState = useMemo(
    () =>
      deriveLlmModuleAccessState({
        scope: "main",
        moduleProvider: props.llmForm.provider,
        selectedProfile,
      }),
    [props.llmForm.provider, selectedProfile],
  );

  const capabilitiesHint = (() => {
    if (!props.capabilities) return "";
    const parts: string[] = [];
    if (props.capabilities.max_tokens_recommended) parts.push("推荐 " + props.capabilities.max_tokens_recommended);
    if (props.capabilities.max_tokens_limit) parts.push("上限 " + props.capabilities.max_tokens_limit);
    if (props.capabilities.context_window_limit) parts.push("上下文 " + props.capabilities.context_window_limit);
    return parts.join(" · ");
  })();

  function renderReasoningControl() {
    const provider = props.llmForm.provider;
    const isOpenAi =
      provider === "openai" ||
      provider === "openai_compatible" ||
      provider === "openai_responses" ||
      provider === "openai_responses_compatible";
    const isAnthropic = provider === "anthropic";
    const isGemini = provider === "gemini";

    if (isOpenAi) {
      return (
        <label className="grid gap-1">
          <span className="text-xs text-subtext">推理强度</span>
          <select
            className="select"
            disabled={sharedSaving}
            value={props.llmForm.reasoning_effort}
            onChange={(e) => {
              const value = e.currentTarget.value;
              props.setLlmForm((prev) => ({ ...prev, reasoning_effort: value }));
            }}
          >
            <option value="">默认</option>
            <option value="minimal">minimal</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      );
    }

    if (isAnthropic) {
      return (
        <div className="grid gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={props.llmForm.anthropic_thinking_enabled}
              disabled={sharedSaving}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                props.setLlmForm((prev) => ({
                  ...prev,
                  anthropic_thinking_enabled: checked,
                }));
              }}
            />
            <span className="text-xs text-subtext">启用推理（thinking）</span>
          </label>
          {props.llmForm.anthropic_thinking_enabled ? (
            <SliderInput
              label="推理预算 (budget_tokens)"
              min={128}
              max={32768}
              step={128}
              value={props.llmForm.anthropic_thinking_budget_tokens}
              onChange={(v) =>
                props.setLlmForm((prev) => ({ ...prev, anthropic_thinking_budget_tokens: v }))
              }
              disabled={sharedSaving}
            />
          ) : null}
        </div>
      );
    }

    if (isGemini) {
      return (
        <SliderInput
          label="推理预算 (thinkingBudget)"
          min={128}
          max={32768}
          step={128}
          value={props.llmForm.gemini_thinking_budget}
          onChange={(v) => props.setLlmForm((prev) => ({ ...prev, gemini_thinking_budget: v }))}
          disabled={sharedSaving}
        />
      );
    }

    return <div className="text-xs text-subtext">当前服务商无推理配置</div>;
  }

  return (
    <section className="panel p-6" aria-label="主模型配置">
      {/* Header */}
      <div>
        <div className="font-content text-xl text-ink">主模型配置</div>
        <div className="mt-1 text-xs text-subtext">
          主模型负责默认调用；任务模块可覆盖特定流程。
        </div>
      </div>

      {/* Config Quick Switch + Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="select min-w-0 flex-1"
          aria-label="配置快速切换"
          disabled={props.profileBusy}
          value={props.selectedProfileId ?? ""}
          onChange={(e) => props.onSelectProfile(e.currentTarget.value || null)}
        >
          <option value="">(未选择配置)</option>
          {props.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.provider}/{p.model}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          disabled={!props.presetDirty || sharedSaving}
          onClick={props.onSave}
          type="button"
        >
          {props.saving ? "保存中..." : "保存配置"}
        </button>
        <div className="flex items-center gap-1">
          <input
            className="input w-32 text-sm"
            disabled={props.profileBusy}
            placeholder="配置名"
            value={props.profileName}
            onChange={(e) => props.onChangeProfileName(e.currentTarget.value)}
          />
          <button
            className="btn btn-secondary"
            disabled={props.profileBusy || !props.profileName.trim()}
            onClick={props.onCreateProfile}
            type="button"
          >
            新建
          </button>
        </div>
        <button
          className="btn btn-secondary"
          disabled={props.testing || sharedSaving || Boolean(mainAccessState.actionReason)}
          onClick={props.onTestConnection}
          title={mainAccessState.actionReason ?? undefined}
          type="button"
        >
          {props.testing ? "测试中..." : "测试连接"}
        </button>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            props.presetDirty ? "bg-warning/15 text-warning" : "bg-success/10 text-success"
          }`}
        >
          {props.presetDirty ? "未保存" : "已保存"}
        </span>
      </div>

      {/* Form Fields: Provider / URL / Key / Model */}
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-subtext">服务商</span>
          <select
            className="select"
            disabled={sharedSaving}
            value={props.llmForm.provider}
            onChange={(e) => {
              const provider = e.currentTarget.value as LLMProvider;
              props.setLlmForm((v) => ({
                ...v,
                provider,
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
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">接口地址</span>
          <input
            className="input"
            disabled={sharedSaving}
            placeholder="https://api.openai.com/v1"
            value={props.llmForm.base_url}
            onChange={(e) => {
              const value = e.currentTarget.value;
              props.setLlmForm((v) => ({ ...v, base_url: value }));
            }}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">API Key</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder="输入 API Key"
            value={props.apiKey}
            onChange={(e) => props.onChangeApiKey(e.currentTarget.value)}
          />
        </label>

        {/* API Key actions */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            disabled={props.profileBusy || !props.selectedProfileId || !props.apiKey.trim()}
            onClick={props.onSaveApiKey}
            type="button"
          >
            保存 Key
          </button>
          <button
            className="btn btn-ghost btn-sm text-subtext"
            disabled={props.profileBusy || !props.selectedProfileId}
            onClick={props.onClearApiKey}
            type="button"
          >
            清除 Key
          </button>
        </div>

        <label className="grid gap-1">
          <span className="text-xs text-subtext">模型名称</span>
          <div className="flex items-center gap-2">
            <input
              className="input min-w-0 flex-1"
              disabled={sharedSaving}
              list="main-module_models"
              value={props.llmForm.model}
              onChange={(e) => {
                const value = e.currentTarget.value;
                props.setLlmForm((v) => ({ ...v, model: value }));
              }}
            />
            <datalist id="main-module_models">
              {props.mainModelList.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.display_name}
                </option>
              ))}
            </datalist>
            <button
              className="btn btn-secondary whitespace-nowrap"
              disabled={props.mainModelList.loading || sharedSaving}
              onClick={props.onReloadMainModels}
              type="button"
            >
              {props.mainModelList.loading ? "拉取中..." : "拉取模型"}
            </button>
          </div>
        </label>
      </div>

      {/* Collapsible Parameters */}
      <details className="mt-4 rounded-atelier border border-border bg-canvas p-4">
        <summary className="ui-transition-fast cursor-pointer select-none text-sm font-medium text-ink hover:text-ink">
          参数调节
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SliderInput
            label="温度"
            min={0}
            max={2}
            step={0.05}
            value={props.llmForm.temperature}
            onChange={(v) => props.setLlmForm((prev) => ({ ...prev, temperature: v }))}
            disabled={sharedSaving}
          />
          <label className="grid gap-1">
            <span className="text-xs text-subtext">最大上下文</span>
            <input
              className="input"
              type="text"
              disabled={sharedSaving}
              value={props.llmForm.max_tokens}
              onChange={(e) => {
                const value = e.currentTarget.value;
                props.setLlmForm((prev) => ({ ...prev, max_tokens: value }));
              }}
            />
            {capabilitiesHint ? (
              <div className="text-[11px] text-subtext">{capabilitiesHint}</div>
            ) : null}
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">超时时间（秒）</span>
            <input
              className="input"
              type="text"
              disabled={sharedSaving}
              value={props.llmForm.timeout_seconds}
              onChange={(e) => {
                const value = e.currentTarget.value;
                props.setLlmForm((prev) => ({ ...prev, timeout_seconds: value }));
              }}
            />
          </label>
          {renderReasoningControl()}
        </div>
      </details>

      {/* Task Override Section */}
      <div className="mt-6">
        <TaskOverrideSection
          addableTasks={props.addableTasks}
          llmForm={props.llmForm}
          onAddTaskModule={props.onAddTaskModule}
          onClearTaskApiKey={props.onClearTaskApiKey}
          onDeleteTask={props.onDeleteTask}
          onReloadTaskModels={props.onReloadTaskModels}
          onSaveTask={props.onSaveTask}
          onSaveTaskApiKey={props.onSaveTaskApiKey}
          onSelectAddTaskKey={props.onSelectAddTaskKey}
          onTaskApiKeyDraftChange={props.onTaskApiKeyDraftChange}
          onTaskFormChange={props.onTaskFormChange}
          onTaskProfileChange={props.onTaskProfileChange}
          onTestTaskConnection={props.onTestTaskConnection}
          profiles={props.profiles}
          selectedAddTaskKey={props.selectedAddTaskKey}
          selectedProfile={selectedProfile}
          taskApiKeyDrafts={props.taskApiKeyDrafts}
          taskModules={props.taskModules}
          taskProfileBusy={props.taskProfileBusy}
          taskTesting={props.taskTesting}
        />
      </div>
    </section>
  );
}
