// app/api/train/route.ts
// /api/train — spawns mlx_lm.lora (SFT) or mlx_lm_lora.train (GRPO) as a subprocess,
// pipes stdout through readline, parses lines via trainParser, and emits typed
// `data-train` parts on the shared AI SDK UI-message stream.
//
// HARD CONSTRAINTS:
//   - runtime='nodejs' + dynamic='force-dynamic' — child_process requires node,
//     dynamic prevents static optimisation that would starve the stream.
//   - argv is a literal array (no shell) and `model` is validated against a closed
//     regex before it reaches spawn() — T-02-07 (argv injection).
//   - iters capped at 2000 — T-02-09 (CLAUDE.md: no runs > 20 min).
//   - Child SIGTERM'd on req.signal abort and process beforeExit — T-02-08.
//   - PYTHONUNBUFFERED=1 so mlx_lm.lora flushes per-iter stdout lines.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { parseTrainLine } from '@/lib/streams/trainParser';
import { withTrainingSpan } from '@/lib/observability/trainingSpans';
import { TrainSupervisor, type SupervisorSignal } from '@/lib/training/supervisor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Module-scoped child registry so hot-reload can SIGTERM orphans (PITFALLS P16).
const CHILDREN = new Map<string, ChildProcessWithoutNullStreams>();

type TrainRequest = {
  mode: 'sft' | 'grpo';
  iters?: number;
  model?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<TrainRequest>;
  const mode: 'sft' | 'grpo' = body.mode === 'grpo' ? 'grpo' : 'sft';
  const requestedIters =
    typeof body.iters === 'number' && body.iters >= 0 && body.iters <= 2000
      ? body.iters
      : undefined;
  const iters = requestedIters ?? (mode === 'sft' ? 400 : 0);
  const model =
    body.model && /^[\w\-./]+$/.test(body.model)
      ? body.model
      : 'unsloth/gemma-4-E4B-it-UD-MLX-4bit';

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await withTrainingSpan(mode, iters, async (span) => {
        const adapterDir = process.env.ADAPTER_DIR || 'data/training/model-a-adapter';
        const baseEnv: NodeJS.ProcessEnv = {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          ADAPTER_DIR: adapterDir,
          MODEL: model,
          ITERS: String(iters),
        };
        const supervisor = new TrainSupervisor();

        const spawnTrainingChild = (
          currentMode: 'sft' | 'grpo',
          extraEnv: Partial<NodeJS.ProcessEnv> = {},
        ) =>
          spawn(
            'bash',
            [currentMode === 'sft' ? 'scripts/train.sh' : 'scripts/grpo.sh'],
            {
              env: { ...baseEnv, ...extraEnv },
            },
          );

        let activeChild = spawnTrainingChild(mode);
        let activeChildId = `${mode}-${Date.now()}`;
        CHILDREN.set(activeChildId, activeChild);

        const onAbort = () => {
          try {
            activeChild.kill('SIGTERM');
          } catch {
            /* child already exited */
          }
        };
        req.signal.addEventListener('abort', onAbort);

        try {
          outer: while (true) {
            const stdoutRl = readline.createInterface({ input: activeChild.stdout });
            const stderrRl = readline.createInterface({ input: activeChild.stderr });
            let recentStderr = '';

            stderrRl.on('line', (line) => {
              recentStderr = line.slice(0, 400);
            });

            let respawned = false;

            for await (const line of stdoutRl) {
              const pt = parseTrainLine(line);
              let signal: SupervisorSignal = { kind: 'continue' };

              if (pt) {
                if (pt.loss !== undefined) {
                  span.setAttribute(`loss.iter.${pt.iter}`, pt.loss);
                }
                if (pt.reward !== undefined) {
                  span.setAttribute(`reward.iter.${pt.iter}`, pt.reward);
                }
                writer.write({ type: 'data-train', data: pt, transient: true });
                signal = supervisor.ingest(pt);
              } else if (mode === 'grpo') {
                signal = supervisor.ingestRawLine(line);
              }

              if (signal.kind === 'continue') continue;

              if (signal.kind === 'rollback') {
                try {
                  activeChild.kill('SIGTERM');
                } catch {
                  /* noop */
                }
                await new Promise<void>((resolve) =>
                  activeChild.once('close', () => resolve()),
                );
                CHILDREN.delete(activeChildId);
                const revertedIter = await supervisor.performRollback(adapterDir);
                span.setAttribute('training.rollback', revertedIter);
                writer.write({
                  type: 'data-train',
                  data: { iter: revertedIter, aborted: `rollback.${signal.reason}` },
                  transient: true,
                });
                activeChild = spawnTrainingChild('sft', {
                  RESUME_ADAPTER: `${adapterDir}/adapters.safetensors`,
                });
                activeChildId = `sft-${Date.now()}-r${revertedIter}`;
                CHILDREN.set(activeChildId, activeChild);
                respawned = true;
                stdoutRl.close();
                stderrRl.close();
                continue outer;
              }

              if (signal.kind === 'abort' || signal.kind === 'grpo.collapsed') {
                try {
                  activeChild.kill('SIGTERM');
                } catch {
                  /* noop */
                }
                span.setAttribute(
                  signal.kind === 'abort'
                    ? 'training.aborted'
                    : 'training.grpo_collapsed',
                  signal.reason,
                );
                writer.write({
                  type: 'data-train',
                  data: { iter: -1, aborted: signal.reason },
                  transient: true,
                });
                return;
              }
            }

            stderrRl.close();
            await new Promise<void>((resolve) => activeChild.once('close', () => resolve()));
            CHILDREN.delete(activeChildId);
            if (!respawned) {
              if (recentStderr) span.setAttribute('training.stderr', recentStderr);
              break;
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message.slice(0, 400) : 'train error';
          writer.write({
            type: 'data-train',
            data: { iter: -1, aborted: 'route.error' },
            transient: true,
          });
          span.setAttribute('training.error', msg);
        } finally {
          req.signal.removeEventListener('abort', onAbort);
          CHILDREN.delete(activeChildId);
        }
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

// SIGTERM all children on server exit (T-02-08 defense-in-depth).
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    for (const c of CHILDREN.values()) {
      try {
        c.kill('SIGTERM');
      } catch {
        /* noop */
      }
    }
  });
}
