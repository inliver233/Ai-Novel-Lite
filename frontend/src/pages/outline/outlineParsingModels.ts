export type OutlineParseAgentConfig = {
  max_context_tokens: number;
  timeout_seconds: number;
  parallel_extraction: boolean;
};

export type OutlineParseForm = {
  content: string;
  file_content: string | null;
  file_name: string | null;
  agent_config: OutlineParseAgentConfig;
};

export type OutlineParseProgress = {
  message: string;
  progress: number;
  status: "processing" | "success" | "error";
};

export type OutlineParseChapter = {
  number: number;
  title: string;
  beats: string[];
};

export type OutlineParseVolume = {
  number: number;
  title: string;
  summary: string;
};

export type OutlineParseCharacter = {
  name: string;
  role: string | null;
  profile: string | null;
  notes: string | null;
};

export type OutlineParseEntry = {
  title: string;
  content: string;
  tags: string[];
};

export type OutlineParseDetailedOutline = {
  volume_number: number;
  volume_title: string;
  volume_summary: string;
  chapters: Record<string, unknown>[];
};

export type OutlineParseAgentLogItem = {
  agent_name: string;
  status: "success" | "error" | "partial";
  duration_ms: number;
  tokens_used: number;
  error_message: string | null;
  warnings: string[];
};

export type OutlineParseResult = {
  outline: { outline_md: string; volumes: OutlineParseVolume[]; chapters: OutlineParseChapter[] };
  characters: OutlineParseCharacter[];
  entries: OutlineParseEntry[];
  detailed_outlines: OutlineParseDetailedOutline[];
  agent_log: OutlineParseAgentLogItem[];
  total_duration_ms: number;
  total_tokens_used: number;
  warnings: string[];
};

export const DEFAULT_PARSE_AGENT_CONFIG: OutlineParseAgentConfig = {
  max_context_tokens: 200000,
  timeout_seconds: 3600,
  parallel_extraction: true,
};

export const DEFAULT_PARSE_FORM: OutlineParseForm = {
  content: "",
  file_content: null,
  file_name: null,
  agent_config: DEFAULT_PARSE_AGENT_CONFIG,
};

export type AgentCardStatus = "pending" | "running" | "complete" | "error";

export type AgentCardState = {
  id: string;
  displayName: string;
  status: AgentCardStatus;
  streamingText: string;
  durationMs: number;
  tokensUsed: number;
  retryCount: number;
  warnings: string[];
  error: string | null;
  /** Agent type from task_plan: "structure" | "character" | "entry" | "detailed_outline" | "planner" | "validation" | "repair" */
  agentType: string;
};

/** Create a fresh agent card from an event */
export function createAgentCard(id: string, displayName: string, agentType?: string): AgentCardState {
  return {
    id,
    displayName,
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
    agentType: agentType ?? inferAgentType(id),
  };
}

/** Infer agent type from id for icon mapping */
function inferAgentType(id: string): string {
  if (id === "planner" || id === "analysis") return "planner";
  if (id === "validation") return "validation";
  if (id.startsWith("repair")) return "repair";
  if (id.startsWith("structure") || id === "structure") return "structure";
  if (id.startsWith("character") || id === "character") return "character";
  if (id.startsWith("entry") || id === "entry") return "entry";
  if (id.startsWith("detailed_outline") || id === "detailed_outline") return "detailed_outline";
  return "default";
}

/** Task plan item from backend */
export type TaskPlanItem = {
  id: string;
  type: string;
  display_name: string;
  scope: string;
};

// Backward-compatible: initial cards with just the planner
export const INITIAL_AGENT_CARDS: AgentCardState[] = [
  createAgentCard("planner", "任务规划", "planner"),
];
