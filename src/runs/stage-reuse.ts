import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CatalogDatabase } from '../catalog/migration-runner';
import type { ObjectStore } from '../storage/object-store';
import {
	appendRunEvent,
	canonicalJsonBytes,
	commitRunManifest,
	createRun,
	getRunRecord,
	verifyCommittedRun,
} from './run-manifest';

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const printableSchema = (maximum: number) =>
	z
		.string()
		.min(1)
		.max(maximum)
		.refine((value) =>
			[...value].every((character) => {
				const codePoint = character.codePointAt(0) ?? 0;
				return codePoint >= 32 && codePoint !== 127;
			}),
		);
const identitySchema = z
	.object({
		schemaVersion: z.literal(1),
		stageType: printableSchema(128),
		inputHashes: z.array(digestSchema),
		configHash: digestSchema,
		implementationVersion: printableSchema(256),
		runId: z.string().optional(),
		createdAt: z.string().optional(),
	})
	.strict();

export interface StageIdentity {
	readonly schemaVersion: 1;
	readonly stageType: string;
	readonly inputHashes: readonly string[];
	readonly configHash: string;
	readonly implementationVersion: string;
	/** Observable run metadata is accepted but deliberately excluded from the fingerprint. */
	readonly runId?: string;
	readonly createdAt?: string;
}

export interface StageOutput {
	readonly name: string;
	readonly digest: string;
	readonly size: number;
}

export interface StageValidation {
	readonly name: string;
	readonly status: 'pass' | 'fail' | 'skipped';
}

export interface StageExecution {
	readonly outputs: readonly StageOutput[];
	readonly validation: readonly StageValidation[];
}

export interface ClaimStageInput {
	readonly identity: StageIdentity;
	readonly runId: string;
	readonly createdAt: string;
	readonly expectedValidation: readonly string[];
	readonly execute: () => StageExecution;
}

export type StageReuseResult =
	| {
			readonly kind: 'produced';
			readonly runId: string;
			readonly manifestDigest: string;
			readonly outputs: readonly StageOutput[];
	  }
	| {
			readonly kind: 'reused';
			readonly runId: string;
			readonly sourceRunId: string;
			readonly manifestDigest: string;
			readonly outputs: readonly StageOutput[];
	  }
	| { readonly kind: 'pending'; readonly runId: string; readonly sourceRunId: string };

interface ClaimRow {
	readonly producer_run_id: string;
}

interface CandidateRow {
	readonly run_id: string;
}

export class StageReuseError extends Error {
	constructor(
		readonly code: 'INVALID_IDENTITY' | 'CLAIM_CONFLICT' | 'EXECUTION_FAILED',
		message: string,
	) {
		super(message);
		this.name = 'StageReuseError';
	}
}

function parseIdentity(identity: StageIdentity): z.infer<typeof identitySchema> {
	const result = identitySchema.safeParse(identity);
	if (!result.success) {
		throw new StageReuseError(
			'INVALID_IDENTITY',
			'Stage identity is not canonical schema version 1.',
		);
	}
	return result.data;
}

export function fingerprintStage(identity: StageIdentity): string {
	const parsed = parseIdentity(identity);
	const deterministic = {
		schemaVersion: parsed.schemaVersion,
		stageType: parsed.stageType,
		inputHashes: parsed.inputHashes,
		configHash: parsed.configHash,
		implementationVersion: parsed.implementationVersion,
	};
	return createHash('sha256')
		.update('mlx:deterministic-stage:v1\0', 'utf8')
		.update(canonicalJsonBytes(deterministic))
		.digest('hex');
}

function claimFor(database: CatalogDatabase, stageKey: string): string | null {
	return (
		database
			.query<ClaimRow, [string]>('SELECT producer_run_id FROM stage_claims WHERE stage_key = ?')
			.get(stageKey)?.producer_run_id ?? null
	);
}

function markInvalid(
	database: CatalogDatabase,
	runId: string,
	reason: string,
	createdAt: string,
): void {
	if (getRunRecord(database, runId)?.reuseValidity === 'invalid') return;
	appendRunEvent(database, runId, 'reuse-invalid', { reason }, undefined, createdAt);
}

function releaseInvalidClaim(
	database: CatalogDatabase,
	stageKey: string,
	producerRunId: string,
): void {
	database
		.query<never, [string, string]>(
			'DELETE FROM stage_claims WHERE stage_key = ? AND producer_run_id = ?',
		)
		.run(stageKey, producerRunId);
}

