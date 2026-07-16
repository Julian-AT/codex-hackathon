import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { type ConfigDependencies, loadRuntimeConfig } from '../lib/config';
import { resolveContainedPath } from './contained-path';
import { inspectStateRoot } from './state-ownership';

const CONTENDERS = 2;
const WRITES_PER_CONTENDER = 25;
const PROBE_TIMEOUT_MS = 5_000;

const WRITER_SOURCE = `
import { Database } from 'bun:sqlite';
const database = new Database(process.argv[1], { create: true, strict: true });
database.exec('PRAGMA busy_timeout = 5000');
database.exec('PRAGMA journal_mode = WAL');
const insert = database.query('INSERT INTO capability_writes (contender, sequence) VALUES (?, ?)');
for (let sequence = 0; sequence < ${WRITES_PER_CONTENDER}; sequence += 1) {
  database.transaction(() => insert.run(process.argv[2], sequence)).immediate();
  await Bun.sleep(2);
}
database.close();
`;

interface CapabilityDatabase {
	exec(sql: string): void;
	query<T extends Record<string, unknown>, P extends unknown[]>(
		sql: string,
	): {
		get(...parameters: P): T | null;
	};
	close(): void;
}

interface CapabilityDatabaseConstructor {
	new (
		filename: string,
		options?: { readonly create?: boolean; readonly strict?: boolean },
	): CapabilityDatabase;
}

interface BunSubprocess {
	readonly exited: Promise<number>;
	readonly stderr: ReadableStream<Uint8Array> | null;
	kill(): void;
}

interface BunRuntime {
	spawn(
		command: readonly string[],
		options: { readonly stdout: 'ignore'; readonly stderr: 'pipe' },
	): BunSubprocess;
}

export interface SqliteConcurrencyEvidence {
	readonly status: 'pass' | 'fail' | 'error';
	readonly contenders: number;
	readonly committedWrites: number;
	readonly checkpointAttempts?: number;
	readonly error?: string;
}

export interface SqliteCapabilityEvidence {
	readonly sqliteVersion: string | null;
	readonly journalMode: 'wal' | 'other' | 'unavailable';
	readonly foreignKeys: boolean;
	readonly concurrency: SqliteConcurrencyEvidence;
	readonly multiOwnerMutationAllowed: boolean;
}

function sanitizeError(error: unknown): string {
	if (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string'
	)
		return error.code;
	return error instanceof Error ? error.name : 'SQLITE_PROBE_FAILED';
}

function scalar<T>(database: CapabilityDatabase, sql: string): T {
	const row = database.query<Record<string, unknown>, []>(sql).get();
	const value = row && Object.values(row)[0];
	return value as T;
}

async function loadDatabase(): Promise<CapabilityDatabaseConstructor> {
	const specifier = 'bun:sqlite';
	const module = (await import(specifier)) as { readonly Database: CapabilityDatabaseConstructor };
	return module.Database;
}

async function runWriters(databasePath: string): Promise<{
	readonly statuses: readonly number[];
	readonly errors: readonly string[];
}> {
	const bun = (globalThis as { readonly Bun?: BunRuntime }).Bun;
	if (!bun) throw new Error('Bun runtime is required for SQLite probing.');
	const children = Array.from({ length: CONTENDERS }, (_, index) =>
		bun.spawn([process.execPath, '-e', WRITER_SOURCE, databasePath, `writer-${index}`], {
			stdout: 'ignore',
			stderr: 'pipe',
		}),
	);
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		for (const child of children) child.kill();
	}, PROBE_TIMEOUT_MS);
	try {
		const statuses = await Promise.all(children.map(async (child) => await child.exited));
		const errors = await Promise.all(
			children.map(async (child) => {
				if (!child.stderr) return '';
				return (await new Response(child.stderr).text()).trim();
			}),
		);
		if (timedOut) throw new Error('SQLite concurrency probe timed out.');
		return { statuses, errors };
	} finally {
		clearTimeout(timeout);
	}
}

