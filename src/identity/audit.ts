import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const CANONICAL_PRODUCT_INTRODUCTION =
	'MLX — the personal coding dataset and model pipeline' as const;

const CATEGORY_ORDER = [
	'configuration',
	'apple-distinction',
	'first-mention',
	'forbidden-branding',
] as const;

const FORBIDDEN_SEGMENTS = new Set([
	'.codex',
	'.mlx',
	'adapters',
	'mirrors',
	'models',
	'raw-traces',
]);

export type IdentityAuditRuleKind =
	| 'canonical-first-mention'
	| 'forbidden-product-brand'
	| 'apple-distinction';

export interface IdentityAuditRule {
	readonly id: string;
	readonly kind: IdentityAuditRuleKind;
	readonly category: string;
	readonly paths: readonly string[];
}

export interface IdentityAuditSource {
	readonly path: string;
	readonly category: string;
}

export interface IdentityAuditExclusion {
	readonly path: string;
	readonly ruleId: string;
	readonly rationale: string;
}

export interface IdentityFinding {
	readonly category: string;
	readonly path: string;
	readonly ruleId: string;
	readonly message: string;
}

export interface IdentityAuditReport {
	readonly schemaVersion: '1';
	readonly ok: boolean;
	readonly scannedPaths: readonly string[];
	readonly categoryCounts: ReadonlyArray<{ readonly category: string; readonly count: number }>;
	readonly exclusions: readonly IdentityAuditExclusion[];
	readonly findings: readonly IdentityFinding[];
}

export interface IdentityAuditOptions {
	readonly root: string;
	readonly sources: readonly IdentityAuditSource[];
	readonly rules: readonly IdentityAuditRule[];
	readonly exclusions: readonly IdentityAuditExclusion[];
	readonly requiredCategories: readonly string[];
	readonly readText?: (relativePath: string) => Promise<string>;
}

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function categoryRank(category: string): number {
	const rank = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
	return rank === -1 ? CATEGORY_ORDER.length : rank;
}

function sortFindings(findings: readonly IdentityFinding[]): IdentityFinding[] {
	return [...findings].sort((left, right) => {
		const categoryDelta = categoryRank(left.category) - categoryRank(right.category);
		if (categoryDelta !== 0) return categoryDelta;
		const pathDelta = compareCodePoints(left.path, right.path);
		return pathDelta !== 0 ? pathDelta : compareCodePoints(left.ruleId, right.ruleId);
	});
}

function isSafeRelativePath(relativePath: string): boolean {
	if (
		relativePath.length === 0 ||
		path.posix.isAbsolute(relativePath) ||
		path.win32.isAbsolute(relativePath) ||
		relativePath.includes('\0') ||
		/[?*[\]]/.test(relativePath)
	) {
		return false;
	}
	const segments = relativePath.split('/');
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..'))
		return false;
	const lowered = segments.map((segment) => segment.toLowerCase());
	if (lowered.includes('.env.local')) return false;
	return lowered.every((segment) => !FORBIDDEN_SEGMENTS.has(segment));
}

