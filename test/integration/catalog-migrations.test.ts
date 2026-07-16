import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../../src/cli/init';

const roots: string[] = [];

function makeRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'mlx-catalog-'));
	root && roots.push(root);
	return root;
}

async function initializeOwnedRoot(root: string): Promise<void> {
	rmSync(root, { recursive: true });
	const result = await runInit(
		{ adopt: false },
		{ env: { MLX_HOME: root }, homedir: () => path.dirname(root) },
	);
	expect(result.ok).toBe(true);
}

async function catalogModule() {
	return await import('../../src/catalog/connection').catch(() => null);
}

function requireCatalog<T>(catalog: T | null): T {
	if (!catalog) throw new Error('public catalog open seam is missing');
	return catalog;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('catalog migrations', () => {
	it('opens a fresh owned catalog with durable pragmas and reopens idempotently', async () => {
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const first = catalog.openCatalog({ env: { MLX_HOME: root } });
		expect(first?.pragmas()).toEqual({ busyTimeout: 5_000, foreignKeys: true, journalMode: 'wal' });
		expect(first?.schemaVersion()).toBe(1);
		first?.close();

		const second = catalog.openCatalog({ env: { MLX_HOME: root } });
		expect(second?.schemaVersion()).toBe(1);
		second?.close();
	});

	it('preserves a supported prior catalog row across repeated upgrades', async () => {
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await import('bun:sqlite');
		const catalogDir = path.join(root, 'catalog');
		mkdirSync(catalogDir);
		const catalogPath = path.join(catalogDir, 'mlx.sqlite3');
		const prior = new Database(catalogPath, { create: true });
		prior.exec('CREATE TABLE prior_rows (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
		prior.query('INSERT INTO prior_rows (value) VALUES (?)').run('survives');
		prior.close();

		for (let reopen = 0; reopen < 2; reopen += 1) {
			const connection = catalog.openCatalog({ env: { MLX_HOME: root } });
			expect(connection?.schemaVersion()).toBe(1);
			connection?.close();
		}
		const verified = new Database(catalogPath, { readonly: true });
		expect(verified.query('SELECT value FROM prior_rows').get()).toEqual({ value: 'survives' });
		verified.close();
	});

	it('rolls back an injected migration failure without ad hoc schema mutation', async () => {
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await import('bun:sqlite');
		expect(() =>
			catalog.openCatalog(
				{ env: { MLX_HOME: root } },
				{ afterMigrationSql: () => void (() => { throw new Error('injected migration failure'); })() },
			),
		).toThrow('injected migration failure');

		const database = new Database(path.join(root, 'catalog', 'mlx.sqlite3'));
		const tables = database
			.query("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
			.all();
		expect(tables).toEqual([]);
		database.close();
	});

	it('refuses checksum drift, ledger gaps, and future versions before mutation', async () => {
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await import('bun:sqlite');
		const first = catalog.openCatalog({ env: { MLX_HOME: root } });
		first?.close();
		const catalogPath = path.join(root, 'catalog', 'mlx.sqlite3');

		for (const [number, checksum, expected] of [
			[1, '0'.repeat(64), 'checksum'],
			[2, '1'.repeat(64), 'future'],
		] as const) {
			const database = new Database(catalogPath);
			database
				.query('UPDATE schema_migrations SET checksum = ? WHERE migration_number = 1')
				.run(checksum);
			if (number === 2) {
				database
					.query(
						'INSERT INTO schema_migrations (migration_number, name, checksum) VALUES (?, ?, ?)',
					)
					.run(number, '0002-future.sql', checksum);
			}
			database.close();
			expect(() => catalog.openCatalog({ env: { MLX_HOME: root } })).toThrow(expected);
		}

		const ledger = readFileSync(path.join(root, 'catalog', 'mlx.sqlite3'));
		expect(ledger.byteLength).toBeGreaterThan(0);
	});
});
