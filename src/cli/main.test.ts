import { describe, expect, it } from 'vitest';
import { type CliDependencies, type CliIo, EXIT_CODES, runCli } from './main';

const IO: CliIo = { columns: 80, isTTY: false };

describe('runCli', () => {
	it('returns equivalent successful root help for bare and explicit help', async () => {
		const bare = await runCli([], IO, {});
		const explicit = await runCli(['--help'], IO, {});
		expect(bare.exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(bare.envelope).toEqual(explicit.envelope);
		expect(bare.output).toBe(explicit.output);
	});

	it('selects JSON before creating human output', async () => {
		let jsonCalls = 0;
		const dependencies: CliDependencies = {
			renderJson: () => {
				jsonCalls += 1;
				return '{"json":true}\n';
			},
			renderHuman: () => {
				throw new Error('human renderer must remain untouched');
			},
		};
		const result = await runCli(['--json'], IO, dependencies);
		expect(result.outputMode).toBe('json');
		expect(result.output).toBe('{"json":true}\n');
		expect(jsonCalls).toBe(1);
	});

	it('short-circuits every later-phase owner before a handler lookup', async () => {
		const handlers = new Proxy(
			{},
			{
				get() {
					throw new Error('later-phase dispatch touched a handler');
				},
			},
		) as CliDependencies['handlers'];

		for (const args of [
			['gc'],
			['repos', 'scan'],
			['evidence', 'build'],
			['dataset', 'build'],
			['benchmark', 'run'],
			['train', 'run'],
			['studio'],
		]) {
			const result = await runCli(args, IO, { handlers });
			expect(result.exitCode).toBe(EXIT_CODES.UNAVAILABLE);
			expect(result.envelope.error).toMatchObject({ code: 'UNAVAILABLE' });
		}
	});

	it('passes typed values only to an implemented leaf handler', async () => {
		let calls = 0;
		const result = await runCli(['doctor'], IO, {
			handlers: {
				doctor: async (invocation) => {
					calls += 1;
					expect(invocation.leaf.path).toEqual(['doctor']);
					expect(invocation.arguments).toEqual({});
					expect(invocation.options).toEqual({});
					return {
						exitCode: 0,
						envelope: {
							schemaVersion: '1',
							ok: true,
							command: 'doctor',
							status: 'success',
							data: { classification: 'owned' },
							error: null,
						},
					};
				},
			},
		});
		expect(calls).toBe(1);
		expect(result.exitCode).toBe(0);
		expect(result.envelope.data).toEqual({ classification: 'owned' });
	});

	it('returns typed parse errors and stable repeated unavailable results', async () => {
		const malformed = await runCli(['repos', 'set', 'demo', '--mode', 'invalid'], IO, {});
		expect(malformed.exitCode).toBe(EXIT_CODES.PARSE_ERROR);
		expect(malformed.envelope.error).toMatchObject({ code: 'INVALID_ARGUMENT' });

		const first = await runCli(['dataset', 'build', '--json'], IO, {});
		const second = await runCli(['dataset', 'build', '--json'], IO, {});
		expect(first).toEqual(second);
	});

	it('throws only when an implemented leaf violates its handler invariant', async () => {
		await expect(runCli(['doctor'], IO, {})).rejects.toThrow(
			'INTERNAL_INVARIANT: implemented command has no handler',
		);
	});
});
