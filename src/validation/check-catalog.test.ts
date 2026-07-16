import { describe, expect, it } from 'vitest';

type EvidenceSource = 'LIVE' | 'REPLAY' | 'FIXTURE';

type ExecutionShape =
	| {
			readonly kind: 'fixed-process';
			readonly executable: string;
			readonly args: readonly string[];
	  }
	| {
			readonly kind: 'external-harness';
			readonly policy: 'external-only';
			readonly stubId: string;
			readonly executable: string;
			readonly args: readonly string[];
	  }
	| {
			readonly kind: 'product-gate';
			readonly ownerPhase: number;
			readonly status: 'FAIL';
			readonly reason: string;
	  }
	| {
			readonly kind: 'capability-gate';
			readonly capabilityId: string;
			readonly availableStatus: 'PASS';
			readonly unavailableStatus: 'SKIP';
	  };

interface CheckDescriptorShape {
	readonly scriptName: string;
	readonly checkId: string;
	readonly source: EvidenceSource;
	readonly execution: ExecutionShape;
}

interface CatalogApi {
	readonly CHECK_CATALOG: readonly CheckDescriptorShape[];
	getCheckDescriptor(checkId: string): CheckDescriptorShape | null;
}

async function loadCatalogApi(): Promise<CatalogApi | null> {
	try {
		const moduleUrl = new URL('./check-catalog.ts', import.meta.url).href;
		return (await import(moduleUrl)) as CatalogApi;
	} catch {
		return null;
	}
}

async function requireCatalogApi(): Promise<CatalogApi> {
	const api = await loadCatalogApi();
	expect(api, 'validation check catalog is not implemented').not.toBeNull();
	if (!api) throw new Error('validation check catalog is not implemented');
	return api;
}

const REQUIRED_SCRIPTS = [
	'check',
	'typecheck',
	'test',
	'test:integration',
	'studio:build',
	'dataset:validate',
	'benchmark:smoke',
	'local:check',
] as const;

describe('CHECK_CATALOG', () => {
	it('declares exactly eight unique descriptors in stable script order', async () => {
		const { CHECK_CATALOG } = await requireCatalogApi();
		const scriptNames = CHECK_CATALOG.map(({ scriptName }) => scriptName);
		const checkIds = CHECK_CATALOG.map(({ checkId }) => checkId);

		expect(scriptNames).toEqual(REQUIRED_SCRIPTS);
		expect(new Set(scriptNames).size).toBe(REQUIRED_SCRIPTS.length);
		expect(new Set(checkIds).size).toBe(REQUIRED_SCRIPTS.length);
		expect(checkIds).toEqual(REQUIRED_SCRIPTS);
	});

	it.each([
		['check', ['x', 'biome', 'check', '.'], 'LIVE'],
		['typecheck', ['x', 'tsc', '--noEmit'], 'LIVE'],
		['test', ['x', 'vitest', 'run', '--config', 'vitest.config.ts'], 'FIXTURE'],
	] as const)('pins %s to an immutable direct Bun process', async (checkId, args, source) => {
		const { getCheckDescriptor } = await requireCatalogApi();
		const descriptor = getCheckDescriptor(checkId);

		expect(descriptor).not.toBeNull();
		expect(descriptor?.source).toBe(source);
		expect(descriptor?.execution).toMatchObject({
			kind: 'fixed-process',
			executable: 'bun',
			args,
		});
		expect(Object.isFrozen(descriptor?.execution)).toBe(true);
		expect(Object.isFrozen((descriptor?.execution as { args?: readonly string[] })?.args)).toBe(
			true,
		);
	});

	it('makes test:integration external-only with direct fixed Vitest argv and a stub seam', async () => {
		const { getCheckDescriptor } = await requireCatalogApi();
		const descriptor = getCheckDescriptor('test:integration');

		expect(descriptor).toEqual({
			scriptName: 'test:integration',
			checkId: 'test:integration',
			source: 'FIXTURE',
			execution: {
				kind: 'external-harness',
				policy: 'external-only',
				stubId: 'integration-suite-self',
				executable: 'bun',
				args: ['x', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
			},
		});
		expect(Object.isFrozen(descriptor?.execution)).toBe(true);
	});

	it.each([
		['studio:build', 8],
		['dataset:validate', 5],
		['benchmark:smoke', 6],
	] as const)(
		'keeps absent product %s as an explicit LIVE FAIL owned by Phase %i',
		async (checkId, ownerPhase) => {
			const { getCheckDescriptor } = await requireCatalogApi();
			const descriptor = getCheckDescriptor(checkId);

			expect(descriptor?.source).toBe('LIVE');
			expect(descriptor?.execution).toMatchObject({
				kind: 'product-gate',
				ownerPhase,
				status: 'FAIL',
			});
			expect((descriptor?.execution as { readonly reason?: string } | undefined)?.reason).toMatch(
				new RegExp(`Phase ${ownerPhase}`, 'i'),
			);
		},
	);

	it('reserves local SKIP for the named apple-silicon capability', async () => {
		const { getCheckDescriptor } = await requireCatalogApi();
		const descriptor = getCheckDescriptor('local:check');

		expect(descriptor).toEqual({
			scriptName: 'local:check',
			checkId: 'local:check',
			source: 'LIVE',
			execution: {
				kind: 'capability-gate',
				capabilityId: 'apple-silicon',
				availableStatus: 'PASS',
				unavailableStatus: 'SKIP',
			},
		});
	});

	it('contains no shell string, recursive package script, mutable argv, or callable handler', async () => {
		const { CHECK_CATALOG } = await requireCatalogApi();

		for (const descriptor of CHECK_CATALOG) {
			expect(Object.isFrozen(descriptor)).toBe(true);
			expect(Object.isFrozen(descriptor.execution)).toBe(true);
			expect('shell' in descriptor.execution).toBe(false);
			expect(Object.values(descriptor).some((value) => typeof value === 'function')).toBe(false);
			if ('args' in descriptor.execution) {
				expect(Object.isFrozen(descriptor.execution.args)).toBe(true);
				expect(descriptor.execution.args.join(' ')).not.toMatch(/\bbun\s+run\b/);
				expect(descriptor.execution.args).not.toContain('--watch');
			}
		}
	});

	it('looks up only declared IDs and does not accept aliases', async () => {
		const { CHECK_CATALOG, getCheckDescriptor } = await requireCatalogApi();

		for (const descriptor of CHECK_CATALOG) {
			expect(getCheckDescriptor(descriptor.checkId)).toBe(descriptor);
		}
		expect(getCheckDescriptor('integration')).toBeNull();
		expect(getCheckDescriptor('bun run test')).toBeNull();
		expect(getCheckDescriptor('')).toBeNull();
	});
});
