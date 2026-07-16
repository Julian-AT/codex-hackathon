import { describe, expect, it } from 'vitest';

async function loadSubject() {
	return await import('./host-capability').catch(() => null);
}

describe('createHostCapabilityProbe', () => {
	it.each([
		['darwin', 'arm64', true, 'available'],
		['darwin', 'x64', false, 'requires Darwin arm64'],
		['linux', 'arm64', false, 'requires Darwin arm64'],
		['win32', 'x64', false, 'requires Darwin arm64'],
	] as const)(
		'reports named apple-silicon evidence for %s/%s',
		async (platform, arch, available, reasonFragment) => {
			const subject = await loadSubject();
			expect(subject?.createHostCapabilityProbe).toBeTypeOf('function');
			if (!subject) return;

			const probe = subject.createHostCapabilityProbe({ platform, arch });
			await expect(probe('apple-silicon')).resolves.toMatchObject({
				id: 'apple-silicon',
				available,
				reason: expect.stringContaining(reasonFragment),
			});
		},
	);

	it('rejects unknown capability names rather than fabricating a SKIP', async () => {
		const subject = await loadSubject();
		expect(subject?.createHostCapabilityProbe).toBeTypeOf('function');
		if (!subject) return;

		const probe = subject.createHostCapabilityProbe({ platform: 'darwin', arch: 'arm64' });
		await expect(probe('missing-probe')).rejects.toThrow(/unknown capability/i);
	});
});
