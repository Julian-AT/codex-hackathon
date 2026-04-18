/**
 * Genstruct-style prompt builders for QA data generation.
 * Source of truth: PRD SS7.1, SS7.2 and plan 04-03.
 *
 * Exports:
 *   - QA_RESPONSE_SCHEMA  — Zod schema for structured Opus 4.7 output
 *   - buildQASystemPrompt — persona x tool-aware system prompt
 *   - buildQAUserPrompt   — difficulty-framed user prompt with [CONTEXT] block
 */

import { z } from 'zod';
import type { Persona, Difficulty } from './types';
import type { Chunk, DynamicToolSpec } from '../discovery/types';

/* ------------------------------------------------------------------ */
/*  Zod response schema                                               */
/* ------------------------------------------------------------------ */

export const QA_RESPONSE_SCHEMA = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(500, 'Question must be at most 500 characters'),
  answer: z
    .string()
    .min(20, 'Answer must be at least 20 characters')
    .max(2000, 'Answer must be at most 2000 characters'),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        // JSON string (object), not z.record(z.any()) — OpenAI response_format requires typed additionalProperties
        arguments: z
          .string()
          .describe(
            'JSON string: one JSON object of tool arguments matching that tool’s parameter schema, e.g. {"tableName":"profiles"}',
          ),
      }),
    )
    .optional(),
  reasoning: z.string().optional(),
});

export type QAResponse = z.infer<typeof QA_RESPONSE_SCHEMA>;

/* ------------------------------------------------------------------ */
/*  System prompt builder                                             */
/* ------------------------------------------------------------------ */

/**
 * Build the system prompt for Opus 4.7 QA generation.
 * Injects persona voice and available tool names/descriptions so the model
 * knows which tools exist and never invents tool names.
 */
export function buildQASystemPrompt(
  persona: Persona,
  tools: DynamicToolSpec[],
): string {
  const toolLines =
    tools.length > 0
      ? tools
          .map(
            (t) => `  - ${t.function.name}: ${t.function.description}`,
          )
          .join('\n')
      : '  (no tools available)';

  return [
    `Persona: ${persona.label}. ${persona.voice}`,
    '',
    'You are generating training data for a Supabase specialist model.',
    'Ground every answer in the provided documentation.',
    '',
    'Available tools:',
    toolLines,
    '',
    'If the question naturally involves one of the listed tools, include a toolCalls array',
    'with the tool name and arguments as a JSON string containing one object (keys/values per the tool schema).',
    'NEVER invent tool names or argument fields not in the schema.',
    'If no tool is relevant, omit toolCalls entirely.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/*  User prompt builder                                               */
/* ------------------------------------------------------------------ */

const DIFFICULTY_FRAMES: Record<Difficulty, string> = {
  easy: 'Generate a straightforward factual question answerable from one paragraph in the context below.',
  medium:
    'Generate a question that requires synthesizing information from multiple paragraphs below.',
  hard: 'Generate a multi-hop reasoning question that requires connecting concepts across the context below, possibly involving tool usage.',
};

/**
 * Build the user prompt for Opus 4.7 QA generation.
 * Frames difficulty, embeds chunk context, and instructs grounding.
 */
export function buildQAUserPrompt(
  difficulty: Difficulty,
  chunks: Chunk[],
): string {
  const contextBlock = chunks.map((c) => c.text).join('\n---\n');

  return [
    DIFFICULTY_FRAMES[difficulty],
    '',
    '[CONTEXT]',
    contextBlock,
    '[/CONTEXT]',
    '',
    'Respond with the question and answer. Ground every claim in the context.',
  ].join('\n');
}
