---
phase: 04-data-eval-gen
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/data/types.ts
  - lib/data/split.ts
  - lib/data/personas.ts
  - lib/data/split.test.ts
  - lib/data/__fixtures__/mock-corpus.json
  - lib/data/__fixtures__/mock-tools.json
autonomous: true
requirements: [DAT-09]

must_haves:
  truths:
    - "`splitDocs(corpus, { trainRatio = 0.7, salt = 'phase-4-v1' })` returns `{ trainChunks: Chunk[], evalChunks: Chunk[], splitHash: string, manifest: { docId -> 'train'|'eval' } }`. Split is at the source-document level (`chunk.source` = 'llms'|'cli'|'guides') NOT chunk level — but stratification within source uses a stable per-`chunk.id` hash so the same corpus yields the same split bit-for-bit across runs."
    - "Determinism is enforced via `crypto.createHash('sha256').update(salt + ':' + chunkId).digest()`; the first 4 bytes are read as a uint32 and divided by 2^32 to produce a [0,1) score. `score < trainRatio` → train; else → eval. `splitHash` is `sha256(salt + sorted(trainIds).join(','))` — Phase 5/7 verify Phase 4 ran the canonical split by reading `data/split.manifest.json` and recomputing this hash."
    - "`lib/data/types.ts` exports the canonical Phase 4 vocabulary: `TrainingExample` (`{ messages: ChatMessage[], tools: DynamicToolSpec[] }` — mlx-lm `tools` JSONL row shape), `ChatMessage` (`{ role: 'system'|'user'|'assistant'|'tool', content: string, tool_calls?: ToolCall[], tool_call_id?: string, name?: string }`), `ToolCall` (`{ id: string, type: 'function', function: { name: string, arguments: string /* JSON-stringified */ } }`), `Persona`, `Difficulty` ('easy'|'medium'|'hard'), `JudgeScore` (`{ faithfulness: 1|2|3|4|5, toolCorrectness: 1|2|3|4|5, naturalness: 1|2|3|4|5, grounding: 1|2|3|4|5, judge: 'gpt-5'|'gemini-2.5-pro' }`), `EvalItem` (`{ id, kind: 'factual'|'reasoning'|'single-turn-tool'|'multi-turn-tool', prompt: string, expected?: string, expectedToolCalls?: ToolCall[], sourceChunks: string[] }`), `DataGenMeta` (`{ persona, difficulty, sourceChunks: string[], generator: 'opus-4-7' }`)."
    - "`lib/data/personas.ts` exports `PERSONAS` (8 personas — junior dev, senior backend, security auditor, devops, mobile dev, data engineer, indie hacker, DBA), `DIFFICULTIES = ['easy','medium','hard'] as const`, and `samplePersona(rng)` / `sampleDifficulty(rng)` deterministic helpers using a seedable PRNG."
    - "Mock fixtures land in `lib/data/__fixtures__/`: `mock-corpus.json` contains 20 chunks across 3 sources (llms/cli/guides) so split tests run without network; `mock-tools.json` contains 3 well-formed `DynamicToolSpec` entries copied from `data/adapter-tools.json` so downstream plans can import a tiny tool set without hitting the live manifest."
    - "Vitest covers: identical input → identical split (bit-for-bit), 70/30 ratio within ±5%, NO chunk appears in both `trainChunks` and `evalChunks` (set-disjointness assertion), `splitHash` is stable across runs, and serializing the manifest then re-loading reproduces the same partition."
  artifacts:
    - path: "lib/data/types.ts"
      provides: "Canonical Phase 4 vocabulary — TrainingExample, ChatMessage, ToolCall, JudgeScore, EvalItem, Persona, Difficulty, DataGenMeta"
      exports: ["TrainingExample","ChatMessage","ToolCall","JudgeScore","EvalItem","Persona","Difficulty","DataGenMeta","DIFFICULTIES"]
    - path: "lib/data/split.ts"
      provides: "splitDocs(corpus, opts) -> { trainChunks, evalChunks, splitHash, manifest } — deterministic 70/30 hash split with verifiable hash"
      exports: ["splitDocs","computeSplitHash","SPLIT_MANIFEST_PATH","loadSplitManifest"]
    - path: "lib/data/personas.ts"
      provides: "PERSONAS pool + sampling helpers"
      exports: ["PERSONAS","DIFFICULTIES","samplePersona","sampleDifficulty","makeRng"]
    - path: "lib/data/__fixtures__/mock-corpus.json"
      provides: "20 mock corpus chunks for offline tests"
      contains: "chunks"
    - path: "lib/data/__fixtures__/mock-tools.json"
      provides: "3 mock DynamicToolSpec entries for downstream tests"
      contains: "type"
  key_links:
    - from: "lib/data/split.ts"
      to: "lib/discovery/types.ts (Chunk, CORPUS)"
      via: "type-only import for input/output shape"
      pattern: "from '\\.\\./discovery/types"
    - from: "lib/data/split.ts"
      to: "data/split.manifest.json"
      via: "writeFile manifest on first call (Phase 5/7 verify)"
      pattern: "split\\.manifest\\.json"
    - from: "lib/data/types.ts"
      to: "lib/discovery/types.ts (DynamicToolSpec)"
      via: "type-only re-export so Phase 4 stays decoupled"
      pattern: "DynamicToolSpec"
