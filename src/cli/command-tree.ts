export type OwnerPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type CommandAvailability = 'implemented' | 'unavailable';

export interface CommandArgumentSpec {
	readonly name: string;
	readonly required: boolean;
}

export interface CommandOptionSpec {
	readonly name: `--${string}`;
	readonly kind: 'flag' | 'value';
	readonly valueName?: string;
	readonly allowedValues?: readonly string[];
	readonly required?: boolean;
}

export interface CommandLeaf {
	readonly path: readonly string[];
	readonly description: string;
	readonly ownerPhase: OwnerPhase;
	readonly availability: CommandAvailability;
	readonly arguments: readonly CommandArgumentSpec[];
	readonly options: readonly CommandOptionSpec[];
}

export interface ParsedCommandValues {
	readonly arguments: Readonly<Record<string, string>>;
	readonly options: Readonly<Record<string, string | boolean>>;
}

export type ParseResult =
	| {
			readonly kind: 'help';
			readonly json: boolean;
			readonly path: readonly string[];
	  }
	| {
			readonly kind: 'command';
			readonly json: boolean;
			readonly leaf: CommandLeaf;
			readonly values: ParsedCommandValues;
	  }
	| {
			readonly kind: 'error';
			readonly json: boolean;
			readonly code: 'INVALID_ARGUMENT' | 'UNKNOWN_COMMAND';
			readonly command: string;
			readonly input: string;
			readonly message: string;
			readonly suggestion: string | null;
	  };

export interface HelpRow {
	readonly command: string;
	readonly description: string;
	readonly ownerPhase: OwnerPhase;
	readonly availability: CommandAvailability;
}

export interface HelpProjection {
	readonly scope: 'root' | 'parent' | 'leaf';
	readonly title: string;
	readonly introduction: string | null;
	readonly usage: string;
	readonly description: string | null;
	readonly rows: readonly HelpRow[];
	readonly arguments: readonly CommandArgumentSpec[];
	readonly options: readonly CommandOptionSpec[];
	readonly ownerPhase: OwnerPhase | null;
	readonly availability: CommandAvailability | null;
	readonly nextAction: string | null;
}

export const PHASE_NAMES: Readonly<Record<OwnerPhase, string>> = Object.freeze({
	1: 'Identity, cleanup, baseline, and migration map',
	2: 'Foundation: configuration, SQLite, CAS, runs, and job queue',
	3: 'GitHub inventory, mirrors, identities, and accurate metrics',
	4: 'Evidence extraction, accepted-state quality, and preference profile',
	5: 'Hugging Face dataset compiler, deduplication, and leakage-safe splits',
	6: 'Runtime tools, worktrees, MLX PersonalBench, and model adapters',
	7: 'Apple Silicon MLX-LM training, experiment tracking, and paired evaluation',
	8: 'Studio, presentation mode, privacy review, and end-to-end acceptance',
});

const COMMAND_DEFINITIONS = [
	command(['doctor'], 'Check executable ownership and local environment', 1),
	command(['init'], 'Initialize explicitly owned local state', 1),
	command(['auth', 'status'], 'Show authentication status', 3),
	command(['repos', 'scan'], 'Scan explicitly authorized repositories', 3),
	command(['repos', 'review'], 'Review repository inclusion decisions', 3),
	command(['repos', 'set'], 'Set the evidence mode for one repository', 3, {
		arguments: [{ name: 'repo', required: true }],
		options: [
			{
				name: '--mode',
				kind: 'value',
				valueName: 'included|excluded|holdout|metrics-only',
				allowedValues: ['included', 'excluded', 'holdout', 'metrics-only'],
				required: true,
			},
		],
	}),
	command(['mirror'], 'Mirror explicitly selected repositories', 3),
	command(['metrics', 'build'], 'Build deterministic engineering metrics', 3),
	command(['metrics', 'show'], 'Show engineering metrics', 3),
	command(['evidence', 'build'], 'Build provenance-rich accepted-state evidence', 4),
	command(['preferences', 'build'], 'Build the hierarchical preference profile', 4),
	command(['dataset', 'build'], 'Build a versioned Hugging Face-native dataset', 5, {
		options: [
			{
				name: '--profile',
				kind: 'value',
				valueName: 'smoke|presentation|core|full',
				allowedValues: ['smoke', 'presentation', 'core', 'full'],
			},
		],
	}),
	command(['dataset', 'validate'], 'Validate dataset contracts and leakage controls', 5),
	command(['dataset', 'inspect'], 'Inspect canonical dataset configurations', 5),
	command(['dataset', 'push'], 'Push a reviewed private dataset explicitly', 5, {
		options: [{ name: '--private', kind: 'flag' }],
	}),
	command(['benchmark', 'build'], 'Build leakage-safe benchmark tasks', 6),
	command(['benchmark', 'run'], 'Run the executable benchmark', 6),
	command(['benchmark', 'compare'], 'Compare base, prompted, and tuned models', 6),
	command(['train', 'preflight'], 'Check MLX-LM training prerequisites', 7, {
		options: [
			{
				name: '--model',
				kind: 'value',
				valueName: 'e2b|e4b',
				allowedValues: ['e2b', 'e4b'],
			},
		],
	}),
	command(['train', 'run'], 'Run a versioned MLX-LM training experiment', 7),
	command(['model', 'serve'], 'Serve a selected model adapter locally', 6),
	command(['agent', 'run'], 'Run an isolated repository task', 6),
	command(['studio'], 'Open the loopback-only Presentation Studio', 8),
	command(['demo'], 'Run the presentation workflow', 8),
	command(['pipeline'], 'Run the end-to-end local pipeline', 8),
	command(['gc'], 'Garbage-collect unreferenced local objects', 2),
] as const satisfies readonly CommandLeaf[];

