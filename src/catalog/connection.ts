import { closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { resolveContainedPath } from '../core/contained-path';
import { inspectStateRoot } from '../core/state-ownership';
import { type ConfigDependencies, loadRuntimeConfig } from '../lib/config';
import {
	type CatalogDatabase,
	type MigrationHooks,
	runCatalogMigrations,
} from './migration-runner';

const BUSY_TIMEOUT_MS = 5_000;
const JOURNAL_MODE_RETRY_LIMIT = 50;
const JOURNAL_MODE_RETRY_DELAY_MS = 10;
interface DatabaseConstructor {
	new (
		filename: string,
		options?: { readonly create?: boolean; readonly strict?: boolean; readonly readonly?: boolean },
	): CatalogDatabase;
}

async function loadDatabaseConstructor(): Promise<DatabaseConstructor> {
	const specifier = 'bun:sqlite';
	const module = (await import(specifier)) as { readonly Database: DatabaseConstructor };
	return module.Database;
}

function isSqliteBusy(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { readonly code?: unknown }).code === 'SQLITE_BUSY'
	);
}

async function enableWal(database: CatalogDatabase): Promise<void> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			database.exec('PRAGMA journal_mode = WAL');
			return;
		} catch (error) {
			if (!isSqliteBusy(error) || attempt >= JOURNAL_MODE_RETRY_LIMIT) throw error;
			await new Promise((resolve) => setTimeout(resolve, JOURNAL_MODE_RETRY_DELAY_MS));
		}
	}
}

export interface CatalogPragmas {
	readonly busyTimeout: number;
	readonly foreignKeys: true;
	readonly journalMode: 'wal';
}

export interface CatalogConnection {
	close(): void;
	pragmas(): CatalogPragmas;
	schemaVersion(): number;
	transaction<T>(operation: () => T): T;
}

export interface OpenCatalogInput extends ConfigDependencies {}

export interface OpenCatalogDependencies {
	/** Test-only failure seam. Production callers must omit this dependency. */
	readonly afterMigrationSql?: MigrationHooks['afterMigrationSql'];
}

export class CatalogError extends Error {
	constructor(
		readonly code: 'UNOWNED_ROOT' | 'UNSAFE_CATALOG_PATH' | 'CATALOG_PRAGMA_FAILED',
		message: string,
	) {
		super(message);
		this.name = 'CatalogError';
	}
}

function scalarNumber(database: CatalogDatabase, sql: string): number {
	const row = database.query<Record<string, number>, []>(sql).get();
	const value = row && Object.values(row)[0];
	if (typeof value !== 'number')
		throw new Error(`SQLite did not return a numeric value for ${sql}`);
	return value;
}

function scalarString(database: CatalogDatabase, sql: string): string {
	const row = database.query<Record<string, string>, []>(sql).get();
	const value = row && Object.values(row)[0];
	if (typeof value !== 'string') throw new Error(`SQLite did not return a string value for ${sql}`);
	return value;
}

function inspectPragmas(database: CatalogDatabase): CatalogPragmas {
	const busyTimeout = scalarNumber(database, 'PRAGMA busy_timeout');
	const foreignKeys = scalarNumber(database, 'PRAGMA foreign_keys');
	const journalMode = scalarString(database, 'PRAGMA journal_mode').toLowerCase();
	if (busyTimeout !== BUSY_TIMEOUT_MS || foreignKeys !== 1 || journalMode !== 'wal') {
		throw new CatalogError(
			'CATALOG_PRAGMA_FAILED',
			`Catalog pragmas are unsafe (busy_timeout=${busyTimeout}, foreign_keys=${foreignKeys}, journal_mode=${journalMode}).`,
		);
	}
	return { busyTimeout, foreignKeys: true, journalMode: 'wal' };
}

class BunCatalogConnection implements CatalogConnection {
	#closed = false;
	readonly #database: CatalogDatabase;

	constructor(database: CatalogDatabase) {
		this.#database = database;
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#database.close();
	}

	pragmas(): CatalogPragmas {
		if (this.#closed) throw new Error('Catalog connection is closed.');
		return inspectPragmas(this.#database);
	}

	schemaVersion(): number {
		if (this.#closed) throw new Error('Catalog connection is closed.');
		return scalarNumber(
			this.#database,
			'SELECT coalesce(max(migration_number), 0) AS version FROM schema_migrations',
		);
	}

	transaction<T>(operation: () => T): T {
		if (this.#closed) throw new Error('Catalog connection is closed.');
		return this.#database.transaction(operation).immediate();
	}
}

export async function openCatalog(
	input: OpenCatalogInput = {},
	dependencies: OpenCatalogDependencies = {},
): Promise<CatalogConnection> {
	const runtime = loadRuntimeConfig(input);
	const ownership = await inspectStateRoot({ root: runtime.paths.root });
	if (ownership.status !== 'owned') {
		throw new CatalogError(
			'UNOWNED_ROOT',
			`Catalog open requires an owned MLX state root; found ${ownership.status}.`,
		);
	}

	mkdirSync(path.dirname(runtime.paths.catalog), { recursive: true, mode: 0o700 });
	const contained = resolveContainedPath({
		root: runtime.paths.root,
		relativePath: path.relative(runtime.paths.root, runtime.paths.catalog),
		field: 'paths.catalog',
	});
	if (!contained.ok || contained.path !== runtime.paths.catalog) {
		throw new CatalogError('UNSAFE_CATALOG_PATH', 'Catalog path is not contained by MLX_HOME.');
	}
	try {
		const descriptor = openSync(runtime.paths.catalog, 'wx', 0o600);
		closeSync(descriptor);
	} catch (error) {
		if (
			!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')
		)
			throw error;
	}
	const finalPath = resolveContainedPath({
		root: runtime.paths.root,
		relativePath: path.relative(runtime.paths.root, runtime.paths.catalog),
		field: 'paths.catalog',
	});
	if (!finalPath.ok || finalPath.path !== runtime.paths.catalog) {
		throw new CatalogError('UNSAFE_CATALOG_PATH', 'Catalog file failed containment inspection.');
	}

	const Database = await loadDatabaseConstructor();
	const database = new Database(runtime.paths.catalog, { create: true, strict: true });
	try {
		database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
		database.exec('PRAGMA foreign_keys = ON');
		await enableWal(database);
		inspectPragmas(database);
		runCatalogMigrations(database, dependencies);
		inspectPragmas(database);
		return new BunCatalogConnection(database);
	} catch (error) {
		database.close();
		throw error;
	}
}
