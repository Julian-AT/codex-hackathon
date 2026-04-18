---
phase: 04-data-eval-gen
plan: 05
subsystem: data-pipeline
tags: [judge, eval, jsonl, pipeline, dedup, stratify]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides: [data/training.jsonl, data/eval.jsonl, /api/data-gen]
  affects: [phase-05-training, phase-07-eval]
tech_stack:
  added: []
  patterns: [judge-jury cross-family, JSONL emission, pipeline orchestrator, SSE progress streaming]
key_files:
  created:
    - lib/data/judge.ts
    - lib/data/eval-gen.ts
    - lib/data/emit-jsonl.ts
    - lib/data/pipeline.ts
    - app/api/data-gen/route.ts
    - lib/data/judge.test.ts
    - lib/data/emit-jsonl.test.ts
  modified: []
decisions:
  - GPT-5 as primary judge with Gemini 2.5 Pro 20% cross-check (PRD cross-family anti-leakage)
  - OpenAI text-embedding-3-small for cosine dedup with 2048 batch size
  - Meta field stripped from DynamicToolSpec for mlx-lm tools format compatibility
metrics:
  duration: 285s
  completed: 2026-04-18T13:32:12Z
  tasks: 2/2
  tests: 13/13
  files_created: 7
requirements_covered: [DAT-04, DAT-05, DAT-06, DAT-07, DAT-08, DAT-09, DAT-10]
---

# Phase 4 Plan 5: Judge Pipeline + Eval Emission Summary

GPT-5 + Gemini 2.5 Pro judge-jury quality gate, pipeline orchestrator wiring all Phase 4 stages, JSONL emission in mlx-lm tools format (DAT-08 kill-point), GPT-5 cross-family eval-gen (70 items), and /api/data-gen SSE route.

## What Was Built

### lib/data/judge.ts
- `judgeExample(example, judgeModel)`: rates one example on 4 Likert dimensions (faithfulness, toolCorrectness, naturalness, grounding) using AI SDK `generateObject` at temperature 0.
- `judgeJury(examples, opts)`: GPT-5 judges ALL examples; Gemini 2.5 Pro cross-checks 20% sample under p-limit(15). Jury score = GPT-5 primary. Examples with ANY dimension < 4 are rejected. Disagreements > 1 Likert point logged.
- `JUDGE_SCHEMA`: Zod schema for structured output.

### lib/data/eval-gen.ts
- `generateEvalSet(opts)`: produces 70 held-out eval items via GPT-5 (cross-family from Opus training data). Default counts: 40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool. Each EvalItem has expectedToolCalls for BFCL-AST matching.

### lib/data/emit-jsonl.ts
- `emitTrainingJsonl(examples, outPath)`: writes mlx-lm `tools` format JSONL. Strips `meta` from DynamicToolSpec. DAT-08 kill-point format.
- `emitEvalJsonl(items, outPath)`: writes one EvalItem per line.
- `verifyNoOverlap(trainingSourceChunks, evalChunkIds)`: DAT-09 hash-verified no-overlap check.

### lib/data/pipeline.ts
- `runDataGenPipeline(opts)`: full Phase 4 orchestrator. Stages: (1) corpus + split, (2) load tools, (3) QA + Traj parallel fan-out, (4) judge-jury filter, (5) MinHash dedup 0.7, (6) cosine dedup 0.92 via text-embedding-3-small, (7) stratification check >=30/tool, (8) emit training.jsonl, (9) eval-gen, (10) emit eval.jsonl, (11) overlap check. Returns full pipeline stats.

### app/api/data-gen/route.ts
- POST endpoint with `runtime='nodejs'` + `dynamic='force-dynamic'`. Streams progress via `createUIMessageStream`. Emits `data-agent-status` per stage and `data-task-notification` on completion. Error truncated to 400 chars (T-04-16).

## Test Results

- `lib/data/judge.test.ts`: 5 tests passing
  - judgeExample returns correct JudgeScore
  - judgeJury accepts examples >= 4 on all dims
  - judgeJury rejects examples < 4 on any dim
  - Gemini model selection works
  - Disagreement detection when GPT-5/Gemini differ > 1
- `lib/data/emit-jsonl.test.ts`: 8 tests passing
  - emitTrainingJsonl writes one JSON object per line
  - Each line parses as { messages, tools }
  - Tools array does NOT contain meta field
  - Messages strip undefined fields
  - emitEvalJsonl writes correct count
  - verifyNoOverlap returns pass:true for disjoint sets
  - verifyNoOverlap returns pass:false for overlapping
  - Overlap entries are deduplicated

**Total: 13/13 tests passing.**

## Pipeline Stage Flow

```
fetchCorpus -> splitDocs(70/30)
  -> [generateQABatch || generateTrajBatch]  (parallel)
  -> judgeJury (GPT-5 ALL + Gemini 20%)
  -> dedupeByMinHash (threshold 0.7)
  -> dedupeByEmbedding (threshold 0.92, text-embedding-3-small)
  -> checkStratification (>=30 per tool)
  -> emitTrainingJsonl (data/training.jsonl)
  -> generateEvalSet (GPT-5 cross-family, 70 items)
  -> emitEvalJsonl (data/eval.jsonl)
  -> verifyNoOverlap (DAT-09)
```

## Note on Live Pipeline Execution

The route is wired and tested with mocks. Actual data generation requires provider API keys (OpenAI for GPT-5 + embeddings, Google for Gemini, Anthropic for Opus). The `data/training.jsonl` and `data/eval.jsonl` files will be populated when the pipeline is triggered during demo preparation at `/api/data-gen`.

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Mitigations Implemented

| Threat ID | Mitigation |
|-----------|------------|
| T-04-12 | Cross-family judging: GPT-5 judges Opus output; Gemini 20% cross-check |
| T-04-13 | `verifyNoOverlap` checks all training sourceChunks against eval chunk IDs |
| T-04-14 | Cosine dedup applied AFTER MinHash; batched at 2048 |
| T-04-15 | `stripMeta` removes meta field; emit-jsonl.test.ts verifies format |
| T-04-16 | Route truncates errors to 400 chars |

## Requirements Covered

- **DAT-04**: GPT-5 4-dim Likert judge gate (min 4 on all dims)
- **DAT-05**: Gemini 2.5 Pro 20% cross-check + disagreement logging
- **DAT-06**: MinHash 0.7 + cosine 0.92 two-stage dedup
- **DAT-07**: >=30 examples per tool stratification check
- **DAT-08**: training.jsonl in mlx-lm tools format (KILL POINT)
- **DAT-09**: Hash-verified 70/30 split no-overlap
- **DAT-10**: 70-item eval.jsonl via GPT-5 cross-family (40/10/15/5)

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | judge.ts + eval-gen.ts + emit-jsonl.ts | 7af4fa1 | lib/data/judge.ts, lib/data/eval-gen.ts, lib/data/emit-jsonl.ts |
| 2 | pipeline.ts + route + tests | 7b3d133 | lib/data/pipeline.ts, app/api/data-gen/route.ts, lib/data/judge.test.ts, lib/data/emit-jsonl.test.ts |

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (7af4fa1, 7b3d133) verified in git log.