export class CommandTreeInvariantError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CommandTreeInvariantError';
	}
}

function command(
	path: readonly string[],
	description: string,
	ownerPhase: OwnerPhase,
	shape: {
		readonly arguments?: readonly CommandArgumentSpec[];
		readonly options?: readonly CommandOptionSpec[];
	} = {},
): CommandLeaf {
	return {
		path,
		description,
		ownerPhase,
		availability: ownerPhase === 1 ? 'implemented' : 'unavailable',
		arguments: shape.arguments ?? [],
		options: shape.options ?? [],
	};
}

export function validateCommandTree(tree: readonly CommandLeaf[]): void {
	if (tree.length === 0) {
		throw new CommandTreeInvariantError('The command tree must contain at least one leaf.');
	}

	const paths = new Set<string>();
	for (const leaf of tree) {
		if (leaf.path.length === 0 || leaf.path.some((part) => !/^[a-z][a-z0-9-]*$/.test(part))) {
			throw new CommandTreeInvariantError('Every command leaf must have a valid literal path.');
		}
		const key = leaf.path.join(' ');
		if (paths.has(key)) {
			throw new CommandTreeInvariantError(`Duplicate command path: ${key}.`);
		}
		paths.add(key);
		if (leaf.description.trim().length === 0) {
			throw new CommandTreeInvariantError(`Command ${key} must have a description.`);
		}
		const argumentNames = new Set<string>();
		for (const argument of leaf.arguments) {
			if (!/^[a-z][a-z0-9-]*$/.test(argument.name) || argumentNames.has(argument.name)) {
				throw new CommandTreeInvariantError(`Command ${key} has an invalid argument registry.`);
			}
			argumentNames.add(argument.name);
		}
		const optionNames = new Set<string>();
		for (const option of leaf.options) {
			if (!/^--[a-z][a-z0-9-]*$/.test(option.name) || optionNames.has(option.name)) {
				throw new CommandTreeInvariantError(`Command ${key} has an invalid option registry.`);
			}
			optionNames.add(option.name);
			if (option.kind === 'flag' && (option.valueName || option.allowedValues)) {
				throw new CommandTreeInvariantError(`Flag ${option.name} on ${key} cannot accept a value.`);
			}
			if (option.kind === 'value' && (!option.valueName || option.allowedValues?.length === 0)) {
				throw new CommandTreeInvariantError(
					`Option ${option.name} on ${key} requires a value shape.`,
				);
			}
		}
	}
}

function freezeCommandTree(tree: readonly CommandLeaf[]): readonly CommandLeaf[] {
	validateCommandTree(tree);
	for (const leaf of tree) {
		for (const option of leaf.options) {
			if (option.allowedValues) Object.freeze(option.allowedValues);
			Object.freeze(option);
		}
		for (const argument of leaf.arguments) Object.freeze(argument);
		Object.freeze(leaf.path);
		Object.freeze(leaf.arguments);
		Object.freeze(leaf.options);
		Object.freeze(leaf);
	}
	return Object.freeze(tree);
}

export const COMMAND_TREE: readonly CommandLeaf[] = freezeCommandTree(COMMAND_DEFINITIONS);

