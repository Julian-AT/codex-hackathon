import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { resolveContainedPath } from '../core/contained-path';
import { inspectStateRoot } from '../core/state-ownership';
import { type ConfigDependencies, loadRuntimeConfig } from '../lib/config';

const DEFAULT_TTL_MS = 30_000;
const OWNER_RECORD = 'owner.json';
const PROCESS_STARTED_AT = Math.floor(Date.now() - process.uptime() * 1_000);

const CatalogOwnerRecordSchema = z
	.object({
		schemaVersion: z.literal('1'),
		nonce: z.string().uuid(),
		pid: z.number().int().positive(),
		processStartIdentity: z.string().min(1),
		acquiredAt: z.number().int().nonnegative(),
		expiresAt: z.number().int().positive(),
	})
	.strict();

export type CatalogOwnerRecord = z.output<typeof CatalogOwnerRecordSchema>;

export interface AcquireCatalogOwnerInput extends ConfigDependencies {
	readonly ttlMs?: number;
	readonly recoverStale?: boolean;
}

export interface CatalogOwnerDependencies {
	readonly now?: () => number;
	readonly pid?: number;
	readonly processStartIdentity?: string;
	readonly nonce?: () => string;
	readonly isProcessAlive?: (pid: number) => boolean;
}

export type CatalogOwnerFailureCode =
	| 'CATALOG_OWNER_HELD'
	| 'CATALOG_OWNER_STALE'
	| 'CATALOG_OWNER_MALFORMED'
	| 'CATALOG_OWNER_UNSAFE';

export type CatalogOwnerResult =
	| {
			readonly ok: true;
			readonly record: CatalogOwnerRecord;
			readonly ownerPath: string;
			renew(ttlMs?: number): Promise<CatalogOwnerRecord>;
			release(): Promise<void>;
	  }
	| {
			readonly ok: false;
			readonly code: CatalogOwnerFailureCode;
			readonly reason: string;
			readonly action: string;
	  };

function isAlreadyExists(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

function defaultIsProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return !(
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 'ESRCH'
		);
	}
}

function positiveTtl(value: number | undefined): number {
	const ttl = value ?? DEFAULT_TTL_MS;
	if (!Number.isSafeInteger(ttl) || ttl <= 0)
		throw new Error('Catalog owner TTL must be positive.');
	return ttl;
}

function serialize(record: CatalogOwnerRecord): string {
	return `${JSON.stringify(record)}\n`;
}

