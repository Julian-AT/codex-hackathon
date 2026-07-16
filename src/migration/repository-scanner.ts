import {
	type CategoryCoverage,
	type ExactLocator,
	MIGRATION_CATEGORIES,
	type MigrationCategory,
	type MigrationRecord,
	PATH_EXCLUSION_SCHEMA,
	type PathExclusion,
	compareCodePoint,
	compareMigrationRecords,
	exactLocatorKey,
	migrationLocatorKey,
} from './inventory-schema';

export type { MigrationCategory } from './inventory-schema';

export interface DiscoveredLocator {
	readonly category: MigrationCategory;
	readonly locator: ExactLocator;
}

export interface SourceDeclaration extends DiscoveredLocator {}

export interface RepositoryScanInput {
	readonly trackedPaths: readonly string[];
	readonly planningPaths: readonly string[];
	readonly sourceDeclarations: readonly SourceDeclaration[];
	readonly evidencedZeroCategories: readonly MigrationCategory[];
	readonly exclusions?: readonly PathExclusion[];
	readonly unopenedSensitivePaths?: readonly string[];
	readonly readSensitivePath?: (path: string) => unknown;
}

export interface ReconciliationResult {
	readonly ok: boolean;
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly duplicates: readonly string[];
	readonly orderingErrors: readonly string[];
	readonly coverageErrors: readonly string[];
}

function trackedLocator(category: MigrationCategory, path: string): DiscoveredLocator {
	return { category, locator: { path, kind: 'file', value: path } };
}

function assertSafeTrackedPath(path: string): void {
	if (
		path.startsWith('/') ||
		path.includes('\0') ||
		path.split('/').includes('..') ||
		['.env.local', '.mlx', '.codex', 'models', 'adapters', 'raw-traces', 'mirrors'].some(
			(segment) => path === segment || path.startsWith(`${segment}/`),
		)
	) {
		throw new Error(`Unsafe or private scanner path is out of scope: ${path}`);
	}
}

function validateExclusions(exclusions: readonly PathExclusion[]): void {
	for (const exclusion of exclusions) {
		const parsed = PATH_EXCLUSION_SCHEMA.safeParse(exclusion);
		if (!parsed.success) {
			throw new Error(
				`Path exclusions must use an exact path without broad or wildcard rules: ${exclusion.path}`,
			);
		}
	}
	const keys = exclusions.map(({ category, path }) => `${category}\u0000${path}`);
	if (new Set(keys).size !== keys.length) throw new Error('Duplicate exact path exclusion.');
}

function isExcluded(locator: DiscoveredLocator, exclusions: readonly PathExclusion[]): boolean {
	return exclusions.some(
		(exclusion) =>
			exclusion.category === locator.category && exclusion.path === locator.locator.path,
	);
}

export function compareDiscoveredLocators(
	left: DiscoveredLocator,
	right: DiscoveredLocator,
): number {
	const categoryOrder =
		MIGRATION_CATEGORIES.indexOf(left.category) - MIGRATION_CATEGORIES.indexOf(right.category);
	return (
		categoryOrder || compareCodePoint(exactLocatorKey(left.locator), exactLocatorKey(right.locator))
	);
}

export function scanLegacyAssets(input: RepositoryScanInput): readonly DiscoveredLocator[] {
	const exclusions = input.exclusions ?? [];
	validateExclusions(exclusions);
	for (const path of [...input.trackedPaths, ...input.planningPaths]) assertSafeTrackedPath(path);

	const discovered: DiscoveredLocator[] = [];
	for (const path of input.trackedPaths) {
		if (path.startsWith('scripts/')) discovered.push(trackedLocator('script', path));
		if (path.startsWith('ios/SpecialistApp/'))
			discovered.push(trackedLocator('ios-component', path));
		if (path.startsWith('data/')) discovered.push(trackedLocator('generated-artifact', path));
	}
	for (const path of input.planningPaths) {
		discovered.push(trackedLocator('planning-artifact', path));
	}
	for (const declaration of input.sourceDeclarations) {
		assertSafeTrackedPath(declaration.locator.path);
		discovered.push({ category: declaration.category, locator: { ...declaration.locator } });
	}

	const included = discovered.filter((locator) => !isExcluded(locator, exclusions));
	const keys = included.map(({ category, locator }) => migrationLocatorKey(category, locator));
	const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
	if (duplicates.length > 0)
		throw new Error(`Duplicate discovered locators: ${duplicates.join(', ')}`);

	for (const category of MIGRATION_CATEGORIES) {
		const count = included.filter((locator) => locator.category === category).length;
		if (count === 0 && !input.evidencedZeroCategories.includes(category)) {
			throw new Error(`Mandatory category ${category} has zero records without zero evidence.`);
		}
	}

	return included.sort(compareDiscoveredLocators);
}

function duplicateKeys(values: readonly string[]): string[] {
	return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort(
		compareCodePoint,
	);
}

export function reconcileInventory(
	discovered: readonly DiscoveredLocator[],
	records: readonly Pick<MigrationRecord, 'id' | 'category' | 'locator'>[],
	categories: readonly Pick<
		CategoryCoverage,
		'category' | 'policy' | 'discoveredCount' | 'recordCount' | 'status'
	>[],
): ReconciliationResult {
	const discoveredKeys = discovered.map(({ category, locator }) =>
		migrationLocatorKey(category, locator),
	);
	const recordKeys = records.map(({ category, locator }) => migrationLocatorKey(category, locator));
	const discoveredSet = new Set(discoveredKeys);
	const recordSet = new Set(recordKeys);
	const missing = [...discoveredSet].filter((key) => !recordSet.has(key)).sort(compareCodePoint);
	const extra = [...recordSet].filter((key) => !discoveredSet.has(key)).sort(compareCodePoint);
	const duplicates = [
		...duplicateKeys(discoveredKeys).map((key) => `discovered:${key}`),
		...duplicateKeys(recordKeys).map((key) => `record:${key}`),
	].sort(compareCodePoint);

	const expectedOrder = [...records].sort(compareMigrationRecords);
	const orderingErrors = records.some((record, index) => record !== expectedOrder[index])
		? ['records:not-in-canonical-order']
		: [];

	const coverageErrors: string[] = [];
	for (const category of MIGRATION_CATEGORIES) {
		const coverage = categories.find((entry) => entry.category === category);
		const discoveredCount = discovered.filter((item) => item.category === category).length;
		const recordCount = records.filter((item) => item.category === category).length;
		if (!coverage) {
			coverageErrors.push(`${category}:missing-coverage`);
			continue;
		}
		if (
			coverage.discoveredCount !== discoveredCount ||
			coverage.recordCount !== recordCount ||
			coverage.status !== 'reconciled' ||
			(coverage.policy === 'evidenced-zero' && (discoveredCount !== 0 || recordCount !== 0)) ||
			(coverage.policy === 'records' && (discoveredCount === 0 || recordCount === 0))
		) {
			coverageErrors.push(`${category}:count-or-policy-mismatch`);
		}
	}
	if (categories.length !== MIGRATION_CATEGORIES.length) {
		coverageErrors.push('mandatory-category-count-mismatch');
	}

	return {
		ok:
			missing.length === 0 &&
			extra.length === 0 &&
			duplicates.length === 0 &&
			orderingErrors.length === 0 &&
			coverageErrors.length === 0,
		missing,
		extra,
		duplicates,
		orderingErrors,
		coverageErrors,
	};
}
