import type { EvidenceSource } from './result';

export const VALIDATION_SCRIPT_NAMES = [
	'check',
	'typecheck',
	'test',
	'test:integration',
	'studio:build',
	'dataset:validate',
	'benchmark:smoke',
	'local:check',
] as const;

export type ValidationScriptName = (typeof VALIDATION_SCRIPT_NAMES)[number];

interface CheckDescriptorBase {
	readonly scriptName: ValidationScriptName;
	readonly checkId: ValidationScriptName;
	readonly source: EvidenceSource;
}

interface FixedProcessExecution {
	readonly kind: 'fixed-process';
	readonly executable: 'bun';
	readonly args: readonly string[];
}

interface ExternalHarnessExecution {
	readonly kind: 'external-harness';
	readonly policy: 'external-only';
	readonly stubId: 'integration-suite-self';
	readonly executable: 'bun';
	readonly args: readonly string[];
}

interface ProductGateExecution {
	readonly kind: 'product-gate';
	readonly ownerPhase: 5 | 6 | 8;
	readonly status: 'FAIL';
	readonly reason: string;
}

interface CapabilityGateExecution {
	readonly kind: 'capability-gate';
	readonly capabilityId: 'apple-silicon';
	readonly availableStatus: 'PASS';
	readonly unavailableStatus: 'SKIP';
}

export type CheckExecution =
	| FixedProcessExecution
	| ExternalHarnessExecution
	| ProductGateExecution
	| CapabilityGateExecution;

export type CheckDescriptor = Readonly<
	CheckDescriptorBase & { readonly execution: CheckExecution }
>;

function fixedProcess(args: readonly string[]): FixedProcessExecution {
	return Object.freeze({
		kind: 'fixed-process',
		executable: 'bun',
		args: Object.freeze([...args]),
	});
}

function externalHarness(args: readonly string[]): ExternalHarnessExecution {
	return Object.freeze({
		kind: 'external-harness',
		policy: 'external-only',
		stubId: 'integration-suite-self',
		executable: 'bun',
		args: Object.freeze([...args]),
	});
}

function productGate(ownerPhase: 5 | 6 | 8, product: string): ProductGateExecution {
	return Object.freeze({
		kind: 'product-gate',
		ownerPhase,
		status: 'FAIL',
		reason: `${product} is not implemented; owned by Phase ${ownerPhase}.`,
	});
}

const CATALOG_SOURCE = [
	{
		scriptName: 'check',
		checkId: 'check',
		source: 'LIVE',
		execution: fixedProcess(['x', 'biome', 'check', '.']),
	},
	{
		scriptName: 'typecheck',
		checkId: 'typecheck',
		source: 'LIVE',
		execution: fixedProcess(['x', 'tsc', '--noEmit']),
	},
	{
		scriptName: 'test',
		checkId: 'test',
		source: 'FIXTURE',
		execution: fixedProcess(['x', 'vitest', 'run', '--config', 'vitest.config.ts']),
	},
	{
		scriptName: 'test:integration',
		checkId: 'test:integration',
		source: 'FIXTURE',
		execution: externalHarness(['x', 'vitest', 'run', '--config', 'vitest.integration.config.ts']),
	},
	{
		scriptName: 'studio:build',
		checkId: 'studio:build',
		source: 'LIVE',
		execution: productGate(8, 'Studio'),
	},
	{
		scriptName: 'dataset:validate',
		checkId: 'dataset:validate',
		source: 'LIVE',
		execution: productGate(5, 'The Hugging Face dataset validator'),
	},
	{
		scriptName: 'benchmark:smoke',
		checkId: 'benchmark:smoke',
		source: 'LIVE',
		execution: productGate(6, 'MLX PersonalBench'),
	},
	{
		scriptName: 'local:check',
		checkId: 'local:check',
		source: 'LIVE',
		execution: Object.freeze({
			kind: 'capability-gate',
			capabilityId: 'apple-silicon',
			availableStatus: 'PASS',
			unavailableStatus: 'SKIP',
		}),
	},
] as const satisfies readonly CheckDescriptor[];

export const CHECK_CATALOG: readonly CheckDescriptor[] = Object.freeze(
	CATALOG_SOURCE.map((descriptor) => Object.freeze(descriptor)),
);

const CHECKS_BY_ID = new Map<string, CheckDescriptor>(
	CHECK_CATALOG.map((descriptor) => [descriptor.checkId, descriptor]),
);

export function getCheckDescriptor(checkId: string): CheckDescriptor | null {
	return CHECKS_BY_ID.get(checkId) ?? null;
}
