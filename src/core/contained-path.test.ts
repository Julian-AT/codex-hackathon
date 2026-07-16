import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveContainedPath } from './contained-path';

const roots: string[] = [];
function root(): string {
	const value = mkdtempSync(path.join(tmpdir(), 'mlx-contained-'));
	roots.push(value);
	return value;
}
afterEach(() => roots.splice(0).forEach((value) => rmSync(value, { recursive: true, force: true })));

describe('resolveContainedPath', () => {
	it('accepts contained existing ancestors and a missing suffix', () => {
		const home = root();
		mkdirSync(path.join(home, 'objects'));
		const canonicalHome = realpathSync(home);
		expect(resolveContainedPath({ root: home, relativePath: 'objects/aa/value', field: 'paths.objects' })).toEqual({
			ok: true,
			path: path.join(canonicalHome, 'objects', 'aa', 'value'),
			root: canonicalHome,
		});
	});

	it.each(['../escape', 'safe/../../escape'])('rejects traversal %s', (relativePath) => {
		const result = resolveContainedPath({ root: root(), relativePath, field: 'paths.objects' });
		expect(result).toMatchObject({ ok: false, code: 'TRAVERSAL', field: 'paths.objects' });
	});

	it('rejects absolute injection and existing symlink components', () => {
		const home = root();
		const outside = root();
		expect(resolveContainedPath({ root: home, relativePath: outside, field: 'paths.objects' })).toMatchObject({
			ok: false,
			code: 'ABSOLUTE_PATH',
		});
		symlinkSync(outside, path.join(home, 'escape'));
		expect(resolveContainedPath({ root: home, relativePath: 'escape/value', field: 'paths.objects' })).toMatchObject({
			ok: false,
			code: 'SYMLINK',
		});
	});
});
