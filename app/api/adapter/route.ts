import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import * as Sentry from '@sentry/nextjs';
import {
  buildNotificationPart,
  buildStatusPart,
} from '@/lib/coordinator/taskNotification';
import { toErrorMessage } from '@/lib/server/errors';
import {
  createChildProcessRegistry,
  terminateChild,
} from '@/lib/server/processes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registry = createChildProcessRegistry();

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
    const child = registry.track(
      spawn('bash', [step.script, ...(step.args ?? [])], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as ChildProcessWithoutNullStreams,
    );

    let abortedBySignal = false;

    const onAbort = () => {
      abortedBySignal = true;
      terminateChild(child);
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
      registry.untrack(child);
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
            const msg = toErrorMessage(error);
            const durationSeconds = (Date.now() - planStart) / 1000;
            writer.write(
              buildNotificationPart('adapter', {
                taskId: 'adapter',
                status: 'err',
                summary: msg,
                result: JSON.stringify({ action, durationSeconds, error: msg }),
              }),
            );
          }
        },
      );
    },
    onError: (error) => toErrorMessage(error),
  });

  return createUIMessageStreamResponse({ stream });
}
