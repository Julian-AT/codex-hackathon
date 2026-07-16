import path from 'node:path';

export type MlxHomeResult =
	| {
			readonly ok: true;
			readonly root: string;
			readonly source: 'default' | 'override';
	  }
	| {
			readonly ok: false;
			readonly code: 'INVALID_MLX_HOME';
			readonly input: string;
			readonly reason: string;
			readonly action: string;
	  };

export interface ResolveMlxHomeInput {
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly homedir: () => string;
}

export function resolveMlxHome({ env, homedir }: ResolveMlxHomeInput): MlxHomeResult {
	const override = env.MLX_HOME;
	if (override === undefined || override.trim().length === 0) {
		return { ok: true, root: path.join(homedir(), '.mlx'), source: 'default' };
	}
	if (!path.isAbsolute(override)) {
		return {
			ok: false,
			code: 'INVALID_MLX_HOME',
			input: override,
			reason: 'MLX_HOME must be an absolute path and is never expanded or resolved implicitly.',
			action: 'Set MLX_HOME to an absolute path, or unset it to use the default home directory.',
		};
	}
	return { ok: true, root: path.normalize(override), source: 'override' };
}
