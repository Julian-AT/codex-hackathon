---
phase: 04-data-eval-gen
plan: 02
subsystem: data-quality-gates
tags: [ajv, minhash, cosine, dedup, stratification, schema-validation]
dependency_graph:
  requires: [data/adapter-tools.json]
  provides: [validateToolCall, dedupeByMinHash, dedupeByEmbedding, checkStratification]
  affects: [04-03-qa-worker, 04-04-traj-worker, 04-05-pipeline]
tech_stack:
  added: [ajv]
  patterns: [singleton-cache, reject-never-patch, MinHash-k-shingle, cosine-similarity]
key_files:
  created:
    - lib/data/types.ts
    - lib/data/schema-gate.ts
    - lib/data/dedupe.ts
    - lib/data/stratify.ts
    - lib/data/schema-gate.test.ts
    - lib/data/dedupe.test.ts
    - lib/data/stratify.test.ts
  modified: []
decisions:
  - "TrainingExample/ChatMessage/ToolCall types created in lib/data/types.ts mirroring OpenAI chat-completion fine-tuning format"
  - "schema-gate uses singleton cache pattern with _resetCache for test isolation"
  - "checkStratification takes explicit knownToolNames array rather than discovering from manifest"
metrics:
  duration_seconds: 119
  completed: 2026-04-18T13:08:45Z
  tasks_completed: 2
  tasks_total: 2
  tests_passed: 13
  tests_failed: 0
  files_created: 7
  files_modified: 0
---

# Phase 4 Plan 02: Schema Gate + Dedup + Stratify Summary

AJV-based tool-call schema validation (reject-never-patch), MinHash + cosine dedup, and per-tool stratification checker -- three reusable quality gates for training data generation.

## What Was Built

### 1. Schema Gate (`lib/data/schema-gate.ts`)
- `loadToolSchemas()` reads `data/adapter-tools.json`, compiles 8 tool parameter schemas with AJV (`allErrors: true, strict: false`), returns `Map<string, ValidateFunction>`. Cached as module-level singleton.
- `validateToolCall(toolName, args)` looks up validator by name, returns `{ valid: true }` or `{ valid: false, errors: [...] }`. Unknown tool names rejected with descriptive error.
- DAT-03 gate: reject-never-patch semantics -- callers discard failures entirely.

### 2. Dedup (`lib/data/dedupe.ts`)
- `minHashSignature(text, numHashes=128, shingleK=3)` produces MinHash signature from k-word-shingles using `node:crypto` MD5 hashing.
- `estimateJaccard(a, b)` estimates Jaccard similarity from signatures.
- `dedupeByMinHash(examples, threshold=0.7)` returns IDs to keep (first-seen survives).
- `cosineSimilarity(a, b)` pure cosine similarity for embedding vectors.
- `dedupeByEmbedding(examples, threshold=0.92)` returns IDs to keep using cosine similarity.
- DAT-06 gate: embeddings provided by caller (Plan 05 via AI SDK `embedMany`).

### 3. Stratify (`lib/data/stratify.ts`)
- `extractToolNames(example)` extracts unique tool names from a TrainingExample's messages.
- `checkStratification(examples, knownToolNames, minPerTool=30)` counts examples per tool, returns `{ pass, deficit, surplus, counts }`.
- DAT-07 gate: `pass: true` only when every known tool has >= 30 examples.

### 4. Types (`lib/data/types.ts`)
- `TrainingExample`, `ChatMessage`, `ToolCall`, `ToolDefinition` -- OpenAI chat-completion fine-tuning format types used by stratify and downstream consumers.

## Key Metrics

| Metric | Value |
|--------|-------|
| Tool schemas compiled from adapter-tools.json | 8 |
| MinHash config | numHashes=128, shingleK=3 |
| Stratification floor | 30 examples per tool |
| Test suites | 3 |
| Tests passed | 13 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 941ea4f | feat(04-02): schema-gate, dedupe, stratify modules + types |
| 2 | d7e6848 | test(04-02): 13 tests across 3 suites |

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing] Created lib/data/types.ts**
- **Found during:** Task 1
- **Issue:** Plan's stratify.ts imports `TrainingExample`, `ChatMessage`, `ToolCall` from `./types.js` but no types file was specified in plan artifacts
- **Fix:** Created `lib/data/types.ts` with OpenAI chat-completion format types
- **Files created:** lib/data/types.ts
- **Commit:** 941ea4f

## Known Stubs

None -- all modules are fully implemented with no placeholder data or TODO markers.

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (941ea4f, d7e6848) confirmed in git log.
