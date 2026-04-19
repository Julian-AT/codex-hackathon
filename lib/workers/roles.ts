import { getModel } from '@/lib/model';
import { generateText } from 'ai';

export const WORKER_ROLES = [
	'discovery',
	'tool-design',
	'data-gen-qa',
	'data-gen-traj',
	'eval-gen',
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];

export type RoleResult = {
	text: string;
	usage?: unknown;
};

export async function runRole(
	role: WorkerRole,
	prompt: string,
	signal?: AbortSignal,
): Promise<RoleResult> {
	const system = `You are a ${role} worker in a coordinator/worker pipeline. Reply concisely.`;
	const r = await generateText({
		model: getModel(),
		system,
		prompt,
		abortSignal: signal,
		experimental_telemetry: { isEnabled: true, functionId: `worker.${role}` },
	});
	return { text: r.text, usage: r.usage };
}
