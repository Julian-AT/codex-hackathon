import { describe, expect, it } from 'vitest';
import {
	COMMAND_TREE,
	type CommandLeaf,
	CommandTreeInvariantError,
	type OwnerPhase,
	parseCommand,
	projectHelp,
	validateCommandTree,
} from './command-tree';

interface ExpectedCommand {
	readonly path: string;
	readonly ownerPhase: OwnerPhase;
	readonly args?: readonly string[];
	readonly options?: readonly string[];
}

const AUTHORITATIVE_COMMANDS: readonly ExpectedCommand[] = [
	{ path: 'doctor', ownerPhase: 1 },
	{ path: 'init', ownerPhase: 1 },
	{ path: 'auth status', ownerPhase: 3 },
	{ path: 'repos scan', ownerPhase: 3 },
	{ path: 'repos review', ownerPhase: 3 },
	{
		path: 'repos set',
		ownerPhase: 3,
		args: ['demo'],
		options: ['--mode', 'included'],
	},
	{ path: 'mirror', ownerPhase: 3 },
	{ path: 'metrics build', ownerPhase: 3 },
	{ path: 'metrics show', ownerPhase: 3 },
	{ path: 'evidence build', ownerPhase: 4 },
	{ path: 'preferences build', ownerPhase: 4 },
	{ path: 'dataset build', ownerPhase: 5, options: ['--profile', 'core'] },
	{ path: 'dataset validate', ownerPhase: 5 },
	{ path: 'dataset inspect', ownerPhase: 5 },
	{ path: 'dataset push', ownerPhase: 5, options: ['--private'] },
	{ path: 'benchmark build', ownerPhase: 6 },
	{ path: 'benchmark run', ownerPhase: 6 },
	{ path: 'benchmark compare', ownerPhase: 6 },
	{ path: 'train preflight', ownerPhase: 7, options: ['--model', 'e4b'] },
	{ path: 'train run', ownerPhase: 7 },
	{ path: 'model serve', ownerPhase: 6 },
	{ path: 'agent run', ownerPhase: 6 },
	{ path: 'studio', ownerPhase: 8 },
	{ path: 'demo', ownerPhase: 8 },
	{ path: 'pipeline', ownerPhase: 8 },
	{ path: 'gc', ownerPhase: 2 },
];

type LeafWithAliases = CommandLeaf & {
	readonly aliases?: readonly (readonly string[])[];
};

function leaf(overrides: Partial<LeafWithAliases> = {}): LeafWithAliases {
	return {
		path: ['alpha'],
		description: 'Exercise a test command',
		ownerPhase: 2,
		availability: 'unavailable',
		arguments: [],
		options: [],
		...overrides,
	};
}

