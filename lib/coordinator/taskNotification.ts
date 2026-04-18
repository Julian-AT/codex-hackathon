// lib/coordinator/taskNotification.ts
// Typed shapes + builders for the two worker-related stream parts (PRD §10.4).
//
// data-agent-status  -> transient: true  (status pings; do NOT persist)
// data-task-notification -> transient: false (terminal event; persists in message)

export type AgentStatus = {
  role: string;
  status: 'running' | 'ok' | 'err' | 'timeout';
  step?: string;
  lastLine?: string;
};

export type TaskNotification = {
  taskId: string;
  status: 'ok' | 'err' | 'timeout';
  summary: string;
  result?: string;
  usage?: unknown;
};

export function buildStatusPart(id: string, data: AgentStatus) {
  return {
    type: 'data-agent-status' as const,
    id,
    data,
    transient: true as const,
  };
}

export function buildNotificationPart(id: string, data: TaskNotification) {
  return {
    type: 'data-task-notification' as const,
    id,
    data,
    transient: false as const,
  };
}
