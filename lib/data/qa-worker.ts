/**
 * QA data-gen worker — grounded Q&A examples via a configurable frontier model.
 * Source of truth: PRD SS7.1, SS7.2, DAT-01, DAT-03 and plan 04-03.
 *
 * Fan-out under p-limit(15), persona x difficulty x chunk stratification,
 * schema-gate enforcement with reject-never-patch (DAT-03), rate-limit retry.
 */

import { generateObject } from 'ai';
import { getModel } from '@/lib/model';
import pLimit from 'p-limit';
import type { Chunk, DynamicToolSpec } from '../discovery/types';
import type {
  TrainingExample,
  ChatMessage,
  ToolCall,
  DataGenMeta,
} from './types';
import { samplePersona, sampleDifficulty, makeRng } from './personas';
import { validateToolCall } from './schema-gate';
import { normalizeToolArguments } from '../tool-args';
import { createBatchCheckpointWriter } from './checkpoint';
import {
  QA_RESPONSE_SCHEMA,
  buildQASystemPrompt,
  buildQAUserPrompt,
} from './qa-prompts';

const MODEL = getModel();

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface QABatchOptions {
  trainChunks: Chunk[];
  tools: DynamicToolSpec[];
  count?: number; // default 500
  concurrency?: number; // default 15
  seed?: string; // default 'qa-gen-v1'
  maxRetries?: number; // default 2
  onProgress?: (done: number, total: number) => void;
}

export interface QABatchResult {
  examples: TrainingExample[];
  meta: DataGenMeta[];
  rejected: number;
}

/* ------------------------------------------------------------------ */
/*  Core generator                                                    */
/* ------------------------------------------------------------------ */

export async function generateQABatch(
  opts: QABatchOptions,
): Promise<QABatchResult> {
  const {
    trainChunks,
    tools,
    count = 500,
    concurrency = 15,
    seed = 'qa-gen-v1',
    maxRetries = 2,
    onProgress,
  } = opts;

  const limit = pLimit(concurrency);
  const rng = makeRng(seed);
  const examples: TrainingExample[] = [];
  const meta: DataGenMeta[] = [];
  const checkpoint = await createBatchCheckpointWriter('qa');
  let rejected = 0;
  let done = 0;

  /* Pre-compute assignments: persona x difficulty x chunk window */
  const assignments = Array.from({ length: count }, (_v, i) => {
    const persona = samplePersona(rng);
    const difficulty = sampleDifficulty(rng);
    // 1 chunk for easy, 2 for medium, 3 for hard
    const numChunks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const startIdx = Math.floor(rng() * trainChunks.length);
    const selectedChunks: Chunk[] = [];
    for (let j = 0; j < numChunks; j++) {
      selectedChunks.push(trainChunks[(startIdx + j) % trainChunks.length]);
    }
    return { index: i, persona, difficulty, chunks: selectedChunks };
  });

  /* Generate a single QA pair with retry support */
  const generateOne = async (
    assignment: (typeof assignments)[0],
    attempt = 0,
    negFeedback?: string,
  ): Promise<void> => {
    const { persona, difficulty, chunks } = assignment;
    const chunkIds = chunks.map((c) => c.id);

    try {
      const systemPrompt = buildQASystemPrompt(persona, tools);
      let userPrompt = buildQAUserPrompt(difficulty, chunks);
      if (negFeedback) {
        userPrompt += `\n\n[PREVIOUS ATTEMPT REJECTED: ${negFeedback}. Fix the issue.]`;
      }

      const { object: result } = await generateObject({
        model: MODEL,
        schema: QA_RESPONSE_SCHEMA,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'data-gen-qa',
        },
      });

      /* Schema-gate: validate any tool_calls (DAT-03 reject-never-patch) */
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const tc of result.toolCalls) {
          const validation = validateToolCall(
            tc.name,
            normalizeToolArguments(tc.arguments),
          );
          if (!validation.valid) {
            if (attempt < maxRetries) {
              return generateOne(
                assignment,
                attempt + 1,
                `Tool call to '${tc.name}' failed schema validation: ${validation.errors?.join('; ')}`,
              );
            }
            rejected++;
            return; // DAT-03: reject, never patch
          }
        }
      }

      /* Convert Zod output into TrainingExample.messages */
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a Supabase specialist assistant. ${persona.voice}`,
        },
        { role: 'user', content: result.question },
      ];

      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolCallObjs: ToolCall[] = result.toolCalls.map((tc, idx) => ({
          id: `call_${assignment.index}_${idx}`,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(normalizeToolArguments(tc.arguments)),
          },
        }));
        messages.push({
          role: 'assistant',
          content: result.reasoning ?? '',
          tool_calls: toolCallObjs,
        });
        // Tool response stubs — for QA the answer IS the grounded response
        for (const tc of toolCallObjs) {
          messages.push({
            role: 'tool',
            content: JSON.stringify({ result: 'See answer below' }),
            tool_call_id: tc.id,
            name: tc.function.name,
          });
        }
        messages.push({ role: 'assistant', content: result.answer });
      } else {
        messages.push({ role: 'assistant', content: result.answer });
      }

      const example = { messages, tools };
      const metaEntry = {
        persona: persona.id,
        difficulty,
        sourceChunks: chunkIds,
        generator: 'local',
      } satisfies DataGenMeta;

      examples.push(example);
      meta.push(metaEntry);
      await checkpoint.record(example, metaEntry);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 429 && attempt < maxRetries) {
        // Exponential backoff on rate limit
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        return generateOne(assignment, attempt + 1);
      }
      rejected++;
    } finally {
      done++;
      onProgress?.(done, count);
    }
  };

  await Promise.all(assignments.map((a) => limit(() => generateOne(a))));
  await checkpoint.close();

  return { examples, meta, rejected };
}
