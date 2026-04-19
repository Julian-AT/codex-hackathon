import { tool } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import type { LimitFunction } from 'p-limit';
import { z } from 'zod';

import { toErrorMessage } from '@/lib/server/errors';
import { WORKER_ROLES, type WorkerRole, runRole } from '@/lib/workers/roles';

const WORKER_TIMEOUT_MS = 90_000;

const spawnWorkerSchema = z.object({
	id: z.string().min(1),
	role: z.enum(WORKER_ROLES),
	prompt: z.string().min(1),
});

export function createSpawnWorkerTool(writer: UIMessageStreamWriter<any>, limiter: LimitFunction) {
	return tool({
		description:
			'Delegate a scoped subtask to a typed worker role. The coordinator NEVER does domain work itself — it only calls this tool.',
		inputSchema: spawnWorkerSchema,
		execute: async (args) => {
			const { id, role, prompt } = args as z.infer<typeof spawnWorkerSchema>;
			return limiter(async () => {
				try {
					const result = await runRole(
						role as WorkerRole,
						prompt,
						AbortSignal.timeout(WORKER_TIMEOUT_MS),
					);
					return { taskId: id, status: 'ok' as const, summary: result.text.slice(0, 200) };
				} catch (e) {
					const msg = toErrorMessage(e, 'worker error');
					return { taskId: id, status: 'err' as const, summary: msg };
				}
			});
		},
	});
}
