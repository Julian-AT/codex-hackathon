import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	truncateSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
	type BlobKind,
	createBlobReference,
	getBlobReference,
} from '../../src/catalog/blob-references';
import { type CatalogDatabase, runCatalogMigrations } from '../../src/catalog/migration-runner';
import { ObjectStore, ObjectStoreError } from '../../src/storage/object-store';

const roots: string[] = [];
const kinds: readonly BlobKind[] = ['source', 'patch', 'trace', 'report', 'generated'];
const isBunRuntime = 'bun' in process.versions;
let delegatedFailure: string | null = null;

beforeAll(() => {
	if (isBunRuntime) return;
	const result = spawnSync('bun', ['test', fileURLToPath(import.meta.url)], { encoding: 'utf8' });
	if (result.status !== 0) delegatedFailure = `${result.stdout}\n${result.stderr}`;
});

function requireBunRuntime(): boolean {
	if (isBunRuntime) return true;
	expect(delegatedFailure).toBeNull();
	return false;
}

function makeRoot(): string {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-object-integration-')));
	roots.push(root);
	return root;
}

function digest(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function openDatabase(root: string): Promise<CatalogDatabase> {
	const specifier = 'bun:sqlite';
	const { Database } = (await import(specifier)) as {
		readonly Database: new (
			filename: string,
			options: { readonly create: boolean; readonly strict: boolean },
		) => CatalogDatabase;
	};
	const catalog = path.join(root, 'catalog.sqlite3');
	const database = new Database(catalog, { create: true, strict: true });
	database.exec('PRAGMA foreign_keys = ON');
	runCatalogMigrations(database);
	return database;
}

function runBun(source: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', ['--eval', source], { stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		child.stdout.on('data', (chunk) => {
			output += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			output += String(chunk);
		});
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`worker exited ${code}: ${output}`)),
		);
	});
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('immutable object store and durable references', () => {
	it('round-trips every required kind and records only verified committed bytes', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const store = new ObjectStore(path.join(root, 'objects'));
		const database = await openDatabase(root);

		for (const kind of kinds) {
			const bytes = Buffer.from(`${kind}\0artifact`, 'utf8');
			const object = store.put(bytes);
			expect(object).toMatchObject({ digest: digest(bytes), size: bytes.byteLength });
			expect(object.digest).toMatch(/^[0-9a-f]{64}$/);
			expect(object.path).toBe(
				path.join(root, 'objects', 'sha256', object.digest.slice(0, 2), object.digest),
			);
			expect(store.openVerified(object.digest)).toEqual(bytes);

			const reference = createBlobReference(database, store, {
				id: `${kind}-1`,
				kind,
				digest: object.digest,
				size: object.size,
			});
			expect(getBlobReference(database, `${kind}-1`)).toEqual(reference);
		}
		database.close();
	});

	it('cleans interrupted owned temp writes and never inserts a dangling reference', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const store = new ObjectStore(path.join(root, 'objects'), {
			afterFileSync: () => {
				throw new Error('injected interruption');
			},
		});
		const database = await openDatabase(root);
		const bytes = Buffer.from('interrupted');
		const expectedDigest = digest(bytes);

		expect(() => store.put(bytes)).toThrow('injected interruption');
		const shard = path.join(root, 'objects', 'sha256', expectedDigest.slice(0, 2));
		expect(existsSync(path.join(shard, expectedDigest))).toBe(false);
		expect(
			existsSync(shard) ? readdirSync(shard).filter((name) => name.includes('.mlx-tmp-')) : [],
		).toEqual([]);
		expect(() =>
			createBlobReference(database, new ObjectStore(path.join(root, 'objects')), {
				id: 'missing',
				kind: 'trace',
				digest: expectedDigest,
				size: bytes.byteLength,
			}),
		).toThrow(/verified object/i);
		expect(getBlobReference(database, 'missing')).toBeNull();
		database.close();
	});

	it('converges concurrent equal writers on one immutable object', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const objectRoot = path.join(root, 'objects');
		const moduleUrl = new URL('../../src/storage/object-store.ts', import.meta.url).href;
		const bytes = Buffer.from('same concurrent bytes');
		const expectedDigest = digest(bytes);
		const source = `import { ObjectStore } from ${JSON.stringify(moduleUrl)}; const result = new ObjectStore(${JSON.stringify(objectRoot)}).put(Buffer.from(${JSON.stringify(bytes.toString('base64'))}, 'base64')); if (result.digest !== ${JSON.stringify(expectedDigest)}) process.exit(2);`;

		await Promise.all(Array.from({ length: 6 }, () => runBun(source)));
		const finalPath = path.join(objectRoot, 'sha256', expectedDigest.slice(0, 2), expectedDigest);
		expect(readFileSync(finalPath)).toEqual(bytes);
		expect(readdirSync(path.dirname(finalPath))).toEqual([expectedDigest]);
	});

	it('fails closed for corrupt bytes, path substitution, symlinks, and conflicting metadata', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const store = new ObjectStore(path.join(root, 'objects'));
		const database = await openDatabase(root);
		const bytes = Buffer.from('original verified bytes');
		const object = store.put(bytes);
		const reference = createBlobReference(database, store, {
			id: 'artifact',
			kind: 'source',
			digest: object.digest,
			size: object.size,
		});
		expect(createBlobReference(database, store, reference)).toEqual(reference);
		expect(() => createBlobReference(database, store, { ...reference, kind: 'patch' })).toThrow(
			/conflict/i,
		);

		truncateSync(object.path, 3);
		expect(() => store.openVerified(object.digest)).toThrow(ObjectStoreError);
		expect(() => store.verify(object.digest, object.size)).toThrow(/size|digest|corrupt/i);
		database.close();

		const symlinkRoot = makeRoot();
		const outside = makeRoot();
		mkdirSync(path.join(symlinkRoot, 'objects'));
		symlinkSync(outside, path.join(symlinkRoot, 'objects', 'sha256'));
		expect(() => new ObjectStore(path.join(symlinkRoot, 'objects')).put(Buffer.from('x'))).toThrow(
			/symlink|regular|unsafe/i,
		);

		const replacedRoot = makeRoot();
		const replacedStore = new ObjectStore(path.join(replacedRoot, 'objects'));
		const replaced = replacedStore.put(Buffer.from('replace me'));
		rmSync(replaced.path);
		mkdirSync(replaced.path);
		expect(() => replacedStore.openVerified(replaced.digest)).toThrow(/regular|unsafe/i);
		rmSync(replaced.path, { recursive: true });
		writeFileSync(replaced.path, Buffer.from('wrong bytes'));
		chmodSync(replaced.path, 0o600);
		expect(lstatSync(replaced.path).isFile()).toBe(true);
		expect(() => replacedStore.put(Buffer.from('replace me'))).toThrow(/conflict|corrupt|digest/i);
	});
});
