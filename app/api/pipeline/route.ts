import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createCoordinator } from '@/lib/coordinator/coordinator';
import { buildStatusPart } from '@/lib/coordinator/taskNotification';
import { toErrorMessage } from '@/lib/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req
    .json()
    .catch(() => ({ prompt: 'Launch 2 discovery workers in parallel for smoke test.' }));
  const prompt =
    typeof (body as { prompt?: unknown }).prompt === 'string'
      ? (body as { prompt: string }).prompt
      : 'Launch 2 discovery workers in parallel.';

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const coordinator = createCoordinator(writer);
      try {
        await coordinator.generate({ prompt, abortSignal: req.signal });
      } catch (e) {
        writer.write(
          buildStatusPart('coordinator', {
            role: 'coordinator',
            status: 'err',
            step: toErrorMessage(e, 'coordinator error'),
          }),
        );
      }
    },
    onError: (error) => toErrorMessage(error),
  });

  return createUIMessageStreamResponse({ stream });
}
