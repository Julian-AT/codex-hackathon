# Project Research Summary

**Project:** MLX — the personal coding dataset and model pipeline
**Domain:** Local-first personal coding evidence, dataset, benchmark, training, and presentation pipeline
**Researched:** 2026-07-15
**Confidence:** HIGH for product boundaries and architecture; MEDIUM-HIGH for the pinned implementation stack

## Executive Summary

MLX is a local-first system that turns explicitly authorized GitHub repositories into accurate engineering metrics, immutable accepted-state evidence, an evidence-backed preference profile, versioned Hugging Face-native datasets, executable personal benchmarks, and derived MLX-LM training artifacts. Its primary product is the provenance-rich dataset and evidence graph, not an adapter or demo. Expert implementation therefore starts with authorization, deterministic repository facts, durable operational state, immutable artifacts, and leakage-safe release contracts; training and presentation consume those products only after validation.

The recommended architecture is a local modular monolith with two deliberately separated planes. Bun and TypeScript own the `mlx` operator workflow, configuration, repository operations, SQLite catalog, resumable jobs, fixed coding tools, benchmark harness, process supervision, loopback API, and Studio serving. A Python package managed by `uv` owns explicit Hugging Face schemas, Arrow/Parquet compilation, statistical analysis, release metadata, and MLX-LM-compatible exports. SQLite is mutable operational state, SHA-256 CAS stores immutable bytes, and Parquet/Arrow is the canonical analytical and dataset boundary. Versioned, checksummed manifests connect the planes and make every downstream result traceable to an authorized source snapshot.

The dominant risks are false migration progress, unauthorized repository use, inaccurate Git/GitHub semantics, filesystem or execution escape, incomplete reproducibility fingerprints, leakage across source-task/repository/time boundaries, and presentation claims that outrun real evidence. Mitigate them by preserving the specification's eight independent acceptance boundaries, using synthetic repositories with known histories, assigning splits before row expansion, enforcing privacy and leakage as release-blocking gates, executing only allowlisted checks in disposable worktrees, and keeping `LIVE`, `REPLAY`, and `FIXTURE` classifications attached to each datum. The July 16, 2026 event floor is a legitimate narrower delivery target, but it is not the project definition of done.

## Key Findings

### Recommended Stack

The stack research supports a strict control-plane/data-plane split. The repository should keep exact application pins in `bun.lock` and `uv.lock`, record dependency and tool versions in material manifests, and change boundary dependencies only through compatibility probes. Parquet plus immutable manifests is the cross-runtime interface; Python must not mutate the TypeScript-owned catalog, and TypeScript must not duplicate Python's canonical dataset schema logic.

Two current compatibility findings are roadmap constraints, not optional refinements:

- **Bun/SQLite runtime gate:** Bun 1.3.11 and the probed Bun 1.3.14 binary both embed SQLite 3.51.0. SQLite's WAL-reset race is fixed in 3.51.3, so `mlx doctor` must probe `sqlite_version()`. Until the embedded version is at least 3.51.3 and concurrency tests pass, MLX must enforce one catalog-owning process/connection, use an atomic owner lock with stale-owner recovery, and route Studio and worker access through that owner. `better-sqlite3` did not load under the probed Bun runtime and is not the fallback.
- **DataTrove isolation:** DataTrove 0.9.0 requires `huggingface-hub>=0.34,<1.0`, while the current Transformers 5.14 line used with MLX-LM requires `huggingface-hub>=1.5,<2.0`. DataTrove must not be co-installed with the main compiler/training environment. If corpus scale later justifies it, run it in a separate `uv` project/process with versioned Parquet and checksummed manifests as its only interface; MLX retains ownership of schemas, provenance, splits, and representative decisions.

**Core technologies:**

