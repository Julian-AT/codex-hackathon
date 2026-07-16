import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogDatabase } from './migration-runner';
import { runCatalogMigrations } from './migration-runner';

const files: string[] = [];

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
		const db = await database();
		expect(runCatalogMigrations(db)).toBe(1);
		expect(runCatalogMigrations(db)).toBe(1);
		expect(db.query('SELECT migration_number, name FROM schema_migrations').all()).toEqual([
			{ migration_number: 1, name: '0001-catalog.sql' },
		]);
		db.close();
	});

	it('rolls back SQL and ledger writes when a migration is interrupted', async () => {
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
		const drift = await database();
		runCatalogMigrations(drift);
		drift
			.query('UPDATE schema_migrations SET checksum = ? WHERE migration_number = 1')
			.run('0'.repeat(64));
		expect(() => runCatalogMigrations(drift)).toThrow('drift');
		drift.close();

		const gap = await database();
		runCatalogMigrations(gap);
		gap.query('UPDATE schema_migrations SET migration_number = 2 WHERE migration_number = 1').run();
		expect(() => runCatalogMigrations(gap)).toThrow('gap');
		gap.close();

		const future = await database();
		runCatalogMigrations(future);
		future
			.query('INSERT INTO schema_migrations (migration_number, name, checksum) VALUES (?, ?, ?)')
			.run(2, '0002-future.sql', '1'.repeat(64));
		expect(() => runCatalogMigrations(future)).toThrow('newer');
		future.close();
	});
});
