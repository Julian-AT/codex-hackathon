---
phase: 03-discovery-tool-design
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/discovery/types.ts
  - lib/discovery/corpus.ts
  - lib/discovery/__fixtures__/llms-mini.txt
  - lib/discovery/corpus.test.ts
  - vitest.config.ts
  - package.json
  - data/corpus.json
autonomous: true
requirements: [SWR-01]

must_haves:
  truths:
    - "`fetchCorpus()` pulls `supabase.com/llms.txt`, `llms/cli.txt`, `llms/guides.txt` on first call, writes the merged result to `data/corpus.json`, and returns the cached copy on subsequent calls unless a `{ refresh: true }` flag is passed."
    - "`chunkCorpus(text)` returns `Chunk[]` where every chunk token count is ≤ 500 (measured by `gpt-tokenizer`) with ~50-token overlap between adjacent chunks."
    - "`data/corpus.json` exists on disk after first successful fetch and is committed to the repo so offline reruns work (Pitfall 5)."
    - "`lib/discovery/types.ts` exports `DynamicToolSpec`, `Chunk`, `CORPUS`, `ValidationResult`, `GateName` — the shared vocabulary for all downstream plans."
  artifacts:
    - path: "lib/discovery/types.ts"
      provides: "Shared types: DynamicToolSpec, Chunk, CORPUS, ValidationResult, GateName"
      contains: "DynamicToolSpec"
    - path: "lib/discovery/corpus.ts"
      provides: "fetchCorpus() + chunkCorpus() + loadCached()"
      exports: ["fetchCorpus", "chunkCorpus", "loadCached"]
    - path: "lib/discovery/__fixtures__/llms-mini.txt"
      provides: "2 KB offline fixture for chunk tests"
    - path: "data/corpus.json"
      provides: "Cached fetched+chunked corpus; committed for offline reruns"
      contains: "chunks"
    - path: "vitest.config.ts"
      provides: "Vitest config (confirm or create)"
  key_links:
    - from: "lib/discovery/corpus.ts"
      to: "global fetch"
      via: "await fetch('https://supabase.com/llms.txt')"
      pattern: "fetch\\(['\"]https://supabase\\.com/llms"
    - from: "lib/discovery/corpus.ts"
      to: "gpt-tokenizer"
      via: "import { encode } from 'gpt-tokenizer'"
      pattern: "from ['\"]gpt-tokenizer['\"]"
---

<objective>
Deliver the Phase 3 input substrate: a deterministically chunked Supabase corpus stored at `data/corpus.json` plus the shared type vocabulary every downstream discovery plan imports from `lib/discovery/types.ts`.

Purpose: SWR-01 is the zero-dependency bedrock — without a `CORPUS` object the tool-design swarm has nothing to read, and without shared types plans 03-02/03-03/03-04 diverge in shape. Also pins Vitest so Phase 3 can run its test suite.
Output: Cached `data/corpus.json`, pure `chunkCorpus` implementation with passing fixture test, shared `types.ts` exported for Wave 2+.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD_SPEC.md
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03-discovery-tool-design/03-RESEARCH.md

<interfaces>
<!-- Shared vocabulary used by all Phase 3 plans. Authoritative source: PRD §9.1 + §19.3. -->
Type shapes (TypeScript):

```typescript
// lib/discovery/types.ts
export interface Chunk {
  id: string;              // e.g. "llms.txt#0042"
  source: 'llms' | 'cli' | 'guides';
  text: string;            // raw chunk text
  tokenCount: number;      // measured by gpt-tokenizer
  ordinal: number;         // 0-based index within source
}

export interface CORPUS {
  chunks: Chunk[];
  byTopic: Record<string, string[]>; // topic -> chunk ids (optional, best-effort)
  fetchedAt: string;                  // ISO timestamp
  sourceBytes: number;
}

// OpenAI tool-schema shape + discovery meta sidecar (Pitfall 6 — one shape, end-to-end).
export interface DynamicToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema draft 2020-12
  };
  meta: {
    jsBody: string;
    requiresNetwork: boolean;
    trajectories: Array<{
      userPrompt: string;
      call: { name: string; arguments: Record<string, unknown> };
      result: unknown;
    }>;
    sourceWorker: string;  // worker id that emitted this spec
    sourceChunks: string[]; // ids of chunks that grounded this tool
  };
}

export type GateName = 'schema' | 'parse' | 'sandbox' | 'fuzz' | 'trajectory';

export interface ValidationResult {
  pass: boolean;
  failedGate?: GateName;
  reason?: string;
  details?: unknown;
}
```