- **Bun 1.3.14 + TypeScript 5.9.3:** operator CLI, local services, orchestration, typed boundaries, and process supervision; keep the TypeScript major stable during architecture migration.
- **`bun:sqlite` + numbered SQL migrations:** operational catalog for repositories, identities, snapshots, jobs, leases, runs, and artifact references; require foreign keys, WAL, bounded busy handling, short transactions, and the runtime ownership gate.
- **SHA-256 CAS:** immutable blobs, patches, traces, reports, and large logs under `MLX_HOME`, written atomically and verified on read.
- **Python 3.13 + `uv`:** locked compiler/model environment with `uv.lock`, isolated from the Bun control plane.
- **Hugging Face Datasets 5.0.0 + PyArrow 25.0.0:** explicit `datasets.Features`, Parquet shards, multi-config releases, and generic `load_dataset` validation.
- **Polars 1.42.1 + DuckDB 1.5.4:** deterministic lazy transformations and read-oriented analytics over Parquet; neither owns canonical nested HF schemas or job state.
- **`huggingface-hub` 1.23.0:** explicit private-by-default publication after scan, preview, operator action, and confirmation.
- **MLX-LM 0.31.3 + MLX 0.31.2:** derived local training and inference path; exact installed CLI help, model revision, tokenizer, and chat template are runtime inputs.
- **Gemma 4 E2B/E4B:** E2B for smoke and data ablations, E4B as the principal model, each pinned to an immutable model revision.
- **Git, GitHub CLI, `scc`, ripgrep, and Gitleaks:** fixed, version-probed repository, metrics, search, and privacy tools invoked with validated argument arrays and no shell interpolation.
- **React 19 + Vite 8 + Playwright:** loopback-only local Studio, production-served by Bun and verified through browser acceptance rather than Vite preview.

### Expected Features

The feature landscape is contract-driven. Existing CLI, JSONL, training, evaluation, and device-demo code is migration material, not proof that target capabilities exist.

**Must have (table stakes):**

- Safe `mlx` identity, `MLX_HOME`, collision-aware doctor, stable validation commands, and a complete migration/replacement inventory.
- Typed configuration, contained filesystem capabilities, migrated SQLite catalog, CAS, immutable manifests, and durable leased jobs with recovery.
- Paginated GitHub inventory separated from authorization, explicit repository modes, resumable bare mirrors, identity normalization, and reproducible metrics with populations and exclusions.
- Immutable evidence records, accepted-state Q0-Q4 quality components, bounded semantic annotations, and hierarchical preferences with uncertainty, support, counter-evidence, and exceptions.
- A real Parquet/Arrow release containing `profile`, `evidence`, `sft`, `messages`, `preference`, `tools`, `benchmark`, and `public_demo`, with explicit features, metadata, checksums, dedup reports, and leakage-safe splits.
- Derived MLX-LM, TRL, and LightEval exports tied to a validated release fingerprint, with token, truncation, tokenizer, template, and source-row records.
- Fixed host repository tools, inspected `check_id` registry, disposable worktrees, PersonalBench suites, task-level results, and paired statistical comparisons.
- Real Apple Silicon E2B/E4B generation, bounded training, checkpoint/resume, adapter load, and paired evaluation evidence.
- Loopback-only Studio with nine required views, deterministic signed replay, offline presentation mode, privacy projection, and datum-level `LIVE`/`REPLAY`/`FIXTURE` labels.
- Private-by-default egress, secret/PII/license/visibility gates, exact upload preview, explicit publish action, and confirmation.

**Should have (competitive differentiators within the required product):**

- Accepted-state learning that evaluates survival, verification, semantic value, and uniqueness without penalizing AI-assisted origin by default.
- An evidence-backed preference graph that scopes claims by global, language, framework, and repository context instead of generating an unsupported style paragraph.
- Whole-repository, temporal, and future evaluation that measures behavioral transfer rather than source memorization.
- Base versus base-plus-profile versus tuned versus tuned-plus-profile comparisons that isolate prompting gain from tuning gain.
- End-to-end lineage from authorized repository snapshot through evidence, split, dataset, export, model, benchmark, and Studio result.
- A useful dataset/profile/benchmark product even when no training run succeeds.

**Defer (v2+ or until evidence justifies cost):**

- Expansion toward 100,000 examples until held-out scaling curves justify it; quality and verified target tokens take priority over row count.
- DataTrove until local scale demonstrates a statistics/dedup bottleneck, then only as an isolated worker.
- Extra model providers and broad public benchmark suites until the native PersonalBench matrix and egress policy are stable.
- Large-scale synthetic task generation until real evidence grouping and executable validation are mature.
- Public publication beyond the explicitly approved `public_demo` subset.
- iOS/device deployment and legacy dynamic tool discovery; neither closes a required acceptance boundary.

