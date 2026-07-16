import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

function makeRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'mlx-foundation-'));
	roots.push(root);
	return root;
}

async function foundationModules() {
	const [config, contained, archive] = await Promise.all([
		import('../../src/lib/config'),
		import('../../src/core/contained-path').catch(() => ({})),
		import('../../src/core/archive-path').catch(() => ({})),
	]);
	return {
		config: config as Record<string, unknown>,
		contained: contained as Record<string, unknown>,
		archive: archive as Record<string, unknown>,
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('foundation configuration containment', () => {
	it('projects every mutable runtime path beneath one canonical root', async () => {
		const root = makeRoot();
		const modules = await foundationModules();
		expect(modules.config).toHaveProperty('loadRuntimeConfig');
		const loadRuntimeConfig = modules.config.loadRuntimeConfig as (input: unknown) => {
			readonly paths: Readonly<Record<string, string>>;
		};
		const runtime = loadRuntimeConfig({ env: { MLX_HOME: root } });

		expect(runtime.paths).toEqual({
			root,
			config: path.join(root, 'config', 'config.json'),
			catalog: path.join(root, 'catalog', 'mlx.sqlite3'),
			objects: path.join(root, 'objects'),
			runs: path.join(root, 'runs'),
			logs: path.join(root, 'logs'),
			mirrors: path.join(root, 'mirrors'),
			worktrees: path.join(root, 'worktrees'),
			datasets: path.join(root, 'datasets'),
			models: path.join(root, 'models'),
			cache: path.join(root, 'cache'),
			parquet: path.join(root, 'parquet'),
		});
		for (const value of Object.values(runtime.paths)) {
			expect(value === root || value.startsWith(`${root}${path.sep}`)).toBe(true);
		}
	});

	it('rejects malformed configuration and hostile configured paths without writes', async () => {
		const root = makeRoot();
		const outside = makeRoot();
		const configDir = path.join(root, 'config');
		mkdirSync(configDir);
		const configPath = path.join(configDir, 'config.json');
		const modules = await foundationModules();
		const loadRuntimeConfig = modules.config.loadRuntimeConfig as (input: unknown) => unknown;

		for (const [field, value] of [
			['unknownField', true],
			['paths', { objects: '../outside' }],
			['paths', { objects: outside }],
		] as const) {
			writeFileSync(configPath, `${JSON.stringify({ [field]: value })}\n`);
			expect(() => loadRuntimeConfig({ env: { MLX_HOME: root } })).toThrow(
				field === 'paths' ? 'paths.objects' : 'unknownField',
			);
			expect(readFileSync(configPath, 'utf8')).toBe(`${JSON.stringify({ [field]: value })}\n`);
		}

		const link = path.join(root, 'escape');
		symlinkSync(outside, link);
		writeFileSync(configPath, `${JSON.stringify({ paths: { objects: 'escape/objects' } })}\n`);
		expect(() => loadRuntimeConfig({ env: { MLX_HOME: root } })).toThrow('paths.objects');
		expect(() => readFileSync(path.join(outside, 'objects'))).toThrow();
	});

	it('rejects unsafe archive members and link targets before extraction', async () => {
		const modules = await foundationModules();
		expect(modules.archive).toHaveProperty('validateArchiveEntry');
		const validate = modules.archive.validateArchiveEntry as (
			name: string,
			linkTarget?: string,
		) => { readonly ok: boolean };
		for (const name of ['/etc/passwd', '../escape', 'a/../../escape', 'C:\\escape', '\\\\host\\share', 'bad\0name']) {
			expect(validate(name).ok, name).toBe(false);
		}
		expect(validate('safe/file.txt').ok).toBe(true);
		expect(validate('safe/link', '../../escape').ok).toBe(false);
		expect(validate('safe/link', 'sibling.txt').ok).toBe(true);
	});
});
