import type {
	CommandArgumentSpec,
	CommandOptionSpec,
	HelpProjection,
	HelpRow,
} from './command-tree';
import { PHASE_NAMES } from './command-tree';
import type { CliEnvelope } from './main';

function hex(code: number, width: number): string {
	return code.toString(16).padStart(width, '0');
}

export function sanitizeTerminalText(value: string): string {
	let sanitized = '';
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
			if (code === 0x09) sanitized += '\\t';
			else if (code === 0x0a) sanitized += '\\n';
			else if (code === 0x0d) sanitized += '\\r';
			else if (code <= 0xff) sanitized += `\\x${hex(code, 2)}`;
			else sanitized += `\\u${hex(code, 4)}`;
		} else {
			sanitized += character;
		}
	}
	return sanitized;
}

function words(value: string): readonly string[] {
	return value.split(/\s+/u).filter(Boolean);
}

function wrap(value: string, width: number, firstPrefix = '', nextPrefix = firstPrefix): string[] {
	const safeValue = sanitizeTerminalText(value);
	const lines: string[] = [];
	let prefix = firstPrefix;
	let line = prefix;
	for (const word of words(safeValue)) {
		const separator = line.length === prefix.length ? '' : ' ';
		if (line.length > prefix.length && line.length + separator.length + word.length > width) {
			lines.push(line);
			prefix = nextPrefix;
			line = `${prefix}${word}`;
		} else {
			line += `${separator}${word}`;
		}
	}
	if (line.length > prefix.length || lines.length === 0) lines.push(line);
	return lines;
}

function availability(row: HelpRow): string {
	return row.availability === 'unavailable' ? ` (available Phase ${row.ownerPhase})` : '';
}

function renderRows(rows: readonly HelpRow[], columns: number): string[] {
	if (columns < 40) {
		return rows.flatMap((row) => [
			`  ${sanitizeTerminalText(row.command)}`,
			...wrap(`${row.description}${availability(row)}`, Math.max(columns, 1), '    ', '    '),
		]);
	}
	if (columns < 80) {
		return rows.flatMap((row) => {
			const prefix = `  ${sanitizeTerminalText(row.command)}  `;
			return wrap(`${row.description}${availability(row)}`, columns, prefix, '    ');
		});
	}
	const commandWidth = Math.max(...rows.map((row) => row.command.length), 0);
	return rows.flatMap((row) => {
		const prefix = `  ${sanitizeTerminalText(row.command).padEnd(commandWidth)}  `;
		return wrap(
			`${row.description}${availability(row)}`,
			columns,
			prefix,
			' '.repeat(prefix.length),
		);
	});
}

function optionLabel(option: CommandOptionSpec): string {
	if (option.kind === 'value') return `${option.name} <${option.valueName}>`;
	if (option.name === '--help') return '-h, --help';
	return option.name;
}

function optionDescription(option: CommandOptionSpec): string {
	if (option.name === '--json') return 'Emit one machine-readable JSON object';
	if (option.name === '--help') return 'Show help';
	if (option.name === '--private') return 'Require a private destination';
	return `Set ${option.name.slice(2)}`;
}

function renderSpecifications(
	argumentsList: readonly CommandArgumentSpec[],
	options: readonly CommandOptionSpec[],
	columns: number,
): string[] {
	const lines: string[] = [];
	if (argumentsList.length > 0) {
		lines.push('', 'Arguments:');
		for (const argument of argumentsList) {
			lines.push(
				...wrap(
					`<${argument.name}>${argument.required ? '  Required' : '  Optional'}`,
					columns,
					'  ',
					'    ',
				),
			);
		}
	}
	if (options.length > 0) {
		lines.push('', 'Options:');
		const labels = options.map(optionLabel);
		const labelWidth = Math.max(...labels.map((label) => label.length));
		for (let index = 0; index < options.length; index += 1) {
			const option = options[index];
			const label = labels[index];
			if (!option || !label) continue;
			if (columns >= 80) {
				const prefix = `  ${label.padEnd(labelWidth)}  `;
				lines.push(...wrap(optionDescription(option), columns, prefix, ' '.repeat(prefix.length)));
			} else {
				lines.push(`  ${label}`, ...wrap(optionDescription(option), columns, '    ', '    '));
			}
		}
	}
	return lines;
}

