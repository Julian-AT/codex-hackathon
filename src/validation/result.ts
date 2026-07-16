import { z } from 'zod';

import {
	type CapabilityEvidence,
	canSkipForCapability,
	normalizeCapabilityEvidence,
} from './capabilities';

export const VALIDATION_STATUSES = ['PASS', 'FAIL', 'SKIP'] as const;
export const EVIDENCE_SOURCES = ['LIVE', 'REPLAY', 'FIXTURE'] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

const CHECK_ID = /^[a-z0-9]+(?:[.:/-][a-z0-9]+)*$/;

const VALIDATION_RESULT_INPUT_SCHEMA = z
	.object({
		checkId: z.string().min(1).max(160).regex(CHECK_ID),
		status: z.enum(VALIDATION_STATUSES),
		source: z.enum(EVIDENCE_SOURCES),
		reason: z.string().min(1).max(1_000),
		capability: z.unknown().optional(),
	})
	.strict();

const PARTIAL_RESULT_SCHEMA = z
	.object({
		checkId: z.string().min(1).max(160).regex(CHECK_ID).optional(),
		source: z.enum(EVIDENCE_SOURCES).optional(),
		capability: z.unknown().optional(),
	})
	.passthrough();

export type ValidationResultInput = z.input<typeof VALIDATION_RESULT_INPUT_SCHEMA>;

interface ValidationResultBase {
	readonly checkId: string;
	readonly source: EvidenceSource;
	readonly reason: string;
	readonly capability?: CapabilityEvidence;
}

export type ValidationResult =
	| (ValidationResultBase & { readonly status: 'PASS' })
	| (ValidationResultBase & { readonly status: 'FAIL' })
	| (ValidationResultBase & {
			readonly status: 'SKIP';
			readonly capability: CapabilityEvidence & { readonly available: false };
	  });

export interface ValidationAggregate {
	readonly status: ValidationStatus;
	readonly results: readonly ValidationResult[];
}

const INVALID_CHECK_ID = 'validation.invalid';
const INVALID_INPUT_REASON =
	'Validation result is malformed or incomplete and was normalized to FAIL.';
const INVALID_SKIP_REASON =
	'SKIP requires a named capability probe that reports unavailable; result normalized to FAIL.';
const EMPTY_AGGREGATE_REASON =
	'No validation results were produced; the validation run is invalid and is reported as FAIL.';

function freezeResult(result: ValidationResult): ValidationResult {
	return Object.freeze(result);
}

function invalidResult(input: unknown, reason: string): ValidationResult {
	const partial = PARTIAL_RESULT_SCHEMA.safeParse(input);
	const capability = partial.success
		? normalizeCapabilityEvidence(partial.data.capability)
		: null;
	return freezeResult({
		checkId: partial.success ? (partial.data.checkId ?? INVALID_CHECK_ID) : INVALID_CHECK_ID,
		status: 'FAIL',
		source: partial.success ? (partial.data.source ?? 'LIVE') : 'LIVE',
		reason,
		...(capability ? { capability } : {}),
	});
}

export function normalizeValidationResult(input: unknown): ValidationResult {
	const parsed = VALIDATION_RESULT_INPUT_SCHEMA.safeParse(input);
	if (!parsed.success) return invalidResult(input, INVALID_INPUT_REASON);

	const { checkId, status, source, reason } = parsed.data;
	const capability = normalizeCapabilityEvidence(parsed.data.capability);

	if (status === 'SKIP') {
		if (!canSkipForCapability(parsed.data.capability) || !capability || capability.available) {
			return invalidResult(input, INVALID_SKIP_REASON);
		}
		return freezeResult({
			checkId,
			status,
			source,
			reason,
			capability: { ...capability, available: false },
		});
	}

	return freezeResult({
		checkId,
		status,
		source,
		reason,
		...(capability ? { capability } : {}),
	});
}

export function aggregateValidationResults(inputs: readonly unknown[]): ValidationAggregate {
	const results =
		inputs.length === 0
			? [
					freezeResult({
						checkId: 'validation.empty',
						status: 'FAIL',
						source: 'LIVE',
						reason: EMPTY_AGGREGATE_REASON,
					}),
				]
			: inputs.map(normalizeValidationResult);

	const status: ValidationStatus = results.some((result) => result.status === 'FAIL')
		? 'FAIL'
		: results.some((result) => result.status === 'SKIP')
			? 'SKIP'
			: 'PASS';

	return Object.freeze({ status, results: Object.freeze(results) });
}
