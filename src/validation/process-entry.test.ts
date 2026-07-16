import { describe, expect, it, vi } from 'vitest';

import type { CheckRunnerPort, ProcessRequest, ProcessResult } from './runner';

async function loadSubject() {
	return await import('./process-entry').catch(() => null);
}

function successfulRunner(requests: ProcessRequest[]): CheckRunnerPort {
	return {
		async run(request): Promise<ProcessResult> {
			requests.push(request);
			return { exitCode: 0, stdout: 'ok', stderr: '' };
		},
	};
}

describe('runValidationProcessEntry', () => {
	it.each(['check', 'typecheck', 'test', 'studio:build', 'dataset:validate', 'benchmark:smoke']) (
		'reaches the correct production branch for run %s',
		async (checkId) => {
			const subject = await loadSubject();
			expect(subject?.runValidationProcessEntry).toBeTypeOf('function');
			if (!subject) return;

			const requests: ProcessRequest[] = [];
			const writes: string[] = [];
			const exits: number[] = [];
			await subject.runValidationProcessEntry(['run', checkId, '--json'], {
				createRunner: () => successfulRunner(requests),
				createProbe: () => async () => ({
					id: 'apple-silicon',
					available: true,
					reason: 'Apple Silicon is available.',
				}),
				write: (value) => writes.push(value),
				setExitCode: (value) => exits.push(value),
				columns: 80,
				isTTY: false,
			});

			expect(writes).toHaveLength(1);
			expect(exits).toHaveLength(1);
			const envelope = JSON.parse(writes[0] ?? '{}') as { data?: { results?: unknown[] } };
			expect(envelope.data?.results).toHaveLength(1);
			if (['check', 'typecheck', 'test'].includes(checkId)) expect(requests).toHaveLength(1);
			else expect(requests).toHaveLength(0);
		},
	);

	it('uses the named host probe for local:check', async () => {
		const subject = await loadSubject();
		expect(subject?.runValidationProcessEntry).toBeTypeOf('function');
		if (!subject) return;

		const probe = vi.fn(async () => ({
			id: 'apple-silicon' as const,
			available: false as const,
			reason: 'Apple Silicon requires Darwin arm64.',
		}));
		const writes: string[] = [];
		await subject.runValidationProcessEntry(['run', 'local:check', '--json'], {
			createRunner: () => successfulRunner([]),
			createProbe: () => probe,
			write: (value) => writes.push(value),
			setExitCode: vi.fn(),
			columns: 80,
			isTTY: false,
		});

		expect(probe).toHaveBeenCalledWith('apple-silicon');
		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain('"status":"SKIP"');
	});

	it('runs only the fixed direct Vitest descriptor in explicit external mode', async () => {
		const subject = await loadSubject();
		expect(subject?.runValidationProcessEntry).toBeTypeOf('function');
		if (!subject) return;

		const requests: ProcessRequest[] = [];
		const writes: string[] = [];
		await subject.runValidationProcessEntry(['external', 'test:integration', '--json'], {
			createRunner: () => successfulRunner(requests),
			createProbe: () => async () => {
				throw new Error('capability probe must not run');
			},
			write: (value) => writes.push(value),
			setExitCode: vi.fn(),
			columns: 80,
			isTTY: false,
		});

		expect(requests).toEqual([
			{
				executable: 'bun',
				args: ['x', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
				shell: false,
				maxOutputBytes: expect.any(Number),
				timeoutMs: expect.any(Number),
			},
		]);
		expect(JSON.stringify(requests)).not.toContain('test:integration');
		expect(writes).toHaveLength(1);
	});

	it.each([
		[],
		['baseline'],
		['external', 'check'],
		['external', 'test:integration', '--extra'],
		['run', 'test:integration'],
		['run', 'check', '--changed-by-caller'],
	])('rejects malformed or recursive mode %j before creating a runner', async (argv) => {
		const subject = await loadSubject();
		expect(subject?.runValidationProcessEntry).toBeTypeOf('function');
		if (!subject) return;

		const createRunner = vi.fn(() => successfulRunner([]));
		const writes: string[] = [];
		const exits: number[] = [];
		await subject.runValidationProcessEntry(argv, {
			createRunner,
			createProbe: () => async () => {
				throw new Error('probe must not run');
			},
			write: (value) => writes.push(value),
			setExitCode: (value) => exits.push(value),
			columns: 80,
			isTTY: false,
		});

		expect(createRunner).not.toHaveBeenCalled();
		expect(writes).toHaveLength(1);
		expect(writes[0]).toMatch(/invalid|expected|external/i);
		expect(exits).toEqual([2]);
	});

	it('bounds internal exceptions into one deterministic nonzero write', async () => {
		const subject = await loadSubject();
		expect(subject?.runValidationProcessEntry).toBeTypeOf('function');
		if (!subject) return;

		const writes: string[] = [];
		const exits: number[] = [];
		await subject.runValidationProcessEntry(['run', 'check', '--json'], {
			createRunner: () => {
				throw new Error(`private detail ${'x'.repeat(4_000)}`);
			},
			createProbe: () => async () => {
				throw new Error('probe must not run');
			},
			write: (value) => writes.push(value),
			setExitCode: (value) => exits.push(value),
			columns: 80,
			isTTY: false,
		});

		expect(writes).toHaveLength(1);
		expect(Buffer.byteLength(writes[0] ?? '')).toBeLessThanOrEqual(1_200);
		expect(writes[0]).not.toContain('at ');
		expect(exits).toEqual([1]);
	});
});
