import { createHash } from 'node:crypto';
import {
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	realpath,
	rm,
	stat,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];
const marker = Object.freeze({
	schemaVersion: '1',
	productId: 'mlx-personal-coding-pipeline',
	packageName: 'mlx-personal-coding-pipeline',
	executable: 'mlx',
	entry: './src/cli.tsx',
});

type DoctorModule = typeof import('./doctor');

async function loadDoctor(): Promise<DoctorModule | null> {
	const modulePath = './doctor';
	return await import(modulePath).catch(() => null);
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function sandbox(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-doctor-unit-'));
	roots.push(root);
	return root;
}

async function executable(file: string, body = '#!/bin/sh\nexit 91\n'): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body, 'utf8');
	await chmod(file, 0o755);
}

async function snapshot(paths: readonly string[]): Promise<Record<string, string>> {
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

function nodePort(
	markerPath: string,
	deniedBodies: Set<string>,
	interruptions = new Set<string>(),
) {
	return {
		lstat: async (file: string) => await lstat(file),
		stat: async (file: string) => {
			if (interruptions.has(file))
				throw Object.assign(new Error('interrupted metadata read'), { code: 'EINTR' });
			return await stat(file);
		},
		realpath: async (file: string) => await realpath(file),
		readTextFile: async (file: string) => {
			if (deniedBodies.has(file)) throw new Error(`candidate body opened: ${file}`);
			if (file !== markerPath) throw new Error(`unexpected read: ${file}`);
			return await readFile(file, 'utf8');
		},
	};
}

function input(root: string, declaredEntry: string, markerPath: string, pathValue: string) {
	return {
		pathValue,
		delimiter: path.delimiter,
		cwd: root,
		declaredEntry,
		markerPath,
		expectedMarker: marker,
	};
}

describe('inspectExecutableCandidates', () => {
	it('preserves PATH order across owned, foreign, duplicate, empty, and relative entries without opening bodies', async () => {
		const doctor = await loadDoctor();
		expect(doctor, 'doctor behavior must exist').not.toBeNull();
		if (!doctor) return;

		const root = await sandbox();
		const packageRoot = path.join(root, 'package');
		const declaredEntry = path.join(packageRoot, 'src/cli.tsx');
		const markerPath = path.join(packageRoot, 'mlx.package.json');
		await executable(declaredEntry);
		await writeFile(markerPath, `${JSON.stringify(marker)}\n`, 'utf8');
		const ownedDir = path.join(root, 'owned');
		const foreignDir = path.join(root, 'foreign');
		const relativeDir = 'relative-bin';
		await Promise.all([mkdir(ownedDir), mkdir(foreignDir), mkdir(path.join(root, relativeDir))]);
		await symlink(declaredEntry, path.join(ownedDir, 'mlx'));
		await executable(path.join(foreignDir, 'mlx'));
		await executable(path.join(root, 'mlx'));
		await executable(path.join(root, relativeDir, 'mlx'));
		const denied = new Set([
			declaredEntry,
			path.join(ownedDir, 'mlx'),
			path.join(foreignDir, 'mlx'),
			path.join(root, 'mlx'),
			path.join(root, relativeDir, 'mlx'),
		]);
		const pathValue = [foreignDir, ownedDir, foreignDir, '', relativeDir].join(path.delimiter);
		const result = await doctor.inspectExecutableCandidates(
			input(root, declaredEntry, markerPath, pathValue),
			nodePort(markerPath, denied),
		);

		expect(result.classification).toBe('collision');
		expect(result.effective?.path).toBe(path.join(foreignDir, 'mlx'));
		expect(result.candidates.map((candidate) => candidate.path)).toEqual([
			path.join(foreignDir, 'mlx'),
			path.join(ownedDir, 'mlx'),
			path.join(foreignDir, 'mlx'),
			path.join(root, 'mlx'),
			path.join(root, relativeDir, 'mlx'),
		]);
		expect(result.shadowed).toHaveLength(4);
		expect(result.shadowed[0]).toMatchObject({ ownership: 'owned' });
	});

	it('fails closed for non-executable, broken/cyclic links, marker mismatch, and interrupted metadata while retaining safe evidence', async () => {
		const doctor = await loadDoctor();
		expect(doctor, 'doctor behavior must exist').not.toBeNull();
		if (!doctor) return;

		const root = await sandbox();
		const packageRoot = path.join(root, 'package');
		const declaredEntry = path.join(packageRoot, 'src/cli.tsx');
		const markerPath = path.join(packageRoot, 'mlx.package.json');
		await executable(declaredEntry);
		await mkdir(packageRoot, { recursive: true });
		await writeFile(markerPath, JSON.stringify({ ...marker, packageName: 'foreign-package' }));
		const nonExecutable = path.join(root, 'non-executable', 'mlx');
		await executable(nonExecutable);
		await chmod(nonExecutable, 0o644);
		const broken = path.join(root, 'broken', 'mlx');
		await mkdir(path.dirname(broken), { recursive: true });
		await symlink('../missing', broken);
		const cycle = path.join(root, 'cycle', 'mlx');
		await mkdir(path.dirname(cycle), { recursive: true });
		await symlink('mlx', cycle);
		const interrupted = path.join(root, 'interrupted', 'mlx');
		await executable(interrupted);
		const markerMismatch = path.join(root, 'marker-mismatch', 'mlx');
		await mkdir(path.dirname(markerMismatch), { recursive: true });
		await symlink(declaredEntry, markerMismatch);

		const result = await doctor.inspectExecutableCandidates(
			input(
				root,
				declaredEntry,
				markerPath,
				[nonExecutable, broken, cycle, interrupted, markerMismatch]
					.map((candidate) => path.dirname(candidate))
					.join(path.delimiter),
			),
			nodePort(
				markerPath,
				new Set([declaredEntry, nonExecutable, interrupted, markerMismatch]),
				new Set([interrupted]),
			),
		);

		expect(result.classification).toBe('collision');
		expect(result.candidates).toHaveLength(5);
		expect(result.candidates.map((candidate) => candidate.path)).toEqual([
			nonExecutable,
			broken,
			cycle,
			interrupted,
			markerMismatch,
		]);
		expect(result.candidates.every((candidate) => candidate.ownership !== 'owned')).toBe(true);
		expect(result.candidates.some((candidate) => candidate.errors.length > 0)).toBe(true);
		expect(result.candidates[0]?.errors).toContain('stat: candidate is not executable');
		expect(result.candidates[1]?.errors.join('\n')).toContain('ENOENT');
		expect(result.candidates[2]?.errors.join('\n')).toContain('ELOOP');
		expect(result.candidates[3]?.errors.join('\n')).toContain('EINTR');
		expect(result.candidates[4]?.errors).toContain(
			'marker mismatch: packaged ownership evidence is invalid',
		);
	});

	it('returns owned/not-found deterministically and leaves bytes, modes, links, aliases, shell data, and state roots unchanged in repeated and parallel calls', async () => {
		const doctor = await loadDoctor();
		expect(doctor, 'doctor behavior must exist').not.toBeNull();
		if (!doctor) return;

		const root = await sandbox();
		const packageRoot = path.join(root, 'package');
		const declaredEntry = path.join(packageRoot, 'src/cli.tsx');
		const markerPath = path.join(packageRoot, 'mlx.package.json');
		const ownedDir = path.join(root, 'bin');
		await executable(declaredEntry, '#!/bin/sh\necho executed > "$1"\n');
		await writeFile(markerPath, `${JSON.stringify(marker)}\n`);
		await mkdir(ownedDir, { recursive: true });
		const ownedLink = path.join(ownedDir, 'mlx');
		await symlink(declaredEntry, ownedLink);
		const sentinelPaths = [
			declaredEntry,
			ownedLink,
			path.join(root, 'path.txt'),
			path.join(root, 'aliases.txt'),
			path.join(root, 'shell-config.txt'),
			path.join(root, 'state-root.txt'),
		];
		for (const sentinel of sentinelPaths.slice(2))
			await writeFile(sentinel, `sentinel:${sentinel}\n`);
		const before = await snapshot(sentinelPaths);
		const port = nodePort(markerPath, new Set([declaredEntry, ownedLink]));
		const parameters = input(root, declaredEntry, markerPath, ownedDir);
		const sequential = [
			await doctor.inspectExecutableCandidates(parameters, port),
			await doctor.inspectExecutableCandidates(parameters, port),
		];
		const concurrent = await Promise.all(
			Array.from(
				{ length: 8 },
				async () => await doctor.inspectExecutableCandidates(parameters, port),
			),
		);
		const notFound = await doctor.inspectExecutableCandidates(
			input(root, declaredEntry, markerPath, path.join(root, 'missing-bin')),
			port,
		);

		expect(sequential[0].classification).toBe('owned');
		expect(sequential[0]).toEqual(sequential[1]);
		expect(
			concurrent.every((value) => JSON.stringify(value) === JSON.stringify(sequential[0])),
		).toBe(true);
		expect(notFound).toMatchObject({ classification: 'not-found', candidates: [] });
		expect(await snapshot(sentinelPaths)).toEqual(before);
		await expect(readFile(path.join(root, 'execution-sentinel'))).rejects.toMatchObject({
			code: 'ENOENT',
		});
	});
});
