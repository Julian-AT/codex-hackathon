import { tool, createUIMessageStream } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { LimitFunction } from 'p-limit';

import { WORKER_ROLES, runRole, type WorkerRole } from '@/lib/workers/roles';
import {
  buildStatusPart,
  buildNotificationPart,
} from '@/lib/coordinator/taskNotification';
import {
  withAgentSpan,
  setToolCallAttributes,
} from '@/lib/observability/agentSpans';
import { toErrorMessage } from '@/lib/server/errors';
import { mergeWorkerStream } from '@/lib/streams/mergeWriter';

const WORKER_TIMEOUT_MS = 90_000;

const spawnWorkerSchema = z.object({
  id: z.string().min(1),
  role: z.enum(WORKER_ROLES),
  prompt: z.string().min(1),
});

export function createSpawnWorkerTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer: UIMessageStreamWriter<any>,
  limiter: LimitFunction,
) {
  return tool({
    description:
      'Delegate a scoped subtask to a typed worker role. The coordinator NEVER does domain work itself — it only calls this tool.',
    inputSchema: spawnWorkerSchema,
    execute: async (args) => {
      const { id, role, prompt } = args as z.infer<typeof spawnWorkerSchema>;
      return limiter(() =>
        withAgentSpan(role as WorkerRole, id, async () => {
          setToolCallAttributes('spawnWorker', { id, role });

          const sub = createUIMessageStream({
            execute: async ({ writer: sub }) => {
              sub.write(
                buildStatusPart(id, { role, status: 'running', step: 'boot' }),
              );
              try {
                const result = await runRole(
                  role as WorkerRole,
                  prompt,
                  AbortSignal.timeout(WORKER_TIMEOUT_MS),
                );
                sub.write(
                  buildNotificationPart(id, {
                    taskId: id,
                    status: 'ok',
                    summary: result.text.slice(0, 200),
                    result: result.text,
                    usage: result.usage,
                  }),
                );
              } catch (e) {
                const err = e as { name?: string; message?: string };
                const isTimeout =
                  err?.name === 'TimeoutError' ||
                  err?.name === 'AbortError' ||
                  /timeout/i.test(err?.message ?? '');
                const msg = toErrorMessage(e, 'worker error');
                sub.write(
                  buildNotificationPart(id, {
                    taskId: id,
                    status: isTimeout ? 'timeout' : 'err',
                    summary: msg,
                  }),
                );
              }
            },
          });
          mergeWorkerStream(writer, sub);

          return { taskId: id, status: 'spawned' as const };
        }),
      );
    },
  });
}
