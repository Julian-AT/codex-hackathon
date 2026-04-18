import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// HARD CONSTRAINT (PRD §13): child_process-using routes MUST be nodejs runtime.
// This route doesn't spawn, but we cement the pattern here for downstream routes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const prompt = 'Reply with the single word: pong.';

  const [a, o, g] = await Promise.allSettled([
    generateText({
      model: anthropic('claude-opus-4-5'),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.anthropic' },
    }),
    generateText({
      model: openai('gpt-5'),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.openai' },
    }),
    generateText({
      model: google('gemini-2.5-pro'),
      prompt,
      experimental_telemetry: { isEnabled: true, functionId: 'smoke.google' },
    }),
  ]);

  const summarize = (r: PromiseSettledResult<{ text: string }>) =>
    r.status === 'fulfilled'
      ? { ok: true, text: r.value.text }
      : { ok: false, error: String(r.reason).slice(0, 400) };

  return Response.json({
    anthropic: summarize(a),
    openai: summarize(o),
    google: summarize(g),
  });
}
