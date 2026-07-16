import type { CapabilityEvidence } from './capabilities';

export type HostCapabilityProbe = (capabilityId: string) => Promise<CapabilityEvidence>;

export interface HostCapabilityProbeDependencies {
	readonly platform?: NodeJS.Platform | string;
	readonly arch?: NodeJS.Architecture | string;
}

export function createHostCapabilityProbe(
	dependencies: HostCapabilityProbeDependencies = {},
): HostCapabilityProbe {
	const platform = dependencies.platform ?? process.platform;
	const arch = dependencies.arch ?? process.arch;
	return async (capabilityId: string): Promise<CapabilityEvidence> => {
		if (capabilityId !== 'apple-silicon') {
			throw new Error(`Unknown capability probe: ${capabilityId}.`);
		}
		const available = platform === 'darwin' && arch === 'arm64';
		return Object.freeze({
			id: 'apple-silicon',
			available,
			reason: available
				? 'Apple Silicon is available on Darwin arm64.'
				: `Apple Silicon requires Darwin arm64; detected ${platform}/${arch}.`,
		});
	};
}
