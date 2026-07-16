import { describe, expect, it } from 'vitest';

import type { CapabilityEvidence } from './capabilities';
import { CHECK_CATALOG, type CheckDescriptor, getCheckDescriptor } from './check-catalog';
import type { ValidationAggregate, ValidationResult } from './result';

interface ProcessRequestShape {
	readonly executable: string;
	readonly args: readonly string[];
	readonly shell: false;
	readonly maxOutputBytes: number;
	readonly timeoutMs: number;
}

interface ProcessResultShape {
	readonly exitCode: number | null;
	readonly signal?: string | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly error?: string;
	readonly timedOut?: boolean;
	readonly interrupted?: boolean;
}

interface RunnerDependenciesShape {
	readonly process: { run(request: ProcessRequestShape): Promise<ProcessResultShape> };
	readonly probeCapability: (capabilityId: string) => Promise<CapabilityEvidence>;
	readonly runExternal: (descriptor: CheckDescriptor) => Promise<unknown>;
	readonly maxOutputBytes?: number;
	readonly timeoutMs?: number;
}

interface RunnerApi {
	runValidationCheck(
		descriptor: CheckDescriptor,
		dependencies: RunnerDependenciesShape,
	): Promise<ValidationResult>;
	runValidationBaseline(
		dependencies: RunnerDependenciesShape,
		descriptors?: readonly CheckDescriptor[],
	): Promise<ValidationAggregate>;
}

async function loadRunnerApi(): Promise<RunnerApi | null> {
	try {
		const moduleUrl = new URL('./runner.ts', import.meta.url).href;
		return (await import(moduleUrl)) as RunnerApi;
	} catch {
		return null;
	}
}

async function requireRunnerApi(): Promise<RunnerApi> {
	const api = await loadRunnerApi();
	expect(api, 'validation runner behavior is not implemented').not.toBeNull();
	if (!api) throw new Error('validation runner behavior is not implemented');
	return api;
}

class RecordingProcessPort {
	readonly calls: ProcessRequestShape[] = [];

	constructor(private readonly results: readonly ProcessResultShape[]) {}

	async run(request: ProcessRequestShape): Promise<ProcessResultShape> {
		this.calls.push(request);
		return (
			this.results[this.calls.length - 1] ?? {
				exitCode: 0,
				stdout: '',
				stderr: '',
			}
		);
	}
}

const success = { exitCode: 0, stdout: 'ok\n', stderr: '' } as const;

function dependencies(
	process: RecordingProcessPort,
	overrides: Partial<RunnerDependenciesShape> = {},
): RunnerDependenciesShape {
	return {
		process,
		probeCapability: async (id) => ({ id, available: true, reason: 'Available.' }),
		runExternal: async (descriptor) => ({
			checkId: descriptor.checkId,
			status: 'PASS',
			source: descriptor.source,
			reason: 'External harness supplied a controlled result.',
		}),
		...overrides,
	};
}

function descriptor(checkId: string): CheckDescriptor {
	const value = getCheckDescriptor(checkId);
	expect(value, `missing catalog descriptor ${checkId}`).not.toBeNull();
	if (!value) throw new Error(`missing catalog descriptor ${checkId}`);
	return value;
}

