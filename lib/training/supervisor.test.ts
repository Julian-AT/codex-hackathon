import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TrainSupervisor } from './supervisor';

const tmpDirs: string[] = [];

async function makeCheckpointDir(iter: number) {
	const dir = await mkdtemp(path.join(tmpdir(), 'codex-supervisor-'));
	tmpDirs.push(dir);
	const checkpoint = `${String(iter).padStart(7, '0')}_adapters.safetensors`;
	await writeFile(path.join(dir, checkpoint), `ckpt-${iter}`);
	await writeFile(path.join(dir, 'adapters.safetensors'), 'latest');
	return dir;
}

describe('TrainSupervisor', () => {
	afterEach(async () => {
		await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
	});

	it('continues through a clean decreasing loss stream', () => {
		const supervisor = new TrainSupervisor();

		for (let iter = 1; iter <= 50; iter += 1) {
			expect(supervisor.ingest({ iter, loss: 2 / iter }).kind).toBe('continue');
		}
	});

	it('rolls back on two consecutive NaN losses', () => {
		const supervisor = new TrainSupervisor();

		expect(supervisor.ingest({ iter: 1, loss: Number.NaN }).kind).toBe('continue');
		expect(supervisor.ingest({ iter: 2, loss: Number.NaN })).toEqual({
			kind: 'rollback',
			reason: 'nan',
			nextRollbackIndex: 1,
		});
	});

	it('aborts after exhausting rollback budget', async () => {
		const supervisor = new TrainSupervisor();
		for (const iter of [100, 200]) {
			const dir = await makeCheckpointDir(iter);
			supervisor.ingest({ iter, loss: Number.NaN });
			expect(supervisor.ingest({ iter: iter + 1, loss: Number.NaN }).kind).toBe('rollback');
			await supervisor.performRollback(dir);
		}

		supervisor.ingest({ iter: 300, loss: Number.NaN });
		expect(supervisor.ingest({ iter: 301, loss: Number.NaN })).toEqual({
			kind: 'abort',
			reason: 'nan.unrecoverable',
		});
	});

	it('rolls back on a warm loss spike but not during warmup', () => {
		const warmup = new TrainSupervisor();
		for (let iter = 1; iter <= 4; iter += 1) {
			warmup.ingest({ iter, loss: 1 });
		}
		expect(warmup.ingest({ iter: 5, loss: 50 }).kind).toBe('continue');

		const live = new TrainSupervisor();
		for (let iter = 1; iter <= 20; iter += 1) {
			live.ingest({ iter, loss: 1 });
		}
		expect(live.ingest({ iter: 21, loss: 50 })).toEqual({
			kind: 'rollback',
			reason: 'spike',
			nextRollbackIndex: 1,
		});
	});

	it('collapses GRPO on ten low-variance rewards', () => {
		const supervisor = new TrainSupervisor();

		for (let iter = 1; iter <= 9; iter += 1) {
			expect(supervisor.ingest({ iter, reward: 0.5 }).kind).toBe('continue');
		}
		expect(supervisor.ingest({ iter: 10, reward: 0.5 })).toEqual({
			kind: 'grpo.collapsed',
			reason: 'variance',
		});
	});

	it('continues when reward variance stays above the floor', () => {
		const supervisor = new TrainSupervisor();
		const rewards = [0, 0.3, 0.6, 0.9, 0.2, 0.7, 0.1, 0.8, 0.4, 1];

		for (const [idx, reward] of rewards.entries()) {
			expect(supervisor.ingest({ iter: idx + 1, reward }).kind).toBe('continue');
		}
	});

	it('treats idle sentinel points as continue', () => {
		const supervisor = new TrainSupervisor();
		expect(supervisor.ingest({ iter: -1 })).toEqual({ kind: 'continue' });
	});

	it('turns grpo.skipped markers into collapse signals', () => {
		const supervisor = new TrainSupervisor();
		expect(supervisor.ingestRawLine('grpo.skipped reason=zero-iters (Path C)')).toEqual({
			kind: 'grpo.collapsed',
			reason: 'skipped',
		});
	});
});
