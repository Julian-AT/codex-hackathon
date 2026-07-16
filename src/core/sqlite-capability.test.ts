import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runInit } from '../cli/init';
import { probeSqliteCapability } from './sqlite-capability';

const roots: string[] = [];
const isBunRuntime = 'bun' in process.versions;
let delegatedFailure: string | null = null;

beforeAll(() => {
	if (isBunRuntime) return;
	const result = spawnSync('bun', ['test', fileURLToPath(import.meta.url)], { encoding: 'utf8' });
	if (result.status !== 0) delegatedFailure = `${result.stdout}\n${result.stderr}`;
});

function requireBunRuntime(): boolean {
	if (isBunRuntime) return true;
	expect(delegatedFailure).toBeNull();
	return false;
}

async function ownedRoot(): Promise<string> {
	const root = mkdtempSync(path.join(tmpdir(), 'mlx-sqlite-capability-'));
	roots.push(root);
	rmSync(root, { recursive: true });
	const initialized = await runInit({ adopt: false }, { env: { MLX_HOME: root } });
	if (!initialized.ok) throw new Error(initialized.reason);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('SQLite capability probe', () => {
	it('reports the actual embedded version and proves bounded WAL concurrency', async () => {
		if (!requireBunRuntime()) return;
		const root = await ownedRoot();
		const evidence = await probeSqliteCapability({ env: { MLX_HOME: root } });
		expect(evidence.sqliteVersion).toMatch(/^3\.\d+\.\d+/);
		expect(evidence).toMatchObject({
			journalMode: 'wal',
			foreignKeys: true,
			concurrency: { status: 'pass', contenders: 2, committedWrites: 50 },
			multiOwnerMutationAllowed: true,
		});
	});

	it('is repeatable and removes every isolated capability database', async () => {
		if (!requireBunRuntime()) return;
		const root = await ownedRoot();
		for (let run = 0; run < 2; run += 1) {
			expect(await probeSqliteCapability({ env: { MLX_HOME: root } })).toMatchObject({
				concurrency: { status: 'pass' },
			});
		}
		expect(readdirSync(path.join(root, 'catalog'))).toEqual([]);
	});

	it('fails closed without writing when the state root is not owned', async () => {
		if (!requireBunRuntime()) return;
		const root = mkdtempSync(path.join(tmpdir(), 'mlx-sqlite-unowned-'));
		roots.push(root);
		expect(await probeSqliteCapability({ env: { MLX_HOME: root } })).toMatchObject({
			concurrency: { status: 'error' },
			multiOwnerMutationAllowed: false,
		});
		expect(readdirSync(root)).toEqual([]);
	});
});