describe('runValidationCheck', () => {
	it('forwards only the fixed executable and immutable argv with shell disabled and bounds', async () => {
		const port = new RecordingProcessPort([success]);
		const { runValidationCheck } = await requireRunnerApi();
		const result = await runValidationCheck(
			descriptor('check'),
			dependencies(port, { maxOutputBytes: 64, timeoutMs: 250 }),
		);

		expect(result).toMatchObject({ checkId: 'check', status: 'PASS', source: 'LIVE' });
		expect(port.calls).toEqual([
			{
				executable: 'bun',
				args: ['x', 'biome', 'check', '.'],
				shell: false,
				maxOutputBytes: 64,
				timeoutMs: 250,
			},
		]);
		expect(Object.isFrozen(port.calls[0]?.args)).toBe(true);
	});

	it.each([
		['nonzero exit', { exitCode: 7, stdout: '', stderr: 'bad' }, /exit(?:ed)? (?:with code )?7/i],
		[
			'spawn failure',
			{ exitCode: null, stdout: '', stderr: '', error: 'ENOENT' },
			/(?:start|spawn).*ENOENT/i,
		],
		['timeout', { exitCode: null, stdout: 'partial', stderr: '', timedOut: true }, /timed out/i],
		[
			'interruption',
			{ exitCode: null, signal: 'SIGINT', stdout: '', stderr: '', interrupted: true },
			/interrupted/i,
		],
	] as const)('normalizes %s into explicit failure data', async (_name, processResult, reason) => {
		const port = new RecordingProcessPort([processResult]);
		const { runValidationCheck } = await requireRunnerApi();
		const result = await runValidationCheck(descriptor('typecheck'), dependencies(port));

		expect(result).toMatchObject({ checkId: 'typecheck', status: 'FAIL', source: 'LIVE' });
		expect(result.reason).toMatch(reason);
	});

	it('bounds stdout and stderr independently and records deterministic truncation evidence', async () => {
		const port = new RecordingProcessPort([
			{ exitCode: 1, stdout: '123456789', stderr: 'abcdefghi' },
		]);
		const { runValidationCheck } = await requireRunnerApi();
		const result = await runValidationCheck(
			descriptor('check'),
			dependencies(port, { maxOutputBytes: 8 }),
		);

		expect(result.status).toBe('FAIL');
		expect(result.reason).toContain('stdout="12345678[truncated]"');
		expect(result.reason).toContain('stderr="abcdefgh[truncated]"');
		expect(Buffer.byteLength(result.reason)).toBeLessThan(1_000);
	});

	it('distinguishes exactly-at-limit output from one-byte-over output on both streams', async () => {
		const port = new RecordingProcessPort([
			{ exitCode: 1, stdout: '12345678', stderr: 'abcdefgh' },
			{ exitCode: 1, stdout: '123456789', stderr: 'abcdefghi' },
		]);
		const { runValidationCheck } = await requireRunnerApi();
		const configured = dependencies(port, { maxOutputBytes: 8 });
		const atLimit = await runValidationCheck(descriptor('check'), configured);
		const overLimit = await runValidationCheck(descriptor('check'), configured);

		expect(atLimit.reason).toContain('stdout="12345678"');
		expect(atLimit.reason).toContain('stderr="abcdefgh"');
		expect(atLimit.reason).not.toContain('[truncated]');
		expect(overLimit.reason.match(/\[truncated\]/g)).toHaveLength(2);
	});

	it('returns absent products as explicit LIVE failures without invoking a process', async () => {
		const port = new RecordingProcessPort([]);
		const { runValidationCheck } = await requireRunnerApi();
		const result = await runValidationCheck(descriptor('studio:build'), dependencies(port));

		expect(result).toMatchObject({
			checkId: 'studio:build',
			status: 'FAIL',
			source: 'LIVE',
		});
		expect(result.reason).toMatch(/Phase 8/i);
		expect(port.calls).toEqual([]);
	});

	it.each([
		[true, 'PASS'],
		[false, 'SKIP'],
	] as const)(
		'maps a probed apple-silicon capability available=%s to %s',
		async (available, status) => {
			const port = new RecordingProcessPort([]);
			const { runValidationCheck } = await requireRunnerApi();
			const result = await runValidationCheck(
				descriptor('local:check'),
				dependencies(port, {
					probeCapability: async (id) => ({ id, available, reason: `Available: ${available}.` }),
				}),
			);

			expect(result).toMatchObject({ checkId: 'local:check', status, source: 'LIVE' });
			expect(result.capability).toMatchObject({ id: 'apple-silicon', available });
			expect(port.calls).toEqual([]);
		},
	);

	it('requires explicit external integration evidence and never invokes the process port', async () => {
		const port = new RecordingProcessPort([]);
		const { runValidationCheck } = await requireRunnerApi();
		const integration = descriptor('test:integration');
		const stub = await runValidationCheck(
			integration,
			dependencies(port, {
				runExternal: async () => ({
					checkId: 'test:integration',
					status: 'PASS',
					source: 'FIXTURE',
					reason: 'Controlled integration-suite self stub.',
				}),
			}),
		);
		const absent = await runValidationCheck(
			integration,
			dependencies(port, { runExternal: undefined as never }),
		);

		expect(stub).toMatchObject({
			checkId: 'test:integration',
			status: 'PASS',
			source: 'FIXTURE',
		});
		expect(absent).toMatchObject({ checkId: 'test:integration', status: 'FAIL' });
		expect(absent.reason).toMatch(/external.*required|adapter.*required/i);
		expect(port.calls).toEqual([]);
	});
});

describe('runValidationBaseline', () => {
	it('preserves catalog order and stubs test:integration without a self-recursive process call', async () => {
		const port = new RecordingProcessPort([success, success, success]);
		const externalCalls: string[] = [];
		const { runValidationBaseline } = await requireRunnerApi();
		const result = await runValidationBaseline(
			dependencies(port, {
				runExternal: async (value) => {
					externalCalls.push(value.checkId);
					return {
						checkId: value.checkId,
						status: 'PASS',
						source: 'FIXTURE',
						reason: 'FIXTURE integration result.',
					};
				},
			}),
		);

		expect(result.results.map(({ checkId }) => checkId)).toEqual(
			CHECK_CATALOG.map(({ checkId }) => checkId),
		);
		expect(externalCalls).toEqual(['test:integration']);
		expect(port.calls.map(({ args }) => args.join(' '))).not.toContain(
			'x vitest run --config vitest.integration.config.ts',
		);
		expect(port.calls).toHaveLength(3);
	});

	it('is byte-stable for repeated controlled runs', async () => {
		const { runValidationBaseline } = await requireRunnerApi();
		const selected = [
			descriptor('check'),
			descriptor('test:integration'),
			descriptor('local:check'),
		];
		const firstPort = new RecordingProcessPort([success]);
		const secondPort = new RecordingProcessPort([success]);
		const first = await runValidationBaseline(dependencies(firstPort), selected);
		const second = await runValidationBaseline(dependencies(secondPort), selected);

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
		expect(secondPort.calls).toEqual(firstPort.calls);
	});
});
