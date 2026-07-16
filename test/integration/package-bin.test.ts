import { execFile } from 'node:child_process';
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
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const temporaryRoots: string[] = [];

interface PackageFixture {
	repeatedChecks: number;
	concurrentChecks: number;
	sentinels: Array<{
		path: string;
		kind: 'file' | 'symlink';
		content?: string;
		target?: string;
	}>;
}

interface IdentityFixture {
	canonicalPhrase: string;
	packageFixture: PackageFixture;
}

interface PackageOwnershipMarker {
	schemaVersion: string;
	productId: string;
	packageName: string;
	executable: string;
	entry: string;
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

async function createTemporaryRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-package-bin-'));
	temporaryRoots.push(root);
	return root;
}

async function loadFixture(): Promise<IdentityFixture> {
	return JSON.parse(
		await readFile(path.join(repositoryRoot, 'fixtures/phase-1/identity/scoped-tree.json'), 'utf8'),
	) as IdentityFixture;
}

async function createSentinels(root: string, fixture: PackageFixture): Promise<void> {
	for (const sentinel of fixture.sentinels) {
		const targetPath = path.join(root, sentinel.path);
		await mkdir(path.dirname(targetPath), { recursive: true });
		if (sentinel.kind === 'symlink') {
			await symlink(sentinel.target ?? '', targetPath);
		} else {
			await writeFile(targetPath, sentinel.content ?? '', 'utf8');
			if (sentinel.path === 'unrelated-bin/mlx') await chmod(targetPath, 0o755);
		}
	}
}

async function fingerprint(root: string, fixture: PackageFixture): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const sentinel of fixture.sentinels) {
		const targetPath = path.join(root, sentinel.path);
		const stat = await lstat(targetPath);
		const value = stat.isSymbolicLink()
			? `link:${await readlink(targetPath)}`
			: await readFile(targetPath);
		const payload = typeof value === 'string' ? value : value.toString('base64');
		result[sentinel.path] = createHash('sha256')
			.update(`${stat.mode & 0o7777}:${payload}`)
			.digest('hex');
	}
	return result;
}

async function packRepository(destination: string, filename: string): Promise<string> {
	const tarball = path.join(destination, filename);
	await execFileAsync('bun', ['pm', 'pack', '--ignore-scripts', '--filename', tarball, '--quiet'], {
		cwd: repositoryRoot,
		env: {
			...process.env,
			CI: '1',
			NO_PROXY: '*',
			http_proxy: 'http://127.0.0.1:9',
			https_proxy: 'http://127.0.0.1:9',
			HTTP_PROXY: 'http://127.0.0.1:9',
			HTTPS_PROXY: 'http://127.0.0.1:9',
		},
		timeout: 10_000,
	});
	return tarball;
}

async function installPackedArtifact(tarball: string, installationRoot: string): Promise<string> {
	const packageRoot = path.join(installationRoot, 'node_modules', 'mlx-personal-coding-pipeline');
	const extractionRoot = path.join(installationRoot, 'extract');
	await mkdir(extractionRoot, { recursive: true });
	await execFileAsync('tar', ['-xzf', tarball, '-C', extractionRoot], { timeout: 10_000 });
	await mkdir(path.dirname(packageRoot), { recursive: true });
	await execFileAsync('mv', [path.join(extractionRoot, 'package'), packageRoot], {
		timeout: 10_000,
	});

	const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
		bin?: Record<string, string>;
	};
	const entries = Object.entries(manifest.bin ?? {});
	if (entries.length !== 1 || entries[0]?.[0] !== 'mlx') {
		throw new Error('Packed package does not declare the sole mlx executable.');
	}
	const entryPath = path.join(packageRoot, entries[0][1]);
	await chmod(entryPath, 0o755);
	const binRoot = path.join(installationRoot, 'node_modules', '.bin');
	await mkdir(binRoot, { recursive: true });
	const installedBin = path.join(binRoot, 'mlx');
	await symlink(path.relative(binRoot, entryPath), installedBin);
	return installedBin;
}

describe('packed mlx executable ownership', () => {
	it('declares exactly one mlx bin and a matching versioned ownership marker', async () => {
		const packageJson = JSON.parse(
			await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
		) as {
			name?: string;
			description?: string;
			private?: boolean;
			bin?: Record<string, string>;
			files?: string[];
			scripts?: Record<string, string>;
		};
		const marker = JSON.parse(
			await readFile(path.join(repositoryRoot, 'mlx.package.json'), 'utf8').catch(() => '{}'),
		) as Partial<PackageOwnershipMarker>;

		expect(packageJson.name).toBe('mlx-personal-coding-pipeline');
		expect(
			packageJson.description?.startsWith('MLX — the personal coding dataset and model pipeline'),
		).toBe(true);
		expect(packageJson.private).not.toBe(false);
		expect(packageJson.bin).toEqual({ mlx: './src/cli.tsx' });
		expect(packageJson.files).toContain('mlx.package.json');
		expect(packageJson.files).toContain('src/core/**/*.ts');
		expect(packageJson.scripts).not.toHaveProperty('preinstall');
		expect(packageJson.scripts).not.toHaveProperty('install');
		expect(packageJson.scripts).not.toHaveProperty('postinstall');
		expect(marker).toEqual({
			schemaVersion: '1',
			productId: 'mlx-personal-coding-pipeline',
			packageName: packageJson.name,
			executable: 'mlx',
			entry: './src/cli.tsx',
		});
	});

	it('packs and locally installs a runnable help surface without network or global linking', async () => {
		const fixture = await loadFixture();
		const root = await createTemporaryRoot();
		const tarball = await packRepository(root, 'mlx-package.tgz');
		const installedBin = await installPackedArtifact(tarball, path.join(root, 'prefix'));

		const { stdout, stderr } = await execFileAsync(installedBin, ['--help'], {
			cwd: root,
			env: {
				PATH: process.env.PATH ?? '/usr/bin:/bin',
				HOME: path.join(root, 'home'),
				MLX_HOME: path.join(root, 'mlx home'),
				NO_PROXY: '*',
				http_proxy: 'http://127.0.0.1:9',
				https_proxy: 'http://127.0.0.1:9',
			},
			timeout: 10_000,
		});

		expect(stderr).toBe('');
		expect(stdout.startsWith(fixture.canonicalPhrase)).toBe(true);
		expect(stdout).toContain('Usage:\n  mlx <command> [options]');
		const marker = JSON.parse(
			await readFile(
				path.join(root, 'prefix/node_modules/mlx-personal-coding-pipeline/mlx.package.json'),
				'utf8',
			),
		) as PackageOwnershipMarker;
		expect(marker.executable).toBe('mlx');
	});

	it('leaves unrelated executable, link, alias, PATH, and shell sentinels byte-identical across repeated and concurrent checks', async () => {
		const fixture = await loadFixture();
		const root = await createTemporaryRoot();
		await createSentinels(root, fixture.packageFixture);
		const before = await fingerprint(root, fixture.packageFixture);
		const tarball = await packRepository(root, 'mlx-package.tgz');

		for (let index = 0; index < fixture.packageFixture.repeatedChecks; index += 1) {
			await installPackedArtifact(tarball, path.join(root, `repeat-${index}`));
		}
		await Promise.all(
			Array.from({ length: fixture.packageFixture.concurrentChecks }, (_, index) =>
				installPackedArtifact(tarball, path.join(root, `concurrent-${index}`)),
			),
		);

		expect(await fingerprint(root, fixture.packageFixture)).toEqual(before);
	});
});
