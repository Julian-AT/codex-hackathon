import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// HARD CONSTRAINT (PRD §13): child_process-using routes MUST be nodejs runtime.
// This route doesn't spawn, but we cement the pattern here for downstream routes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pin the Anthropic baseURL so local `ANTHROPIC_BASE_URL` (e.g. Claude Code
// proxy on localhost:4141) never shadows the real endpoint for smoke tests.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

// Plan 01-01 step 5: Anthropic alias drifts. Primary was `claude-opus-4-5`;
// at H0 the public API only recognizes `claude-opus-4-7`. If this 404s, swap
// to `claude-opus-4-latest` — DO NOT silently retry; surface the failure.
const ANTHROPIC_ALIAS = 'claude-opus-4-7';
const OPENAI_ALIAS = 'gpt-5';
const GOOGLE_ALIAS = 'gemini-2.5-pro';

export async function GET() {
  const prompt = 'Reply with the single word: pong.';

  const [a, o, g] = await Promise.allSettled([
    generateText({
      model: anthropic(ANTHROPIC_ALIAS),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.anthropic' },
    }),
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
    anthropic: summarize(a, ANTHROPIC_ALIAS),
    openai: summarize(o, OPENAI_ALIAS),
    google: summarize(g, GOOGLE_ALIAS),
  });
}
