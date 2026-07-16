import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ResolverModule {
	resolveMlxHome(input: {
		readonly env: Readonly<Record<string, string | undefined>>;
		readonly homedir: () => string;
	}):
		| { readonly ok: true; readonly root: string; readonly source: 'default' | 'override' }
		| { readonly ok: false; readonly code: string; readonly input: string; readonly action: string };
}

async function loadResolver(): Promise<ResolverModule | null> {
	try {
		return (await import(/* @vite-ignore */ new URL('./mlx-home.ts', import.meta.url).href)) as ResolverModule;
	} catch {
		return null;
	}
}

describe('resolveMlxHome', () => {
	it.each([undefined, '', ' ', '\t\n'])('defaults an absent or blank override (%j)', async (value) => {
		const module = await loadResolver();
		expect(module, 'MLX_HOME resolver module exists').not.toBeNull();
		if (!module) return;
		expect(module.resolveMlxHome({ env: { MLX_HOME: value }, homedir: () => '/home/operator' })).toEqual({
			ok: true,
			root: path.join('/home/operator', '.mlx'),
			source: 'default',
		});
	});

	it.each(['relative/root', '~/.mlx', './state'])('rejects a non-absolute override without expanding it: %s', async (value) => {
		const module = await loadResolver();
		expect(module, 'MLX_HOME resolver module exists').not.toBeNull();
		if (!module) return;
		const result = module.resolveMlxHome({ env: { MLX_HOME: value }, homedir: () => '/unused' });
		expect(result).toMatchObject({ ok: false, code: 'INVALID_MLX_HOME', input: value });
		expect(result).toHaveProperty('action');
	});

	it.each(['/tmp/mlx root/../owned', '/tmp/MLX-Δ/./state'])('lexically normalizes absolute spaces and Unicode without filesystem access: %s', async (value) => {
		const module = await loadResolver();
		expect(module, 'MLX_HOME resolver module exists').not.toBeNull();
		if (!module) return;
		expect(module.resolveMlxHome({ env: { MLX_HOME: value }, homedir: () => '/unused' })).toEqual({
			ok: true,
			root: path.normalize(value),
			source: 'override',
		});
	});
});