Supabase source URLs (PRD §10.3, §17.1, SWR-01):
- `https://supabase.com/llms.txt`
- `https://supabase.com/llms/cli.txt`
- `https://supabase.com/llms/guides.txt`

Chunking parameters (research §Corpus chunking):
- Target 500 tokens/chunk, overlap 50 tokens.
- Tokenizer: `gpt-tokenizer` (BPE; close-enough proxy for mlx per A7).
- Fallback if tokenizer load fails: `text.length / 4` heuristic → still cap at 2000 chars/chunk.

Install additions to `package.json` for Phase 3:
- `gpt-tokenizer` (latest)
- `ajv` (^8.17)
- `acorn` (^8)  ← already in Phase 1 pins; confirm, don't re-add
- `fast-deep-equal` (^3.1)
- devDependencies: `vitest` (latest), `@types/node`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Phase 3 deps + confirm/create vitest.config.ts + shared types</name>
  <files>
    package.json, vitest.config.ts, lib/discovery/types.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Standard Stack, Validation Architecture, Wave 0 gaps)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md (pinned versions already present)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/package.json (BEFORE editing — inspect current deps to avoid duplicates)
  </read_first>
  <action>
    1. Inspect existing `package.json`. Add (do NOT remove anything) to `dependencies`:
       - `"gpt-tokenizer": "^2.9.0"` (or latest ^2)
       - `"ajv": "^8.17.1"`
       - `"fast-deep-equal": "^3.1.3"`
       - `"acorn"` — confirm present from Phase 1 pin (`^8`). If missing, add `"acorn": "^8"`.
       Add to `devDependencies`:
       - `"vitest": "^3.2.0"` (or latest 3.x)
       - `"@types/node": "^20"` — confirm present; add if missing.
       Add to `scripts`:
       - `"test": "vitest run"`
       - `"test:watch": "vitest"`

    2. Create `vitest.config.ts` at repo root (only if not present from Phase 1):
       ```ts
       import { defineConfig } from 'vitest/config';
       import path from 'node:path';

       export default defineConfig({
         test: {
           environment: 'node',
           globals: false,
           include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts'],
           testTimeout: 10_000,
           hookTimeout: 10_000,
         },
         resolve: {
           alias: { '@': path.resolve(__dirname, '.') },
         },
       });
       ```
       If `vitest.config.ts` already exists from Phase 1, ONLY append the `lib/**/*.test.ts` include pattern if absent — do not clobber.

    3. Write `lib/discovery/types.ts` with EXACTLY the type shapes from the `<interfaces>` block above. Export every type named. No runtime code; pure types.

    4. Run `npm install` to pick up new deps. Then `npx tsc --noEmit` to prove types compile.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npm install && npx tsc --noEmit && grep -E "\"gpt-tokenizer\"" package.json && grep -E "\"ajv\"" package.json && grep -E "\"vitest\"" package.json && grep -E "\"test\": \"vitest run\"" package.json && grep -E "export interface DynamicToolSpec" lib/discovery/types.ts && grep -E "export interface Chunk" lib/discovery/types.ts && grep -E "export type GateName" lib/discovery/types.ts</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains `"gpt-tokenizer"`, `"ajv"`, `"fast-deep-equal"`, `"vitest"` entries (grep each).
    - `package.json` contains `"test": "vitest run"` script.
    - `vitest.config.ts` exists and includes `lib/**/*.test.ts`.
    - `lib/discovery/types.ts` exports `DynamicToolSpec`, `Chunk`, `CORPUS`, `ValidationResult`, `GateName` (grep each export line).
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>Phase 3 deps installed, Vitest configured, shared types exported — Wave 2 plans can import from `lib/discovery/types`.</done>
</task>

