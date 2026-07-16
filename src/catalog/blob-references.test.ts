import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ObjectStore } from '../storage/object-store';
import { createBlobReference, getBlobReference } from './blob-references';
import { type CatalogDatabase, runCatalogMigrations } from './migration-runner';

const roots: string[] = [];
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

async function fixture(): Promise<{
	readonly database: CatalogDatabase;
	readonly store: ObjectStore;
}> {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-blob-references-')));
	roots.push(root);
	const specifier = 'bun:sqlite';
	const { Database } = (await import(specifier)) as {
		readonly Database: new (
			filename: string,
			options: { readonly create: boolean; readonly strict: boolean },
		) => CatalogDatabase;
	};
	const database = new Database(path.join(root, 'catalog.sqlite3'), {
		create: true,
		strict: true,
	});
	database.exec('PRAGMA foreign_keys = ON');
	runCatalogMigrations(database);
	return { database, store: new ObjectStore(path.join(root, 'objects')) };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('blob references', () => {
	it('records verified objects idempotently and rejects semantic conflicts', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		const object = store.put(Buffer.from('source'));
		const input = { id: 'source-1', kind: 'source' as const, ...object };
		const first = createBlobReference(database, store, input);
		expect(createBlobReference(database, store, input)).toEqual(first);
		expect(getBlobReference(database, input.id)).toEqual(first);
		expect(() => createBlobReference(database, store, { ...input, kind: 'patch' })).toThrow(
			/conflict/,
		);
		database.close();
	});

	it('rejects invalid metadata and absent or corrupt bytes before insertion', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		expect(() =>
			createBlobReference(database, store, {
				id: 'missing',
				kind: 'trace',
				digest: 'a'.repeat(64),
				size: 1,
			}),
		).toThrow(/verified object/);
		expect(getBlobReference(database, 'missing')).toBeNull();
		expect(() =>
			createBlobReference(database, store, {
				id: '',
				kind: 'report',
				digest: 'A'.repeat(64),
				size: -1,
			}),
		).toThrow(/id/);
		database.close();
	});
});
