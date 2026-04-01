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

export type OutlineParseAgentLogItem = {
  agent_name: string;
  status: "success" | "error" | "partial";
  duration_ms: number;
  tokens_used: number;
  error_message: string | null;
  warnings: string[];
};

export type OutlineParseResult = {
  outline: { outline_md: string; chapters: OutlineParseChapter[] };
  characters: OutlineParseCharacter[];
  entries: OutlineParseEntry[];
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
};

export const INITIAL_AGENT_CARDS: AgentCardState[] = [
  {
    id: "analysis",
    displayName: "分析引擎",
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
  },
  {
    id: "structure",
    displayName: "大纲骨架",
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
  },
  {
    id: "character",
    displayName: "角色卡",
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
  },
  {
    id: "entry",
    displayName: "世界条目",
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
  },
  {
    id: "validation",
    displayName: "校验合并",
    status: "pending",
    streamingText: "",
    durationMs: 0,
    tokensUsed: 0,
    retryCount: 0,
    warnings: [],
    error: null,
  },
];

export const AGENT_ICONS: Record<string, string> = {
  analysis: "📊",
  structure: "📋",
  character: "👤",
  entry: "🌍",
  validation: "✅",
};
