---
phase: 03-discovery-tool-design
plan: 01
subsystem: discovery-corpus
tags: [corpus, chunking, types, vitest, SWR-01]
dependency_graph:
  requires: []
  provides: [lib/discovery/types.ts, lib/discovery/corpus.ts, data/corpus.json]
  affects: [03-02, 03-03, 03-04, 03-05]
tech_stack:
  added: [gpt-tokenizer]
  patterns: [lazy-tokenizer-with-heuristic-fallback, paragraph-packing-chunker]
key_files:
  created:
    - lib/discovery/corpus.ts
    - lib/discovery/corpus.test.ts
    - lib/discovery/__fixtures__/llms-mini.txt
    - data/corpus.json
  modified:
    - .gitignore
  already_present:
    - lib/discovery/types.ts
    - vitest.config.ts
    - package.json
decisions:
  - "Live Supabase fetch succeeded; data/corpus.json committed for offline reruns (Pitfall 5 mitigated)"
  - ".gitignore changed from data/ to data/* + !data/corpus.json to allow corpus cache while blocking other data artifacts"
metrics:
  duration_seconds: 246
  completed: "2026-04-18T12:04:30Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 4
  test_pass: 4
---

# Phase 3 Plan 01: Corpus Fetch + Chunk Summary

SWR-01 landed: Supabase docs corpus fetched live, chunked into 2550 segments with gpt-tokenizer, cached to data/corpus.json for offline reruns; shared type vocabulary (DynamicToolSpec, Chunk, CORPUS, ValidationResult, GateName) exported for all downstream Phase 3 plans.

## Task Results

### Task 1: Install Phase 3 deps + vitest config + shared types

**Status:** Already complete (WIP commit b09446e). All deps (gpt-tokenizer, ajv, fast-deep-equal, vitest) already in package.json. vitest.config.ts already includes `lib/**/*.test.ts`. types.ts already exports all 5 named types. No new commit needed.

**Pre-existing issue (out of scope):** `npx tsc --noEmit` reports error in `lib/streams/trainParser.test.ts` (`.ts` extension import without `allowImportingTsExtensions`). Not caused by this plan.

### Task 2: Implement corpus.ts + fixture + tests + live fetch

**Commit:** `64e666d` feat(03-01): corpus fetch + chunk + cache with fixture and tests

**Files created:**
- `lib/discovery/corpus.ts` -- fetchCorpus(), chunkCorpus(), loadCached()
- `lib/discovery/corpus.test.ts` -- 4 passing tests
- `lib/discovery/__fixtures__/llms-mini.txt` -- 2825 byte offline fixture
- `data/corpus.json` -- 5.6 MB cached live corpus

**Files modified:**
- `.gitignore` -- changed `data/` to `data/*` + `!data/corpus.json` to allow committed corpus

**Corpus statistics:**
| Source | Chunks | Notes |
|--------|--------|-------|
| llms | 1 | supabase.com/llms.txt (small index file) |
| cli | 24 | supabase.com/llms/cli.txt |
| guides | 2525 | supabase.com/llms/guides.txt (bulk of corpus) |
| **Total** | **2550** | **4,636,627 source bytes** |

**gpt-tokenizer status:** Loaded successfully, no fallback heuristic engaged. Token counts are BPE-accurate.

**Live fetch status:** Succeeded on first attempt against all 3 Supabase URLs. No fallback to fixture needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore blocked data/corpus.json commit**
- **Found during:** Task 2
- **Issue:** `.gitignore` had `data/` which ignored the entire directory; git negation patterns cannot override directory-level ignores
- **Fix:** Changed `data/` to `data/*` + `!data/corpus.json` so the corpus cache is trackable while other data artifacts remain ignored
- **Files modified:** .gitignore
- **Commit:** 64e666d

## Verification Results

- `npm install` -- succeeded
- `npx tsc --noEmit` on types.ts -- clean (pre-existing error in unrelated file noted)
- `npx vitest run lib/discovery/corpus.test.ts` -- 4/4 green
- `data/corpus.json` committed with 2550 chunks
- `lib/discovery/types.ts` exports DynamicToolSpec, Chunk, CORPUS, ValidationResult, GateName

## Self-Check: PASSED

All 6 created files confirmed present on disk. Commit 64e666d confirmed in git log.