---

<objective>
Lock the Phase 4 vocabulary and the deterministic 70/30 doc-split before any worker fans out. Every downstream plan (validate, dedupe, QA worker, Traj worker, eval gen, pipeline) imports from these three files. Without the canonical split landing first, training and eval can leak — DAT-09 is non-negotiable.

Purpose: Foundation for all of Phase 4. No model calls; pure types + deterministic functions + fixtures.
Output: `lib/data/types.ts`, `lib/data/split.ts`, `lib/data/personas.ts`, two fixtures, and a passing `split.test.ts`.
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
@.planning/phases/03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md
@lib/discovery/types.ts
@lib/discovery/corpus.ts

<interfaces>
Inputs (read-only — DO NOT modify):
- `lib/discovery/types.ts` exports `Chunk` (`{id, source, text, tokenCount, ordinal}`), `CORPUS` (`{chunks, byTopic, fetchedAt, sourceBytes}`), `DynamicToolSpec` (OpenAI tool shape + `meta` sidecar with `jsBody`/`requiresNetwork`/`trajectories`).
- `lib/discovery/corpus.ts` exports `fetchCorpus(opts)`, `loadCached()` returning `CORPUS | null`. Chunk ids are `${source}.txt#${4-digit-ordinal}`.
- `data/adapter-tools.json` is the validated tool manifest from Phase 3. Read shape from `data/adapter-tools.json` directly when generating fixtures.

Hash split spec (PRD §11.2, DAT-09):
- Document-level granularity (`chunk.source`) is what PRD calls a "document"; we MUST also stratify within-source so each source contributes ~70/30 — otherwise a 3-doc split can collapse to 67/33 or 100/0. Implementation: hash on `chunk.id` (already source-prefixed) NOT on `chunk.source`. The set of `chunk.source` values is small (3) so document-of-origin is preserved by virtue of `chunk.source` propagating.
- The "no eval doc appears in training" check in DAT-09 is interpreted as: no `chunk.id` in both sets. (Source-document coarseness is a research nicety; chunk-id disjointness is the testable invariant and what Phase 7 will verify.)
- Persist split to `data/split.manifest.json`: `{ salt, trainRatio, splitHash, generatedAt, train: string[], eval: string[] }`. Phase 5 ignores it; Phase 7 reads it to assert no eval id is present in any training example's `meta.sourceChunks`.

