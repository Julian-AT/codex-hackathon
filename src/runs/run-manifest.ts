import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CatalogDatabase } from '../catalog/migration-runner';
import type { ObjectStore } from '../storage/object-store';

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const identifierSchema = z
	.string()
	.min(1)
	.max(256)
	.refine((value) =>
		[...value].every((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint >= 32 && codePoint !== 127;
		}),
	);
const timestampSchema = z.string().datetime({ offset: true });

const outputSchema = z
	.object({
		name: identifierSchema,
		digest: digestSchema,
		size: z.number().int().nonnegative().safe(),
	})
	.strict();

const validationSchema = z
	.object({
		name: identifierSchema,
		status: z.enum(['pass', 'fail', 'skipped']),
	})
	.strict();

export const runManifestSchema = z
	.object({
		schemaVersion: z.literal(1),
		runId: identifierSchema,
		stageId: identifierSchema,
		stageKey: digestSchema,
		createdAt: timestampSchema,
		inputHashes: z.array(digestSchema),
		configHash: digestSchema,
		implementationVersion: identifierSchema,
		parent: z
			.object({ runId: identifierSchema, manifestDigest: digestSchema })
			.strict()
			.nullable(),
		outputs: z.array(outputSchema),
		validation: z.array(validationSchema),
	})
	.strict();

export type RunManifest = z.infer<typeof runManifestSchema>;
export type RunStatus = 'running' | 'committed' | 'failed' | 'cancelled';

export interface CreateRunInput {
	readonly runId: string;
	readonly stageKey: string;
	readonly stageType: string;
	readonly createdAt: string;
	readonly parentRunId?: string;
}

export interface RunRecord {
	readonly runId: string;
	readonly stageKey: string;
	readonly stageType: string;
	readonly status: RunStatus;
	readonly manifestDigest: string | null;
	readonly manifestSize: number | null;
	readonly parentRunId: string | null;
	readonly createdAt: string;
	readonly terminalAt: string | null;
	readonly reuseValidity: 'unknown' | 'invalid';
}

export interface CommittedRun extends RunRecord {
	readonly status: 'committed';
	readonly manifestDigest: string;
	readonly manifestSize: number;
}

export interface RunManifestHooks {
	/** Test-only crash seam after immutable CAS publication and before catalog commit. */
	readonly afterManifestStored?: () => void;
}

interface RunRow {
	readonly run_id: string;
	readonly stage_key: string;
	readonly stage_type: string;
	readonly status: RunStatus;
	readonly manifest_digest: string | null;
	readonly manifest_size: number | null;
	readonly parent_run_id: string | null;
	readonly created_at: string;
	readonly terminal_at: string | null;
	readonly invalid_count: number;
}

export class RunManifestError extends Error {
	constructor(
		readonly code:
			| 'INVALID_MANIFEST'
			| 'RUN_CONFLICT'
			| 'RUN_NOT_FOUND'
			| 'TERMINAL_RUN'
			| 'OBJECT_NOT_VERIFIED'
			| 'INVALID_LINEAGE',
		message: string,
	) {
		super(message);
		this.name = 'RunManifestError';
	}
}

function compareCodePoints(left: string, right: string): number {
	const a = [...left].map((value) => value.codePointAt(0) ?? 0);
	const b = [...right].map((value) => value.codePointAt(0) ?? 0);
	for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
		if (a[index] !== b[index]) return a[index] - b[index];
	}
	return a.length - b.length;
}

function canonicalValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => compareCodePoints(left, right))
				.map(([key, item]) => [key, canonicalValue(item)]),
		);
	}
	return value;
}

export function canonicalJsonBytes(value: unknown): Buffer {
	return Buffer.from(JSON.stringify(canonicalValue(value)), 'utf8');
}

function parseManifest(input: unknown): RunManifest {
	const result = runManifestSchema.safeParse(input);
	if (!result.success) {
		throw new RunManifestError('INVALID_MANIFEST', 'Run manifest does not match schema version 1.');
	}
	const outputNames = new Set<string>();
	for (const output of result.data.outputs) {
		if (outputNames.has(output.name)) {
			throw new RunManifestError('INVALID_MANIFEST', 'Run manifest output names must be unique.');
		}
		outputNames.add(output.name);
	}
	const validationNames = new Set<string>();
	for (const validation of result.data.validation) {
		if (validationNames.has(validation.name)) {
			throw new RunManifestError('INVALID_MANIFEST', 'Validation names must be unique.');
		}
		validationNames.add(validation.name);
	}
	return result.data;
}

