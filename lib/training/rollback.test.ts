import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rollbackToLatestCheckpoint } from './rollback';

const tmpDirs: string[] = [];

async function makeTmpDir() {
	const dir = await mkdtemp(path.join(tmpdir(), 'codex-rollback-'));
	tmpDirs.push(dir);
	return dir;
}

describe('rollbackToLatestCheckpoint', () => {
	afterEach(async () => {
		await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
	});

	it('copies the highest-numbered checkpoint over adapters.safetensors', async () => {
		const dir = await makeTmpDir();
		await writeFile(path.join(dir, '0000100_adapters.safetensors'), 'older');
		await writeFile(path.join(dir, '0000200_adapters.safetensors'), 'newer');
		await writeFile(path.join(dir, 'adapters.safetensors'), 'current');

		const iter = await rollbackToLatestCheckpoint(dir);

		expect(iter).toBe(200);
		expect(await readFile(path.join(dir, 'adapters.safetensors'), 'utf8')).toBe('newer');
	});

	it('ignores alpha order and still picks the highest iter', async () => {
		const dir = await makeTmpDir();
		await writeFile(path.join(dir, '0000100_adapters.safetensors'), '100');
		await writeFile(path.join(dir, '0000050_adapters.safetensors'), '50');
		await writeFile(path.join(dir, 'adapters.safetensors'), 'latest');

		const iter = await rollbackToLatestCheckpoint(dir);

		expect(iter).toBe(100);
		expect(await readFile(path.join(dir, 'adapters.safetensors'), 'utf8')).toBe('100');
	});

	it('throws when only the latest adapter exists', async () => {
		const dir = await makeTmpDir();
		await writeFile(path.join(dir, 'adapters.safetensors'), 'current');

		await expect(rollbackToLatestCheckpoint(dir)).rejects.toThrow(/no numbered checkpoint/i);
	});

	it('throws for an empty directory', async () => {
		const dir = await makeTmpDir();

		await expect(rollbackToLatestCheckpoint(dir)).rejects.toThrow(/no numbered checkpoint/i);
	});

	it('ignores non-matching files', async () => {
		const dir = await makeTmpDir();
		await writeFile(path.join(dir, 'random.safetensors'), 'x');
		await writeFile(path.join(dir, 'foo.bin'), 'x');
		await writeFile(path.join(dir, '0000100_config.json'), '{}');
		await writeFile(path.join(dir, '0000300_adapters.safetensors'), '300');
		await writeFile(path.join(dir, 'adapters.safetensors'), 'latest');

		const iter = await rollbackToLatestCheckpoint(dir);

		expect(iter).toBe(300);
		expect(await readFile(path.join(dir, 'adapters.safetensors'), 'utf8')).toBe('300');
	});
});
