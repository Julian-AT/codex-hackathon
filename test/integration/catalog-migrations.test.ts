import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runInit } from '../../src/cli/init';

const roots: string[] = [];
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

async function waitForProcess(child: ChildProcess): Promise<void> {
	const stderr: Buffer[] = [];
	child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
	await new Promise<void>((resolve, reject) => {
		child.once('error', reject);
		child.once('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(Buffer.concat(stderr).toString('utf8') || `child exited ${code}`));
		});
	});
}

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

async function sqliteModule() {
	const specifier = 'bun:sqlite';
	return (await import(specifier)) as typeof import('../../src/catalog/connection') & {
		readonly Database: new (
			filename: string,
			options?: { readonly create?: boolean; readonly readonly?: boolean },
		) => {
			close(): void;
			query(sql: string): {
				get(...parameters: unknown[]): unknown;
				run(...parameters: unknown[]): unknown;
				all(): unknown[];
			};
			exec(sql: string): void;
		};
	};
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
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const first = await catalog.openCatalog({ env: { MLX_HOME: root } });
		expect(first?.pragmas()).toEqual({ busyTimeout: 5_000, foreignKeys: true, journalMode: 'wal' });
		expect(first?.schemaVersion()).toBe(1);
		first?.close();

		const second = await catalog.openCatalog({ env: { MLX_HOME: root } });
		expect(second?.schemaVersion()).toBe(1);
		second?.close();
	});

	it('preserves a supported prior catalog row across repeated upgrades', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await sqliteModule();
		const catalogDir = path.join(root, 'catalog');
		mkdirSync(catalogDir);
		const catalogPath = path.join(catalogDir, 'mlx.sqlite3');
		const prior = new Database(catalogPath, { create: true });
		prior.exec('CREATE TABLE prior_rows (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
		prior.query('INSERT INTO prior_rows (value) VALUES (?)').run('survives');
		prior.close();

		for (let reopen = 0; reopen < 2; reopen += 1) {
			const connection = await catalog.openCatalog({ env: { MLX_HOME: root } });
			expect(connection?.schemaVersion()).toBe(1);
			connection?.close();
		}
		const verified = new Database(catalogPath, { readonly: true });
		expect(verified.query('SELECT value FROM prior_rows').get()).toEqual({ value: 'survives' });
		verified.close();
	});

	it('serializes concurrent first opens onto one migration ledger', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const connectionUrl = new URL('../../src/catalog/connection.ts', import.meta.url).href;
		const script = `import { openCatalog } from ${JSON.stringify(connectionUrl)}; const connection = await openCatalog({ env: { MLX_HOME: ${JSON.stringify(root)} } }); connection.close();`;
		await Promise.all(
			Array.from({ length: 4 }, () => waitForProcess(spawn('bun', ['-e', script]))),
		);
		const catalog = requireCatalog(await catalogModule());
		const connection = await catalog.openCatalog({ env: { MLX_HOME: root } });
		expect(connection.schemaVersion()).toBe(1);
		connection.close();
	});

	it('rolls back an injected migration failure without ad hoc schema mutation', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await initializeOwnedRoot(root);
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await sqliteModule();
		await expect(
			catalog.openCatalog(
				{ env: { MLX_HOME: root } },
				{
					afterMigrationSql: () =>
						void (() => {
							throw new Error('injected migration failure');
						})(),
				},
			),
		).rejects.toThrow('injected migration failure');

		const database = new Database(path.join(root, 'catalog', 'mlx.sqlite3'));
		const tables = database
			.query("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
			.all();
		expect(tables).toEqual([]);
		database.close();
	});

	it('refuses checksum drift, ledger gaps, and future versions before mutation', async () => {
		if (!requireBunRuntime()) return;
		const catalog = requireCatalog(await catalogModule());
		const { Database } = await sqliteModule();
		for (const scenario of ['drift', 'gap', 'future'] as const) {
			const root = makeRoot();
			await initializeOwnedRoot(root);
			const first = await catalog.openCatalog({ env: { MLX_HOME: root } });
			first.close();
			const catalogPath = path.join(root, 'catalog', 'mlx.sqlite3');
			const database = new Database(catalogPath);
			if (scenario === 'drift') {
				database
					.query('UPDATE schema_migrations SET checksum = ? WHERE migration_number = 1')
					.run('0'.repeat(64));
			} else if (scenario === 'gap') {
				database
					.query('UPDATE schema_migrations SET migration_number = 2 WHERE migration_number = 1')
					.run();
			} else {
				database
					.query(
						'INSERT INTO schema_migrations (migration_number, name, checksum) VALUES (?, ?, ?)',
					)
					.run(2, '0002-future.sql', '1'.repeat(64));
			}
			database.close();
			await expect(catalog.openCatalog({ env: { MLX_HOME: root } })).rejects.toThrow(
				scenario === 'drift' ? 'drift' : scenario === 'gap' ? 'gap' : 'newer',
			);
			const ledger = readFileSync(catalogPath);
			expect(ledger.byteLength).toBeGreaterThan(0);
		}
	});
});
