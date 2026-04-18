import { describe, it, expect } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { toolDesignWorker, DYNAMIC_TOOL_SPEC_SCHEMA } from './worker.js';
import type { Chunk } from './types.js';

const fakeCorpus: Chunk[] = [
  { id: 'llms.txt#0001', source: 'llms', text: 'Supabase Row Level Security uses Postgres policies...', tokenCount: 40, ordinal: 1 },
  { id: 'llms.txt#0002', source: 'llms', text: 'Storage buckets are namespaced by project...', tokenCount: 30, ordinal: 2 },
];

const fakeSpec = {
  tools: [
    {
      type: 'function' as const,
      function: {
        name: 'rls_policy_template',
        description: 'Emit a Supabase RLS policy template for a table/role/op.',
        parameters: {
          type: 'object',
          properties: {
            tableName: { type: 'string' },
            role: { type: 'string' },
            operation: { type: 'string' },
          },
          required: ['tableName', 'role', 'operation'],
        },
      },
      meta: {
        jsBody: 'function rls_policy_template(args) { return { policy: "CREATE POLICY " + args.tableName }; }',
        requiresNetwork: false,
        trajectories: [
          { userPrompt: 'policy for profiles', call: { name: 'rls_policy_template', arguments: { tableName: 'profiles', role: 'authenticated', operation: 'select' } }, result: { policy: 'CREATE POLICY profiles' } },
          { userPrompt: 'policy for posts', call: { name: 'rls_policy_template', arguments: { tableName: 'posts', role: 'authenticated', operation: 'insert' } }, result: { policy: 'CREATE POLICY posts' } },
          { userPrompt: 'policy for comments', call: { name: 'rls_policy_template', arguments: { tableName: 'comments', role: 'service_role', operation: 'delete' } }, result: { policy: 'CREATE POLICY comments' } },
        ],
        sourceWorker: 'WILL-BE-OVERWRITTEN', // worker.ts enforces workerId
        sourceChunks: ['llms.txt#0001'],
      },
    },
  ],
};

function makeMockModel() {
  return new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify(fakeSpec) }],
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 100 },
      warnings: [],
    },
  });
}

describe('toolDesignWorker (mocked)', () => {
  it('returns DynamicToolSpec[] with >=1 valid entry', async () => {
    const out = await toolDesignWorker({
      workerId: 'tool-design-0',
      slice: fakeCorpus,
      model: makeMockModel(),
    });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].type).toBe('function');
    expect(out[0].function.name).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(out[0].meta.trajectories.length).toBeGreaterThanOrEqual(3);
  });

  it('overwrites sourceWorker with the passed workerId', async () => {
    const out = await toolDesignWorker({
      workerId: 'tool-design-7',
      slice: fakeCorpus,
      model: makeMockModel(),
    });
    for (const t of out) expect(t.meta.sourceWorker).toBe('tool-design-7');
  });

  it('DYNAMIC_TOOL_SPEC_SCHEMA accepts the fake spec (Zod parse)', () => {
    expect(() => DYNAMIC_TOOL_SPEC_SCHEMA.parse(fakeSpec)).not.toThrow();
  });
});
