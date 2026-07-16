import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
	CHECK_CATALOG,
	VALIDATION_SCRIPT_NAMES,
	type CheckDescriptor,
} from '../../src/validation/check-catalog';
import { runValidationProcessEntry } from '../../src/validation/process-entry';
import { runValidationBaseline } from '../../src/validation/runner';
import type { ProcessRequest, ProcessResult } from '../../src/validation/runner';

const EXPECTED_SCRIPTS = Object.freeze({
	check: 'bun src/validation/process-entry.ts run check',
	typecheck: 'bun src/validation/process-entry.ts run typecheck',
	test: 'bun src/validation/process-entry.ts run test',
	'test:integration': 'bun src/validation/process-entry.ts external test:integration',
	'studio:build': 'bun src/validation/process-entry.ts run studio:build',
	'dataset:validate': 'bun src/validation/process-entry.ts run dataset:validate',
	'benchmark:smoke': 'bun src/validation/process-entry.ts run benchmark:smoke',
	'local:check': 'bun src/validation/process-entry.ts run local:check',
} as const);

function readPackageScripts(): Record<string, string> {
	const parsed = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
		scripts?: Record<string, unknown>;
	};
	return Object.fromEntries(
		Object.entries(parsed.scripts ?? {}).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string',
		),
	);
}

function successfulResult(): ProcessResult {
	return { exitCode: 0, stdout: 'FIXTURE process completed', stderr: '' };
}

describe('stable validation package scripts', () => {
	it('maps all eight scripts without recursion', () => {
		const scripts = readPackageScripts();
		const selected = Object.fromEntries(
			VALIDATION_SCRIPT_NAMES.map((name) => [name, scripts[name] ?? null]),
		);

		expect(selected).toEqual(EXPECTED_SCRIPTS);
		expect(new Set(Object.values(selected))).toHaveLength(VALIDATION_SCRIPT_NAMES.length);
		for (const [name, command] of Object.entries(selected)) {
			expect(command, `${name} must use the validation process entry`).toMatch(
				/^bun src\/validation\/process-entry\.ts (?:run|external) [a-z:]+$/,
			);
			expect(command).not.toContain(`bun run ${name}`);
		}
	});

	it('stubs the integration descriptor for an in-suite baseline', async () => {
		const processRequests: ProcessRequest[] = [];
		const runExternal = vi.fn(async (descriptor: CheckDescriptor) => ({
			checkId: descriptor.checkId,
			status: 'PASS' as const,
			source: descriptor.source,
			reason: 'Injected FIXTURE integration result.',
		}));

		const aggregate = await runValidationBaseline({
			process: {
				async run(request) {
					processRequests.push(request);
					return successfulResult();
				},
			},
			probeCapability: async () => ({
				id: 'apple-silicon',
				available: false,
				reason: 'Injected host capability is unavailable.',
			}),
			runExternal,
		});

		expect(runExternal).toHaveBeenCalledOnce();
		expect(runExternal).toHaveBeenCalledWith(CHECK_CATALOG[3]);
		expect(processRequests).toHaveLength(3);
		expect(JSON.stringify(processRequests)).not.toContain('test:integration');
		expect(aggregate.results).toHaveLength(8);
	});

	it('uses only fixed catalog argv at the executable process boundary', async () => {
		const requests: ProcessRequest[] = [];
		const run = async (argv: readonly string[]) => {
			const writes: string[] = [];
			const exits: number[] = [];
			await runValidationProcessEntry(argv, {
				createRunner: () => ({
					async run(request) {
						requests.push(request);
						return successfulResult();
					},
				}),
				createProbe: () => async () => ({
					id: 'apple-silicon',
					available: false,
					reason: 'Injected host capability is unavailable.',
				}),
				write: (value) => writes.push(value),
				setExitCode: (value) => exits.push(value),
				columns: 80,
				isTTY: false,
			});
			return { writes, exits };
		};

		await run(['run', 'check', '--json']);
		await run(['external', 'test:integration', '--json']);
		const rejected = await run(['run', 'check', 'git', 'clone']);

		expect(requests).toEqual([
			{
				executable: 'bun',
				args: ['x', 'biome', 'check', '.'],
				shell: false,
				maxOutputBytes: expect.any(Number),
				timeoutMs: expect.any(Number),
			},
			{
				executable: 'bun',
				args: ['x', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
				shell: false,
				maxOutputBytes: expect.any(Number),
				timeoutMs: expect.any(Number),
			},
		]);
		expect(rejected.exits).toEqual([2]);
		expect(rejected.writes.join('')).toContain('Invalid');
	});

	it('keeps product failures and named capability evidence truthful', async () => {
		const runJson = async (checkId: string) => {
			const writes: string[] = [];
			const exits: number[] = [];
			await runValidationProcessEntry(['run', checkId, '--json'], {
				createRunner: () => ({ run: async () => successfulResult() }),
				createProbe: () => async () => ({
					id: 'apple-silicon',
					available: false,
					reason: 'Apple Silicon is unavailable in the injected host.',
				}),
				write: (value) => writes.push(value),
				setExitCode: (value) => exits.push(value),
				columns: 80,
				isTTY: false,
			});
			return {
				exit: exits[0],
				envelope: JSON.parse(writes[0] ?? '{}') as {
					data?: { results?: Array<{ status?: string; source?: string; reason?: string }> };
				},
			};
		};

		for (const [checkId, owner] of [
			['studio:build', 8],
			['dataset:validate', 5],
			['benchmark:smoke', 6],
		] as const) {
			const result = await runJson(checkId);
			expect(result.exit).toBe(1);
			expect(result.envelope.data?.results?.[0]).toMatchObject({
				status: 'FAIL',
				source: 'LIVE',
			});
			expect(result.envelope.data?.results?.[0]?.reason).toContain(`Phase ${owner}`);
		}

		const local = await runJson('local:check');
		expect(local.exit).toBe(0);
		expect(local.envelope.data?.results?.[0]).toMatchObject({
			status: 'SKIP',
			source: 'LIVE',
		});
		expect(local.envelope.data?.results?.[0]?.reason).toContain('Apple Silicon');
	});
});
