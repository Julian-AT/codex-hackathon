/**
 * Tests for traj-worker.ts — DAT-02 trajectory generation.
 * Stubs generateObject to return well-formed trajectories for all 4 types.
 * Plan 04-04, Task 2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamicToolSpec, Chunk } from './types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                         */
/* ------------------------------------------------------------------ */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockTools: DynamicToolSpec[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '__fixtures__/mock-tools.json'), 'utf8'),
);
const mockCorpus = JSON.parse(
  readFileSync(path.resolve(__dirname, '__fixtures__/mock-corpus.json'), 'utf8'),
);
const mockChunks: Chunk[] = mockCorpus.chunks.slice(0, 5);

/* ------------------------------------------------------------------ */
/*  Mock: @ai-sdk/anthropic                                          */
/* ------------------------------------------------------------------ */

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => {
    return (modelId: string) => ({ modelId, provider: 'anthropic-mock' });
  }),
}));

/* ------------------------------------------------------------------ */
/*  Mock: @sentry/nextjs                                             */
/* ------------------------------------------------------------------ */

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
}));

/* ------------------------------------------------------------------ */
/*  Mock: ai (generateObject)                                        */
/* ------------------------------------------------------------------ */

const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

/* ------------------------------------------------------------------ */
/*  Mock: schema-gate                                                */
/* ------------------------------------------------------------------ */

const mockValidateToolCall = vi.fn().mockReturnValue({ valid: true });

