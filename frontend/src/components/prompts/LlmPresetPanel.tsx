import { useLayoutEffect, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { LLMProfile, LLMTaskCatalogItem } from "../../types";
import {
  AdvancedConfigCard,
  ConnectionCard,
  ModelSelectorCard,
  ParameterTunerCard,
  TaskOverrideSection,
  ThinkingConfigCard,
} from "./cards";
import { describeModelListState, deriveLlmModuleAccessState } from "./llmConnectionState";
import type { LlmForm, LlmModelListState } from "./types";

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
  const modelSelectorRef = useRef<HTMLDivElement | null>(null);
  const selectedProfile = props.selectedProfileId
    ? (props.profiles.find((profile) => profile.id === props.selectedProfileId) ?? null)
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
  const mainModelListHelpText = useMemo(
    () => describeModelListState(props.mainModelList, mainAccessState),
    [mainAccessState, props.mainModelList],
  );

  useLayoutEffect(() => {
    const root = modelSelectorRef.current;
    if (!root) return;

    const legacyFields = [
      ['select[name="main-module_provider"]', "provider"],
      ['input[name="main-module_model"]', "model"],
      ['input[name="main-module_base_url"]', "base_url"],
    ] as const;

    legacyFields.forEach(([selector, legacyName]) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (element?.getAttribute("name") !== legacyName) {
        element?.setAttribute("name", legacyName);
      }
    });
  });

  return (
    <section className="panel p-6">
      <div>
        <div className="font-content text-xl text-ink">模型编排配置</div>
        <div className="mt-1 text-xs text-subtext">
          主模型负责默认调用；任务模块可覆盖特定流程，未覆盖时自动回退主模型。
        </div>
      </div>

      <div className="mt-4">
        <ConnectionCard
          apiKey={props.apiKey}
          mainAccessState={mainAccessState}
          onChangeApiKey={props.onChangeApiKey}
          onChangeProfileName={props.onChangeProfileName}
          onClearApiKey={props.onClearApiKey}
          onCreateProfile={props.onCreateProfile}
          onDeleteProfile={props.onDeleteProfile}
          onSaveApiKey={props.onSaveApiKey}
          onSelectProfile={props.onSelectProfile}
          onUpdateProfile={props.onUpdateProfile}
          profileBusy={props.profileBusy}
          profileName={props.profileName}
          profiles={props.profiles}
          selectedProfile={selectedProfile}
          selectedProfileId={props.selectedProfileId}
        />
      </div>

      <div className="mt-4" ref={modelSelectorRef}>
        <ModelSelectorCard
          form={props.llmForm}
          modelList={props.mainModelList}
          modelListHelpText={mainModelListHelpText}
          moduleId="main-module"
          onReloadModels={props.onReloadMainModels}
          saving={sharedSaving}
          setForm={props.setLlmForm}
        />
      </div>

      <div className="mt-4">
        <ParameterTunerCard
          capabilities={props.capabilities}
          form={props.llmForm}
          saving={sharedSaving}
          setForm={props.setLlmForm}
        />
      </div>

      <div className="mt-4">
        <ThinkingConfigCard form={props.llmForm} saving={sharedSaving} setForm={props.setLlmForm} />
      </div>

      <div className="mt-4">
        <AdvancedConfigCard form={props.llmForm} saving={sharedSaving} setForm={props.setLlmForm} />
      </div>

      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur">
        <span
          className={`mr-auto rounded-full px-2 py-0.5 text-[11px] ${
            props.presetDirty ? "bg-warning/15 text-warning" : "bg-success/10 text-success"
          }`}
        >
          {props.presetDirty ? "主模块有未保存更改" : "主模块已保存"}
        </span>
        <button
          className="btn btn-secondary"
          disabled={props.mainModelList.loading || sharedSaving || Boolean(mainAccessState.actionReason)}
          onClick={props.onReloadMainModels}
          title={mainAccessState.actionReason ?? undefined}
          type="button"
        >
          {props.mainModelList.loading ? "拉取中…" : "拉取模型列表"}
        </button>
        <button
          className="btn btn-secondary"
          disabled={props.testing || sharedSaving || Boolean(mainAccessState.actionReason)}
          onClick={props.onTestConnection}
          title={mainAccessState.actionReason ?? undefined}
          type="button"
        >
          {props.testing ? "测试中…" : "测试连接"}
        </button>
        <button
          className="btn btn-primary"
          disabled={!props.presetDirty || sharedSaving}
          onClick={props.onSave}
          type="button"
        >
          保存主模块
        </button>
      </div>

      <div className="mt-4">
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
