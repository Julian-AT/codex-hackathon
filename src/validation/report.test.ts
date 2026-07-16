import { describe, expect, it } from 'vitest';

import { type ValidationAggregate, aggregateValidationResults } from './result';

interface ReportApi {
	renderValidationReport(aggregate: ValidationAggregate, options?: { columns?: number }): string;
}

async function loadReportApi(): Promise<ReportApi | null> {
	try {
		const moduleUrl = new URL('./report.ts', import.meta.url).href;
		return (await import(moduleUrl)) as ReportApi;
	} catch {
		return null;
	}
}

async function requireReportApi(): Promise<ReportApi> {
	const api = await loadReportApi();
	expect(api, 'validation report behavior is not implemented').not.toBeNull();
	if (!api) throw new Error('validation report behavior is not implemented');
	return api;
}

const populated = aggregateValidationResults([
	{ checkId: 'check', status: 'PASS', source: 'LIVE', reason: 'Biome passed.' },
	{
		checkId: 'test:integration',
		status: 'PASS',
		source: 'FIXTURE',
		reason: 'Synthetic process fixture passed.',
	},
	{
		checkId: 'local:check',
		status: 'SKIP',
		source: 'LIVE',
		reason: 'Apple Silicon is unavailable.',
		capability: { id: 'apple-silicon', available: false, reason: 'Not arm64.' },
	},
	{
		checkId: 'studio:build',
		status: 'FAIL',
		source: 'LIVE',
		reason: 'Studio is not implemented; owned by Phase 8.',
	},
]);

describe('renderValidationReport', () => {
	it('shows every fixed-order status/source/check/reason row before the failure-dominant aggregate', async () => {
		const { renderValidationReport } = await requireReportApi();
		const output = renderValidationReport(populated, { columns: 80 });
		const positions = populated.results.map(({ checkId }) => output.indexOf(checkId));

		expect(output).toMatch(/^Validation baseline\n\nSTATUS\s+SOURCE\s+CHECK ID\s+REASON/m);
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		expect(output.indexOf('Result: FAIL')).toBeGreaterThan(positions.at(-1) ?? -1);
		expect(output).toContain('1 FAIL');
		expect(output).toContain('1 SKIP');
		expect(output).toContain('2 PASS');
	});

	it('renders the approved explicit empty-result failure copy', async () => {
		const { renderValidationReport } = await requireReportApi();
		const output = renderValidationReport(aggregateValidationResults([]), { columns: 80 });

		expect(output).toContain('No validation results were produced.');
		expect(output.replaceAll(/\s+/g, ' ')).toContain(
			'The validation run is invalid and is reported as FAIL. Inspect the checker configuration and run the command again.',
		);
		expect(output).toContain('Result: FAIL');
	});

	it.each([80, 40, 39] as const)(
		'keeps decisive evidence complete and within the %i-column layout contract',
		async (columns) => {
			const { renderValidationReport } = await requireReportApi();
			const output = renderValidationReport(populated, { columns });

			for (const result of populated.results) {
				expect(output).toContain(result.status);
				expect(output).toContain(result.source);
				expect(output).toContain(result.checkId);
				expect(output.replaceAll(/\s+/g, ' ')).toContain(result.reason);
			}
			if (columns < 40) {
				expect(output).toContain('Status: PASS');
				expect(output).toContain('Check ID: check');
			} else {
				expect(output).toContain('STATUS');
			}
		},
	);

	it.each([80, 40, 39] as const)(
		'wraps every ordinary line to the configured %i-column boundary without ellipsis',
		async (columns) => {
			const { renderValidationReport } = await requireReportApi();
			const output = renderValidationReport(populated, { columns });

			expect(output).not.toContain('…');
			for (const line of output.trimEnd().split('\n')) {
				expect([...line].length, line).toBeLessThanOrEqual(columns);
			}
		},
	);

	it('retains zero, one, and many rows without decorative or aggregate-only substitution', async () => {
		const { renderValidationReport } = await requireReportApi();
		const one = aggregateValidationResults([
			{ checkId: 'typecheck', status: 'PASS', source: 'LIVE', reason: 'Passed.' },
		]);

		expect(renderValidationReport(one, { columns: 80 })).toContain('typecheck');
		expect(
			renderValidationReport(populated, { columns: 80 }).match(/\b(?:PASS|FAIL|SKIP)\b/g),
		).toHaveLength(8);
		expect(renderValidationReport(aggregateValidationResults([]), { columns: 80 })).toContain(
			'validation.empty',
		);
	});

	it('sanitizes terminal controls without clipping long Unicode evidence', async () => {
		const { renderValidationReport } = await requireReportApi();
		const aggregate = aggregateValidationResults([
			{
				checkId: 'check',
				status: 'FAIL',
				source: 'LIVE',
				reason: `unsafe\u001b[31m\u0007 ${'very-long-évidence '.repeat(6).trim()}`,
			},
		]);
		const output = renderValidationReport(aggregate, { columns: 40 });

		expect(output).not.toContain('\u001b');
		expect(output).not.toContain('\u0007');
		expect(output).toContain('[31m');
		expect(output.replaceAll(/\s+/g, ' ')).toContain('very-long-évidence very-long-évidence');
	});

	it('is byte-stable for identical controlled input', async () => {
		const { renderValidationReport } = await requireReportApi();
		expect(renderValidationReport(populated, { columns: 80 })).toBe(
			renderValidationReport(populated, { columns: 80 }),
		);
	});
});
