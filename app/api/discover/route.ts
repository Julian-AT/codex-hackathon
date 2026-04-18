// app/api/discover/route.ts
// Discovery pipeline endpoint. Triggers the 4-worker tool-design swarm,
// streams progress via createUIMessageStream, emits data-agent-status (transient)
// per worker and gate, and data-task-notification (persistent) on completion or
// SWR-08 kill-point fallback.
//
// No user input accepted — this is a trigger-only endpoint (PRD §13).
// Runtime: 'nodejs' for child_process compatibility (tech stack lock).

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import * as Sentry from '@sentry/nextjs';
import { fetchCorpus } from '@/lib/discovery/corpus';
import { runDiscoveryPipeline, KillPointError } from '@/lib/discovery/pipeline';
import { buildStatusPart, buildNotificationPart } from '@/lib/coordinator/taskNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await Sentry.startSpan(
        { op: 'ai.agent', name: 'discovery.pipeline' },
        async () => {
          writer.write(
            buildStatusPart('coordinator', {
              role: 'coordinator',
              status: 'running',
              step: 'fetch-corpus',
            }),
          );
          const corpus = await fetchCorpus();

          try {
            const result = await runDiscoveryPipeline({
              corpus,
              onEvent: (ev) => {
                if (ev.type === 'worker-start') {
                  writer.write(
                    buildStatusPart(ev.workerId, {
                      role: 'tool-design',
                      status: 'running',
                      step: 'generating',
                    }),
                  );
                } else if (ev.type === 'worker-ok') {
                  writer.write(
                    buildStatusPart(ev.workerId, {
                      role: 'tool-design',
                      status: 'ok',
                      step: `candidates=${ev.candidates}`,
                    }),
                  );
                } else if (ev.type === 'worker-err') {
                  writer.write(
                    buildStatusPart(ev.workerId, {
                      role: 'tool-design',
                      status: 'err',
                      step: ev.error ?? 'unknown',
                    }),
                  );
                } else if (ev.type === 'gate-pass') {
                  writer.write(
                    buildStatusPart(`gate:${ev.toolName}`, {
                      role: 'validator',
                      status: 'ok',
                      step: 'pass',
                    }),
                  );
                } else if (ev.type === 'gate-fail') {
                  writer.write(
                    buildStatusPart(`gate:${ev.toolName}`, {
                      role: 'validator',
                      status: 'err',
                      step: `${ev.gate}: ${ev.reason ?? ''}`,
                    }),
                  );
                } else if (ev.type === 'manifest-written') {
                  writer.write(
                    buildNotificationPart('manifest', {
                      taskId: 'manifest',
                      status: 'ok',
                      summary: `wrote ${ev.count} tools (${ev.source})`,
                      result: JSON.stringify({
                        source: ev.source,
                        count: ev.count,
                      }),
                    }),
                  );
                }
              },
            });
            writer.write(
              buildNotificationPart('coordinator', {
                taskId: 'coordinator',
                status: 'ok',
                summary: `pipeline complete: ${result.tools.length} tools (${result.source})`,
                result: JSON.stringify({
                  count: result.tools.length,
                  source: result.source,
                }),
              }),
            );
          } catch (err) {
            if (err instanceof KillPointError) {
              writer.write(
                buildNotificationPart('coordinator', {
                  taskId: 'coordinator',
                  status: 'ok',
                  summary:
                    'SWR-08 kill-point: fell back to 8 hand-written tools',
                  result: JSON.stringify({
                    source: 'fallback',
                    count: 8,
                    code: err.code,
                  }),
                }),
              );
            } else {
              // T-03-20: truncate error to 400 chars — never leak raw provider errors
              const msg = (err as Error).message ?? String(err);
              writer.write(
                buildNotificationPart('coordinator', {
                  taskId: 'coordinator',
                  status: 'err',
                  summary: msg.slice(0, 400),
                }),
              );
            }
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