### Architecture Approach

Use one authoritative artifact graph with explicit ownership. TypeScript catalog services coordinate work and record references; CAS stores immutable bytes; Parquet stores analytical facts and release rows; bare mirrors pin source history; disposable worktrees isolate execution; Python stages and validates dataset releases; benchmark and training consume immutable release fingerprints; Studio reads snapshot-scoped typed API projections. No consumer may create a second path from repositories directly to training or presentation.

**Major components:**

1. **CLI and application services** — parse `mlx` commands, render human/JSON output, request confirmations, create runs, and schedule domain jobs without owning algorithms or raw SQL.
2. **Core, storage, and catalog** — own product identity, safe roots, typed IDs/events, atomic files, CAS, migrations, operational tables, leases, and artifact references.
3. **GitHub and Git adapters** — inventory metadata with pagination, enforce explicit selection, maintain mirrors, resolve snapshots, normalize identities, and manage disposable worktrees.
4. **Metrics, evidence, and preferences** — deterministically compute facts, create immutable evidence/task groups, assign accepted-state quality, and synthesize scoped preference artifacts.
5. **Dataset orchestrator and Python compiler** — freeze semantic inputs, split task groups before expansion, filter/deduplicate/audit, build eight HF configs, and validate cards, schemas, Croissant, checksums, and derived exports.
6. **Runtime and PersonalBench** — expose bounded fixed tools, execute allowlisted checks, supervise processes, hide reference solutions, grade task-level results, and compute paired statistics.
7. **Training and experiment registry** — probe installed MLX-LM interfaces, consume fingerprinted exports, manage checkpoints/adapters, and record model, dataset, hardware, and evaluation lineage.
8. **Local API and Studio** — expose loopback-only authenticated read models and events, render required operational/presentation views, and preserve source classification and privacy redaction.

**Patterns to enforce:**

- Manifest-committed staged artifacts: validate and checksum payloads before publishing an immutable manifest as the commit point.
- Deterministic core with semantic sidecars: LLM annotations are versioned derivatives and never rewrite source facts.
- Capability registries: providers, repository checks, model tools, and publish targets are finite typed allowlists.
- Split-before-expansion: assign repository, temporal, future, and `task_group_id` boundaries before generating sibling rows.
- Snapshot-scoped read models: every displayed value resolves to one snapshot/release/run and one source classification.

### Critical Pitfalls

1. **Renaming the brownfield demo instead of replacing its contracts** — inventory every legacy command, artifact, store, script, and test; remove it only after named target ownership and acceptance coverage exist.
2. **Treating repository access as authorization** — separate discovery from inclusion/export policy, default changes to review, and prove excluded repositories never enter mirrors or descendants.
3. **Plausible but incorrect Git/GitHub metrics** — record pagination completion, credentials scope, source SHA, tool/options, identity coverage, exclusions, and fixture-backed reconciliation for merges, reverts, renames, binaries, and blame.
4. **Filesystem, catalog, or execution escape** — centralize containment, reject traversal/symlink/archive attacks, keep catalog transactions short, use fenced job attempts, and execute only reviewed checks in disposable worktrees.
5. **Leaky or irreproducible datasets** — include every semantic input in fingerprints, freeze task-group/repository/time splits before variants, audit cross-split similarity and holdout preference contamination, and block release on any critical privacy or leakage result.
6. **Training before dataset acceptance** — prohibit repository-to-trainer paths; training receives only a validated release fingerprint and derived export manifest.
7. **Unpaired or non-executable benchmark claims** — hide target solutions, preserve task-level errors, enforce identical policies across variants, and calculate paired uncertainty rather than a single composite score.
8. **Event-floor output presented as completed product** — maintain separate acceptance matrices; fixtures, replay, skipped hardware tests, and optional tuning never count as full project completion.

## Implications for Roadmap

The roadmap must use the eight phases below as independent acceptance boundaries. Internal work may run in parallel where dependencies permit, but no phase may be collapsed into an “MVP” or “polish” bucket, and later screenshots, adapters, or replay cannot close an earlier contract.

