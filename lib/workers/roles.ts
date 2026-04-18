// lib/workers/roles.ts
// Worker role registry. Bodies are stubs until Phases 3/4/5 wire real logic.
// Keeping the enum closed here lets coordinator zod schema stay in lockstep.

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const WORKER_ROLES = [
  'discovery',
  'tool-design',
  'data-gen-qa',
  'data-gen-traj',
  'eval-gen',
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];

const OPENAI_ALIAS = 'gpt-5';
const OPENAI_FALLBACK_ALIAS = 'gpt-5-mini';

export type RoleResult = {
  text: string;
  usage?: unknown;
};

/**
 * runRole: Phase-2 stub. Calls an LLM with the given prompt and returns text.
 * Phases 3/4/5 will specialize each role with its own toolset + system prompt.
 *
 * On OpenAI 429 (PITFALLS P22) falls over to gpt-5-mini once.
 */
export async function runRole(
  role: WorkerRole,
  prompt: string,
  signal?: AbortSignal,
): Promise<RoleResult> {
  const system = `You are a ${role} worker in a coordinator/worker pipeline. Reply concisely.`;
  try {
    const r = await generateText({
      model: openai(OPENAI_ALIAS),
      system,
      prompt,
      abortSignal: signal,
      experimental_telemetry: { isEnabled: true, functionId: `worker.${role}` },
    });
    return { text: r.text, usage: r.usage };
  } catch (e) {
    const err = e as { statusCode?: number; name?: string };
    if (err?.statusCode === 429) {
      const r = await generateText({
        model: openai(OPENAI_FALLBACK_ALIAS),
        system,
        prompt,
        abortSignal: signal,
        experimental_telemetry: {
          isEnabled: true,
          functionId: `worker.${role}.fallback`,
        },
      });
      return { text: r.text, usage: r.usage };
    }
    throw e;
  }
}
