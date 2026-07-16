import { createHash } from 'node:crypto';

import { z } from 'zod';

export const MIGRATION_CATEGORIES = [
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

export const RUNTIME_STATE_CLASSES = [
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

export type MigrationCategory = (typeof MIGRATION_CATEGORIES)[number];
export type RuntimeStateClass = (typeof RUNTIME_STATE_CLASSES)[number];

const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*[\0\r\n]).+$/;
const EXACT_PATH = /^(?!.*[*?{}[\]])(?!.*\/$).+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REQUIREMENT_ID = /^[A-Z][A-Z0-9]*-[0-9]{2}$/;
const ACCEPTANCE_ID = /^AC-[0-9]{2}$/;

export const EXACT_LOCATOR_SCHEMA = z
	.object({
		path: z.string().min(1).regex(SAFE_RELATIVE_PATH),
		kind: z.enum(['file', 'command', 'executable', 'expression', 'literal', 'symbol', 'artifact']),
		value: z.string().min(1).max(500),
	})
	.strict();

export type ExactLocator = z.output<typeof EXACT_LOCATOR_SCHEMA>;

export function compareCodePoint(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function exactLocatorKey(locator: ExactLocator): string {
	return `${locator.path}\u0000${locator.kind}\u0000${locator.value}`;
}

export function migrationLocatorKey(category: MigrationCategory, locator: ExactLocator): string {
	return `${category}\u0000${exactLocatorKey(locator)}`;
}

export function createMigrationRecordId(
	category: MigrationCategory,
	locator: ExactLocator,
): string {
	return createHash('sha256').update(migrationLocatorKey(category, locator)).digest('hex');
}

export function compareMigrationRecords(
	left: Pick<MigrationRecord, 'category' | 'locator'>,
	right: Pick<MigrationRecord, 'category' | 'locator'>,
): number {
	const categoryOrder =
		MIGRATION_CATEGORIES.indexOf(left.category) - MIGRATION_CATEGORIES.indexOf(right.category);
	return (
		categoryOrder || compareCodePoint(exactLocatorKey(left.locator), exactLocatorKey(right.locator))
	);
}

export const PATH_EXCLUSION_SCHEMA = z
	.object({
		path: z.string().min(1).regex(SAFE_RELATIVE_PATH).regex(EXACT_PATH),
		category: z.enum(MIGRATION_CATEGORIES),
		rule: z.string().min(3).max(120),
		reason: z.string().min(12).max(500),
	})
	.strict();

export type PathExclusion = z.output<typeof PATH_EXCLUSION_SCHEMA>;

const CATEGORY_COVERAGE_BASE = z.object({
	category: z.enum(MIGRATION_CATEGORIES),
	scanRule: z.string().min(3),
	discoveredCount: z.number().int().nonnegative(),
	recordCount: z.number().int().nonnegative(),
	status: z.literal('reconciled'),
});

const RECORD_CATEGORY_COVERAGE_SCHEMA = CATEGORY_COVERAGE_BASE.extend({
	policy: z.literal('records'),
	zeroEvidence: z.never().optional(),
}).strict();

const ZERO_CATEGORY_COVERAGE_SCHEMA = CATEGORY_COVERAGE_BASE.extend({
	policy: z.literal('evidenced-zero'),
	discoveredCount: z.literal(0),
	recordCount: z.literal(0),
	zeroEvidence: z.string().min(12).max(500),
}).strict();

export const CATEGORY_COVERAGE_SCHEMA = z.discriminatedUnion('policy', [
	RECORD_CATEGORY_COVERAGE_SCHEMA,
	ZERO_CATEGORY_COVERAGE_SCHEMA,
]);

export type CategoryCoverage = z.output<typeof CATEGORY_COVERAGE_SCHEMA>;

const RUNTIME_STATE_SCOPE_SCHEMA = z
	.object({
		class: z.enum(RUNTIME_STATE_CLASSES),
		inspection: z.enum(['source-records', 'not-inspected']),
		reason: z.string().min(12).max(500),
	})
	.strict();

export const ALLOWED_REPLACEMENT_EVIDENCE_KINDS = [
	'source',
	'test',
	'schema',
	'executable',
	'generated-review',
] as const;

export const REPLACEMENT_EVIDENCE_SCHEMA = z
	.object({
		kind: z.enum(ALLOWED_REPLACEMENT_EVIDENCE_KINDS),
		locator: z.string().min(3).max(500),
		digest: z.string().regex(SHA256),
		version: z.string().min(1).max(80),
	})
	.strict();

export type ReplacementEvidence = z.output<typeof REPLACEMENT_EVIDENCE_SCHEMA>;

const REPLACEMENT_OWNER_SCHEMA = z
	.object({
		phase: z.number().int().min(1).max(8),
		component: z.string().min(3).max(160),
		reviewed: z.literal(true),
	})
	.strict();

const PENDING_REVIEW_SCHEMA = z
	.object({
		status: z.literal('pending'),
		reviewer: z.never().optional(),
		evidenceDigest: z.never().optional(),
	})
	.strict();

const APPROVED_REVIEW_SCHEMA = z
	.object({
		status: z.literal('approved'),
		reviewer: z.string().min(3).max(160),
		evidenceDigest: z.string().regex(SHA256),
	})
	.strict();

const REVIEW_SCHEMA = z.discriminatedUnion('status', [
	PENDING_REVIEW_SCHEMA,
	APPROVED_REVIEW_SCHEMA,
]);

const RECORD_BASE = z.object({
	id: z.string().regex(SHA256),
	category: z.enum(MIGRATION_CATEGORIES),
	locator: EXACT_LOCATOR_SCHEMA,
	legacyPurpose: z.string().min(12).max(1000),
	replacementOwner: REPLACEMENT_OWNER_SCHEMA,
	requirementCoverage: z.array(z.string().regex(REQUIREMENT_ID)).min(1),
	acceptanceCoverage: z.array(z.string().regex(ACCEPTANCE_ID)).min(1),
	replacementEvidence: z.array(REPLACEMENT_EVIDENCE_SCHEMA),
	review: REVIEW_SCHEMA,
	provenance: z
		.object({
			discoveredBy: z.string().min(3).max(160),
			source: z.string().min(1).max(500),
			snapshot: z.string().min(1).max(160),
			sourceDigest: z.string().regex(SHA256).optional(),
			sourceVersion: z.string().min(1).max(160).optional(),
		})
		.strict(),
});

const NON_REMOVE_RECORD_SCHEMA = RECORD_BASE.extend({
	disposition: z.enum(['retain', 'adapt', 'fixture-only', 'archive']),
	removalStatus: z.literal('blocked'),
}).strict();

const REMOVE_RECORD_SCHEMA = RECORD_BASE.extend({
	disposition: z.literal('remove'),
	removalStatus: z.enum(['blocked', 'eligible']),
}).strict();

export const MIGRATION_RECORD_SCHEMA = z
	.discriminatedUnion('disposition', [NON_REMOVE_RECORD_SCHEMA, REMOVE_RECORD_SCHEMA])
	.superRefine((record, context) => {
		if (record.id !== createMigrationRecordId(record.category, record.locator)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['id'],
				message: 'Record ID is stale.',
			});
		}
		if (record.disposition === 'remove' && record.replacementEvidence.length === 0) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['replacementEvidence'],
				message: 'Remove candidates require replacement evidence.',
			});
		}
		if (
			record.disposition === 'remove' &&
			(record.provenance.sourceDigest === undefined ||
				record.provenance.sourceVersion === undefined)
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['provenance'],
				message: 'Remove candidates require current source digest and version evidence.',
			});
		}
	});

