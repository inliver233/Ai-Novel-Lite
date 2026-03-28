import type { LLMProvider, QueryPreprocessingConfig } from "./llm";

export interface Project {
  id: string;
  owner_user_id: string;
  active_outline_id?: string | null;
  llm_profile_id?: string | null;
  name: string;
  genre?: string | null;
  logline?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSettings {
  project_id: string;
  world_setting: string;
  style_guide: string;
  constraints: string;
  context_optimizer_enabled: boolean;

  auto_update_characters_enabled: boolean;
  auto_update_story_memory_enabled: boolean;
  auto_update_vector_enabled: boolean;
  auto_update_search_enabled: boolean;

  query_preprocessing?: QueryPreprocessingConfig | null;
  query_preprocessing_default?: QueryPreprocessingConfig;
  query_preprocessing_effective?: QueryPreprocessingConfig;
  query_preprocessing_effective_source?: string;

  vector_rerank_enabled: boolean | null;
  vector_rerank_method: string | null;
  vector_rerank_top_k: number | null;
  vector_rerank_provider: string;
  vector_rerank_base_url: string;
  vector_rerank_model: string;
  vector_rerank_timeout_seconds: number | null;
  vector_rerank_hybrid_alpha: number | null;
  vector_rerank_has_api_key: boolean;
  vector_rerank_masked_api_key: string;
  vector_rerank_effective_enabled: boolean;
  vector_rerank_effective_method: string;
  vector_rerank_effective_top_k: number;
  vector_rerank_effective_source: string;
  vector_rerank_effective_provider: string;
  vector_rerank_effective_base_url: string;
  vector_rerank_effective_model: string;
  vector_rerank_effective_timeout_seconds: number;
  vector_rerank_effective_hybrid_alpha: number;
  vector_rerank_effective_has_api_key: boolean;
  vector_rerank_effective_masked_api_key: string;
  vector_rerank_effective_config_source: string;

  vector_embedding_provider: string;
  vector_embedding_base_url: string;
  vector_embedding_model: string;
  vector_embedding_azure_deployment: string;
  vector_embedding_azure_api_version: string;
  vector_embedding_sentence_transformers_model: string;
  vector_embedding_has_api_key: boolean;
  vector_embedding_masked_api_key: string;
  vector_embedding_effective_provider: string;
  vector_embedding_effective_base_url: string;
  vector_embedding_effective_model: string;
  vector_embedding_effective_azure_deployment: string;
  vector_embedding_effective_azure_api_version: string;
  vector_embedding_effective_sentence_transformers_model: string;
  vector_embedding_effective_has_api_key: boolean;
  vector_embedding_effective_masked_api_key: string;
  vector_embedding_effective_disabled_reason?: string | null;
  vector_embedding_effective_source: string;
}

export type ProjectTask = {
  id: string;
  project_id: string;
  actor_user_id?: string | null;
  kind: string;
  status: string;
  idempotency_key?: string | null;
  error_type?: string | null;
  error_message?: string | null;
  timings?: Record<string, unknown>;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

export interface ProjectSummaryItem {
  project: Project;
  settings: ProjectSettings | null;
  characters_count: number;
  outline_content_md: string;
  outline_content_len?: number;
  outline_content_truncated?: boolean;
  chapters_total: number;
  chapters_done: number;
  llm_preset: { provider: LLMProvider; model: string } | null;
  llm_profile_has_api_key: boolean;
}
