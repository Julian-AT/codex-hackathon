import { Worker } from 'node:worker_threads';
import path from 'node:path';

export interface SandboxResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const WORKER_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  'sandbox.worker.mjs',
);

export function runInSandbox(
  jsBody: string,
  args: unknown,
  timeoutMs = 2000,
): Promise<SandboxResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: SandboxResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };

    const worker = new Worker(WORKER_PATH, {
      workerData: { jsBody, args },
      resourceLimits: {
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 16,
      },
    });

    const timer = setTimeout(() => {
      worker.terminate().catch(() => {});
      done({ ok: false, error: 'timeout' });
    }, timeoutMs);

    worker.once('message', (msg: SandboxResult) => {
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      done(msg);
    });

    worker.once('error', (err) => {
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      done({ ok: false, error: String(err.message).slice(0, 400) });
    });

    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (!settled) done({ ok: false, error: `worker exit ${code}` });
    });
  });
}
