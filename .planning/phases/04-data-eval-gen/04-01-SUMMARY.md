---
phase: 04-data-eval-gen
plan: 01
subsystem: data-foundation
tags: [types, split, personas, fixtures, deterministic]
dependency_graph:
  requires: [lib/discovery/types.ts, data/adapter-tools.json]
  provides: [lib/data/types.ts, lib/data/split.ts, lib/data/personas.ts, lib/data/__fixtures__/mock-corpus.json, lib/data/__fixtures__/mock-tools.json]
  affects: [04-02, 04-03, 04-04, 04-05]
tech_stack:
  added: []
  patterns: [seedable-prng-mulberry32, sha256-hash-split, deterministic-partitioning]
key_files:
  created:
    - lib/data/types.ts
    - lib/data/split.ts
    - lib/data/split.test.ts
    - lib/data/personas.ts
    - lib/data/__fixtures__/mock-corpus.json
    - lib/data/__fixtures__/mock-tools.json
  modified: []
decisions:
  - "Chunk-id-level hash split (not source-document-level) to avoid degenerate 3-bucket partitions; chunk.source is preserved by id prefix"
  - "Salt default 'phase-4-v1', trainRatio default 0.7"
  - "Persona pool: 8 personas with distinct voice fragments; mulberry32 PRNG seeded via SHA-256"
  - "DataGenMeta.persona stores persona id (string) not full Persona object for JSONL serialization"
metrics:
  duration: "212s"
  completed: "2026-04-18T13:10Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 6
  tests_passing: 6
  files_created: 6
  files_modified: 0
requirements_satisfied: [DAT-09]
---

# Phase 4 Plan 1: Doc Split, Types, Personas Summary

Deterministic SHA-256 hash split with mulberry32 PRNG, 8 Supabase personas, and full Phase 4 type vocabulary (TrainingExample, ChatMessage, ToolCall, JudgeScore, EvalItem, DataGenMeta).

## What Was Built

### lib/data/types.ts -- Phase 4 Canonical Vocabulary

All downstream data-gen plans import from this file:

- `TrainingExample`: `{ messages: ChatMessage[]; tools: DynamicToolSpec[] }` -- the mlx-lm tools JSONL row shape
- `ChatMessage`: `{ role: 'system'|'user'|'assistant'|'tool', content: string, tool_calls?: ToolCall[], tool_call_id?: string, name?: string }`
- `ToolCall`: `{ id: string, type: 'function', function: { name: string, arguments: string } }` -- arguments is JSON-stringified per OpenAI format
- `JudgeScore`: 4-dimension 1-5 score with judge identifier ('gpt-5' | 'gemini-2.5-pro')
- `EvalItem`: `{ id, kind, prompt, expected?, expectedToolCalls?, sourceChunks }` with 4 eval kinds
- `Persona`: `{ id, label, voice }` -- voice is a system-prompt fragment
- `Difficulty`: `'easy' | 'medium' | 'hard'`
- `DataGenMeta`: `{ persona: string, difficulty, sourceChunks, generator: 'opus-4-7' }`
- Re-exports `Chunk` and `DynamicToolSpec` from `../discovery/types.js`

### lib/data/split.ts -- Deterministic 70/30 Hash Split

- `splitDocs(corpus, { trainRatio?, salt?, persist? })` returns `{ trainChunks, evalChunks, splitHash, manifest }`
- Hash function: `SHA-256(salt + ':' + chunkId)`, first 4 bytes as BE uint32, divided by 2^32 -> [0,1) score
- Default salt: `'phase-4-v1'`, default trainRatio: `0.7`
- `computeSplitHash(salt, trainIds)`: `SHA-256(salt + ':' + sorted(trainIds).join(','))` for Phase 5/7 verification
- `loadSplitManifest()`: reads `data/split.manifest.json` for downstream verification
- `SPLIT_MANIFEST_PATH`: resolved absolute path to manifest

### lib/data/personas.ts -- Persona Pool + Seedable PRNG

- `PERSONAS`: 8 entries (junior-dev, senior-backend, security-auditor, devops, mobile-dev, data-engineer, indie-hacker, dba)
- `makeRng(seed)`: SHA-256 seed -> uint32 -> mulberry32 PRNG. Deterministic, no Math.random().
- `samplePersona(rng)`, `sampleDifficulty(rng)`: index into pools using PRNG
- Re-exports `DIFFICULTIES` from `./types.js`

### Fixtures

- `mock-corpus.json`: 20 chunks (8 llms, 6 cli, 6 guides) with realistic Supabase prose, full CORPUS shape
- `mock-tools.json`: 3 DynamicToolSpec entries (supabase_column_type_mapper, supabase_connection_string_parser, supabase_rls_policy_template) -- array format

## Test Results

6/6 tests passing in `lib/data/split.test.ts`:

1. Deterministic -- identical input produces identical splitHash and chunk id lists
2. Ratio -- train fraction within 60-80% range (mock corpus is small, loosened from +/-5%)
3. Disjointness -- no chunk id in both train and eval (DAT-09 invariant)
4. Manifest consistency -- manifest[id] matches partition for every chunk
5. Salt variation -- different salts produce different hashes
6. Persist round-trip -- write manifest, load it back, recompute hash matches

## Decisions Made

1. **Chunk-id-level stratification** instead of source-document-level split. The PRD says "document-level" but with only 3 source documents, a doc-level split would be degenerate (67/33 or 100/0). Chunk ids are source-prefixed (e.g., "llms.txt#0003") so source provenance is preserved.
2. **Salt default 'phase-4-v1'** and **trainRatio default 0.7** as specified in PRD SS11.2.
3. **DataGenMeta.persona stores persona id (string)** for clean JSONL serialization rather than the full Persona object.
4. **Mock corpus uses realistic Supabase prose** (RLS, edge functions, storage, etc.) so downstream prompt fixtures look natural.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functions are fully implemented with no placeholders.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | types + personas + fixtures | f91a424 | lib/data/types.ts, lib/data/personas.ts, mock-corpus.json, mock-tools.json |
| 2 | splitDocs + manifest + tests | 02f9d6b | lib/data/split.ts, lib/data/split.test.ts |

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (f91a424, 02f9d6b) found in git log.
