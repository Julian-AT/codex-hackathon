import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

interface OwnershipModule {
	STATE_OWNERSHIP_FILENAME: string;
	inspectStateRoot(input: { readonly root: string }): Promise<Record<string, unknown>>;
	initializeStateRoot(input: {
		readonly root: string;
		readonly adopt: boolean;
	}): Promise<Record<string, unknown>>;
}

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function sandbox(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'mlx-state-'));
	roots.push(root);
	return root;
}

async function loadOwnership(): Promise<OwnershipModule | null> {
	try {
		return (await import(
			/* @vite-ignore */ new URL('./state-ownership.ts', import.meta.url).href
		)) as OwnershipModule;
	} catch {
		return null;
	}
}

describe('state-root ownership', () => {
	it('creates only the minimal marker for a missing root and is idempotent', async () => {
		const module = await loadOwnership();
		expect(module, 'state ownership module exists').not.toBeNull();
		if (!module) return;
		const parent = await sandbox();
		const root = path.join(parent, 'new root');
		const first = await module.initializeStateRoot({ root, adopt: false });
		expect(first).toMatchObject({ ok: true, status: 'initialized', changed: true, root });
		expect(await import('node:fs/promises').then(({ readdir }) => readdir(root))).toEqual([
			module.STATE_OWNERSHIP_FILENAME,
		]);
		const markerBefore = await readFile(path.join(root, module.STATE_OWNERSHIP_FILENAME), 'utf8');
		const second = await module.initializeStateRoot({ root, adopt: false });
		expect(second).toMatchObject({ ok: true, status: 'owned', changed: false, root });
		expect(await readFile(path.join(root, module.STATE_OWNERSHIP_FILENAME), 'utf8')).toBe(
			markerBefore,
		);
	});

	it('requires explicit adoption and preserves every unrelated byte', async () => {
		const module = await loadOwnership();
		expect(module, 'state ownership module exists').not.toBeNull();
		if (!module) return;
		const root = await sandbox();
		const sentinel = path.join(root, 'foreign-state.bin');
		const bytes = Buffer.from([0, 1, 2, 255, 10]);
		await writeFile(sentinel, bytes);

		expect(await module.initializeStateRoot({ root, adopt: false })).toMatchObject({
			ok: false,
			status: 'unowned',
			changed: false,
		});
		expect(await readFile(sentinel)).toEqual(bytes);
		expect(await module.initializeStateRoot({ root, adopt: true })).toMatchObject({
			ok: true,
			status: 'adopted',
			changed: true,
		});
		expect(await readFile(sentinel)).toEqual(bytes);
	});

	it('fails closed and unchanged for root/marker symlinks, malformed JSON, and conflicting ownership', async () => {
		const module = await loadOwnership();
		expect(module, 'state ownership module exists').not.toBeNull();
		if (!module) return;
		const parent = await sandbox();
		const target = path.join(parent, 'target');
		await mkdir(target);
		const rootLink = path.join(parent, 'root-link');
		await symlink(target, rootLink);
		expect(await module.initializeStateRoot({ root: rootLink, adopt: true })).toMatchObject({
			ok: false,
			status: 'unsafe',
			changed: false,
		});

		for (const [name, marker] of [
			['malformed', '{not-json\n'],
			['conflicting', '{"schemaVersion":"1","product":"another-product","stateRootVersion":1}\n'],
		] as const) {
			const root = path.join(parent, name);
			await mkdir(root);
			const markerPath = path.join(root, module.STATE_OWNERSHIP_FILENAME);
			await writeFile(markerPath, marker);
			expect(await module.initializeStateRoot({ root, adopt: true })).toMatchObject({
				ok: false,
				status: 'unsafe',
				changed: false,
			});
			expect(await readFile(markerPath, 'utf8')).toBe(marker);
		}

		const markerLinkRoot = path.join(parent, 'marker-link');
		await mkdir(markerLinkRoot);
		const outside = path.join(parent, 'outside.json');
		await writeFile(outside, 'outside bytes\n');
		await symlink(outside, path.join(markerLinkRoot, module.STATE_OWNERSHIP_FILENAME));
		expect(await module.initializeStateRoot({ root: markerLinkRoot, adopt: true })).toMatchObject({
			ok: false,
			status: 'unsafe',
			changed: false,
		});
		expect(await readFile(outside, 'utf8')).toBe('outside bytes\n');
	});

	it('inspection alone never creates the supplied path', async () => {
		const module = await loadOwnership();
		expect(module, 'state ownership module exists').not.toBeNull();
		if (!module) return;
		const parent = await sandbox();
		const root = path.join(parent, 'missing');
		expect(await module.inspectStateRoot({ root })).toMatchObject({ status: 'missing', root });
		await expect(import('node:fs/promises').then(({ lstat }) => lstat(root))).rejects.toMatchObject(
			{
				code: 'ENOENT',
			},
		);
	});
});