vi.mock('./schema-gate.js', () => ({
  validateToolCall: (...args: unknown[]) => mockValidateToolCall(...args),
  loadToolSchemas: vi.fn(),
  _resetCache: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Test helpers                                                     */
/* ------------------------------------------------------------------ */

function makeSingleTurnResponse() {
  return {
    object: {
      userQuery: 'What TypeScript type maps to PostgreSQL text column type?',
      toolCall: {
        name: 'supabase_column_type_mapper',
        arguments: JSON.stringify({ postgresType: 'text' }),
      },
      toolResult: JSON.stringify({ tsType: 'string' }),
      assistantAnswer: 'The PostgreSQL text type maps to TypeScript string type. This mapping is used when generating type definitions from your database schema.',
    },
  };
}

function makeMultiTurnResponse() {
  return {
    object: {
      turns: [
        { role: 'user' as const, content: 'What TypeScript type maps to text?' },
        {
          role: 'assistant' as const,
          content: 'Let me check that for you.',
          toolCall: {
            name: 'supabase_column_type_mapper',
            arguments: JSON.stringify({ postgresType: 'text' }),
          },
        },
        { role: 'tool' as const, content: '{"tsType":"string"}', toolCallId: 'call_0' },
        { role: 'assistant' as const, content: 'The text type maps to string in TypeScript.' },
        { role: 'user' as const, content: 'What about boolean?' },
        {
          role: 'assistant' as const,
          content: 'Let me look that up.',
          toolCall: {
            name: 'supabase_column_type_mapper',
            arguments: JSON.stringify({ postgresType: 'boolean' }),
          },
        },
        { role: 'tool' as const, content: '{"tsType":"boolean"}', toolCallId: 'call_1' },
        { role: 'assistant' as const, content: 'Boolean maps to boolean in TypeScript.' },
      ],
    },
  };
}

function makeParallelDepResponse() {
  return {
    object: {
      userQuery: 'Parse this connection string and also map the text column type for me.',
      toolCalls: [
        {
          name: 'supabase_connection_string_parser',
          arguments: JSON.stringify({ url: 'postgres://user@localhost/db' }),
        },
        {
          name: 'supabase_column_type_mapper',
          arguments: JSON.stringify({ postgresType: 'text' }),
        },
      ],
      toolResults: [
        JSON.stringify({ host: 'localhost', port: 5432, database: 'db', user: 'user' }),
        JSON.stringify({ tsType: 'string' }),
      ],
      assistantAnswer: 'The connection string points to localhost:5432/db as user. The text column maps to TypeScript string type.',
      dependency: 'parallel' as const,
    },
  };
}

function makeRefusalResponse() {
  return {
    object: {
      userQuery: 'What is the current Supabase stock price and market cap?',
      refusalResponse: 'I cannot look up live stock prices or market data because that requires network access, which is not available in offline mode. However, I can help you with Supabase database queries, RLS policies, storage paths, and other technical topics.',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                            */
/* ------------------------------------------------------------------ */

describe('generateTrajBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateToolCall.mockReturnValue({ valid: true });
  });

  it('generates single-turn trajectories with 5+ messages', async () => {
    mockGenerateObject.mockResolvedValue(makeSingleTurnResponse());

    const { generateTrajBatch } = await import('./traj-worker.js');
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 2, multiTurn: 0, parallelDep: 0, refusal: 0 },
      concurrency: 2,
      seed: 'test-single',
    });

    expect(result.examples.length).toBe(2);
    expect(result.byType.singleTurn).toBe(2);
    for (const ex of result.examples) {
      // system + user + assistant(tool_calls) + tool + assistant = 5 messages
      expect(ex.messages.length).toBeGreaterThanOrEqual(5);
      expect(ex.messages[0].role).toBe('system');
      expect(ex.messages[1].role).toBe('user');
      expect(ex.messages[2].role).toBe('assistant');
      expect(ex.messages[2].tool_calls).toBeDefined();
      expect(ex.messages[2].tool_calls!.length).toBe(1);
      expect(ex.messages[3].role).toBe('tool');
      expect(ex.messages[4].role).toBe('assistant');
      expect(ex.messages[4].tool_calls).toBeUndefined();
      // Tools array pinned
      expect(ex.tools).toBe(mockTools);
    }
  });

  it('generates multi-turn trajectories with 6+ messages', async () => {
    mockGenerateObject.mockResolvedValue(makeMultiTurnResponse());

    const { generateTrajBatch } = await import('./traj-worker.js');
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 0, multiTurn: 2, parallelDep: 0, refusal: 0 },
      concurrency: 2,
      seed: 'test-multi',
    });

    expect(result.examples.length).toBe(2);
    expect(result.byType.multiTurn).toBe(2);
    for (const ex of result.examples) {
      // system + 8 turns = 9 messages
      expect(ex.messages.length).toBeGreaterThanOrEqual(6);
      // Should have interleaved tool calls
      const toolCallMsgs = ex.messages.filter((m) => m.tool_calls && m.tool_calls.length > 0);
      expect(toolCallMsgs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('generates refusal trajectories with exactly 3 messages and NO tool_calls', async () => {
    mockGenerateObject.mockResolvedValue(makeRefusalResponse());

    const { generateTrajBatch } = await import('./traj-worker.js');
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 0, multiTurn: 0, parallelDep: 0, refusal: 3 },
      concurrency: 2,
      seed: 'test-refusal',
    });

    expect(result.examples.length).toBe(3);
    expect(result.byType.refusal).toBe(3);
    for (const ex of result.examples) {
      expect(ex.messages.length).toBe(3);
      expect(ex.messages[0].role).toBe('system');
      expect(ex.messages[1].role).toBe('user');
      expect(ex.messages[2].role).toBe('assistant');
      // NO tool_calls anywhere in the message list
      for (const msg of ex.messages) {
        expect(msg.tool_calls).toBeUndefined();
      }
    }
  });

  it('calls schema-gate (validateToolCall) for single-turn tool_calls', async () => {
    mockGenerateObject.mockResolvedValue(makeSingleTurnResponse());

    const { generateTrajBatch } = await import('./traj-worker.js');
    await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 1, multiTurn: 0, parallelDep: 0, refusal: 0 },
      concurrency: 1,
      seed: 'test-gate',
    });

    expect(mockValidateToolCall).toHaveBeenCalledWith(
      'supabase_column_type_mapper',
      { postgresType: 'text' },
    );
  });

  it('byType counts match input counts', async () => {
    mockGenerateObject.mockImplementation(async (opts: { system?: string; prompt?: string }) => {
      // Discriminate by system prompt content which differs for each trajectory type
      const sys = opts.system ?? '';
      if (sys.includes('must NOT call any tools')) return makeRefusalResponse();
      if (sys.includes('MULTIPLE tools in a single turn')) return makeParallelDepResponse();
      if (sys.includes('multi-turn conversation')) return makeMultiTurnResponse();
      return makeSingleTurnResponse();
    });

    const { generateTrajBatch } = await import('./traj-worker.js');
    const counts = { singleTurn: 3, multiTurn: 2, parallelDep: 1, refusal: 1 };
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts,
      concurrency: 3,
      seed: 'test-counts',
    });

    expect(result.byType.singleTurn).toBe(counts.singleTurn);
    expect(result.byType.multiTurn).toBe(counts.multiTurn);
    expect(result.byType.parallelDep).toBe(counts.parallelDep);
    expect(result.byType.refusal).toBe(counts.refusal);
    expect(result.examples.length).toBe(
      counts.singleTurn + counts.multiTurn + counts.parallelDep + counts.refusal,
    );
    expect(result.rejected).toBe(0);
  });

  it('rejects and counts when schema-gate fails after max retries', async () => {
    mockGenerateObject.mockResolvedValue(makeSingleTurnResponse());
    mockValidateToolCall.mockReturnValue({
      valid: false,
      errors: ['/ must have required property "tableName"'],
    });

    const { generateTrajBatch } = await import('./traj-worker.js');
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 1, multiTurn: 0, parallelDep: 0, refusal: 0 },
      concurrency: 1,
      seed: 'test-reject',
      maxRetries: 2,
    });

    expect(result.examples.length).toBe(0);
    expect(result.rejected).toBe(1);
    // generateObject called 3 times: initial + 2 retries
    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });

  it('generates parallel/dep trajectories with 2 tool_calls in one assistant turn', async () => {
    mockGenerateObject.mockResolvedValue(makeParallelDepResponse());

    const { generateTrajBatch } = await import('./traj-worker.js');
    const result = await generateTrajBatch({
      trainChunks: mockChunks,
      tools: mockTools,
      counts: { singleTurn: 0, multiTurn: 0, parallelDep: 2, refusal: 0 },
      concurrency: 2,
      seed: 'test-parallel',
    });

    expect(result.examples.length).toBe(2);
    expect(result.byType.parallelDep).toBe(2);
    for (const ex of result.examples) {
      // Find the assistant turn with tool_calls
      const assistantWithTools = ex.messages.find(
        (m) => m.role === 'assistant' && m.tool_calls && m.tool_calls.length >= 2,
      );
      expect(assistantWithTools).toBeDefined();
      expect(assistantWithTools!.tool_calls!.length).toBe(2);

      // Two tool response messages
      const toolMsgs = ex.messages.filter((m) => m.role === 'tool');
      expect(toolMsgs.length).toBe(2);
    }
  });
});