export type MigrationRecord = z.output<typeof MIGRATION_RECORD_SCHEMA>;

const SOURCE_DECLARATION_SCHEMA = z
	.object({
		category: z.enum(MIGRATION_CATEGORIES),
		locator: EXACT_LOCATOR_SCHEMA,
	})
	.strict();

const SCAN_SNAPSHOT_SCHEMA = z
	.object({
		trackedPaths: z.array(z.string().regex(SAFE_RELATIVE_PATH)),
		planningPaths: z.array(z.string().regex(SAFE_RELATIVE_PATH)),
		sourceDeclarations: z.array(SOURCE_DECLARATION_SCHEMA),
		evidencedZeroCategories: z.array(z.enum(MIGRATION_CATEGORIES)),
	})
	.strict();

export const MIGRATION_INVENTORY_SCHEMA = z
	.object({
		schemaVersion: z.literal('1'),
		inventoryVersion: z.string().regex(/^1\.[0-9]+\.[0-9]+$/),
		categories: z.array(CATEGORY_COVERAGE_SCHEMA).length(MIGRATION_CATEGORIES.length),
		runtimeState: z.array(RUNTIME_STATE_SCOPE_SCHEMA).length(RUNTIME_STATE_CLASSES.length),
		exclusions: z.array(PATH_EXCLUSION_SCHEMA),
		scanSnapshot: SCAN_SNAPSHOT_SCHEMA,
		records: z.array(MIGRATION_RECORD_SCHEMA),
	})
	.strict()
	.superRefine((inventory, context) => {
		const categories = inventory.categories.map(({ category }) => category);
		if (JSON.stringify(categories) !== JSON.stringify(MIGRATION_CATEGORIES)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['categories'],
				message: 'All mandatory categories must appear once in canonical order.',
			});
		}

		const runtimeClasses = inventory.runtimeState.map((entry) => entry.class);
		if (JSON.stringify(runtimeClasses) !== JSON.stringify(RUNTIME_STATE_CLASSES)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['runtimeState'],
				message: 'All runtime-state classes must appear once in canonical order.',
			});
		}

		const ids = new Set<string>();
		const locators = new Set<string>();
		for (const [index, record] of inventory.records.entries()) {
			if (ids.has(record.id)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['records', index, 'id'],
					message: 'Duplicate record ID.',
				});
			}
			ids.add(record.id);
			const locator = exactLocatorKey(record.locator);
			if (locators.has(locator)) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['records', index, 'locator'],
					message: 'Duplicate exact locator.',
				});
			}
			locators.add(locator);
		}

		const sorted = [...inventory.records].sort(compareMigrationRecords);
		if (inventory.records.some((record, index) => record !== sorted[index])) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['records'],
				message: 'Records must use deterministic category and code-point locator order.',
			});
		}
	});

export type MigrationInventory = z.output<typeof MIGRATION_INVENTORY_SCHEMA>;
