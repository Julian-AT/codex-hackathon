# Legacy Planning Inventory — Pre-MLX Adaptation

**Inventory date:** 2026-07-15  
**Legacy snapshot:** `820b0b6e2542026d00efb5f870656f1a6c15acfd`  
**Deletion commit:** `92342150973a16cfde3ba24aa2034ef946b90ea3`  
**Archive:** `.planning/milestones/legacy-2026-04-pre-mlx-phases/`

## Purpose and boundary

This inventory separates planning records from the earlier Offline Specialist-LLM Pipeline from the active roadmap for MLX — the personal coding dataset and model pipeline.

The legacy records are retained as brownfield evidence and implementation history. Their plans, summaries, verification reports, fixture results, model-provider checks, training notes, and device demonstrations do **not** complete any requirement in the current MLX roadmap. Current acceptance remains governed by:

1. `docs/MLX_PROJECT_SPEC.md`
2. `docs/MLX_DATASET_CONTRACT.md`
3. `docs/MLX_BENCHMARK_SPEC.md`
4. `docs/MLX_RESEARCH_RATIONALE.md`

This is the planning-artifact portion of the Phase 1 migration inventory required by `IDEN-07` and `IDEN-08`. Phase 1 must still inventory repository commands, executable names, runtime paths, generated data, scripts, product strings, dynamic-tool code, and iOS components before any production removal.

## Provenance and archive policy

- Commit `820b0b6` is the final complete Git snapshot before the legacy phase tree was deleted by `9234215`.
- The complete snapshot contains 55 files across six phase directories.
- Five working-tree fragments reappeared after the MLX adaptation. They include later model-alias edits and are preserved verbatim in the archive instead of being overwritten by their older Git blobs.
- The remaining 50 files are recovered byte-for-byte from `820b0b6`.
- Source code, datasets, model artifacts, adapters, and private operator data are not moved by this archive operation.
- The archive is historical evidence only. It must never be labeled `LIVE` or used as proof that current MLX acceptance passed.

## Replacement coverage