function toRunRecord(row: RunRow): RunRecord {
	return Object.freeze({
		runId: row.run_id,
		stageKey: row.stage_key,
		stageType: row.stage_type,
		status: row.status,
		manifestDigest: row.manifest_digest,
		manifestSize: row.manifest_size,
		parentRunId: row.parent_run_id,
		createdAt: row.created_at,
		terminalAt: row.terminal_at,
		reuseValidity: row.invalid_count > 0 ? 'invalid' : 'unknown',
	});
}

export function getRunRecord(database: CatalogDatabase, runId: string): RunRecord | null {
	const row = database
		.query<RunRow, [string]>(
			`SELECT r.run_id, r.stage_key, r.stage_type, r.status, r.manifest_digest,
			 r.manifest_size, r.parent_run_id, r.created_at, r.terminal_at,
			 (SELECT count(*) FROM run_events e WHERE e.run_id = r.run_id AND e.event_type = 'reuse-invalid') AS invalid_count
			 FROM runs r WHERE r.run_id = ?`,
		)
		.get(runId);
	return row ? toRunRecord(row) : null;
}

function assertIdentifier(value: string, field: string, max = 256): void {
	if (
		value.length < 1 ||
		value.length > max ||
		[...value].some((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint < 32 || codePoint === 127;
		})
	) {
		throw new RunManifestError('RUN_CONFLICT', `${field} is invalid.`);
	}
}

