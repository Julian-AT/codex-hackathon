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

export type AgentStatusPart = ReturnType<typeof buildStatusPart>;
export type TaskNotificationPart = ReturnType<typeof buildNotificationPart>;

export function isAgentStatusPart(part: unknown): part is AgentStatusPart {
  return hasPartShape(part, 'data-agent-status');
}

export function isTaskNotificationPart(
  part: unknown,
): part is TaskNotificationPart {
  return hasPartShape(part, 'data-task-notification');
}

function hasPartShape(part: unknown, type: AgentStatusPart['type'] | TaskNotificationPart['type']) {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    'id' in part &&
    'data' in part &&
    typeof part.type === 'string' &&
    part.type === type &&
    typeof part.id === 'string'
  );
}
