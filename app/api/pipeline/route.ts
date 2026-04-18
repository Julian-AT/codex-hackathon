// app/api/pipeline/route.ts
// Coordinator SSE endpoint. Fans N parallel worker sub-streams into one client
// SSE via createUIMessageStream + writer.merge (AI SDK v6), with each worker
// wrapped in a Sentry ai.agent span.
//
// Contract (PRD §10.4):
//   POST { prompt: string } -> text/event-stream of typed UI chunks:
//     - data-agent-status  (transient) : role/status/step pings per worker id
//     - data-task-notification (persistent) : terminal per-worker result
//
// Runtime pins:
//   - 'nodejs' — consistency with /api/train (child_process). Required even though
//     this route itself doesn't spawn subprocesses, so provider SDKs can use Node APIs.
//   - 'force-dynamic' — never static-optimize a POST SSE route.

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createCoordinator } from '@/lib/coordinator/coordinator';
import { buildStatusPart } from '@/lib/coordinator/taskNotification';

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
        // ASVS V7: truncate error bodies — never echo provider 401/403/429 headers.
        const msg =
          e instanceof Error ? e.message.slice(0, 400) : 'coordinator error';
        writer.write(
          buildStatusPart('coordinator', {
            role: 'coordinator',
            status: 'err',
            step: msg,
          }),
        );
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      return msg.slice(0, 400);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
