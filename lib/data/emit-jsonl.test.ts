import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { TrainingExample, EvalItem, ToolCall, ChatMessage } from './types';
import type { DynamicToolSpec } from '../discovery/types';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const mockTools: DynamicToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'supabase_rls_policy_template',
      description: 'Emit an RLS policy DDL template.',
      parameters: {
        type: 'object',
        properties: {
          tableName: { type: 'string' },
          role: { type: 'string', enum: ['authenticated', 'anon'] },
          operation: { type: 'string', enum: ['select', 'insert'] },
        },
        required: ['tableName', 'role', 'operation'],
      },
    },
    meta: {
      jsBody: 'return "mock";',
      requiresNetwork: false,
      trajectories: [],
      sourceWorker: 'test',
      sourceChunks: [],
    },
  },
];

function makeTrainingExample(userContent: string): TrainingExample {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a Supabase specialist.' },
    { role: 'user', content: userContent },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_0',
          type: 'function',
          function: {
            name: 'supabase_rls_policy_template',
            arguments: '{"tableName":"profiles","role":"authenticated","operation":"select"}',
          },
        },
      ],
    },
    {
      role: 'tool',
      content: '{"policy":"CREATE POLICY..."}',
      tool_call_id: 'call_0',
      name: 'supabase_rls_policy_template',
    },
    { role: 'assistant', content: 'Here is your RLS policy.' },
  ];
  return { messages, tools: mockTools };
}

function makeSimpleExample(userContent: string): TrainingExample {
  return {
    messages: [
      { role: 'system', content: 'You are a Supabase specialist.' },
      { role: 'user', content: userContent },
      { role: 'assistant', content: `Answer about: ${userContent}` },
    ],
    tools: mockTools,
  };
}

const TMP_DIR = path.resolve('data/.test-emit');

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('emitTrainingJsonl', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await unlink(path.join(TMP_DIR, 'training.jsonl'));
    } catch { /* noop */ }
    try {
      await unlink(path.join(TMP_DIR, 'eval.jsonl'));
    } catch { /* noop */ }
  });

  it('writes one JSON object per line', async () => {
    const { emitTrainingJsonl } = await import('./emit-jsonl.js');
    const outPath = path.join(TMP_DIR, 'training.jsonl');
    const examples = [
      makeTrainingExample('How do I set up RLS?'),
      makeTrainingExample('Create an RLS policy for profiles'),
      makeSimpleExample('What is Supabase?'),
    ];

    await emitTrainingJsonl(examples, outPath);
    const content = await readFile(outPath, 'utf8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBe(3);
  });

  it('each line parses as { messages: [...], tools: [...] }', async () => {
    const { emitTrainingJsonl } = await import('./emit-jsonl.js');
    const outPath = path.join(TMP_DIR, 'training.jsonl');
    const examples = [makeTrainingExample('Test example')];

    await emitTrainingJsonl(examples, outPath);
    const content = await readFile(outPath, 'utf8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('messages');
      expect(parsed).toHaveProperty('tools');
      expect(Array.isArray(parsed.messages)).toBe(true);
      expect(Array.isArray(parsed.tools)).toBe(true);
    }
  });

  it('tools array does NOT contain meta field (stripped)', async () => {
    const { emitTrainingJsonl } = await import('./emit-jsonl.js');
    const outPath = path.join(TMP_DIR, 'training.jsonl');
    const examples = [makeTrainingExample('Meta strip test')];

    await emitTrainingJsonl(examples, outPath);
    const content = await readFile(outPath, 'utf8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      const parsed = JSON.parse(line);
      for (const tool of parsed.tools) {
        expect(tool).not.toHaveProperty('meta');
        expect(tool.type).toBe('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
      }
    }
  });

  it('messages strip undefined fields for clean JSON', async () => {
    const { emitTrainingJsonl } = await import('./emit-jsonl.js');
    const outPath = path.join(TMP_DIR, 'training.jsonl');
    const examples = [makeSimpleExample('No tool calls')];

    await emitTrainingJsonl(examples, outPath);
    const content = await readFile(outPath, 'utf8');
    const parsed = JSON.parse(content.trim().split('\n')[0]);

    // User message should NOT have tool_calls or tool_call_id keys
    const userMsg = parsed.messages.find(
      (m: Record<string, unknown>) => m.role === 'user',
    );
    expect(userMsg).not.toHaveProperty('tool_calls');
    expect(userMsg).not.toHaveProperty('tool_call_id');
    expect(userMsg).not.toHaveProperty('name');
  });
});

describe('emitEvalJsonl', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await unlink(path.join(TMP_DIR, 'eval.jsonl'));
    } catch { /* noop */ }
  });

  it('writes correct number of EvalItem lines', async () => {
    const { emitEvalJsonl } = await import('./emit-jsonl.js');
    const outPath = path.join(TMP_DIR, 'eval.jsonl');
    const items: EvalItem[] = Array.from({ length: 70 }, (_, i) => ({
      id: `eval-factual-${i}`,
      kind: 'factual' as const,
      prompt: `Question ${i}?`,
      expected: `Answer ${i}.`,
      sourceChunks: [`llms.txt#${String(i).padStart(4, '0')}`],
    }));

    await emitEvalJsonl(items, outPath);
    const content = await readFile(outPath, 'utf8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBe(70);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('kind');
      expect(parsed).toHaveProperty('prompt');
    }
  });
});

describe('verifyNoOverlap', () => {
  it('returns pass: true for disjoint sets', async () => {
    const { verifyNoOverlap } = await import('./emit-jsonl.js');
    const result = await verifyNoOverlap(
      [['train-1', 'train-2'], ['train-3']],
      ['eval-1', 'eval-2'],
    );
    expect(result.pass).toBe(true);
    expect(result.overlap.length).toBe(0);
  });

  it('returns pass: false for overlapping sets', async () => {
    const { verifyNoOverlap } = await import('./emit-jsonl.js');
    const result = await verifyNoOverlap(
      [['chunk-1', 'chunk-2'], ['chunk-3']],
      ['chunk-2', 'chunk-4'],
    );
    expect(result.pass).toBe(false);
    expect(result.overlap).toContain('chunk-2');
  });

  it('deduplicates overlap entries', async () => {
    const { verifyNoOverlap } = await import('./emit-jsonl.js');
    const result = await verifyNoOverlap(
      [
        ['shared-1', 'shared-1'],
        ['shared-1'],
      ],
      ['shared-1'],
    );
    expect(result.pass).toBe(false);
    expect(result.overlap.length).toBe(1);
  });
});