### Phase 1: Identity, Cleanup, Baseline, and Migration Map

**Rationale:** Every later artifact depends on the correct product root, executable identity, stable validation surface, and explicit disposition of brownfield code and data.
**Delivers:** Collision-safe `mlx`/doctor behavior, `MLX_HOME` resolution, user-facing identity audit, stable script entry points, baseline results with honest pass/fail/skip status, ignore/fixture rules, and a migration inventory with replacement proof requirements.
**Addresses:** Safe identity, complete CLI contract skeleton, migration mapping, and validation semantics.
**Avoids:** Overwriting an unrelated `mlx`, preserving stale product surfaces, deleting operator data, or claiming legacy demo output as target acceptance.
**Exit boundary:** Collision and clean-path tests pass; all legacy entrypoints/artifacts are classified; required scripts exist and cannot silently pass or mislabel skips.

### Phase 2: Foundation — Configuration, SQLite, CAS, Runs, and Job Queue

**Rationale:** Authorization, extraction, compilation, and training all require contained storage, durable operational state, immutable outputs, and recoverable orchestration before expensive data exists.
**Delivers:** Typed configuration, safe path capabilities, numbered migrations, foreign keys, WAL and runtime probe, single-owner catalog gate where required, atomic CAS, immutable run manifests, leased jobs with fencing/heartbeat/retry/cancel/recovery, and manifest-aware GC primitives.
**Addresses:** Operational reproducibility and the core/storage/catalog architecture.
**Avoids:** Path/symlink escape, hash-shaped but corrupt objects, ad hoc schemas, duplicate side effects, long SQLite transactions, and unsafe multi-process WAL assumptions.
**Exit boundary:** Fresh/upgrade/interruption migrations, CAS integrity/atomicity, traversal, lease-race, crash recovery, busy/checkpoint, and no-writes-outside-root tests pass. Doctor records the embedded SQLite version and enforces the owner gate below 3.51.3.

### Phase 3: GitHub Inventory, Mirrors, Identities, and Accurate Metrics

**Rationale:** Evidence quality is bounded by authorized, complete, immutable source snapshots and defensible repository semantics.
**Delivers:** Authenticated paginated inventory, explicit repository/export modes, resumable bare mirrors, pinned snapshot manifests, identity normalization and coverage, deterministic Git/GitHub/current-code/collaboration metrics, and synthetic repository oracles.
**Addresses:** Repository ingestion, identity, accurate engineering profile, and fixed Git/GitHub/`scc` tool use.
**Avoids:** Silent enumeration/cloning, incomplete pages, stale or shallow history, merge/binary/rename arithmetic errors, generated/vendor inflation, and blame mislabeled as total authorship.
**Exit boundary:** Unselected repositories are never cloned; pagination and permission gaps are visible; interrupted mirror updates recover; fixture metrics reconcile exactly with documented populations, exclusions, and timestamps.

### Phase 4: Evidence Extraction, Accepted-State Quality, and Preference Profile

**Rationale:** Accepted repository states must become immutable, challengeable evidence before examples or style claims can be compiled.
**Delivers:** Evidence schemas and CAS closure, source task grouping, deterministic acceptance/survival/verification components, Q0-Q4 tiers, bounded semantic roles with prompt/model lineage, and `developer_profile.json` plus `DEVELOPER_PROFILE.md` with scoped uncertainty and counter-evidence.
**Addresses:** Provenance-rich evidence, accepted-state learning, bounded semantic enrichment, and hierarchical preferences.
**Avoids:** Authorship-origin penalties, unsupported global style claims, hidden reasoning retention, prompt injection changing source facts, and holdout evidence contaminating the training-time profile.
**Exit boundary:** Every evidence row traces to an authorized snapshot/path/object/generator; deterministic re-extraction is stable; quality tiers are interpretable; claims expose support, independent repositories, counter-evidence, exceptions, and uncertainty.

### Phase 5: Hugging Face Dataset Compiler, Deduplication, and Leakage-Safe Splits

