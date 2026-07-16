import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const moduleUrl = new URL('./removal-gate.ts', import.meta.url).href;

async function loadRemovalModule(): Promise<Record<string, unknown>> {
	try {
		return (await import(moduleUrl)) as Record<string, unknown>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return {};
		throw error;
	}
}

function requireExport<T>(module: Record<string, unknown>, name: string): T {
	const value = module[name];
	expect(value, `MISSING_BEHAVIOR: removal gate export ${name}`).toBeDefined();
	return value as T;
}

function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function fixture(kind = 'source') {
	const evidence = {
		kind,
		locator: 'src/cli/main.ts#runCli',
		digest: digest('replacement-v1'),
		version: '1',
	};
	return {
		record: {
			id: digest('legacy-command\u0000src/cli.tsx\u0000command\u0000bare-repl'),
			category: 'legacy-command',
			locator: { path: 'src/cli.tsx', kind: 'command', value: 'bare-repl' },
			legacyPurpose: 'Legacy bare invocation launched the retained REPL.',
			disposition: 'remove',
			replacementOwner: { phase: 1, component: 'typed-cli-entry', reviewed: true },
			requirementCoverage: ['IDEN-05'],
			acceptanceCoverage: ['AC-09'],
			replacementEvidence: [evidence],
			removalStatus: 'eligible',
			review: { status: 'approved', reviewer: 'phase-1-maintainer', evidenceDigest: '' },
			provenance: {
				discoveredBy: 'controlled-snapshot',
				source: 'src/cli.tsx',
				snapshot: 'fixture',
				sourceDigest: digest('legacy-v1'),
				sourceVersion: 'fixture-v1',
			},
		},
		context: {
			reconciledLocatorKeys: ['legacy-command\u0000src/cli.tsx\u0000command\u0000bare-repl'],
			validRequirements: ['IDEN-05'],
			validAcceptanceCriteria: ['AC-09'],
			currentEvidence: [evidence],
			requiredEvidenceLocators: [evidence.locator],
			currentLegacyEvidence: [
				{
					locatorKey: 'legacy-command\u0000src/cli.tsx\u0000command\u0000bare-repl',
					digest: digest('legacy-v1'),
					version: 'fixture-v1',
				},
			],
		},
	};
}

describe('computeRemovalEligibility', () => {
	it('computes eligibility from exact current evidence and ignores a declared eligible field', async () => {
		const module = await loadRemovalModule();
		const evidenceDigest = requireExport<(evidence: readonly unknown[]) => string>(
			module,
			'computeReplacementEvidenceDigest',
		);
		const compute = requireExport<
			(
				record: unknown,
				context: unknown,
			) => { eligible: boolean; status: string; reasons: string[] }
		>(module, 'computeRemovalEligibility');
		const { record, context } = fixture();
		record.review.evidenceDigest = evidenceDigest(record.replacementEvidence);
		const first = compute(record, context);
		expect(first).toMatchObject({ eligible: true, status: 'eligible', reasons: [] });
		expect(compute(record, context)).toEqual(first);

		const changed = structuredClone(context);
		changed.currentEvidence[0].digest = digest('changed');
		expect(compute(record, changed)).toMatchObject({ eligible: false, status: 'blocked' });
	});

	it.each(['plan', 'placeholder', 'mock', 'fixture', 'replay', 'unavailable'])(
		'blocks disallowed %s evidence individually',
		async (kind) => {
			const module = await loadRemovalModule();
			const compute = requireExport<
				(record: unknown, context: unknown) => { eligible: boolean; reasons: string[] }
			>(module, 'computeRemovalEligibility');
			const { record, context } = fixture(kind);
			expect(compute(record, context).eligible).toBe(false);
			expect(compute(record, context).reasons.join(' ')).toMatch(/evidence|kind|allowed/i);
		},
	);

	it.each([
		[
			'exact reconciliation',
			(
				record: ReturnType<typeof fixture>['record'],
				context: ReturnType<typeof fixture>['context'],
			) => context.reconciledLocatorKeys.splice(0),
		],
		[
			'reviewed owner',
			(record: ReturnType<typeof fixture>['record']) => {
				record.replacementOwner.reviewed = false;
			},
		],
		[
			'requirement coverage',
			(record: ReturnType<typeof fixture>['record']) => {
				record.requirementCoverage = [];
			},
		],
		[
			'acceptance coverage',
			(record: ReturnType<typeof fixture>['record']) => {
				record.acceptanceCoverage = [];
			},
		],
		[
			'replacement evidence',
			(record: ReturnType<typeof fixture>['record']) => {
				record.replacementEvidence = [];
			},
		],
		[
			'current digest',
			(
				_record: ReturnType<typeof fixture>['record'],
				context: ReturnType<typeof fixture>['context'],
			) => {
				context.currentEvidence[0].digest = digest('stale');
			},
		],
		[
			'current version',
			(
				_record: ReturnType<typeof fixture>['record'],
				context: ReturnType<typeof fixture>['context'],
			) => {
				context.currentEvidence[0].version = '2';
			},
		],
		[
			'approved review',
			(record: ReturnType<typeof fixture>['record']) => {
				record.review.status = 'pending';
			},
		],
	] as const)('blocks missing or stale %s', async (_label, mutate) => {
		const module = await loadRemovalModule();
		const compute = requireExport<
			(record: unknown, context: unknown) => { eligible: boolean; status: string }
		>(module, 'computeRemovalEligibility');
		const { record, context } = fixture();
		mutate(record, context);
		expect(compute(record, context)).toMatchObject({ eligible: false, status: 'blocked' });
	});

	it('validates declared eligibility against the computed result', async () => {
		const module = await loadRemovalModule();
		const validate = requireExport<(record: unknown, context: unknown) => unknown>(
			module,
			'validateRemovalEligibility',
		);
		const { record, context } = fixture();
		context.currentEvidence[0].digest = digest('stale');
		expect(() => validate(record, context)).toThrow(/declared|blocked|eligib/i);
	});

	it('blocks deletion when exact current legacy artifact evidence changes', async () => {
		const module = await loadRemovalModule();
		const evidenceDigest = requireExport<(evidence: readonly unknown[]) => string>(
			module,
			'computeReplacementEvidenceDigest',
		);
		const compute = requireExport<
			(record: unknown, context: unknown) => { eligible: boolean; reasons: string[] }
		>(module, 'computeRemovalEligibility');
		const { record, context } = fixture();
		record.review.evidenceDigest = evidenceDigest(record.replacementEvidence);
		context.currentLegacyEvidence[0].digest = digest('artifact-changed-after-review');
		const result = compute(record, context);
		expect(result.eligible).toBe(false);
		expect(result.reasons.join(' ')).toMatch(/legacy|target|source|digest/i);
	});

	it('blocks deletion when required identity replacement evidence is absent', async () => {
		const module = await loadRemovalModule();
		const evidenceDigest = requireExport<(evidence: readonly unknown[]) => string>(
			module,
			'computeReplacementEvidenceDigest',
		);
		const compute = requireExport<
			(record: unknown, context: unknown) => { eligible: boolean; reasons: string[] }
		>(module, 'computeRemovalEligibility');
		const { record, context } = fixture();
		record.review.evidenceDigest = evidenceDigest(record.replacementEvidence);
		context.requiredEvidenceLocators = [
			'src/identity/audit.test.ts#forbidden-product-brand',
		];
		const result = compute(record, context);
		expect(result.eligible).toBe(false);
		expect(result.reasons.join(' ')).toMatch(/required|identity|evidence|locator/i);
	});
});
