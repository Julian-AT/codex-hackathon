import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// HARD CONSTRAINT (PRD §13): child_process-using routes MUST be nodejs runtime.
// This route doesn't spawn, but we cement the pattern here for downstream routes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_ALIAS = 'gpt-5';
const OPENAI_MINI_ALIAS = 'gpt-5-mini';

export async function GET() {
  const prompt = 'Reply with the single word: pong.';

  const [o, m] = await Promise.allSettled([
    generateText({
      model: openai(OPENAI_ALIAS),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.openai' },
    }),
    generateText({
      model: openai(OPENAI_MINI_ALIAS),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.openaiMini' },
    }),
  ]);

  type Summary =
    | { ok: true; text: string; alias: string }
    | { ok: false; alias: string; name: string; status?: number; message: string };

  const summarize = (r: PromiseSettledResult<{ text: string }>, alias: string): Summary => {
    if (r.status === 'fulfilled') return { ok: true, text: r.value.text, alias };
    const e = r.reason as {
      name?: string;
      message?: string;
      statusCode?: number;
      responseBody?: string;
      cause?: { message?: string };
    };
    const message = (e?.message || e?.cause?.message || e?.responseBody || String(r.reason)).slice(0, 400);
    return { ok: false, alias, name: e?.name ?? 'Error', status: e?.statusCode, message };
  };

  return Response.json({
    openai: summarize(o, OPENAI_ALIAS),
    openaiMini: summarize(m, OPENAI_MINI_ALIAS),
  });
}
