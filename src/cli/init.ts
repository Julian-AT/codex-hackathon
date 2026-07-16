import { homedir } from 'node:os';
import { type ResolveMlxHomeInput, resolveMlxHome } from '../core/mlx-home';
import {
	type StateInitializationResult,
	type StateOwnershipFs,
	initializeStateRoot,
} from '../core/state-ownership';

export type InitResult =
	| StateInitializationResult
	| {
			readonly ok: false;
			readonly status: 'invalid-root';
			readonly root: null;
			readonly changed: false;
			readonly code: 'INVALID_MLX_HOME';
			readonly reason: string;
			readonly action: string;
	  };

export interface InitDependencies {
	readonly env?: ResolveMlxHomeInput['env'];
	readonly homedir?: () => string;
	readonly fs?: StateOwnershipFs;
}

export async function runInit(
	input: { readonly adopt: boolean },
	dependencies: InitDependencies = {},
): Promise<InitResult> {
	const resolved = resolveMlxHome({
		env: dependencies.env ?? process.env,
		homedir: dependencies.homedir ?? homedir,
	});
	if (!resolved.ok) {
		return {
			ok: false,
			status: 'invalid-root',
			root: null,
			changed: false,
			code: resolved.code,
			reason: resolved.reason,
			action: resolved.action,
		};
	}
	return await initializeStateRoot({
		root: resolved.root,
		adopt: input.adopt,
		fs: dependencies.fs,
	});
}