function isPrefix(prefix: readonly string[], value: readonly string[]): boolean {
	return prefix.every((part, index) => value[index] === part);
}

function parentPaths(tree: readonly CommandLeaf[]): readonly string[][] {
	const seen = new Set<string>();
	const parents: string[][] = [];
	for (const leaf of tree) {
		for (let length = 1; length < leaf.path.length; length += 1) {
			const parent = leaf.path.slice(0, length);
			const key = parent.join(' ');
			if (!seen.has(key)) {
				seen.add(key);
				parents.push(parent);
			}
		}
	}
	return parents;
}

function levenshtein(left: string, right: string): number {
	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
		const current = [leftIndex + 1];
		for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
			current.push(
				Math.min(
					(current[rightIndex] ?? 0) + 1,
					(previous[rightIndex + 1] ?? 0) + 1,
					(previous[rightIndex] ?? 0) + (left[leftIndex] === right[rightIndex] ? 0 : 1),
				),
			);
		}
		previous.splice(0, previous.length, ...current);
	}
	return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function suggestionFor(input: readonly string[], tree: readonly CommandLeaf[]): string | null {
	if (input.length === 0) return null;
	const firstParts = [...new Set(tree.map((leaf) => leaf.path[0]).filter(Boolean))];
	const candidates = firstParts.filter((part) => {
		const candidate = part ?? '';
		const entered = input[0] ?? '';
		return (
			candidate.startsWith(entered) ||
			entered.startsWith(candidate) ||
			levenshtein(entered, candidate) <= 1
		);
	});
	return candidates.length === 1 ? `mlx ${candidates[0]} --help` : null;
}

function errorResult(
	json: boolean,
	code: 'INVALID_ARGUMENT' | 'UNKNOWN_COMMAND',
	commandPath: readonly string[],
	input: string,
	message: string,
	suggestion: string | null = null,
): ParseResult {
	return {
		kind: 'error',
		json,
		code,
		command: commandPath.join(' '),
		input,
		message,
		suggestion,
	};
}

function parseLeafValues(leaf: CommandLeaf, tokens: readonly string[], json: boolean): ParseResult {
	const options: Record<string, string | boolean> = {};
	const positional: string[] = [];

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index] ?? '';
		if (!token.startsWith('--')) {
			positional.push(token);
			continue;
		}
		const equalsIndex = token.indexOf('=');
		const name = (equalsIndex === -1 ? token : token.slice(0, equalsIndex)) as `--${string}`;
		const specification = leaf.options.find((option) => option.name === name);
		if (!specification) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				token,
				`Unknown option ${token} for mlx ${leaf.path.join(' ')}.`,
			);
		}
		if (Object.hasOwn(options, name)) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				token,
				`Option ${name} may be provided only once.`,
			);
		}
		if (specification.kind === 'flag') {
			if (equalsIndex !== -1) {
				return errorResult(
					json,
					'INVALID_ARGUMENT',
					leaf.path,
					token,
					`Option ${name} does not accept a value.`,
				);
			}
			options[name] = true;
			continue;
		}
		const value = equalsIndex === -1 ? tokens[index + 1] : token.slice(equalsIndex + 1);
		if (!value || (equalsIndex === -1 && value.startsWith('--'))) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				token,
				`Option ${name} requires ${specification.valueName}.`,
			);
		}
		if (equalsIndex === -1) index += 1;
		if (specification.allowedValues && !specification.allowedValues.includes(value)) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				value,
				`Invalid value for ${name}: ${value}. Expected ${specification.allowedValues.join('|')}.`,
			);
		}
		options[name] = value;
	}

	if (positional.length > leaf.arguments.length) {
		const input = positional[leaf.arguments.length] ?? '';
		return errorResult(
			json,
			'INVALID_ARGUMENT',
			leaf.path,
			input,
			`Unexpected argument for mlx ${leaf.path.join(' ')}: ${input}.`,
		);
	}

	const argumentsByName: Record<string, string> = {};
	for (let index = 0; index < leaf.arguments.length; index += 1) {
		const specification = leaf.arguments[index];
		if (!specification) continue;
		const value = positional[index];
		if (value === undefined && specification.required) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				specification.name,
				`Missing required argument <${specification.name}> for mlx ${leaf.path.join(' ')}.`,
			);
		}
		if (value !== undefined) argumentsByName[specification.name] = value;
	}

	for (const specification of leaf.options) {
		if (specification.required && !Object.hasOwn(options, specification.name)) {
			return errorResult(
				json,
				'INVALID_ARGUMENT',
				leaf.path,
				specification.name,
				`Missing required option ${specification.name} <${specification.valueName}> for mlx ${leaf.path.join(' ')}.`,
			);
		}
	}

	return {
		kind: 'command',
		json,
		leaf,
		values: { arguments: argumentsByName, options },
	};
}