describe('authoritative command catalog', () => {
	it('keeps every documented leaf in one exact display order with one owner', () => {
		expect(
			COMMAND_TREE.map((command) => ({
				path: command.path.join(' '),
				ownerPhase: command.ownerPhase,
			})),
		).toEqual(AUTHORITATIVE_COMMANDS.map(({ path, ownerPhase }) => ({ path, ownerPhase })));
		expect(projectHelp().rows.map((row) => row.command)).toEqual(
			AUTHORITATIVE_COMMANDS.map(({ path }) => path),
		);
	});

	it.each(AUTHORITATIVE_COMMANDS)('parses $path and its declared parse-only values', (entry) => {
		const result = parseCommand([
			...entry.path.split(' '),
			...(entry.args ?? []),
			...(entry.options ?? []),
		]);
		expect(result.kind).toBe('command');
		if (result.kind !== 'command') return;
		expect(result.leaf.path.join(' ')).toBe(entry.path);
		expect(result.leaf.ownerPhase).toBe(entry.ownerPhase);
	});

	it('records every parse-only flag and allowed value in the catalog', () => {
		const shapes = Object.fromEntries(
			COMMAND_TREE.filter((command) => command.options.length > 0).map((command) => [
				command.path.join(' '),
				command.options.map((option) => ({
					name: option.name,
					values: option.allowedValues ?? null,
				})),
			]),
		);
		expect(shapes).toEqual({
			init: [{ name: '--adopt', values: null }],
			'repos set': [
				{
					name: '--mode',
					values: ['included', 'excluded', 'holdout', 'metrics-only'],
				},
			],
			'dataset build': [
				{
					name: '--profile',
					values: ['smoke', 'presentation', 'core', 'full'],
				},
			],
			'dataset push': [{ name: '--private', values: null }],
			'train preflight': [{ name: '--model', values: ['e2b', 'e4b'] }],
		});
	});

	it('parses init adoption only as a declared value-less, non-repeatable leaf option', () => {
		const parsed = parseCommand(['init', '--adopt']);
		expect(parsed.kind).toBe('command');
		if (parsed.kind === 'command') {
			expect(parsed.leaf.path).toEqual(['init']);
			expect(parsed.values.options).toEqual({ '--adopt': true });
		}

		for (const args of [
			['init', '--adopt=true'],
			['init', '--adopt', '--adopt'],
			['--adopt', 'init'],
		] as const) {
			expect(parseCommand(args)).toMatchObject({ kind: 'error', code: 'INVALID_ARGUMENT' });
		}
	});

	it('projects the init adoption option from the sole catalog into leaf help', () => {
		const help = projectHelp(['init']);
		expect(help.usage).toBe('mlx init [--adopt]');
		expect(help.options).toEqual([{ name: '--adopt', kind: 'flag' }]);
	});

	it.each([
		['repos', 'set', '--mode', 'holdout', 'owner/repo'],
		['repos', 'set', 'owner/repo', '--mode=metrics-only'],
		['--json', 'repos', 'set', 'owner/repo', '--mode', 'excluded'],
	] as const)('accepts deterministic option placement: %j', (...args) => {
		const result = parseCommand(args);
		expect(result.kind).toBe('command');
		if (result.kind !== 'command') return;
		expect(result.values.arguments.repo).toBe('owner/repo');
		expect(result.values.options['--mode']).toMatch(/holdout|metrics-only|excluded/u);
	});

	it('returns leaf help before enforcing required values', () => {
		const result = parseCommand(['repos', 'set', '--help']);
		expect(result).toMatchObject({ kind: 'help', path: ['repos', 'set'] });
		expect(projectHelp(['dataset']).rows.map((row) => row.command)).toEqual([
			'dataset build',
			'dataset validate',
			'dataset inspect',
			'dataset push',
		]);
	});

	it.each([
		[[], 'help'],
		[['--json'], 'help'],
		[['repos', 'set', 'demo'], 'INVALID_ARGUMENT'],
		[['repos', 'set', '--mode', 'included'], 'INVALID_ARGUMENT'],
		[['dataset', 'build', '--profile', 'unknown'], 'INVALID_ARGUMENT'],
		[['unknown'], 'UNKNOWN_COMMAND'],
	] as const)('returns a typed result for %j', (args, expected) => {
		const result = parseCommand(args);
		expect(result.kind === 'error' ? result.code : result.kind).toBe(expected);
	});
});

describe('command-tree invariants', () => {
	it('is deeply immutable after construction', () => {
		expect(Object.isFrozen(COMMAND_TREE)).toBe(true);
		expect(Object.isFrozen(COMMAND_TREE[0])).toBe(true);
		expect(Object.isFrozen(COMMAND_TREE[0]?.path)).toBe(true);
	});

	it.each([
		['empty catalog', []],
		['duplicate leaf path', [leaf(), leaf()]],
		['missing owner metadata', [leaf({ ownerPhase: undefined as unknown as OwnerPhase })]],
		[
			'optional argument before required argument',
			[
				leaf({
					arguments: [
						{ name: 'optional', required: false },
						{ name: 'required', required: true },
					],
				}),
			],
		],
		[
			'alias colliding with a leaf',
			[leaf({ path: ['alpha'], aliases: [['beta']] }), leaf({ path: ['beta'] })],
		],
		[
			'leaf occupying a structural parent',
			[leaf({ path: ['alpha'] }), leaf({ path: ['alpha', 'child'] })],
		],
	] as const)('rejects $0', (_name, tree) => {
		expect(() => validateCommandTree(tree)).toThrow(CommandTreeInvariantError);
	});

	it('resolves a declared alias to exactly one canonical leaf', () => {
		const result = parseCommand(['a'], [leaf({ aliases: [['a']] })]);
		expect(result.kind).toBe('command');
		if (result.kind === 'command') expect(result.leaf.path).toEqual(['alpha']);
	});
});
