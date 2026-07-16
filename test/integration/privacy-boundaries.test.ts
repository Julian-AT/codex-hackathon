import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { VALIDATION_SCRIPT_NAMES } from '../../src/validation/check-catalog';
import { runValidationProcessEntry } from '../../src/validation/process-entry';
import type { ProcessRequest } from '../../src/validation/runner';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('validation privacy boundaries', () => {
	it('touches no egress, private-state, repository, model, or training seam', async () => {
		const fetchDeny = vi.fn(async () => {
			throw new Error('network access denied');
		});
		vi.stubGlobal('fetch', fetchDeny);

		const requests: ProcessRequest[] = [];
		const probe = vi.fn(async () => ({
			id: 'apple-silicon' as const,
			available: false as const,
			reason: 'Injected capability is unavailable.',
		}));
		for (const checkId of VALIDATION_SCRIPT_NAMES) {
			const kind = checkId === 'test:integration' ? 'external' : 'run';
			await runValidationProcessEntry([kind, checkId, '--json'], {
				createRunner: () => ({
					async run(request) {
						requests.push(request);
						return { exitCode: 0, stdout: 'FIXTURE', stderr: '' };
					},
				}),
				createProbe: () => probe,
				write: vi.fn(),
				setExitCode: vi.fn(),
				columns: 80,
				isTTY: false,
			});
		}

		expect(fetchDeny).not.toHaveBeenCalled();
		expect(probe).toHaveBeenCalledTimes(1);
		expect(requests).toHaveLength(4);
		const serialized = JSON.stringify(requests).toLowerCase();
		for (const forbidden of [
			'github',
			'huggingface',
			'gh ',
			'git clone',
			'upload',
			'publish',
			'credential',
			'.mlx',
			'.codex',
			'mirror',
			'model',
			'train',
		]) {
			expect(serialized).not.toContain(forbidden);
		}
	});

	it('fixture, privacy, and final change ownership use durable synthetic evidence', () => {
		const fixturePath = resolve('fixtures/phase-1/validation/adapter-tools.json');
		expect(existsSync(fixturePath), 'committed synthetic adapter-tools fixture').toBe(true);

		const manifest = JSON.parse(
			readFileSync(resolve('migration/phase-1-change-scope.v1.json'), 'utf8'),
		) as {
			operatorOwnedDeletions?: string[];
			phase1FinalOwnership?: {
				baselineSha256?: string;
				operatorBaseline?: {
					operatorOwnedDeletion?: {
						path?: string;
						status?: { porcelain?: string };
						head?: { blob?: string };
						unstagedHunks?: Array<{ sha256?: string }>;
					};
				};
				plans?: Array<{
					plan?: string;
					commits?: Array<{
						changes?: Array<{ path?: string; patchSha256?: string; hunks?: unknown[] }>;
					}>;
				}>;
				overlaps?: Array<{
					path?: string;
					operatorUnstagedHunks?: unknown[];
					phase1Hunks?: unknown[];
				}>;
				pendingFinalTask?: { paths?: Array<{ path?: string; patchSha256?: string }> };
				postAcceptanceRepair?: {
					paths?: Array<{ path?: string; patchSha256?: string }>;
				};
				productionSourceDeletions?: unknown[];
			};
		};
		expect(manifest.operatorOwnedDeletions).toContain('src/app.tsx');
		const ownership = manifest.phase1FinalOwnership;
		expect(ownership?.baselineSha256).toBe(
			'012397cb2e5651535cf7eea7e24250bcbe38ced0f9debe60ebe692a1ebf06677',
		);
		expect(ownership?.operatorBaseline?.operatorOwnedDeletion).toMatchObject({
			path: 'src/app.tsx',
			status: { porcelain: ' D' },
			head: { blob: '22d515baa7c6cd83ddacd7ac24bb6bed2e1bac49' },
		});
		expect(ownership?.operatorBaseline?.operatorOwnedDeletion?.unstagedHunks).toEqual([
			expect.objectContaining({
				sha256: '3513c1af66df91ae152d6242b00a63fc99b6dc843843631d27a7896eb43b3d9b',
			}),
		]);

		expect(ownership?.plans?.map(({ plan }) => plan)).toEqual(
			Array.from({ length: 9 }, (_, index) => `01-${String(index + 1).padStart(2, '0')}`),
		);
		for (const plan of ownership?.plans ?? []) {
			expect(plan.commits?.length, `${plan.plan} commit ownership`).toBeGreaterThan(0);
			for (const commit of plan.commits ?? []) {
				for (const change of commit.changes ?? []) {
					expect(change.path).toBeTruthy();
					expect(change.patchSha256).toMatch(/^[a-f0-9]{64}$/);
					expect(change.hunks).toBeInstanceOf(Array);
				}
			}
		}
		for (const overlap of ownership?.overlaps ?? []) {
			expect(
				overlap.operatorUnstagedHunks?.length,
				`${overlap.path} operator hunks`,
			).toBeGreaterThan(0);
			expect(overlap.phase1Hunks?.length, `${overlap.path} Phase 1 hunks`).toBeGreaterThan(0);
		}
		expect(ownership?.pendingFinalTask?.paths?.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				'fixtures/phase-1/validation/adapter-tools.json',
				'lib/data/schema-gate.test.ts',
				'test/integration/privacy-boundaries.test.ts',
			]),
		);
		for (const path of ownership?.pendingFinalTask?.paths ?? []) {
			expect(path.patchSha256).toMatch(/^[a-f0-9]{64}$/);
		}
		expect(ownership?.postAcceptanceRepair?.paths?.map(({ path }) => path)).toEqual([
			'biome.json',
			'test/integration/privacy-boundaries.test.ts',
		]);
		for (const path of ownership?.postAcceptanceRepair?.paths ?? []) {
			expect(path.patchSha256).toMatch(/^[a-f0-9]{64}$/);
		}
		expect(ownership?.productionSourceDeletions).toEqual([]);
	});
});
