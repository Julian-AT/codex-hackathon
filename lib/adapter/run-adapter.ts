import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import readline from 'node:readline';
import { toErrorMessage } from '@/lib/server/errors';
import { createChildProcessRegistry, terminateChild } from '@/lib/server/processes';

const registry = createChildProcessRegistry();

const ALLOWED_ACTIONS = ['fuse', 'deploy', 'fuse-and-deploy'] as const;
export type AdapterAction = (typeof ALLOWED_ACTIONS)[number];

type AdapterStep = {
	id: string;
	label: string;
	script: string;
};

const ACTION_PLAN: Record<AdapterAction, AdapterStep[]> = {
	fuse: [{ id: 'adapter:fuse', label: 'fuse adapter', script: 'scripts/fuse.sh' }],
	deploy: [{ id: 'adapter:deploy', label: 'deploy adapter', script: 'scripts/deploy-adapter.sh' }],
	'fuse-and-deploy': [
		{ id: 'adapter:fuse', label: 'fuse adapter', script: 'scripts/fuse.sh' },
		{ id: 'adapter:deploy', label: 'deploy adapter', script: 'scripts/deploy-adapter.sh' },
	],
};

export interface AdapterOptions {
	action: AdapterAction;
	onStep?: (stepId: string, line: string) => void;
	signal?: AbortSignal;
}

const MAX_LINE_LENGTH = 400;

function sanitizeLine(line: string) {
	return line.replace(/\r$/, '').slice(0, MAX_LINE_LENGTH);
}

async function runStep(step: AdapterStep, onStep: AdapterOptions['onStep'], signal?: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const child = registry.track(
			spawn('bash', [step.script], {
				env: { ...process.env },
				stdio: ['pipe', 'pipe', 'pipe'],
			}) as ChildProcessWithoutNullStreams,
		);

		let abortedBySignal = false;

		const onAbort = () => {
			abortedBySignal = true;
			terminateChild(child);
		};

		signal?.addEventListener('abort', onAbort);

		const cleanup = () => {
			registry.untrack(child);
			signal?.removeEventListener('abort', onAbort);
		};

		const stdoutRl = readline.createInterface({ input: child.stdout });
		const stderrRl = readline.createInterface({ input: child.stderr });

		stdoutRl.on('line', (line) => {
			const trimmed = sanitizeLine(line);
			if (trimmed) onStep?.(step.id, trimmed);
		});
		stderrRl.on('line', (line) => {
			const trimmed = sanitizeLine(line);
			if (trimmed) onStep?.(step.id, `stderr: ${trimmed}`);
		});

		child.once('error', (error) => {
			cleanup();
			stdoutRl.close();
			stderrRl.close();
			reject(error);
		});

		child.once('close', (code) => {
			cleanup();
			stdoutRl.close();
			stderrRl.close();
			if (abortedBySignal) {
				reject(new Error('aborted'));
				return;
			}
			if (code !== 0) {
				reject(new Error(`${step.label} exited with code ${code}`));
				return;
			}
			resolve();
		});
	});
}

export async function runAdapter(opts: AdapterOptions): Promise<void> {
	const { action, onStep, signal } = opts;
	const steps = ACTION_PLAN[action];

	for (const step of steps) {
		if (signal?.aborted) throw new Error('aborted');
		onStep?.(step.id, `starting ${step.label}`);
		await runStep(step, onStep, signal);
		onStep?.(step.id, `${step.label} complete`);
	}
}
