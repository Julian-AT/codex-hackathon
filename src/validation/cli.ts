import type { CheckDescriptor } from './check-catalog';
import {
	type ValidationAggregate,
	type ValidationResult,
	aggregateValidationResults,
} from './result';

export interface ValidationCliIo {
	readonly columns: number;
	readonly isTTY: boolean;
	writeStdout(value: string): void;
	writeStderr(value: string): void;
}

export interface ValidationCliDependencies {
	readonly getCheckDescriptor: (checkId: string) => CheckDescriptor | null;
	readonly runCheck: (descriptor: CheckDescriptor) => Promise<ValidationResult>;
	readonly runBaseline: () => Promise<ValidationAggregate>;
	readonly renderHuman?: (aggregate: ValidationAggregate, columns: number) => string;
}

export const VALIDATION_EXIT_CODES = Object.freeze({
	PASS: 0,
	FAIL: 1,
	INVALID: 2,
	INTERRUPTED: 130,
} as const);

interface ValidationJsonEnvelope {
	readonly schemaVersion: '1';
	readonly ok: boolean;
	readonly command: string;
	readonly status: string;
	readonly data: { readonly results: readonly ValidationResult[] } | null;
	readonly error: { readonly code: string; readonly message: string } | null;
}

function serializeJson(envelope: ValidationJsonEnvelope): string {
	const ordered = {
		schemaVersion: envelope.schemaVersion,
		ok: envelope.ok,
		command: envelope.command,
		status: envelope.status,
		data: envelope.data,
		error: envelope.error,
	};
	return `${JSON.stringify(ordered)}\n`;
}

function isInterrupted(aggregate: ValidationAggregate): boolean {
	return aggregate.results.some((result) => /\binterrupted\b/i.test(result.reason));
}

function exitFor(aggregate: ValidationAggregate): number {
	if (isInterrupted(aggregate)) return VALIDATION_EXIT_CODES.INTERRUPTED;
	return aggregate.status === 'FAIL' ? VALIDATION_EXIT_CODES.FAIL : VALIDATION_EXIT_CODES.PASS;
}

async function defaultHumanRenderer(
	aggregate: ValidationAggregate,
	columns: number,
): Promise<string> {
	const { renderValidationReport } = await import('./report');
	return renderValidationReport(aggregate, { columns });
}

function invalidEnvelope(command: string, code: string, message: string): ValidationJsonEnvelope {
	return {
		schemaVersion: '1',
		ok: false,
		command,
		status: 'invalid',
		data: null,
		error: { code, message },
	};
}

export async function runValidationCli(
	argv: readonly string[],
	io: ValidationCliIo,
	dependencies: ValidationCliDependencies,
): Promise<number> {
	const json = argv.includes('--json');
	const tokens = argv.filter((token) => token !== '--json');
	let command = tokens[0] === 'run' ? 'validation run' : 'validation baseline';
	let aggregate: ValidationAggregate | null = null;
	let invalid: ValidationJsonEnvelope | null = null;

	if (tokens[0] === 'baseline' && tokens.length === 1) {
		aggregate = await dependencies.runBaseline();
	} else if (tokens[0] === 'run' && tokens.length === 2) {
		const descriptor = dependencies.getCheckDescriptor(tokens[1] ?? '');
		if (descriptor) {
			aggregate = aggregateValidationResults([await dependencies.runCheck(descriptor)]);
		} else {
			invalid = invalidEnvelope(
				command,
				'UNKNOWN_CHECK',
				`Unknown validation check: ${tokens[1]}.`,
			);
		}
	} else {
		command = 'validation';
		invalid = invalidEnvelope(
			command,
			'INVALID_INVOCATION',
			'Expected validation run <check-id> or validation baseline.',
		);
	}

	if (invalid) {
		const output = json
			? serializeJson(invalid)
			: `${invalid.error?.message ?? 'Invalid invocation.'}\n`;
		(json ? io.writeStdout : io.writeStderr)(output);
		return VALIDATION_EXIT_CODES.INVALID;
	}
	if (!aggregate) {
		const fallback = invalidEnvelope(
			command,
			'INVALID_RESULT',
			'Validation produced no aggregate.',
		);
		(json ? io.writeStdout : io.writeStderr)(
			json ? serializeJson(fallback) : `${fallback.error?.message}\n`,
		);
		return VALIDATION_EXIT_CODES.INVALID;
	}

	const exitCode = exitFor(aggregate);
	if (json) {
		io.writeStdout(
			serializeJson({
				schemaVersion: '1',
				ok: aggregate.status !== 'FAIL',
				command,
				status: aggregate.status,
				data: { results: aggregate.results },
				error:
					aggregate.status === 'FAIL'
						? { code: 'VALIDATION_FAILED', message: 'One or more validation checks failed.' }
						: null,
			}),
		);
	} else {
		const output = dependencies.renderHuman
			? dependencies.renderHuman(aggregate, io.columns)
			: await defaultHumanRenderer(aggregate, io.columns);
		io.writeStdout(output);
	}
	return exitCode;
}
