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
				productionSourceDeletions?: unknown[];
			};
		};
		expect(manifest.operatorOwnedDeletions).toContain('src/app.tsx');
		expect(manifest.phase1FinalOwnership?.baselineSha256).toBe(
			'012397cb2e5651535cf7eea7e24250bcbe38ced0f9debe60ebe692a1ebf06677',
		);
		expect(manifest.phase1FinalOwnership?.productionSourceDeletions).toEqual([]);
	});
});
