// app/api/data-gen/route.ts
// Phase 4 data generation pipeline endpoint. Triggers the full pipeline
// (QA + Traj -> judge -> dedup -> stratify -> emit), streams progress via
// createUIMessageStream, emits data-agent-status per pipeline stage and
// data-task-notification on completion.
//
// No user input accepted -- trigger-only endpoint (PRD SS13).
// Runtime: 'nodejs' for child_process compatibility (tech stack lock).

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import * as Sentry from '@sentry/nextjs';
import { runDataGenPipeline } from '@/lib/data/pipeline';
import {
  buildStatusPart,
  buildNotificationPart,
} from '@/lib/coordinator/taskNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await Sentry.startSpan(
        { op: 'ai.agent', name: 'data-gen.pipeline' },
        async () => {
          try {
            const result = await runDataGenPipeline({
              onEvent: (ev) => {
                writer.write(
                  buildStatusPart(`data-gen:${ev.stage}`, {
                    role: 'data-gen',
                    status: ev.status === 'start' ? 'running' : ev.status,
                    step: `${ev.stage}: ${ev.detail ?? ''}`,
                  }),
                );
              },
            });
            writer.write(
              buildNotificationPart('data-gen', {
                taskId: 'data-gen',
                status: 'ok',
                summary: `Pipeline complete: ${result.training.count} training + ${result.eval.count} eval`,
                result: JSON.stringify(result),
              }),
            );
          } catch (err) {
            // T-04-16: truncate error to 400 chars -- never leak raw provider errors
            const msg = (err as Error).message ?? String(err);
            writer.write(
              buildNotificationPart('data-gen', {
                taskId: 'data-gen',
                status: 'err',
                summary: msg.slice(0, 400),
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
