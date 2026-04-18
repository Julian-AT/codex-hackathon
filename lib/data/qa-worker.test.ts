import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Chunk, DynamicToolSpec } from '../discovery/types';

/* ------------------------------------------------------------------ */
/*  Mocks — must be hoisted before dynamic import                     */
/* ------------------------------------------------------------------ */

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      question: 'What is RLS in Supabase?',
      answer:
        'Row Level Security (RLS) is a Postgres feature that Supabase uses to restrict data access at the row level, ensuring each user only sees their own data.',
      toolCalls: undefined,
    },
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => 'mocked-model')),
}));

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: (span: unknown) => unknown) =>
    fn({ setAttribute: vi.fn() }),
  ),
}));

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                     */
/* ------------------------------------------------------------------ */

const mockChunks: Chunk[] = [
  {
    id: 'llms.txt#0001',
    source: 'llms',
    text: 'Supabase uses Row Level Security (RLS) policies to control data access at the row level.',
    tokenCount: 15,
    ordinal: 0,
  },
  {
    id: 'llms.txt#0002',
    source: 'llms',
    text: 'Edge functions run on Deno Deploy and can be invoked via HTTP.',
    tokenCount: 12,
    ordinal: 1,
  },
  {
    id: 'cli.txt#0001',
    source: 'cli',
    text: 'supabase db push applies migrations to the linked project.',
    tokenCount: 10,
    ordinal: 0,
  },
];

const mockTools: DynamicToolSpec[] = [];

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('generateQABatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces TrainingExample[] with correct message shape', async () => {
    const { generateQABatch } = await import('./qa-worker.js');
    const result = await generateQABatch({
      trainChunks: mockChunks,
      tools: mockTools,
      count: 3,
      concurrency: 2,
      seed: 'test-seed',
    });

    expect(result.examples.length).toBeGreaterThanOrEqual(1);
    for (const ex of result.examples) {
      expect(ex.messages.length).toBeGreaterThanOrEqual(2);
      expect(ex.messages[0].role).toBe('system');
      expect(ex.messages[1].role).toBe('user');
      expect(ex.messages.at(-1)!.role).toBe('assistant');
    }
  });

  it('returns meta array matching examples length', async () => {
    const { generateQABatch } = await import('./qa-worker.js');
    const result = await generateQABatch({
      trainChunks: mockChunks,
      tools: mockTools,
      count: 2,
      concurrency: 1,
      seed: 'test-seed-2',
    });

    expect(result.meta.length).toBe(result.examples.length);
    for (const m of result.meta) {
      expect(m.generator).toBe('gemini-3.1-flash-lite');
      expect(['easy', 'medium', 'hard']).toContain(m.difficulty);
    }
  });

  it('calls Sentry.startSpan for telemetry', async () => {
    const Sentry = await import('@sentry/nextjs');
    const { generateQABatch } = await import('./qa-worker.js');

    await generateQABatch({
      trainChunks: mockChunks,
      tools: mockTools,
      count: 1,
      concurrency: 1,
      seed: 'sentry-test',
    });

    expect(Sentry.startSpan).toHaveBeenCalled();
    const callArgs = vi.mocked(Sentry.startSpan).mock.calls[0][0] as {
      op: string;
      name: string;
    };
    expect(callArgs.op).toBe('ai.agent');
    expect(callArgs.name).toBe('data-gen-qa');
  });

  it('invokes schema-gate on tool_calls and rejects invalid ones', async () => {
    const ai = await import('ai');
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: {
        question: 'How do I run a migration?',
        answer: 'Use supabase db push to apply migrations.',
        toolCalls: [
          {
            name: 'totally_fake_tool',
            arguments: { foo: 'bar' },
          },
        ],
      },
    } as never);

    const { generateQABatch } = await import('./qa-worker.js');
    const result = await generateQABatch({
      trainChunks: mockChunks,
      tools: mockTools,
      count: 1,
      concurrency: 1,
      seed: 'reject-test',
      maxRetries: 0,
    });

    // The fake tool should be rejected by schema-gate (unknown tool)
    expect(result.rejected).toBeGreaterThanOrEqual(1);
  });
});