<task type="auto">
  <name>Task 2: Implement corpus.ts (fetch + chunk + cache) with fixture + unit tests</name>
  <files>
    lib/discovery/corpus.ts, lib/discovery/__fixtures__/llms-mini.txt, lib/discovery/corpus.test.ts, data/corpus.json
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §10.3 (Discovery Worker), §17.1 (Supabase corpus), §19.3 (artifacts)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pattern: chunk params; Pitfall 5: cache; Runtime State Inventory)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (Task 1 output — import Chunk + CORPUS)
  </read_first>
  <action>
    1. Write `lib/discovery/__fixtures__/llms-mini.txt` — a ~2 KB plaintext fixture mimicking the shape of `llms.txt`. Content: 6–10 short Supabase doc-style paragraphs separated by blank lines, covering topics like "Row Level Security", "Realtime Channels", "Auth with magic links", "Edge Functions deploy", "Storage signed URLs". Do NOT copy real Supabase docs verbatim — paraphrase. Include at least one paragraph >500 tokens so chunk-splitting is exercised.

    2. Write `lib/discovery/corpus.ts`:
       ```ts
       import { readFile, writeFile, mkdir } from 'node:fs/promises';
       import path from 'node:path';
       import type { CORPUS, Chunk } from './types.js';

       const SOURCES = [
         { name: 'llms' as const,   url: 'https://supabase.com/llms.txt' },
         { name: 'cli' as const,    url: 'https://supabase.com/llms/cli.txt' },
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
         } catch { return null; }
       }

       export interface FetchCorpusOptions { refresh?: boolean; fetchImpl?: typeof fetch }
       export async function fetchCorpus(opts: FetchCorpusOptions = {}): Promise<CORPUS> {
         if (!opts.refresh) {
           const cached = await loadCached();
           if (cached) return cached;
         }
         const f = opts.fetchImpl ?? fetch;
         const texts = await Promise.all(SOURCES.map(async (s) => {
           const res = await f(s.url);
           if (!res.ok) throw new Error(`fetch ${s.url} failed: ${res.status}`);
           return { ...s, text: await res.text() };
         }));
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

       /** Split `text` into ≤TARGET_TOKENS chunks with OVERLAP_TOKENS overlap. */
       export async function chunkCorpus(
         text: string,
         source: Chunk['source'] = 'llms',
       ): Promise<Chunk[]> {
         const encode = await getEncoder();
         // Split by paragraphs first, then pack into token-capped windows.
         const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
         const chunks: Chunk[] = [];
         let buf = '';
         let bufTokens = 0;
         let ordinal = 0;
         const pushChunk = (windowText: string) => {
           const tokenCount = encode(windowText).length;
           chunks.push({
             id: `${source}.txt#${String(ordinal).padStart(4, '0')}`,
             source, text: windowText, tokenCount, ordinal,
           });
           ordinal += 1;
         };
         for (const para of paragraphs) {
           const pt = encode(para).length;
           if (pt > TARGET_TOKENS) {
             // hard-split an oversize paragraph into TARGET_TOKENS-char windows (~4 * 500 = 2000 chars)
             if (buf) { pushChunk(buf); buf = ''; bufTokens = 0; }
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
       ```

    3. Write `lib/discovery/corpus.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { readFile } from 'node:fs/promises';
       import path from 'node:path';
       import { chunkCorpus, fetchCorpus } from './corpus.js';

       const FIXTURE = path.resolve('lib/discovery/__fixtures__/llms-mini.txt');

       describe('chunkCorpus', () => {
         it('returns ≥1 chunk from the fixture', async () => {
           const text = await readFile(FIXTURE, 'utf8');
           const chunks = await chunkCorpus(text, 'llms');
           expect(chunks.length).toBeGreaterThan(0);
         });
         it('every chunk tokenCount ≤ 520 (tolerance for boundary spill)', async () => {
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
           const corpus = await fetchCorpus({ refresh: true, fetchImpl: fakeFetch as typeof fetch });
           expect(corpus.chunks.length).toBeGreaterThan(0);
           expect(['llms', 'cli', 'guides']).toContain(corpus.chunks[0].source);
           expect(corpus.sourceBytes).toBeGreaterThan(0);
         });
       });
       ```

    4. After tests pass, run `fetchCorpus({ refresh: true })` once against LIVE Supabase URLs to populate `data/corpus.json`. Use a one-shot script OR `node --experimental-strip-types -e "import('./lib/discovery/corpus.ts').then(m => m.fetchCorpus({refresh:true}).then(c => console.log('chunks:', c.chunks.length)))"`.

       If live fetch fails (Pitfall 5 — `supabase.com` 503), fall back: synthesize `data/corpus.json` from the fixture 3× (once per source label) so downstream plans are never blocked. Log this fallback in the SUMMARY.

    5. Commit `data/corpus.json` to the repo (Pitfall 5: offline reruns must work).
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/discovery/corpus.test.ts 2>&1 | tail -20 && test -f data/corpus.json && node -e "const c = require('./data/corpus.json'); console.log('chunks:', c.chunks.length); process.exit(c.chunks.length > 0 ? 0 : 1);"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export async function fetchCorpus" lib/discovery/corpus.ts` succeeds.
    - `grep -E "export async function chunkCorpus" lib/discovery/corpus.ts` succeeds.
    - `grep -E "https://supabase\\.com/llms" lib/discovery/corpus.ts` succeeds (all 3 URLs present).
    - `grep -E "TARGET_TOKENS\\s*=\\s*500" lib/discovery/corpus.ts` succeeds.
    - `test -f lib/discovery/__fixtures__/llms-mini.txt` succeeds and file size between 1500 and 4000 bytes.
    - `npx vitest run lib/discovery/corpus.test.ts` reports all tests passing.
    - `data/corpus.json` exists and parses as JSON with `chunks.length > 0`.
  </acceptance_criteria>
  <done>SWR-01 landed: Supabase corpus fetched, chunked, cached to `data/corpus.json`; fixture + tests let every downstream plan reuse this module offline.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `fetch` → `supabase.com` | Outbound HTTPS to public docs endpoint; no secrets. |
| `data/corpus.json` → repo | Disk write of public corpus to committed file; no PII. |
| `lib/discovery/corpus.ts` → downstream plans | Trusted shared data; schema contract in `types.ts`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | Attacker MITMs `llms.txt` fetch and injects a malicious paragraph | accept | Public docs on HTTPS; worst case a LLM suggests a bad tool which is then rejected by 5-gate validator in 03-02. |
| T-03-02 | DoS | `supabase.com` 503 blocks the whole phase | mitigate | Committed `data/corpus.json` cache is always checked first (Pitfall 5). Fixture-backed fallback if cold-start and live fails. |
| T-03-03 | Information Disclosure | Fetch secrets leak via error body | mitigate | `fetch` error throws with URL only; no auth headers sent. |
</threat_model>

<verification>
- `npm install` succeeds.
- `npx tsc --noEmit` exits 0.
- `npx vitest run lib/discovery/corpus.test.ts` green.
- `data/corpus.json` committed with ≥1 chunk.
- `lib/discovery/types.ts` exports the 5 named types.
</verification>

<success_criteria>
SWR-01 passes. Shared type vocabulary for Phase 3 is committed. Vitest is wired. Wave 2 (`tool-design-worker`) and Wave 3 (`swarm-pipeline-manifest`) can import `CORPUS`, `Chunk`, `DynamicToolSpec`, `ValidationResult` directly from `lib/discovery/types.ts`.
</success_criteria>

<output>
After completion, create `.planning/phases/03-discovery-tool-design/03-01-SUMMARY.md` noting:
- Total chunk count in `data/corpus.json` (per source).
- Whether live fetch succeeded or fixture-fallback was used.
- `gpt-tokenizer` load status (if fallback heuristic engaged, mention it so Phase 4 chunking boundaries are known).
</output>
