import { describe, expect, it } from 'vitest';

import type { CheckDescriptor } from './check-catalog';
import {
	type ValidationAggregate,
	type ValidationResult,
	aggregateValidationResults,
} from './result';

interface ValidationCliIoShape {
	readonly columns: number;
	readonly isTTY: boolean;
	writeStdout(value: string): void;
	writeStderr(value: string): void;
}

interface ValidationCliDependenciesShape {
	readonly getCheckDescriptor: (checkId: string) => CheckDescriptor | null;
	readonly runCheck: (descriptor: CheckDescriptor) => Promise<ValidationResult>;
	readonly runBaseline: () => Promise<ValidationAggregate>;
	readonly renderHuman?: (aggregate: ValidationAggregate, columns: number) => string;
}

interface CliApi {
	runValidationCli(
		argv: readonly string[],
		io: ValidationCliIoShape,
		dependencies: ValidationCliDependenciesShape,
	): Promise<number>;
}

async function loadCliApi(): Promise<CliApi | null> {
	try {
		const moduleUrl = new URL('./cli.ts', import.meta.url).href;
		return (await import(moduleUrl)) as CliApi;
	} catch {
		return null;
	}
}

async function requireCliApi(): Promise<CliApi> {
	const api = await loadCliApi();
	expect(api, 'validation CLI behavior is not implemented').not.toBeNull();
	if (!api) throw new Error('validation CLI behavior is not implemented');
	return api;
}

function memoryIo(): ValidationCliIoShape & { stdout: string[]; stderr: string[] } {
	const stdout: string[] = [];
	const stderr: string[] = [];
	return {
		columns: 80,
		isTTY: false,
		stdout,
		stderr,
		writeStdout: (value) => stdout.push(value),
		writeStderr: (value) => stderr.push(value),
	};
}

const checkDescriptor = {
	scriptName: 'check',
	checkId: 'check',
	source: 'LIVE',
	execution: { kind: 'fixed-process', executable: 'bun', args: ['x', 'biome', 'check', '.'] },
} as const satisfies CheckDescriptor;

const pass = {
	checkId: 'check',
	status: 'PASS',
	source: 'LIVE',
	reason: 'Passed.',
} as const satisfies ValidationResult;

function dependencies(
	overrides: Partial<ValidationCliDependenciesShape> = {},
): ValidationCliDependenciesShape {
	return {
		getCheckDescriptor: (checkId) => (checkId === 'check' ? checkDescriptor : null),
		runCheck: async () => pass,
		runBaseline: async () => aggregateValidationResults([pass]),
		renderHuman: () => 'Validation baseline\n\nPASS LIVE check Passed.\n\nResult: PASS\n',
		...overrides,
	};
}

