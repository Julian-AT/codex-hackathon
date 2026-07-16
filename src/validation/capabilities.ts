import { z } from 'zod';

const CAPABILITY_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const CAPABILITY_EVIDENCE_SCHEMA = z
	.object({
		id: z.string().min(1).max(120).regex(CAPABILITY_ID),
		available: z.boolean(),
		reason: z.string().min(1).max(500),
	})
	.strict();

export type CapabilityEvidence = Readonly<z.output<typeof CAPABILITY_EVIDENCE_SCHEMA>>;

export function normalizeCapabilityEvidence(input: unknown): CapabilityEvidence | null {
	const parsed = CAPABILITY_EVIDENCE_SCHEMA.safeParse(input);
	if (!parsed.success) return null;
	return Object.freeze(parsed.data);
}

export function canSkipForCapability(input: unknown): boolean {
	return normalizeCapabilityEvidence(input)?.available === false;
}
