/**
 * JSONL emission — DAT-08 kill-point (training) + DAT-09 (overlap check) + eval.
 *
 * emitTrainingJsonl: writes one JSON object per line in mlx-lm `tools` format.
 *   Each line: { messages: [...], tools: [...] }
 *   The `tools` array uses OpenAI function-calling schema (strip `meta` from DynamicToolSpec).
 *
 * emitEvalJsonl: writes one EvalItem per line.
 *
 * verifyNoOverlap: DAT-09 hash-verified no training sourceChunks in eval set.
 *
 * Plan 04-05, Task 1.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TrainingExample, EvalItem } from './types';
import type { DynamicToolSpec } from '../discovery/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const TRAINING_JSONL_PATH = path.resolve('data/training.jsonl');
export const EVAL_JSONL_PATH = path.resolve('data/eval.jsonl');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Strip `meta` from DynamicToolSpec to produce the OpenAI function-calling
 * schema shape that mlx-lm expects in the `tools` field.
 */
function stripMeta(
  tools: DynamicToolSpec[],
): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

/* ------------------------------------------------------------------ */
/*  Training JSONL (DAT-08 kill-point)                                 */
/* ------------------------------------------------------------------ */

/** Emit training.jsonl in mlx-lm `tools` format -- DAT-08 kill-point. */
export async function emitTrainingJsonl(
  examples: TrainingExample[],
  outPath = TRAINING_JSONL_PATH,
): Promise<void> {
  const lines = examples.map((ex) => {
    // Strip meta from tools for mlx-lm compatibility
    const cleanTools = stripMeta(ex.tools);
    // Strip undefined fields from messages for clean JSON
    const cleanMessages = ex.messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls && m.tool_calls.length > 0) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      return msg;
    });
    return JSON.stringify({ messages: cleanMessages, tools: cleanTools });
  });
  await writeFile(outPath, lines.join('\n') + '\n', 'utf8');
}

/* ------------------------------------------------------------------ */
/*  Eval JSONL                                                         */
/* ------------------------------------------------------------------ */

/** Emit eval.jsonl -- one EvalItem per line. */
export async function emitEvalJsonl(
  items: EvalItem[],
  outPath = EVAL_JSONL_PATH,
): Promise<void> {
  const lines = items.map((item) => JSON.stringify(item));
  await writeFile(outPath, lines.join('\n') + '\n', 'utf8');
}

/* ------------------------------------------------------------------ */
/*  Overlap verification (DAT-09)                                      */
/* ------------------------------------------------------------------ */

/**
 * DAT-09: verify no training example references an eval-split chunk.
 * Collects all sourceChunks from training meta, asserts none appear in the eval set.
 */
export async function verifyNoOverlap(
  trainingSourceChunks: string[][],
  evalChunkIds: string[],
): Promise<{ overlap: string[]; pass: boolean }> {
  const evalSet = new Set(evalChunkIds);
  const overlap: string[] = [];
  for (const chunks of trainingSourceChunks) {
    for (const id of chunks) {
      if (evalSet.has(id)) overlap.push(id);
    }
  }
  return { overlap: [...new Set(overlap)], pass: overlap.length === 0 };
}