export function parseCommand(
	args: readonly string[],
	tree: readonly CommandLeaf[] = COMMAND_TREE,
): ParseResult {
	validateCommandTree(tree);
	let json = false;
	let help = false;
	const tokens: string[] = [];
	for (const argument of args) {
		if (argument === '--json') json = true;
		else if (argument === '--help' || argument === '-h') help = true;
		else tokens.push(argument);
	}

	if (tokens.length === 0) return { kind: 'help', json, path: [] };

	const leaf = [...tree]
		.sort((left, right) => right.path.length - left.path.length)
		.find((candidate) => isPrefix(candidate.path, tokens));
	if (leaf) {
		if (help) return { kind: 'help', json, path: leaf.path };
		return parseLeafValues(leaf, tokens.slice(leaf.path.length), json);
	}

	const parent = parentPaths(tree).find(
		(candidate) => candidate.length === tokens.length && isPrefix(candidate, tokens),
	);
	if (parent) return { kind: 'help', json, path: parent };

	const input = tokens.join(' ');
	return errorResult(
		json,
		'UNKNOWN_COMMAND',
		tokens,
		input,
		`Unknown command: ${input}. Run mlx --help to list valid commands.`,
		suggestionFor(tokens, tree),
	);
}

function optionUsage(option: CommandOptionSpec): string {
	const value = option.kind === 'value' ? ` <${option.valueName}>` : '';
	const rendered = `${option.name}${value}`;
	return option.required ? rendered : `[${rendered}]`;
}

function leafUsage(leaf: CommandLeaf): string {
	return [
		'mlx',
		...leaf.path,
		...leaf.arguments.map((argument) =>
			argument.required ? `<${argument.name}>` : `[<${argument.name}>]`,
		),
		...leaf.options.map(optionUsage),
	].join(' ');
}

export function projectHelp(
	path: readonly string[] = [],
	tree: readonly CommandLeaf[] = COMMAND_TREE,
): HelpProjection {
	validateCommandTree(tree);
	if (path.length === 0) {
		return {
			scope: 'root',
			title: 'mlx',
			introduction: 'MLX — the personal coding dataset and model pipeline',
			usage: 'mlx <command> [options]',
			description: null,
			rows: tree.map((leaf) => ({
				command: leaf.path.join(' '),
				description: leaf.description,
				ownerPhase: leaf.ownerPhase,
				availability: leaf.availability,
			})),
			arguments: [],
			options: [
				{ name: '--json', kind: 'flag' },
				{ name: '--help', kind: 'flag' },
			],
			ownerPhase: null,
			availability: null,
			nextAction: 'Run mlx doctor to check the executable and local environment.',
		};
	}

	const exactLeaf = tree.find(
		(leaf) => leaf.path.length === path.length && isPrefix(leaf.path, path),
	);
	if (exactLeaf) {
		return {
			scope: 'leaf',
			title: `mlx ${exactLeaf.path.join(' ')}`,
			introduction: null,
			usage: leafUsage(exactLeaf),
			description: exactLeaf.description,
			rows: [],
			arguments: exactLeaf.arguments,
			options: exactLeaf.options,
			ownerPhase: exactLeaf.ownerPhase,
			availability: exactLeaf.availability,
			nextAction: null,
		};
	}

	const descendants = tree.filter((leaf) => isPrefix(path, leaf.path));
	if (descendants.length === 0) {
		throw new CommandTreeInvariantError(`Cannot project help for unknown path: ${path.join(' ')}.`);
	}
	return {
		scope: 'parent',
		title: `mlx ${path.join(' ')}`,
		introduction: null,
		usage: `mlx ${path.join(' ')} <command> [options]`,
		description: null,
		rows: descendants.map((leaf) => ({
			command: leaf.path.join(' '),
			description: leaf.description,
			ownerPhase: leaf.ownerPhase,
			availability: leaf.availability,
		})),
		arguments: [],
		options: [{ name: '--help', kind: 'flag' }],
		ownerPhase: null,
		availability: null,
		nextAction: null,
	};
}
