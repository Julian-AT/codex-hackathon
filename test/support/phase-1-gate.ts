import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Phase1GateMode = 'expect-red' | 'verify';

export type Phase1GateCommand = readonly [executable: string, ...args: string[]];

export interface Phase1GateDefinition {
	readonly id: string;
	readonly mode: Phase1GateMode;
	readonly commands: readonly Phase1GateCommand[];
}

export interface Phase1GateCommandResult {
	readonly command: readonly string[];
	readonly exitCode: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly spawnError: string | null;
	readonly outputTruncated: boolean;
}

export interface Phase1GateReport {
	readonly schemaVersion: '1';
	readonly ok: boolean;
	readonly mode: Phase1GateMode | null;
	readonly gateId: string | null;
	readonly commands: readonly Phase1GateCommandResult[];
	readonly error: { readonly code: string; readonly message: string } | null;
}

const EXPECTED_GATE_IDS = [
	'cli-contract',
	'identity-package',
	'state-init',
	'doctor',
	'migration-inventory',
	'validation-results',
	'validation-runtime',
	'validation-host',
	'validation-integration',
	'validation-acceptance',
] as const;

const REGISTRY_SOURCE = [
	{
		id: 'cli-contract',
		mode: 'expect-red',
		commands: [
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/cli-contract.test.ts',
			],
		],
	},
	{
		id: 'identity-package',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/identity/audit.test.ts'],
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/package-bin.test.ts',
			],
		],
	},
	{
		id: 'state-init',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/cli/command-tree.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/core/mlx-home.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/core/state-ownership.test.ts'],
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/state-cli.test.ts',
			],
		],
	},
	{
		id: 'doctor',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/core/doctor.test.ts'],
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/doctor-cli.test.ts',
			],
		],
	},
	{
		id: 'migration-inventory',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/migration/inventory-schema.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/migration/repository-scanner.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/migration/removal-gate.test.ts'],
		],
	},
	{
		id: 'validation-results',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/validation/result.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/validation/capabilities.test.ts'],
		],
	},
	{
		id: 'validation-runtime',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/validation/runner.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/validation/report.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/validation/cli.test.ts'],
		],
	},
	{
		id: 'validation-host',
		mode: 'expect-red',
		commands: [
			['bun', 'x', 'vitest', 'run', 'src/validation/process-adapter.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/validation/host-capability.test.ts'],
			['bun', 'x', 'vitest', 'run', 'src/validation/process-entry.test.ts'],
		],
	},
	{
		id: 'validation-integration',
		mode: 'expect-red',
		commands: [
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/validation-scripts.test.ts',
			],
			[
				'bun',
				'x',
				'vitest',
				'run',
				'--config',
				'vitest.integration.config.ts',
				'test/integration/privacy-boundaries.test.ts',
			],
		],
	},
	{
		id: 'validation-acceptance',
		mode: 'verify',
		commands: [
			['bun', 'run', 'check'],
			['bun', 'run', 'typecheck'],
			['bun', 'run', 'test'],
			['bun', 'run', 'test:integration'],
			['bun', 'run', 'studio:build'],
			['bun', 'run', 'dataset:validate'],
			['bun', 'run', 'benchmark:smoke'],
			['bun', 'run', 'local:check'],
		],
	},
] as const satisfies readonly Phase1GateDefinition[];

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function validateRegistry(registry: readonly Phase1GateDefinition[]): void {
	const ids = registry.map(({ id }) => id);
	if (registry.length !== EXPECTED_GATE_IDS.length || new Set(ids).size !== ids.length) {
		throw new Error('Phase 1 gate registry must contain exactly ten unique IDs.');
	}
	if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_GATE_IDS)) {
		throw new Error('Phase 1 gate registry IDs or order changed.');
	}
	for (const definition of registry) {
		if (definition.commands.length === 0) {
			throw new Error(`Phase 1 gate ${definition.id} has no commands.`);
		}
		for (const command of definition.commands) {
			if (command.length === 0 || command.some((token) => token.length === 0)) {
				throw new Error(`Phase 1 gate ${definition.id} has an invalid command mapping.`);
			}
		}
	}
	if (registry.filter(({ mode }) => mode === 'expect-red').length !== 9) {
		throw new Error('Phase 1 gate registry must contain exactly nine expect-red gates.');
	}
	if (
		registry.filter(({ mode }) => mode === 'verify').length !== 1 ||
		registry.at(-1)?.id !== 'validation-acceptance'
	) {
		throw new Error('validation-acceptance must be the sole verify gate.');
	}
}

