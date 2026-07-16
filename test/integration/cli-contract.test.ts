import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	readlink,
	realpath,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const CLI_ENTRY = path.join(REPOSITORY_ROOT, 'src/cli.tsx');
const CANONICAL_INTRODUCTION = 'MLX — the personal coding dataset and model pipeline';
const NEXT_ACTION = 'Run mlx doctor to check the executable and local environment.';
const EXPECTED_COMMAND_PATHS = [
	'doctor',
	'init',
	'auth status',
	'repos scan',
	'repos review',
	'repos set',
	'mirror',
	'metrics build',
	'metrics show',
	'evidence build',
	'preferences build',
	'dataset build',
	'dataset validate',
	'dataset inspect',
	'dataset push',
	'benchmark build',
	'benchmark run',
	'benchmark compare',
	'train preflight',
	'train run',
	'model serve',
	'agent run',
	'studio',
	'demo',
	'pipeline',
	'gc',
] as const;

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

interface FileFingerprint {
	readonly mode: number;
	readonly type: 'file' | 'symlink';
	readonly linkTarget: string | null;
	readonly sha256: string;
}

interface CliInvocation {
	readonly runtimePath: string;
	readonly args: readonly string[];
	readonly exitCode: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly timedOut: boolean;
	readonly spawnError: string | null;
	readonly createdFiles: readonly string[];
	readonly spyEvents: readonly string[];
	readonly modifiedSentinels: readonly string[];
}

function sha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function fingerprint(filePath: string): Promise<FileFingerprint> {
	const metadata = await lstat(filePath);
	if (metadata.isSymbolicLink()) {
		const linkTarget = await readlink(filePath);
		return {
			mode: metadata.mode & 0o777,
			type: 'symlink',
			linkTarget,
			sha256: sha256(linkTarget),
		};
	}
	return {
		mode: metadata.mode & 0o777,
		type: 'file',
		linkTarget: null,
		sha256: sha256(await readFile(filePath)),
	};
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
	const directory = path.join(root, relative);
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const child = path.join(relative, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
		else files.push(child);
	}
	return files.sort();
}

async function writeSpyExecutable(binDirectory: string, name: string): Promise<string> {
	const executable = path.join(binDirectory, name);
	const source = [
		'#!/bin/sh',
		`printf "%s\\n" "${name} $*" >> "$MLX_PHASE1_SPY_LOG"`,
		'exit 97',
		'',
	].join('\n');
	await writeFile(executable, source, { mode: 0o755 });
	return executable;
}

async function createSandbox(): Promise<{
	readonly root: string;
	readonly cwd: string;
	readonly home: string;
	readonly mlxHome: string;
	readonly bin: string;
	readonly preload: string;
	readonly spyLog: string;
	readonly immutableSentinels: readonly string[];
}> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-cli-contract-'));
	temporaryRoots.push(root);
	const cwd = path.join(root, 'work');
	const home = path.join(root, 'home');
	const mlxHome = path.join(root, 'unrelated-mlx-home');
	const bin = path.join(root, 'bin');
	const temp = path.join(root, 'tmp');
	await Promise.all([
		mkdir(cwd, { recursive: true }),
		mkdir(path.join(home, '.codex'), { recursive: true }),
		mkdir(mlxHome, { recursive: true }),
		mkdir(bin, { recursive: true }),
		mkdir(temp, { recursive: true }),
	]);

	const legacySettings = path.join(home, '.codex', 'settings.json');
	const shellSettings = path.join(home, '.zshrc');
	const unrelatedState = path.join(mlxHome, 'foreign-owner.txt');
	const spyLog = path.join(root, 'spy-events.log');
	await writeFile(
		legacySettings,
		`${JSON.stringify({ repl: { autoStartServer: false } }, null, 2)}\n`,
	);
	await writeFile(shellSettings, 'export PATH="/operator/sentinel"\n');
	await writeFile(unrelatedState, 'not owned by MLX\n');
	await writeFile(spyLog, '');

	const candidate = await writeSpyExecutable(bin, 'mlx');
	for (const command of ['python', 'git', 'gh', 'hf', 'huggingface-cli', 'curl', 'wget']) {
		await writeSpyExecutable(bin, command);
	}

	const preload = path.join(root, 'deny-network.mjs');
	await writeFile(
		preload,
		[
			"import { appendFileSync } from 'node:fs';",
			'const log = process.env.MLX_PHASE1_SPY_LOG;',
			'const originalFetch = globalThis.fetch;',
			'globalThis.fetch = async (...args) => {',
			'  const target = String(args[0]);',
			'  if (/^https?:/i.test(target)) {',
			"    appendFileSync(log, 'fetch ' + target + '\\n');",
			"    throw new Error('network denied by Phase 1 CLI contract fixture');",
			'  }',
			'  return originalFetch(...args);',
			'};',
			'',
		].join('\n'),
	);

	return {
		root,
		cwd,
		home,
		mlxHome,
		bin,
		preload,
		spyLog,
		immutableSentinels: [candidate, legacySettings, shellSettings, unrelatedState],
	};
}