function isContained(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return (
		relative === '' ||
		(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
	);
}

async function readContainedText(root: string, relativePath: string): Promise<string> {
	const canonicalRoot = await realpath(root);
	const canonicalFile = await realpath(path.resolve(root, relativePath));
	if (!isContained(canonicalRoot, canonicalFile)) {
		throw new Error('Identity source resolves outside the configured root.');
	}
	return await readFile(canonicalFile, 'utf8');
}

function validatesExclusion(
	exclusion: IdentityAuditExclusion,
	rulesById: ReadonlyMap<string, IdentityAuditRule>,
): boolean {
	const rule = rulesById.get(exclusion.ruleId);
	return (
		isSafeRelativePath(exclusion.path) &&
		exclusion.rationale.trim().length > 0 &&
		rule !== undefined &&
		rule.paths.includes(exclusion.path)
	);
}

function findingForRule(
	rule: IdentityAuditRule,
	sourcePath: string,
	content: string,
): IdentityFinding | null {
	if (rule.kind === 'canonical-first-mention') {
		const firstVisibleText = content.trimStart().replace(/^#+\s+/, '');
		if (firstVisibleText.startsWith(CANONICAL_PRODUCT_INTRODUCTION)) return null;
		return {
			category: rule.category,
			path: sourcePath,
			ruleId: rule.id,
			message: `The first product mention must be exactly "${CANONICAL_PRODUCT_INTRODUCTION}".`,
		};
	}
	if (rule.kind === 'apple-distinction') {
		const distinguishesApple = /distinct from Apple['’]s MLX project/i.test(content);
		const deniesAffiliation = /not affiliated with or endorsed by Apple/i.test(content);
		if (distinguishesApple && deniesAffiliation) return null;
		return {
			category: rule.category,
			path: sourcePath,
			ruleId: rule.id,
			message:
				"Product copy must distinguish Apple's MLX project and deny affiliation or endorsement.",
		};
	}
	if (!/\b(?:forgeprint|codex)\b/i.test(content)) return null;
	return {
		category: rule.category,
		path: sourcePath,
		ruleId: rule.id,
		message: 'Forbidden legacy product branding remains in a scoped user-facing artifact.',
	};
}

export async function auditIdentity(options: IdentityAuditOptions): Promise<IdentityAuditReport> {
	const findings: IdentityFinding[] = [];
	const rulesById = new Map(options.rules.map((rule) => [rule.id, rule]));
	const validExclusions = options.exclusions
		.filter((exclusion) => {
			const valid = validatesExclusion(exclusion, rulesById);
			if (!valid) {
				findings.push({
					category: 'configuration',
					path: exclusion.path,
					ruleId: 'invalid-exclusion',
					message: 'Identity exclusions must name one exact safe relative path and rule.',
				});
			}
			return valid;
		})
		.sort((left, right) => {
			const pathDelta = compareCodePoints(left.path, right.path);
			return pathDelta !== 0 ? pathDelta : compareCodePoints(left.ruleId, right.ruleId);
		});
	const excluded = new Set(
		validExclusions.map(({ path: sourcePath, ruleId }) => `${sourcePath}\0${ruleId}`),
	);
	const safeSources: IdentityAuditSource[] = [];
	const sourceContent = new Map<string, string>();
	const readText =
		options.readText ?? ((sourcePath: string) => readContainedText(options.root, sourcePath));

	for (const source of options.sources) {
		if (!isSafeRelativePath(source.path)) {
			findings.push({
				category: 'configuration',
				path: source.path,
				ruleId: 'unsafe-source-path',
				message: 'Identity audit source must be an exact safe repository-relative path.',
			});
			continue;
		}
		try {
			sourceContent.set(source.path, await readText(source.path));
			safeSources.push(source);
		} catch {
			findings.push({
				category: 'configuration',
				path: source.path,
				ruleId: 'source-read-failed',
				message: 'A declared identity source could not be read inside the configured root.',
			});
		}
	}

	for (const rule of options.rules) {
		for (const sourcePath of rule.paths) {
			if (excluded.has(`${sourcePath}\0${rule.id}`)) continue;
			const content = sourceContent.get(sourcePath);
			if (content === undefined) continue;
			const finding = findingForRule(rule, sourcePath, content);
			if (finding !== null) findings.push(finding);
		}
	}

	const categoryCount = new Map(options.requiredCategories.map((category) => [category, 0]));
	for (const source of safeSources) {
		categoryCount.set(source.category, (categoryCount.get(source.category) ?? 0) + 1);
	}

	const sortedFindings = sortFindings(findings);
	return {
		schemaVersion: '1',
		ok: sortedFindings.length === 0,
		scannedPaths: safeSources.map(({ path: sourcePath }) => sourcePath).sort(compareCodePoints),
		categoryCounts: [...categoryCount].map(([category, count]) => ({ category, count })),
		exclusions: validExclusions,
		findings: sortedFindings,
	};
}
