import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../cli/init';
import { openCatalog } from './connection';

const roots: string[] = [];

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
		const root = makeRoot();
		await own(root);
		const connection = await openCatalog({ env: { MLX_HOME: root } });
		expect(connection.pragmas()).toEqual({
			busyTimeout: 5_000,
			foreignKeys: true,
			journalMode: 'wal',
		});
		expect(connection.schemaVersion()).toBe(1);
		connection.close();
	});

	it('rejects unowned and symlinked catalog destinations', async () => {
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
		const root = makeRoot();
		await own(root);
		const connection = await openCatalog({ env: { MLX_HOME: root } });
		expect(connection.transaction(() => 'committed')).toBe('committed');
		expect(Object.keys(connection)).not.toContain('database');
		expect(Object.keys(connection)).not.toContain('query');
		connection.close();
	});
});
