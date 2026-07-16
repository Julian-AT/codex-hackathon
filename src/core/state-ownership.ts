import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const STATE_OWNERSHIP_FILENAME = '.mlx-state-owner.json';

const StateOwnershipManifestSchema = z
	.object({
		schemaVersion: z.literal('1'),
		product: z.literal('mlx-personal-coding-pipeline'),
		stateRootVersion: z.literal(1),
	})
	.strict();

export type StateOwnershipManifest = z.output<typeof StateOwnershipManifestSchema>;

const OWNERSHIP_MANIFEST: StateOwnershipManifest = Object.freeze({
	schemaVersion: '1',
	product: 'mlx-personal-coding-pipeline',
	stateRootVersion: 1,
});

interface StateOwnershipStat {
	isDirectory(): boolean;
	isFile(): boolean;
	isSymbolicLink(): boolean;
}

export interface StateOwnershipFs {
	lstat(filePath: string): Promise<StateOwnershipStat>;
	mkdir(directoryPath: string, options: { readonly recursive: true }): Promise<unknown>;
	readFile(filePath: string, encoding: 'utf8'): Promise<string>;
	writeFile(
		filePath: string,
		contents: string,
		options: { readonly encoding: 'utf8'; readonly flag: 'wx'; readonly mode: number },
	): Promise<void>;
}

const NODE_FS: StateOwnershipFs = { lstat, mkdir, readFile, writeFile };

export type StateRootStatus =
	| { readonly status: 'missing'; readonly root: string }
	| { readonly status: 'owned'; readonly root: string; readonly manifest: StateOwnershipManifest }
	| { readonly status: 'unowned'; readonly root: string }
	| { readonly status: 'unsafe'; readonly root: string; readonly reason: string };

export type StateInitializationResult =
	| {
			readonly ok: true;
			readonly status: 'initialized' | 'owned' | 'adopted';
			readonly root: string;
			readonly changed: boolean;
			readonly manifest: StateOwnershipManifest;
	  }
	| {
			readonly ok: false;
			readonly status: 'unowned' | 'unsafe';
			readonly root: string;
			readonly changed: false;
			readonly reason: string;
			readonly action: string;
	  };

interface InspectStateRootInput {
	readonly root: string;
	readonly fs?: StateOwnershipFs;
}

interface InitializeStateRootInput extends InspectStateRootInput {
	readonly adopt: boolean;
}

function isErrorCode(error: unknown, code: string): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { readonly code?: unknown }).code === code
	);
}

async function lstatOrMissing(
	fs: StateOwnershipFs,
	filePath: string,
): Promise<StateOwnershipStat | null> {
	try {
		return await fs.lstat(filePath);
	} catch (error) {
		if (isErrorCode(error, 'ENOENT')) return null;
		throw error;
	}
}

