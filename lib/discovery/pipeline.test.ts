import { copyFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CORPUS, DynamicToolSpec } from './types';

const MANIFEST = path.resolve('data/adapter-tools.json');
const MANIFEST_BAK = `${MANIFEST}.test-bak`;

async function loadMockCandidates(): Promise<DynamicToolSpec[]> {
	const raw = JSON.parse(
		await readFile(path.resolve('lib/discovery/__fixtures__/mock-candidates.json'), 'utf8'),
	);
	return raw.map((c: { spec: DynamicToolSpec }) => c.spec);
}

const emptyCorpus: CORPUS = {
	chunks: [],
	byTopic: {},
	fetchedAt: '',
	sourceBytes: 0,
};

describe('runDiscoveryPipeline (integration with mock candidates)', () => {
	beforeEach(async () => {
		vi.resetModules();
		try {
			await copyFile(MANIFEST, MANIFEST_BAK);
		} catch {
			// ignore if missing
		}
		try {
			await rm(MANIFEST);
		} catch {
			// ignore if missing
		}
	});

	afterEach(async () => {
		try {
			await copyFile(MANIFEST_BAK, MANIFEST);
			await rm(MANIFEST_BAK);
		} catch {
			// backup may not exist if test created a new manifest
		}
	});

	it('12 mock candidates -> survivors -> manifest written with source=swarm', async () => {
		const candidates = await loadMockCandidates();
		vi.doMock('./swarm.js', () => ({
			designToolsSwarm: async () => candidates,
		}));
		const { runDiscoveryPipeline } = await import('./pipeline.js');
		// With 12 fixtures, only ~2 pass all 5 gates. Use low thresholds so
		// the swarm path succeeds (killMin: 1, floorMin: 1).
		const result = await runDiscoveryPipeline({
			corpus: emptyCorpus,
			killMin: 1,
			floorMin: 1,
			capMax: 12,
		});
		expect(result.source).toBe('swarm');
		expect(result.tools.length).toBeGreaterThanOrEqual(1);

		const written = JSON.parse(await readFile(MANIFEST, 'utf8'));
		expect(written.source).toBe('swarm');
		expect(written.count).toBeGreaterThanOrEqual(1);
		expect(written.tools.every((t: { type: string }) => t.type === 'function')).toBe(true);
		vi.doUnmock('./swarm.js');
	}, 120_000);

	it('empty swarm output -> KillPointError -> fallback copied (source=fallback, count=8)', async () => {
		vi.doMock('./swarm.js', () => ({
			designToolsSwarm: async () => [],
		}));
		const { runDiscoveryPipeline, KillPointError } = await import('./pipeline.js');
		await expect(runDiscoveryPipeline({ corpus: emptyCorpus })).rejects.toBeInstanceOf(
			KillPointError,
		);

		const written = JSON.parse(await readFile(MANIFEST, 'utf8'));
		expect(written.source).toBe('fallback');
		expect(written.count).toBe(8);
		vi.doUnmock('./swarm.js');
	}, 120_000);
});