function parseRecord(raw: string): CatalogOwnerRecord | null {
	try {
		return CatalogOwnerRecordSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

async function readOwner(ownerPath: string): Promise<{
	readonly raw: string;
	readonly record: CatalogOwnerRecord | null;
}> {
	const raw = await readFile(path.join(ownerPath, OWNER_RECORD), 'utf8');
	return { raw, record: parseRecord(raw) };
}

async function restoreQuarantine(quarantine: string, ownerPath: string): Promise<void> {
	try {
		await rename(quarantine, ownerPath);
	} catch {
		// A competing owner now occupies the canonical path. Keep the quarantined evidence intact.
	}
}

class AcquiredCatalogOwner {
	#record: CatalogOwnerRecord;
	#released = false;
	readonly #ownerPath: string;
	readonly #now: () => number;

	constructor(ownerPath: string, record: CatalogOwnerRecord, now: () => number) {
		this.#ownerPath = ownerPath;
		this.#record = record;
		this.#now = now;
	}

	get ok(): true {
		return true;
	}

	get record(): CatalogOwnerRecord {
		return this.#record;
	}

	get ownerPath(): string {
		return this.#ownerPath;
	}

	async renew(ttlMs?: number): Promise<CatalogOwnerRecord> {
		if (this.#released) throw new Error('Catalog owner has already been released.');
		const current = await readOwner(this.#ownerPath);
		if (!current.record || current.record.nonce !== this.#record.nonce) {
			throw new Error('Catalog owner renewal rejected because ownership changed.');
		}
		const now = this.#now();
		const renewed: CatalogOwnerRecord = {
			...this.#record,
			expiresAt: now + positiveTtl(ttlMs),
		};
		const temporary = path.join(this.#ownerPath, `.renew-${this.#record.nonce}`);
		await writeFile(temporary, serialize(renewed), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
		try {
			await rename(temporary, path.join(this.#ownerPath, OWNER_RECORD));
			const confirmed = await readOwner(this.#ownerPath);
			if (confirmed.record?.nonce !== this.#record.nonce) {
				throw new Error('Catalog owner renewal lost ownership during replacement.');
			}
			this.#record = renewed;
			return renewed;
		} finally {
			await rm(temporary, { force: true });
		}
	}

	async release(): Promise<void> {
		if (this.#released) return;
		const quarantine = `${this.#ownerPath}.release-${this.#record.nonce}`;
		await rename(this.#ownerPath, quarantine);
		const isolated = await readOwner(quarantine).catch(() => null);
		if (!isolated?.record || isolated.record.nonce !== this.#record.nonce) {
			await restoreQuarantine(quarantine, this.#ownerPath);
			throw new Error('Catalog owner release rejected because ownership changed.');
		}
		const entries = await readdir(quarantine);
		if (entries.some((entry) => entry !== OWNER_RECORD)) {
			await restoreQuarantine(quarantine, this.#ownerPath);
			throw new Error('Catalog owner release rejected unexpected lock contents.');
		}
		await rm(quarantine, { recursive: true });
		this.#released = true;
	}
}

function failure(
	code: CatalogOwnerFailureCode,
	reason: string,
	action: string,
): CatalogOwnerResult {
	return { ok: false, code, reason, action };
}

export async function acquireCatalogOwner(
	input: AcquireCatalogOwnerInput = {},
	dependencies: CatalogOwnerDependencies = {},
): Promise<CatalogOwnerResult> {
	const runtime = loadRuntimeConfig(input);
	const ownership = await inspectStateRoot({ root: runtime.paths.root });
	if (ownership.status !== 'owned') {
		return failure(
			'CATALOG_OWNER_UNSAFE',
			`Catalog ownership requires an owned MLX state root; found ${ownership.status}.`,
			'Run mlx init for the selected MLX_HOME before opening the catalog.',
		);
	}
	const ownerPath = `${runtime.paths.catalog}.owner`;
	const contained = resolveContainedPath({
		root: runtime.paths.root,
		relativePath: path.relative(runtime.paths.root, ownerPath),
		field: 'paths.catalogOwner',
	});
	if (!contained.ok || contained.path !== ownerPath) {
		return failure(
			'CATALOG_OWNER_UNSAFE',
			'Catalog owner path is not safely contained by MLX_HOME.',
			'Correct the catalog path and retry.',
		);
	}
	await mkdir(path.dirname(ownerPath), { recursive: true, mode: 0o700 });

	const now = dependencies.now ?? Date.now;
	const pid = dependencies.pid ?? process.pid;
	const processStartIdentity = dependencies.processStartIdentity ?? `${pid}:${PROCESS_STARTED_AT}`;
	const nonce = dependencies.nonce ?? randomUUID;
	const isProcessAlive = dependencies.isProcessAlive ?? defaultIsProcessAlive;
	const ttlMs = positiveTtl(input.ttlMs);

	const create = async (): Promise<CatalogOwnerResult> => {
		try {
			await mkdir(ownerPath, { mode: 0o700 });
		} catch (error) {
			if (isAlreadyExists(error)) return inspectExisting();
			throw error;
		}
		const acquiredAt = now();
		const record: CatalogOwnerRecord = {
			schemaVersion: '1',
			nonce: nonce(),
			pid,
			processStartIdentity,
			acquiredAt,
			expiresAt: acquiredAt + ttlMs,
		};
		try {
			await writeFile(path.join(ownerPath, OWNER_RECORD), serialize(record), {
				encoding: 'utf8',
				flag: 'wx',
				mode: 0o600,
			});
			return new AcquiredCatalogOwner(ownerPath, record, now);
		} catch (error) {
			await rm(ownerPath, { recursive: true, force: true });
			throw error;
		}
	};

	const inspectExisting = async (): Promise<CatalogOwnerResult> => {
		const existing = await readOwner(ownerPath).catch(() => null);
		if (!existing?.record) {
			return failure(
				'CATALOG_OWNER_MALFORMED',
				'Catalog owner evidence is missing or malformed.',
				'Review the owner directory manually; malformed evidence is never removed automatically.',
			);
		}
		const stale = existing.record.expiresAt <= now();
		if (!stale || isProcessAlive(existing.record.pid)) {
			return failure(
				'CATALOG_OWNER_HELD',
				'Another live or unexpired process owns catalog mutation authority.',
				'Wait for the owner to release the catalog or for its declared lease to expire.',
			);
		}
		if (input.recoverStale !== true) {
			return failure(
				'CATALOG_OWNER_STALE',
				'Expired catalog owner evidence is present.',
				'Retry with the explicit stale-owner recovery protocol after confirming the process ended.',
			);
		}

		const quarantine = `${ownerPath}.stale-${nonce()}`;
		try {
			await rename(ownerPath, quarantine);
		} catch (error) {
			if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
				return create();
			throw error;
		}
		const isolated = await readOwner(quarantine).catch(() => null);
		if (isolated?.raw !== existing.raw) {
			await restoreQuarantine(quarantine, ownerPath);
			return failure(
				'CATALOG_OWNER_HELD',
				'Catalog owner evidence changed during stale recovery.',
				'Retry after the current owner releases the catalog.',
			);
		}
		const entries = await readdir(quarantine);
		if (entries.some((entry) => entry !== OWNER_RECORD)) {
			await restoreQuarantine(quarantine, ownerPath);
			return failure(
				'CATALOG_OWNER_MALFORMED',
				'Catalog owner directory contains unexpected evidence.',
				'Review the owner directory manually; unexpected evidence is never removed automatically.',
			);
		}
		await rm(quarantine, { recursive: true });
		return create();
	};

	return await create();
}
