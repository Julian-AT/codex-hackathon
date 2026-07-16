import type { ValidationAggregate, ValidationResult, ValidationStatus } from './result';

export interface ValidationReportOptions {
	readonly columns?: number;
}

const EMPTY_HEADING = 'No validation results were produced.';
const EMPTY_BODY =
	'The validation run is invalid and is reported as FAIL. Inspect the checker configuration and run the command again.';

function sanitizeHumanText(value: string): string {
	let sanitized = '';
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) continue;
		sanitized += character;
	}
	return sanitized;
}

function counts(results: readonly ValidationResult[]): Record<ValidationStatus, number> {
	return results.reduce<Record<ValidationStatus, number>>(
		(accumulator, result) => {
			accumulator[result.status] += 1;
			return accumulator;
		},
		{ PASS: 0, FAIL: 0, SKIP: 0 },
	);
}

function renderWide(results: readonly ValidationResult[]): string[] {
	const lines = ['STATUS  SOURCE   CHECK ID                 REASON'];
	for (const result of results) {
		lines.push(
			`${result.status.padEnd(6)}  ${result.source.padEnd(7)}  ${result.checkId.padEnd(23)}  ${sanitizeHumanText(result.reason)}`,
		);
	}
	return lines;
}

function renderNarrow(results: readonly ValidationResult[]): string[] {
	const lines: string[] = [];
	for (const [index, result] of results.entries()) {
		if (index > 0) lines.push('');
		lines.push(`Status: ${result.status}`);
		lines.push(`Source: ${result.source}`);
		lines.push(`Check ID: ${result.checkId}`);
		lines.push(`Reason: ${sanitizeHumanText(result.reason)}`);
	}
	return lines;
}

export function renderValidationReport(
	aggregate: ValidationAggregate,
	options: ValidationReportOptions = {},
): string {
	const columns = options.columns ?? 80;
	const lines = ['Validation baseline', ''];
	lines.push(...(columns < 40 ? renderNarrow(aggregate.results) : renderWide(aggregate.results)));

	if (aggregate.results.some(({ checkId }) => checkId === 'validation.empty')) {
		lines.push('', EMPTY_HEADING, EMPTY_BODY);
	}

	const totals = counts(aggregate.results);
	lines.push(
		'',
		`Result: ${aggregate.status} — ${totals.PASS} PASS, ${totals.FAIL} FAIL, ${totals.SKIP} SKIP`,
	);
	return `${lines.join('\n')}\n`;
}
