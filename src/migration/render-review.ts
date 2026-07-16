import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	MIGRATION_INVENTORY_SCHEMA,
	type MigrationInventory,
	RUNTIME_STATE_CLASSES,
	compareMigrationRecords,
} from './inventory-schema';
import { reconcileInventory, scanLegacyAssets } from './repository-scanner';

function inline(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('|', '\\|')
		.replaceAll('`', '\\`')
		.replaceAll('\r', '\\r')
		.replaceAll('\n', '\\n');
}

function evidenceSummary(inventory: MigrationInventory['records'][number]): string {
	if (inventory.replacementEvidence.length === 0) return 'none — removal remains blocked';
	return inventory.replacementEvidence
		.map(
			(evidence) => `${evidence.kind}:${evidence.locator}@${evidence.version}#${evidence.digest}`,
		)
		.join('; ');
}

function assertReconciled(inventory: MigrationInventory): void {
	const discovered = scanLegacyAssets({
		...inventory.scanSnapshot,
		exclusions: inventory.exclusions,
	});
	const result = reconcileInventory(discovered, inventory.records, inventory.categories);
	if (!result.ok) {
		throw new Error(
			`Cannot render unreconciled inventory: ${JSON.stringify({
				missing: result.missing,
				extra: result.extra,
				duplicates: result.duplicates,
				orderingErrors: result.orderingErrors,
				coverageErrors: result.coverageErrors,
			})}`,
		);
	}
}

export function renderMigrationReview(input: unknown): string {
	const inventory = MIGRATION_INVENTORY_SCHEMA.parse(input);
	assertReconciled(inventory);
	const records = [...inventory.records].sort(compareMigrationRecords);
	const lines = [
		'# MLX — the personal coding dataset and model pipeline: Legacy Migration Review',
		'',
		"> This project is distinct from Apple's MLX project and is not affiliated with or endorsed by Apple.",
		'',
		`Canonical source: \`migration/legacy-assets.v1.json\` (schema ${inventory.schemaVersion}, inventory ${inventory.inventoryVersion}).`,
		'This file is generated from validated JSON. Do not edit it by hand.',
		'',
		'## Coverage',
		'',
		'| Category | Policy | Discovered | Records | Status | Evidence |',
		'|---|---:|---:|---:|---|---|',
	];

	for (const coverage of inventory.categories) {
		lines.push(
			`| ${coverage.category} | ${coverage.policy} | ${coverage.discoveredCount} | ${coverage.recordCount} | ${coverage.status} | ${inline(coverage.policy === 'evidenced-zero' ? coverage.zeroEvidence : coverage.scanRule)} |`,
		);
	}

	lines.push('', '## Runtime-state scope', '');
	for (const runtimeClass of RUNTIME_STATE_CLASSES) {
		const scope = inventory.runtimeState.find((entry) => entry.class === runtimeClass);
		if (!scope) throw new Error(`Missing runtime-state scope: ${runtimeClass}`);
		lines.push(`- **${scope.class} — ${scope.inspection}:** ${inline(scope.reason)}`);
	}

	lines.push('', '## Exact migration records', '');
	for (const coverage of inventory.categories) {
		lines.push(`### ${coverage.category}`, '');
		const categoryRecords = records.filter((record) => record.category === coverage.category);
		if (categoryRecords.length === 0) {
			lines.push(
				`- **EVIDENCED ZERO:** ${inline(coverage.zeroEvidence ?? 'No records discovered.')}`,
				'',
			);
			continue;
		}
		for (const record of categoryRecords) {
			lines.push(
				`- **${record.id}** — \`${inline(record.locator.path)}#${record.locator.kind}=${inline(record.locator.value)}\``,
				`  - Purpose: ${inline(record.legacyPurpose)}`,
				`  - Disposition/removal: ${record.disposition} / ${record.removalStatus}`,
				`  - Owner: Phase ${record.replacementOwner.phase} / ${inline(record.replacementOwner.component)} / reviewed=${record.replacementOwner.reviewed}`,
				`  - Coverage: requirements=${record.requirementCoverage.join(', ')}; acceptance=${record.acceptanceCoverage.join(', ')}`,
				`  - Evidence: ${inline(evidenceSummary(record))}`,
				`  - Review: ${record.review.status}${record.review.status === 'approved' ? ` / ${inline(record.review.reviewer)} / ${record.review.evidenceDigest}` : ''}`,
				`  - Provenance: ${inline(record.provenance.discoveredBy)} / ${inline(record.provenance.source)} / ${inline(record.provenance.snapshot)}`,
				'',
			);
		}
	}

	lines.push('## Exact exclusions', '');
	for (const exclusion of inventory.exclusions) {
		lines.push(
			`- \`${inline(exclusion.path)}\` / ${exclusion.category} / ${inline(exclusion.rule)} — ${inline(exclusion.reason)}`,
		);
	}
	lines.push('');
	return lines.join('\n');
}

export interface MigrationReviewCheck {
	readonly ok: boolean;
	readonly expected: string;
}

export function checkMigrationReview(input: unknown, current: string): MigrationReviewCheck {
	const expected = renderMigrationReview(input);
	return { ok: current === expected, expected };
}

function run(): number {
	const args = process.argv.slice(2);
	const mode = args[0];
	const jsonPath = args[1] ?? 'migration/legacy-assets.v1.json';
	const markdownPath = args[2] ?? 'migration/legacy-assets.v1.md';
	if (mode !== '--write' && mode !== '--check') {
		process.stderr.write(
			'usage: bun src/migration/render-review.ts --write|--check [json] [markdown]\n',
		);
		return 2;
	}
	const inventory = JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown;
	const expected = renderMigrationReview(inventory);
	if (mode === '--write') {
		writeFileSync(markdownPath, expected, 'utf8');
		return 0;
	}
	const current = readFileSync(markdownPath, 'utf8');
	if (current === expected) return 0;
	process.stderr.write(`migration review drift: ${markdownPath}\n`);
	return 1;
}

const isMainModule =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) process.exitCode = run();