**Rationale:** This is the primary product and critical path. It must prove canonical dataset correctness independently of training success.
**Delivers:** Locked `python/mlx_dataset`, cross-runtime schemas, task-family generators, pre-expansion split manifest, deterministic filters, exact/near-dedup decision reports, all eight HF configs, explicit Features, Parquet shards, dataset card/YAML, Croissant, checksums, statistics, leakage/privacy reports, and MLX-LM/TRL/LightEval exports.
**Addresses:** Canonical HF-native data, quality filtering, deduplication, task-group/temporal/repository/future isolation, and derived training views.
**Avoids:** JSONL as source of truth, DataTrove owning contracts, incompatible dependency co-installation, arbitrary hunk splitting, sibling leakage, target/future text exposure, mutable releases, and implicit publication.
**Exit boundary:** Every config/split loads through `datasets.load_dataset` without custom code; exports parse against the recorded tokenizer/template; checksums and metadata close; real whole-repository and temporal holdouts exist; all blocking leakage/privacy findings are zero.

### Phase 6: Runtime Tools, Worktrees, MLX PersonalBench, and Model Adapters

**Rationale:** Trustworthy execution and measurement must exist before tuning gains can be claimed.
**Delivers:** Fixed JSON Schema coding tools, bounded outputs, inspected check registry, disposable base-SHA worktrees, process/resource cleanup, benchmark suite construction, local model adapters, observable traces, task-level results, paired bootstrap/McNemar/Bradley-Terry statistics, and contamination reports.
**Addresses:** Repository-native task execution, navigation, style choice, generalization, and controlled model comparisons.
**Avoids:** Arbitrary shell, reference-patch leakage, checks against dirty user worktrees, orphan processes, result-only aggregate scoring, unequal variant policies, and cloud egress of private tasks.
**Exit boundary:** Synthetic tasks prove patch/check/cleanup across pass, fail, cancel, timeout, and crash paths; model-visible inputs exclude targets; `bun run benchmark:smoke` executes real worktrees and emits sample-level manifests.

### Phase 7: Apple Silicon MLX-LM Training, Experiment Tracking, and Paired Evaluation

**Rationale:** Training is a downstream experiment that consumes accepted dataset and benchmark contracts; hardware and installed CLI behavior cannot be inferred from mocks.
**Delivers:** Installed-version preflight, pinned model/tokenizer/template revisions, E2B smoke and data ablations, bounded E4B QLoRA profiles, checkpoint/save/resume/load, experiment manifests/model cards, adapter inference, and paired base/profile/tuned evaluation.
**Addresses:** MLX-LM exports, real M4 Pro acceptance, experiment lineage, and separation of prompting versus tuning gain.
**Avoids:** Remembered MLX-LM flags, incompatible templates/masks, unsupervised intermediate tool actions, silent dependency drift, unpaired comparisons, and capability skips reported as passes.
**Exit boundary:** Signed target-machine manifests prove E2B generation and structured tool use, E4B preflight and bounded training, checkpoint resume, adapter inference, paired subset evaluation, peak memory, throughput, wall time, software, and hardware versions.

### Phase 8: Studio, Presentation Mode, Privacy Review, and End-to-End Acceptance

**Rationale:** Studio should integrate already-validated artifacts and make their provenance visible; it must not invent substitute outputs for missing phases.
**Delivers:** Authenticated loopback API/SSE, nine required Studio views, snapshot-scoped DuckDB read models, offline 16:9 presentation, signed deterministic replay, keyboard operation, privacy/redaction view, exact private-push preview and confirmation, retention/GC UI support, and a complete acceptance matrix.
**Addresses:** Honest local presentation, operator workflows, privacy review, end-to-end portable and Apple acceptance, and independent audit.
**Avoids:** Browser access to raw files/catalog, network exposure, mixed snapshot data, unredacted private names, external presentation assets, unlabeled fixture/replay output, and event-floor completion claims.
**Exit boundary:** Studio build and browser/API security tests pass; every displayed value reconciles to immutable source data and classification; no data-bearing upload occurs without explicit action and confirmation; all definition-of-done evidence is present and an independent audit finds no unresolved critical issue.

### Phase Ordering Rationale

