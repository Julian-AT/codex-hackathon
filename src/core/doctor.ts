import type { Stats } from 'node:fs';
import path from 'node:path';

export interface PackageOwnershipMarker {
	readonly schemaVersion: string;
	readonly productId: string;
	readonly packageName: string;
	readonly executable: string;
	readonly entry: string;
}

export interface DoctorFsPort {
	readonly lstat: (path: string) => Promise<Pick<Stats, 'mode' | 'isFile' | 'isSymbolicLink'>>;
	readonly stat: (path: string) => Promise<Pick<Stats, 'mode' | 'isFile' | 'isSymbolicLink'>>;
	readonly realpath: (path: string) => Promise<string>;
	readonly readTextFile: (path: string) => Promise<string>;
}

export interface InspectExecutableCandidatesInput {
	readonly pathValue: string;
	readonly delimiter: string;
	readonly cwd: string;
	readonly declaredEntry: string;
	readonly markerPath: string;
	readonly expectedMarker: PackageOwnershipMarker;
}

export type CandidateInspection = 'complete' | 'failed';
export type CandidateOwnership = 'owned' | 'collision';
export type DoctorClassification = 'owned' | 'collision' | 'not-found';

export interface ExecutableCandidate {
	readonly path: string;
	readonly pathEntry: string;
	readonly pathIndex: number;
	readonly realpath: string | null;
	readonly executable: boolean;
	readonly inspection: CandidateInspection;
	readonly ownership: CandidateOwnership;
	readonly errors: readonly string[];
}

export interface DoctorResult {
	readonly classification: DoctorClassification;
	readonly code: 'MLX_EXECUTABLE_OWNED' | 'MLX_EXECUTABLE_COLLISION' | 'MLX_EXECUTABLE_NOT_FOUND';
	readonly candidates: readonly ExecutableCandidate[];
	readonly effective: ExecutableCandidate | null;
	readonly shadowed: readonly ExecutableCandidate[];
	readonly reason: string;
	readonly action: string;
}

const COLLISION_REASON =
	'PATH resolves mlx to an executable that is not owned by this installation.';
const COLLISION_ACTION =
	'Resolve the PATH conflict manually, then run mlx doctor again. No files or shell settings were changed.';
const NOT_FOUND_REASON = 'No mlx executable found in PATH.';
const NOT_FOUND_ACTION =
	'Install or link this package as mlx, then run mlx doctor again. No files or shell settings were changed.';
const OWNED_REASON = 'PATH resolves mlx to the executable owned by this installation.';
const OWNED_ACTION = 'No files or shell settings were changed.';

function errorCode(error: unknown): string | null {
	if (typeof error !== 'object' || error === null || !('code' in error)) return null;
	return typeof error.code === 'string' ? error.code : null;
}

function inspectionError(operation: string, error: unknown): string {
	const code = errorCode(error);
	const message = error instanceof Error ? error.message : String(error);
	return `${operation}${code ? ` ${code}` : ''}: ${message}`;
}

function isAbsent(error: unknown): boolean {
	const code = errorCode(error);
	return code === 'ENOENT' || code === 'ENOTDIR';
}

function candidatePath(input: InspectExecutableCandidatesInput, entry: string): string {
	const directory = entry.length === 0 ? input.cwd : path.resolve(input.cwd, entry);
	return path.join(directory, 'mlx');
}

function markerMatches(value: unknown, expected: PackageOwnershipMarker): boolean {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();
	const expectedKeys = Object.keys(expected).sort();
	return (
		JSON.stringify(keys) === JSON.stringify(expectedKeys) &&
		expectedKeys.every((key) => record[key] === expected[key as keyof PackageOwnershipMarker])
	);
}

async function inspectMarker(
	input: InspectExecutableCandidatesInput,
	fs: DoctorFsPort,
): Promise<{ readonly valid: boolean; readonly error: string | null }> {
	try {
		const parsed: unknown = JSON.parse(await fs.readTextFile(input.markerPath));
		return markerMatches(parsed, input.expectedMarker)
			? { valid: true, error: null }
			: { valid: false, error: 'marker mismatch: packaged ownership evidence is invalid' };
	} catch (error) {
		return { valid: false, error: inspectionError('marker read', error) };
	}
}

export async function inspectExecutableCandidates(
	input: InspectExecutableCandidatesInput,
	fs: DoctorFsPort,
): Promise<DoctorResult> {
	let declaredEntryRealpath: Promise<string | null> | null = null;
	let markerInspection: Promise<{ readonly valid: boolean; readonly error: string | null }> | null =
		null;
	const resolveDeclaredEntry = async (): Promise<string | null> => {
		declaredEntryRealpath ??= fs.realpath(input.declaredEntry).catch(() => null);
		return await declaredEntryRealpath;
	};
	const resolveMarker = async (): Promise<{
		readonly valid: boolean;
		readonly error: string | null;
	}> => {
		markerInspection ??= inspectMarker(input, fs);
		return await markerInspection;
	};

	const candidates: ExecutableCandidate[] = [];
	const entries = input.pathValue.split(input.delimiter);
	for (let pathIndex = 0; pathIndex < entries.length; pathIndex += 1) {
		const pathEntry = entries[pathIndex] ?? '';
		const exactPath = candidatePath(input, pathEntry);
		try {
			await fs.lstat(exactPath);
		} catch (error) {
			if (isAbsent(error)) continue;
			candidates.push({
				path: exactPath,
				pathEntry,
				pathIndex,
				realpath: null,
				executable: false,
				inspection: 'failed',
				ownership: 'collision',
				errors: [inspectionError('lstat', error)],
			});
			continue;
		}

		const errors: string[] = [];
		let executable = false;
		let resolvedPath: string | null = null;
		try {
			const metadata = await fs.stat(exactPath);
			executable = metadata.isFile() && (metadata.mode & 0o111) !== 0;
			if (!metadata.isFile()) errors.push('stat: candidate is not a regular file');
			else if (!executable) errors.push('stat: candidate is not executable');
		} catch (error) {
			errors.push(inspectionError('stat', error));
		}
		try {
			resolvedPath = await fs.realpath(exactPath);
		} catch (error) {
			errors.push(inspectionError('realpath', error));
		}

		let owned = false;
		if (executable && resolvedPath !== null && resolvedPath === (await resolveDeclaredEntry())) {
			const ownershipMarker = await resolveMarker();
			owned = ownershipMarker.valid;
			if (ownershipMarker.error) errors.push(ownershipMarker.error);
		}
		candidates.push({
			path: exactPath,
			pathEntry,
			pathIndex,
			realpath: resolvedPath,
			executable,
			inspection: errors.length === 0 ? 'complete' : 'failed',
			ownership: owned ? 'owned' : 'collision',
			errors,
		});
	}

	const effective = candidates[0] ?? null;
	const shadowed = candidates.slice(1);
	if (effective === null) {
		return {
			classification: 'not-found',
			code: 'MLX_EXECUTABLE_NOT_FOUND',
			candidates,
			effective,
			shadowed,
			reason: NOT_FOUND_REASON,
			action: NOT_FOUND_ACTION,
		};
	}
	if (effective.ownership === 'owned' && effective.inspection === 'complete') {
		return {
			classification: 'owned',
			code: 'MLX_EXECUTABLE_OWNED',
			candidates,
			effective,
			shadowed,
			reason: OWNED_REASON,
			action: OWNED_ACTION,
		};
	}
	return {
		classification: 'collision',
		code: 'MLX_EXECUTABLE_COLLISION',
		candidates,
		effective,
		shadowed,
		reason: COLLISION_REASON,
		action: COLLISION_ACTION,
	};
}
