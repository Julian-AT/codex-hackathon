import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { type DoctorFsPort, type DoctorResult, inspectExecutableCandidates } from '../core/doctor';
import type { CommandExecution } from './main';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '../..');
const EXPECTED_MARKER = Object.freeze({
	schemaVersion: '1',
	productId: 'mlx-personal-coding-pipeline',
	packageName: 'mlx-personal-coding-pipeline',
	executable: 'mlx',
	entry: './src/cli.tsx',
});

export interface DoctorDependencies {
	readonly pathValue?: string;
	readonly delimiter?: string;
	readonly cwd?: string;
	readonly declaredEntry?: string;
	readonly markerPath?: string;
	readonly fs?: DoctorFsPort;
}

const NODE_DOCTOR_FS: DoctorFsPort = Object.freeze({
	lstat: async (file: string) => await lstat(file),
	stat: async (file: string) => await stat(file),
	realpath: async (file: string) => await realpath(file),
	readTextFile: async (file: string) => await readFile(file, 'utf8'),
});

function envelope(result: DoctorResult): CommandExecution {
	if (result.classification === 'owned') {
		return {
			envelope: {
				schemaVersion: '1',
				ok: true,
				command: 'doctor',
				status: 'owned',
				data: result,
				error: null,
			},
			exitCode: 0,
		};
	}
	return {
		envelope: {
			schemaVersion: '1',
			ok: false,
			command: 'doctor',
			status: result.classification,
			data: result,
			error: {
				code:
					result.classification === 'collision' ? 'EXECUTABLE_COLLISION' : 'EXECUTABLE_NOT_FOUND',
				message: result.reason,
				action: result.action,
			},
		},
		exitCode: result.classification === 'collision' ? 5 : 6,
	};
}

export async function runDoctor(dependencies: DoctorDependencies = {}): Promise<CommandExecution> {
	const result = await inspectExecutableCandidates(
		{
			pathValue: dependencies.pathValue ?? process.env.PATH ?? '',
			delimiter: dependencies.delimiter ?? path.delimiter,
			cwd: dependencies.cwd ?? process.cwd(),
			declaredEntry: dependencies.declaredEntry ?? path.join(PACKAGE_ROOT, 'src/cli.tsx'),
			markerPath: dependencies.markerPath ?? path.join(PACKAGE_ROOT, 'mlx.package.json'),
			expectedMarker: EXPECTED_MARKER,
		},
		dependencies.fs ?? NODE_DOCTOR_FS,
	);
	return envelope(result);
}
