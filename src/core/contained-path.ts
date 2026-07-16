import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

export type ContainedPathFailureCode =
	| 'INVALID_ROOT'
	| 'ABSOLUTE_PATH'
	| 'TRAVERSAL'
	| 'SYMLINK'
	| 'OUTSIDE_ROOT'
	| 'INSPECTION_FAILED';

export type ContainedPathResult =
	| { readonly ok: true; readonly path: string; readonly root: string }
	| {
			readonly ok: false;
			readonly code: ContainedPathFailureCode;
			readonly field: string;
			readonly input: string;
			readonly reason: string;
	  };

export interface ContainedPathFileSystem {
	readonly lstat: typeof lstatSync;
	readonly realpath: typeof realpathSync;
}

export interface ResolveContainedPathInput {
	readonly root: string;
	readonly relativePath: string;
	readonly field: string;
	readonly fs?: ContainedPathFileSystem;
}

const defaultFileSystem: ContainedPathFileSystem = {
	lstat: lstatSync,
	realpath: realpathSync,
};

function isInside(root: string, candidate: string): boolean {
	return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function failure(
	code: ContainedPathFailureCode,
	field: string,
	input: string,
	reason: string,
): ContainedPathResult {
	return { ok: false, code, field, input, reason };
}

export function resolveContainedPath({
	root,
	relativePath,
	field,
	fs = defaultFileSystem,
}: ResolveContainedPathInput): ContainedPathResult {
	if (!path.isAbsolute(root)) {
		return failure('INVALID_ROOT', field, root, `${field} root must be absolute`);
	}
	if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
		return failure('ABSOLUTE_PATH', field, relativePath, `${field} must be relative to MLX_HOME`);
	}
	if (relativePath.includes('\0')) {
		return failure('TRAVERSAL', field, relativePath, `${field} contains a NUL byte`);
	}
	const segments = relativePath.split(/[\\/]+/);
	if (segments.some((segment) => segment === '..')) {
		return failure('TRAVERSAL', field, relativePath, `${field} contains a parent traversal segment`);
	}
	const normalizedSegments = segments.filter((segment) => segment !== '' && segment !== '.');
	const lexicalCandidate = path.join(root, ...normalizedSegments);
	if (!isInside(path.normalize(root), lexicalCandidate)) {
		return failure('OUTSIDE_ROOT', field, relativePath, `${field} resolves outside MLX_HOME`);
	}

	let canonicalRoot: string;
	try {
		const rootStat = fs.lstat(root);
		if (rootStat.isSymbolicLink()) {
			return failure('SYMLINK', field, root, `${field} root must not be a symbolic link`);
		}
		canonicalRoot = fs.realpath(root);
	} catch (error) {
		return failure(
			'INVALID_ROOT',
			field,
			root,
			`${field} root could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const candidate = path.join(canonicalRoot, ...normalizedSegments);
	let current = root;
	for (const segment of normalizedSegments) {
		current = path.join(current, segment);
		try {
			const stat = fs.lstat(current);
			if (stat.isSymbolicLink()) {
				return failure('SYMLINK', field, relativePath, `${field} crosses symbolic link "${current}"`);
			}
			const canonicalCurrent = fs.realpath(current);
			if (!isInside(canonicalRoot, canonicalCurrent)) {
				return failure('OUTSIDE_ROOT', field, relativePath, `${field} resolves outside MLX_HOME`);
			}
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				(error as { readonly code?: unknown }).code === 'ENOENT'
			) {
				break;
			}
			return failure(
				'INSPECTION_FAILED',
				field,
				relativePath,
				`${field} could not inspect "${current}": ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return { ok: true, path: candidate, root: canonicalRoot };
}