function reuseResult(
	runId: string,
	verification: Extract<ReturnType<typeof verifyCommittedRun>, { readonly ok: true }>,
): StageReuseResult {
	return Object.freeze({
		kind: 'reused',
		runId,
		sourceRunId: verification.run.runId,
		manifestDigest: verification.run.manifestDigest,
		outputs: verification.manifest.outputs,
	});
}

function findReusableCandidate(
	database: CatalogDatabase,
	store: ObjectStore,
	stageKey: string,
	runId: string,
	expectedValidation: readonly string[],
	createdAt: string,
): StageReuseResult | null {
	const candidates = database
		.query<CandidateRow, [string]>(
			"SELECT run_id FROM runs WHERE stage_key = ? AND status = 'committed' ORDER BY terminal_at, run_id",
		)
		.all(stageKey);
	for (const candidate of candidates) {
		const verification = verifyCommittedRun(database, store, candidate.run_id, expectedValidation);
		if (verification.ok) {
			database
				.query<never, [string, string, string]>(
					'INSERT INTO stage_claims (stage_key, producer_run_id, claimed_at) VALUES (?, ?, ?)',
				)
				.run(stageKey, candidate.run_id, createdAt);
			return reuseResult(runId, verification);
		}
		markInvalid(database, candidate.run_id, verification.reason, createdAt);
	}
	return null;
}

export function claimOrExecuteStage(
	database: CatalogDatabase,
	store: ObjectStore,
	input: ClaimStageInput,
): StageReuseResult {
	const identity = parseIdentity(input.identity);
	const stageKey = fingerprintStage(input.identity);

	const claimedRunId = claimFor(database, stageKey);
	if (claimedRunId) {
		const verification = verifyCommittedRun(
			database,
			store,
			claimedRunId,
			input.expectedValidation,
		);
		if (verification.ok) return reuseResult(input.runId, verification);
		const claimed = getRunRecord(database, claimedRunId);
		if (claimed?.status === 'running') {
			return Object.freeze({ kind: 'pending', runId: input.runId, sourceRunId: claimedRunId });
		}
		if (claimed) markInvalid(database, claimedRunId, verification.reason, input.createdAt);
		releaseInvalidClaim(database, stageKey, claimedRunId);
	}

	const reusable = findReusableCandidate(
		database,
		store,
		stageKey,
		input.runId,
		input.expectedValidation,
		input.createdAt,
	);
	if (reusable) return reusable;

	try {
		database
			.transaction(() => {
				if (claimFor(database, stageKey)) {
					throw new StageReuseError('CLAIM_CONFLICT', 'Another producer owns this stage key.');
				}
				createRun(database, {
					runId: input.runId,
					stageKey,
					stageType: identity.stageType,
					createdAt: input.createdAt,
				});
				database
					.query<never, [string, string, string]>(
						'INSERT INTO stage_claims (stage_key, producer_run_id, claimed_at) VALUES (?, ?, ?)',
					)
					.run(stageKey, input.runId, input.createdAt);
			})
			.immediate();
	} catch (error) {
		if (error instanceof StageReuseError) {
			const owner = claimFor(database, stageKey);
			if (owner) return Object.freeze({ kind: 'pending', runId: input.runId, sourceRunId: owner });
		}
		throw error;
	}

	let execution: StageExecution;
	try {
		execution = input.execute();
	} catch (error) {
		appendRunEvent(
			database,
			input.runId,
			'execution-failed',
			{ error: error instanceof Error ? error.name : 'UnknownError' },
			'failed',
			input.createdAt,
		);
		releaseInvalidClaim(database, stageKey, input.runId);
		throw new StageReuseError('EXECUTION_FAILED', 'Deterministic stage execution failed.');
	}

	const committed = commitRunManifest(database, store, {
		schemaVersion: 1,
		runId: input.runId,
		stageId: identity.stageType,
		stageKey,
		createdAt: input.createdAt,
		inputHashes: identity.inputHashes,
		configHash: identity.configHash,
		implementationVersion: identity.implementationVersion,
		parent: null,
		outputs: execution.outputs.map(({ name, digest, size }) => ({ name, digest, size })),
		validation: execution.validation.map(({ name, status }) => ({ name, status })),
	});
	const verification = verifyCommittedRun(database, store, input.runId, input.expectedValidation);
	if (!verification.ok) {
		markInvalid(database, input.runId, verification.reason, input.createdAt);
		releaseInvalidClaim(database, stageKey, input.runId);
	}
	return Object.freeze({
		kind: 'produced',
		runId: input.runId,
		manifestDigest: committed.manifestDigest,
		outputs: execution.outputs,
	});
}
