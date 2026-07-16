import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

interface FixtureSource {
	path: string;
	category: string;
	content: string;
}

interface IdentityFixture {
	canonicalPhrase: string;
	appleDistinction: string;
	requiredCategories: string[];
	sources: FixtureSource[];
	rules: Array<{
		id: string;
		kind: string;
		category: string;
		paths: string[];
	}>;
	exclusions: Array<{ path: string; ruleId: string; rationale: string }>;
}

type AuditModule = typeof import('./audit');

async function loadAuditModule(): Promise<AuditModule> {
	const modulePath = path.resolve(import.meta.dirname, 'audit.ts');
	try {
		await readFile(modulePath, 'utf8');
		return await import(/* @vite-ignore */ pathToFileURL(modulePath).href);
	} catch {
		return {
			auditIdentity: async () => ({
				schemaVersion: '1',
				ok: false,
				scannedPaths: [],
				categoryCounts: [],
				exclusions: [],
				findings: [
					{
						category: 'configuration',
						path: 'src/identity/audit.ts',
						ruleId: 'identity-audit-missing',
						message: 'The deterministic identity audit is not implemented.',
					},
				],
			}),
		} as unknown as AuditModule;
	}
}

async function loadFixture(): Promise<IdentityFixture> {
	const fixturePath = path.resolve(
		import.meta.dirname,
		'../../fixtures/phase-1/identity/scoped-tree.json',
	);
	return JSON.parse(await readFile(fixturePath, 'utf8')) as IdentityFixture;
}

function optionsFromFixture(fixture: IdentityFixture) {
	const content = new Map(fixture.sources.map((source) => [source.path, source.content]));
	return {
		root: '/synthetic/mlx-identity-root',
		sources: fixture.sources.map(({ path: sourcePath, category }) => ({
			path: sourcePath,
			category,
		})),
		rules: fixture.rules,
		exclusions: fixture.exclusions,
		requiredCategories: fixture.requiredCategories,
		readText: vi.fn(async (sourcePath: string) => {
			const value = content.get(sourcePath);
			if (value === undefined) throw new Error(`Unexpected read: ${sourcePath}`);
			return value;
		}),
	};
}

describe('auditIdentity', () => {
	it('accepts canonical first mentions, Apple distinction, exact exclusions, and evidenced zero image assets', async () => {
		const fixture = await loadFixture();
		const { auditIdentity } = await loadAuditModule();
		const options = optionsFromFixture(fixture);

		const report = await auditIdentity(options);

		expect(report.ok).toBe(true);
		expect(report.findings).toEqual([]);
		expect(report.scannedPaths).toEqual(fixture.sources.map(({ path }) => path).sort());
		expect(report.categoryCounts).toContainEqual({ category: 'screenshots', count: 0 });
		expect(report.exclusions).toEqual(fixture.exclusions);
		expect(options.readText).toHaveBeenCalledTimes(fixture.sources.length);
	});

	it('reports exact path/rule findings in fixed category then code-point order', async () => {
		const fixture = await loadFixture();
		const { auditIdentity } = await loadAuditModule();
		const options = optionsFromFixture(fixture);
		const broken = new Map([
			['README.md', `MLX utilities\n\n${fixture.appleDistinction}\n`],
			['generated/help.txt', 'codex command help\n'],
			[
				'generated/package-description.txt',
				`${fixture.canonicalPhrase}. Shared executable name.\n`,
			],
		]);
		options.readText.mockImplementation(async (sourcePath: string) => {
			const source = broken.get(sourcePath) ?? fixture.sources.find(({ path }) => path === sourcePath)?.content;
			if (source === undefined) throw new Error(`Unexpected read: ${sourcePath}`);
			return source;
		});

		const first = await auditIdentity(options);
		const second = await auditIdentity(options);

		expect(first).toEqual(second);
		expect(first.ok).toBe(false);
		expect(first.findings.map(({ path, ruleId }) => `${path}:${ruleId}`)).toEqual([
			'generated/package-description.txt:apple-distinction',
			'README.md:canonical-first-mention',
			'generated/help.txt:canonical-first-mention',
			'generated/help.txt:forbidden-product-brand',
		]);
	});

	it('rejects broad exclusions instead of letting them hide user-facing text', async () => {
		const fixture = await loadFixture();
		const { auditIdentity } = await loadAuditModule();
		const options = optionsFromFixture(fixture);
		options.exclusions = [
			...options.exclusions,
			{
				path: 'generated/**',
				ruleId: 'forbidden-product-brand',
				rationale: 'Broad exclusion that must be rejected.',
			},
		];

		const report = await auditIdentity(options);

		expect(report.ok).toBe(false);
		expect(report.findings).toContainEqual({
			category: 'configuration',
			path: 'generated/**',
			ruleId: 'invalid-exclusion',
			message: 'Identity exclusions must name one exact safe relative path and rule.',
		});
	});

	it('rejects private, operator, traversal, and generated-data roots before reading', async () => {
		const fixture = await loadFixture();
		const { auditIdentity } = await loadAuditModule();
		const denied = [
			'.env.local',
			'.mlx/config/config.json',
			'.codex/settings.json',
			'mirrors/private.git/HEAD',
			'models/adapter.safetensors',
			'adapters/run-1/adapter.json',
			'raw-traces/session.json',
			'../operator-home/.ssh/id_ed25519',
		];
		const readText = vi.fn(async () => {
			throw new Error('Denied paths must never be opened.');
		});

		const report = await auditIdentity({
			root: '/synthetic/mlx-identity-root',
			sources: denied.map((sourcePath) => ({ path: sourcePath, category: 'private' })),
			rules: fixture.rules,
			exclusions: [],
			requiredCategories: fixture.requiredCategories,
			readText,
		});

		expect(readText).not.toHaveBeenCalled();
		expect(report.ok).toBe(false);
		expect(report.findings).toHaveLength(denied.length);
		expect(report.findings.every(({ ruleId }) => ruleId === 'unsafe-source-path')).toBe(true);
	});
});
