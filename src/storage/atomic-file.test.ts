import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publishImmutableFile } from './atomic-file';

const roots: string[] = [];
function root(): string {
	const value = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-atomic-file-')));
	roots.push(value);
	return value;
}
afterEach(() => {
	for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe('publishImmutableFile', () => {
	it('publishes once and converges without replacing the destination', () => {
		const directory = root();
		expect(publishImmutableFile(directory, 'object', Buffer.from('value'))).toBe('published');
		expect(publishImmutableFile(directory, 'object', Buffer.from('value'))).toBe('existing');
		expect(readdirSync(directory)).toEqual(['object']);
	});

	it('cleans only its owned temp after an interrupted durable write', () => {
		const directory = root();
		expect(() =>
			publishImmutableFile(directory, 'object', Buffer.from('value'), {
				afterFileSync: () => {
					throw new Error('interrupt');
				},
			}),
		).toThrow('interrupt');
		expect(existsSync(path.join(directory, 'object'))).toBe(false);
		expect(readdirSync(directory)).toEqual([]);
	});

	it('rejects symlink directories and path-like names', () => {
		const parent = root();
		const outside = root();
		const link = path.join(parent, 'link');
		symlinkSync(outside, link);
		expect(() => publishImmutableFile(link, 'object', Buffer.from('value'))).toThrow(/safe/);
		expect(() => publishImmutableFile(parent, '../object', Buffer.from('value'))).toThrow(
			/path component/,
		);
	});
});
