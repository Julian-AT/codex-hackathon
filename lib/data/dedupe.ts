import { createHash } from 'node:crypto';

// --- MinHash ---

function kShingles(text: string, k: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(' '));
  }
  return shingles;
}

function hashShingle(shingle: string, seed: number): number {
  const h = createHash('md5').update(`${seed}:${shingle}`).digest();
  return h.readUInt32BE(0);
}

export function minHashSignature(
  text: string,
  numHashes = 128,
  shingleK = 3,
): number[] {
  const shingles = kShingles(text, shingleK);
  const sig = new Array<number>(numHashes).fill(0xffffffff);
  for (const s of shingles) {
    for (let i = 0; i < numHashes; i++) {
      const h = hashShingle(s, i);
      if (h < sig[i]) sig[i] = h;
    }
  }
  return sig;
}

export function estimateJaccard(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('signature length mismatch');
  let agree = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) agree++;
  }
  return agree / a.length;
}

export function dedupeByMinHash(
  examples: { id: string; text: string }[],
  threshold = 0.7,
): string[] {
  const sigs = examples.map((e) => ({
    id: e.id,
    sig: minHashSignature(e.text),
  }));
  const keep: string[] = [];
  for (const item of sigs) {
    const isDup = keep.some((keptId) => {
      const keptSig = sigs.find((s) => s.id === keptId)!.sig;
      return estimateJaccard(item.sig, keptSig) >= threshold;
    });
    if (!isDup) keep.push(item.id);
  }
  return keep;
}

// --- Cosine ---

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('vector length mismatch');
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function dedupeByEmbedding(
  examples: { id: string; embedding: number[] }[],
  threshold = 0.92,
): string[] {
  const keep: string[] = [];
  const keepEmbeddings: number[][] = [];
  for (const item of examples) {
    const isDup = keepEmbeddings.some(
      (emb) => cosineSimilarity(item.embedding, emb) >= threshold,
    );
    if (!isDup) {
      keep.push(item.id);
      keepEmbeddings.push(item.embedding);
    }
  }
  return keep;
}
