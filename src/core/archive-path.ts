import path from 'node:path';

export type ArchivePathResult =
	| { readonly ok: true; readonly member: string; readonly linkTarget?: string }
	| {
			readonly ok: false;
			readonly code: 'NUL' | 'ABSOLUTE' | 'TRAVERSAL' | 'INVALID_LINK_TARGET';
			readonly input: string;
			readonly reason: string;
	  };

function invalid(
	code: Exclude<ArchivePathResult, { readonly ok: true }>['code'],
	input: string,
	reason: string,
): ArchivePathResult {
	return { ok: false, code, input, reason };
}

function validateRelativeArchivePath(input: string): ArchivePathResult {
	if (input.includes('\0')) return invalid('NUL', input, 'archive path contains a NUL byte');
	if (
		input.startsWith('/') ||
		input.startsWith('\\') ||
		path.win32.isAbsolute(input) ||
		/^[A-Za-z]:/.test(input)
	) {
		return invalid('ABSOLUTE', input, 'archive path must be relative');
	}
	const parts = input.split(/[\\/]+/);
	if (parts.some((part) => part === '..')) {
		return invalid('TRAVERSAL', input, 'archive path contains a parent traversal segment');
	}
	return { ok: true, member: parts.filter((part) => part !== '' && part !== '.').join('/') };
}

export function validateArchiveEntry(name: string, linkTarget?: string): ArchivePathResult {
	const member = validateRelativeArchivePath(name);
	if (!member.ok || linkTarget === undefined) return member;
	const target = validateRelativeArchivePath(linkTarget);
	if (!target.ok) {
		return invalid(
			'INVALID_LINK_TARGET',
			linkTarget,
			`archive link target is unsafe: ${target.reason}`,
		);
	}
	const resolved = path.posix.normalize(
		path.posix.join(path.posix.dirname(member.member), target.member),
	);
	if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) {
		return invalid(
			'INVALID_LINK_TARGET',
			linkTarget,
			'archive link target escapes the archive root',
		);
	}
	return { ok: true, member: member.member, linkTarget: target.member };
}
