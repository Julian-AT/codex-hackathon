import { describe, expect, it, vi } from 'vitest';

const moduleUrl = new URL('./repository-scanner.ts', import.meta.url).href;

async function loadScannerModule(): Promise<Record<string, unknown>> {
	try {
		return (await import(moduleUrl)) as Record<string, unknown>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return {};
		throw error;
	}
}

function requireExport<T>(module: Record<string, unknown>, name: string): T {
	const value = module[name];
	expect(value, `MISSING_BEHAVIOR: repository scanner export ${name}`).toBeDefined();
	return value as T;
}

const ARCHIVE_ROOT = '.planning/milestones/legacy-2026-04-pre-mlx-phases';

export const REQUIRED_ARCHIVED_PLANNING_PATHS = [
	'01-foundation-smoke/01-01-SUMMARY.md',
	'01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md',
	'01-foundation-smoke/01-02-SUMMARY.md',
	'01-foundation-smoke/01-02-python-venv-microbench-PLAN.md',
	'01-foundation-smoke/01-03-SUMMARY.md',
	'01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md',
	'01-foundation-smoke/01-04-SUMMARY.md',
	'01-foundation-smoke/01-04-adapter-hotswap-PLAN.md',
	'01-foundation-smoke/01-05-SUMMARY.md',
	'01-foundation-smoke/01-05-toolregistry-parser-roundtrip-PLAN.md',
	'02-orchestrator-harness/02-01-SUMMARY.md',
	'02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md',
	'02-orchestrator-harness/02-02-SUMMARY.md',
	'02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md',
	'02-orchestrator-harness/02-03-SUMMARY.md',
	'02-orchestrator-harness/02-03-agent-grid-demo-page-PLAN.md',
	'02-orchestrator-harness/02-RESEARCH.md',
	'03-discovery-tool-design/03-01-SUMMARY.md',
	'03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md',
	'03-discovery-tool-design/03-02-SUMMARY.md',
	'03-discovery-tool-design/03-02-validator-gates-PLAN.md',
	'03-discovery-tool-design/03-03-SUMMARY.md',
	'03-discovery-tool-design/03-03-tool-design-worker-PLAN.md',
	'03-discovery-tool-design/03-04-SUMMARY.md',
	'03-discovery-tool-design/03-04-swarm-pipeline-manifest-PLAN.md',
	'03-discovery-tool-design/03-05-SUMMARY.md',
	'03-discovery-tool-design/03-05-fallback-hand-written-tools-PLAN.md',
	'03-discovery-tool-design/03-RESEARCH.md',
	'03-discovery-tool-design/03-VERIFICATION.md',
	'03-discovery-tool-design/deferred-items.md',
	'04-data-eval-gen/04-01-SUMMARY.md',
	'04-data-eval-gen/04-01-doc-split-types-personas-PLAN.md',
	'04-data-eval-gen/04-02-SUMMARY.md',
	'04-data-eval-gen/04-02-schema-gate-dedup-stratify-PLAN.md',
	'04-data-eval-gen/04-03-SUMMARY.md',
	'04-data-eval-gen/04-03-data-gen-qa-worker-PLAN.md',
	'04-data-eval-gen/04-04-SUMMARY.md',
	'04-data-eval-gen/04-04-data-gen-traj-worker-PLAN.md',
	'04-data-eval-gen/04-05-SUMMARY.md',
	'04-data-eval-gen/04-05-judge-pipeline-eval-emission-PLAN.md',
	'04-data-eval-gen/04-PLAN-INDEX.md',
	'04-data-eval-gen/04-VERIFICATION.md',
	'05-train-model-a/05-01-SUMMARY.md',
	'05-train-model-a/05-01-smoke-and-version-bump-PLAN.md',
	'05-train-model-a/05-01-smoke-notes.md',
	'05-train-model-a/05-02-SUMMARY.md',
	'05-train-model-a/05-02-training-scripts-PLAN.md',
	'05-train-model-a/05-03-supervisor-rollback-transform-PLAN.md',
	'05-train-model-a/05-04-e2e-notes.md',
	'05-train-model-a/05-04-integration-e2e-PLAN.md',
	'05-train-model-a/05-CONTEXT.md',
	'05-train-model-a/05-RESEARCH.md',
	'06-fuse-deploy-verify-cassette/06-01-fuse-deploy-scripts-PLAN.md',
	'06-fuse-deploy-verify-cassette/06-02-ios-chatview-statuspill-toolsloader-PLAN.md',
	'06-fuse-deploy-verify-cassette/06-03-verify-battery-cassette-PLAN.md',
].map((path) => `${ARCHIVE_ROOT}/${path}`);

