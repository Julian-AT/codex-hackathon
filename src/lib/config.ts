import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { resolveMlxHome } from '../core/mlx-home';

const ConfigSchema = z.object({
	model: z.string().default('unsloth/gemma-4-E4B-it-UD-MLX-4bit'),
	serverPort: z.number().default(8080),
	serverUrl: z.string().optional(),
	training: z
		.object({
			iters: z.number().default(400),
			mode: z.enum(['sft', 'grpo']).default('sft'),
			adapterDir: z.string().default('data/training/model-a-adapter'),
		})
		.default({}),
	discovery: z
		.object({
			concurrency: z.number().default(15),
		})
		.default({}),
	data: z
		.object({
			concurrency: z.number().default(15),
			trajCounts: z
				.object({
					singleTurn: z.number().default(200),
					multiTurn: z.number().default(100),
					parallelDep: z.number().default(50),
					refusal: z.number().default(50),
				})
				.default({}),
		})
		.default({}),
	eval: z
		.object({
			limit: z.number().optional(),
		})
		.default({}),
	deploy: z
		.object({
			udid: z.string().optional(),
			appGroup: z.string().optional(),
		})
		.default({}),
	repl: z
		.object({
			historySize: z.number().default(100),
			maxVisibleMessages: z.number().default(50),
			autoStartServer: z.boolean().default(true),
		})
		.default({}),
});

export type Config = z.input<typeof ConfigSchema>;
export type ResolvedConfig = z.output<typeof ConfigSchema>;

export class ConfigError extends Error {
	constructor(
		readonly code: 'INVALID_MLX_HOME' | 'INVALID_CONFIG',
		message: string,
		readonly action: string,
	) {
		super(message);
		this.name = 'ConfigError';
	}
}

export interface ConfigDependencies {
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly homedir?: () => string;
}

function readConfigJson(filePath: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('the top-level JSON value must be an object');
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			(error as { readonly code?: unknown }).code === 'ENOENT'
		) {
			return {};
		}
		throw new ConfigError(
			'INVALID_CONFIG',
			`MLX configuration at "${filePath}" could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
			'Correct or remove the named configuration file, then retry.',
		);
	}
}

function deepMerge(
	target: Record<string, unknown>,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	const result = { ...target };
	for (const source of sources) {
		for (const key of Object.keys(source)) {
			const val = source[key];
			if (val === undefined) continue;
			if (
				val !== null &&
				typeof val === 'object' &&
				!Array.isArray(val) &&
				typeof result[key] === 'object' &&
				result[key] !== null &&
				!Array.isArray(result[key])
			) {
				result[key] = deepMerge(
					result[key] as Record<string, unknown>,
					val as Record<string, unknown>,
				);
			} else {
				result[key] = val;
			}
		}
	}
	return result;
}

function extractEnvOverrides(
	env: Readonly<Record<string, string | undefined>>,
): Record<string, unknown> {
	const overrides: Record<string, unknown> = {};
	if (env.MLX_SERVER_URL) overrides.serverUrl = env.MLX_SERVER_URL;
	if (env.LOCAL_MODEL) overrides.model = env.LOCAL_MODEL;
	if (env.ADAPTER_DIR) {
		overrides.training = { adapterDir: env.ADAPTER_DIR };
	}
	if (env.IPHONE_UDID) {
		overrides.deploy = { udid: env.IPHONE_UDID };
	}
	return overrides;
}

export function getUserConfigPath(dependencies: ConfigDependencies = {}): string {
	const resolved = resolveMlxHome({
		env: dependencies.env ?? process.env,
		homedir: dependencies.homedir ?? homedir,
	});
	if (!resolved.ok) {
		throw new ConfigError('INVALID_MLX_HOME', resolved.reason, resolved.action);
	}
	return join(resolved.root, 'config', 'config.json');
}

export function getProjectConfigPath(dependencies: ConfigDependencies = {}): string {
	return getUserConfigPath(dependencies);
}

export function loadConfig(dependencies: ConfigDependencies = {}): ResolvedConfig {
	const env = dependencies.env ?? process.env;
	const configPath = getUserConfigPath({ ...dependencies, env });
	const raw = readConfigJson(configPath);
	const merged = deepMerge(raw, extractEnvOverrides(env));
	try {
		return ConfigSchema.parse(merged);
	} catch (error) {
		throw new ConfigError(
			'INVALID_CONFIG',
			`MLX configuration at "${configPath}" is invalid: ${error instanceof Error ? error.message : String(error)}`,
			'Correct the named fields using the documented MLX configuration schema, then retry.',
		);
	}
}

export function getConfigValue(config: ResolvedConfig, dotPath: string): unknown {
	const parts = dotPath.split('.');
	let current: unknown = config;
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function setProjectConfig(dotPath: string, value: unknown): void {
	const configPath = getProjectConfigPath();
	const existing = readConfigJson(configPath);

	const parts = dotPath.split('.');
	let current = existing;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (typeof current[part] !== 'object' || current[part] === null) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	const lastKey = parts[parts.length - 1];
	if (value === undefined) {
		delete current[lastKey];
	} else {
		current[lastKey] = value;
	}

	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, `${JSON.stringify(existing, null, '\t')}\n`);
}

export function formatConfig(config: ResolvedConfig): string {
	const lines: string[] = [];

	function walk(obj: Record<string, unknown>, prefix: string) {
		for (const [key, val] of Object.entries(obj)) {
			const path = prefix ? `${prefix}.${key}` : key;
			if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
				walk(val as Record<string, unknown>, path);
			} else {
				lines.push(`  ${path} = ${JSON.stringify(val)}`);
			}
		}
	}

	walk(config as unknown as Record<string, unknown>, '');
	return lines.join('\n');
}
