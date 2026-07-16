import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../cli/init';
import { acquireCatalogOwner } from './catalog-owner';

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function ownedRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-owner-'));
	roots.push(root);
	await rm(root, { recursive: true });
	const initialized = await runInit({ adopt: false }, { env: { MLX_HOME: root } });
	if (!initialized.ok) throw new Error(initialized.reason);
	return root;
}

describe('catalog owner', () => {
	it('grants unique renewable mutation authority and compare-releases it', async () => {
		const root = await ownedRoot();
		let now = 1_000;
		const dependencies = {
			now: () => now,
			pid: 42,
			processStartIdentity: 'process-42-start-1',
			nonce: () => crypto.randomUUID(),
			isProcessAlive: () => true,
		};
		const first = await acquireCatalogOwner({ env: { MLX_HOME: root }, ttlMs: 100 }, dependencies);
		const contender = await acquireCatalogOwner(
			{ env: { MLX_HOME: root }, ttlMs: 100 },
			dependencies,
		);
		expect(first).toMatchObject({ ok: true });
		expect(contender).toMatchObject({ ok: false, code: 'CATALOG_OWNER_HELD' });
		if (!first.ok) return;
		now = 1_050;
		expect(await first.renew(200)).toMatchObject({ expiresAt: 1_250 });
		await first.release();
		expect(
			await acquireCatalogOwner({ env: { MLX_HOME: root }, ttlMs: 100 }, dependencies),
		).toMatchObject({ ok: true });
	});

	it('recovers an expired dead owner only through the explicit protocol', async () => {
		const root = await ownedRoot();
		let now = 10;
		const first = await acquireCatalogOwner(
			{ env: { MLX_HOME: root }, ttlMs: 5 },
			{
				now: () => now,
				pid: 999_999,
				processStartIdentity: 'dead-process',
				isProcessAlive: () => false,
			},
		);
		expect(first.ok).toBe(true);
		now = 20;
		expect(
			await acquireCatalogOwner(
				{ env: { MLX_HOME: root }, ttlMs: 5 },
				{ now: () => now, isProcessAlive: () => false },
			),
		).toMatchObject({ ok: false, code: 'CATALOG_OWNER_STALE' });
		expect(
			await acquireCatalogOwner(
				{ env: { MLX_HOME: root }, ttlMs: 5, recoverStale: true },
				{ now: () => now, isProcessAlive: () => false },
			),
		).toMatchObject({ ok: true });
	});

	it('fails closed for malformed records and changed ownership evidence', async () => {
		const root = await ownedRoot();
		const catalog = path.join(root, 'catalog');
		const ownerPath = path.join(catalog, 'mlx.sqlite3.owner');
		await mkdir(ownerPath, { recursive: true });
		await writeFile(path.join(ownerPath, 'owner.json'), '{bad json\n');
		expect(await acquireCatalogOwner({ env: { MLX_HOME: root } })).toMatchObject({
			ok: false,
			code: 'CATALOG_OWNER_MALFORMED',
		});
		expect(await readFile(path.join(ownerPath, 'owner.json'), 'utf8')).toBe('{bad json\n');

		await rm(ownerPath, { recursive: true });
		const acquired = await acquireCatalogOwner({ env: { MLX_HOME: root } });
		if (!acquired.ok) throw new Error(acquired.reason);
		const recordPath = path.join(ownerPath, 'owner.json');
		const changed = JSON.parse(await readFile(recordPath, 'utf8')) as Record<string, unknown>;
		changed.nonce = crypto.randomUUID();
		await writeFile(recordPath, `${JSON.stringify(changed)}\n`);
		await expect(acquired.release()).rejects.toThrow('ownership changed');
		expect(await readFile(recordPath, 'utf8')).toContain(String(changed.nonce));
	});
});
