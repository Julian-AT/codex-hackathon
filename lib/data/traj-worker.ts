/**
 * Trajectory generation worker — DAT-02 + DAT-03.
 * Generates tool-call trajectories via a configurable frontier model with p-limit(15).
 *
 * 4 trajectory types:
 * - Single-turn (APIGen): user -> tool_call -> tool_response -> assistant
 * - Multi-turn (APIGen-MT): 2-6 turn conversation with interleaved tool calls
 * - Parallel/dependent: 2+ tool calls in a single assistant turn
 * - Refusal (When2Call): user query that should NOT trigger a tool call
 *
 * Plan 04-04, Task 2.
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import pLimit from 'p-limit';
import * as Sentry from '@sentry/nextjs';

import type { Chunk, DynamicToolSpec, TrainingExample, ChatMessage, DataGenMeta } from './types';
import { samplePersona, sampleDifficulty, makeRng } from './personas';
import { validateToolCall } from './schema-gate';
import {
  SINGLE_TURN_SCHEMA,
  MULTI_TURN_SCHEMA,
  PARALLEL_DEP_SCHEMA,
  REFUSAL_SCHEMA,
  buildSingleTurnPrompt,
  buildMultiTurnPrompt,
  buildParallelDepPrompt,
  buildRefusalPrompt,
} from './traj-prompts';

const DATA_GEN_MODEL = process.env.DATA_GEN_MODEL || 'gemini-3.1-flash-lite';
const MODEL = google(DATA_GEN_MODEL);

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface TrajCounts {
  singleTurn?: number;
  multiTurn?: number;
  parallelDep?: number;
  refusal?: number;
}

export interface TrajBatchOptions {
  trainChunks: Chunk[];
  tools: DynamicToolSpec[];
  counts?: TrajCounts;
  concurrency?: number;
  seed?: string;
  maxRetries?: number;
  onProgress?: (done: number, total: number, type: string) => void;
}

export interface TrajBatchResult {
  examples: TrainingExample[];
  meta: DataGenMeta[];
  rejected: number;
  byType: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_COUNTS: Required<TrajCounts> = {
  singleTurn: 800,
  multiTurn: 200,
  parallelDep: 100,
  refusal: 50,
};

/** Pick N random chunks from the pool using the given PRNG. */
function sampleChunks(chunks: Chunk[], n: number, rng: () => number): Chunk[] {
  const shuffled = [...chunks].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/** Pick a random tool, biased toward those with fewer examples so far. */
function sampleToolBiased(
  tools: DynamicToolSpec[],
  toolCounts: Map<string, number>,
  rng: () => number,
): DynamicToolSpec {
  // Inverse-frequency weighting: fewer examples = higher weight
  const weights = tools.map((t) => {
    const count = toolCounts.get(t.function.name) ?? 0;
    return 1 / (count + 1);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = rng() * totalWeight;
  for (let i = 0; i < tools.length; i++) {
    r -= weights[i];
    if (r <= 0) return tools[i];
  }
  return tools[tools.length - 1];
}

/** Pick N distinct tools. */
function sampleDistinctTools(
  tools: DynamicToolSpec[],
  n: number,
  rng: () => number,
): DynamicToolSpec[] {
  const shuffled = [...tools].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/* ------------------------------------------------------------------ */
/*  Single-turn generator                                            */
/* ------------------------------------------------------------------ */

async function generateSingleTurn(
  tool: DynamicToolSpec,
  chunks: Chunk[],
  allTools: DynamicToolSpec[],
  persona: ReturnType<typeof samplePersona>,
  difficulty: ReturnType<typeof sampleDifficulty>,
  maxRetries: number,
): Promise<{ example: TrainingExample; meta: DataGenMeta } | null> {
  const prompt = buildSingleTurnPrompt(tool, chunks);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const systemWithFeedback =
      attempt > 0
        ? `${prompt.system}\n\nPrevious attempt was rejected: ${lastError}. Fix the tool call arguments.`
        : prompt.system;

    const result = await Sentry.startSpan(
      {
        op: 'ai.agent',
        name: 'data-gen-traj',
        attributes: {
          trajType: 'single',
          toolNames: tool.function.name,
          chunkIds: chunks.map((c) => c.id).join(','),
        },
      },
      async () => {
        return generateObject({
          model: MODEL,
          schema: SINGLE_TURN_SCHEMA,
          system: `${systemWithFeedback}\n\nPersona: ${persona.voice}\nDifficulty: ${difficulty}`,
          prompt: prompt.user,
        });
      },
    );

    const obj = result.object;

    // Validate tool call via schema-gate (DAT-03)
    const validation = validateToolCall(obj.toolCall.name, obj.toolCall.arguments);
    if (!validation.valid) {
      lastError = `Schema-gate rejected: ${validation.errors?.join(', ')}`;
      continue;
    }

    // Convert to TrainingExample messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemWithFeedback },
      { role: 'user', content: obj.userQuery },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_0',
            type: 'function',
            function: {
              name: obj.toolCall.name,
              arguments: JSON.stringify(obj.toolCall.arguments),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify(obj.toolResult),
        tool_call_id: 'call_0',
        name: obj.toolCall.name,
      },
      { role: 'assistant', content: obj.assistantAnswer },
    ];

    return {
      example: { messages, tools: allTools },
      meta: {
        persona: persona.id,
        difficulty,
        sourceChunks: chunks.map((c) => c.id),
        generator: DATA_GEN_MODEL,
      },
    };
  }

  return null; // All retries exhausted
}

/* ------------------------------------------------------------------ */
/*  Multi-turn generator                                             */
/* ------------------------------------------------------------------ */

async function generateMultiTurn(
  tools: DynamicToolSpec[],
  chunks: Chunk[],
  allTools: DynamicToolSpec[],
  persona: ReturnType<typeof samplePersona>,
  difficulty: ReturnType<typeof sampleDifficulty>,
  maxRetries: number,
): Promise<{ example: TrainingExample; meta: DataGenMeta } | null> {
  const prompt = buildMultiTurnPrompt(tools, chunks);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const systemWithFeedback =
      attempt > 0
        ? `${prompt.system}\n\nPrevious attempt was rejected: ${lastError}. Fix the tool call arguments.`
        : prompt.system;

    const result = await Sentry.startSpan(
      {
        op: 'ai.agent',
        name: 'data-gen-traj',
        attributes: {
          trajType: 'multi',
          toolNames: tools.map((t) => t.function.name).join(','),
          chunkIds: chunks.map((c) => c.id).join(','),
        },
      },
      async () => {
        return generateObject({
          model: MODEL,
          schema: MULTI_TURN_SCHEMA,
          system: `${systemWithFeedback}\n\nPersona: ${persona.voice}\nDifficulty: ${difficulty}`,
          prompt: prompt.user,
        });
      },
    );

    const obj = result.object;

    // Validate ALL tool_calls across ALL turns (T-04-08 mitigation)
    let allValid = true;
    for (const turn of obj.turns) {
      if (turn.toolCall) {
        const validation = validateToolCall(turn.toolCall.name, turn.toolCall.arguments);
        if (!validation.valid) {
          lastError = `Schema-gate rejected tool_call in turn: ${validation.errors?.join(', ')}`;
          allValid = false;
          break;
        }
      }
    }
    if (!allValid) continue;

    // Convert turns to ChatMessage array
    const messages: ChatMessage[] = [
      { role: 'system', content: systemWithFeedback },
    ];
    let callIdx = 0;
    for (const turn of obj.turns) {
      if (turn.role === 'assistant' && turn.toolCall) {
        const callId = `call_${callIdx++}`;
        messages.push({
          role: 'assistant',
          content: turn.content,
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name: turn.toolCall.name,
                arguments: JSON.stringify(turn.toolCall.arguments),
              },
            },
          ],
        });
      } else if (turn.role === 'tool') {
        messages.push({
          role: 'tool',
          content: turn.content,
          tool_call_id: turn.toolCallId ?? `call_${callIdx - 1}`,
          name: turn.toolCallId ? undefined : undefined,
        });
      } else {
        messages.push({
          role: turn.role,
          content: turn.content,
        });
      }
    }

    return {
      example: { messages, tools: allTools },
      meta: {
        persona: persona.id,
        difficulty,
        sourceChunks: chunks.map((c) => c.id),
        generator: DATA_GEN_MODEL,
      },
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Parallel/dependent generator                                     */
/* ------------------------------------------------------------------ */

async function generateParallelDep(
  toolPair: [DynamicToolSpec, DynamicToolSpec],
  chunks: Chunk[],
  allTools: DynamicToolSpec[],
  depType: 'parallel' | 'dependent',
  persona: ReturnType<typeof samplePersona>,
  difficulty: ReturnType<typeof sampleDifficulty>,
  maxRetries: number,
): Promise<{ example: TrainingExample; meta: DataGenMeta } | null> {
  const prompt = buildParallelDepPrompt(toolPair, chunks, depType);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const systemWithFeedback =
      attempt > 0
        ? `${prompt.system}\n\nPrevious attempt was rejected: ${lastError}. Fix the tool call arguments.`
        : prompt.system;

    const result = await Sentry.startSpan(
      {
        op: 'ai.agent',
        name: 'data-gen-traj',
        attributes: {
          trajType: 'parallel-dep',
          toolNames: toolPair.map((t) => t.function.name).join(','),
          chunkIds: chunks.map((c) => c.id).join(','),
        },
      },
      async () => {
        return generateObject({
          model: MODEL,
          schema: PARALLEL_DEP_SCHEMA,
          system: `${systemWithFeedback}\n\nPersona: ${persona.voice}\nDifficulty: ${difficulty}`,
          prompt: prompt.user,
        });
      },
    );

    const obj = result.object;

    // Validate ALL tool calls
    let allValid = true;
    for (const tc of obj.toolCalls) {
      const validation = validateToolCall(tc.name, tc.arguments);
      if (!validation.valid) {
        lastError = `Schema-gate rejected: ${validation.errors?.join(', ')}`;
        allValid = false;
        break;
      }
    }
    if (!allValid) continue;

    // Convert to TrainingExample messages
    const toolCallMessages = obj.toolCalls.map((tc, i) => ({
      id: `call_${i}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: systemWithFeedback },
      { role: 'user', content: obj.userQuery },
      {
        role: 'assistant',
        content: '',
        tool_calls: toolCallMessages,
      },
    ];

    // Add tool response messages
    for (let i = 0; i < obj.toolCalls.length; i++) {
      messages.push({
        role: 'tool',
        content: JSON.stringify(obj.toolResults[i]),
        tool_call_id: `call_${i}`,
        name: obj.toolCalls[i].name,
      });
    }

    messages.push({ role: 'assistant', content: obj.assistantAnswer });

    return {
      example: { messages, tools: allTools },
      meta: {
        persona: persona.id,
        difficulty,
        sourceChunks: chunks.map((c) => c.id),
        generator: DATA_GEN_MODEL,
      },
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Refusal generator                                                */
/* ------------------------------------------------------------------ */

async function generateRefusal(
  chunks: Chunk[],
  allTools: DynamicToolSpec[],
  persona: ReturnType<typeof samplePersona>,
  difficulty: ReturnType<typeof sampleDifficulty>,
): Promise<{ example: TrainingExample; meta: DataGenMeta }> {
  const prompt = buildRefusalPrompt(chunks);

  const result = await Sentry.startSpan(
    {
      op: 'ai.agent',
      name: 'data-gen-traj',
      attributes: {
        trajType: 'refusal',
        toolNames: '',
        chunkIds: chunks.map((c) => c.id).join(','),
      },
    },
    async () => {
      return generateObject({
        model: MODEL,
        schema: REFUSAL_SCHEMA,
        system: `${prompt.system}\n\nPersona: ${persona.voice}\nDifficulty: ${difficulty}`,
        prompt: prompt.user,
      });
    },
  );

  const obj = result.object;

  // T-04-09 mitigation: ensure no tool_calls in refusal messages
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: obj.userQuery },
    { role: 'assistant', content: obj.refusalResponse },
  ];

  return {
    example: { messages, tools: allTools },
    meta: {
      persona: persona.id,
      difficulty,
      sourceChunks: chunks.map((c) => c.id),
      generator: DATA_GEN_MODEL,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                */
/* ------------------------------------------------------------------ */

export async function generateTrajBatch(opts: TrajBatchOptions): Promise<TrajBatchResult> {
  const {
    trainChunks,
    tools,
    counts: rawCounts,
    concurrency = 15,
    seed = 'traj-v1',
    maxRetries = 2,
    onProgress,
  } = opts;

  const counts = { ...DEFAULT_COUNTS, ...rawCounts };
  const total = counts.singleTurn + counts.multiTurn + counts.parallelDep + counts.refusal;
  const limit = pLimit(concurrency);
  const rng = makeRng(seed);

  const examples: TrainingExample[] = [];
  const metaList: DataGenMeta[] = [];
  let rejected = 0;
  let done = 0;
  const byType: Record<string, number> = {
    singleTurn: 0,
    multiTurn: 0,
    parallelDep: 0,
    refusal: 0,
  };

  // Track per-tool example counts for bias sampling
  const toolCounts = new Map<string, number>();

  const tasks: Array<() => Promise<void>> = [];

  // -- Single-turn tasks --
  for (let i = 0; i < counts.singleTurn; i++) {
    const tool = sampleToolBiased(tools, toolCounts, rng);
    const chunks = sampleChunks(trainChunks, 3, rng);
    const persona = samplePersona(rng);
    const difficulty = sampleDifficulty(rng);
    // Pre-increment to influence future bias sampling
    toolCounts.set(tool.function.name, (toolCounts.get(tool.function.name) ?? 0) + 1);

    tasks.push(() =>
      limit(async () => {
        const result = await generateSingleTurn(tool, chunks, tools, persona, difficulty, maxRetries);
        if (result) {
          examples.push(result.example);
          metaList.push(result.meta);
          byType.singleTurn++;
        } else {
          rejected++;
        }
        done++;
        onProgress?.(done, total, 'singleTurn');
      }),
    );
  }

  // -- Multi-turn tasks --
  for (let i = 0; i < counts.multiTurn; i++) {
    const numTools = 2 + Math.floor(rng() * 2); // 2-3 tools
    const selectedTools = sampleDistinctTools(tools, numTools, rng);
    const chunks = sampleChunks(trainChunks, 4, rng);
    const persona = samplePersona(rng);
    const difficulty = sampleDifficulty(rng);

    tasks.push(() =>
      limit(async () => {
        const result = await generateMultiTurn(selectedTools, chunks, tools, persona, difficulty, maxRetries);
        if (result) {
          examples.push(result.example);
          metaList.push(result.meta);
          byType.multiTurn++;
        } else {
          rejected++;
        }
        done++;
        onProgress?.(done, total, 'multiTurn');
      }),
    );
  }

  // -- Parallel/dependent tasks --
  for (let i = 0; i < counts.parallelDep; i++) {
    const pair = sampleDistinctTools(tools, 2, rng) as [DynamicToolSpec, DynamicToolSpec];
    const depType = rng() < 0.5 ? 'parallel' : 'dependent';
    const chunks = sampleChunks(trainChunks, 3, rng);
    const persona = samplePersona(rng);
    const difficulty = sampleDifficulty(rng);

    tasks.push(() =>
      limit(async () => {
        const result = await generateParallelDep(pair, chunks, tools, depType, persona, difficulty, maxRetries);
        if (result) {
          examples.push(result.example);
          metaList.push(result.meta);
          byType.parallelDep++;
        } else {
          rejected++;
        }
        done++;
        onProgress?.(done, total, 'parallelDep');
      }),
    );
  }

  // -- Refusal tasks --
  for (let i = 0; i < counts.refusal; i++) {
    const chunks = sampleChunks(trainChunks, 2, rng);
    const persona = samplePersona(rng);
    const difficulty = sampleDifficulty(rng);

    tasks.push(() =>
      limit(async () => {
        const result = await generateRefusal(chunks, tools, persona, difficulty);
        examples.push(result.example);
        metaList.push(result.meta);
        byType.refusal++;
        done++;
        onProgress?.(done, total, 'refusal');
      }),
    );
  }

  // Execute all tasks through shared p-limit
  await Promise.all(tasks.map((t) => t()));

  return { examples, meta: metaList, rejected, byType };
}
