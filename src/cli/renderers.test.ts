import { describe, expect, it } from 'vitest';
import { projectHelp } from './command-tree';
import type { CliEnvelope } from './main';
import { renderHuman, sanitizeTerminalText } from './render-human';
import { renderJson } from './render-json';

function rootHelpEnvelope(): CliEnvelope {
	return {
		schemaVersion: '1',
		ok: true,
		command: 'help',
		status: 'help',
		data: projectHelp(),
		error: null,
	};
}

function unavailableEnvelope(command = 'dataset build'): CliEnvelope {
	return {
		schemaVersion: '1',
		ok: false,
		command,
		status: 'unavailable',
		data: null,
		error: {
			code: 'UNAVAILABLE',
			message: 'This command is defined but is not available in Phase 1.',
			ownerPhase: 5,
		},
	};
}

describe('JSON renderer', () => {
	it('emits the six keys in locked order as one compact newline-terminated object', () => {
		const first = renderJson(rootHelpEnvelope());
		const second = renderJson(rootHelpEnvelope());
		expect(first).toBe(second);
		expect(first.endsWith('\n')).toBe(true);
		expect(first.slice(0, -1)).not.toContain('\n');
		expect(Object.keys(JSON.parse(first))).toEqual([
			'schemaVersion',
			'ok',
			'command',
			'status',
			'data',
			'error',
		]);
	});

	it('preserves exact Unicode/control values structurally without emitting ANSI bytes', () => {
		const envelope = unavailableEnvelope('dataset\u001b[31m build/工程');
		const output = renderJson(envelope);
		expect(JSON.parse(output).command).toBe(envelope.command);
		expect(output).not.toContain(String.fromCharCode(27));
	});
});

describe('human renderer', () => {
	it('escapes every C0/C1 control while preserving Unicode and ordinary text', () => {
		const controls = `${String.fromCharCode(0)}\t\n\r${String.fromCharCode(27)}${String.fromCharCode(127)}${String.fromCharCode(133)}`;
		expect(sanitizeTerminalText(`工程${controls}done`)).toBe(
			'工程\\x00\\t\\n\\r\\x1b\\x7f\\x85done',
		);
	});

	it('uses distinct 80, 40, and 39-column help layouts without hiding commands', () => {
		const envelope = rootHelpEnvelope();
		const wide = renderHuman(envelope, 80);
		const narrow = renderHuman(envelope, 40);
		const vertical = renderHuman(envelope, 39);

		expect(wide).toMatch(/^ {2}doctor {2,}Check executable ownership/mu);
		expect(narrow).toContain('  doctor  Check');
		expect(vertical).toContain('  doctor\n    Check');
		for (const output of [wide, narrow, vertical]) {
			expect(output).toContain('dataset build');
			expect(output).toContain('Run mlx doctor to check the executable and local environment.');
			expect(output).not.toContain('…');
		}
	});

	it('never truncates status, owner, remediation, or a long sanitized command', () => {
		const command = `dataset ${'工程'.repeat(60)}${String.fromCharCode(27)} build`;
		const output = renderHuman(unavailableEnvelope(command), 1);
		expect(output).toContain('UNAVAILABLE');
		expect(output).toContain('Available in Phase 5');
		expect(output).toContain('Run mlx dataset --help');
		expect(output).toContain(`${'工程'.repeat(60)}\\x1b`);
		expect(output).not.toContain(String.fromCharCode(27));
		expect(output).not.toContain('…');
	});

	it('is byte-equivalent for repeated controlled human outcomes', () => {
		const envelope = unavailableEnvelope();
		expect(renderHuman(envelope, 40)).toBe(renderHuman(envelope, 40));
		expect(renderHuman(envelope, 40)).toContain('UNAVAILABLE  mlx dataset build');
	});
});
