// lib/coordinator/spawnWorker.ts
// Factory for the `spawnWorker` tool that the coordinator invokes to delegate
// a scoped subtask. Each spawn:
//   - gets its own Sentry `ai.agent` span (worker.role/worker.id attributes)
//   - emits a transient data-agent-status 'running' part immediately
//   - runs runRole() with a 90s AbortSignal wall-clock budget (PITFALLS P10)
//   - emits a persistent data-task-notification with final status
//
// Plan deviations (Rule 3, recorded here for SUMMARY):
//   - ai@6.0.168 tool() uses `inputSchema` (not `parameters`). Adjusted.
//   - writer.merge() has no options arg in this version; no-op — see mergeWriter.ts.

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

          // Fire-and-merge the worker's sub-stream so terminal + status parts
          // land on the single client SSE via writer.merge().
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
                const msg = (err?.message ?? 'worker error').slice(0, 400);
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

          // Return to the coordinator LLM immediately — the worker runs async
          // via writer.merge. The coordinator MUST NOT wait on a worker result
          // before issuing the next spawnWorker call (ORC-01 parallelism).
          return { taskId: id, status: 'spawned' as const };
        }),
      );
    },
  });
}
