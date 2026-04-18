// app/api/adapter/route.ts
// Triggers the fuse and/or deploy scripts, streaming their stdout/stderr as
// `data-agent-status` pings and publishing a terminal `data-task-notification`.
// Runtime must stay nodejs because the scripts rely on child_process.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import * as Sentry from '@sentry/nextjs';
import {
  buildNotificationPart,
  buildStatusPart,
} from '@/lib/coordinator/taskNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHILDREN = new Set<ChildProcessWithoutNullStreams>();
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    for (const child of CHILDREN) {
      try {
        child.kill('SIGTERM');
      } catch {
        /* noop */
      }
    }
  });
}

const ALLOWED_ACTIONS = ['fuse', 'deploy', 'fuse-and-deploy'] as const;
type AdapterAction = (typeof ALLOWED_ACTIONS)[number];

type AdapterStep = {
  id: string;
  label: string;
  script: string;
  args?: string[];
};

const ACTION_PLAN: Record<AdapterAction, AdapterStep[]> = {
  fuse: [
    {
      id: 'adapter:fuse',
      label: 'fuse adapter',
      script: 'scripts/fuse.sh',
    },
  ],
  deploy: [
    {
      id: 'adapter:deploy',
      label: 'deploy adapter',
      script: 'scripts/deploy-adapter.sh',
    },
  ],
  'fuse-and-deploy': [
    {
      id: 'adapter:fuse',
      label: 'fuse adapter',
      script: 'scripts/fuse.sh',
    },
    {
      id: 'adapter:deploy',
      label: 'deploy adapter',
      script: 'scripts/deploy-adapter.sh',
    },
  ],
};

type StreamWriter = {
  write: (
    part: ReturnType<typeof buildStatusPart> | ReturnType<typeof buildNotificationPart>,
  ) => void;
};

const MAX_LINE_LENGTH = 400;

function isAdapterAction(value: unknown): value is AdapterAction {
  return typeof value === 'string' && ALLOWED_ACTIONS.includes(value as AdapterAction);
}

function sanitizeLine(line: string) {
  return line.replace(/\r$/, '').slice(0, MAX_LINE_LENGTH);
}

async function runStep(step: AdapterStep, writer: StreamWriter, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('bash', [step.script, ...(step.args ?? [])], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcessWithoutNullStreams;
    CHILDREN.add(child);

    let abortedBySignal = false;

    const onAbort = () => {
      abortedBySignal = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* noop */
      }
    };

    const emitLine = (line: string, isStderr = false) => {
      const trimmed = sanitizeLine(line);
      if (!trimmed) return;
      writer.write(
        buildStatusPart(step.id, {
          role: 'adapter',
          status: 'running',
          step: isStderr ? `stderr: ${trimmed}` : trimmed,
          lastLine: trimmed,
        }),
      );
    };

    signal.addEventListener('abort', onAbort);

    const cleanup = () => {
      CHILDREN.delete(child);
      signal.removeEventListener('abort', onAbort);
    };

    const stdoutRl = readline.createInterface({ input: child.stdout });
    const stderrRl = readline.createInterface({ input: child.stderr });

    stdoutRl.on('line', (line) => emitLine(line));
    stderrRl.on('line', (line) => emitLine(line, true));

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
        reject(new Error('request aborted'));
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

type AdapterRequestBody = {
  action?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as AdapterRequestBody;
  const action = isAdapterAction(body.action) ? body.action : 'fuse-and-deploy';
  const steps = ACTION_PLAN[action];

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await Sentry.startSpan(
        { op: 'ai.agent', name: 'adapter.trigger' },
        async () => {
          const planStart = Date.now();
          writer.write(
            buildStatusPart('adapter', {
              role: 'adapter',
              status: 'running',
              step: `action=${action}`,
            }),
          );

          try {
            for (const step of steps) {
              if (req.signal.aborted) {
                throw new Error('request aborted');
              }
              writer.write(
                buildStatusPart(step.id, {
                  role: 'adapter',
                  status: 'running',
                  step: `starting ${step.label}`,
                }),
              );
              await runStep(step, writer, req.signal);
              writer.write(
                buildStatusPart(step.id, {
                  role: 'adapter',
                  status: 'ok',
                  step: `${step.label} complete`,
                }),
              );
            }

            const durationSeconds = (Date.now() - planStart) / 1000;
            writer.write(
              buildNotificationPart('adapter', {
                taskId: 'adapter',
                status: 'ok',
                summary: `Action ${action} completed in ${durationSeconds.toFixed(1)}s`,
                result: JSON.stringify({ action, durationSeconds, steps: steps.map((s) => s.id) }),
              }),
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const durationSeconds = (Date.now() - planStart) / 1000;
            writer.write(
              buildNotificationPart('adapter', {
                taskId: 'adapter',
                status: 'err',
                summary: msg.slice(0, 400),
                result: JSON.stringify({ action, durationSeconds, error: msg.slice(0, 400) }),
              }),
            );
          }
        },
      );
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      return msg.slice(0, 400);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
