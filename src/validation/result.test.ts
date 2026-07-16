import { describe, expect, it } from 'vitest';

interface CapabilityEvidenceShape {
	readonly id: string;
	readonly available: boolean;
	readonly reason: string;
}

interface ValidationResultShape {
	readonly checkId: string;
	readonly status: 'PASS' | 'FAIL' | 'SKIP';
	readonly source: 'LIVE' | 'REPLAY' | 'FIXTURE';
	readonly reason: string;
	readonly capability?: CapabilityEvidenceShape;
}

interface ValidationAggregateShape {
	readonly status: 'PASS' | 'FAIL' | 'SKIP';
	readonly results: readonly ValidationResultShape[];
}

interface ResultApi {
	normalizeValidationResult(input: unknown): ValidationResultShape;
	aggregateValidationResults(inputs: readonly unknown[]): ValidationAggregateShape;
}

async function loadResultApi(): Promise<ResultApi | null> {
	try {
		const moduleUrl = new URL('./result.ts', import.meta.url).href;
		return (await import(moduleUrl)) as ResultApi;
	} catch {
		return null;
	}
}

async function requireResultApi(): Promise<ResultApi> {
	const api = await loadResultApi();
	expect(api, 'validation result behavior is not implemented').not.toBeNull();
	if (!api) throw new Error('validation result behavior is not implemented');
	return api;
}

const validPass = {
	checkId: 'typecheck',
	status: 'PASS',
	source: 'LIVE',
	reason: 'TypeScript completed without errors.',
} as const;

describe('normalizeValidationResult', () => {
	it.each([
		['PASS', 'LIVE'],
		['PASS', 'REPLAY'],
		['PASS', 'FIXTURE'],
		['FAIL', 'LIVE'],
		['FAIL', 'REPLAY'],
		['FAIL', 'FIXTURE'],
	] as const)('preserves %s independently from declared %s evidence', async (status, source) => {
		const { normalizeValidationResult } = await requireResultApi();
		const result = normalizeValidationResult({
			checkId: `independent-${status.toLowerCase()}-${source.toLowerCase()}`,
			status,
			source,
			reason: 'Controlled evidence.',
		});

		expect(result.status).toBe(status);
		expect(result.source).toBe(source);
	});

	it('preserves a valid capability-gated SKIP and its declared source', async () => {
		const { normalizeValidationResult } = await requireResultApi();
		const result = normalizeValidationResult({
			checkId: 'local.apple-silicon',
			status: 'SKIP',
			source: 'LIVE',
			reason: 'Apple Silicon capability is unavailable on this host.',
			capability: {
				id: 'apple-silicon',
				available: false,
				reason: 'Host architecture is not arm64.',
			},
		});

		expect(result).toEqual({
			checkId: 'local.apple-silicon',
			status: 'SKIP',
			source: 'LIVE',
			reason: 'Apple Silicon capability is unavailable on this host.',
			capability: {
				id: 'apple-silicon',
				available: false,
				reason: 'Host architecture is not arm64.',
			},
		});
	});

	it.each([
		['missing input', undefined],
		['empty input', {}],
		['unknown status', { ...validPass, status: 'UNKNOWN' }],
		['contradictory status flags', { ...validPass, pass: true, fail: true }],
		['missing check ID', { ...validPass, checkId: undefined }],
		['empty check ID', { ...validPass, checkId: '' }],
		['missing reason', { ...validPass, reason: undefined }],
		['empty reason', { ...validPass, reason: '' }],
		['missing source', { ...validPass, source: undefined }],
		['unknown source', { ...validPass, source: 'MOCK' }],
		['non-object input', 'PASS'],
	] as const)('turns %s into a visible deterministic FAIL row', async (_case, input) => {
		const { normalizeValidationResult } = await requireResultApi();
		const first = normalizeValidationResult(input);
		const second = normalizeValidationResult(input);

		expect(first.status).toBe('FAIL');
		expect(first.checkId.length).toBeGreaterThan(0);
		expect(first.reason.length).toBeGreaterThan(0);
		expect(['LIVE', 'REPLAY', 'FIXTURE']).toContain(first.source);
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it.each([
		['missing capability', undefined],
		['empty capability', {}],
		['unnamed capability', { id: '', available: false, reason: 'Unavailable.' }],
		['unprobed capability', { id: 'apple-silicon', reason: 'Unavailable.' }],
		['available capability', { id: 'apple-silicon', available: true, reason: 'Available.' }],
	] as const)('turns SKIP with %s into FAIL without changing its source', async (_case, capability) => {
		const { normalizeValidationResult } = await requireResultApi();
		const result = normalizeValidationResult({
			checkId: 'local.check',
			status: 'SKIP',
			source: 'REPLAY',
			reason: 'Requested skip.',
			capability,
		});

		expect(result.status).toBe('FAIL');
		expect(result.source).toBe('REPLAY');
		expect(result.reason).toMatch(/skip/i);
	});
});

describe('aggregateValidationResults', () => {
	it('retains rows in input order and gives FAIL dominance', async () => {
		const { aggregateValidationResults } = await requireResultApi();
		const inputs = [
			validPass,
			{
				checkId: 'local.check',
				status: 'SKIP',
				source: 'LIVE',
				reason: 'Capability unavailable.',
				capability: { id: 'apple-silicon', available: false, reason: 'Not arm64.' },
			},
			{ checkId: 'studio.build', status: 'FAIL', source: 'LIVE', reason: 'Owned by Phase 8.' },
		] as const;
		const aggregate = aggregateValidationResults(inputs);

		expect(aggregate.status).toBe('FAIL');
		expect(aggregate.results.map(({ checkId }) => checkId)).toEqual([
			'typecheck',
			'local.check',
			'studio.build',
		]);
		expect(aggregate.results).toHaveLength(3);
	});

	it('gives SKIP dominance when there are no failures', async () => {
		const { aggregateValidationResults } = await requireResultApi();
		const aggregate = aggregateValidationResults([
			validPass,
			{
				checkId: 'local.check',
				status: 'SKIP',
				source: 'LIVE',
				reason: 'Capability unavailable.',
				capability: { id: 'apple-silicon', available: false, reason: 'Not arm64.' },
			},
		]);

		expect(aggregate.status).toBe('SKIP');
		expect(aggregate.results).toHaveLength(2);
	});

	it('returns PASS only when every retained row passes', async () => {
		const { aggregateValidationResults } = await requireResultApi();
		const aggregate = aggregateValidationResults([
			validPass,
			{ ...validPass, checkId: 'check', source: 'FIXTURE' },
		]);

		expect(aggregate.status).toBe('PASS');
		expect(aggregate.results).toHaveLength(2);
	});

	it('synthesizes a visible FAIL row for an empty aggregate', async () => {
		const { aggregateValidationResults } = await requireResultApi();
		const first = aggregateValidationResults([]);
		const second = aggregateValidationResults([]);

		expect(first.status).toBe('FAIL');
		expect(first.results).toHaveLength(1);
		expect(first.results[0]).toMatchObject({ status: 'FAIL', source: 'LIVE' });
		expect(first.results[0]?.reason).toMatch(/no validation results/i);
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});
});
