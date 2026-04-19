import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import type { Chunk } from './types';
import {
	DYNAMIC_TOOL_SPEC_DISK_SCHEMA,
	DYNAMIC_TOOL_SPEC_SCHEMA,
	toolDesignWorker,
} from './worker';

const fakeCorpus: Chunk[] = [
	{
		id: 'llms.txt#0001',
		source: 'llms',
		text: 'Supabase Row Level Security uses Postgres policies...',
		tokenCount: 40,
		ordinal: 1,
	},
	{
		id: 'llms.txt#0002',
		source: 'llms',
		text: 'Storage buckets are namespaced by project...',
		tokenCount: 30,
		ordinal: 2,
	},
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
				jsBody:
					'function rls_policy_template(args) { return { policy: "CREATE POLICY " + args.tableName }; }',
				requiresNetwork: false,
				trajectories: [
					{
						userPrompt: 'policy for profiles',
						call: {
							name: 'rls_policy_template',
							arguments: { tableName: 'profiles', role: 'authenticated', operation: 'select' },
						},
						result: { policy: 'CREATE POLICY profiles' },
					},
					{
						userPrompt: 'policy for posts',
						call: {
							name: 'rls_policy_template',
							arguments: { tableName: 'posts', role: 'authenticated', operation: 'insert' },
						},
						result: { policy: 'CREATE POLICY posts' },
					},
					{
						userPrompt: 'policy for comments',
						call: {
							name: 'rls_policy_template',
							arguments: { tableName: 'comments', role: 'service_role', operation: 'delete' },
						},
						result: { policy: 'CREATE POLICY comments' },
					},
				],
				sourceWorker: 'WILL-BE-OVERWRITTEN', // worker.ts enforces workerId
				sourceChunks: ['llms.txt#0001'],
			},
		},
	],
};

/** Same tool as fakeSpec but parameters / trajectory args are JSON strings (LLM wire). */
const fakeWireSpec = {
	tools: [
		{
			type: 'function' as const,
			function: {
				name: 'rls_policy_template',
				description: 'Emit a Supabase RLS policy template for a table/role/op.',
				parameters: JSON.stringify(fakeSpec.tools[0].function.parameters),
			},
			meta: {
				...fakeSpec.tools[0].meta,
				trajectories: fakeSpec.tools[0].meta.trajectories.map((tr) => ({
					userPrompt: tr.userPrompt,
					call: {
						name: tr.call.name,
						arguments: JSON.stringify(tr.call.arguments),
					},
					result: JSON.stringify(tr.result),
				})),
			},
		},
	],
};

function makeMockModel() {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: JSON.stringify(fakeWireSpec) }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage: {
				inputTokens: {
					total: 100,
					noCache: 100,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: 100,
					text: 100,
					reasoning: undefined,
				},
			},
			warnings: [],
		}),
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

	it('DYNAMIC_TOOL_SPEC_DISK_SCHEMA accepts the fake spec (Zod parse)', () => {
		expect(() => DYNAMIC_TOOL_SPEC_DISK_SCHEMA.parse(fakeSpec.tools[0])).not.toThrow();
	});

	it('DYNAMIC_TOOL_SPEC_SCHEMA accepts wire-format tools { tools: [...] }', () => {
		expect(() => DYNAMIC_TOOL_SPEC_SCHEMA.parse(fakeWireSpec)).not.toThrow();
	});
});
