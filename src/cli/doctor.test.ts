import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DoctorResult } from '../core/doctor';
import { runDoctor } from './doctor';

const roots: string[] = [];

const OWNED_EXECUTABLE: DoctorResult = {
	classification: 'owned',
	code: 'MLX_EXECUTABLE_OWNED',
	candidates: [],
	effective: null,
	shadowed: [],
	reason: 'owned fixture',
	action: 'no action',
};

const COLLISION: DoctorResult = {
	classification: 'collision',
	code: 'MLX_EXECUTABLE_COLLISION',
	candidates: [],
	effective: null,
	shadowed: [],
	reason: 'collision fixture',
	action: 'resolve collision',
};

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function ownedRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-doctor-capability-'));
	roots.push(root);
	await mkdir(path.join(root, 'catalog'));
	return root;
}

describe('SQLite doctor evidence', () => {
	it('adds independently probed SQLite evidence without changing executable ownership', async () => {
		const execution = await runDoctor({
			inspectExecutable: async () => OWNED_EXECUTABLE,
			probeSqlite: async () => ({
				sqliteVersion: '3.49.2',
				journalMode: 'wal',
				foreignKeys: true,
				concurrency: { status: 'pass', contenders: 2, committedWrites: 50 },
				multiOwnerMutationAllowed: true,
			}),
		});

		expect(execution.exitCode).toBe(0);
		expect(execution.envelope).toMatchObject({
			ok: true,
			status: 'owned',
			data: {
				classification: 'owned',
				sqlite: {
					sqliteVersion: '3.49.2',
					journalMode: 'wal',
					foreignKeys: true,
					concurrency: { status: 'pass', contenders: 2, committedWrites: 50 },
					multiOwnerMutationAllowed: true,
				},
				catalogOwner: { required: false, status: 'available' },
			},
		});
	});

	it('preserves a collision as the primary failure when SQLite is healthy', async () => {
		const execution = await runDoctor({
			inspectExecutable: async () => COLLISION,
			probeSqlite: async () => ({
				sqliteVersion: '3.49.2',
				journalMode: 'wal',
				foreignKeys: true,
				concurrency: { status: 'pass', contenders: 2, committedWrites: 50 },
				multiOwnerMutationAllowed: true,
			}),
		});

		expect(execution.exitCode).toBe(5);
		expect(execution.envelope).toMatchObject({
			ok: false,
			status: 'collision',
			error: { code: 'EXECUTABLE_COLLISION' },
			data: { classification: 'collision', sqlite: { concurrency: { status: 'pass' } } },
		});
	});

	it('never infers multi-owner safety from the version string alone', async () => {
		const execution = await runDoctor({
			inspectExecutable: async () => OWNED_EXECUTABLE,
			probeSqlite: async () => ({
				sqliteVersion: '99.0.0',
				journalMode: 'wal',
				foreignKeys: true,
				concurrency: { status: 'fail', contenders: 2, committedWrites: 49 },
				multiOwnerMutationAllowed: false,
			}),
		});

		expect(execution.envelope.data).toMatchObject({
			sqlite: { sqliteVersion: '99.0.0', multiOwnerMutationAllowed: false },
			catalogOwner: {
				required: true,
				status: 'available',
				action: expect.stringContaining('catalog owner'),
			},
		});
	});

	it('allows only one catalog owner and requires explicit stale recovery', async () => {
		const owner = await import('../catalog/catalog-owner').catch(() => null);
		expect(owner, 'catalog owner module exists').not.toBeNull();
		if (!owner) return;
		const root = await ownedRoot();
		const env = { MLX_HOME: root };
		const first = await owner.acquireCatalogOwner({ env });
		const second = await owner.acquireCatalogOwner({ env });
		expect(first).toMatchObject({ ok: true });
		expect(second).toMatchObject({ ok: false, code: 'CATALOG_OWNER_HELD' });
		if (first.ok) await first.release();
	});
});
