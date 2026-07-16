import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { CatalogDatabase } from './migration-runner';
import { runCatalogMigrations } from './migration-runner';

const files: string[] = [];
const isBunRuntime = 'bun' in process.versions;
let delegatedFailure: string | null = null;

beforeAll(() => {
	if (isBunRuntime) return;
	const result = spawnSync('bun', ['test', fileURLToPath(import.meta.url)], {
		encoding: 'utf8',
	});
	if (result.status !== 0) delegatedFailure = `${result.stdout}\n${result.stderr}`;
});

function requireBunRuntime(): boolean {
	if (isBunRuntime) return true;
	expect(delegatedFailure).toBeNull();
	return false;
}

async function database(): Promise<CatalogDatabase & { close(): void }> {
	const directory = mkdtempSync(path.join(tmpdir(), 'mlx-migrations-'));
	files.push(directory);
	const specifier = 'bun:sqlite';
	const { Database } = (await import(specifier)) as {
		readonly Database: new (
			filename: string,
			options: { readonly create: true },
		) => CatalogDatabase & {
			close(): void;
		};
	};
	return new Database(path.join(directory, 'catalog.sqlite3'), { create: true });
}

afterEach(() => {
	for (const file of files.splice(0)) rmSync(file, { recursive: true, force: true });
});

describe('runCatalogMigrations', () => {
	it('applies the exact application manifest once', async () => {
		if (!requireBunRuntime()) return;
		const db = await database();
		expect(runCatalogMigrations(db)).toBe(3);
		expect(runCatalogMigrations(db)).toBe(3);
		expect(db.query('SELECT migration_number, name FROM schema_migrations').all()).toEqual([
			{ migration_number: 1, name: '0001-catalog.sql' },
			{ migration_number: 2, name: '0002-blobs.sql' },
			{ migration_number: 3, name: '0003-runs.sql' },
		]);
		db.close();
	});

	it('rolls back SQL and ledger writes when a migration is interrupted', async () => {
		if (!requireBunRuntime()) return;
		const db = await database();
		expect(() =>
			runCatalogMigrations(db, {
				afterMigrationSql: () => {
					throw new Error('interrupted');
				},
			}),
		).toThrow('interrupted');
		expect(
			db.query("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
		).toEqual([]);
		db.close();
	});

	it('refuses drift, gaps, and future schemas before applying SQL', async () => {
		if (!requireBunRuntime()) return;
		const drift = await database();
		runCatalogMigrations(drift);
		drift
			.query('UPDATE schema_migrations SET checksum = ? WHERE migration_number = 1')
			.run('0'.repeat(64));
		expect(() => runCatalogMigrations(drift)).toThrow('drift');
		drift.close();

		const gap = await database();
		runCatalogMigrations(gap);
		gap.query('DELETE FROM schema_migrations WHERE migration_number = 1').run();
		expect(() => runCatalogMigrations(gap)).toThrow('gap');
		gap.close();

		const future = await database();
		runCatalogMigrations(future);
		future
			.query('INSERT INTO schema_migrations (migration_number, name, checksum) VALUES (?, ?, ?)')
			.run(4, '0004-future.sql', '1'.repeat(64));
		expect(() => runCatalogMigrations(future)).toThrow('newer');
		future.close();
	});
});
