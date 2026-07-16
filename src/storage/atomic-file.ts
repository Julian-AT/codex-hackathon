import { randomUUID } from 'node:crypto';
import {
	constants,
	closeSync,
	fsyncSync,
	linkSync,
	lstatSync,
	openSync,
	unlinkSync,
	writeSync,
} from 'node:fs';
import path from 'node:path';

export interface AtomicFileHooks {
	/** Test-only interruption seam after durable temp bytes and before publication. */
	readonly afterFileSync?: () => void;
}

export type AtomicPublishResult = 'published' | 'existing';

export class AtomicFileError extends Error {
	constructor(
		readonly code: 'UNSAFE_DIRECTORY' | 'UNSAFE_NAME' | 'UNSAFE_EXISTING_OBJECT',
		message: string,
	) {
		super(message);
		this.name = 'AtomicFileError';
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
		throw new AtomicFileError(
			'UNSAFE_DIRECTORY',
			`Atomic destination is not a safe regular directory: ${directory}`,
		);
	}
}

function assertExistingRegularFile(filePath: string): void {
	const stats = lstatSync(filePath);
	if (stats.isSymbolicLink() || !stats.isFile()) {
		throw new AtomicFileError(
			'UNSAFE_EXISTING_OBJECT',
			`Existing immutable object is not a safe regular file: ${filePath}`,
		);
	}
}

function syncDirectory(directory: string): void {
	const descriptor = openSync(directory, constants.O_RDONLY);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

export function publishImmutableFile(
	directory: string,
	name: string,
	bytes: Uint8Array,
	hooks: AtomicFileHooks = {},
): AtomicPublishResult {
	assertDirectory(directory);
	if (name.length === 0 || path.basename(name) !== name || name === '.' || name === '..') {
		throw new AtomicFileError('UNSAFE_NAME', 'Immutable object name must be one path component.');
	}

	const destination = path.join(directory, name);
	const tempName = `.mlx-tmp-${process.pid}-${randomUUID()}`;
	const tempPath = path.join(directory, tempName);
	let descriptor: number | null = null;
	let tempExists = false;
	let result: AtomicPublishResult | null = null;
	let failure: unknown;
	try {
		descriptor = openSync(
			tempPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600,
		);
		tempExists = true;
		let offset = 0;
		while (offset < bytes.byteLength) {
			offset += writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
		}
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = null;
		hooks.afterFileSync?.();

		try {
			linkSync(tempPath, destination);
		} catch (error) {
			if (errorCode(error) !== 'EEXIST') throw error;
			assertExistingRegularFile(destination);
			result = 'existing';
		}
		if (result === null) {
			assertExistingRegularFile(destination);
			syncDirectory(directory);
			result = 'published';
		}
	} catch (error) {
		failure = error;
	} finally {
		if (descriptor !== null) closeSync(descriptor);
		if (tempExists) {
			try {
				unlinkSync(tempPath);
				syncDirectory(directory);
			} catch (error) {
				if (errorCode(error) !== 'ENOENT' && failure === undefined) failure = error;
			}
		}
	}
	if (failure !== undefined) throw failure;
	if (result === null) throw new Error('Atomic publication completed without a result.');
	return result;
}
