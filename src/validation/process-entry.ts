import { type CheckDescriptor, getCheckDescriptor } from './check-catalog';
import { VALIDATION_EXIT_CODES, type ValidationCliIo, runValidationCli } from './cli';
import { type HostCapabilityProbe, createHostCapabilityProbe } from './host-capability';
import { createBunCheckRunner } from './process-adapter';
import { type ValidationResult, normalizeValidationResult } from './result';
import {
	type CheckRunnerPort,
	type ProcessRequest,
	type ProcessResult,
	runValidationCheck,
} from './runner';

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_INTERNAL_OUTPUT_BYTES = 1_000;

export interface ValidationProcessEntryDependencies {
	readonly createRunner: () => CheckRunnerPort;
	readonly createProbe: () => HostCapabilityProbe;
	readonly write: (value: string) => void;
	readonly setExitCode: (value: number) => void;
	readonly columns: number;
	readonly isTTY: boolean;
}

export function createValidationProcessDependencies(
	overrides: Partial<ValidationProcessEntryDependencies> = {},
): ValidationProcessEntryDependencies {
	return Object.freeze({
		createRunner: overrides.createRunner ?? (() => createBunCheckRunner()),
		createProbe: overrides.createProbe ?? (() => createHostCapabilityProbe()),
		write: overrides.write ?? ((value: string) => process.stdout.write(value)),
		setExitCode:
			overrides.setExitCode ??
			((value: number) => {
				process.exitCode = value;
			}),
		columns: overrides.columns ?? process.stdout.columns ?? 80,
		isTTY: overrides.isTTY ?? Boolean(process.stdout.isTTY),
	});
}

interface ParsedInvocation {
	readonly kind: 'run' | 'external';
	readonly checkId: string;
	readonly json: boolean;
}

function parseInvocation(argv: readonly string[]): ParsedInvocation | null {
	const jsonIndexes = argv.flatMap((token, index) => (token === '--json' ? [index] : []));
	if (jsonIndexes.length > 1) return null;
	if (jsonIndexes.length === 1 && jsonIndexes[0] !== argv.length - 1) return null;
	const tokens = argv.filter((token) => token !== '--json');
	if (tokens.length !== 2) return null;
	const [kind, checkId] = tokens;
	if (kind !== 'run' && kind !== 'external') return null;
	const descriptor = getCheckDescriptor(checkId ?? '');
	if (!descriptor) return null;
	if (kind === 'external') {
		if (
			descriptor.checkId !== 'test:integration' ||
			descriptor.execution.kind !== 'external-harness'
		) {
			return null;
		}
	} else if (descriptor.execution.kind === 'external-harness') {
		return null;
	}
	return { kind, checkId: descriptor.checkId, json: jsonIndexes.length === 1 };
}

function invalidOutput(json: boolean): string {
	if (!json) {
		return 'Invalid validation invocation. Expected run <check-id> or external test:integration.\n';
	}
	return `${JSON.stringify({
		schemaVersion: '1',
		ok: false,
		command: 'validation',
		status: 'invalid',
		data: null,
		error: {
			code: 'INVALID_INVOCATION',
			message: 'Expected run <check-id> or external test:integration.',
		},
	})}\n`;
}

function internalFailureOutput(json: boolean): string {
	if (!json) return 'Validation process failed with a bounded internal error.\n';
	return `${JSON.stringify({
		schemaVersion: '1',
		ok: false,
		command: 'validation',
		status: 'FAIL',
		data: null,
		error: {
			code: 'VALIDATION_INTERNAL_ERROR',
			message: 'Validation process failed with a bounded internal error.',
		},
	})}\n`;
}

function boundReason(value: string): string {
	const bytes = Buffer.from(value, 'utf8');
	if (bytes.length <= MAX_INTERNAL_OUTPUT_BYTES) return value;
	return `${bytes.subarray(0, MAX_INTERNAL_OUTPUT_BYTES - 12).toString('utf8')}[truncated]`;
}