- Identity and migration control precede new state so brownfield artifacts cannot become accidental production inputs.
- Storage, catalog, and job guarantees precede repository ingestion because authorization snapshots, mirrors, and recovery depend on them.
- Repository facts precede evidence; evidence precedes examples; validated examples precede benchmark/training. This is the only ordering that preserves provenance and avoids a direct repository-to-trainer path.
- Split assignment and leakage policy belong in the dataset release before benchmark construction. PersonalBench must exist before training results can be interpreted.
- Studio is last because it integrates authoritative artifacts; presentation work may use clearly labeled fixtures during development but cannot close upstream gates.

### Project Definition of Done vs Event Success Floor

**Full project completion** requires all eight independent boundaries plus the complete acceptance contract: safe identity and migration, tested catalog/jobs/CAS, authorized repository ingestion and exact metrics, immutable evidence and uncertain preferences, real eight-config HF builds and leakage audits, executable worktree benchmark, paired base/profile/tuned results, real E2B/E4B M4 Pro acceptance, all nine Studio views, portable checks, privacy guarantees, and an independent final audit with no unresolved critical issue.

**July 16, 2026 event success floor** is intentionally narrower and must remain labeled as such:

- Real metrics from a small explicitly selected repository set.
- A real preference profile linked to supporting and counter-evidence.
- 500-2,000 validated Hugging Face-ready examples in a local/private dataset that loads through `datasets`.
- 20-50 held-out benchmark tasks.
- A paired base versus base-plus-profile comparison with sample-level results and uncertainty.
- Optional tuned E2B results only if a real adapter and evaluation exist.
- A polished Studio replay with accurate `LIVE`, `REPLAY`, and `FIXTURE` labels.

Meeting the event floor does not prove a 25,000-50,000-example core dataset, a final E4B adapter, full tuning benefit, complete Apple acceptance, or project completion. The roadmap should track event evidence and full acceptance evidence in separate matrices.

### Research Flags

Phases likely needing targeted deeper research during planning:

- **Phase 2:** Re-probe the exact Bun runtime and embedded SQLite engine; validate transactions, backup, busy handling, WAL checkpoints, owner-lock recovery, and the criteria for removing the single-owner gate.
- **Phase 3:** Freeze current GitHub GraphQL/REST queries, authentication scopes, pagination, rate-limit behavior, Git option semantics, and fixed tool versions against official interfaces and fixtures.
- **Phase 5:** Resolve and lock the complete Python dependency graph; re-run explicit nested Features, multi-config, generic load, private staging, Viewer, and export compatibility tests. Keep DataTrove isolated if introduced.
- **Phase 6:** Select target-macOS process containment/resource limits and define the initial inspected check registry before accepting repository execution.
- **Phase 7:** Inspect installed MLX-LM help and selected Gemma model cards/templates, then benchmark safe/balanced/aggressive memory profiles on the actual M4 Pro 24 GB machine.
- **Phase 8:** Threat-model loopback authentication, hostile browser origins, replay signing/key handling, redacted projections, and exact publication-byte verification.

Phases with established patterns that do not need broad ecosystem research:

- **Phase 1:** Identity inventory, collision detection, baseline capture, and strangler-style replacement mapping are well specified; implementation still needs repository-local validation.
- **Phase 4:** Evidence schemas, immutable annotation sidecars, accepted-state components, and hierarchical preferences are defined by the contracts. Planning needs empirical threshold/prior calibration, not new architectural research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Exact current versions and a HF/PyArrow/Polars/DuckDB smoke support the recommendation. Bun's embedded SQLite gate and real MLX-LM hardware behavior remain implementation-time validations. |
| Features | HIGH | Table stakes, differentiators, deferrals, and event-floor limits derive directly from the four authoritative MLX contracts and brownfield mapping. |
| Architecture | HIGH | The control/data plane split, store ownership, immutable artifact graph, split contract, and eight build boundaries are contract-aligned and consistent across research. |
| Pitfalls | HIGH for contract risks; MEDIUM for runtime-specific mitigations | Privacy, provenance, leakage, metrics, execution, and honesty failures are well defined. Exact macOS, Bun, GitHub, HF, and MLX-LM behavior must be rechecked against installed versions. |

**Overall confidence:** HIGH in roadmap shape and acceptance boundaries; MEDIUM-HIGH in exact implementation pins.

### Gaps to Address

