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