validateRegistry(REGISTRY_SOURCE);
export const PHASE_1_GATE_REGISTRY = deepFreeze(REGISTRY_SOURCE);
const REGISTRY_FINGERPRINT = JSON.stringify(PHASE_1_GATE_REGISTRY);

export function assertPhase1GateRegistryIntegrity(): void {
	validateRegistry(PHASE_1_GATE_REGISTRY);
	if (JSON.stringify(PHASE_1_GATE_REGISTRY) !== REGISTRY_FINGERPRINT) {
		throw new Error('Phase 1 gate registry mutation detected.');
	}
	if (!Object.isFrozen(PHASE_1_GATE_REGISTRY)) {
		throw new Error('Phase 1 gate registry is not immutable.');
	}
}

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

async function executeCommand(command: Phase1GateCommand): Promise<Phase1GateCommandResult> {
	return await new Promise((resolveResult) => {
		let stdout = '';
		let stderr = '';
		let outputTruncated = false;
		let spawnError: string | null = null;
		let settled = false;

		const child = spawn(command[0], command.slice(1), {
			cwd: resolve(import.meta.dirname, '../..'),
			env: {
				...process.env,
				CI: '1',
				FORCE_COLOR: '0',
				NO_COLOR: '1',
			},
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		const append = (current: string, chunk: Buffer): string => {
			const next = current + chunk.toString('utf8');
			if (Buffer.byteLength(next) <= MAX_OUTPUT_BYTES) return next;
			outputTruncated = true;
			child.kill('SIGKILL');
			return Buffer.from(next).subarray(0, MAX_OUTPUT_BYTES).toString('utf8');
		};

		child.stdout.on('data', (chunk: Buffer) => {
			stdout = append(stdout, chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr = append(stderr, chunk);
		});
		child.on('error', (error) => {
			spawnError = error.message;
		});
		child.on('close', (exitCode, signal) => {
			if (settled) return;
			settled = true;
			resolveResult({
				command: [...command],
				exitCode,
				signal,
				stdout,
				stderr,
				spawnError,
				outputTruncated,
			});
		});
	});
}

function stripAnsi(value: string): string {
	return value.replaceAll(String.fromCharCode(27), '');
}

const INFRASTRUCTURE_FAILURES: readonly [label: string, pattern: RegExp][] = [
	['no tests', /No test files found|Tests\s+no tests|no tests/i],
	['failed suite setup', /Failed Suites|failed to (?:load|collect)|setup file/i],
	[
		'import failure',
		/Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND|failed to resolve import/i,
	],
	['syntax or transform failure', /SyntaxError|Transform failed|\bParse failure\b/i],
	['fixture failure', /\b(?:ENOENT|EACCES)\b|fixture (?:setup|load|missing).*fail/i],
	['unhandled runtime error', /Unhandled Error|Unhandled Rejection/i],
];

function redFailureReason(result: Phase1GateCommandResult): string | null {
	if (result.spawnError) return `spawn failed: ${result.spawnError}`;
	if (result.outputTruncated) return 'test output exceeded the bounded capture limit';
	if (result.signal) return `test process ended by signal ${result.signal}`;
	if (result.exitCode === 0) return 'RED suite passed unexpectedly';
	const output = stripAnsi(`${result.stdout}\n${result.stderr}`);
	for (const [label, pattern] of INFRASTRUCTURE_FAILURES) {
		if (pattern.test(output)) return label;
	}
	const failedTests = output.match(/Tests\s+(\d+)\s+failed/i);
	if (!failedTests || Number(failedTests[1]) < 1) return 'no failed-test summary was collected';
	if (!/AssertionError|expect(?:ed|\()|assertion/i.test(output)) {
		return 'failure was not a collected behavior assertion';
	}
	return null;
}

function verifyFailureReasons(results: readonly Phase1GateCommandResult[]): string[] {
	const reasons: string[] = [];
	for (const [index, result] of results.entries()) {
		if (result.spawnError || result.outputTruncated || result.signal) {
			reasons.push(`command ${index + 1} did not complete normally`);
		}
	}
	for (const index of [0, 1, 2, 3]) {
		if (results[index]?.exitCode !== 0) reasons.push(`portable command ${index + 1} did not pass`);
	}
	const productGates = [
		{ index: 4, ownerPhase: 8 },
		{ index: 5, ownerPhase: 5 },
		{ index: 6, ownerPhase: 6 },
	] as const;
	for (const { index, ownerPhase } of productGates) {
		const result = results[index];
		const output = stripAnsi(`${result?.stdout ?? ''}\n${result?.stderr ?? ''}`);
		if (result?.exitCode === 0) reasons.push(`product gate ${index + 1} passed unexpectedly`);
		if (!/\bFAIL\b/.test(output) || !/\bLIVE\b/.test(output)) {
			reasons.push(`product gate ${index + 1} lacks an explicit LIVE FAIL result`);
		}
		if (!new RegExp(`phase\\D{0,12}${ownerPhase}\\b`, 'i').test(output)) {
			reasons.push(`product gate ${index + 1} does not name owning Phase ${ownerPhase}`);
		}
	}
	const local = results[7];
	const localOutput = stripAnsi(`${local?.stdout ?? ''}\n${local?.stderr ?? ''}`);
	if (local?.exitCode !== 0) reasons.push('local:check did not complete with a valid result');
	if (!/\bLIVE\b/.test(localOutput)) reasons.push('local:check lacks LIVE source classification');
	const localPass = /\bPASS\b/.test(localOutput);
	const localSkip =
		/\bSKIP\b/.test(localOutput) &&
		/apple-silicon/i.test(localOutput) &&
		/unavailable/i.test(localOutput);
	if (!localPass && !localSkip) {
		reasons.push('local:check is neither LIVE PASS nor named apple-silicon capability SKIP');
	}
	if (/missing implementation/i.test(localOutput) && /\bSKIP\b/.test(localOutput)) {
		reasons.push('local:check treated missing implementation as SKIP');
	}
	return reasons;
}

function reportFailure(
	mode: Phase1GateMode | null,
	gateId: string | null,
	code: string,
	message: string,
	commands: readonly Phase1GateCommandResult[] = [],
): Phase1GateReport {
	return { schemaVersion: '1', ok: false, mode, gateId, commands, error: { code, message } };
}

export async function runPhase1Gate(argv: readonly string[]): Promise<Phase1GateReport> {
	assertPhase1GateRegistryIntegrity();
	if (argv.length !== 2) {
		return reportFailure(
			null,
			null,
			'INVALID_INVOCATION',
			'Expected exactly: <expect-red|verify> <registered-gate-id>.',
		);
	}
	const [modeToken, gateId] = argv;
	if (modeToken !== 'expect-red' && modeToken !== 'verify') {
		return reportFailure(null, gateId, 'INVALID_MODE', `Unknown gate mode: ${modeToken}.`);
	}
	const definition = PHASE_1_GATE_REGISTRY.find(({ id }) => id === gateId);
	if (!definition) {
		return reportFailure(modeToken, gateId, 'UNKNOWN_GATE', `Unknown Phase 1 gate: ${gateId}.`);
	}
	if (definition.mode !== modeToken) {
		return reportFailure(
			modeToken,
			gateId,
			'MODE_MISMATCH',
			`Gate ${gateId} requires mode ${definition.mode}.`,
		);
	}

	const commands: Phase1GateCommandResult[] = [];
	for (const command of definition.commands) commands.push(await executeCommand(command));

	const failures =
		modeToken === 'expect-red'
			? commands.map(redFailureReason).filter((reason): reason is string => reason !== null)
			: verifyFailureReasons(commands);
	if (failures.length > 0) {
		return reportFailure(modeToken, gateId, 'GATE_REJECTED', failures.join('; '), commands);
	}
	return { schemaVersion: '1', ok: true, mode: modeToken, gateId, commands, error: null };
}

async function main(): Promise<void> {
	const report = await runPhase1Gate(process.argv.slice(2));
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	process.exitCode = report.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
	main().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		const report = reportFailure(null, null, 'INTERNAL_GATE_ERROR', message);
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		process.exitCode = 1;
	});
}
