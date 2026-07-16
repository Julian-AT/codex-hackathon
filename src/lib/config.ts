import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { resolveContainedPath } from '../core/contained-path';
import { resolveMlxHome } from '../core/mlx-home';

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

const ConfigSchema = strictObject({
	model: z.string().default('unsloth/gemma-4-E4B-it-UD-MLX-4bit'),
	serverPort: z.number().default(8080),
	serverUrl: z.string().optional(),
	training: strictObject({
		iters: z.number().default(400),
		mode: z.enum(['sft', 'grpo']).default('sft'),
		adapterDir: z.string().default('models/adapters'),
	}).default({}),
	discovery: strictObject({ concurrency: z.number().default(15) }).default({}),
	data: strictObject({
		concurrency: z.number().default(15),
		trajCounts: strictObject({
			singleTurn: z.number().default(200),
			multiTurn: z.number().default(100),
			parallelDep: z.number().default(50),
			refusal: z.number().default(50),
		}).default({}),
	}).default({}),
	eval: strictObject({ limit: z.number().optional() }).default({}),
	deploy: strictObject({ udid: z.string().optional(), appGroup: z.string().optional() }).default({}),
	repl: strictObject({
		historySize: z.number().default(100),
		maxVisibleMessages: z.number().default(50),
		autoStartServer: z.boolean().default(true),
	}).default({}),
	paths: strictObject({
		catalog: z.string().default('catalog/mlx.sqlite3'),
		objects: z.string().default('objects'),
		runs: z.string().default('runs'),
		logs: z.string().default('logs'),
		mirrors: z.string().default('mirrors'),
		worktrees: z.string().default('worktrees'),
		datasets: z.string().default('datasets'),
		models: z.string().default('models'),
		cache: z.string().default('cache'),
		parquet: z.string().default('parquet'),
	}).default({}),
});

export type Config = z.input<typeof ConfigSchema>;
export type ResolvedConfig = z.output<typeof ConfigSchema>;

export interface RuntimePaths {
	readonly root: string;
	readonly config: string;
	readonly catalog: string;
	readonly objects: string;
	readonly runs: string;
	readonly logs: string;
	readonly mirrors: string;
	readonly worktrees: string;
	readonly datasets: string;
	readonly models: string;
	readonly cache: string;
	readonly parquet: string;
}

