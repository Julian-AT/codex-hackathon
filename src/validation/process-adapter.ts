import { CHECK_CATALOG } from './check-catalog';
import type { CheckRunnerPort, ProcessRequest, ProcessResult } from './runner';

const TRUNCATION_MARKER = '[truncated]';

export interface BunSpawnOptions {
	readonly cmd: readonly string[];
	readonly stdin: 'ignore';
	readonly stdout: 'pipe';
	readonly stderr: 'pipe';
	readonly shell: false;
}

export interface BunSpawnedProcess {
	readonly stdout: ReadableStream<Uint8Array>;
	readonly stderr: ReadableStream<Uint8Array>;
	readonly exited: Promise<number>;
	kill(): void;
}

export interface BunCheckRunnerDependencies {
	readonly spawn?: (options: BunSpawnOptions) => BunSpawnedProcess;
	readonly setTimer?: (callback: () => void, timeoutMs: number) => unknown;
	readonly clearTimer?: (handle: unknown) => void;
	readonly onInterrupt?: (callback: (signal: string) => void) => () => void;
}

interface BoundedStream {
	readonly value: string;
	readonly truncated: boolean;
}

const PROCESS_ALLOWLIST = Object.freeze(
	CHECK_CATALOG.flatMap((descriptor) => {
		if (
			descriptor.execution.kind !== 'fixed-process' &&
			descriptor.execution.kind !== 'external-harness'
		) {
			return [];
		}
		return [
			Object.freeze({
				executable: descriptor.execution.executable,
				args: Object.freeze([...descriptor.execution.args]),
			}),
		];
	}),
);

function isExactAllowlistedRequest(request: ProcessRequest): boolean {
	if (request.shell !== false) return false;
	if (!Number.isSafeInteger(request.maxOutputBytes) || request.maxOutputBytes < 1) return false;
	if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1) return false;
	if (request.args.some((argument) => /^(?:--?watch|watch)$/i.test(argument))) return false;
	return PROCESS_ALLOWLIST.some(
		(allowed) =>
			allowed.executable === request.executable &&
			allowed.args.length === request.args.length &&
			allowed.args.every((argument, index) => argument === request.args[index]),
	);
}

async function readBounded(
	stream: ReadableStream<Uint8Array>,
	maxOutputBytes: number,
): Promise<BoundedStream> {
	const reader = stream.getReader();
	const captured: Uint8Array[] = [];
	let capturedBytes = 0;
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			const remaining = maxOutputBytes - capturedBytes;
			if (remaining > 0) {
				const piece = value.subarray(0, remaining);
				captured.push(piece);
				capturedBytes += piece.byteLength;
			}
		}
	} finally {
		reader.releaseLock();
	}

	const joined = new Uint8Array(capturedBytes);
	let offset = 0;
	for (const piece of captured) {
		joined.set(piece, offset);
		offset += piece.byteLength;
	}
	const value = new TextDecoder('utf-8', { fatal: false }).decode(joined);
	return {
		value: totalBytes > maxOutputBytes ? `${value}${TRUNCATION_MARKER}` : value,
		truncated: totalBytes > maxOutputBytes,
	};
}

function defaultSpawn(options: BunSpawnOptions): BunSpawnedProcess {
	const runtime = (
		globalThis as typeof globalThis & {
			Bun?: {
				spawn(options: {
					cmd: string[];
					stdin: 'ignore';
					stdout: 'pipe';
					stderr: 'pipe';
				}): {
					stdout: ReadableStream<Uint8Array>;
					stderr: ReadableStream<Uint8Array>;
					exited: Promise<number>;
					kill(): void;
				};
			};
		}
	).Bun;
	if (!runtime) throw new Error('Bun process runtime is unavailable.');
	const child = runtime.spawn({
		cmd: [...options.cmd],
		stdin: options.stdin,
		stdout: options.stdout,
		stderr: options.stderr,
	});
	return {
		stdout: child.stdout,
		stderr: child.stderr,
		exited: child.exited,
		kill: () => child.kill(),
	};
}

function defaultSetTimer(callback: () => void, timeoutMs: number): unknown {
	return setTimeout(callback, timeoutMs);
}

function defaultClearTimer(handle: unknown): void {
	clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function defaultOnInterrupt(callback: (signal: string) => void): () => void {
	const onSigint = () => callback('SIGINT');
	const onSigterm = () => callback('SIGTERM');
	process.once('SIGINT', onSigint);
	process.once('SIGTERM', onSigterm);
	return () => {
		process.off('SIGINT', onSigint);
		process.off('SIGTERM', onSigterm);
	};
}

function rejectedRequest(reason: string): ProcessResult {
	return Object.freeze({
		exitCode: null,
		stdout: '',
		stderr: '',
		error: reason,
	});
}

export function createBunCheckRunner(
	dependencies: BunCheckRunnerDependencies = {},
): CheckRunnerPort {
	const spawn = dependencies.spawn ?? defaultSpawn;
	const setTimer = dependencies.setTimer ?? defaultSetTimer;
	const clearTimer = dependencies.clearTimer ?? defaultClearTimer;
	const onInterrupt = dependencies.onInterrupt ?? defaultOnInterrupt;

	return Object.freeze({
		async run(request: ProcessRequest): Promise<ProcessResult> {
			if (!isExactAllowlistedRequest(request)) {
				return rejectedRequest(
					'Process request is not an exact shell-free allowlisted catalog command.',
				);
			}

			const cmd = Object.freeze([request.executable, ...request.args]);
			let child: BunSpawnedProcess;
			try {
				child = spawn({
					cmd,
					stdin: 'ignore',
					stdout: 'pipe',
					stderr: 'pipe',
					shell: false,
				});
			} catch (error) {
				return rejectedRequest(error instanceof Error ? error.message : String(error));
			}

			let timedOut = false;
			let interrupted = false;
			let signal: string | null = null;
			let killRequested = false;
			const kill = (nextSignal: string) => {
				if (killRequested) return;
				killRequested = true;
				signal = nextSignal;
				try {
					child.kill();
				} catch {
					// The exit promise remains the authoritative lifecycle result.
				}
			};
			const timer = setTimer(() => {
				timedOut = true;
				kill('SIGTERM');
			}, request.timeoutMs);
			const unsubscribe = onInterrupt((interruptSignal) => {
				interrupted = true;
				kill(interruptSignal);
			});

			try {
				const [exitCode, stdout, stderr] = await Promise.all([
					child.exited,
					readBounded(child.stdout, request.maxOutputBytes),
					readBounded(child.stderr, request.maxOutputBytes),
				]);
				return Object.freeze({
					exitCode,
					signal,
					stdout: stdout.value,
					stderr: stderr.value,
					...(timedOut ? { timedOut: true } : {}),
					...(interrupted ? { interrupted: true } : {}),
				});
			} catch (error) {
				kill('SIGTERM');
				return Object.freeze({
					exitCode: null,
					signal,
					stdout: '',
					stderr: '',
					error: error instanceof Error ? error.message : String(error),
					...(timedOut ? { timedOut: true } : {}),
					...(interrupted ? { interrupted: true } : {}),
				});
			} finally {
				clearTimer(timer);
				unsubscribe();
			}
		},
	});
}
