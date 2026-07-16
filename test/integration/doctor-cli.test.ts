import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const cliEntry = path.join(repositoryRoot, 'src/cli.tsx');
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

async function root(): Promise<string> {
	const value = await mkdtemp(path.join(tmpdir(), 'mlx-doctor-cli-'));
	temporaryRoots.push(value);
	return value;
}

async function executable(file: string, body: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body, 'utf8');
	await chmod(file, 0o755);
}

async function fingerprint(paths: readonly string[]): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const file of paths) {
		const metadata = await lstat(file);
		const payload = metadata.isSymbolicLink()
			? `link:${await readlink(file)}`
			: (await readFile(file)).toString('base64');
		result[file] = createHash('sha256')
			.update(`${metadata.mode & 0o7777}:${payload}`)
			.digest('hex');
	}
	return result;
}

async function invoke(pathValue: string, json: boolean) {
	const runtime = process.env.MLX_TEST_BUN_PATH ?? process.env.npm_execpath;
	if (!runtime || !path.isAbsolute(runtime)) throw new Error('Explicit Bun path is required.');
	let stdout = '';
	let stderr = '';
	const child = spawn(runtime, [cliEntry, 'doctor', ...(json ? ['--json'] : [])], {
		cwd: repositoryRoot,
		env: {
			CI: '1',
			FORCE_COLOR: '0',
			HOME: path.dirname(pathValue),
			LANG: 'C.UTF-8',
			NO_COLOR: '1',
			PATH: pathValue,
			TERM: 'dumb',
		},
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
	return { code, stdout, stderr };
}

function parseEnvelope(output: string): Record<string, unknown> | null {
	try {
		return JSON.parse(output) as Record<string, unknown>;
	} catch {
		return null;
	}
}

describe('public mlx doctor', () => {
	it('agrees in human and JSON modes for owned, collision with shadowed ownership, and not-found', async () => {
		const sandbox = await root();
		const foreignDir = path.join(sandbox, 'foreign');
		const ownedDir = path.join(sandbox, 'owned');
		await executable(
			path.join(foreignDir, 'mlx'),
			'#!/bin/sh\necho launched > execution-sentinel\n',
		);
		await mkdir(ownedDir, { recursive: true });
		await symlink(cliEntry, path.join(ownedDir, 'mlx'));

		const ownedHuman = await invoke(ownedDir, false);
		const ownedJson = await invoke(ownedDir, true);
		const collisionPath = [foreignDir, ownedDir].join(path.delimiter);
		const collisionHuman = await invoke(collisionPath, false);
		const collisionJson = await invoke(collisionPath, true);
		const none = await invoke(path.join(sandbox, 'none'), true);

		expect(ownedHuman).toMatchObject({ code: 0, stderr: '' });
		expect(ownedHuman.stdout).toContain('Executable: OWNED');
		expect(parseEnvelope(ownedJson.stdout), 'owned JSON envelope').toMatchObject({
			ok: true,
			command: 'doctor',
			status: 'owned',
			data: { classification: 'owned', effective: { path: path.join(ownedDir, 'mlx') } },
		});
		expect(collisionHuman.code).not.toBe(0);
		expect(collisionHuman.stdout).toContain('Executable: COLLISION');
		expect(collisionHuman.stdout).toContain('Shadowed candidates: 1');
		expect(parseEnvelope(collisionJson.stdout), 'collision JSON envelope').toMatchObject({
			ok: false,
			status: 'collision',
			data: {
				classification: 'collision',
				effective: { path: path.join(foreignDir, 'mlx') },
				shadowed: [{ path: path.join(ownedDir, 'mlx'), ownership: 'owned' }],
			},
		});
		expect(none.code).not.toBe(0);
		expect(parseEnvelope(none.stdout), 'not-found JSON envelope').toMatchObject({
			ok: false,
			status: 'not-found',
			data: { classification: 'not-found', candidates: [] },
		});
	});

	it('never executes or mutates a hostile body, symlink, PATH, alias, shell, or state sentinel under repeat and parallel diagnosis', async () => {
		const sandbox = await root();
		const foreignDir = path.join(sandbox, 'foreign');
		const body = path.join(foreignDir, 'mlx');
		const sentinel = path.join(repositoryRoot, 'execution-sentinel');
		await rm(sentinel, { force: true });
		await executable(body, `#!/bin/sh\necho launched > ${JSON.stringify(sentinel)}\n`);
		const files = [
			body,
			path.join(sandbox, 'path.txt'),
			path.join(sandbox, 'aliases.txt'),
			path.join(sandbox, 'shell-config.txt'),
			path.join(sandbox, 'state-root.txt'),
		];
		for (const file of files.slice(1)) await writeFile(file, `sentinel:${file}\n`);
		const before = await fingerprint(files);

		const repeated = [await invoke(foreignDir, true), await invoke(foreignDir, true)];
		const parallel = await Promise.all(
			Array.from({ length: 6 }, async () => await invoke(foreignDir, true)),
		);

		expect(repeated[0]).toEqual(repeated[1]);
		expect(
			parallel.every(
				(result) => result.stdout === repeated[0].stdout && result.code === repeated[0].code,
			),
		).toBe(true);
		expect(await fingerprint(files)).toEqual(before);
		await expect(readFile(sentinel)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('escapes terminal controls without truncating long Unicode evidence while JSON preserves the exact path', async () => {
		const sandbox = await root();
		const hostileDir = path.join(
			sandbox,
			`${'very-long-Δ-'.repeat(12)}control-${String.fromCharCode(27)}[31m`,
		);
		await executable(path.join(hostileDir, 'mlx'), '#!/bin/sh\nexit 1\n');
		const human = await invoke(hostileDir, false);
		const json = await invoke(hostileDir, true);
		const parsed = parseEnvelope(json.stdout) as {
			data?: { effective?: { path?: string } };
		} | null;

		expect(human.stdout).not.toContain(String.fromCharCode(27));
		expect(human.stdout).toContain('\\x1b[31m');
		expect(human.stdout).toContain('very-long-Δ-');
		expect(parsed?.data?.effective?.path).toBe(path.join(hostileDir, 'mlx'));
	});
});
