import { describe, expect, it } from 'vitest';
import { validateArchiveEntry } from './archive-path';

describe('validateArchiveEntry', () => {
	it.each([
		'/etc/passwd',
		'../escape',
		'a/../../escape',
		'C:\\escape',
		'\\\\host\\share',
		'bad\0name',
	])('rejects unsafe member %s', (name) => expect(validateArchiveEntry(name).ok).toBe(false));

	it('accepts normalized contained members', () => {
		expect(validateArchiveEntry('safe/./file.txt')).toEqual({ ok: true, member: 'safe/file.txt' });
	});

	it('validates link targets relative to their member directory', () => {
		expect(validateArchiveEntry('safe/link', '../../escape').ok).toBe(false);
		expect(validateArchiveEntry('safe/link', 'sibling.txt')).toEqual({
			ok: true,
			member: 'safe/link',
			linkTarget: 'sibling.txt',
		});
	});
});
