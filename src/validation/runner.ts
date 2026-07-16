import { type CapabilityEvidence, normalizeCapabilityEvidence } from './capabilities';
import { CHECK_CATALOG, type CheckDescriptor, getCheckDescriptor } from './check-catalog';
import {
	type ValidationAggregate,
	type ValidationResult,
	aggregateValidationResults,
	normalizeValidationResult,
} from './result';

export interface ProcessRequest {
	readonly executable: string;
	readonly args: readonly string[];
	readonly shell: false;
	readonly maxOutputBytes: number;
	readonly timeoutMs: number;
}

export interface ProcessResult {
	readonly exitCode: number | null;
	readonly signal?: string | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly error?: string;
	readonly timedOut?: boolean;
	readonly interrupted?: boolean;
}

export interface CheckRunnerPort {
	run(request: ProcessRequest): Promise<ProcessResult>;
}

export interface ValidationRunnerDependencies {
	readonly process: CheckRunnerPort;
	readonly probeCapability: (capabilityId: string) => Promise<CapabilityEvidence>;
	readonly runExternal?: (descriptor: CheckDescriptor) => Promise<unknown>;
	readonly maxOutputBytes?: number;
	readonly timeoutMs?: number;
}

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const TRUNCATION_MARKER = '[truncated]';
const MAX_REASON_BYTES = 990;

interface BoundedText {
	readonly value: string;
	readonly truncated: boolean;
}

function boundText(value: string, maxBytes: number): BoundedText {
	const bytes = Buffer.from(value, 'utf8');
	if (bytes.length <= maxBytes) return { value, truncated: false };
	return {
		value: `${bytes.subarray(0, maxBytes).toString('utf8')}${TRUNCATION_MARKER}`,
		truncated: true,
	};
}

function boundedReason(reason: string): string {
	const bytes = Buffer.from(reason, 'utf8');
	if (bytes.length <= MAX_REASON_BYTES) return reason;
	return `${bytes.subarray(0, MAX_REASON_BYTES - TRUNCATION_MARKER.length).toString('utf8')}${TRUNCATION_MARKER}`;
}

function processReason(result: ProcessResult, timeoutMs: number, maxOutputBytes: number): string {
	const stdout = boundText(result.stdout, maxOutputBytes);
	const stderr = boundText(result.stderr, maxOutputBytes);
	let outcome: string;

	if (result.interrupted) {
		outcome = `Validation check was interrupted${result.signal ? ` by ${result.signal}` : ''}.`;
	} else if (result.timedOut) {
		outcome = `Process timed out after ${timeoutMs}ms.`;
	} else if (result.error) {
		outcome = `Process failed to start: ${result.error}.`;
	} else if (result.exitCode === 0) {
		outcome = 'Process exited with code 0.';
	} else if (result.exitCode === null) {
		outcome = `Process ended without an exit code${result.signal ? ` (${result.signal})` : ''}.`;
	} else {
		outcome = `Process exited with code ${result.exitCode}.`;
	}

	const evidence = [
		stdout.value.length > 0 ? `stdout="${stdout.value}"` : '',
		stderr.value.length > 0 ? `stderr="${stderr.value}"` : '',
	].filter(Boolean);
	return boundedReason(`${outcome}${evidence.length > 0 ? ` ${evidence.join(' ')}` : ''}`);
}

function fail(
	descriptor: CheckDescriptor,
	reason: string,
	capability?: CapabilityEvidence,
): ValidationResult {
	return normalizeValidationResult({
		checkId: descriptor.checkId,
		status: 'FAIL',
		source: descriptor.source,
		reason: boundedReason(reason),
		...(capability ? { capability } : {}),
	});
}

function isCanonicalDescriptor(descriptor: CheckDescriptor): boolean {
	return getCheckDescriptor(descriptor.checkId) === descriptor;
}

function normalizeDescriptorResult(descriptor: CheckDescriptor, input: unknown): ValidationResult {
	const normalized = normalizeValidationResult(input);
	if (normalized.checkId !== descriptor.checkId) {
		return fail(
			descriptor,
			`Adapter returned result for ${normalized.checkId}; expected ${descriptor.checkId}.`,
		);
	}
	if (normalized.source !== descriptor.source) {
		return fail(
			descriptor,
			`Adapter returned ${normalized.source} evidence; ${descriptor.checkId} requires ${descriptor.source}.`,
		);
	}
	return normalized;
}

