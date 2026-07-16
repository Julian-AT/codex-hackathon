import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type CatalogDatabase, runCatalogMigrations } from '../catalog/migration-runner';
import { ObjectStore } from '../storage/object-store';
import {
	appendRunEvent,
	canonicalJsonBytes,
	commitRunManifest,
	createRun,
	getRunRecord,
	manifestChecksum,
	verifyCommittedRun,
} from './run-manifest';

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
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-run-manifest-')));
	roots.push(root);
	const specifier = 'bun:sqlite';
	const { Database } = (await import(specifier)) as {
		readonly Database: new (
			filename: string,
			options: { readonly create: boolean; readonly strict: boolean },
		) => CatalogDatabase;
	};
	const database = new Database(path.join(root, 'catalog.sqlite3'), { create: true, strict: true });
	database.exec('PRAGMA foreign_keys = ON');
	runCatalogMigrations(database);
	return { database, store: new ObjectStore(path.join(root, 'objects')) };
}

function digest(character: string): string {
	return character.repeat(64);
}

function manifest(output: { readonly digest: string; readonly size: number }) {
	return {
		schemaVersion: 1 as const,
		runId: 'run-1',
		stageId: 'compile',
		stageKey: digest('a'),
		createdAt: '2026-07-16T10:00:00.000Z',
		inputHashes: [digest('b')],
		configHash: digest('c'),
		implementationVersion: 'compiler@1',
		parent: null,
		outputs: [{ name: 'result', digest: output.digest, size: output.size }],
		validation: [{ name: 'schema', status: 'pass' as const }],
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('canonical immutable run manifests', () => {
	it('sorts every object by Unicode code point and produces byte-stable checksums', () => {
		const first = { '\u{10000}': 1, z: { beta: 2, alpha: 1 }, '\uE000': 3 };
		const second = { '\uE000': 3, z: { alpha: 1, beta: 2 }, '\u{10000}': 1 };
		expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
		expect(canonicalJsonBytes(first).toString()).toBe('{"z":{"alpha":1,"beta":2},"":3,"𐀀":1}');
	});

	it('stores canonical bytes in CAS and atomically commits immutable catalog lineage', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		const output = store.put(Buffer.from('verified output'));
		createRun(database, {
			runId: 'run-1',
			stageKey: digest('a'),
			stageType: 'compile',
			createdAt: '2026-07-16T10:00:00.000Z',
		});
		const input = manifest(output);
		const committed = commitRunManifest(database, store, input);
		expect(committed).toMatchObject({
			status: 'committed',
			manifestDigest: manifestChecksum(input),
		});
		expect(store.openVerified(committed.manifestDigest)).toEqual(canonicalJsonBytes(input));
		expect(verifyCommittedRun(database, store, 'run-1', ['schema']).ok).toBe(true);

		expect(() => commitRunManifest(database, store, input)).toThrow(/terminal/);
		expect(() =>
			database.query("UPDATE runs SET stage_type = 'changed' WHERE run_id = 'run-1'").run(),
		).toThrow(/immutable/);
		appendRunEvent(database, 'run-1', 'inspection', { ok: true });
		expect(
			database.query<{ count: number }, []>('SELECT count(*) AS count FROM run_events').get()
				?.count,
		).toBe(2);
		database.close();
	});

	it('rejects unknown schema fields, mismatched lineage, and unverified outputs', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		createRun(database, {
			runId: 'run-1',
			stageKey: digest('a'),
			stageType: 'compile',
			createdAt: '2026-07-16T10:00:00.000Z',
		});
		const missing = { digest: digest('d'), size: 1 };
		expect(() => commitRunManifest(database, store, manifest(missing))).toThrow(/verified/);
		expect(() =>
			commitRunManifest(database, store, { ...manifest(missing), unexpected: true }),
		).toThrow(/schema/);
		expect(getRunRecord(database, 'run-1')).toMatchObject({ status: 'running' });
		database.close();
	});

	it('leaves a published manifest uncommitted when interrupted before the catalog transaction', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		const output = store.put(Buffer.from('verified output'));
		createRun(database, {
			runId: 'run-1',
			stageKey: digest('a'),
			stageType: 'compile',
			createdAt: '2026-07-16T10:00:00.000Z',
		});
		expect(() =>
			commitRunManifest(database, store, manifest(output), {
				afterManifestStored: () => {
					throw new Error('injected crash');
				},
			}),
		).toThrow('injected crash');
		expect(getRunRecord(database, 'run-1')).toMatchObject({
			status: 'running',
			manifestDigest: null,
		});
		expect(store.verify(manifestChecksum(manifest(output))).size).toBeGreaterThan(0);
		database.close();
	});
});