| Legacy area | Legacy assets and intent | Current owner or disposition | Acceptance status |
|---|---|---|---|
| Phase 1 — Foundation & Smoke | Next.js/Sentry/provider smoke, Python MLX-LM microbench, iOS base deployment, adapter hot-swap, JavaScriptCore tool round-trip | Validation baseline and migration ownership: current Phase 1 (`IDEN-*`). Durable local foundations: Phase 2 (`FNDN-*`). MLX-LM preflight and real Apple Silicon evidence: Phase 7 (`TRNG-*`). The iOS path is optional v2 `SCAL-06`, not v1 acceptance. | Replacement owners recorded; all current requirements remain pending. Legacy provider, mock, device, or build evidence is not current acceptance. |
| Phase 2 — Orchestrator Harness | AI-SDK coordinator/workers, SSE stream, training subprocess, loss chart, agent-grid demo | Durable leased work and process supervision: Phase 2 (`FNDN-07`–`FNDN-11`). Training jobs and experiment lineage: Phase 7 (`TRNG-04`–`TRNG-08`). Typed loopback events and Studio views: Phase 8 (`STUD-01`, `STUD-08`–`STUD-10`). | Patterns may be reused only after containment and typed-boundary review. Sentry/Next.js demo behavior is not a production owner. |
| Phase 3 — Discovery + Tool Design | Supabase documentation corpus, generated JavaScript tools, validator gates, swarm generation, fallback tool manifest | Explicitly authorized repository discovery: Phase 3 (`REPO-*`). Schema-validated semantic workers: Phase 4 (`EVID-08`, `EVID-09`). Fixed host coding tools and allowlisted checks: Phase 6 (`BNCH-01`–`BNCH-03`). Supabase-specific discovery and generated JavaScript tools are migration inputs or fixtures, not target architecture. | Superseded. No legacy tool manifest or validator result satisfies the fixed-tool or repository-authorization contract. |
| Phase 4 — Data + Eval Gen | Chunk/persona types, deterministic 70/30 chunk split, schema gates, MinHash/cosine dedup, QA and tool trajectories, judge-jury filtering, local JSONL, held-out eval, `/api/data-gen` | Evidence quality and semantic sidecars: Phase 4 (`EVID-*`). Canonical Parquet/Hugging Face schemas, group/repository/temporal splits, dedup, leakage audit, and MLX-LM exports: Phase 5 (`DATA-*`). Executable benchmark tasks: Phase 6 (`BNCH-*`). | Superseded. The old chunk split is insufficient because it lacks mandatory repository, temporal, future, and `task_group_id` isolation. Local JSONL is a derived migration input, not the canonical dataset. |
| Phase 5 — Train Model A | MLX-LM smoke, SFT/GRPO scripts, supervisor, rollback, checkpoint and integration notes | Current Phase 7 (`TRNG-*`) after validated, fingerprinted Phase 5 dataset exports exist. | Reusable implementation material only. Old training, mock, OOM, or checkpoint evidence cannot satisfy current E2B/E4B Apple Silicon acceptance. |
| Phase 6 — Fuse, Deploy, Verify, Cassette | Adapter fusion, iPhone deployment, device UI/status, verification battery, recorded fallback | Adapter loading and paired evaluation: Phase 7 (`TRNG-07`–`TRNG-09`). Honest replay/presentation labeling: Phase 8 (`STUD-12`–`STUD-17`). iOS deployment is optional v2 `SCAL-06`. | Initial v1 device path retired. A cassette may be historical replay evidence only and must never impersonate a live MLX run. |
| Legacy Phase 7 — Three-Way Eval | Base/tuned/teacher comparison, judging, latency | MLX PersonalBench Phase 6 (`BNCH-06`–`BNCH-16`) plus experiment comparison Phase 7 (`TRNG-08`, `TRNG-09`). | Replaced by paired task-level benchmark evidence with uncertainty and contamination checks. No active legacy phase directory existed to archive. |
| Legacy Phases 8–9 — Polish and rehearsal | Demo polish, pre-cache, hardware rehearsal, cassette fallback | Current Phase 8 (`STUD-*`) and event-floor tracking. | Presentation concerns retained only under explicit `LIVE`, `REPLAY`, or `FIXTURE` labeling. No active legacy phase directories existed to archive. |

## Requirement-family disposition

| Legacy family | Current disposition |
|---|---|
| `FND-*` | Split across `IDEN-*`, `FNDN-*`, `TRNG-*`, and optional `SCAL-06`; no direct completion carry-over. |
| `ORC-*` | Split across `FNDN-*`, `TRNG-*`, and `STUD-*`; orchestration must become durable, resumable, and observable. |
| `SWR-*` | Replaced by `REPO-*`, `EVID-*`, `DATA-*`, and `BNCH-*`; Supabase-specific/generated-JS behavior is not production architecture. |
| `DAT-*` | Replaced by `EVID-*` and `DATA-*`; the Hugging Face dataset contract and leakage-safe split rules take priority. |
| `TRN-*` | Replaced by `TRNG-*`; training must consume a validated fingerprinted dataset release. |
| `DEV-*` | Device-independent portions move to `TRNG-*` and `STUD-*`; iOS is optional `SCAL-06`. |
| `EVL-*` | Replaced by `BNCH-*`, `TRNG-*`, and `STUD-*` with paired tasks, uncertainty, and contamination audits. |
| `POL-*` and `STR-*` | Presentation needs move to `STUD-*`; optional scale/device work moves to `SCAL-*`. |

## Archived artifact manifest

### `01-foundation-smoke/` — 10 files