function syntheticSnapshot() {
	const sensitiveRead = vi.fn(() => {
		throw new Error('sensitive content must remain unopened');
	});
	return {
		input: {
			trackedPaths: [
				'scripts/train.sh',
				'ios/SpecialistApp/ChatView.swift',
				'data/adapter-tools.json',
			],
			planningPaths: REQUIRED_ARCHIVED_PLANNING_PATHS,
			sourceDeclarations: [
				{
					category: 'legacy-command',
					locator: { path: 'src/commands/index.ts', kind: 'command', value: '/pipeline' },
				},
				{
					category: 'executable-name',
					locator: { path: 'package.json', kind: 'executable', value: 'bun start' },
				},
				{
					category: 'runtime-path',
					locator: { path: 'src/lib/config.ts', kind: 'expression', value: '<cwd>/.codex/settings.json' },
				},
				{
					category: 'product-string',
					locator: { path: 'src/repl.tsx', kind: 'literal', value: 'retained brownfield UI' },
				},
				{
					category: 'dynamic-tool-path',
					locator: { path: 'lib/discovery/worker.ts', kind: 'symbol', value: 'generateToolCandidate' },
				},
			],
			evidencedZeroCategories: [],
			exclusions: [
				{
					path: '.planning/migrations/2026-07-15-legacy-planning-inventory.md',
					category: 'product-string',
					rule: 'historical-internal-record',
					reason: 'Historical provenance is not public product copy.',
				},
			],
			unopenedSensitivePaths: [
				'.env.local',
				'/Users/operator',
				'.mlx/mirrors/private.git',
				'data/models/e4b',
				'data/adapters/private',
				'data/raw-traces/session.json',
			],
			readSensitivePath: sensitiveRead,
		},
		sensitiveRead,
	};
}

describe('scanLegacyAssets', () => {
	it('discovers all nine categories and all 55 archived planning paths without opening sensitive roots', async () => {
		const module = await loadScannerModule();
		const scanLegacyAssets = requireExport<(input: unknown) => readonly { category: string; locator: { path: string } }[]>(
			module,
			'scanLegacyAssets',
		);
		const { input, sensitiveRead } = syntheticSnapshot();
		const first = scanLegacyAssets(input);
		const second = scanLegacyAssets(input);
		expect(second).toEqual(first);
		expect(sensitiveRead).not.toHaveBeenCalled();
		expect(new Set(first.map(({ category }) => category))).toEqual(
			new Set([
				'legacy-command',
				'executable-name',
				'runtime-path',
				'generated-artifact',
				'script',
				'product-string',
				'dynamic-tool-path',
				'ios-component',
				'planning-artifact',
			]),
		);
		expect(
			first
				.filter(({ category }) => category === 'planning-artifact')
				.map(({ locator }) => locator.path),
		).toEqual(REQUIRED_ARCHIVED_PLANNING_PATHS);
	});

	it('rejects broad exclusions and explains genuinely evidenced-zero categories', async () => {
		const module = await loadScannerModule();
		const scanLegacyAssets = requireExport<(input: unknown) => unknown>(module, 'scanLegacyAssets');
		const { input } = syntheticSnapshot();
		expect(() =>
			scanLegacyAssets({ ...input, exclusions: [{ ...input.exclusions[0], path: 'docs/**' }] }),
		).toThrow(/exact|broad|wildcard/i);
		expect(() =>
			scanLegacyAssets({
				...input,
				sourceDeclarations: input.sourceDeclarations.filter(
					(declaration) => declaration.category !== 'product-string',
				),
				evidencedZeroCategories: [],
			}),
		).toThrow(/product-string|zero/i);
	});
});

describe('reconcileInventory', () => {
	it('fails for omitted, extra, duplicate, or nondeterministically ordered locators', async () => {
		const module = await loadScannerModule();
		const scanLegacyAssets = requireExport<(input: unknown) => readonly unknown[]>(module, 'scanLegacyAssets');
		const reconcileInventory = requireExport<
			(discovered: readonly unknown[], records: readonly unknown[], categories: readonly unknown[]) => {
				ok: boolean;
				missing: readonly string[];
				extra: readonly string[];
				duplicates: readonly string[];
				orderingErrors: readonly string[];
			}
		>(module, 'reconcileInventory');
		const { input } = syntheticSnapshot();
		const discovered = scanLegacyAssets(input) as readonly {
			category: string;
			locator: { path: string; kind: string; value: string };
		}[];
		const records = discovered.map((item, index) => ({ ...item, id: `record-${index}` }));
		const categories = [
			'legacy-command',
			'executable-name',
			'runtime-path',
			'generated-artifact',
			'script',
			'product-string',
			'dynamic-tool-path',
			'ios-component',
			'planning-artifact',
		].map((category) => ({
			category,
			policy: 'records',
			discoveredCount: discovered.filter((item) => item.category === category).length,
			recordCount: records.filter((item) => item.category === category).length,
			status: 'reconciled',
		}));

		expect(reconcileInventory(discovered, records, categories).ok).toBe(true);
		expect(reconcileInventory(discovered, records.slice(1), categories).missing).not.toHaveLength(0);
		expect(reconcileInventory(discovered, [...records, records[0]], categories).duplicates).not.toHaveLength(0);
		expect(
			reconcileInventory(discovered, [...records].reverse(), categories).orderingErrors,
		).not.toHaveLength(0);
		expect(
			reconcileInventory(discovered, [
				...records,
				{
					...records[0],
					locator: { path: 'extra.ts', kind: 'file', value: 'extra.ts' },
				},
			], categories).extra,
		).not.toHaveLength(0);
	});
});
