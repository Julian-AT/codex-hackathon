/**
 * Prompt builders and Zod response schemas for 4 trajectory types.
 * Source of truth: PRD SS7.1 (APIGen, APIGen-MT, When2Call patterns).
 * Plan 04-04, Task 1.
 */

import { z } from 'zod';
import type { Chunk, DynamicToolSpec } from './types.js';

/* ------------------------------------------------------------------ */
/*  Zod response schemas for generateObject                          */
/* ------------------------------------------------------------------ */

export const SINGLE_TURN_SCHEMA = z.object({
  userQuery: z.string().min(10),
  toolCall: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.any()),
  }),
  toolResult: z.any(),
  assistantAnswer: z.string().min(20),
});

export const MULTI_TURN_SCHEMA = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'tool']),
        content: z.string(),
        toolCall: z
          .object({
            name: z.string(),
            arguments: z.record(z.string(), z.any()),
          })
          .optional(),
        toolCallId: z.string().optional(),
      }),
    )
    .min(4)
    .max(12),
});

export const PARALLEL_DEP_SCHEMA = z.object({
  userQuery: z.string().min(10),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.any()),
      }),
    )
    .min(2)
    .max(4),
  toolResults: z.array(z.any()).min(2),
  assistantAnswer: z.string().min(20),
  dependency: z.enum(['parallel', 'dependent']),
});

export const REFUSAL_SCHEMA = z.object({
  userQuery: z.string().min(10),
  refusalResponse: z.string().min(20),
});

/* ------------------------------------------------------------------ */
/*  Prompt builder helpers                                            */
/* ------------------------------------------------------------------ */

function chunkContext(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join('\n---\n');
}

function toolSummary(tool: DynamicToolSpec): string {
  return `Tool \`${tool.function.name}\`: ${tool.function.description}\nParameter schema: ${JSON.stringify(tool.function.parameters)}`;
}

/* ------------------------------------------------------------------ */
/*  Single-turn (APIGen pattern)                                     */
/* ------------------------------------------------------------------ */

export function buildSingleTurnPrompt(
  tool: DynamicToolSpec,
  chunks: Chunk[],
): { system: string; user: string } {
  const system = [
    'You are generating a training example for a Supabase specialist model.',
    `The model will learn to use the tool \`${tool.function.name}\`: ${tool.function.description}.`,
    `Schema: ${JSON.stringify(tool.function.parameters)}`,
    '',
    'Rules:',
    '- The tool call arguments MUST conform exactly to the parameter schema above.',
    '- Use ONLY valid enum values where specified.',
    '- The assistant answer must be helpful, grounded, and reference the tool result.',
    '- Do NOT invent tools or argument names that are not in the schema.',
  ].join('\n');

  const user = [
    `Generate a realistic user query that requires invoking \`${tool.function.name}\` with valid arguments.`,
    `Ground the scenario in the following documentation context:`,
    '',
    `[CONTEXT]`,
    chunkContext(chunks),
    `[/CONTEXT]`,
    '',
    'Respond with:',
    '1. A natural user query (userQuery)',
    '2. The exact tool call with name and arguments (toolCall)',
    '3. A plausible tool result (toolResult)',
    '4. The assistant\'s final answer incorporating the result (assistantAnswer)',
  ].join('\n');

  return { system, user };
}

/* ------------------------------------------------------------------ */
/*  Multi-turn (APIGen-MT pattern)                                   */
/* ------------------------------------------------------------------ */

