import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ConfigError,
	type ResolvedConfig,
	formatConfig,
	getConfigValue,
	getProjectConfigPath,
	getUserConfigPath,
	loadConfig,
	setProjectConfig,
} from './config';

describe('loadConfig', () => {
	const savedEnv: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of ['MLX_HOME', 'MLX_SERVER_URL', 'LOCAL_MODEL', 'ADAPTER_DIR', 'IPHONE_UDID']) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const [key, val] of Object.entries(savedEnv)) {
			if (val === undefined) delete process.env[key];
			else process.env[key] = val;
		}
	});

	it('returns valid defaults when no config files exist', () => {
		const config = loadConfig();
		expect(config.model).toBe('unsloth/gemma-4-E4B-it-UD-MLX-4bit');
		expect(config.serverPort).toBe(8080);
		expect(config.training.iters).toBe(400);
		expect(config.training.mode).toBe('sft');
		expect(config.discovery.concurrency).toBe(15);
		expect(config.repl.autoStartServer).toBe(true);
	});

	it('applies MLX_SERVER_URL env override', () => {
		process.env.MLX_SERVER_URL = 'http://custom:9999/v1';
		const config = loadConfig();
		expect(config.serverUrl).toBe('http://custom:9999/v1');
	});

	it('applies LOCAL_MODEL env override', () => {
		process.env.LOCAL_MODEL = 'my-model';
		const config = loadConfig();
		expect(config.model).toBe('my-model');
	});

	it('applies ADAPTER_DIR env override', () => {
		process.env.ADAPTER_DIR = '/tmp/adapters';
		const config = loadConfig();
		expect(config.training.adapterDir).toBe('/tmp/adapters');
	});

	it('applies IPHONE_UDID env override', () => {
		process.env.IPHONE_UDID = 'abc-123';
		const config = loadConfig();
		expect(config.deploy.udid).toBe('abc-123');
	});
});

describe('getConfigValue', () => {
	const config = loadConfig() as ResolvedConfig;

	it('accesses top-level key', () => {
		expect(getConfigValue(config, 'model')).toBe(config.model);
	});

	it('accesses nested key', () => {
		expect(getConfigValue(config, 'training.iters')).toBe(config.training.iters);
	});

	it('returns undefined for missing path', () => {
		expect(getConfigValue(config, 'foo.bar.baz')).toBeUndefined();
	});

	it('accesses deeply nested key', () => {
		expect(getConfigValue(config, 'data.trajCounts.singleTurn')).toBe(200);
	});
});

describe('formatConfig', () => {
	it('produces readable flat output', () => {
		const config = loadConfig();
		const output = formatConfig(config);
		expect(output).toContain('model =');
		expect(output).toContain('serverPort =');
		expect(output).toContain('training.iters =');
		expect(output).toContain('repl.autoStartServer =');
	});
});

describe('getUserConfigPath', () => {
	it('returns the canonical config beneath the resolved MLX root', () => {
		const p = getUserConfigPath({ env: { MLX_HOME: '/tmp/MLX Δ' }, homedir: () => '/unused' });
		expect(p).toBe(path.join('/tmp/MLX Δ', 'config', 'config.json'));
		expect(getProjectConfigPath({ env: { MLX_HOME: '/tmp/MLX Δ' } })).toBe(p);
		expect(p).not.toContain('.codex');
	});

	it('fails actionably for an invalid root instead of resolving against cwd', () => {
		expect(() => getUserConfigPath({ env: { MLX_HOME: 'relative/root' } })).toThrowError(
			ConfigError,
		);
		try {
			getUserConfigPath({ env: { MLX_HOME: 'relative/root' } });
		} catch (error) {
			expect(error).toMatchObject({ code: 'INVALID_MLX_HOME' });
			expect((error as ConfigError).action).toContain('absolute path');
		}
	});
});

describe('canonical MLX configuration boundary', () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	function makeRoot(): string {
		const root = mkdtempSync(path.join(tmpdir(), 'mlx-config-'));
		roots.push(root);
		return root;
	}

	it('loads only MLX_HOME/config and never project or home .codex precedence', () => {
		const root = makeRoot();
		const legacy = path.join(root, '.codex');
		mkdirSync(legacy);
		writeFileSync(path.join(legacy, 'settings.json'), '{"model":"legacy/model"}\n');
		const configPath = path.join(root, 'config', 'config.json');
		mkdirSync(path.dirname(configPath));
		writeFileSync(configPath, '{"model":"mlx/model","training":{"iters":12}}\n');

		const config = loadConfig({ env: { MLX_HOME: root } });
		expect(config.model).toBe('mlx/model');
		expect(config.training.iters).toBe(12);
	});

	it('reports malformed and schema-invalid config instead of silently returning defaults', () => {
		for (const contents of ['{not-json\n', '{"serverPort":"wrong"}\n']) {
			const root = makeRoot();
			const configPath = path.join(root, 'config', 'config.json');
			mkdirSync(path.dirname(configPath));
			writeFileSync(configPath, contents);
			expect(() => loadConfig({ env: { MLX_HOME: root } })).toThrowError(ConfigError);
			expect(readFileSync(configPath, 'utf8')).toBe(contents);
		}
	});

	it('keeps writes explicit and confined to MLX_HOME/config', () => {
		const root = makeRoot();
		const previous = process.env.MLX_HOME;
		process.env.MLX_HOME = root;
		try {
			setProjectConfig('training.iters', 42);
		} finally {
			if (previous === undefined) process.env.MLX_HOME = undefined;
			else process.env.MLX_HOME = previous;
		}
		expect(
			JSON.parse(readFileSync(path.join(root, 'config', 'config.json'), 'utf8')),
		).toMatchObject({
			training: { iters: 42 },
		});
		expect(() => readFileSync(path.join(root, '.codex', 'settings.json'))).toThrow();
	});
});
