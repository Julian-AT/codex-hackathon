import type { CORPUS, DynamicToolSpec } from './types';
import { toolDesignWorker } from './worker';

export interface SwarmEvent {
	type: 'worker-start' | 'worker-ok' | 'worker-err';
	workerId: string;
	candidates?: number;
	error?: string;
}

export interface SwarmOptions {
	workerCount?: number;
	temperature?: number;
	onEvent?: (ev: SwarmEvent) => void;
}

export async function designToolsSwarm(
	corpus: CORPUS,
	opts: SwarmOptions = {},
): Promise<DynamicToolSpec[]> {
	const { workerCount = 4, temperature = 0.4, onEvent } = opts;
	const workers = Array.from({ length: workerCount }, async (_, i) => {
		const workerId = `tool-design-${i}`;
		const slice = corpus.chunks.filter((_c, idx) => idx % workerCount === i);
		onEvent?.({ type: 'worker-start', workerId });
		try {
			const specs = await toolDesignWorker({ workerId, slice, temperature });
			onEvent?.({ type: 'worker-ok', workerId, candidates: specs.length });
			return specs;
		} catch (err) {
			const msg = (err as Error).message ?? String(err);
			onEvent?.({ type: 'worker-err', workerId, error: msg });
			return [];
		}
	});
	const results = await Promise.all(workers);
	return results.flat();
}