function renderHelp(help: HelpProjection, columns: number): string {
	const lines: string[] = [];
	if (help.introduction) lines.push(sanitizeTerminalText(help.introduction));
	else lines.push(sanitizeTerminalText(help.title));
	if (help.description) lines.push('', sanitizeTerminalText(help.description));
	if (help.scope === 'leaf' && help.ownerPhase !== null) {
		lines.push(
			'',
			`Availability: ${
				help.availability === 'unavailable' ? 'available' : 'implemented'
			} Phase ${help.ownerPhase}`,
		);
	}
	lines.push('', 'Usage:', ...wrap(help.usage, columns, '  ', '  '));
	if (help.rows.length > 0) lines.push('', 'Commands:', ...renderRows(help.rows, columns));
	lines.push(...renderSpecifications(help.arguments, help.options, columns));
	if (help.nextAction) lines.push('', sanitizeTerminalText(help.nextAction));
	return `${lines.join('\n')}\n`;
}

function renderUnavailable(envelope: CliEnvelope): string {
	if (!envelope.error || envelope.error.code !== 'UNAVAILABLE') {
		throw new Error('INTERNAL_INVARIANT: unavailable envelope has no unavailable error.');
	}
	const command = sanitizeTerminalText(envelope.command);
	const owner = envelope.error.ownerPhase;
	const parent = command.split(' ')[0] ?? command;
	return [
		`UNAVAILABLE  mlx ${command}`,
		'',
		sanitizeTerminalText(envelope.error.message),
		`Available in Phase ${owner}: ${sanitizeTerminalText(PHASE_NAMES[owner])}.`,
		`Run mlx ${sanitizeTerminalText(parent)} --help to inspect this command group.`,
		'',
	].join('\n');
}

function renderParseError(envelope: CliEnvelope): string {
	if (
		!envelope.error ||
		(envelope.error.code !== 'INVALID_ARGUMENT' && envelope.error.code !== 'UNKNOWN_COMMAND')
	) {
		throw new Error('INTERNAL_INVARIANT: parse-error envelope has no parse error.');
	}
	const command = sanitizeTerminalText(envelope.command);
	const lines = [
		`${envelope.error.code}  mlx${command ? ` ${command}` : ''}`,
		'',
		sanitizeTerminalText(envelope.error.message),
	];
	if (envelope.error.suggestion) {
		lines.push(`Did you mean ${sanitizeTerminalText(envelope.error.suggestion)}?`);
	}
	lines.push('');
	return lines.join('\n');
}

function renderInit(envelope: CliEnvelope): string {
	if (envelope.error) {
		if (
			envelope.error.code !== 'INVALID_MLX_HOME' &&
			envelope.error.code !== 'UNOWNED_STATE_ROOT' &&
			envelope.error.code !== 'UNSAFE_STATE_ROOT'
		) {
			throw new Error('INTERNAL_INVARIANT: init state-error has an unrelated error.');
		}
		return [
			`${sanitizeTerminalText(envelope.error.code)}  mlx init`,
			'',
			envelope.error.root === null
				? 'Root: unresolved'
				: `Root: "${sanitizeTerminalText(envelope.error.root)}"`,
			`Reason: ${sanitizeTerminalText(envelope.error.message)}`,
			'Changed: no',
			`Safe action: ${sanitizeTerminalText(envelope.error.action)}`,
			'',
		].join('\n');
	}
	const result = envelope.data as {
		readonly root: string;
		readonly status: string;
		readonly changed: boolean;
	};
	return [
		'MLX state root ready',
		'',
		`Root: "${sanitizeTerminalText(result.root)}"`,
		`Ownership: ${sanitizeTerminalText(result.status)}`,
		`Changed: ${result.changed ? 'yes' : 'no'}`,
		'',
	].join('\n');
}

export function renderHuman(envelope: CliEnvelope, columns = 80): string {
	const safeColumns = Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 80;
	if (envelope.status === 'help') {
		return renderHelp(envelope.data as HelpProjection, safeColumns);
	}
	if (envelope.status === 'unavailable') return renderUnavailable(envelope);
	if (envelope.status === 'parse-error') return renderParseError(envelope);
	if (envelope.command === 'init') return renderInit(envelope);
	if (envelope.error) {
		return `${sanitizeTerminalText(envelope.error.code)}  ${sanitizeTerminalText(envelope.error.message)}\n`;
	}
	return `${sanitizeTerminalText(envelope.command)}\n`;
}
