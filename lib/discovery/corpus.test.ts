import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chunkCorpus, fetchCorpus } from './corpus';

const FIXTURE = path.resolve('lib/discovery/__fixtures__/llms-mini.txt');

describe('chunkCorpus', () => {
  it('returns >=1 chunk from the fixture', async () => {
    const text = await readFile(FIXTURE, 'utf8');
    const chunks = await chunkCorpus(text, 'llms');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('every chunk tokenCount <= 520 (tolerance for boundary spill)', async () => {
    const text = await readFile(FIXTURE, 'utf8');
    const chunks = await chunkCorpus(text, 'llms');
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(520);
  });

  it('chunk ids are unique and ordinal-stable', async () => {
    const text = await readFile(FIXTURE, 'utf8');
    const chunks = await chunkCorpus(text, 'cli');
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(chunks[0].id.startsWith('cli.txt#')).toBe(true);
  });
});

describe('fetchCorpus with mocked fetchImpl', () => {
  it('packs three mocked sources into a single CORPUS', async () => {
    const text = await readFile(FIXTURE, 'utf8');
    const fakeFetch = async () => new Response(text, { status: 200 });
    const corpus = await fetchCorpus({
      refresh: true,
      fetchImpl: fakeFetch as typeof fetch,
    });
    expect(corpus.chunks.length).toBeGreaterThan(0);
    expect(['llms', 'cli', 'guides']).toContain(corpus.chunks[0].source);
    expect(corpus.sourceBytes).toBeGreaterThan(0);
  });
});