export async function inspectStateRoot({
	root,
	fs = NODE_FS,
}: InspectStateRootInput): Promise<StateRootStatus> {
	const rootStat = await lstatOrMissing(fs, root);
	if (!rootStat) return { status: 'missing', root };
	if (rootStat.isSymbolicLink()) {
		return { status: 'unsafe', root, reason: 'The state root is a symbolic link.' };
	}
	if (!rootStat.isDirectory()) {
		return { status: 'unsafe', root, reason: 'The state root exists but is not a directory.' };
	}

	const markerPath = path.join(root, STATE_OWNERSHIP_FILENAME);
	const markerStat = await lstatOrMissing(fs, markerPath);
	if (!markerStat) return { status: 'unowned', root };
	if (markerStat.isSymbolicLink()) {
		return { status: 'unsafe', root, reason: 'The state ownership marker is a symbolic link.' };
	}
	if (!markerStat.isFile()) {
		return { status: 'unsafe', root, reason: 'The state ownership marker is not a regular file.' };
	}

	let raw: string;
	try {
		raw = await fs.readFile(markerPath, 'utf8');
	} catch (error) {
		return {
			status: 'unsafe',
			root,
			reason: `The state ownership marker could not be read: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { status: 'unsafe', root, reason: 'The state ownership marker is malformed JSON.' };
	}
	const validated = StateOwnershipManifestSchema.safeParse(parsed);
	if (!validated.success) {
		return {
			status: 'unsafe',
			root,
			reason: 'The state ownership marker does not identify this MLX product and schema.',
		};
	}
	return { status: 'owned', root, manifest: validated.data };
}

function markerContents(): string {
	return `${JSON.stringify(OWNERSHIP_MANIFEST, null, 2)}\n`;
}

async function writeMarker(
	root: string,
	fs: StateOwnershipFs,
	status: 'initialized' | 'adopted',
): Promise<StateInitializationResult> {
	const markerPath = path.join(root, STATE_OWNERSHIP_FILENAME);
	try {
		await fs.writeFile(markerPath, markerContents(), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
		return { ok: true, status, root, changed: true, manifest: OWNERSHIP_MANIFEST };
	} catch (error) {
		if (isErrorCode(error, 'EEXIST')) {
			const concurrent = await inspectStateRoot({ root, fs });
			if (concurrent.status === 'owned') {
				return {
					ok: true,
					status: 'owned',
					root,
					changed: false,
					manifest: concurrent.manifest,
				};
			}
			return {
				ok: false,
				status: 'unsafe',
				root,
				changed: false,
				reason: 'The state ownership marker changed concurrently and is not owned by MLX.',
				action: 'Inspect the named root and retry only after resolving the conflicting owner.',
			};
		}
		return {
			ok: false,
			status: 'unsafe',
			root,
			changed: false,
			reason: `The ownership marker could not be created: ${error instanceof Error ? error.message : String(error)}`,
			action: 'Verify permissions for the named root, then retry mlx init.',
		};
	}
}

export async function initializeStateRoot({
	root,
	adopt,
	fs = NODE_FS,
}: InitializeStateRootInput): Promise<StateInitializationResult> {
	const inspected = await inspectStateRoot({ root, fs });
	if (inspected.status === 'owned') {
		return {
			ok: true,
			status: 'owned',
			root,
			changed: false,
			manifest: inspected.manifest,
		};
	}
	if (inspected.status === 'unsafe') {
		return {
			ok: false,
			status: 'unsafe',
			root,
			changed: false,
			reason: inspected.reason,
			action: 'Inspect the named root; MLX left it unchanged and will not adopt an unsafe marker.',
		};
	}
	if (inspected.status === 'unowned') {
		if (!adopt) {
			return {
				ok: false,
				status: 'unowned',
				root,
				changed: false,
				reason: 'The state root exists without an MLX ownership marker.',
				action:
					'Review the root, then run mlx init --adopt to record ownership without moving its contents.',
			};
		}
		return await writeMarker(root, fs, 'adopted');
	}

	try {
		await fs.mkdir(root, { recursive: true });
	} catch (error) {
		return {
			ok: false,
			status: 'unsafe',
			root,
			changed: false,
			reason: `The state root could not be created: ${error instanceof Error ? error.message : String(error)}`,
			action: 'Choose a writable absolute MLX_HOME and retry mlx init.',
		};
	}
	const createdRoot = await inspectStateRoot({ root, fs });
	if (createdRoot.status === 'owned') {
		return {
			ok: true,
			status: 'owned',
			root,
			changed: false,
			manifest: createdRoot.manifest,
		};
	}
	if (createdRoot.status !== 'unowned') {
		return {
			ok: false,
			status: 'unsafe',
			root,
			changed: false,
			reason:
				createdRoot.status === 'unsafe'
					? createdRoot.reason
					: 'The state root disappeared while it was being initialized.',
			action: 'Inspect the named root and retry after resolving concurrent changes.',
		};
	}
	return await writeMarker(root, fs, 'initialized');
}