export function createRun(database: CatalogDatabase, input: CreateRunInput): RunRecord {
	assertIdentifier(input.runId, 'runId');
	assertIdentifier(input.stageType, 'stageType', 128);
	if (!digestSchema.safeParse(input.stageKey).success || !timestampSchema.safeParse(input.createdAt).success) {
		throw new RunManifestError('RUN_CONFLICT', 'Run identity or timestamp is invalid.');
	}
	try {
		database
			.query<never, [string, string, string, string, string | null]>(
				`INSERT INTO runs
				 (run_id, stage_key, stage_type, status, created_at, parent_run_id)
				 VALUES (?, ?, ?, 'running', ?, ?)`,
			)
			.run(
				input.runId,
				input.stageKey,
				input.stageType,
				input.createdAt,
				input.parentRunId ?? null,
			);
	} catch (error) {
		throw new RunManifestError(
			'RUN_CONFLICT',
			`Run identity conflicts with catalog evidence: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const record = getRunRecord(database, input.runId);
	if (!record) throw new RunManifestError('RUN_NOT_FOUND', 'Run insert was not durable.');
	return record;
}

function nextEventSequence(database: CatalogDatabase, runId: string): number {
	return (
		(database
			.query<{ readonly sequence: number }, [string]>(
				'SELECT coalesce(max(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = ?',
			)
			.get(runId)?.sequence ?? 1)
	);
}

function insertEvent(
	database: CatalogDatabase,
	runId: string,
	eventType: string,
	payload: unknown,
	createdAt: string,
): void {
	assertIdentifier(eventType, 'eventType', 128);
	if (!timestampSchema.safeParse(createdAt).success) {
		throw new RunManifestError('RUN_CONFLICT', 'Run event timestamp is invalid.');
	}
	database
		.query<never, [string, number, string, string, string]>(
			'INSERT INTO run_events (run_id, sequence, event_type, event_json, created_at) VALUES (?, ?, ?, ?, ?)',
		)
		.run(runId, nextEventSequence(database, runId), eventType, canonicalJsonBytes(payload).toString(), createdAt);
}

export function appendRunEvent(
	database: CatalogDatabase,
	runId: string,
	eventType: string,
	payload: unknown,
	terminalStatus?: 'failed' | 'cancelled',
	createdAt = new Date().toISOString(),
): void {
	database
		.transaction(() => {
			const run = getRunRecord(database, runId);
			if (!run) throw new RunManifestError('RUN_NOT_FOUND', `Run ${runId} does not exist.`);
			if (terminalStatus) {
				if (run.status !== 'running') {
					throw new RunManifestError('TERMINAL_RUN', `Run ${runId} is already terminal.`);
				}
				database
					.query<never, [RunStatus, string, string]>(
						"UPDATE runs SET status = ?, terminal_at = ? WHERE run_id = ? AND status = 'running'",
					)
					.run(terminalStatus, createdAt, runId);
			}
			insertEvent(database, runId, eventType, payload, createdAt);
		})
		.immediate();
}

export function commitRunManifest(
	database: CatalogDatabase,
	store: ObjectStore,
	input: unknown,
	hooks: RunManifestHooks = {},
): CommittedRun {
	const manifest = parseManifest(input);
	const run = getRunRecord(database, manifest.runId);
	if (!run) throw new RunManifestError('RUN_NOT_FOUND', `Run ${manifest.runId} does not exist.`);
	if (run.status !== 'running') {
		throw new RunManifestError('TERMINAL_RUN', `Run ${manifest.runId} is already terminal.`);
	}
	if (
		run.stageKey !== manifest.stageKey ||
		run.stageType !== manifest.stageId ||
		run.createdAt !== manifest.createdAt ||
		run.parentRunId !== (manifest.parent?.runId ?? null)
	) {
		throw new RunManifestError('RUN_CONFLICT', 'Manifest identity differs from its catalog run.');
	}
	if (manifest.parent) {
		const parent = getRunRecord(database, manifest.parent.runId);
		if (
			!parent ||
			parent.status !== 'committed' ||
			parent.manifestDigest !== manifest.parent.manifestDigest
		) {
			throw new RunManifestError('INVALID_LINEAGE', 'Parent lineage is absent or mismatched.');
		}
	}
	try {
		for (const output of manifest.outputs) store.verify(output.digest, output.size);
	} catch (error) {
		throw new RunManifestError(
			'OBJECT_NOT_VERIFIED',
			`Manifest output is not verified: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const object = store.put(canonicalJsonBytes(manifest));
	hooks.afterManifestStored?.();
	const committedAt = new Date().toISOString();
	database
		.transaction(() => {
			database
				.query<never, [string, number]>(
					'INSERT INTO blobs (digest, size) VALUES (?, ?) ON CONFLICT(digest) DO NOTHING',
				)
				.run(object.digest, object.size);
			const changed = database
				.query<never, [string, number, string, string]>(
					`UPDATE runs SET status = 'committed', manifest_digest = ?, manifest_size = ?, terminal_at = ?
					 WHERE run_id = ? AND status = 'running'`,
				)
				.run(object.digest, object.size, committedAt, manifest.runId) as { readonly changes?: number };
			if (changed.changes !== 1) {
				throw new RunManifestError('TERMINAL_RUN', `Run ${manifest.runId} became terminal.`);
			}
			insertEvent(
				database,
				manifest.runId,
				'manifest-committed',
				{ digest: object.digest, size: object.size },
				committedAt,
			);
		})
		.immediate();
	const committed = getRunRecord(database, manifest.runId);
	if (!committed || committed.status !== 'committed' || !committed.manifestDigest || committed.manifestSize === null) {
		throw new RunManifestError('RUN_CONFLICT', 'Committed manifest record was not durable.');
	}
	return committed as CommittedRun;
}

export type RunVerification =
	| { readonly ok: true; readonly manifest: RunManifest; readonly run: CommittedRun }
	| { readonly ok: false; readonly reason: string };

export function verifyCommittedRun(
	database: CatalogDatabase,
	store: ObjectStore,
	runId: string,
	expectedValidation: readonly string[],
): RunVerification {
	try {
		const run = getRunRecord(database, runId);
		if (
			!run ||
			run.status !== 'committed' ||
			!run.manifestDigest ||
			run.manifestSize === null ||
			run.reuseValidity === 'invalid'
		) {
			return { ok: false, reason: 'Run is not a valid committed candidate.' };
		}
		const bytes = store.openVerified(run.manifestDigest);
		if (bytes.byteLength !== run.manifestSize) {
			return { ok: false, reason: 'Manifest size does not match catalog evidence.' };
		}
		const manifest = parseManifest(JSON.parse(bytes.toString('utf8')));
		if (
			manifest.runId !== run.runId ||
			manifest.stageKey !== run.stageKey ||
			!canonicalJsonBytes(manifest).equals(bytes)
		) {
			return { ok: false, reason: 'Manifest bytes are not canonical catalog evidence.' };
		}
		for (const output of manifest.outputs) store.verify(output.digest, output.size);
		for (const name of expectedValidation) {
			if (!manifest.validation.some((result) => result.name === name && result.status === 'pass')) {
				return { ok: false, reason: `Required validation ${name} did not pass.` };
			}
		}
		return { ok: true, manifest, run: run as CommittedRun };
	} catch (error) {
		return { ok: false, reason: error instanceof Error ? error.message : String(error) };
	}
}

export function manifestChecksum(manifest: RunManifest): string {
	return createHash('sha256').update(canonicalJsonBytes(parseManifest(manifest))).digest('hex');
}
