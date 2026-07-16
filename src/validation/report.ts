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

function splitLongWord(word: string, width: number): string[] {
	const characters = [...word];
	const chunks: string[] = [];
	for (let index = 0; index < characters.length; index += width) {
		chunks.push(characters.slice(index, index + width).join(''));
	}
	return chunks;
}

function wrapText(value: string, width: number): string[] {
	if (width < 1) return [value];
	const words = value.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [''];
	const lines: string[] = [];
	let current = '';

	for (const word of words) {
		const parts = [...word].length > width ? splitLongWord(word, width) : [word];
		for (const part of parts) {
			if (current.length === 0) {
				current = part;
			} else if ([...`${current} ${part}`].length <= width) {
				current = `${current} ${part}`;
			} else {
				lines.push(current);
				current = part;
			}
			if ([...current].length === width && parts.length > 1) {
				lines.push(current);
				current = '';
			}
		}
	}
	if (current.length > 0) lines.push(current);
	return lines;
}

function prefixedLines(prefix: string, value: string, columns: number, indent = 4): string[] {
	const firstWidth = Math.max(1, columns - [...prefix].length);
	const continuationPrefix = ' '.repeat(Math.min(indent, Math.max(0, columns - 1)));
	const continuationWidth = Math.max(1, columns - continuationPrefix.length);
	const firstPass = wrapText(value, firstWidth);
	const lines = [`${prefix}${firstPass[0] ?? ''}`];
	for (const overflow of firstPass.slice(1)) {
		for (const line of wrapText(overflow, continuationWidth)) {
			lines.push(`${continuationPrefix}${line}`);
		}
	}
	return lines;
}

function renderWide(results: readonly ValidationResult[], columns: number): string[] {
	const lines = ['STATUS  SOURCE   CHECK ID                 REASON'];
	for (const result of results) {
		lines.push(
			...prefixedLines(
				`${result.status.padEnd(6)}  ${result.source.padEnd(7)}  ${result.checkId.padEnd(23)}  `,
				sanitizeHumanText(result.reason),
				columns,
			),
		);
	}
	return lines;
}

function renderMedium(results: readonly ValidationResult[], columns: number): string[] {
	const lines = ['STATUS  SOURCE   CHECK ID'];
	for (const result of results) {
		lines.push(`${result.status.padEnd(6)}  ${result.source.padEnd(7)}  ${result.checkId}`);
		lines.push(...prefixedLines('    ', sanitizeHumanText(result.reason), columns));
	}
	return lines;
}

function renderNarrow(results: readonly ValidationResult[], columns: number): string[] {
	const lines: string[] = [];
	for (const [index, result] of results.entries()) {
		if (index > 0) lines.push('');
		lines.push(`Status: ${result.status}`);
		lines.push(`Source: ${result.source}`);
		lines.push(`Check ID: ${result.checkId}`);
		lines.push(...prefixedLines('Reason: ', sanitizeHumanText(result.reason), columns));
	}
	return lines;
}

function appendWrapped(lines: string[], value: string, columns: number): void {
	lines.push(...wrapText(value, Math.max(1, columns)));
}

export function renderValidationReport(
	aggregate: ValidationAggregate,
	options: ValidationReportOptions = {},
): string {
	const columns = options.columns ?? 80;
	const lines = ['Validation baseline', ''];
	if (columns < 40) {
		lines.push(...renderNarrow(aggregate.results, columns));
	} else if (columns < 80) {
		lines.push(...renderMedium(aggregate.results, columns));
	} else {
		lines.push(...renderWide(aggregate.results, columns));
	}

	if (aggregate.results.some(({ checkId }) => checkId === 'validation.empty')) {
		lines.push('');
		appendWrapped(lines, EMPTY_HEADING, columns);
		appendWrapped(lines, EMPTY_BODY, columns);
	}

	const totals = counts(aggregate.results);
	lines.push('');
	appendWrapped(
		lines,
		`Result: ${aggregate.status} — ${totals.PASS} PASS, ${totals.FAIL} FAIL, ${totals.SKIP} SKIP`,
		columns,
	);
	return `${lines.join('\n')}\n`;
}
