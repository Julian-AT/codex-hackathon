import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ObjectStore } from './object-store';

const roots: string[] = [];
function root(): string {
	const value = realpathSync(mkdtempSync(path.join(tmpdir(), 'mlx-object-store-')));
	roots.push(value);
	return value;
}
afterEach(() => {
	for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe('ObjectStore', () => {
	it('stores and verifies immutable bytes at the digest-derived path', () => {
		const base = path.join(root(), 'objects');
		const store = new ObjectStore(base);
		const first = store.put(Buffer.from('hello'));
		const second = store.put(Buffer.from('hello'));
		expect(first).toEqual(second);
		expect(first.path).toBe(path.join(base, 'sha256', first.digest.slice(0, 2), first.digest));
		expect(store.openVerified(first.digest).toString()).toBe('hello');
	});

	it('rejects malformed digests, corrupt objects, and symlink components', () => {
		const base = path.join(root(), 'objects');
		const store = new ObjectStore(base);
		expect(() => store.openVerified('../escape')).toThrow(/lowercase SHA-256/);
		const object = store.put(Buffer.from('hello'));
		writeFileSync(object.path, 'changed');
		expect(() => store.openVerified(object.digest)).toThrow(/digest verification/);

		const linkedBase = path.join(root(), 'objects');
		mkdirSync(linkedBase);
		symlinkSync(root(), path.join(linkedBase, 'sha256'));
		expect(() => new ObjectStore(linkedBase).put(Buffer.from('unsafe'))).toThrow(/symlink/);
	});
});
