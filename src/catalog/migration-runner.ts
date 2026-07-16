import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface CatalogStatement<Row, Parameters extends readonly unknown[]> {
	get(...parameters: Parameters): Row | null;
	run(...parameters: Parameters): unknown;
	all(...parameters: Parameters): Row[];
}

export interface CatalogDatabase {
	close(): void;
	exec(sql: string): void;
	query<Row = unknown, Parameters extends readonly unknown[] = readonly unknown[]>(
		sql: string,
	): CatalogStatement<Row, Parameters>;
	transaction<T>(operation: () => T): { immediate(): T };
}

export interface MigrationHooks {
	readonly afterMigrationSql?: (migrationNumber: number) => void;
}

interface MigrationDefinition {
	readonly number: number;
	readonly name: string;
	readonly url: URL;
}

interface LoadedMigration {
	readonly number: number;
	readonly name: string;
	readonly sql: string;
	readonly checksum: string;
}

interface RecordedMigration {
	readonly migration_number: number;
	readonly name: string;
	readonly checksum: string;
}

const APPLICATION_MIGRATIONS: readonly MigrationDefinition[] = Object.freeze([
	Object.freeze({
		number: 1,
		name: '0001-catalog.sql',
		url: new URL('../../migrations/0001-catalog.sql', import.meta.url),
	}),
	Object.freeze({
		number: 2,
		name: '0002-blobs.sql',
		url: new URL('../../migrations/0002-blobs.sql', import.meta.url),
	}),
	Object.freeze({
		number: 3,
		name: '0003-runs.sql',
		url: new URL('../../migrations/0003-runs.sql', import.meta.url),
	}),
]);

export class MigrationError extends Error {
	constructor(
		readonly code:
			| 'INVALID_MANIFEST'
			| 'MIGRATION_DRIFT'
			| 'MIGRATION_GAP'
			| 'FUTURE_SCHEMA'
			| 'INVALID_LEDGER',
		message: string,
	) {
		super(message);
		this.name = 'MigrationError';
	}
}

function loadApplicationManifest(): readonly LoadedMigration[] {
	let expected = 1;
	const names = new Set<string>();
	return APPLICATION_MIGRATIONS.map((definition) => {
		if (definition.number !== expected) {
			throw new MigrationError(
				'INVALID_MANIFEST',
				`Application migration manifest has a gap at migration ${expected}.`,
			);
		}
		const prefix = definition.name.match(/^(\d{4})-[a-z0-9-]+\.sql$/)?.[1];
		if (prefix !== String(definition.number).padStart(4, '0') || names.has(definition.name)) {
			throw new MigrationError(
				'INVALID_MANIFEST',
				`Application migration ${definition.number} has an invalid or duplicate name.`,
			);
		}
		expected += 1;
		names.add(definition.name);
		const sql = readFileSync(definition.url, 'utf8');
		return Object.freeze({
			number: definition.number,
			name: definition.name,
			sql,
			checksum: createHash('sha256').update(sql).digest('hex'),
		});
	});
}

function hasMigrationLedger(database: CatalogDatabase): boolean {
	return (
		database
			.query<{ readonly count: number }, []>(
				"SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'",
			)
			.get()?.count === 1
	);
}

function readLedger(database: CatalogDatabase): readonly RecordedMigration[] {
	try {
		return database
			.query<RecordedMigration, []>(
				'SELECT migration_number, name, checksum FROM schema_migrations ORDER BY migration_number',
			)
			.all();
	} catch (error) {
		throw new MigrationError(
			'INVALID_LEDGER',
			`Catalog migration ledger is invalid: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function verifyLedger(
	recorded: readonly RecordedMigration[],
	manifest: readonly LoadedMigration[],
): void {
	for (let index = 0; index < recorded.length; index += 1) {
		const expectedNumber = index + 1;
		const row = recorded[index];
		if (row.migration_number !== expectedNumber) {
			throw new MigrationError(
				'MIGRATION_GAP',
				`Catalog migration ledger has a gap before migration ${row.migration_number}.`,
			);
		}
		const expected = manifest[index];
		if (!expected) {
			throw new MigrationError(
				'FUTURE_SCHEMA',
				`Catalog schema version ${row.migration_number} is newer than this MLX build.`,
			);
		}
		if (row.name !== expected.name || row.checksum !== expected.checksum) {
			throw new MigrationError(
				'MIGRATION_DRIFT',
				`Catalog migration checksum or name drift detected for ${expected.name}.`,
			);
		}
	}
}

export function runCatalogMigrations(
	database: CatalogDatabase,
	hooks: MigrationHooks = {},
): number {
	const manifest = loadApplicationManifest();
	const recorded = hasMigrationLedger(database) ? readLedger(database) : [];
	verifyLedger(recorded, manifest);

	for (const migration of manifest.slice(recorded.length)) {
		const apply = database.transaction(() => {
			// Re-read after BEGIN IMMEDIATE acquires the writer lock. Another opener may
			// have completed this migration while this connection waited.
			const lockedLedger = hasMigrationLedger(database) ? readLedger(database) : [];
			verifyLedger(lockedLedger, manifest);
			if (lockedLedger.length >= migration.number) return;
			if (lockedLedger.length !== migration.number - 1) {
				throw new MigrationError(
					'MIGRATION_GAP',
					`Catalog migration ${migration.number} cannot follow version ${lockedLedger.length}.`,
				);
			}
			database.exec(migration.sql);
			hooks.afterMigrationSql?.(migration.number);
			database
				.query('INSERT INTO schema_migrations (migration_number, name, checksum) VALUES (?, ?, ?)')
				.run(migration.number, migration.name, migration.checksum);
		});
		apply.immediate();
	}

	const finalLedger = readLedger(database);
	verifyLedger(finalLedger, manifest);
	if (finalLedger.length !== manifest.length) {
		throw new MigrationError(
			'MIGRATION_GAP',
			'Catalog did not record every application migration.',
		);
	}
	return manifest.length;
}