describe('runValidationCli', () => {
	it.each([
		[['run', 'check', '--json'], 'validation run'],
		[['baseline', '--json'], 'validation baseline'],
	] as const)('emits one compact JSON document and newline for %j', async (argv, command) => {
		const io = memoryIo();
		let humanImports = 0;
		const { runValidationCli } = await requireCliApi();
		const exitCode = await runValidationCli(
			argv,
			io,
			dependencies({
				renderHuman: () => {
					humanImports += 1;
					throw new Error('human renderer initialized in JSON mode');
				},
			}),
		);

		expect(exitCode).toBe(0);
		expect(humanImports).toBe(0);
		expect(io.stderr).toEqual([]);
		expect(io.stdout).toHaveLength(1);
		expect(io.stdout[0]?.endsWith('\n')).toBe(true);
		expect(io.stdout[0]).not.toContain(String.fromCharCode(27));
		expect(io.stdout[0]).not.toMatch(/RUNNING|Validation baseline/);
		const parsed = JSON.parse(io.stdout[0] ?? '') as Record<string, unknown>;
		expect(Object.keys(parsed)).toEqual([
			'schemaVersion',
			'ok',
			'command',
			'status',
			'data',
			'error',
		]);
		expect(parsed).toMatchObject({ schemaVersion: '1', ok: true, command, status: 'PASS' });
	});

	it('pins a validation failure to exit 1 while retaining every JSON result', async () => {
		const io = memoryIo();
		const aggregate = aggregateValidationResults([
			pass,
			{ checkId: 'studio:build', status: 'FAIL', source: 'LIVE', reason: 'Owned by Phase 8.' },
		]);
		const { runValidationCli } = await requireCliApi();
		const exitCode = await runValidationCli(
			['baseline', '--json'],
			io,
			dependencies({ runBaseline: async () => aggregate }),
		);

		expect(exitCode).toBe(1);
		const parsed = JSON.parse(io.stdout[0] ?? '') as {
			ok: boolean;
			status: string;
			data: { results: unknown[] };
		};
		expect(parsed.ok).toBe(false);
		expect(parsed.status).toBe('FAIL');
		expect(parsed.data.results).toHaveLength(2);
	});

	it('emits byte-identical JSON for repeated controlled baselines', async () => {
		const firstIo = memoryIo();
		const secondIo = memoryIo();
		const { runValidationCli } = await requireCliApi();
		const configured = dependencies();

		await runValidationCli(['baseline', '--json'], firstIo, configured);
		await runValidationCli(['baseline', '--json'], secondIo, configured);

		expect(secondIo.stdout).toEqual(firstIo.stdout);
		expect(secondIo.stderr).toEqual(firstIo.stderr);
	});

	it('pins malformed or unknown run requests to exit 2 without calling a checker', async () => {
		const io = memoryIo();
		let calls = 0;
		const { runValidationCli } = await requireCliApi();
		const exitCode = await runValidationCli(
			['run', 'unknown', '--json'],
			io,
			dependencies({
				runCheck: async () => {
					calls += 1;
					return pass;
				},
			}),
		);

		expect(exitCode).toBe(2);
		expect(calls).toBe(0);
		expect(io.stdout).toHaveLength(1);
		expect(JSON.parse(io.stdout[0] ?? '')).toMatchObject({
			ok: false,
			status: 'invalid',
			error: { code: 'UNKNOWN_CHECK' },
		});
	});

	it('renders human output once with the selected terminal width', async () => {
		const io = memoryIo();
		const widths: number[] = [];
		const { runValidationCli } = await requireCliApi();
		const exitCode = await runValidationCli(
			['baseline'],
			io,
			dependencies({
				renderHuman: (_aggregate, columns) => {
					widths.push(columns);
					return 'human report\n';
				},
			}),
		);

		expect(exitCode).toBe(0);
		expect(widths).toEqual([80]);
		expect(io.stdout).toEqual(['human report\n']);
		expect(io.stderr).toEqual([]);
	});

	it('never emits a success summary or partial JSON after interruption', async () => {
		const humanIo = memoryIo();
		const jsonIo = memoryIo();
		const interrupted = {
			checkId: 'check',
			status: 'FAIL',
			source: 'LIVE',
			reason: 'Validation check was interrupted by SIGINT.',
		} as const satisfies ValidationResult;
		const { runValidationCli } = await requireCliApi();
		const humanExit = await runValidationCli(
			['run', 'check'],
			humanIo,
			dependencies({
				runCheck: async () => interrupted,
				renderHuman: () => 'FAIL LIVE check Validation check was interrupted by SIGINT.\n',
			}),
		);
		const jsonExit = await runValidationCli(
			['run', 'check', '--json'],
			jsonIo,
			dependencies({ runCheck: async () => interrupted }),
		);

		expect(humanExit).toBe(130);
		expect(jsonExit).toBe(130);
		expect(humanIo.stdout.join('')).not.toMatch(/Result: PASS|success/i);
		expect(jsonIo.stdout).toHaveLength(1);
		expect(() => JSON.parse(jsonIo.stdout[0] ?? '')).not.toThrow();
	});
});
