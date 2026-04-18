import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import * as Sentry from '@sentry/nextjs';
import { runDataGenPipeline } from '@/lib/data/pipeline';
import {
  buildStatusPart,
  buildNotificationPart,
} from '@/lib/coordinator/taskNotification';
import { toErrorMessage } from '@/lib/server/errors';

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
            const msg = toErrorMessage(err, 'data generation failed', 320);
            writer.write(
              buildNotificationPart('data-gen', {
                taskId: 'data-gen',
                status: 'err',
                summary: `${msg} Partial checkpoints saved in data/checkpoints/.`,
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
