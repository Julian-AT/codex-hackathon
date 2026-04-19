import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { toErrorMessage, truncateText } from '@/lib/server/errors';
import {
	createChildProcessRegistry,
	terminateChild,
	waitForChildExit,
} from '@/lib/server/processes';
import { type TrainPoint, parseTrainLine } from '@/lib/streams/trainParser';
import { type SupervisorSignal, TrainSupervisor } from '@/lib/training/supervisor';

const registry = createChildProcessRegistry();

export interface TrainOptions {
	mode: 'sft' | 'grpo';
	iters?: number;
	model?: string;
	adapterDir?: string;
	onData?: (point: TrainPoint) => void;
	signal?: AbortSignal;
}

export async function runTraining(opts: TrainOptions): Promise<void> {
	const {
		mode,
		iters = mode === 'sft' ? 400 : 0,
		model = 'unsloth/gemma-4-E4B-it-UD-MLX-4bit',
		adapterDir = process.env.ADAPTER_DIR || 'data/training/model-a-adapter',
		onData,
		signal,
	} = opts;

	const baseEnv: NodeJS.ProcessEnv = {
		...process.env,
		PYTHONUNBUFFERED: '1',
		ADAPTER_DIR: adapterDir,
		MODEL: model,
		ITERS: String(iters),
	};

	const supervisor = new TrainSupervisor();

	const spawnChild = (currentMode: 'sft' | 'grpo', extraEnv: Partial<NodeJS.ProcessEnv> = {}) =>
		spawn('bash', [currentMode === 'sft' ? 'scripts/train.sh' : 'scripts/grpo.sh'], {
			env: { ...baseEnv, ...extraEnv },
		});

	let activeChild = registry.track(spawnChild(mode));

	const onAbort = () => terminateChild(activeChild);
	signal?.addEventListener('abort', onAbort);

	try {
		outer: while (true) {
			const stdoutRl = readline.createInterface({ input: activeChild.stdout });
			const stderrRl = readline.createInterface({ input: activeChild.stderr });
			let recentStderr = '';

			stderrRl.on('line', (line) => {
				recentStderr = truncateText(line);
			});

			let respawned = false;

			for await (const line of stdoutRl) {
				const pt = parseTrainLine(line);
				let sig: SupervisorSignal = { kind: 'continue' };

				if (pt) {
					onData?.(pt);
					sig = supervisor.ingest(pt);
				} else if (mode === 'grpo') {
					sig = supervisor.ingestRawLine(line);
				}

				if (sig.kind === 'continue') continue;

				if (sig.kind === 'rollback') {
					terminateChild(activeChild);
					await waitForChildExit(activeChild);
					registry.untrack(activeChild);
					const revertedIter = await supervisor.performRollback(adapterDir);
					onData?.({ iter: revertedIter, aborted: `rollback.${sig.reason}` });
					activeChild = registry.track(
						spawnChild('sft', {
							RESUME_ADAPTER: `${adapterDir}/adapters.safetensors`,
						}),
					);
					respawned = true;
					stdoutRl.close();
					stderrRl.close();
					continue outer;
				}

				if (sig.kind === 'abort' || sig.kind === 'grpo.collapsed') {
					terminateChild(activeChild);
					onData?.({ iter: -1, aborted: sig.reason });
					return;
				}
			}

			stderrRl.close();
			await waitForChildExit(activeChild);
			registry.untrack(activeChild);
			if (!respawned) break;
		}
	} catch (e) {
		onData?.({ iter: -1, aborted: 'error' });
		throw new Error(toErrorMessage(e, 'training error'));
	} finally {
		signal?.removeEventListener('abort', onAbort);
		registry.untrack(activeChild);
	}
}