function terminateProcessGroup(child: ReturnType<typeof spawn>): void {
	if (!child.pid) return;
	try {
		if (process.platform === 'win32') child.kill('SIGKILL');
		else process.kill(-child.pid, 'SIGKILL');
	} catch {
		child.kill('SIGKILL');
	}
}

async function invokeCli(args: readonly string[]): Promise<CliInvocation> {
	const sandbox = await createSandbox();
	const runtimeCandidate = process.env.MLX_TEST_BUN_PATH ?? process.env.npm_execpath;
	if (!runtimeCandidate || !path.isAbsolute(runtimeCandidate)) {
		throw new Error('An explicit Bun runtime path was not provided by the test launcher.');
	}
	const runtimePath = await realpath(runtimeCandidate);
	const beforeFiles = await listFiles(sandbox.root);
	const beforeSentinels = new Map<string, FileFingerprint>(
		await Promise.all(
			sandbox.immutableSentinels.map(
				async (filePath): Promise<readonly [string, FileFingerprint]> => [
					filePath,
					await fingerprint(filePath),
				],
			),
		),
	);
	let stdout = '';
	let stderr = '';
	let timedOut = false;
	let spawnError: string | null = null;

	const child = spawn(runtimePath, ['--preload', sandbox.preload, CLI_ENTRY, ...args], {
		cwd: sandbox.cwd,
		detached: process.platform !== 'win32',
		env: {
			ADAPTER_DIR: path.join(sandbox.root, 'adapter-output'),
			CI: '1',
			FORCE_COLOR: '0',
			HOME: sandbox.home,
			LANG: 'C.UTF-8',
			LOCAL_MODEL: 'fixture/model-that-must-not-load',
			MLX_HOME: sandbox.mlxHome,
			MLX_PHASE1_SPY_LOG: sandbox.spyLog,
			MLX_SERVER_URL: 'http://127.0.0.1:9/v1',
			NO_COLOR: '1',
			PATH: sandbox.bin,
			PWD: sandbox.cwd,
			TERM: 'dumb',
			TMPDIR: path.join(sandbox.root, 'tmp'),
		},
		shell: false,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout?.setEncoding('utf8');
	child.stderr?.setEncoding('utf8');
	child.stdout?.on('data', (chunk: string) => {
		stdout += chunk;
	});
	child.stderr?.on('data', (chunk: string) => {
		stderr += chunk;
	});
	child.on('error', (error) => {
		spawnError = error.message;
	});

	const closed = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
		(resolveClose) => {
			child.on('close', (exitCode, signal) => resolveClose({ exitCode, signal }));
		},
	);
	const timeout = setTimeout(() => {
		timedOut = true;
		terminateProcessGroup(child);
	}, 2_000);
	const { exitCode, signal } = await closed;
	clearTimeout(timeout);

	const afterFiles = await listFiles(sandbox.root);
	const createdFiles = afterFiles.filter((filePath) => !beforeFiles.includes(filePath));
	const modifiedSentinels: string[] = [];
	for (const [filePath, before] of beforeSentinels) {
		if (JSON.stringify(await fingerprint(filePath)) !== JSON.stringify(before)) {
			modifiedSentinels.push(path.relative(sandbox.root, filePath));
		}
	}
	const spyEvents = (await readFile(sandbox.spyLog, 'utf8')).split('\n').filter(Boolean);

	return {
		runtimePath,
		args: [...args],
		exitCode,
		signal,
		stdout,
		stderr,
		timedOut,
		spawnError,
		createdFiles,
		spyEvents,
		modifiedSentinels,
	};
}

function expectNoSideEffects(result: CliInvocation): void {
	const productCreatedFiles = result.createdFiles.filter(
		(filePath) => !filePath.startsWith('home/Library/Caches/bun/'),
	);
	expect.soft(result.spyEvents, 'network/model/server/host command spies').toEqual([]);
	expect
		.soft(productCreatedFiles, 'product files created after the controlled invocation')
		.toEqual([]);
	expect.soft(result.modifiedSentinels, 'candidate/home/state/shell sentinels').toEqual([]);
}

function combinedOutput(result: CliInvocation): string {
	return result.stdout + result.stderr;
}

function expectCompleted(result: CliInvocation): void {
	expect.soft(result.spawnError).toBeNull();
	expect.soft(result.signal).toBeNull();
	expect.soft(result.timedOut).toBe(false);
}

describe('public MLX process contract', () => {
	it('prints canonical ordered help for a bare explicit-Bun invocation', async () => {
		const result = await invokeCli([]);
		expectCompleted(result);
		expect.soft(path.basename(result.runtimePath)).toMatch(/^bun(?:\\.exe)?$/);
		expect.soft(result.exitCode).toBe(0);
		expect.soft(result.stderr).toBe('');
		expect.soft(result.stdout.split(CANONICAL_INTRODUCTION)).toHaveLength(2);
		expect.soft(result.stdout.startsWith(`${CANONICAL_INTRODUCTION}\n`)).toBe(true);

		let previousIndex = -1;
		for (const commandPath of EXPECTED_COMMAND_PATHS) {
			const index = result.stdout.indexOf(commandPath, previousIndex + 1);
			expect.soft(index, `ordered command ${commandPath}`).toBeGreaterThan(previousIndex);
			previousIndex = index;
		}
		expect.soft(result.stdout).toContain(NEXT_ACTION);
		expectNoSideEffects(result);
	});

	it('emits one compact six-key JSON help envelope with one newline', async () => {
		const result = await invokeCli(['--json']);
		expectCompleted(result);
		expect.soft(result.exitCode).toBe(0);
		expect.soft(result.stderr).toBe('');
		expect.soft(result.stdout.endsWith('\n')).toBe(true);
		expect.soft(result.stdout.slice(0, -1)).not.toContain('\n');
		expect.soft(result.stdout).not.toContain(String.fromCharCode(27));

		let parsed: unknown = null;
		try {
			parsed = JSON.parse(result.stdout);
		} catch {
			parsed = null;
		}
		expect.soft(parsed).not.toBeNull();
		if (parsed && typeof parsed === 'object') {
			const envelope = parsed as Record<string, unknown>;
			expect
				.soft(Object.keys(envelope))
				.toEqual(['schemaVersion', 'ok', 'command', 'status', 'data', 'error']);
			expect.soft(envelope.schemaVersion).toBe('1');
			expect.soft(envelope.ok).toBe(true);
			expect.soft(envelope.command).toBe('help');
			expect.soft(envelope.status).toBe('help');
			expect.soft(envelope.error).toBeNull();
		}
		expectNoSideEffects(result);
	});

	it('returns deterministic owner-tagged UNAVAILABLE without running legacy work', async () => {
		const first = await invokeCli(['dataset', 'build']);
		const second = await invokeCli(['dataset', 'build']);
		for (const result of [first, second]) {
			expectCompleted(result);
			expect.soft(result.exitCode).toBe(3);
			expect.soft(combinedOutput(result)).toContain('UNAVAILABLE  mlx dataset build');
			expect
				.soft(combinedOutput(result))
				.toContain('This command is defined but is not available in Phase 1.');
			expect
				.soft(combinedOutput(result))
				.toContain(
					'Available in Phase 5: Hugging Face dataset compiler, deduplication, and leakage-safe splits.',
				);
			expect
				.soft(combinedOutput(result))
				.toContain('Run mlx dataset --help to inspect this command group.');
			expectNoSideEffects(result);
		}
		expect.soft(first.stdout).toBe(second.stdout);
		expect.soft(first.stderr).toBe(second.stderr);
		expect.soft(first.exitCode).toBe(second.exitCode);
	});

	it('returns deterministic parse failures for unknown and malformed paths', async () => {
		const unknownA = await invokeCli(['datsset']);
		const unknownB = await invokeCli(['datsset']);
		const malformedA = await invokeCli(['repos', 'set', 'demo', '--mode', 'invalid']);
		const malformedB = await invokeCli(['repos', 'set', 'demo', '--mode', 'invalid']);

		for (const result of [unknownA, unknownB, malformedA, malformedB]) {
			expectCompleted(result);
			expect.soft(result.exitCode).toBe(2);
			expectNoSideEffects(result);
		}
		expect
			.soft(combinedOutput(unknownA))
			.toContain('Unknown command: datsset. Run mlx --help to list valid commands.');
		expect.soft(combinedOutput(malformedA)).toContain('INVALID_ARGUMENT');
		expect.soft(combinedOutput(malformedA)).toContain('included|excluded|holdout|metrics-only');
		expect.soft(unknownA.stdout).toBe(unknownB.stdout);
		expect.soft(unknownA.stderr).toBe(unknownB.stderr);
		expect.soft(malformedA.stdout).toBe(malformedB.stdout);
		expect.soft(malformedA.stderr).toBe(malformedB.stderr);
	});

	it('renders leaf help successfully even when the command is unavailable', async () => {
		const result = await invokeCli(['dataset', 'build', '--help']);
		expectCompleted(result);
		expect.soft(result.exitCode).toBe(0);
		expect.soft(combinedOutput(result)).toContain('mlx dataset build');
		expect.soft(combinedOutput(result)).toContain('smoke|presentation|core|full');
		expect.soft(combinedOutput(result)).toContain('available Phase 5');
		expectNoSideEffects(result);
	});
});
