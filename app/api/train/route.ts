import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { parseTrainLine } from '@/lib/streams/trainParser';
import { withTrainingSpan } from '@/lib/observability/trainingSpans';
import { toErrorMessage, truncateText } from '@/lib/server/errors';
import {
  createChildProcessRegistry,
  terminateChild,
  waitForChildExit,
} from '@/lib/server/processes';
import { TrainSupervisor, type SupervisorSignal } from '@/lib/training/supervisor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registry = createChildProcessRegistry();

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

        let activeChild = registry.track(spawnTrainingChild(mode));
        let activeChildId = `${mode}-${Date.now()}`;

        const onAbort = () => {
          terminateChild(activeChild);
        };
        req.signal.addEventListener('abort', onAbort);

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
                terminateChild(activeChild);
                await waitForChildExit(activeChild);
                registry.untrack(activeChild);
                const revertedIter = await supervisor.performRollback(adapterDir);
                span.setAttribute('training.rollback', revertedIter);
                writer.write({
                  type: 'data-train',
                  data: { iter: revertedIter, aborted: `rollback.${signal.reason}` },
                  transient: true,
                });
                activeChild = registry.track(
                  spawnTrainingChild('sft', {
                    RESUME_ADAPTER: `${adapterDir}/adapters.safetensors`,
                  }),
                );
                activeChildId = `sft-${Date.now()}-r${revertedIter}`;
                respawned = true;
                stdoutRl.close();
                stderrRl.close();
                continue outer;
              }

              if (signal.kind === 'abort' || signal.kind === 'grpo.collapsed') {
                terminateChild(activeChild);
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
            await waitForChildExit(activeChild);
            registry.untrack(activeChild);
            if (!respawned) {
              if (recentStderr) span.setAttribute('training.stderr', recentStderr);
              break;
            }
          }
        } catch (e) {
          const msg = toErrorMessage(e, 'train error');
          writer.write({
            type: 'data-train',
            data: { iter: -1, aborted: 'route.error' },
            transient: true,
          });
          span.setAttribute('training.error', msg);
        } finally {
          req.signal.removeEventListener('abort', onAbort);
          registry.untrack(activeChild);
        }
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
