import * as Sentry from '@sentry/nextjs';
import { toolDesignWorker } from './worker';
import type { CORPUS, DynamicToolSpec } from './types';

export interface SwarmEvent {
  type: 'worker-start' | 'worker-ok' | 'worker-err';
  workerId: string;
  candidates?: number;
  error?: string;
}

export interface SwarmOptions {
  workerCount?: number; // default 4
  temperature?: number; // default 0.4
  onEvent?: (ev: SwarmEvent) => void;
}

export async function designToolsSwarm(
  corpus: CORPUS,
  opts: SwarmOptions = {},
): Promise<DynamicToolSpec[]> {
  const { workerCount = 4, temperature = 0.4, onEvent } = opts;
  const workers = Array.from({ length: workerCount }, (_, i) => {
    const workerId = `tool-design-${i}`;
    const slice = corpus.chunks.filter((_c, idx) => idx % workerCount === i); // strided
    return Sentry.startSpan(
      { op: 'ai.agent', name: `tool-design.${i}` },
      async (span) => {
        span.setAttribute('worker.id', workerId);
        span.setAttribute('slice.size', slice.length);
        onEvent?.({ type: 'worker-start', workerId });
        try {
          const ac = new AbortController();
          const timer = setTimeout(() => ac.abort(), 90_000);
          const specs = await toolDesignWorker({ workerId, slice, temperature });
          clearTimeout(timer);
          onEvent?.({ type: 'worker-ok', workerId, candidates: specs.length });
          return specs;
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          onEvent?.({ type: 'worker-err', workerId, error: msg });
          return []; // one worker failing does not kill swarm
        }
      },
    );
  });
  const results = await Promise.all(workers);
  return results.flat();
}
