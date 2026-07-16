import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runInit } from '../cli/init';
import { openCatalog } from './connection';

const roots: string[] = [];
const isBunRuntime = 'bun' in process.versions;
let delegatedFailure: string | null = null;

beforeAll(() => {
	if (isBunRuntime) return;
	const result = spawnSync('bun', ['test', fileURLToPath(import.meta.url)], {
		encoding: 'utf8',
	});
	if (result.status !== 0) delegatedFailure = `${result.stdout}\n${result.stderr}`;
});

function requireBunRuntime(): boolean {
	if (isBunRuntime) return true;
	expect(delegatedFailure).toBeNull();
	return false;
}

function makeRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'mlx-connection-'));
	roots.push(root);
	return root;
}

async function own(root: string): Promise<void> {
	rmSync(root, { recursive: true });
	const initialized = await runInit({ adopt: false }, { env: { MLX_HOME: root } });
	if (!initialized.ok) throw new Error(initialized.reason);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('openCatalog', () => {
	it('opens only an owned root with verified durable pragmas', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await own(root);
		const connection = await openCatalog({ env: { MLX_HOME: root } });
		expect(connection.pragmas()).toEqual({
			busyTimeout: 5_000,
			foreignKeys: true,
			journalMode: 'wal',
		});
		expect(connection.schemaVersion()).toBe(3);
		connection.close();
	});

	it('rejects unowned and symlinked catalog destinations', async () => {
		if (!requireBunRuntime()) return;
		const unowned = makeRoot();
		await expect(openCatalog({ env: { MLX_HOME: unowned } })).rejects.toMatchObject({
			code: 'UNOWNED_ROOT',
		});

		const owned = makeRoot();
		const outside = makeRoot();
		await own(owned);
		symlinkSync(outside, path.join(owned, 'catalog'));
		await expect(openCatalog({ env: { MLX_HOME: owned } })).rejects.toThrow('paths.catalog');
	});

	it('provides a transaction boundary without exposing caller-selected SQL', async () => {
		if (!requireBunRuntime()) return;
		const root = makeRoot();
		await own(root);
		const connection = await openCatalog({ env: { MLX_HOME: root } });
		expect(connection.transaction(() => 'committed')).toBe('committed');
		expect(Object.keys(connection)).not.toContain('database');
		expect(Object.keys(connection)).not.toContain('query');
		connection.close();
	});
});
