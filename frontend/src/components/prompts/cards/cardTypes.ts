import type { Dispatch, SetStateAction } from "react";

import type { LLMProfile, LLMProvider, LLMTaskCatalogItem } from "../../../types";
import type { VectorRagForm } from "../../../pages/prompts/models";
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

// --- New types for redesigned model config page ---

export type MainConfigBlockProps = {
  // Profile quick-switch
  profiles: LLMProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string | null) => void;
  onSaveProfile: () => void;
  onCreateProfile: () => void;
  profileBusy: boolean;

  // Connection test
  testing: boolean;
  onTestConnection: () => void;

  // Form state
  llmForm: LlmForm;
  setLlmForm: LlmFormSetter;
  saving: boolean;
  presetDirty: boolean;
  onSave: () => void;

  // API Key
  apiKey: string;
  onChangeApiKey: (value: string) => void;

  // Model fetching
  mainModelList: LlmModelListState;
  onReloadMainModels: () => void;
  onInlineFetchModels?: (baseUrl: string, apiKey: string) => void;

  // Capabilities
  capabilities: LlmModuleCapabilities;
};

export type RagConfigBlockProps = {
  activeTab: 'embedding' | 'rerank';
  onTabChange: (tab: 'embedding' | 'rerank') => void;

  vectorForm: VectorRagForm;
  setVectorForm: Dispatch<SetStateAction<VectorRagForm>>;

  // Embed fields
  vectorApiKeyDraft: string;
  setVectorApiKeyDraft: Dispatch<SetStateAction<string>>;

  // Rerank fields
  rerankApiKeyDraft: string;
  setRerankApiKeyDraft: Dispatch<SetStateAction<string>>;
  vectorRerankTopKDraft: string;
  setVectorRerankTopKDraft: Dispatch<SetStateAction<string>>;
  vectorRerankTimeoutDraft: string;
  setVectorRerankTimeoutDraft: Dispatch<SetStateAction<string>>;
  vectorRerankHybridAlphaDraft: string;
  setVectorRerankHybridAlphaDraft: Dispatch<SetStateAction<string>>;

  // State
  savingVector: boolean;
  vectorRagDirty: boolean;
  vectorApiKeyDirty: boolean;
  rerankApiKeyDirty: boolean;

  // Actions
  onSave: () => void;
  onRunEmbeddingDryRun: () => void;
  onRunRerankDryRun: () => void;
  embeddingDryRunLoading: boolean;
  rerankDryRunLoading: boolean;
};
