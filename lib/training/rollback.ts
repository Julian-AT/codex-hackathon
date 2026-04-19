import { copyFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const CKPT_RE = /^(\d{7})_adapters\.safetensors$/;

/**
 * Find the highest-numbered adapter checkpoint in `adapterDir` and copy it
 * over `adapters.safetensors`. Returns the iteration number rolled back to.
 */
export async function rollbackToLatestCheckpoint(adapterDir: string): Promise<number> {
	const entries = await readdir(adapterDir);
	const numbered = entries
		.map((name) => CKPT_RE.exec(name))
		.filter((match): match is RegExpExecArray => match !== null)
		.sort((a, b) => Number(b[1]) - Number(a[1]));

	if (numbered.length === 0) {
		throw new Error(`no numbered checkpoint to revert to in ${adapterDir}`);
	}

	const latest = numbered[0];
	await copyFile(join(adapterDir, latest[0]), join(adapterDir, 'adapters.safetensors'));
	return Number(latest[1]);
}