export interface RuntimeConfig {
	readonly config: ResolvedConfig;
	readonly paths: RuntimePaths;
}

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
		if (typeof error === 'object' && error !== null && 'code' in error && (error as { readonly code?: unknown }).code === 'ENOENT') return {};
		throw new ConfigError(
			'INVALID_CONFIG',
			`MLX configuration at "${filePath}" could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
			'Correct or remove the named configuration file, then retry.',
		);
	}
}

function deepMerge(target: Record<string, unknown>, ...sources: Record<string, unknown>[]): Record<string, unknown> {
	const result = { ...target };
	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			if (value === undefined) continue;
			if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
				result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
			} else result[key] = value;
		}
	}
	return result;
}

function extractEnvOverrides(env: Readonly<Record<string, string | undefined>>): Record<string, unknown> {
	const overrides: Record<string, unknown> = {};
	if (env.MLX_SERVER_URL) overrides.serverUrl = env.MLX_SERVER_URL;
	if (env.LOCAL_MODEL) overrides.model = env.LOCAL_MODEL;
	if (env.ADAPTER_DIR) overrides.training = { adapterDir: env.ADAPTER_DIR };
	if (env.IPHONE_UDID) overrides.deploy = { udid: env.IPHONE_UDID };
	return overrides;
}

function resolveRoot(dependencies: ConfigDependencies): string {
	const resolved = resolveMlxHome({ env: dependencies.env ?? process.env, homedir: dependencies.homedir ?? homedir });
	if (!resolved.ok) throw new ConfigError('INVALID_MLX_HOME', resolved.reason, resolved.action);
	return resolved.root;
}

function contained(root: string, relativePath: string, field: string): string {
	const resolved = resolveContainedPath({ root, relativePath, field });
	if (!resolved.ok) {
		throw new ConfigError(
			'INVALID_CONFIG',
			`MLX configuration field "${field}" rejected path "${resolved.input}": ${resolved.reason}`,
			`Choose a relative, non-symlinked destination beneath MLX_HOME for ${field}.`,
		);
	}
	return resolved.path;
}

function describeZodError(error: z.ZodError): string {
	return error.issues.map((issue) => {
		const keys = 'keys' in issue && issue.keys.length > 0 ? issue.keys.join(', ') : undefined;
		const field = issue.path.length > 0 ? issue.path.join('.') : keys ?? '<root>';
		return `${field}: ${issue.message}`;
	}).join('; ');
}

export function getUserConfigPath(dependencies: ConfigDependencies = {}): string {
	return join(resolveRoot(dependencies), 'config', 'config.json');
}

export function getProjectConfigPath(dependencies: ConfigDependencies = {}): string {
	return getUserConfigPath(dependencies);
}

export function loadRuntimeConfig(dependencies: ConfigDependencies = {}): RuntimeConfig {
	const env = dependencies.env ?? process.env;
	const root = resolveRoot({ ...dependencies, env });
	const configPath = contained(root, 'config/config.json', 'paths.config');
	const raw = readConfigJson(configPath);
	let parsed: ResolvedConfig;
	try {
		parsed = ConfigSchema.parse(deepMerge(raw, extractEnvOverrides(env)));
	} catch (error) {
		throw new ConfigError(
			'INVALID_CONFIG',
			`MLX configuration at "${configPath}" is invalid: ${error instanceof z.ZodError ? describeZodError(error) : error instanceof Error ? error.message : String(error)}`,
			'Correct the named fields using the documented MLX configuration schema, then retry.',
		);
	}
	const pathEntries = Object.entries(parsed.paths).map(([field, value]) => [field, contained(root, value, `paths.${field}`)]);
	const canonicalRoot = contained(root, '', 'paths.root');
	const paths = Object.freeze({ root: canonicalRoot, config: configPath, ...Object.fromEntries(pathEntries) }) as unknown as RuntimePaths;
	const config = Object.freeze({
		...parsed,
		training: Object.freeze({ ...parsed.training, adapterDir: contained(root, parsed.training.adapterDir, 'training.adapterDir') }),
		paths: Object.freeze({ ...parsed.paths }),
	});
	return Object.freeze({ config, paths });
}

export function loadConfig(dependencies: ConfigDependencies = {}): ResolvedConfig {
	return loadRuntimeConfig(dependencies).config;
}

export function getConfigValue(config: ResolvedConfig, dotPath: string): unknown {
	let current: unknown = config;
	for (const part of dotPath.split('.')) {
		if (current === null || current === undefined || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function setProjectConfig(dotPath: string, value: unknown): void {
	const root = resolveRoot({});
	const configPath = contained(root, 'config/config.json', 'paths.config');
	const existing = readConfigJson(configPath);
	const parts = dotPath.split('.');
	let current = existing;
	for (let index = 0; index < parts.length - 1; index++) {
		const part = parts[index];
		if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) current[part] = {};
		current = current[part] as Record<string, unknown>;
	}
	const lastKey = parts.at(-1);
	if (!lastKey) throw new ConfigError('INVALID_CONFIG', 'Configuration field path must not be empty.', 'Provide a named configuration field.');
	if (value === undefined) delete current[lastKey];
	else current[lastKey] = value;
	// Validate before any write so unknown/wrong fields cannot corrupt production configuration.
	try {
		ConfigSchema.parse(existing);
	} catch (error) {
		throw new ConfigError('INVALID_CONFIG', `MLX configuration field "${dotPath}" is invalid: ${error instanceof z.ZodError ? describeZodError(error) : String(error)}`, 'Provide a value matching the documented MLX configuration schema.');
	}
	mkdirSync(dirname(configPath), { recursive: true });
	const temporaryPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
	try {
		writeFileSync(temporaryPath, `${JSON.stringify(existing, null, '\t')}\n`, { flag: 'wx' });
		renameSync(temporaryPath, configPath);
	} finally {
		rmSync(temporaryPath, { force: true });
	}
}

export function formatConfig(config: ResolvedConfig): string {
	const lines: string[] = [];
	function walk(object: Record<string, unknown>, prefix: string): void {
		for (const [key, value] of Object.entries(object)) {
			const field = prefix ? `${prefix}.${key}` : key;
			if (value !== null && typeof value === 'object' && !Array.isArray(value)) walk(value as Record<string, unknown>, field);
			else lines.push(`  ${field} = ${JSON.stringify(value)}`);
		}
	}
	walk(config as unknown as Record<string, unknown>, '');
	return lines.join('\n');
}
