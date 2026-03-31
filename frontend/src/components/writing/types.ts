export type CreateChapterForm = {
  number: number;
  title: string;
  plan: string;
};

export type PromptOverrideMessage = {
  role: string;
  content: string;
  name?: string | null;
};

export type PromptOverride = {
  system?: string | null;
  user?: string | null;
  messages?: PromptOverrideMessage[];
};

export type GenerateForm = {
  instruction: string;
  target_word_count: number | null;
  macro_seed?: string;
  prompt_override?: PromptOverride | null;
  stream: boolean;
  style_id: string | null;
  memory_injection_enabled: boolean;
  previous_mode: "full" | "summary";
  rag_enabled: boolean;
  context: {
    include_world_setting: boolean;
    include_style_guide: boolean;
    include_constraints: boolean;
    include_outline: boolean;
    include_smart_context: boolean;
    require_sequential: boolean;
    character_ids: string[];
    entry_ids: string[];
  };
};

export type GenerationRun = {
  id: string;
  project_id: string;
  actor_user_id?: string | null;
  chapter_id?: string | null;
  type: string;
  provider?: string | null;
  model?: string | null;
  request_id?: string | null;
  prompt_system?: string | null;
  prompt_user?: string | null;
  params?: unknown;
  output_text?: string | null;
  error?: unknown;
  created_at: string;
};

export type BatchGenerationTaskStatus = "queued" | "running" | "paused" | "succeeded" | "failed" | "canceled";
export type BatchGenerationItemStatus = "queued" | "running" | "succeeded" | "failed" | "canceled" | "skipped";

export type BatchGenerationTask = {
  id: string;
  project_id: string;
  outline_id: string;
  actor_user_id?: string | null;
  project_task_id?: string | null;
  status: BatchGenerationTaskStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  cancel_requested: boolean;
  pause_requested: boolean;
  checkpoint_json?: string | null;
  error_json?: string | null;
  created_at: string;
  updated_at: string;
};

export type BatchGenerationTaskItem = {
  id: string;
  task_id: string;
  chapter_id?: string | null;
  chapter_number: number;
  status: BatchGenerationItemStatus;
  attempt_count: number;
  generation_run_id?: string | null;
  last_request_id?: string | null;
  error_message?: string | null;
  last_error_json?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
};