function externalReason(result: ProcessResult): string {
	let outcome: string;
	if (result.interrupted) outcome = 'Direct integration Vitest was interrupted.';
	else if (result.timedOut) outcome = 'Direct integration Vitest timed out.';
	else if (result.error) outcome = `Direct integration Vitest failed to start: ${result.error}.`;
	else if (result.exitCode === 0) outcome = 'Direct integration Vitest exited with code 0.';
	else if (result.exitCode === null)
		outcome = 'Direct integration Vitest ended without an exit code.';
	else outcome = `Direct integration Vitest exited with code ${result.exitCode}.`;
	const evidence = [
		result.stdout ? `stdout="${result.stdout}"` : '',
		result.stderr ? `stderr="${result.stderr}"` : '',
	].filter(Boolean);
	return boundReason(`${outcome}${evidence.length > 0 ? ` ${evidence.join(' ')}` : ''}`);
}

async function runExternalDescriptor(
	descriptor: CheckDescriptor,
	runner: CheckRunnerPort,
): Promise<ValidationResult> {
	if (
		descriptor.checkId !== 'test:integration' ||
		descriptor.execution.kind !== 'external-harness'
	) {
		return normalizeValidationResult({
			checkId: descriptor.checkId,
			status: 'FAIL',
			source: descriptor.source,
			reason: 'Only the canonical test:integration external descriptor is permitted.',
		});
	}
	const request: ProcessRequest = Object.freeze({
		executable: descriptor.execution.executable,
		args: Object.freeze([...descriptor.execution.args]),
		shell: false,
		maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
		timeoutMs: DEFAULT_TIMEOUT_MS,
	});
	let result: ProcessResult;
	try {
		result = await runner.run(request);
	} catch {
		return normalizeValidationResult({
			checkId: descriptor.checkId,
			status: 'FAIL',
			source: descriptor.source,
			reason: 'Direct integration Vitest adapter failed.',
		});
	}
	const passed = result.exitCode === 0 && !result.error && !result.timedOut && !result.interrupted;
	return normalizeValidationResult({
		checkId: descriptor.checkId,
		status: passed ? 'PASS' : 'FAIL',
		source: descriptor.source,
		reason: externalReason(result),
	});
}

export async function runValidationProcessEntry(
	argv: readonly string[],
	overrides: Partial<ValidationProcessEntryDependencies> = {},
): Promise<void> {
	const dependencies = createValidationProcessDependencies(overrides);
	const parsed = parseInvocation(argv);
	if (!parsed) {
		dependencies.write(invalidOutput(argv.includes('--json')));
		dependencies.setExitCode(VALIDATION_EXIT_CODES.INVALID);
		return;
	}

	let output = '';
	let exitCode: number = VALIDATION_EXIT_CODES.FAIL;
	try {
		const runner = dependencies.createRunner();
		const probe = dependencies.createProbe();
		const bufferedIo: ValidationCliIo = {
			columns: dependencies.columns,
			isTTY: dependencies.isTTY,
			writeStdout: (value) => {
				output += value;
			},
			writeStderr: (value) => {
				output += value;
			},
		};
		const descriptor = getCheckDescriptor(parsed.checkId);
		if (!descriptor) throw new Error('Canonical descriptor disappeared after parsing.');
		const cliArgv = ['run', descriptor.checkId, ...(parsed.json ? ['--json'] : [])];
		exitCode = await runValidationCli(cliArgv, bufferedIo, {
			getCheckDescriptor,
			runCheck: async (selected) =>
				parsed.kind === 'external'
					? await runExternalDescriptor(selected, runner)
					: await runValidationCheck(selected, {
							process: runner,
							probeCapability: probe,
						}),
			runBaseline: async () => {
				throw new Error('The executable validation entry does not expose baseline mode.');
			},
		});
	} catch {
		output = internalFailureOutput(parsed.json);
		exitCode = VALIDATION_EXIT_CODES.FAIL;
	}

	dependencies.write(output || internalFailureOutput(parsed.json));
	dependencies.setExitCode(exitCode);
}

if ((import.meta as ImportMeta & { readonly main?: boolean }).main) {
	await runValidationProcessEntry(process.argv.slice(2));
}
