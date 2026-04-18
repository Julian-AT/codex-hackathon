import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// HARD CONSTRAINT (PRD §13): child_process-using routes MUST be nodejs runtime.
// This route doesn't spawn, but we cement the pattern here for downstream routes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_ALIAS = 'gpt-5';
const GOOGLE_ALIAS = 'gemini-3.1-flash-lite';

export async function GET() {
  const prompt = 'Reply with the single word: pong.';

  const [o, g] = await Promise.allSettled([
    generateText({
      model: openai(OPENAI_ALIAS),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.openai' },
    }),
    generateText({
      model: google(GOOGLE_ALIAS),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.google' },
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
    google: summarize(g, GOOGLE_ALIAS),
  });
}
