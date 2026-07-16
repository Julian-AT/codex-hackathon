import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type CatalogDatabase, runCatalogMigrations } from '../catalog/migration-runner';
import { ObjectStore } from '../storage/object-store';
import { createRun, getRunRecord } from './run-manifest';
import { type StageIdentity, claimOrExecuteStage, fingerprintStage } from './stage-reuse';

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

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function identity(overrides: Partial<StageIdentity> = {}): StageIdentity {
	return {
		schemaVersion: 1,
		stageType: 'extract',
		inputHashes: [sha256('input')],
		configHash: sha256('config'),
		implementationVersion: 'extractor@1',
		...overrides,
	};
}

async function fixture(): Promise<{
	readonly database: CatalogDatabase;
	readonly store: ObjectStore;
}> {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-stage-reuse-')));
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

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('verified deterministic stage reuse', () => {
	it('domain-separates validated deterministic identity from run metadata', () => {
		const base = fingerprintStage(identity());
		expect(base).toMatch(/^[0-9a-f]{64}$/);
		expect(
			fingerprintStage({ ...identity(), runId: 'later', createdAt: '2030-01-01T00:00:00Z' }),
		).toBe(base);
		expect(fingerprintStage(identity({ configHash: sha256('changed') }))).not.toBe(base);
		expect(fingerprintStage(identity({ implementationVersion: 'extractor@2' }))).not.toBe(base);
		expect(fingerprintStage(identity({ inputHashes: [sha256('changed')] }))).not.toBe(base);
	});

	it('elects one producer and reuses only its fully verified committed outputs', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		let count = 0;
		const execute = () => {
			count += 1;
			const output = store.put(Buffer.from(`output-${count}`));
			return {
				outputs: [{ name: 'result', digest: output.digest, size: output.size }],
				validation: [{ name: 'schema', status: 'pass' as const }],
			};
		};
		const first = claimOrExecuteStage(database, store, {
			identity: identity(),
			runId: 'first',
			createdAt: '2026-07-16T10:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		const second = claimOrExecuteStage(database, store, {
			identity: identity(),
			runId: 'second',
			createdAt: '2026-07-16T11:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		expect(first.kind).toBe('produced');
		expect(second).toMatchObject({ kind: 'reused', sourceRunId: 'first' });
		expect(count).toBe(1);
		database.close();
	});

	it('returns pending while a unique producer claim is still running', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		const stageKey = fingerprintStage(identity());
		createRun(database, {
			runId: 'producer',
			stageKey,
			stageType: 'extract',
			createdAt: '2026-07-16T10:00:00.000Z',
		});
		database
			.query('INSERT INTO stage_claims (stage_key, producer_run_id, claimed_at) VALUES (?, ?, ?)')
			.run(stageKey, 'producer', '2026-07-16T10:00:00.000Z');
		let called = false;
		expect(
			claimOrExecuteStage(database, store, {
				identity: identity(),
				runId: 'contender',
				createdAt: '2026-07-16T10:00:01.000Z',
				expectedValidation: ['schema'],
				execute: () => {
					called = true;
					return { outputs: [], validation: [] };
				},
			}),
		).toEqual({ kind: 'pending', runId: 'contender', sourceRunId: 'producer' });
		expect(called).toBe(false);
		database.close();
	});

	it('invalidates corrupt committed evidence and executes a recovery producer', async () => {
		if (!requireBunRuntime()) return;
		const { database, store } = await fixture();
		let count = 0;
		const execute = () => {
			count += 1;
			const output = store.put(Buffer.from(`output-${count}`));
			return {
				outputs: [{ name: 'result', digest: output.digest, size: output.size }],
				validation: [{ name: 'schema', status: 'pass' as const }],
			};
		};
		claimOrExecuteStage(database, store, {
			identity: identity(),
			runId: 'corrupt',
			createdAt: '2026-07-16T10:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		const corrupt = getRunRecord(database, 'corrupt');
		if (!corrupt?.manifestDigest) throw new Error('manifest was not committed');
		truncateSync(store.pathForDigest(corrupt.manifestDigest), 1);

		const recovered = claimOrExecuteStage(database, store, {
			identity: identity(),
			runId: 'recovered',
			createdAt: '2026-07-16T11:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		expect(recovered.kind).toBe('produced');
		expect(getRunRecord(database, 'corrupt')?.reuseValidity).toBe('invalid');
		expect(count).toBe(2);
		database.close();
	});
});
