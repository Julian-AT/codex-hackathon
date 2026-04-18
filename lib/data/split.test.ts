/**
 * Tests for the deterministic 70/30 doc-split (DAT-09).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { splitDocs, computeSplitHash, loadSplitManifest, SPLIT_MANIFEST_PATH } from './split';
import type { CORPUS } from '../discovery/types';
import mockCorpus from './__fixtures__/mock-corpus.json';

const corpus = mockCorpus as unknown as CORPUS;

// Clean up manifest after persist tests
afterEach(() => {
  try {
    unlinkSync(SPLIT_MANIFEST_PATH);
  } catch {
    // file may not exist — fine
  }
});

describe('splitDocs', () => {
  it('is deterministic — identical input produces identical output', () => {
    const a = splitDocs(corpus);
    const b = splitDocs(corpus);

    expect(a.splitHash).toBe(b.splitHash);
    expect(a.trainChunks.map((c) => c.id)).toEqual(b.trainChunks.map((c) => c.id));
    expect(a.evalChunks.map((c) => c.id)).toEqual(b.evalChunks.map((c) => c.id));
  });

  it('maintains ~70/30 ratio within +/-10%', () => {
    const result = splitDocs(corpus);
    const total = corpus.chunks.length;
    const trainFrac = result.trainChunks.length / total;
    // 70% +/- 10% => between 0.6 and 0.8
    expect(trainFrac).toBeGreaterThanOrEqual(0.6);
    expect(trainFrac).toBeLessThanOrEqual(0.8);
  });

  it('train and eval are set-disjoint on chunk ids (DAT-09 invariant)', () => {
    const result = splitDocs(corpus);
    const trainIds = new Set(result.trainChunks.map((c) => c.id));
    const evalIds = new Set(result.evalChunks.map((c) => c.id));

    for (const id of evalIds) {
      expect(trainIds.has(id)).toBe(false);
    }
    // Also verify no chunk is lost
    expect(trainIds.size + evalIds.size).toBe(corpus.chunks.length);
  });

  it('manifest[id] matches the partition for every chunk', () => {
    const result = splitDocs(corpus);

    for (const chunk of result.trainChunks) {
      expect(result.manifest[chunk.id]).toBe('train');
    }
    for (const chunk of result.evalChunks) {
      expect(result.manifest[chunk.id]).toBe('eval');
    }
    // Every corpus chunk is represented in the manifest
    for (const chunk of corpus.chunks) {
      expect(result.manifest[chunk.id]).toBeDefined();
    }
  });

  it('changing salt produces a different splitHash', () => {
    const a = splitDocs(corpus, { salt: 'salt-a' });
    const b = splitDocs(corpus, { salt: 'salt-b' });

    expect(a.splitHash).not.toBe(b.splitHash);
  });

  it('persist: true writes manifest; loadSplitManifest round-trips', async () => {
    const result = splitDocs(corpus, { persist: true });

    const loaded = await loadSplitManifest();
    expect(loaded).not.toBeNull();
    expect(loaded!.splitHash).toBe(result.splitHash);
    expect(loaded!.salt).toBe('phase-4-v1');
    expect(loaded!.trainRatio).toBe(0.7);
    expect(loaded!.train.sort()).toEqual(
      result.trainChunks.map((c) => c.id).sort(),
    );
    expect(loaded!.eval.sort()).toEqual(
      result.evalChunks.map((c) => c.id).sort(),
    );

    // Verify hash can be recomputed from manifest
    const recomputedHash = computeSplitHash(loaded!.salt, loaded!.train);
    expect(recomputedHash).toBe(result.splitHash);
  });
});
