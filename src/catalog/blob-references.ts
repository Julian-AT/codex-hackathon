import type { ObjectStore } from '../storage/object-store';
import type { CatalogDatabase } from './migration-runner';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const BLOB_KINDS = ['source', 'patch', 'trace', 'report', 'generated'] as const;

export type BlobKind = (typeof BLOB_KINDS)[number];

export interface BlobReferenceInput {
	readonly id: string;
	readonly kind: BlobKind;
	readonly digest: string;
	readonly size: number;
}

export interface BlobReference extends BlobReferenceInput {
	readonly createdAt: string;
}

interface BlobRow {
	readonly digest: string;
	readonly size: number;
}

interface ReferenceRow {
	readonly reference_id: string;
	readonly kind: string;
	readonly digest: string;
	readonly size: number;
	readonly created_at: string;
}

export class BlobReferenceError extends Error {
	constructor(
		readonly code: 'INVALID_REFERENCE' | 'OBJECT_NOT_VERIFIED' | 'REFERENCE_CONFLICT',
		message: string,
	) {
		super(message);
		this.name = 'BlobReferenceError';
	}
}

function validate(input: BlobReferenceInput): void {
	if (
		input.id.length < 1 ||
		input.id.length > 256 ||
		[...input.id].some((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code < 32 || code === 127;
		})
	) {
		throw new BlobReferenceError(
			'INVALID_REFERENCE',
			'Blob reference id must contain 1-256 printable characters.',
		);
	}
	if (!(BLOB_KINDS as readonly string[]).includes(input.kind)) {
		throw new BlobReferenceError('INVALID_REFERENCE', 'Blob reference kind is unsupported.');
	}
	if (!DIGEST_PATTERN.test(input.digest)) {
		throw new BlobReferenceError(
			'INVALID_REFERENCE',
			'Blob reference digest must be lowercase SHA-256.',
		);
	}
	if (!Number.isSafeInteger(input.size) || input.size < 0) {
		throw new BlobReferenceError(
			'INVALID_REFERENCE',
			'Blob reference size must be a non-negative safe integer.',
		);
	}
}

function toReference(row: ReferenceRow): BlobReference {
	if (!(BLOB_KINDS as readonly string[]).includes(row.kind)) {
		throw new BlobReferenceError('REFERENCE_CONFLICT', 'Catalog contains an invalid blob kind.');
	}
	return Object.freeze({
		id: row.reference_id,
		kind: row.kind as BlobKind,
		digest: row.digest,
		size: row.size,
		createdAt: row.created_at,
	});
}

export function getBlobReference(
	database: CatalogDatabase,
	referenceId: string,
): BlobReference | null {
	const row = database
		.query<ReferenceRow, [string]>(
			'SELECT reference_id, kind, digest, size, created_at FROM blob_references WHERE reference_id = ?',
		)
		.get(referenceId);
	return row ? toReference(row) : null;
}

export function createBlobReference(
	database: CatalogDatabase,
	store: ObjectStore,
	input: BlobReferenceInput,
): BlobReference {
	validate(input);
	try {
		store.verify(input.digest, input.size);
	} catch (error) {
		throw new BlobReferenceError(
			'OBJECT_NOT_VERIFIED',
			`Blob reference requires a verified object: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return database
		.transaction(() => {
			database
				.query<never, [string, number]>(
					'INSERT INTO blobs (digest, size) VALUES (?, ?) ON CONFLICT(digest) DO NOTHING',
				)
				.run(input.digest, input.size);
			const blob = database
				.query<BlobRow, [string]>('SELECT digest, size FROM blobs WHERE digest = ?')
				.get(input.digest);
			if (!blob || blob.size !== input.size) {
				throw new BlobReferenceError(
					'REFERENCE_CONFLICT',
					'Blob digest is already cataloged with conflicting metadata.',
				);
			}

			const existing = getBlobReference(database, input.id);
			if (existing) {
				if (
					existing.kind === input.kind &&
					existing.digest === input.digest &&
					existing.size === input.size
				)
					return existing;
				throw new BlobReferenceError(
					'REFERENCE_CONFLICT',
					`Blob reference ${input.id} conflicts with immutable catalog evidence.`,
				);
			}

			database
				.query<never, [string, BlobKind, string, number]>(
					'INSERT INTO blob_references (reference_id, kind, digest, size) VALUES (?, ?, ?, ?)',
				)
				.run(input.id, input.kind, input.digest, input.size);
			const inserted = getBlobReference(database, input.id);
			if (!inserted) {
				throw new BlobReferenceError(
					'REFERENCE_CONFLICT',
					'Blob reference insert was not durable.',
				);
			}
			return inserted;
		})
		.immediate();
}
