import { createHash } from 'node:crypto';

import {
	ALLOWED_REPLACEMENT_EVIDENCE_KINDS,
	type MigrationRecord,
	type ReplacementEvidence,
	migrationLocatorKey,
} from './inventory-schema';

const ALLOWED_EVIDENCE = new Set<string>(ALLOWED_REPLACEMENT_EVIDENCE_KINDS);

export interface RemovalEligibilityContext {
	readonly reconciledLocatorKeys: readonly string[];
	readonly validRequirements: readonly string[];
	readonly validAcceptanceCriteria: readonly string[];
	readonly currentEvidence: readonly {
		readonly kind: string;
		readonly locator: string;
		readonly digest: string;
		readonly version: string;
	}[];
}

export interface RemovalEligibility {
	readonly eligible: boolean;
	readonly status: 'not-applicable' | 'blocked' | 'eligible';
	readonly reasons: readonly string[];
	readonly evidenceDigest: string;
}

function evidenceKey(evidence: {
	readonly kind: string;
	readonly locator: string;
	readonly digest: string;
	readonly version: string;
}): string {
	return `${evidence.kind}\u0000${evidence.locator}\u0000${evidence.digest}\u0000${evidence.version}`;
}

export function computeReplacementEvidenceDigest(
	evidence: readonly Pick<ReplacementEvidence, 'kind' | 'locator' | 'digest' | 'version'>[],
): string {
	const canonical = evidence.map(evidenceKey).sort().join('\n');
	return createHash('sha256').update(canonical).digest('hex');
}

export function computeRemovalEligibility(
	record: MigrationRecord,
	context: RemovalEligibilityContext,
): RemovalEligibility {
	const evidenceDigest = computeReplacementEvidenceDigest(
		record.replacementEvidence as readonly ReplacementEvidence[],
	);
	if (record.disposition !== 'remove') {
		return {
			eligible: false,
			status: 'not-applicable',
			reasons: ['Disposition does not request removal.'],
			evidenceDigest,
		};
	}

	const reasons: string[] = [];
	const locatorKey = migrationLocatorKey(record.category, record.locator);
	if (!context.reconciledLocatorKeys.includes(locatorKey)) {
		reasons.push('Exact locator is not reconciled.');
	}
	if (!record.replacementOwner.reviewed) reasons.push('Replacement owner is not reviewed.');
	if (
		record.requirementCoverage.length === 0 ||
		record.requirementCoverage.some((id) => !context.validRequirements.includes(id))
	) {
		reasons.push('Requirement coverage is missing or invalid.');
	}
	if (
		record.acceptanceCoverage.length === 0 ||
		record.acceptanceCoverage.some((id) => !context.validAcceptanceCriteria.includes(id))
	) {
		reasons.push('Acceptance coverage is missing or invalid.');
	}
	if (record.replacementEvidence.length === 0) {
		reasons.push('Replacement evidence is missing.');
	}
	for (const evidence of record.replacementEvidence) {
		if (!ALLOWED_EVIDENCE.has(evidence.kind)) {
			reasons.push(`Replacement evidence kind is not allowed: ${evidence.kind}.`);
			continue;
		}
		const current = context.currentEvidence.find(
			(candidate) => candidate.kind === evidence.kind && candidate.locator === evidence.locator,
		);
		if (!current) {
			reasons.push(`Replacement evidence locator is absent: ${evidence.locator}.`);
			continue;
		}
		if (current.digest !== evidence.digest) {
			reasons.push(`Replacement evidence digest is stale: ${evidence.locator}.`);
		}
		if (current.version !== evidence.version) {
			reasons.push(`Replacement evidence version is stale: ${evidence.locator}.`);
		}
	}
	if (record.review.status !== 'approved') {
		reasons.push('Removal review is not approved.');
	} else if (record.review.evidenceDigest !== evidenceDigest) {
		reasons.push('Approved review evidence digest is stale.');
	}

	return {
		eligible: reasons.length === 0,
		status: reasons.length === 0 ? 'eligible' : 'blocked',
		reasons,
		evidenceDigest,
	};
}

export function validateRemovalEligibility(
	record: MigrationRecord,
	context: RemovalEligibilityContext,
): RemovalEligibility {
	const computed = computeRemovalEligibility(record, context);
	if (record.disposition === 'remove' && record.removalStatus !== computed.status) {
		throw new Error(
			`Declared removal status ${record.removalStatus} conflicts with computed ${computed.status}: ${computed.reasons.join(' ')}`,
		);
	}
	if (record.disposition !== 'remove' && record.removalStatus !== 'blocked') {
		throw new Error('Non-remove records must remain blocked from destructive cleanup.');
	}
	return computed;
}
