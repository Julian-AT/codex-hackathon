import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DynamicToolSpec, GateName } from './types';
import { DYNAMIC_TOOL_SPEC_DISK_SCHEMA } from './worker';

export const MANIFEST_PATH = path.resolve('data/adapter-tools.json');
export const FALLBACK_PATH = path.resolve('data/adapter-tools.fallback.json');

export interface ManifestMeta {
	rawCandidates: number;
	dedupedCandidates: number;
	gateFailures: Record<GateName, number>;
}

/** Persisted tool shape uses objects (not LLM wire strings). */
const TOOL_SCHEMA = DYNAMIC_TOOL_SPEC_DISK_SCHEMA;

export async function writeManifest(
	tools: DynamicToolSpec[],
	source: 'swarm' | 'fallback',
	meta: ManifestMeta,
): Promise<void> {
	// Pitfall 6: enforce Phase 4 contract at write-time — every tool must
	// round-trip the canonical Zod schema before landing on disk.
	for (const tool of tools) {
		TOOL_SCHEMA.parse(tool);
	}
	await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
	const body = {
		tools,
		source,
		count: tools.length,
		generatedAt: new Date().toISOString(),
		meta,
	};
	await writeFile(MANIFEST_PATH, JSON.stringify(body, null, 2), 'utf8');
}

export async function copyFallback(): Promise<void> {
	await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
	await copyFile(FALLBACK_PATH, MANIFEST_PATH);
}
