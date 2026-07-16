import { describe, expect, it } from 'vitest';

interface CapabilityEvidenceShape {
	readonly id: string;
	readonly available: boolean;
	readonly reason: string;
}

interface CapabilityApi {
	normalizeCapabilityEvidence(input: unknown): CapabilityEvidenceShape | null;
	canSkipForCapability(input: unknown): boolean;
}

async function loadCapabilityApi(): Promise<CapabilityApi | null> {
	try {
		const moduleUrl = new URL('./capabilities.ts', import.meta.url).href;
		return (await import(moduleUrl)) as CapabilityApi;
	} catch {
		return null;
	}
}

async function requireCapabilityApi(): Promise<CapabilityApi> {
	const api = await loadCapabilityApi();
	expect(api, 'capability evidence behavior is not implemented').not.toBeNull();
	if (!api) throw new Error('capability evidence behavior is not implemented');
	return api;
}

describe('normalizeCapabilityEvidence', () => {
	it.each([
		{ id: 'apple-silicon', available: true, reason: 'arm64 host detected.' },
		{ id: 'apple-silicon', available: false, reason: 'arm64 host not detected.' },
	] as const)('preserves a named probe reporting available=$available', async (input) => {
		const { normalizeCapabilityEvidence } = await requireCapabilityApi();

		expect(normalizeCapabilityEvidence(input)).toEqual(input);
	});

	it.each([
		['missing input', undefined],
		['null input', null],
		['empty input', {}],
		['empty probe name', { id: '', available: false, reason: 'Unavailable.' }],
		['missing availability', { id: 'apple-silicon', reason: 'Unavailable.' }],
		['non-boolean availability', { id: 'apple-silicon', available: 'no', reason: 'Unavailable.' }],
		['missing reason', { id: 'apple-silicon', available: false }],
		['empty reason', { id: 'apple-silicon', available: false, reason: '' }],
		[
			'unknown field',
			{ id: 'apple-silicon', available: false, reason: 'Unavailable.', source: 'FIXTURE' },
		],
	] as const)('rejects %s without throwing', async (_case, input) => {
		const { normalizeCapabilityEvidence } = await requireCapabilityApi();

		expect(normalizeCapabilityEvidence(input)).toBeNull();
	});
});

describe('canSkipForCapability', () => {
	it('allows SKIP only for a named probe that reports unavailable', async () => {
		const { canSkipForCapability } = await requireCapabilityApi();

		expect(
			canSkipForCapability({
				id: 'apple-silicon',
				available: false,
				reason: 'arm64 host not detected.',
			}),
		).toBe(true);
	});

	it.each([
		[
			'available capability',
			{ id: 'apple-silicon', available: true, reason: 'arm64 host detected.' },
		],
		['missing implementation', undefined],
		['fixture label instead of probe', { source: 'FIXTURE', available: false }],
		['unprobed capability', { id: 'apple-silicon', reason: 'Not checked.' }],
		['mock evidence', { id: 'apple-silicon', available: false, reason: 'Mocked.', mock: true }],
	] as const)('rejects %s as SKIP evidence', async (_case, input) => {
		const { canSkipForCapability } = await requireCapabilityApi();

		expect(canSkipForCapability(input)).toBe(false);
	});
});
