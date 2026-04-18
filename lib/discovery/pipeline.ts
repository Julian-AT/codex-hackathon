import * as Sentry from '@sentry/nextjs';
import type { CORPUS, DynamicToolSpec, GateName, ValidationResult } from './types.js';
import { designToolsSwarm, type SwarmEvent } from './swarm.js';
import { validateTool } from './validate/index.js';
import { dedupeByNormalizedName } from './dedupe.js';
import { writeManifest, copyFallback, type ManifestMeta } from './manifest.js';

export class KillPointError extends Error {
  constructor(
    public code: string,
    public details: unknown,
  ) {
    super(`kill-point: ${code}`);
  }
}

export interface GateEvent {
  type: 'gate-pass' | 'gate-fail';
  toolName: string;
  gate?: GateName;
  reason?: string;
}
export type PipelineEvent =
  | SwarmEvent
  | GateEvent
  | { type: 'manifest-written'; source: 'swarm' | 'fallback'; count: number };

export interface PipelineOptions {
  corpus: CORPUS;
  onEvent?: (ev: PipelineEvent) => void;
  capMax?: number; // default 12
  floorMin?: number; // default 8
  killMin?: number; // default 4
}

export async function runDiscoveryPipeline(
  opts: PipelineOptions,
): Promise<{ tools: DynamicToolSpec[]; source: 'swarm' | 'fallback' }> {
  const { corpus, onEvent } = opts;
  const capMax = opts.capMax ?? 12;
  const floorMin = opts.floorMin ?? 8;
  const killMin = opts.killMin ?? 4;

  let raw: DynamicToolSpec[] = await designToolsSwarm(corpus, { onEvent });
  let deduped = dedupeByNormalizedName(raw);

  const gateFailures: Record<GateName, number> = {
    schema: 0,
    parse: 0,
    sandbox: 0,
    fuzz: 0,
    trajectory: 0,
  };
  const results = await Promise.all(
    deduped.map(
      async (spec): Promise<{ spec: DynamicToolSpec; r: ValidationResult }> => ({
        spec,
        r: await validateTool(spec),
      }),
    ),
  );
  const survivors: DynamicToolSpec[] = [];
  for (const { spec, r } of results) {
    if (r.pass) {
      survivors.push(spec);
      onEvent?.({ type: 'gate-pass', toolName: spec.function.name });
    } else {
      if (r.failedGate) gateFailures[r.failedGate] += 1;
      onEvent?.({
        type: 'gate-fail',
        toolName: spec.function.name,
        gate: r.failedGate,
        reason: r.reason,
      });
    }
  }

  // Retry arm: 4 <= survivors < floorMin, bump temperature and retry once
  if (survivors.length < floorMin && survivors.length >= killMin) {
    const retry = await designToolsSwarm(corpus, { onEvent, temperature: 0.8 });
    const mergedRaw = [...raw, ...retry];
    const mergedDedup = dedupeByNormalizedName(mergedRaw);
    const retryResults = await Promise.all(
      mergedDedup
        .filter((s) => !survivors.some((v) => v.function.name === s.function.name))
        .map(async (spec) => ({ spec, r: await validateTool(spec) })),
    );
    for (const { spec, r } of retryResults) {
      if (r.pass) survivors.push(spec);
      else if (r.failedGate) gateFailures[r.failedGate] += 1;
    }
    raw = mergedRaw;
    deduped = mergedDedup;
  }

  const meta: ManifestMeta = {
    rawCandidates: raw.length,
    dedupedCandidates: deduped.length,
    gateFailures,
  };

  if (survivors.length < killMin) {
    Sentry.captureMessage(`SWR-08 kill-point: only ${survivors.length} survivors`, 'warning');
    await copyFallback();
    onEvent?.({ type: 'manifest-written', source: 'fallback', count: 8 });
    throw new KillPointError('SWR-08', { survivors: survivors.length, meta });
  }

  const finalTools = survivors.slice(0, capMax);
  await writeManifest(finalTools, 'swarm', meta);
  onEvent?.({ type: 'manifest-written', source: 'swarm', count: finalTools.length });
  return { tools: finalTools, source: 'swarm' };
}
