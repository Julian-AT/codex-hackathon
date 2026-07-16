import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MIGRATION_INVENTORY_SCHEMA } from './inventory-schema';
import { checkMigrationReview, renderMigrationReview } from './render-review';

const tempDirectories: string[] = [];

afterEach(() => {
	for (const directory of tempDirectories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

function canonicalInventory() {
	return MIGRATION_INVENTORY_SCHEMA.parse(
		JSON.parse(readFileSync('migration/legacy-assets.v1.json', 'utf8')),
	);
}

function sha256(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('renderMigrationReview', () => {
	it('renders every count, locator, owner, coverage, evidence, status, and provenance byte-identically', () => {
		const inventory = canonicalInventory();
		const first = renderMigrationReview(inventory);
		const second = renderMigrationReview(structuredClone(inventory));
		expect(second).toBe(first);
		for (const category of inventory.categories) {
			expect(first).toContain(`### ${category.category}`);
			expect(first).toContain(
				`| ${category.category} | ${category.policy} | ${category.discoveredCount} | ${category.recordCount} |`,
			);
		}
		for (const record of inventory.records) {
			expect(first).toContain(record.id);
			expect(first).toContain(record.locator.path.replaceAll('|', '\\|'));
			expect(first).toContain(record.replacementOwner.component);
			expect(first).toContain(record.provenance.discoveredBy);
		}
		expect(first).toContain('### product-string');
		expect(first).toContain('forgeprint-codex-cloud-master-prompt.md');
		expect(first).toContain('credentials-private-repositories — not-inspected');
		const removal = inventory.records.find(
			(record) => record.locator.path === 'forgeprint-codex-cloud-master-prompt.md',
		);
		expect(removal?.provenance.sourceDigest).toBeDefined();
		expect(first).toContain(`source-digest=${removal?.provenance.sourceDigest}`);
	});

	it('detects drift without rewriting the supplied review text', () => {
		const inventory = canonicalInventory();
		const expected = renderMigrationReview(inventory);
		expect(checkMigrationReview(inventory, expected)).toEqual({ ok: true, expected });
		const drifted = `${expected}\nhand edit`;
		expect(checkMigrationReview(inventory, drifted)).toEqual({ ok: false, expected });
		expect(drifted).toContain('hand edit');
	});

	it('provides a process check mode and leaves the immutable Plan 01 baseline byte-identical', () => {
		const baselinePath = 'migration/phase-1-change-scope.v1.json';
		const before = sha256(baselinePath);
		const directory = mkdtempSync(join(tmpdir(), 'mlx-migration-review-'));
		tempDirectories.push(directory);
		const jsonPath = join(directory, 'inventory.json');
		const reviewPath = join(directory, 'review.md');
		writeFileSync(jsonPath, `${JSON.stringify(canonicalInventory(), null, 2)}\n`, 'utf8');
		writeFileSync(reviewPath, renderMigrationReview(canonicalInventory()), 'utf8');

		const passing = spawnSync(
			'bun',
			['src/migration/render-review.ts', '--check', jsonPath, reviewPath],
			{ encoding: 'utf8' },
		);
		expect(passing.status).toBe(0);
		writeFileSync(reviewPath, 'drifted but must not be rewritten\n', 'utf8');
		const failing = spawnSync(
			'bun',
			['src/migration/render-review.ts', '--check', jsonPath, reviewPath],
			{ encoding: 'utf8' },
		);
		expect(failing.status).toBe(1);
		expect(failing.stderr).toContain('migration review drift');
		expect(readFileSync(reviewPath, 'utf8')).toBe('drifted but must not be rewritten\n');
		expect(sha256(baselinePath)).toBe(before);
	});
});
