export interface PromptPreset {
  id: string;
  project_id: string;
  name: string;
  category?: string | null;
  scope: string;
  version: number;
  active_for: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PromptBlock {
  id: string;
  preset_id: string;
  identifier: string;
  name: string;
  role: string;
  enabled: boolean;
  template?: string | null;
  marker_key?: string | null;
  injection_position: string;
  injection_depth?: number | null;
  injection_order: number;
  triggers: string[];
  forbid_overrides: boolean;
  budget: Record<string, unknown>;
  cache: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PromptPreviewBlock {
  id: string;
  identifier: string;
  role: string;
  enabled: boolean;
  text: string;
  missing: string[];
  token_estimate?: number;
}

export interface PromptPreview {
  preset_id: string;
  task: string;
  system: string;
  user: string;
  prompt_tokens_estimate?: number;
  prompt_budget_tokens?: number | null;
  missing: string[];
  blocks: PromptPreviewBlock[];
}
