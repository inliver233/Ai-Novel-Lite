export type ProjectTaskLiveTask = {
  id: string;
  project_id: string;
  kind: string;
  status: string;
  attempt?: number;
  timings?: Record<string, unknown>;
};

export type ProjectTaskEventsSnapshot = {
  type: "snapshot";
  project_id: string;
  cursor: number;
  snapshot_at?: string | null;
  active_tasks: ProjectTaskLiveTask[];
};

export type ProjectTaskEventEnvelope = {
  type: "event";
  seq: number;
  project_id: string;
  task_id: string;
  kind: string;
  event_type: string;
  created_at?: string | null;
  payload?: Record<string, unknown>;
};

type StreamStatus = "idle" | "connecting" | "open" | "error";

export function useProjectTaskEvents(args: {
  projectId: string | undefined;
  enabled?: boolean;
  onSnapshot?: (snapshot: ProjectTaskEventsSnapshot) => void;
  onEvent?: (event: ProjectTaskEventEnvelope) => void;
}): { status: StreamStatus } {
  // NOTE: The backend SSE endpoint `/api/projects/{projectId}/task-events/stream` has been removed.
  // Keep this hook (many callers depend on it), but make it a safe no-op to avoid NOT_FOUND spam.
  void args;
  return { status: "idle" };
}
