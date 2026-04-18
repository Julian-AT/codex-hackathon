# Phase 4 — Data + Eval Gen — Plan Index

**Phase:** 04-data-eval-gen (H5)
**Plans:** 5 plans across 3 waves
**Requirements:** DAT-01 through DAT-10
**Kill-point:** DAT-08 (training.jsonl in mlx-lm `tools` format)

---

## Wave Structure

| Wave | Plans | Parallel | Autonomous |
|------|-------|----------|------------|
| 1 | 04-01, 04-02 | yes | yes, yes |
| 2 | 04-03, 04-04 | yes | yes, yes |
| 3 | 04-05 | (single) | yes |

## Plans

| Plan | File | Objective | Requirements | Wave | Depends On |
|------|------|-----------|-------------|------|------------|
| 01 | `04-01-doc-split-types-personas-PLAN.md` | Deterministic 70/30 hash split, Phase 4 vocabulary (types), persona pool, fixtures | DAT-09 | 1 | — |
| 02 | `04-02-schema-gate-dedup-stratify-PLAN.md` | AJV schema-gate, MinHash + cosine dedup, tool-name stratification checker | DAT-03, DAT-06, DAT-07 | 1 | — |
| 03 | `04-03-data-gen-qa-worker-PLAN.md` | 500 grounded Q&A via Opus 4.7 Genstruct x PersonaHub, schema-gate enforced | DAT-01, DAT-03 | 2 | 01, 02 |
| 04 | `04-04-data-gen-traj-worker-PLAN.md` | 800 single + 200 multi + 100 parallel/dep + 50 refusal trajectories, schema-gated | DAT-02, DAT-03 | 2 | 01, 02 |
| 05 | `04-05-judge-pipeline-eval-emission-PLAN.md` | Judge-jury, dedup, stratify, JSONL emission, eval-gen, /api/data-gen route | DAT-04..DAT-10 | 3 | 01, 02, 03, 04 |

## Requirement Coverage

| REQ-ID | Covered By | Description |
|--------|-----------|-------------|
| DAT-01 | Plan 03 | 500 grounded Q&A under p-limit(15) |
| DAT-02 | Plan 04 | 800 single + 200 multi + 100 parallel/dep + 50 refusal trajectories |
| DAT-03 | Plans 02, 03, 04 | Schema-gate (02), enforced by workers (03, 04) |
| DAT-04 | Plan 05 | GPT-5 4-dim Likert judge gate |
| DAT-05 | Plan 05 | Gemini 20% cross-judge + disagreement log |
| DAT-06 | Plans 02, 05 | MinHash + cosine dedup (02 modules, 05 pipeline) |
| DAT-07 | Plans 02, 05 | Stratification >= 30/tool (02 module, 05 pipeline) |
| DAT-08 | Plan 05 | training.jsonl in mlx-lm tools format (KILL POINT) |
| DAT-09 | Plans 01, 05 | Deterministic split (01), hash-verified no-overlap (05) |
| DAT-10 | Plan 05 | 70-item eval.jsonl via GPT-5 cross-family |

## Dependency Graph

```
Wave 1:  [04-01] ─┐     [04-02] ─┐
                   │              │
Wave 2:  [04-03] ←─┘──────┘  [04-04] ←─┘──────┘
           │                     │
Wave 3:  [04-05] ←───────────────┘
```

## Key Files Created

- `lib/data/types.ts` — Phase 4 vocabulary
- `lib/data/split.ts` — Deterministic doc split
- `lib/data/personas.ts` — Persona pool + PRNG
- `lib/data/schema-gate.ts` — AJV tool-call validator
- `lib/data/dedupe.ts` — MinHash + cosine dedup
- `lib/data/stratify.ts` — Tool-name stratification
- `lib/data/qa-prompts.ts` + `qa-worker.ts` — Q&A generation
- `lib/data/traj-prompts.ts` + `traj-worker.ts` — Trajectory generation
- `lib/data/judge.ts` — Judge-jury (GPT-5 + Gemini)
- `lib/data/eval-gen.ts` — Eval set generator (GPT-5)
- `lib/data/emit-jsonl.ts` — JSONL emission
- `lib/data/pipeline.ts` — Full pipeline orchestrator
- `app/api/data-gen/route.ts` — SSE endpoint
- `data/training.jsonl` — Training data (>=1,200 examples)
- `data/eval.jsonl` — Eval set (70 items)

## Next Step

Execute: `/gsd-execute-phase 4`
