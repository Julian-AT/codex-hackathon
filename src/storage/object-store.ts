import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type AtomicFileHooks, publishImmutableFile } from './atomic-file';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export interface StoredObject {
	readonly digest: string;
	readonly size: number;
	readonly path: string;
}

export class ObjectStoreError extends Error {
	constructor(
		readonly code:
			| 'INVALID_ROOT'
			| 'INVALID_DIGEST'
			| 'UNSAFE_OBJECT_PATH'
			| 'MISSING_OBJECT'
			| 'CORRUPT_OBJECT',
		message: string,
	) {
		super(message);
		this.name = 'ObjectStoreError';
	}
}

function errorCode(error: unknown): string | null {
	return typeof error === 'object' && error !== null && 'code' in error
		? String((error as { readonly code: unknown }).code)
		: null;
}

function assertDirectory(directory: string): void {
	const stats = lstatSync(directory);
	if (stats.isSymbolicLink() || !stats.isDirectory()) {
		throw new ObjectStoreError(
			'UNSAFE_OBJECT_PATH',
			`Object path component is a symlink or not a directory: ${directory}`,
		);
	}
}

function ensureDirectory(directory: string): void {
	const parsed = path.parse(directory);
	let current = parsed.root;
	for (const component of directory.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
		current = path.join(current, component);
		try {
			mkdirSync(current, { mode: 0o700 });
		} catch (error) {
			if (errorCode(error) !== 'EEXIST') throw error;
		}
		assertDirectory(current);
	}
}

function inspectDirectory(directory: string): void {
	const parsed = path.parse(directory);
	let current = parsed.root;
	for (const component of directory.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
		current = path.join(current, component);
		try {
			assertDirectory(current);
		} catch (error) {
			if (errorCode(error) === 'ENOENT') {
				throw new ObjectStoreError('MISSING_OBJECT', 'Verified object directory is absent.');
			}
			throw error;
		}
	}
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export class ObjectStore {
	readonly #root: string;
	readonly #hooks: AtomicFileHooks;

	constructor(root: string, hooks: AtomicFileHooks = {}) {
		if (!path.isAbsolute(root)) {
			throw new ObjectStoreError('INVALID_ROOT', 'Object store root must be absolute.');
		}
		this.#root = path.normalize(root);
		this.#hooks = hooks;
	}

	pathForDigest(digest: string): string {
		if (!DIGEST_PATTERN.test(digest)) {
			throw new ObjectStoreError('INVALID_DIGEST', 'Object digest must be lowercase SHA-256.');
		}
		return path.join(this.#root, 'sha256', digest.slice(0, 2), digest);
	}

	put(input: Uint8Array): StoredObject {
		const bytes = Buffer.from(input);
		const digest = sha256(bytes);
		const objectPath = this.pathForDigest(digest);
		const directory = path.dirname(objectPath);
		ensureDirectory(directory);
		publishImmutableFile(directory, digest, bytes, this.#hooks);
		this.verify(digest, bytes.byteLength);
		return Object.freeze({ digest, size: bytes.byteLength, path: objectPath });
	}

	openVerified(digest: string): Buffer {
		const objectPath = this.pathForDigest(digest);
		inspectDirectory(path.dirname(objectPath));
		let stats: ReturnType<typeof lstatSync>;
		try {
			stats = lstatSync(objectPath);
		} catch (error) {
			if (errorCode(error) === 'ENOENT') {
				throw new ObjectStoreError('MISSING_OBJECT', `Verified object ${digest} is absent.`);
			}
			throw error;
		}
		if (stats.isSymbolicLink() || !stats.isFile()) {
			throw new ObjectStoreError(
				'UNSAFE_OBJECT_PATH',
				`Object ${digest} is a symlink or not a regular file.`,
			);
		}
		const bytes = readFileSync(objectPath);
		if (sha256(bytes) !== digest) {
			throw new ObjectStoreError('CORRUPT_OBJECT', `Object ${digest} failed digest verification.`);
		}
		return bytes;
	}

	verify(digest: string, expectedSize?: number): StoredObject {
		const bytes = this.openVerified(digest);
		if (expectedSize !== undefined && bytes.byteLength !== expectedSize) {
			throw new ObjectStoreError('CORRUPT_OBJECT', `Object ${digest} failed size verification.`);
		}
		return Object.freeze({
			digest,
			size: bytes.byteLength,
			path: this.pathForDigest(digest),
		});
	}
}