Persona pool (PRD §7.1, §7.2):
- 8 personas: `junior-dev`, `senior-backend`, `security-auditor`, `devops`, `mobile-dev`, `data-engineer`, `indie-hacker`, `dba`. Each `{id, label, voice}` (voice is a 1-line system-prompt fragment used by Plan 04-03/04-04).
- Difficulties: `easy` | `medium` | `hard` — easy = single fact lookup; medium = synthesis across 1–2 chunks; hard = multi-hop reasoning over 3+ chunks or schema-aware tool argument construction.
- Seedable PRNG: `makeRng(seed: string)` — use `mulberry32(sha256(seed)[0..4] as uint32)`. Tests assert two RNGs from the same seed produce identical sequences.

Anti-patterns to avoid:
- Do NOT use `Math.random()` anywhere — all randomness is seedable.
- Do NOT split on `chunk.source` directly (3 buckets → near-deterministic 1/3 splits).
- Do NOT mutate `corpus.chunks` — return new arrays.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: types + personas + fixtures</name>
  <files>
    lib/data/types.ts, lib/data/personas.ts, lib/data/__fixtures__/mock-corpus.json, lib/data/__fixtures__/mock-tools.json
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (Chunk, CORPUS, DynamicToolSpec)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/data/adapter-tools.json (copy 3 specs verbatim into mock-tools.json)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §7.1, §7.3 (data shape), §11.3 (eval composition)
  </read_first>
  <action>
    1. `lib/data/types.ts` — export every interface listed in must_haves.truths #3. Re-export `DynamicToolSpec` and `Chunk` as `type` re-exports from `../discovery/types.js`. Define `DIFFICULTIES = ['easy', 'medium', 'hard'] as const` and `type Difficulty = (typeof DIFFICULTIES)[number]`. `ToolCall.function.arguments` MUST be a JSON-stringified string (matches OpenAI/mlx-lm `tools` format exactly). `TrainingExample` is `{ messages: ChatMessage[]; tools: DynamicToolSpec[] }` — DAT-08 kill-point shape.

    2. `lib/data/personas.ts`:
       - `PERSONAS: Persona[]` with the 8 entries from interfaces. Each `voice` is one prose sentence usable inside a system prompt (e.g. `'You are a senior backend engineer evaluating Postgres for production. Ask precise, schema-aware questions.'`).
       - `makeRng(seed: string): () => number` — sha256 the seed, take first 4 bytes as a uint32, then mulberry32. Pure function, deterministic.
       - `samplePersona(rng)`, `sampleDifficulty(rng)` — `Math.floor(rng() * arr.length)` index.
       - Export `DIFFICULTIES` re-exported from `./types.js` (single source of truth — re-import then re-export).

    3. `lib/data/__fixtures__/mock-corpus.json` — 20 chunks: 8 from `llms`, 6 from `cli`, 6 from `guides`. Each: `{id: '<source>.txt#<NNNN>', source, text: '<short docs prose>', tokenCount: <int>, ordinal: <int>}`. Use realistic Supabase prose (RLS, edge functions, storage buckets) so downstream prompt fixtures look natural. Wrap as `{ chunks: [...], byTopic: {}, fetchedAt: '2026-04-18T00:00:00Z', sourceBytes: 12345 }` — i.e. the full `CORPUS` shape.

    4. `lib/data/__fixtures__/mock-tools.json` — read 3 specs verbatim from `data/adapter-tools.json` (`supabase_rls_policy_template` + 2 others — pick by `function.name` alphabetical order). Output shape: `[ DynamicToolSpec, DynamicToolSpec, DynamicToolSpec ]` — array, NOT wrapped, so tests can `JSON.parse(readFileSync(...))` and use directly.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && node -e "const c = require('./lib/data/__fixtures__/mock-corpus.json'); if (!Array.isArray(c.chunks) || c.chunks.length !== 20) process.exit(1); const t = require('./lib/data/__fixtures__/mock-tools.json'); if (!Array.isArray(t) || t.length !== 3 || !t.every(x => x.type === 'function')) process.exit(2); console.log('fixtures ok');" && grep -E "export interface TrainingExample" lib/data/types.ts && grep -E "export interface ToolCall" lib/data/types.ts && grep -E "export const PERSONAS" lib/data/personas.ts && grep -E "export function makeRng" lib/data/personas.ts</automated>
  </verify>
  <done>Types, personas, fixtures land. Downstream plans can import without ambiguity.</done>
