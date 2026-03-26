import type { Dispatch, SetStateAction } from "react";

import type { LLMProfile, LLMProvider, LLMTaskCatalogItem } from "../../../types";
import type { LlmModuleAccessState } from "../llmConnectionState";
import type { LlmForm, LlmModelListState } from "../types";

export type CardProfile = LLMProfile & { provider: LLMProvider };

export type TaskModuleView = {
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

export type LlmFormSetter = Dispatch<SetStateAction<LlmForm>>;

export type LlmFormUpdater = (prev: LlmForm) => LlmForm;

export type LlmModuleCapabilities = {
  max_tokens_limit: number | null;
  max_tokens_recommended: number | null;
  context_window_limit: number | null;
} | null;

export type ConnectionCardProps = {
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
  mainAccessState: LlmModuleAccessState;
  selectedProfile: LLMProfile | null;
};

export type ModelSelectorCardProps = {
  form: LlmForm;
  setForm: LlmFormSetter;
  modelList: LlmModelListState;
  modelListHelpText: string;
  onReloadModels: () => void;
  saving: boolean;
  moduleId: string;
};

export type ParameterTunerCardProps = {
  form: LlmForm;
  setForm: LlmFormSetter;
  capabilities: LlmModuleCapabilities;
  saving: boolean;
};

export type ThinkingConfigCardProps = {
  form: LlmForm;
  setForm: LlmFormSetter;
  saving: boolean;
};

export type AdvancedConfigCardProps = {
  form: LlmForm;
  setForm: LlmFormSetter;
  saving: boolean;
};

export type TaskOverrideSectionProps = {
  taskModules: TaskModuleView[];
  profiles: LLMProfile[];
  selectedProfile: LLMProfile | null;
  addableTasks: LLMTaskCatalogItem[];
  selectedAddTaskKey: string;
  onSelectAddTaskKey: (taskKey: string) => void;
  onAddTaskModule: () => void;
  onTaskProfileChange: (taskKey: string, profileId: string | null) => void;
  onTaskFormChange: (taskKey: string, updater: LlmFormUpdater) => void;
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
  llmForm: LlmForm;
};
