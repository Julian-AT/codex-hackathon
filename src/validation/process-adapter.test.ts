import { describe, expect, it, vi } from 'vitest';

import { getCheckDescriptor } from './check-catalog';
import type { ProcessRequest } from './runner';

async function loadSubject() {
	return await import('./process-adapter').catch(() => null);
}

function requestFor(checkId: 'check' | 'typecheck' | 'test' | 'test:integration'): ProcessRequest {
	const descriptor = getCheckDescriptor(checkId);
	if (
		!descriptor ||
		(descriptor.execution.kind !== 'fixed-process' &&
			descriptor.execution.kind !== 'external-harness')
	) {
		throw new Error(`Missing process descriptor for ${checkId}.`);
	}
	return Object.freeze({
		executable: descriptor.execution.executable,
		args: descriptor.execution.args,
		shell: false,
		maxOutputBytes: 8,
		timeoutMs: 1_000,
	});
}

function stream(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe('createBunCheckRunner', () => {
	it('passes only a copied allowlisted token array to a shell-free ignored-stdin spawn', async () => {
		const subject = await loadSubject();
		expect(subject?.createBunCheckRunner).toBeTypeOf('function');
		if (!subject) return;

		const calls: unknown[] = [];
		const runner = subject.createBunCheckRunner({
			spawn: (options) => {
				calls.push(options);
				return {
					stdout: stream('ok'),
					stderr: stream(''),
					exited: Promise.resolve(0),
					kill: vi.fn(),
				};
			},
		});
		const request = requestFor('check');
		const result = await runner.run(request);

		expect(result).toMatchObject({ exitCode: 0, stdout: 'ok', stderr: '' });
		expect(calls).toEqual([
			{
				cmd: ['bun', 'x', 'biome', 'check', '.'],
				stdin: 'ignore',
				stdout: 'pipe',
				stderr: 'pipe',
				shell: false,
			},
		]);
		expect((calls[0] as { cmd: string[] }).cmd).not.toBe(request.args);
	});

	it('rejects arbitrary executables, appended arguments, watch mode, and shell requests before spawn', async () => {
		const subject = await loadSubject();
		expect(subject?.createBunCheckRunner).toBeTypeOf('function');
		if (!subject) return;

		const spawn = vi.fn();
		const runner = subject.createBunCheckRunner({ spawn });
		const canonical = requestFor('test');
		const unsafe = [
			{ ...canonical, executable: 'bash' },
			{ ...canonical, args: [...canonical.args, '--changed-by-caller'] },
			{ ...canonical, args: ['x', 'vitest', 'watch'] },
			{ ...canonical, shell: true },
		] as const;

		for (const request of unsafe) {
			const result = await runner.run(request as unknown as ProcessRequest);
			expect(result.exitCode).toBeNull();
			expect(result.error).toMatch(/allowlisted|shell|request/i);
		}
		expect(spawn).not.toHaveBeenCalled();
	});

	it('bounds stdout and stderr independently and reports nonzero and spawn failures without success', async () => {
		const subject = await loadSubject();
		expect(subject?.createBunCheckRunner).toBeTypeOf('function');
		if (!subject) return;

		const runner = subject.createBunCheckRunner({
			spawn: () => ({
				stdout: stream('0123456789'),
				stderr: stream('abcdefghij'),
				exited: Promise.resolve(7),
				kill: vi.fn(),
			}),
		});
		const result = await runner.run({ ...requestFor('typecheck'), maxOutputBytes: 4 });
		expect(result.exitCode).toBe(7);
		expect(result.stdout).toBe('0123[truncated]');
		expect(result.stderr).toBe('abcd[truncated]');

		const failed = subject.createBunCheckRunner({
			spawn: () => {
				throw new Error('spawn unavailable');
			},
		});
		await expect(failed.run(requestFor('check'))).resolves.toMatchObject({
			exitCode: null,
			error: 'spawn unavailable',
		});
	});

	it('kills and awaits a child on timeout', async () => {
		const subject = await loadSubject();
		expect(subject?.createBunCheckRunner).toBeTypeOf('function');
		if (!subject) return;

		const exit = deferred<number>();
		let timer: (() => void) | null = null;
		const kill = vi.fn(() => exit.resolve(143));
		const runner = subject.createBunCheckRunner({
			spawn: () => ({ stdout: stream(''), stderr: stream(''), exited: exit.promise, kill }),
			setTimer: (callback) => {
				timer = callback;
				return 1;
			},
			clearTimer: vi.fn(),
		});
		const pending = runner.run(requestFor('check'));
		await Promise.resolve();
		expect(timer).toBeTypeOf('function');
		if (timer) (timer as () => void)();

		await expect(pending).resolves.toMatchObject({ exitCode: 143, timedOut: true });
		expect(kill).toHaveBeenCalledTimes(1);
	});

	it('kills and awaits a child on interruption and retains the named signal', async () => {
		const subject = await loadSubject();
		expect(subject?.createBunCheckRunner).toBeTypeOf('function');
		if (!subject) return;

		const exit = deferred<number>();
		let interrupt: ((signal: string) => void) | null = null;
		const kill = vi.fn(() => exit.resolve(130));
		const unsubscribe = vi.fn();
		const runner = subject.createBunCheckRunner({
			spawn: () => ({ stdout: stream(''), stderr: stream(''), exited: exit.promise, kill }),
			onInterrupt: (callback) => {
				interrupt = callback;
				return unsubscribe;
			},
		});
		const pending = runner.run(requestFor('check'));
		await Promise.resolve();
		expect(interrupt).toBeTypeOf('function');
		if (interrupt) (interrupt as (signal: string) => void)('SIGINT');

		await expect(pending).resolves.toMatchObject({
			exitCode: 130,
			interrupted: true,
			signal: 'SIGINT',
		});
		expect(kill).toHaveBeenCalledTimes(1);
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});
});