async function runFixedProcess(
	descriptor: CheckDescriptor,
	dependencies: ValidationRunnerDependencies,
): Promise<ValidationResult> {
	if (descriptor.execution.kind !== 'fixed-process') {
		return fail(descriptor, 'Descriptor is not a fixed process check.');
	}
	const maxOutputBytes = dependencies.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
	const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1) {
		return fail(descriptor, 'Process output bound must be a positive integer.');
	}
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
		return fail(descriptor, 'Process timeout must be a positive integer.');
	}

	const request: ProcessRequest = Object.freeze({
		executable: descriptor.execution.executable,
		args: Object.freeze([...descriptor.execution.args]),
		shell: false,
		maxOutputBytes,
		timeoutMs,
	});

	let processResult: ProcessResult;
	try {
		processResult = await dependencies.process.run(request);
	} catch (error) {
		return fail(
			descriptor,
			`Process failed to start: ${error instanceof Error ? error.message : String(error)}.`,
		);
	}
	const status =
		processResult.exitCode === 0 &&
		!processResult.error &&
		!processResult.timedOut &&
		!processResult.interrupted
			? 'PASS'
			: 'FAIL';
	return normalizeValidationResult({
		checkId: descriptor.checkId,
		status,
		source: descriptor.source,
		reason: processReason(processResult, timeoutMs, maxOutputBytes),
	});
}

async function runCapabilityGate(
	descriptor: CheckDescriptor,
	dependencies: ValidationRunnerDependencies,
): Promise<ValidationResult> {
	if (descriptor.execution.kind !== 'capability-gate') {
		return fail(descriptor, 'Descriptor is not a capability gate.');
	}
	let rawEvidence: unknown;
	try {
		rawEvidence = await dependencies.probeCapability(descriptor.execution.capabilityId);
	} catch (error) {
		return fail(
			descriptor,
			`Capability probe failed: ${error instanceof Error ? error.message : String(error)}.`,
		);
	}
	const capability = normalizeCapabilityEvidence(rawEvidence);
	if (!capability || capability.id !== descriptor.execution.capabilityId) {
		return fail(
			descriptor,
			`Capability probe must return named evidence for ${descriptor.execution.capabilityId}.`,
		);
	}
	return normalizeValidationResult({
		checkId: descriptor.checkId,
		status: capability.available
			? descriptor.execution.availableStatus
			: descriptor.execution.unavailableStatus,
		source: descriptor.source,
		reason: capability.reason,
		capability,
	});
}

export async function runValidationCheck(
	descriptor: CheckDescriptor,
	dependencies: ValidationRunnerDependencies,
): Promise<ValidationResult> {
	if (!isCanonicalDescriptor(descriptor)) {
		return fail(descriptor, 'Validation descriptor is not a canonical catalog entry.');
	}

	switch (descriptor.execution.kind) {
		case 'fixed-process':
			return await runFixedProcess(descriptor, dependencies);
		case 'external-harness': {
			if (!dependencies.runExternal) {
				return fail(descriptor, 'An external descriptor adapter is required for test:integration.');
			}
			try {
				return normalizeDescriptorResult(descriptor, await dependencies.runExternal(descriptor));
			} catch (error) {
				return fail(
					descriptor,
					`External descriptor adapter failed: ${error instanceof Error ? error.message : String(error)}.`,
				);
			}
		}
		case 'product-gate':
			return fail(descriptor, descriptor.execution.reason);
		case 'capability-gate':
			return await runCapabilityGate(descriptor, dependencies);
	}
}

export async function runValidationBaseline(
	dependencies: ValidationRunnerDependencies,
	descriptors: readonly CheckDescriptor[] = CHECK_CATALOG,
): Promise<ValidationAggregate> {
	const results: ValidationResult[] = [];
	for (const descriptor of descriptors) {
		results.push(await runValidationCheck(descriptor, dependencies));
	}
	return aggregateValidationResults(results);
}
