import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const CLI_ENTRY = path.join(REPOSITORY_ROOT, 'src/cli.tsx');
const roots: string[] = [];

function parseEnvelope(output: string): Record<string, unknown> | null {
	try {
		return JSON.parse(output) as Record<string, unknown>;
	} catch {
		return null;
	}
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function invoke(
	args: readonly string[],
	mlxHome: string | undefined,
): Promise<{
	readonly code: number | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly home: string;
}> {
	const sandbox = await mkdtemp(path.join(tmpdir(), 'mlx-state-cli-'));
	roots.push(sandbox);
	const home = path.join(sandbox, 'home');
	const cwd = path.join(sandbox, 'cwd');
	await Promise.all([mkdir(home), mkdir(cwd)]);
	const runtime = process.env.MLX_TEST_BUN_PATH ?? process.env.npm_execpath;
	if (!runtime || !path.isAbsolute(runtime)) throw new Error('Explicit Bun path is required.');
	let stdout = '';
	let stderr = '';
	const env: NodeJS.ProcessEnv = {
		CI: '1',
		FORCE_COLOR: '0',
		HOME: home,
		LANG: 'C.UTF-8',
		NO_COLOR: '1',
		PATH: path.dirname(runtime),
		TERM: 'dumb',
	};
	if (mlxHome !== undefined) env.MLX_HOME = mlxHome;
	const child = spawn(runtime, [CLI_ENTRY, ...args], {
		cwd,
		env,
		shell: false,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout.setEncoding('utf8');
	child.stderr.setEncoding('utf8');
	child.stdout.on('data', (chunk: string) => {
		stdout += chunk;
	});
	child.stderr.on('data', (chunk: string) => {
		stderr += chunk;
	});
	const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
	return { code, stdout, stderr, home };
}

describe('public state CLI', () => {
	it.each([undefined, '', '  '])(
		'initializes the default home only for init (%j)',
		async (override) => {
			const result = await invoke(['init', '--json'], override);
			expect(result.code).toBe(0);
			const envelope = parseEnvelope(result.stdout);
			expect(envelope, 'init emits one JSON envelope').not.toBeNull();
			if (!envelope) return;
			expect(envelope).toMatchObject({ ok: true, command: 'init', status: 'success' });
			const data = envelope.data as Record<string, unknown>;
			expect(data).toMatchObject({ root: path.join(result.home, '.mlx'), changed: true });
			expect(await readdir(path.join(result.home, '.mlx'))).toHaveLength(1);
		},
	);

	it('normalizes absolute spaces/Unicode, remains idempotent, and leaves unrelated state byte-identical', async () => {
		const parent = await mkdtemp(path.join(tmpdir(), 'mlx-state-existing-'));
		roots.push(parent);
		const root = path.join(parent, 'MLX Δ', 'nested', '..', 'owned');
		await mkdir(path.normalize(root), { recursive: true });
		const sentinel = path.join(path.normalize(root), 'foreign.bin');
		const bytes = Buffer.from([3, 1, 4, 1, 5, 255]);
		await writeFile(sentinel, bytes);

		const rejected = await invoke(['init', '--json'], root);
		expect(rejected.code).not.toBe(0);
		expect(parseEnvelope(rejected.stdout)).toMatchObject({ ok: false, command: 'init' });
		expect(await readFile(sentinel)).toEqual(bytes);

		const adopted = await invoke(['init', '--adopt', '--json'], root);
		expect(adopted.code).toBe(0);
		expect(parseEnvelope(adopted.stdout)).toMatchObject({
			ok: true,
			data: { root: path.normalize(root), status: 'adopted', changed: true },
		});
		expect(await readFile(sentinel)).toEqual(bytes);
		const repeated = await invoke(['init', '--json'], root);
		expect(repeated.code).toBe(0);
		expect(parseEnvelope(repeated.stdout)).toMatchObject({
			data: { status: 'owned', changed: false },
		});
		expect(await readFile(sentinel)).toEqual(bytes);
	});

	it('rejects relative roots and malformed init flags without creating state', async () => {
		for (const args of [
			['init', '--json'],
			['init', '--adopt=true', '--json'],
			['init', '--adopt', '--adopt', '--json'],
		] as const) {
			const result = await invoke(args, 'relative/root');
			expect(result.code).not.toBe(0);
			expect(result.stdout).toMatch(/"ok":false/u);
			await expect(readdir(path.join(result.home, '.mlx'))).rejects.toMatchObject({
				code: 'ENOENT',
			});
		}
	});

	it('keeps help, parse errors, and unavailable commands read-only', async () => {
		const parent = await mkdtemp(path.join(tmpdir(), 'mlx-state-readonly-'));
		roots.push(parent);
		for (const args of [[], ['init', '--help'], ['unknown'], ['dataset', 'build']] as const) {
			const root = path.join(parent, args.join('-') || 'bare');
			await invoke(args, root);
			await expect(readdir(root)).rejects.toMatchObject({ code: 'ENOENT' });
		}
	});
});
