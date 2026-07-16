import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type CatalogDatabase, runCatalogMigrations } from '../../src/catalog/migration-runner';
import {
	appendRunEvent,
	commitRunManifest,
	createRun,
	getRunRecord,
	verifyCommittedRun,
} from '../../src/runs/run-manifest';
import {
	type StageIdentity,
	claimOrExecuteStage,
	fingerprintStage,
} from '../../src/runs/stage-reuse';
import { ObjectStore } from '../../src/storage/object-store';

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

function makeRoot(): string {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-run-reuse-')));
	roots.push(root);
	return root;
}

async function openDatabase(root: string): Promise<CatalogDatabase> {
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
	return database;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function identity(overrides: Partial<StageIdentity> = {}): StageIdentity {
	return {
		schemaVersion: 1,
		stageType: 'compile-evidence',
		inputHashes: [sha256('source-a'), sha256('source-b')],
		configHash: sha256('config-v1'),
		implementationVersion: 'compiler@1.0.0',
		...overrides,
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('run lineage and verified deterministic stage reuse', () => {
	it('commits canonical child lineage and retains timestamps and run IDs outside the stage key', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const database = await openDatabase(root);
		const store = new ObjectStore(path.join(root, 'objects'));
		const stageKey = fingerprintStage(identity());
		const output = store.put(Buffer.from('accepted output'));

		createRun(database, {
			runId: 'parent-run',
			stageKey,
			stageType: 'compile-evidence',
			createdAt: '2026-07-16T10:00:00.000Z',
		});
		const parent = commitRunManifest(database, store, {
			schemaVersion: 1,
			runId: 'parent-run',
			stageId: 'compile-evidence',
			stageKey,
			createdAt: '2026-07-16T10:00:00.000Z',
			inputHashes: identity().inputHashes,
			configHash: identity().configHash,
			implementationVersion: identity().implementationVersion,
			parent: null,
			outputs: [{ name: 'evidence', digest: output.digest, size: output.size }],
			validation: [{ name: 'schema', status: 'pass' }],
		});

		createRun(database, {
			runId: 'child-run',
			stageKey,
			stageType: 'compile-evidence',
			createdAt: '2026-07-16T11:00:00.000Z',
			parentRunId: 'parent-run',
		});
		const child = commitRunManifest(database, store, {
			schemaVersion: 1,
			runId: 'child-run',
			stageId: 'compile-evidence',
			stageKey,
			createdAt: '2026-07-16T11:00:00.000Z',
			inputHashes: identity().inputHashes,
			configHash: identity().configHash,
			implementationVersion: identity().implementationVersion,
			parent: { runId: 'parent-run', manifestDigest: parent.manifestDigest },
			outputs: [{ name: 'evidence', digest: output.digest, size: output.size }],
			validation: [{ name: 'schema', status: 'pass' }],
		});

		expect(child.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.parse(store.openVerified(child.manifestDigest).toString('utf8'))).toMatchObject({
			runId: 'child-run',
			createdAt: '2026-07-16T11:00:00.000Z',
			parent: { runId: 'parent-run', manifestDigest: parent.manifestDigest },
		});
		expect(verifyCommittedRun(database, store, 'child-run', ['schema']).ok).toBe(true);
		expect(fingerprintStage(identity())).toBe(
			fingerprintStage({ ...identity(), runId: 'ignored-run', createdAt: '2030-01-01T00:00:00Z' }),
		);
		database.close();
	});

	it('executes equal deterministic work once and changed deterministic identity again', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const database = await openDatabase(root);
		const store = new ObjectStore(path.join(root, 'objects'));
		let sideEffects = 0;
		const execute = () => {
			sideEffects += 1;
			return {
				outputs: [{ name: 'evidence', ...store.put(Buffer.from(`result-${sideEffects}`, 'utf8')) }],
				validation: [{ name: 'schema', status: 'pass' as const }],
			};
		};

		const first = claimOrExecuteStage(database, store, {
			identity: identity(),
			runId: 'run-1',
			createdAt: '2026-07-16T10:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		const second = claimOrExecuteStage(database, store, {
			identity: { ...identity(), runId: 'run-2', createdAt: '2026-07-16T11:00:00.000Z' },
			runId: 'run-2',
			createdAt: '2026-07-16T11:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		expect(first.kind).toBe('produced');
		expect(second).toMatchObject({ kind: 'reused', sourceRunId: 'run-1' });
		expect(sideEffects).toBe(1);

		for (const [runId, changed] of [
			['changed-input', identity({ inputHashes: [sha256('different')] })],
			['changed-config', identity({ configHash: sha256('config-v2') })],
			['changed-version', identity({ implementationVersion: 'compiler@2.0.0' })],
		] as const) {
			const result = claimOrExecuteStage(database, store, {
				identity: changed,
				runId,
				createdAt: '2026-07-16T12:00:00.000Z',
				expectedValidation: ['schema'],
				execute,
			});
			expect(result.kind).toBe('produced');
		}
		expect(sideEffects).toBe(4);
		database.close();
	});

	it('never reuses nonterminal, invalid, missing, corrupt, or interrupted evidence', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		const database = await openDatabase(root);
		const store = new ObjectStore(path.join(root, 'objects'));
		let sideEffects = 0;
		const execute = () => {
			sideEffects += 1;
			const object = store.put(Buffer.from(`replacement-${sideEffects}`));
			return {
				outputs: [{ name: 'evidence', digest: object.digest, size: object.size }],
				validation: [{ name: 'schema', status: 'pass' as const }],
			};
		};

		for (const status of ['running', 'failed', 'cancelled'] as const) {
			const candidate = `candidate-${status}`;
			createRun(database, {
				runId: candidate,
				stageKey: fingerprintStage(identity({ stageType: candidate })),
				stageType: candidate,
				createdAt: '2026-07-16T09:00:00.000Z',
			});
			if (status !== 'running') appendRunEvent(database, candidate, status, {}, status);
			const result = claimOrExecuteStage(database, store, {
				identity: identity({ stageType: candidate }),
				runId: `replacement-${status}`,
				createdAt: '2026-07-16T10:00:00.000Z',
				expectedValidation: ['schema'],
				execute,
			});
			expect(result.kind).toBe('produced');
		}

		const corruptIdentity = identity({ stageType: 'corrupt-candidate' });
		const corruptOutput = store.put(Buffer.from('will be corrupt'));
		createRun(database, {
			runId: 'corrupt-run',
			stageKey: fingerprintStage(corruptIdentity),
			stageType: corruptIdentity.stageType,
			createdAt: '2026-07-16T09:00:00.000Z',
		});
		commitRunManifest(database, store, {
			schemaVersion: 1,
			runId: 'corrupt-run',
			stageId: corruptIdentity.stageType,
			stageKey: fingerprintStage(corruptIdentity),
			createdAt: '2026-07-16T09:00:00.000Z',
			inputHashes: corruptIdentity.inputHashes,
			configHash: corruptIdentity.configHash,
			implementationVersion: corruptIdentity.implementationVersion,
			parent: null,
			outputs: [{ name: 'evidence', digest: corruptOutput.digest, size: corruptOutput.size }],
			validation: [{ name: 'schema', status: 'pass' }],
		});
		truncateSync(corruptOutput.path, 1);
		const recovered = claimOrExecuteStage(database, store, {
			identity: corruptIdentity,
			runId: 'corrupt-replacement',
			createdAt: '2026-07-16T10:00:00.000Z',
			expectedValidation: ['schema'],
			execute,
		});
		expect(recovered.kind).toBe('produced');
		expect(getRunRecord(database, 'corrupt-run')?.reuseValidity).toBe('invalid');

		const missingIdentity = identity({ stageType: 'missing-candidate' });
		const missingOutput = store.put(Buffer.from('will be missing'));
		createRun(database, {
			runId: 'missing-run',
			stageKey: fingerprintStage(missingIdentity),
			stageType: missingIdentity.stageType,
			createdAt: '2026-07-16T09:00:00.000Z',
		});
		commitRunManifest(database, store, {
			schemaVersion: 1,
			runId: 'missing-run',
			stageId: missingIdentity.stageType,
			stageKey: fingerprintStage(missingIdentity),
			createdAt: '2026-07-16T09:00:00.000Z',
			inputHashes: missingIdentity.inputHashes,
			configHash: missingIdentity.configHash,
			implementationVersion: missingIdentity.implementationVersion,
			parent: null,
			outputs: [{ name: 'evidence', digest: missingOutput.digest, size: missingOutput.size }],
			validation: [{ name: 'schema', status: 'pass' }],
		});
		rmSync(missingOutput.path);
		expect(
			claimOrExecuteStage(database, store, {
				identity: missingIdentity,
				runId: 'missing-replacement',
				createdAt: '2026-07-16T10:00:00.000Z',
				expectedValidation: ['schema'],
				execute,
			}).kind,
		).toBe('produced');
		expect(getRunRecord(database, 'missing-run')?.reuseValidity).toBe('invalid');

		const crashRunId = 'crash-after-manifest-publication';
		createRun(database, {
			runId: crashRunId,
			stageKey: fingerprintStage(identity({ stageType: 'crash' })),
			stageType: 'crash',
			createdAt: '2026-07-16T09:00:00.000Z',
		});
		const crashOutput = store.put(Buffer.from('crash output'));
		expect(() =>
			commitRunManifest(
				database,
				store,
				{
					schemaVersion: 1,
					runId: crashRunId,
					stageId: 'crash',
					stageKey: fingerprintStage(identity({ stageType: 'crash' })),
					createdAt: '2026-07-16T09:00:00.000Z',
					inputHashes: identity().inputHashes,
					configHash: identity().configHash,
					implementationVersion: identity().implementationVersion,
					parent: null,
					outputs: [{ name: 'evidence', digest: crashOutput.digest, size: crashOutput.size }],
					validation: [{ name: 'schema', status: 'pass' }],
				},
				{
					afterManifestStored: () => {
						throw new Error('injected crash');
					},
				},
			),
		).toThrow('injected crash');
		expect(getRunRecord(database, crashRunId)).toMatchObject({ status: 'running' });
		expect(existsSync(path.join(root, 'objects', 'sha256'))).toBe(true);

		const beforePublicationRun = 'crash-before-manifest-publication';
		createRun(database, {
			runId: beforePublicationRun,
			stageKey: fingerprintStage(identity({ stageType: 'crash-before' })),
			stageType: 'crash-before',
			createdAt: '2026-07-16T09:00:00.000Z',
		});
		const interruptedStore = new ObjectStore(path.join(root, 'objects'), {
			afterFileSync: () => {
				throw new Error('injected pre-publication crash');
			},
		});
		expect(() =>
			commitRunManifest(database, interruptedStore, {
				schemaVersion: 1,
				runId: beforePublicationRun,
				stageId: 'crash-before',
				stageKey: fingerprintStage(identity({ stageType: 'crash-before' })),
				createdAt: '2026-07-16T09:00:00.000Z',
				inputHashes: identity().inputHashes,
				configHash: identity().configHash,
				implementationVersion: identity().implementationVersion,
				parent: null,
				outputs: [{ name: 'evidence', digest: crashOutput.digest, size: crashOutput.size }],
				validation: [{ name: 'schema', status: 'pass' }],
			}),
		).toThrow('injected pre-publication crash');
		expect(getRunRecord(database, beforePublicationRun)).toMatchObject({ status: 'running' });

		expect(sideEffects).toBe(5);
		database.close();
	});
});
