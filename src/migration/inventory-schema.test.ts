import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const moduleUrl = new URL('./inventory-schema.ts', import.meta.url).href;

async function loadSchemaModule(): Promise<Record<string, unknown>> {
	try {
		return (await import(moduleUrl)) as Record<string, unknown>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return {};
		throw error;
	}
}

function requireExport<T>(module: Record<string, unknown>, name: string): T {
	const value = module[name];
	expect(value, `MISSING_BEHAVIOR: inventory schema export ${name}`).toBeDefined();
	return value as T;
}

const CATEGORIES = [
	'legacy-command',
	'executable-name',
	'runtime-path',
	'generated-artifact',
	'script',
	'product-string',
	'dynamic-tool-path',
	'ios-component',
	'planning-artifact',
] as const;

const RUNTIME_CLASSES = [
	'legacy-user-config',
	'legacy-project-config',
	'canonical-mlx-root',
	'repository-generated-data',
	'environment-derived-root',
	'os-temporary-state',
	'build-cache-vendor',
	'device-container-state',
	'process-network-runtime',
	'external-global-executable',
	'credentials-private-repositories',
] as const;

function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function validInventory() {
	const locator = { path: 'src/cli.tsx', kind: 'command', value: 'bare-repl' };
	return {
		schemaVersion: '1',
		inventoryVersion: '1.0.0',
		categories: CATEGORIES.map((category) => ({
			category,
			policy: category === 'product-string' ? 'evidenced-zero' : 'records',
			scanRule: `exact:${category}`,
			discoveredCount: category === 'product-string' ? 0 : 1,
			recordCount: category === 'product-string' ? 0 : 1,
			status: 'reconciled',
			...(category === 'product-string'
				? { zeroEvidence: 'Canonical identity scan found no forbidden user-facing strings.' }
				: {}),
		})),
		runtimeState: RUNTIME_CLASSES.map((runtimeClass) => ({
			class: runtimeClass,
			inspection: runtimeClass.includes('credentials') ? 'not-inspected' : 'source-records',
			reason: runtimeClass.includes('credentials')
				? 'Private credentials and repositories are never opened by inventory reconciliation.'
				: 'Version-controlled source expressions only.',
		})),
		exclusions: [
			{
				path: '.planning/migrations/2026-07-15-legacy-planning-inventory.md',
				category: 'product-string',
				rule: 'historical-internal-record',
				reason: 'Authoritative internal migration provenance is not user-facing product copy.',
			},
		],
		scanSnapshot: {
			trackedPaths: ['scripts/train.sh'],
			planningPaths: [
				'.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md',
			],
			sourceDeclarations: CATEGORIES.filter(
				(category) => !['script', 'planning-artifact', 'product-string'].includes(category),
			).map((category) => ({ category, locator })),
			evidencedZeroCategories: ['product-string'],
		},
		records: CATEGORIES.filter((category) => category !== 'product-string').map((category) => {
			const exactLocator =
				category === 'script'
					? { path: 'scripts/train.sh', kind: 'file', value: 'scripts/train.sh' }
					: category === 'planning-artifact'
						? {
								path: '.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md',
								kind: 'file',
								value:
									'.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md',
							}
						: locator;
			return {
				id: digest(`${category}\u0000${exactLocator.path}\u0000${exactLocator.kind}\u0000${exactLocator.value}`),
				category,
				locator: exactLocator,
				legacyPurpose: `Legacy ${category} retained as migration evidence.`,
				disposition: 'adapt',
				replacementOwner: { phase: 1, component: 'migration-inventory', reviewed: true },
				requirementCoverage: ['IDEN-07'],
				acceptanceCoverage: ['AC-13'],
				replacementEvidence: [],
				removalStatus: 'blocked',
				review: { status: 'pending' },
				provenance: {
					discoveredBy: 'phase-1-controlled-snapshot',
					source: exactLocator.path,
					snapshot: 'fixture',
				},
			};
		}),
	};
}

describe('MIGRATION_INVENTORY_SCHEMA', () => {
	it('accepts a complete versioned inventory and preserves deterministic ordering', async () => {
		const module = await loadSchemaModule();
		const schema = requireExport<{ parse(value: unknown): unknown }>(
			module,
			'MIGRATION_INVENTORY_SCHEMA',
		);
		expect(schema.parse(validInventory())).toEqual(validInventory());
	});

	it.each([
		['duplicate record IDs', (value: ReturnType<typeof validInventory>) => value.records.push(value.records[0])],
		[
			'duplicate exact locators',
			(value: ReturnType<typeof validInventory>) => {
				value.records[1] = { ...value.records[1], locator: value.records[0].locator };
			},
		],
		[
			'undeclared mandatory categories',
			(value: ReturnType<typeof validInventory>) => value.categories.pop(),
		],
		[
			'missing owner review',
			(value: ReturnType<typeof validInventory>) => {
				value.records[0].replacementOwner.reviewed = false;
			},
		],
		[
			'missing requirement coverage',
			(value: ReturnType<typeof validInventory>) => {
				value.records[0].requirementCoverage = [];
			},
		],
		[
			'broad exclusions',
			(value: ReturnType<typeof validInventory>) => {
				value.exclusions[0].path = 'docs/**';
			},
		],
	] as const)('rejects %s', async (_label, mutate) => {
		const module = await loadSchemaModule();
		const schema = requireExport<{ safeParse(value: unknown): { success: boolean } }>(
			module,
			'MIGRATION_INVENTORY_SCHEMA',
		);
		const value = validInventory();
		mutate(value);
		expect(schema.safeParse(value).success).toBe(false);
	});
});