- **Bun SQLite upgrade timing:** keep the owner gate until doctor observes SQLite >=3.51.3 and the concurrency/recovery suite passes; do not plan around an assumed Bun release.
- **Python lock closure:** verify all compiler, training, and optional groups can lock together. DataTrove remains a separate project because its Hub constraint conflicts with the main Transformers/MLX-LM environment.
- **GitHub query contract:** authenticated scopes, permission gaps, pagination fields, caching, and rate-limit recovery need live but explicitly scoped validation without enumerating private repositories for test coverage.
- **Quality and preference calibration:** Q-tier thresholds, repository weights, recency, shrinkage priors, and semantic retry policy require sensitivity analysis over authorized fixture/live evidence.
- **Dataset mix and scale:** select corpus size from verified target tokens, balance, quality, and held-out scaling curves rather than padding to a row target.
- **Benchmark power:** task validity, suite balance, minimum detectable effects, and missing/error handling must be evaluated on sample-level results before interpreting a composite.
- **M4 Pro resource envelope:** sequence length, LoRA layers/rank, checkpoint behavior, peak memory, throughput, and thermal/disk behavior require real measurements.
- **Publication and replay trust:** rights policy, private-Hub staging, Dataset Viewer behavior, replay signing keys, and browser origin controls need concrete acceptance designs.

## Sources

### Primary (HIGH confidence)

- [`docs/MLX_PROJECT_SPEC.md`](../../docs/MLX_PROJECT_SPEC.md) — product principles, architecture, storage, required features, eight independent roadmap boundaries, full definition of done, and event success floor.
- [`docs/MLX_DATASET_CONTRACT.md`](../../docs/MLX_DATASET_CONTRACT.md) — canonical schemas, configs, task groups, quality, deduplication, leakage, privacy, and release validation.
- [`docs/MLX_BENCHMARK_SPEC.md`](../../docs/MLX_BENCHMARK_SPEC.md) — task suites, disposable worktree harness, scoring, paired statistics, contamination controls, and presentation benchmark floor.
- [`docs/MLX_RESEARCH_RATIONALE.md`](../../docs/MLX_RESEARCH_RATIONALE.md) — reviewed research rationale and primary-source index for datasets, training, retrieval, metrics, and benchmark decisions.
- [`.planning/PROJECT.md`](../PROJECT.md) — active brownfield context, validated/missing capabilities, constraints, and product decisions.

### Supporting Research (HIGH to MEDIUM-HIGH confidence)

- [`.planning/research/STACK.md`](STACK.md) — verified versions, executable compiler smoke, SQLite runtime probe, DataTrove dependency conflict, and technology alternatives.
- [`.planning/research/FEATURES.md`](FEATURES.md) — contract-traced table stakes, differentiators, anti-features, dependency graph, and event-floor separation.
- [`.planning/research/ARCHITECTURE.md`](ARCHITECTURE.md) — component ownership, artifact graph, data/control flow, migration matrix, build order, and phase research flags.
- [`.planning/research/PITFALLS.md`](PITFALLS.md) — release-blocking failure modes, recovery guidance, stop conditions, phase warnings, and portable versus Apple acceptance.

### Current Official and Executable Checks (MEDIUM-HIGH confidence)

- [SQLite WAL documentation](https://www.sqlite.org/wal.html) and the Bun SQLite runtime probe — embedded-version gate and single-owner mitigation.
- [Hugging Face Datasets repository structure](https://huggingface.co/docs/datasets/en/repository_structure), [main classes](https://huggingface.co/docs/datasets/en/package_reference/main_classes), and the isolated compiler smoke — multi-config Parquet, explicit Features, and generic load compatibility.
- [DataTrove 0.9.0 metadata](https://pypi.org/project/datatrove/0.9.0/) and [Transformers metadata](https://pypi.org/project/transformers/) — incompatible `huggingface-hub` ranges that require process/environment isolation.
- [MLX-LM LoRA documentation](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md), installed CLI help, and Gemma model cards — training interface and model assumptions, pending target-hardware acceptance.
- Official Git, GitHub CLI/API, PyArrow, Polars, DuckDB, Vite, Bun, React, and Playwright documentation cited in the detailed research files.

---
*Research completed: 2026-07-15*
*Ready for roadmap: yes*
