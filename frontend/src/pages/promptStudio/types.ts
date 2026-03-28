export type PromptStudioPresetSummary = {
  id: string;
  name: string;
  is_active: boolean;
};

export type PromptStudioPresetDetail = {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
};

export type PromptStudioCategory = {
  key: string;
  label: string;
  task: string | null;
  presets: PromptStudioPresetSummary[];
};

export type BlockDraft = {
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  template: string;
  marker_key: string;
  triggers: string;
};

export type PromptStudioTask = { key: string; label: string };
