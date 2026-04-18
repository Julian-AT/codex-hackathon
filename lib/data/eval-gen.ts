/**
 * GPT-5 cross-family eval set generator — DAT-10.
 * Produces 70 held-out eval items from the 30% eval-split chunks.
 * Generator: GPT-5 (NOT Opus 4.7 — cross-family for anti-leakage).
 *
 * Composition: 40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool.
 * Each EvalItem has { id, kind, prompt, expected?, expectedToolCalls?, sourceChunks }.
 *
 * Plan 04-05, Task 1.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as Sentry from '@sentry/nextjs';
import pLimit from 'p-limit';
import { z } from 'zod';
import type { Chunk, DynamicToolSpec } from '../discovery/types';
import type { EvalItem, ToolCall } from './types';
import { normalizeToolArguments } from '../tool-args';

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const EVAL_QA_SCHEMA = z.object({
  prompt: z.string().min(10),
  expected: z.string().min(10),
});

const EVAL_TOOL_SCHEMA = z.object({
  prompt: z.string().min(10),
  expectedToolCalls: z
    .array(
      z.object({
        name: z.string(),
        arguments: z
          .string()
          .describe('JSON string: object of tool arguments per the tool parameter schema'),
      }),
    )
    .min(1),
  expectedAnswer: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface EvalGenOptions {
  evalChunks: Chunk[];
  tools: DynamicToolSpec[];
  counts?: {
    factual?: number;
    reasoning?: number;
    singleTurnTool?: number;
    multiTurnTool?: number;
  };
  concurrency?: number;
}

/* ------------------------------------------------------------------ */
/*  Internal generators                                                */
/* ------------------------------------------------------------------ */

const generateQAItem = async (
  model: ReturnType<typeof openai>,
  kind: 'factual' | 'reasoning',
  chunks: Chunk[],
  idx: number,
): Promise<EvalItem> => {
  const { object } = await Sentry.startSpan(
    { op: 'ai.agent', name: `eval-gen.${kind}` },
    () =>
      generateObject({
        model,
        schema: EVAL_QA_SCHEMA,
        system:
          kind === 'factual'
            ? 'Generate a factual question answerable from the documentation below. Include the expected answer.'
            : 'Generate a multi-hop reasoning question requiring synthesis across the documentation below. Include the expected answer.',
        prompt: chunks.map((c) => c.text).join('\n---\n'),
        temperature: 0.5,
        experimental_telemetry: {
          isEnabled: true,
          functionId: `eval-gen.${kind}`,
        },
      }),
  );
  return {
    id: `eval-${kind}-${idx}`,
    kind,
    prompt: object.prompt,
    expected: object.expected,
    sourceChunks: chunks.map((c) => c.id),
  };
};

const generateToolItem = async (
  model: ReturnType<typeof openai>,
  kind: 'single-turn-tool' | 'multi-turn-tool',
  chunks: Chunk[],
  selectedTools: DynamicToolSpec[],
  idx: number,
): Promise<EvalItem> => {
  const toolDescs = selectedTools
    .map(
      (t) =>
        `- ${t.function.name}: ${t.function.description} (params: ${JSON.stringify(t.function.parameters)})`,
    )
    .join('\n');
  const { object } = await Sentry.startSpan(
    { op: 'ai.agent', name: `eval-gen.${kind}` },
    () =>
      generateObject({
        model,
        schema: EVAL_TOOL_SCHEMA,
        system:
          kind === 'single-turn-tool'
            ? `Generate a user query that requires calling exactly one of these tools with correct arguments:\n${toolDescs}\nInclude the expected tool call.`
            : `Generate a multi-turn user scenario (2-4 turns) that requires calling 2+ of these tools:\n${toolDescs}\nInclude all expected tool calls in order.`,
        prompt: chunks.map((c) => c.text).join('\n---\n'),
        temperature: 0.5,
        experimental_telemetry: {
          isEnabled: true,
          functionId: `eval-gen.${kind}`,
        },
      }),
  );
  const expectedToolCalls: ToolCall[] = object.expectedToolCalls.map(
    (tc, i) => ({
      id: `eval_call_${idx}_${i}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(normalizeToolArguments(tc.arguments)),
      },
    }),
  );
  return {
    id: `eval-${kind}-${idx}`,
    kind,
    prompt: object.prompt,
    expected: object.expectedAnswer,
    expectedToolCalls,
    sourceChunks: chunks.map((c) => c.id),
  };
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function generateEvalSet(
  opts: EvalGenOptions,
): Promise<EvalItem[]> {
  const {
    evalChunks,
    tools,
    concurrency = 15,
    counts = {
      factual: 40,
      reasoning: 10,
      singleTurnTool: 15,
      multiTurnTool: 5,
    },
  } = opts;
  const limit = pLimit(concurrency);
  const model = openai('gpt-5'); // Cross-family from Opus training data (DAT-10)
  const items: EvalItem[] = [];

  const tasks: Promise<void>[] = [];
  let idx = 0;

  // Factual Q&A
  for (let i = 0; i < (counts.factual ?? 40); i++) {
    const chunkIdx = i % evalChunks.length;
    const chunks = [evalChunks[chunkIdx]];
    const currentIdx = idx++;
    tasks.push(
      limit(async () => {
        items.push(await generateQAItem(model, 'factual', chunks, currentIdx));
      }),
    );
  }

  // Reasoning Q&A
  for (let i = 0; i < (counts.reasoning ?? 10); i++) {
    const startIdx = (i * 3) % evalChunks.length;
    const chunks = [
      evalChunks[startIdx % evalChunks.length],
      evalChunks[(startIdx + 1) % evalChunks.length],
      evalChunks[(startIdx + 2) % evalChunks.length],
    ];
    const currentIdx = idx++;
    tasks.push(
      limit(async () => {
        items.push(
          await generateQAItem(model, 'reasoning', chunks, currentIdx),
        );
      }),
    );
  }

  // Single-turn tool
  for (let i = 0; i < (counts.singleTurnTool ?? 15); i++) {
    const chunkIdx = i % evalChunks.length;
    const toolIdx = i % tools.length;
    const currentIdx = idx++;
    tasks.push(
      limit(async () => {
        items.push(
          await generateToolItem(
            model,
            'single-turn-tool',
            [evalChunks[chunkIdx]],
            [tools[toolIdx]],
            currentIdx,
          ),
        );
      }),
    );
  }

  // Multi-turn tool
  for (let i = 0; i < (counts.multiTurnTool ?? 5); i++) {
    const chunkIdx = i % evalChunks.length;
    const tool1 = tools[i % tools.length];
    const tool2 = tools[(i + 1) % tools.length];
    const currentIdx = idx++;
    tasks.push(
      limit(async () => {
        items.push(
          await generateToolItem(
            model,
            'multi-turn-tool',
            [
              evalChunks[chunkIdx],
              evalChunks[(chunkIdx + 1) % evalChunks.length],
            ],
            [tool1, tool2],
            currentIdx,
          ),
        );
      }),
    );
  }

  await Promise.all(tasks);
  return items;
}