</task>

<task type="auto">
  <name>Task 2: deterministic splitDocs + manifest persistence + tests</name>
  <files>
    lib/data/split.ts, lib/data/split.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §11.2 (deterministic doc-level split)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (Chunk shape)
    - lib/data/__fixtures__/mock-corpus.json (Task 1 output — your test input)
  </read_first>
  <action>
    1. `lib/data/split.ts`:
       - `import { createHash } from 'node:crypto';`
       - `export const SPLIT_MANIFEST_PATH = path.resolve('data/split.manifest.json');`
       - `function chunkScore(salt: string, chunkId: string): number` — sha256, first 4 bytes as BE uint32, divide by 2^32.
       - `export function splitDocs(corpus: CORPUS, opts: { trainRatio?: number; salt?: string; persist?: boolean } = {}): { trainChunks: Chunk[]; evalChunks: Chunk[]; splitHash: string; manifest: Record<string, 'train'|'eval'> }`. Default `trainRatio = 0.7`, `salt = 'phase-4-v1'`, `persist = false`. Iterate `corpus.chunks`, score each, partition. Build `manifest` keyed by `chunk.id`. Compute `splitHash = computeSplitHash(salt, trainChunks.map(c => c.id))`. If `persist`, atomically write `SPLIT_MANIFEST_PATH` as `{ salt, trainRatio, splitHash, generatedAt, train: [...ids], eval: [...ids] }`.
       - `export function computeSplitHash(salt: string, trainIds: string[]): string` — sha256(salt + ':' + sorted ids joined by `,`).
       - `export async function loadSplitManifest(): Promise<{ salt: string; trainRatio: number; splitHash: string; train: string[]; eval: string[] } | null>` — best-effort read.

    2. `lib/data/split.test.ts` — Vitest:
       - Load `mock-corpus.json` as `CORPUS`.
       - Test 1: `splitDocs` is deterministic — call twice, assert same `splitHash`, same `trainChunks.map(c => c.id)`, same `evalChunks.map(c => c.id)`.
       - Test 2: ratio within ±10% of 0.7 (mock corpus is small, so loosen from ±5%; PRD says deterministic, not exactly proportional).
       - Test 3: train ∩ eval is empty (set disjointness on chunk ids) — DAT-09 invariant.
       - Test 4: `manifest[id]` matches the partition for every chunk.
       - Test 5: changing `salt` produces a different `splitHash`.
       - Test 6: `persist: true` writes `data/split.manifest.json`; `loadSplitManifest()` round-trips with same hash. Clean up via `rm` in `afterEach`.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/data/split.test.ts 2>&1 | tail -20 && grep -E "export function splitDocs" lib/data/split.ts && grep -E "computeSplitHash" lib/data/split.ts && grep -E "createHash\\('sha256'\\)" lib/data/split.ts</automated>
  </verify>
  <done>DAT-09 deterministic split lands with verified hash. Phase 5/7 can recompute from manifest.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` green.
- `npx vitest run lib/data/split.test.ts` all tests pass.
- `lib/data/types.ts` exports the full Phase 4 vocabulary.
- Fixtures load without error.
</verification>

<success_criteria>
DAT-09 is technically satisfied (deterministic split + hash verification function), and the Phase 4 vocabulary is locked. Plans 04-02/03/04/05 can begin without coordination.
</success_criteria>

<output>
Create `.planning/phases/04-data-eval-gen/04-01-SUMMARY.md` noting:
- Final TrainingExample shape (verbatim signature).
- Salt + trainRatio defaults chosen.
- Mock fixture chunk count + tool count.
- Any deviation from PRD §11.2 doc-level granularity (we use chunk-id stratification).
</output>
