import {
	type CommandLeaf,
	type OwnerPhase,
	PHASE_NAMES,
	parseCommand,
	projectHelp,
} from './command-tree';
import { renderHuman } from './render-human';
import { renderJson } from './render-json';

export const EXIT_CODES = Object.freeze({
	SUCCESS: 0,
	PARSE_ERROR: 2,
	UNAVAILABLE: 3,
	INTERNAL_ERROR: 70,
});

export type CliStatus = 'help' | 'success' | 'unavailable' | 'parse-error' | 'internal-error';

export type CliError =
	| {
			readonly code: 'UNAVAILABLE';
			readonly message: string;
			readonly ownerPhase: OwnerPhase;
	  }
	| {
			readonly code: 'INVALID_ARGUMENT' | 'UNKNOWN_COMMAND';
			readonly message: string;
			readonly input: string;
			readonly suggestion: string | null;
	  }
	| {
			readonly code: 'INTERNAL_INVARIANT';
			readonly message: string;
	  };

export interface CliEnvelope {
	readonly schemaVersion: '1';
	readonly ok: boolean;
	readonly command: string;
	readonly status: CliStatus;
	readonly data: unknown | null;
	readonly error: CliError | null;
}

export interface CliIo {
	readonly columns: number;
	readonly isTTY: boolean;
}

export interface CommandInvocation {
	readonly leaf: CommandLeaf;
	readonly arguments: Readonly<Record<string, string>>;
	readonly options: Readonly<Record<string, string | boolean>>;
}

export interface CommandExecution {
	readonly envelope: CliEnvelope;
	readonly exitCode: number;
}

export type CommandHandler = (invocation: CommandInvocation) => Promise<CommandExecution>;

export interface CliDependencies {
	readonly handlers?: Readonly<Record<string, CommandHandler>>;
	readonly renderHuman?: (envelope: CliEnvelope, columns: number) => string;
	readonly renderJson?: (envelope: CliEnvelope) => string;
}

export interface CliRunResult extends CommandExecution {
	readonly output: string;
	readonly outputMode: 'human' | 'json';
}

function envelope(
	ok: boolean,
	command: string,
	status: CliStatus,
	data: unknown | null,
	error: CliError | null,
): CliEnvelope {
	return {
		schemaVersion: '1',
		ok,
		command,
		status,
		data,
		error,
	};
}

function unavailable(leaf: CommandLeaf): CommandExecution {
	return {
		envelope: envelope(false, leaf.path.join(' '), 'unavailable', null, {
			code: 'UNAVAILABLE',
			message: 'This command is defined but is not available in Phase 1.',
			ownerPhase: leaf.ownerPhase,
		}),
		exitCode: EXIT_CODES.UNAVAILABLE,
	};
}

function renderResult(
	execution: CommandExecution,
	json: boolean,
	io: CliIo,
	dependencies: CliDependencies,
): CliRunResult {
	if (json) {
		const renderer = dependencies.renderJson ?? renderJson;
		return {
			...execution,
			output: renderer(execution.envelope),
			outputMode: 'json',
		};
	}
	const renderer = dependencies.renderHuman ?? renderHuman;
	return {
		...execution,
		output: renderer(execution.envelope, io.columns),
		outputMode: 'human',
	};
}

export async function runCli(
	args: readonly string[],
	io: CliIo,
	dependencies: CliDependencies,
): Promise<CliRunResult> {
	const parsed = parseCommand(args);
	let execution: CommandExecution;

	if (parsed.kind === 'help') {
		execution = {
			envelope: envelope(
				true,
				parsed.path.join(' ') || 'help',
				'help',
				projectHelp(parsed.path),
				null,
			),
			exitCode: EXIT_CODES.SUCCESS,
		};
	} else if (parsed.kind === 'error') {
		execution = {
			envelope: envelope(false, parsed.command, 'parse-error', null, {
				code: parsed.code,
				message: parsed.message,
				input: parsed.input,
				suggestion: parsed.suggestion,
			}),
			exitCode: EXIT_CODES.PARSE_ERROR,
		};
	} else if (parsed.leaf.availability === 'unavailable') {
		// Owner-phase shells never touch handlers or other injected dependencies.
		execution = unavailable(parsed.leaf);
	} else {
		const command = parsed.leaf.path.join(' ');
		const handler = dependencies.handlers?.[command];
		if (!handler) {
			throw new Error(`INTERNAL_INVARIANT: implemented command has no handler: ${command}.`);
		}
		execution = await handler({
			leaf: parsed.leaf,
			arguments: parsed.values.arguments,
			options: parsed.values.options,
		});
	}

	return renderResult(execution, parsed.json, io, dependencies);
}

export function unavailablePhaseName(ownerPhase: OwnerPhase): string {
	return PHASE_NAMES[ownerPhase];
}