- `01-01-SUMMARY.md`
- `01-01-next-scaffold-sentry-providers-PLAN.md`
- `01-02-SUMMARY.md`
- `01-02-python-venv-microbench-PLAN.md`
- `01-03-SUMMARY.md`
- `01-03-ios-llmeval-fork-deploy-PLAN.md`
- `01-04-SUMMARY.md`
- `01-04-adapter-hotswap-PLAN.md`
- `01-05-SUMMARY.md`
- `01-05-toolregistry-parser-roundtrip-PLAN.md`

### `02-orchestrator-harness/` — 7 files

- `02-01-SUMMARY.md`
- `02-01-pipeline-coordinator-worker-PLAN.md`
- `02-02-SUMMARY.md`
- `02-02-train-subprocess-loss-chart-PLAN.md`
- `02-03-SUMMARY.md`
- `02-03-agent-grid-demo-page-PLAN.md`
- `02-RESEARCH.md`

### `03-discovery-tool-design/` — 13 files

- `03-01-SUMMARY.md`
- `03-01-corpus-fetch-chunk-PLAN.md`
- `03-02-SUMMARY.md`
- `03-02-validator-gates-PLAN.md`
- `03-03-SUMMARY.md`
- `03-03-tool-design-worker-PLAN.md`
- `03-04-SUMMARY.md`
- `03-04-swarm-pipeline-manifest-PLAN.md`
- `03-05-SUMMARY.md`
- `03-05-fallback-hand-written-tools-PLAN.md`
- `03-RESEARCH.md`
- `03-VERIFICATION.md`
- `deferred-items.md`

### `04-data-eval-gen/` — 12 files

- `04-01-SUMMARY.md`
- `04-01-doc-split-types-personas-PLAN.md`
- `04-02-SUMMARY.md`
- `04-02-schema-gate-dedup-stratify-PLAN.md`
- `04-03-SUMMARY.md`
- `04-03-data-gen-qa-worker-PLAN.md`
- `04-04-SUMMARY.md`
- `04-04-data-gen-traj-worker-PLAN.md`
- `04-05-SUMMARY.md`
- `04-05-judge-pipeline-eval-emission-PLAN.md`
- `04-PLAN-INDEX.md`
- `04-VERIFICATION.md`

### `05-train-model-a/` — 10 files

- `05-01-SUMMARY.md`
- `05-01-smoke-and-version-bump-PLAN.md`
- `05-01-smoke-notes.md`
- `05-02-SUMMARY.md`
- `05-02-training-scripts-PLAN.md`
- `05-03-supervisor-rollback-transform-PLAN.md`
- `05-04-e2e-notes.md`
- `05-04-integration-e2e-PLAN.md`
- `05-CONTEXT.md`
- `05-RESEARCH.md`

### `06-fuse-deploy-verify-cassette/` — 3 files

- `06-01-fuse-deploy-scripts-PLAN.md`
- `06-02-ios-chatview-statuspill-toolsloader-PLAN.md`
- `06-03-verify-battery-cassette-PLAN.md`

## Working-tree fragments preserved verbatim

These five files supersede their `820b0b6` versions inside the archive and preserve later provider-alias edits:

- `01-foundation-smoke/01-01-SUMMARY.md`
- `01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md`
- `04-data-eval-gen/04-01-SUMMARY.md`
- `04-data-eval-gen/04-01-doc-split-types-personas-PLAN.md`
- `04-data-eval-gen/04-05-judge-pipeline-eval-emission-PLAN.md`

The original versions remain recoverable from `820b0b6`.

## Removal and reuse rule

Archiving removes these files only from the active GSD phase namespace. It does not authorize deletion of matching source code or runtime assets. Any later removal or reuse must:

1. identify the exact repository path,
2. classify it as retain, adapt, fixture-only, archive, or remove,
3. record its current replacement owner and requirement coverage,
4. verify the replacement against the authoritative MLX contracts,
5. preserve honest `LIVE`, `REPLAY`, and `FIXTURE` labeling,
6. and avoid carrying legacy completion status into the new roadmap.

