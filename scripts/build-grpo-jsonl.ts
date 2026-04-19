import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transformSftToGrpo } from '../lib/training/transformGrpoJsonl';

async function main() {
	const inputPath = process.argv[2] ?? 'data/training.jsonl';
	const outputDir = process.argv[3] ?? 'data/training/grpo';
	const splitRatio = Number(process.argv[4] ?? '0.9');

	const content = await readFile(path.resolve(inputPath), 'utf8');
	const rows = transformSftToGrpo(content.split('\n'));
	const splitIndex = Math.max(1, Math.floor(rows.length * splitRatio));
	const trainRows = rows.slice(0, splitIndex);
	const validRows = rows.slice(splitIndex);
	const safeValidRows = validRows.length ? validRows : trainRows.slice(-1);

	await mkdir(path.resolve(outputDir), { recursive: true });
	await writeFile(
		path.resolve(outputDir, 'train.jsonl'),
		`${trainRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
		'utf8',
	);
	await writeFile(
		path.resolve(outputDir, 'valid.jsonl'),
		`${safeValidRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
		'utf8',
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
