import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { CORPUS, Chunk } from './types';

const SOURCES = [
  { name: 'llms' as const, url: 'https://supabase.com/llms.txt' },
  { name: 'cli' as const, url: 'https://supabase.com/llms/cli.txt' },
  { name: 'guides' as const, url: 'https://supabase.com/llms/guides.txt' },
];
const CACHE_PATH = path.resolve('data/corpus.json');
const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;

// Lazy-loaded tokenizer. Fallback: 4-chars-per-token heuristic.
async function getEncoder(): Promise<(s: string) => number[]> {
  try {
    const m = await import('gpt-tokenizer');
    return (s: string) => m.encode(s);
  } catch {
    // fallback: pseudo-tokens at ~4 chars each
    return (s: string) => Array.from({ length: Math.ceil(s.length / 4) }, (_, i) => i);
  }
}

export async function loadCached(): Promise<CORPUS | null> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as CORPUS;
  } catch {
    return null;
  }
}

export interface FetchCorpusOptions {
  refresh?: boolean;
  fetchImpl?: typeof fetch;
}

export async function fetchCorpus(opts: FetchCorpusOptions = {}): Promise<CORPUS> {
  if (!opts.refresh) {
    const cached = await loadCached();
    if (cached) return cached;
  }
  const f = opts.fetchImpl ?? fetch;
  const texts = await Promise.all(
    SOURCES.map(async (s) => {
      const res = await f(s.url);
      if (!res.ok) throw new Error(`fetch ${s.url} failed: ${res.status}`);
      return { ...s, text: await res.text() };
    }),
  );
  const allChunks: Chunk[] = [];
  let sourceBytes = 0;
  for (const { name, text } of texts) {
    sourceBytes += text.length;
    const chunks = await chunkCorpus(text, name);
    allChunks.push(...chunks);
  }
  const corpus: CORPUS = {
    chunks: allChunks,
    byTopic: {},
    fetchedAt: new Date().toISOString(),
    sourceBytes,
  };
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(corpus, null, 2), 'utf8');
  return corpus;
}

/** Split `text` into <=TARGET_TOKENS chunks with OVERLAP_TOKENS overlap. */
export async function chunkCorpus(
  text: string,
  source: Chunk['source'] = 'llms',
): Promise<Chunk[]> {
  const encode = await getEncoder();
  // Split by paragraphs first, then pack into token-capped windows.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let buf = '';
  let bufTokens = 0;
  let ordinal = 0;

  const pushChunk = (windowText: string) => {
    const tokenCount = encode(windowText).length;
    chunks.push({
      id: `${source}.txt#${String(ordinal).padStart(4, '0')}`,
      source,
      text: windowText,
      tokenCount,
      ordinal,
    });
    ordinal += 1;
  };

  for (const para of paragraphs) {
    const pt = encode(para).length;
    if (pt > TARGET_TOKENS) {
      // hard-split an oversize paragraph into TARGET_TOKENS-char windows
      if (buf) {
        pushChunk(buf);
        buf = '';
        bufTokens = 0;
      }
      const charsPerToken = Math.max(1, Math.floor(para.length / pt));
      const windowChars = TARGET_TOKENS * charsPerToken;
      const overlapChars = OVERLAP_TOKENS * charsPerToken;
      for (let i = 0; i < para.length; i += windowChars - overlapChars) {
        pushChunk(para.slice(i, i + windowChars));
      }
      continue;
    }
    if (bufTokens + pt > TARGET_TOKENS) {
      pushChunk(buf);
      // overlap: keep the tail of buf (last ~OVERLAP_TOKENS worth) as seed
      const tail = buf.slice(-OVERLAP_TOKENS * 4);
      buf = tail + '\n\n' + para;
      bufTokens = encode(buf).length;
    } else {
      buf = buf ? buf + '\n\n' + para : para;
      bufTokens += pt;
    }
  }
  if (buf) pushChunk(buf);
  return chunks;
}