export function buildMultiTurnPrompt(
  tools: DynamicToolSpec[],
  chunks: Chunk[],
): { system: string; user: string } {
  const toolDescriptions = tools.map(toolSummary).join('\n\n');

  const system = [
    'You are generating a multi-turn conversation training example for a Supabase specialist model.',
    'The model will learn to use tools across multiple conversation turns.',
    '',
    'Available tools:',
    toolDescriptions,
    '',
    'Rules:',
    '- Generate a 2-6 turn conversation with interleaved tool calls and user follow-ups.',
    '- Each tool call MUST conform to its parameter schema exactly.',
    '- Use ONLY valid enum values where specified.',
    '- Tool responses should be plausible results.',
    '- Each turn must have role (user/assistant/tool), content, and optionally toolCall/toolCallId.',
    '- Assistant turns that call a tool must include a toolCall object.',
    '- Tool turns must include a toolCallId matching the previous assistant turn.',
    '- The conversation should feel natural, not forced.',
  ].join('\n');

  const user = [
    'Generate a realistic multi-turn conversation where the user asks follow-up questions',
    'that require different tool invocations. Use 2-3 of the available tools across the conversation.',
    '',
    'Ground the conversation in:',
    '',
    '[CONTEXT]',
    chunkContext(chunks),
    '[/CONTEXT]',
    '',
    'Return an array of turns. Each turn has: role, content, and optionally toolCall (for assistant) or toolCallId (for tool responses).',
  ].join('\n');

  return { system, user };
}

/* ------------------------------------------------------------------ */
/*  Parallel/dependent pattern                                       */
/* ------------------------------------------------------------------ */

export function buildParallelDepPrompt(
  toolPair: [DynamicToolSpec, DynamicToolSpec],
  chunks: Chunk[],
  depType: 'parallel' | 'dependent',
): { system: string; user: string } {
  const toolDescriptions = toolPair.map(toolSummary).join('\n\n');
  const depExplanation =
    depType === 'parallel'
      ? 'The two tool calls are INDEPENDENT — they can be executed in parallel with separate arguments.'
      : 'The two tool calls are DEPENDENT — the second call\'s arguments should reference or depend on the first call\'s result.';

  const system = [
    'You are generating a training example for a Supabase specialist model that needs to invoke MULTIPLE tools in a single turn.',
    '',
    'Available tools:',
    toolDescriptions,
    '',
    `Dependency type: ${depType}`,
    depExplanation,
    '',
    'Rules:',
    '- The user query must naturally require BOTH tools.',
    '- Each tool call MUST conform to its parameter schema exactly.',
    '- Use ONLY valid enum values where specified.',
    '- Provide plausible results for each tool call.',
    '- The assistant answer must synthesize results from both tool calls.',
  ].join('\n');

  const user = [
    `Generate a realistic user query that requires invoking both \`${toolPair[0].function.name}\` and \`${toolPair[1].function.name}\`.`,
    '',
    'Ground the scenario in:',
    '',
    '[CONTEXT]',
    chunkContext(chunks),
    '[/CONTEXT]',
    '',
    'Return:',
    '1. A natural user query (userQuery)',
    '2. An array of 2 tool calls with name and arguments (toolCalls)',
    '3. An array of 2 tool results (toolResults, matching the order of toolCalls)',
    '4. The assistant\'s final answer synthesizing both results (assistantAnswer)',
    `5. The dependency type: "${depType}"`,
  ].join('\n');

  return { system, user };
}

/* ------------------------------------------------------------------ */
/*  Refusal / no-tool (When2Call pattern)                            */
/* ------------------------------------------------------------------ */

export function buildRefusalPrompt(
  chunks: Chunk[],
): { system: string; user: string } {
  const system = [
    'You are generating a training example for a Supabase specialist model.',
    'In this scenario, the model must NOT call any tools. It must politely decline or answer from knowledge alone.',
    '',
    'Scenarios that require refusal:',
    '- Questions requiring live network data (API status, real-time metrics, current prices)',
    '- Questions completely outside the Supabase domain',
    '- Ambiguous or unclear requests that need clarification before any action',
    '- Requests for dangerous operations (DROP DATABASE, etc.) without confirmation',
    '',
    'Rules:',
    '- The response must NOT include any tool calls.',
    '- The refusal should be polite, explain WHY no tool is appropriate, and suggest alternatives if possible.',
    '- Keep the refusal concise but helpful.',
  ].join('\n');

  const user = [
    'Generate a user query where NO tool should be called.',
    'The model must decline or answer from knowledge alone.',
    '',
    'Context for grounding the scenario:',
    '',
    '[CONTEXT]',
    chunkContext(chunks),
    '[/CONTEXT]',
    '',
    'Return:',
    '1. A natural user query that should NOT trigger a tool call (userQuery)',
    '2. A polite, helpful refusal or knowledge-only answer (refusalResponse)',
  ].join('\n');

  return { system, user };
}
