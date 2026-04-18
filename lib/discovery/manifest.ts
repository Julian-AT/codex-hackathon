import { writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { DynamicToolSpec, GateName } from './types';
import { DYNAMIC_TOOL_SPEC_SCHEMA } from './worker';

export const MANIFEST_PATH = path.resolve('data/adapter-tools.json');
export const FALLBACK_PATH = path.resolve('data/adapter-tools.fallback.json');

export interface ManifestMeta {
  rawCandidates: number;
  dedupedCandidates: number;
  gateFailures: Record<GateName, number>;
}

// Extract the per-tool Zod schema from the wrapper (which is { tools: [...] }).
// This avoids the min(1)/max(8) array constraint on the wrapper and validates
// each individual tool spec against the canonical shape.
const TOOL_SCHEMA = DYNAMIC_TOOL_SPEC_SCHEMA.shape.tools.element;

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
