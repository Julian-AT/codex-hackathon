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
  const iters =
    typeof body.iters === 'number' && body.iters > 0 && body.iters <= 2000
      ? body.iters
      : mode === 'sft'
        ? 400
        : 150;
  const model =
    body.model && /^[\w\-./]+$/.test(body.model)
      ? body.model
      : 'unsloth/gemma-4-E4B-it-UD-MLX-4bit';

  const bin =
    process.env.MLX_LM_BIN || (mode === 'sft' ? 'mlx_lm.lora' : 'mlx_lm_lora.train');

  // Literal argv — no user input interpolated into a shell (T-02-07 mitigation).
  const args =
    mode === 'sft'
      ? ['--model', model, '--train', '--iters', String(iters), '--steps-per-report', '5']
      : ['--train-mode', 'grpo', '--model', model, '--iters', String(iters), '--group-size', '4'];

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await withTrainingSpan(mode, iters, async (span) => {
        const child = spawn(bin, args, {
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
        const childId = `${mode}-${Date.now()}`;
        CHILDREN.set(childId, child);

        const onAbort = () => {
          try {
            child.kill('SIGTERM');
          } catch {
            /* child already exited */
          }
        };
        req.signal.addEventListener('abort', onAbort);

        const rl = readline.createInterface({ input: child.stdout });
        try {
          for await (const line of rl) {
            const pt = parseTrainLine(line);
            if (!pt) continue;
            if (pt.loss !== undefined) span.setAttribute(`loss.iter.${pt.iter}`, pt.loss);
            if (pt.reward !== undefined) span.setAttribute(`reward.iter.${pt.iter}`, pt.reward);
            writer.write({ type: 'data-train', data: pt, transient: true });
          }
          await new Promise<void>((resolve) => child.on('close', () => resolve()));
        } catch (e) {
          const msg = e instanceof Error ? e.message.slice(0, 400) : 'train error';
          writer.write({ type: 'data-train', data: { iter: -1 }, transient: true });
          span.setAttribute('training.error', msg);
        } finally {
          req.signal.removeEventListener('abort', onAbort);
          CHILDREN.delete(childId);
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
