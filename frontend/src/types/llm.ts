export type LLMProvider =
  | "openai"
  | "openai_responses"
  | "openai_compatible"
  | "openai_responses_compatible"
  | "anthropic"
  | "gemini";

export interface QueryPreprocessingConfig {
  enabled: boolean;
  tags: string[];
  exclusion_rules: string[];
  index_ref_enhance: boolean;
}

export interface LLMPreset {
  project_id: string;
  provider: LLMProvider;
  base_url?: string | null;
  model: string;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  max_tokens_limit?: number | null;
  max_tokens_recommended?: number | null;
  context_window_limit?: number | null;
  presence_penalty?: number | null;
  frequency_penalty?: number | null;
  top_k?: number | null;
  stop: string[];
  timeout_seconds?: number | null;
  extra: Record<string, unknown>;
}

export interface LLMProfile {
  id: string;
  owner_user_id: string;
  name: string;
  provider: LLMProvider;
  base_url?: string | null;
  model: string;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  presence_penalty?: number | null;
  frequency_penalty?: number | null;
  top_k?: number | null;
  stop?: string[];
  timeout_seconds?: number | null;
  extra?: Record<string, unknown>;
  has_api_key: boolean;
  masked_api_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LLMTaskCatalogItem {
  key: string;
  label: string;
  group: string;
  description: string;
}

export interface LLMTaskPreset extends LLMPreset {
  task_key: string;
  llm_profile_id?: string | null;
  source?: string;
}

export interface LLMModelItem {
  id: string;
  display_name?: string;
  provider: LLMProvider;
  name?: string;
}

export interface LLMModelsWarning {
  code: string;
  message: string;
}

export interface LLMModelsResponse {
  provider: LLMProvider;
  base_url: string;
  models: LLMModelItem[];
  warning?: LLMModelsWarning | null;
}