export async function probeSqliteCapability(
	input: ConfigDependencies = {},
): Promise<SqliteCapabilityEvidence> {
	let database: CapabilityDatabase | null = null;
	let probeDirectory: string | null = null;
	let sqliteVersion: string | null = null;
	let journalMode: SqliteCapabilityEvidence['journalMode'] = 'unavailable';
	let foreignKeys = false;
	try {
		const runtime = loadRuntimeConfig(input);
		const ownership = await inspectStateRoot({ root: runtime.paths.root });
		if (ownership.status !== 'owned') throw new Error('UNOWNED_ROOT');
		probeDirectory = path.join(path.dirname(runtime.paths.catalog), `capability-${randomUUID()}`);
		const contained = resolveContainedPath({
			root: runtime.paths.root,
			relativePath: path.relative(runtime.paths.root, probeDirectory),
			field: 'paths.sqliteCapability',
		});
		if (!contained.ok || contained.path !== probeDirectory) throw new Error('UNSAFE_PROBE_PATH');
		mkdirSync(probeDirectory, { recursive: true, mode: 0o700 });
		const databasePath = path.join(probeDirectory, 'capability.sqlite3');
		const Database = await loadDatabase();
		database = new Database(databasePath, { create: true, strict: true });
		database.exec('PRAGMA busy_timeout = 5000');
		database.exec('PRAGMA foreign_keys = ON');
		database.exec('PRAGMA journal_mode = WAL');
		sqliteVersion = scalar<string>(database, 'SELECT sqlite_version() AS version');
		journalMode =
			scalar<string>(database, 'PRAGMA journal_mode').toLowerCase() === 'wal' ? 'wal' : 'other';
		foreignKeys = scalar<number>(database, 'PRAGMA foreign_keys') === 1;
		database.exec(
			'CREATE TABLE capability_writes (contender TEXT NOT NULL, sequence INTEGER NOT NULL, PRIMARY KEY (contender, sequence)) STRICT',
		);

		let checkpointAttempts = 0;
		const checkpoint = setInterval(() => {
			try {
				database?.query('PRAGMA wal_checkpoint(PASSIVE)').get();
				checkpointAttempts += 1;
			} catch {
				// A busy checkpoint is acceptable; final row verification remains authoritative.
			}
		}, 2);
		const writers = await runWriters(databasePath).finally(() => clearInterval(checkpoint));
		const committedWrites = scalar<number>(
			database,
			'SELECT count(*) AS count FROM capability_writes',
		);
		const distinctContenders = scalar<number>(
			database,
			'SELECT count(DISTINCT contender) AS count FROM capability_writes',
		);
		const passed =
			journalMode === 'wal' &&
			foreignKeys &&
			writers.statuses.every((status) => status === 0) &&
			committedWrites === CONTENDERS * WRITES_PER_CONTENDER &&
			distinctContenders === CONTENDERS &&
			checkpointAttempts > 0;
		const concurrency: SqliteConcurrencyEvidence = {
			status: passed ? 'pass' : 'fail',
			contenders: CONTENDERS,
			committedWrites,
			checkpointAttempts,
			...(passed ? {} : { error: writers.errors.filter(Boolean).join('; ') || 'ROW_MISMATCH' }),
		};
		return {
			sqliteVersion,
			journalMode,
			foreignKeys,
			concurrency,
			multiOwnerMutationAllowed: passed,
		};
	} catch (error) {
		return {
			sqliteVersion,
			journalMode,
			foreignKeys,
			concurrency: {
				status: 'error',
				contenders: CONTENDERS,
				committedWrites: 0,
				error: sanitizeError(error),
			},
			multiOwnerMutationAllowed: false,
		};
	} finally {
		database?.close();
		if (probeDirectory) rmSync(probeDirectory, { recursive: true, force: true });
	}
}
