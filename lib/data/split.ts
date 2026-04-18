/**
 * Deterministic 70/30 doc-split with verifiable hash.
 * Source of truth: PRD SS11.2, DAT-09 and plan 04-01.
 *
 * Split is at the chunk-id level (NOT source-document level).
 * Each chunk.id is hashed with a salt to produce a deterministic [0,1) score.
 * Phase 5/7 verify the canonical split by re-reading data/split.manifest.json
 * and recomputing splitHash.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Chunk, CORPUS } from '../discovery/types.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const SPLIT_MANIFEST_PATH = path.resolve('data/split.manifest.json');

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Hash a chunk id with the given salt to produce a deterministic [0,1) score.
 * Uses SHA-256, reads first 4 bytes as big-endian uint32, divides by 2^32.
 */
function chunkScore(salt: string, chunkId: string): number {
  const digest = createHash('sha256')
    .update(salt + ':' + chunkId)
    .digest();
  const uint32 = digest.readUInt32BE(0);
  return uint32 / 0x100000000; // 2^32
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export interface SplitResult {
  trainChunks: Chunk[];
  evalChunks: Chunk[];
  splitHash: string;
  manifest: Record<string, 'train' | 'eval'>;
}

export interface SplitManifest {
  salt: string;
  trainRatio: number;
  splitHash: string;
  generatedAt: string;
  train: string[];
  eval: string[];
}

/**
 * Compute the verifiable split hash from salt and sorted train ids.
 * `sha256(salt + ':' + sorted(trainIds).join(','))`
 */
export function computeSplitHash(salt: string, trainIds: string[]): string {
  const sorted = [...trainIds].sort();
  return createHash('sha256')
    .update(salt + ':' + sorted.join(','))
    .digest('hex');
}

/**
 * Split a corpus into train/eval partitions deterministically.
 *
 * @param corpus  - The corpus to split (read-only, not mutated)
 * @param opts.trainRatio - Fraction for training (default 0.7)
 * @param opts.salt       - Hash salt (default 'phase-4-v1')
 * @param opts.persist    - If true, write manifest to SPLIT_MANIFEST_PATH
 */
export function splitDocs(
  corpus: CORPUS,
  opts: { trainRatio?: number; salt?: string; persist?: boolean } = {},
): SplitResult {
  const trainRatio = opts.trainRatio ?? 0.7;
  const salt = opts.salt ?? 'phase-4-v1';
  const persist = opts.persist ?? false;

  const trainChunks: Chunk[] = [];
  const evalChunks: Chunk[] = [];
  const manifest: Record<string, 'train' | 'eval'> = {};

  for (const chunk of corpus.chunks) {
    const score = chunkScore(salt, chunk.id);
    if (score < trainRatio) {
      trainChunks.push(chunk);
      manifest[chunk.id] = 'train';
    } else {
      evalChunks.push(chunk);
      manifest[chunk.id] = 'eval';
    }
  }

  const splitHash = computeSplitHash(
    salt,
    trainChunks.map((c) => c.id),
  );

  if (persist) {
    const manifestData: SplitManifest = {
      salt,
      trainRatio,
      splitHash,
      generatedAt: new Date().toISOString(),
      train: trainChunks.map((c) => c.id),
      eval: evalChunks.map((c) => c.id),
    };
    const dir = path.dirname(SPLIT_MANIFEST_PATH);
    mkdirSync(dir, { recursive: true });
    writeFileSync(SPLIT_MANIFEST_PATH, JSON.stringify(manifestData, null, 2) + '\n', 'utf-8');
  }

  return { trainChunks, evalChunks, splitHash, manifest };
}

/**
 * Load a previously persisted split manifest, or null if not found.
 */
export async function loadSplitManifest(): Promise<SplitManifest | null> {
  try {
    const raw = readFileSync(SPLIT_MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as SplitManifest;
  } catch {
    return null;
  }
}
