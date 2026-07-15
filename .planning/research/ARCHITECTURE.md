# Architecture Patterns

**Domain:** Local-first personal coding dataset, benchmark, and model pipeline
**Project:** MLX — the personal coding dataset and model pipeline
**Researched:** 2026-07-15
**Overall confidence:** HIGH for product boundaries and build order; MEDIUM for dependency-specific implementation details that must be rechecked against pinned versions

## Recommended Architecture

MLX should be a local modular monolith with two language runtimes and one authoritative artifact graph. Bun/TypeScript owns operator workflows, policy, mutable operational state, repository operations, benchmark execution, and process supervision. Python owns deterministic compilation and validation of Arrow/Parquet and Hugging Face releases. The runtimes exchange versioned manifests and files; they do not share in-process objects or independently mutate the same catalog tables.

The dataset contract is the governing contract. Repositories and semantic workers produce evidence; evidence produces canonical dataset releases; benchmark and training consume immutable release fingerprints. Neither training nor Studio may reach backward into repositories and invent a second data path.

```text
                                   explicit publish only
                                              |
                                              v
+-------------------+     +-------------------+-------------------+
| GitHub / git      |     | Egress gate: preview, scan, policy,   |
| authenticated I/O |     | confirmation, checksummed upload       |
+---------+---------+     +-------------------+-------------------+
          |                                       ^
          | inventory metadata                    |
          v                                       |
+---------+-------------------------------------------------------+
| Operator/control plane: Bun + TypeScript                        |
| `mlx` CLI -> application services -> SQLite jobs/runs/catalog    |
|                         |                  |                      |
|                   typed events       policy decisions            |
+------------+------------+------------------+---------------------+
             |                               |
             v                               v
+------------+------------+     +------------+--------------------+
| Repository plane         |     | Immutable artifact plane        |
| selected bare mirrors    |---->| SHA-256 CAS: source/patch/trace |
| disposable worktrees     |     | Parquet: facts/releases/results |
+------------+------------+     +------------+--------------------+
             |                               |
             v                               v
+------------+------------+     +------------+--------------------+
| Deterministic extractors |     | Python dataset compiler         |
| metrics/evidence/checks  |     | HF configs, exports, validation |
+------------+------------+     +------------+--------------------+
             |                               |
             +---------------+---------------+
                             |
                             v
              +--------------+----------------+
              | Downstream consumers           |
              | PersonalBench, MLX-LM, Studio  |
              +---------------------------------+
```

### Architectural Invariants

1. **One product root:** every mutable product artifact is under resolved `MLX_HOME`; repository fixtures are the only generated-like data allowed in the source tree.
2. **One control-plane owner:** TypeScript migrations and catalog services are the only writers of SQLite operational state.
3. **One canonical data contract:** `docs/MLX_DATASET_CONTRACT.md` governs row fields, quality gates, release configs, and split behavior. Training formats are derived views.
4. **Immutable accepted outputs:** snapshots, evidence records, run manifests, dataset versions, split manifests, benchmark tasks, and result manifests are never modified in place.
5. **References instead of duplication:** SQLite and Parquet rows reference large source, patch, trace, and log payloads by CAS digest.
6. **No implicit egress:** network reads are scoped adapters; any data-bearing upload or non-local model call crosses a separate approval boundary.
7. **No arbitrary execution:** repository contents remain data during ingestion. Executable checks run only in disposable worktrees through a reviewed `check_id` registry.
8. **Honest provenance:** every displayed datum carries source snapshot, production mode (`LIVE`, `REPLAY`, or `FIXTURE`), and as-of time.

### Component Boundaries

| Component | Owns | Must Not Own | Communicates With |
|---|---|---|---|
| `apps/cli` | `mlx` command parsing, human/JSON rendering, confirmation prompts, cancellation | Domain algorithms, raw SQL, direct artifact paths | Application services in packages |
| `apps/local-api` | Loopback read API, command submission, SSE/event projection, session token | Direct GitHub or model calls, filesystem browsing from request parameters | Catalog queries, DuckDB read models, job service |
| `apps/studio` | Required views, presentation mode, privacy-safe display, `LIVE`/`REPLAY`/`FIXTURE` labels | Reading SQLite/Parquet/files directly, initiating uploads without CLI-grade confirmation | Typed local API only |
| `packages/core` | Product identity, configuration schema, IDs, clocks, errors, event types, `MLX_HOME` root resolution | Domain persistence or network clients | Every TypeScript package |
| `packages/storage` | Root-relative safe paths, atomic files, CAS put/get/verify, immutable manifests, retention reachability primitives | Domain tables, Git semantics, release schema decisions | Core, catalog, evidence, benchmark, training |
| `packages/catalog` | SQLite migrations, repositories, selections, identities, snapshots, runs, jobs, attempts, leases, artifact references | Raw source bytes, analytical fact tables, Python-owned HF compilation | Core/storage and all application services |
| `packages/github` | Authenticated paginated GraphQL/REST/`gh` adapter, visibility/permission metadata | Selection policy, cloning every discovered repository | Catalog selection service, Git package |
| `packages/git` | Bare mirrors, incremental fetch, snapshot resolution, history/diff/blame, disposable worktree lifecycle | GitHub API policy, arbitrary check execution | Catalog, metrics, evidence, runtime |
| `packages/metrics` | Deterministic metric definitions, exclusions, aggregation, population/as-of metadata | LLM inference, UI-specific formatting | Git, catalog, Parquet writer |
| `packages/evidence` | Immutable evidence extraction, task grouping, accepted-state components, provenance | Dataset split assignment, training serialization | Git/metrics, CAS, Parquet, preferences |
| `packages/preferences` | Hierarchical claims, support/counter-evidence, exceptions, uncertainty, profile artifacts | Treating holdout evidence as training preference input | Evidence, CAS, Parquet |
| `packages/dataset` | Contract registry, filters, task groups, dedup decisions, split policy, leakage/privacy gates, release orchestration | Reaching into model training or mutating published releases | Evidence/preferences, Python compiler, storage |
| `python/mlx_dataset` | Explicit HF `Features`, Arrow/Parquet writers/readers, shard construction, dataset card/Croissant generation, `load_dataset` validation | SQLite migrations, repository selection, benchmark execution | Versioned input/output manifests |
| `packages/runtime` | Fixed model-facing tools, model adapters, allowlisted process/check registry, resource limits | Model-generated shell, source ingestion policy | Git worktrees, benchmark, training |
| `packages/benchmark` | Task definitions, suite construction, graders, paired statistics, contamination audit, result schemas | Training data selection, direct shell execution | Dataset benchmark config, runtime, Parquet |
| `packages/training` | MLX-LM preflight, experiment specs, checkpoint/resume, metric parsing, adapter lifecycle | Building datasets from repositories, assuming unverified CLI flags | Dataset exports, runtime process supervisor, benchmark |
| `schemas` | Versioned language-neutral interchange schemas and compatibility fixtures | Runtime state or generated private data | TypeScript and Python contract tests |
| `migrations` | Ordered immutable SQLite migrations and migration checksums | Ad hoc startup `ALTER TABLE` logic | Catalog only |

`packages/storage` is an explicit addition to the project-spec layout. Keeping containment, atomic writes, CAS, and immutable manifest mechanics out of `core` prevents a generic utilities package from becoming a second persistence layer.

### Dependency Direction

```text
apps -> application services -> domain packages -> core
                                      |              |
                                      v              v
                                   catalog        storage

github -> catalog selection -> git -> metrics/evidence -> preferences
                                                    |
                                                    v
                                                 dataset
                                                    |
                                      manifest boundary to Python
                                                    |
                                                    v
                                  benchmark/runtime and training
                                                    |
                                                    v
                                             local-api -> studio
```

Rules:

- Domain packages may use catalog repositories, but they do not embed SQL.
- `metrics`, `evidence`, and `preferences` do not import UI, benchmark, or training code.
- `benchmark` and `training` consume a dataset release ID/fingerprint, never repository-wide training inputs.
- Python receives a staged build manifest and writes a staged result manifest. TypeScript verifies it before recording a release.
- Studio consumes stable read models rather than domain tables, preserving the ability to evolve storage without rewriting the UI.

## Data Contracts

### Contract Ownership

| Contract | Authoritative Producer | Required Consumer | Persistence / Key Rule |
|---|---|---|---|
| `RepositorySelection` | Operator selection service | Mirror scheduler, metrics, export policy | SQLite; explicit `included`, `excluded`, `holdout`, `metrics-only`, or `pending-review` |
| `SnapshotManifest` | Git snapshot service | Metrics, evidence, reproducibility | Immutable JSON + catalog pointer; includes repository pseudonymous ID, resolved SHA, refs, visibility, timestamps, mirror state |
| `IdentityManifest` | Identity normalization service | Metrics/evidence | Immutable versioned mapping; unmatched identities remain reported, not guessed |
| `EvidenceRecord` | Evidence extractors | Preferences and dataset compiler | Contract-defined Parquet row; raw before/after/patch content is by CAS reference |
| `PreferenceProfile` | Preference aggregator | Dataset metadata, prompt baseline, Studio | Immutable JSON/Parquet; global/language/framework/repository scope with support, counter-evidence, exceptions, uncertainty |
| `SplitAssignment` | Dataset split planner | Every example generator, compiler, benchmark | One row per `task_group_id`; computed before variant expansion and immutable within dataset version |
| `DatasetReleaseManifest` | Dataset orchestrator after Python validation | Training, benchmark, Studio, publish | Immutable versioned manifest with snapshot, schema, split, dedup, privacy, file checksums, and fingerprint |
| `BenchmarkTask` | Benchmark builder | Native runner/model adapters | Dataset `benchmark` config plus CAS refs; reference patch is unavailable to the model |
| `TraceEvent` | Runtime/worker | Benchmark grader, Studio replay, audit | Observable event schema; small metadata in SQLite/Parquet and large outputs in CAS; no hidden reasoning |
| `ExperimentManifest` | Training service | Model serve, benchmark compare, model card | Immutable base model, dataset fingerprint, template, config, versions, hardware, checkpoints, metrics |
| `RunManifest` / `JobSpec` | Application service | Workers, CLI, Studio | SQLite state plus immutable input/config/implementation hashes and parent-child lineage |

### Schema Authority and Compatibility

- Dataset fields and split semantics come from `docs/MLX_DATASET_CONTRACT.md`; `schemas/` materializes versioned interchange validation, not an alternative schema.
- Python's explicit `datasets.Features` definitions are checked against committed contract fixtures and serialized into the release manifest. TypeScript validates the same interchange fixtures.
- `schema_version` changes only for shape/meaning changes. `dataset_version` identifies an immutable build. A new dataset fingerprint is required for any input snapshot, identity map, implementation revision, prompt/model ID, threshold, dedup setting, split manifest, or feature schema change.
- Unknown major versions fail closed. Compatible minor additions require tolerant readers but must not silently change required fields.
- Contract tests cross the runtime boundary: TypeScript emits representative records, Python validates/writes/loads them, and TypeScript verifies the result manifest and checksums.

### Split Is a First-Class Contract

The split planner operates on source task groups, not rows:

1. Resolve selected snapshot and repository eligibility.
2. Reserve whole-repository holdouts, stratified by relevant corpus properties.
3. Compute per-repository temporal cutoffs for remaining training-eligible repositories.
4. Assign validation and training task groups deterministically.
5. Append future task groups only to the future suite.
6. Freeze `split_manifest.parquet` with assignment reason and deterministic hash.
7. Only then expand SFT, messages, tools, preference, and benchmark variants.

Every sibling derived from a commit, PR, issue/review chain, or synthetic regression shares a `task_group_id`. Whole-repository holdouts contribute no training examples and no supporting evidence to the training-time global preference profile. Any sibling crossing, future-state context, target-diff prompt content, near-duplicate cross-split pair, or holdout reference blocks the release.

## Storage Roles

| Store | Canonical For | Not Used For | Update Model |
|---|---|---|---|
| SQLite | Mutable control state: configuration references, selections, identity versions, jobs, attempts, leases, run status, event indexes, artifact graph, release/experiment registry | Raw source, patches, large logs, dataset rows, analytical scans | Short ACID transactions through catalog services; WAL + foreign keys |
| SHA-256 CAS | Immutable byte payloads: blobs, patches, prompts/results when retained, large logs, trace payloads, checkpoints/manifests where content addressing is useful | Mutable job status, queryable metrics, secrets outside policy | Write temp under same root, hash while writing, fsync, atomic rename, verify on read |
| Parquet/Arrow | Immutable analytical facts and release tables: metrics, evidence, preferences, dedup clusters, split manifest, dataset shards, benchmark results | Queue coordination, incremental mutable status, arbitrary raw binaries | Stage, validate schema/checksum, then publish by manifest |
| Bare Git mirrors | Selected repository object database and reproducible commit lookup | Analytical truth, benchmark mutation, export payload | Incremental fetch/prune jobs; snapshot SHA pins consumers |
| Disposable worktrees | Isolated benchmark/task execution at `base_sha` | Durable evidence or user working copies | Create per run/task, execute bounded tools, capture patch/trace, remove and reconcile |
| Immutable JSON manifests | Reproducibility and commit point for snapshots, runs, releases, experiments | High-volume analytics | Atomic write after referenced artifacts verify; never edit in place |

SQLite should store CAS digests and Parquet paths relative to a resolved root, not absolute paths that make `MLX_HOME` relocation impossible. DuckDB reads immutable Parquet for analytics and Studio read models; it does not become a second mutable catalog.

## Data Flow

### Repository to Evidence

1. `mlx repos scan` asks the GitHub adapter for paginated metadata and writes `pending-review` inventory rows. It does not clone repositories.
2. The operator explicitly assigns selection and export modes. Only `included`, `holdout`, or `metrics-only` repositories may schedule mirror work according to their mode.
3. Mirror jobs update selected bare mirrors and resolve immutable snapshot SHAs. Repository hooks are never executed.
4. Deterministic extractors read pinned snapshots and emit metrics/evidence metadata. Large before/after blobs and patches are inserted into CAS.
5. Evidence rows record visibility, provenance, task group, accepted-state components, verification result, privacy status, and object references.
6. Semantic workers consume bounded evidence packages for intent, context, or preference synthesis. Structured output is schema-validated and records model/prompt version; it cannot mutate source evidence.
7. Preference aggregation produces a snapshot-scoped evidence graph and prompt-ready profile with uncertainty and counter-evidence.

### Evidence to Dataset Release

1. Dataset orchestration freezes source snapshot, identity, schema, filter, privacy, quality, and implementation inputs.
2. The split planner assigns task groups before any synthetic siblings are generated.
3. Deterministic filters and exact/near dedup stages write decision tables and reports; semantic curation may propose decisions but never bypass gates.
4. TypeScript writes a compiler input manifest referencing approved Parquet/CAS inputs.
5. Python builds staged Parquet shards for all required configs: `profile`, `evidence`, `sft`, `messages`, `preference`, `tools`, `benchmark`, and `public_demo`.
6. Python generates explicit Features, dataset card metadata, Croissant metadata, MLX-LM/TRL/LightEval exports, statistics, and checksums.
7. Validation loads every config/split without custom code, parses training exports, verifies object references, and runs privacy/dedup/leakage checks.
8. TypeScript verifies the result manifest and atomically records the immutable release. Failed staging directories remain diagnostic artifacts or are garbage-collected; they never receive a release status.

### Dataset to Benchmark and Training

1. Benchmark construction consumes only the release `benchmark` config, split manifest, approved checks, and pinned mirror snapshots.
2. A runner creates a detached disposable worktree at each `base_sha`; the model sees fixed tool schemas, prompt, budget, and `check_id` values, never the reference solution.
3. Runtime captures patch, observable trace, checks, timing, resource use, policy outcomes, and cleanup state into CAS/Parquet.
4. Training consumes only versioned exports and records the source release fingerprint. Checkpoint and adapter paths live under an experiment root in `MLX_HOME`.
5. Paired comparison joins results by task fingerprint and reports uncertainty, errors, and missing outcomes separately.
6. Studio reads materialized catalog/DuckDB read models and signed replay manifests; it does not rerun extraction while rendering.

## Control Flow and Resumable Jobs

### Job Graph

A CLI command creates a run and a dependency graph of small stage jobs. Recommended catalog entities are `runs`, `jobs`, `job_dependencies`, `job_attempts`, `job_leases`, `job_events`, `job_artifacts`, and `cancellation_requests`. A job identifies one deterministic unit such as one mirror update, repository metric partition, evidence task group, dataset build, benchmark task, or training experiment.

```text
pending -> runnable -> leased/running -> succeeded
                    |        |        -> failed_retryable -> runnable
                    |        |        -> failed_terminal
                    |        +-------> cancelled
                    +----------------> blocked (dependency terminal failure)
```

`blocked` is derived or explicitly explained; it is not a silent terminal state. A run completes only after all required children are terminal and its manifest has been finalized.

### Claim and Lease Protocol

1. A worker opens a short write transaction, selects one eligible job whose dependencies succeeded and whose lease is absent/expired, then records a new attempt, owner, and expiration atomically.
2. Commit before performing work. WAL permits concurrent readers but does not remove SQLite's single-writer rule, so no network, Git, model, subprocess, or filesystem-heavy work occurs inside a transaction.
3. Heartbeats extend the lease with a compare-on-attempt/owner condition. A stale worker that lost its lease cannot commit success.
4. Completion verifies output checksums/manifests first, then uses a short transaction to attach artifacts and mark the matching attempt succeeded.
5. Busy handling is bounded with jitter/backoff. Persistent contention is observable, not an infinite retry loop.
6. Recovery marks expired attempts abandoned and makes jobs runnable only when retry policy and idempotency rules allow it.

### Idempotency and Checkpoints

- `idempotency_key = hash(job_kind, canonical_input_hash, config_hash, implementation_version)`.
- A matching verified output manifest may satisfy a new run by reference; expensive deterministic work is not repeated.
- Stage checkpoints are opaque, versioned records that include the same input hash and implementation version. A mismatch starts a new attempt rather than resuming unsafe state.
- CAS writes are naturally repeatable. Mutable external operations, especially mirror fetch and publication, require operation-specific reconciliation.
- Dataset and benchmark staging names include run/attempt IDs; only final manifests make outputs visible to consumers.
- Cancellation is cooperative for pure stages and process-group based for subprocesses. Cleanup status is part of the attempt result, not best-effort console text.

### Crash-Recovery Reconciliation

| Resource | Recovery Check | Safe Action |
|---|---|---|
| Job lease | Lease expired and attempt heartbeat stale | Mark attempt abandoned; retry within bound |
| CAS temp file | No committed digest reference | Re-hash/promote if complete and expected, otherwise delete during GC |
| Dataset staging | No valid final result manifest/catalog release | Preserve for diagnosis or delete; never expose as release |
| Mirror update | Resolve refs/object integrity after interrupted fetch | Retry idempotent fetch; create a new snapshot only after verification |
| Benchmark worktree | Compare catalog ownership with `git worktree list --porcelain` | Terminate owned process group, capture cleanup failure, remove/prune stale metadata |
| Training process | Attempt lacks heartbeat but child/process group remains | Terminate/escalate, reconcile last valid checkpoint, retry only by policy |
| Publish attempt | Compare remote revision/files to exact upload manifest | Resume missing files or fail for operator review; never infer success from exit text |

## Trust Boundaries

| Boundary | Threat | Architectural Control | Verification Boundary |
|---|---|---|---|
| `MLX_HOME` filesystem | Traversal, symlink escape, writes into source tree or unrelated paths | Root-relative branded path type, reject `..`/absolute user fragments, `lstat`/realpath containment at existing ancestors, atomic same-root writes | Unit/property tests for traversal, symlink swaps, malicious names, and non-default roots |
| GitHub/network ingestion | Accidental enumeration/clone, token leakage, incomplete pagination | Metadata scan first, explicit selection gate, scoped adapter, redacted logs, pagination fixtures | Integration fixtures prove all pages and prove unselected repos are never cloned |
| Repository contents | Malicious hooks, filenames, configs, archives, tests | Treat as untrusted data; disable hooks; no execution in ingestion; safe archive policy; path-bounded readers | Synthetic adversarial repositories and archive/path tests |
| LLM semantic workers | Invalid schema, prompt injection, leaked target/future state, cloud egress | Structured schemas, bounded context, model/prompt provenance, leakage critic, local endpoint default, explicit provider policy | Contract tests and leakage corpus; private content blocked for unapproved endpoint |
| Process/check execution | Command injection, environment leakage, orphan processes, destructive scripts | `check_id` -> fixed executable/argv template, no shell interpolation, cwd containment, minimal env, timeout/output cap, process-group cleanup | Registry snapshot review plus injection/orphan/crash integration tests |
| TypeScript/Python handoff | Schema drift, partial files, dual catalog ownership | Versioned manifests, checksums, staged directories, cross-runtime fixtures; Python never writes catalog | End-to-end contract test builds and reloads every config |
| Loopback API/Studio | Another local page/process invokes private actions or reads data | Bind loopback only, random session token, origin checks, read/write route separation, redacted presentation projection | Browser/API tests for bind address, auth, origin, and private-field absence |
| Publication/non-local inference | Private code, metrics, names, secrets, or traces leave host | Separate egress service, visibility/license/secret/PII gates, exact preview, explicit action and confirmation, private Hub default | Negative tests prove no network write without approval; manifest-to-upload byte equality |

Privacy is not a late dataset filter. Visibility and export policy enter at repository selection and propagate through every evidence, example, trace, release, and Studio projection. Publication rechecks the current policy because a previously valid artifact may no longer be eligible.

## Patterns to Follow

### Pattern 1: Manifest-Committed Artifacts

**What:** Write payloads to an attempt-scoped staging area, validate and checksum them, then publish a small immutable manifest as the commit point.

**When:** Snapshot creation, analytical partitions, dataset releases, benchmark results, and experiments.

**Why:** A directory's existence does not prove a completed build. Manifest commit makes partial writes distinguishable after crashes.

### Pattern 2: Control Plane / Data Plane Separation

**What:** SQLite answers "what should run and where is it?"; CAS answers "which immutable bytes?"; Parquet answers "which analytical rows?".

**When:** Every persisted feature.

**Why:** It avoids SQLite blob growth, JSON-file coordination, and scanning mutable operational tables for analytical views.

### Pattern 3: Deterministic Core, Semantic Sidecar

**What:** Git facts, hashes, exclusions, metrics, quality gates, dedup candidates, splits, and executable checks are deterministic. LLM work produces versioned annotations linked to source evidence.

**When:** Evidence and preference construction.

**Why:** Semantic output can be regenerated or compared without changing source truth.

### Pattern 4: Capability Registries

**What:** Network providers, repository checks, model tools, and publish destinations are closed registries with typed parameters and policy metadata.

**When:** Any external I/O or code execution.

**Why:** A registry creates a reviewable allowlist and makes policy tests finite.

### Pattern 5: Snapshot-Scoped Read Models

**What:** Studio queries receive an as-of snapshot/release/run and a presentation mode; data is projected through catalog/DuckDB services.

**When:** Metrics, evidence funnel, profile, dataset, benchmark, training, trace, and privacy screens.

**Why:** The UI cannot accidentally combine metrics from one snapshot with a dataset or benchmark from another.

## Migration and Replacement Coverage

### Migration Strategy

Use a command-by-command strangler migration around the new `mlx` entrypoint:

1. Inventory every legacy entrypoint, persisted artifact, script, environment variable, test, and user-facing string before moving code.
2. Establish `MLX_HOME`, fixture, schema, migration, and validation boundaries first. Stop adding new production writes under repository-local `data/`.
3. Build target packages in their final ownership boundary. A thin application service may call an existing pure helper temporarily, but legacy modules do not become canonical stores.
4. Add replacement acceptance tests before redirecting each command.
5. Relocate only synthetic, deterministic test assets to `fixtures/`; label old demo output `FIXTURE` or `REPLAY`, never `LIVE`.
6. Delete an old path only after its target replacement passes, no active entrypoint imports it, and its artifact disposition is recorded.
7. Never silently migrate repository-local generated data into the evidence lake. Inspect it, classify it as fixture/replay/private legacy data, and require explicit operator action for any import or deletion.

### Replacement Matrix

| Current Surface | Target Owner | Reuse | Replacement Proof | Final Disposition |
|---|---|---|---|---|
| Root CLI, REPL, one-shot Ink UI | `apps/cli` + application services | Command parsing/rendering and abort patterns | `mlx` bin/collision/help/JSON tests; one orchestration path | Remove duplicate UI-owned pipeline logic |
| Current config loader and project-local defaults | `packages/core` + `packages/storage` | Typed validation approach | `MLX_HOME`, malformed-config fail-closed, path-containment tests | Remove legacy state paths/env names |
| UI/direct sequential pipeline orchestration | Catalog-backed run/job service | Progress event shape | lease, retry, cancel, crash, idempotency integration suite | No domain orchestration in UI |
| Documentation-specific dynamic tool discovery | Evidence/dataset semantic workers and fixed runtime tools | Schema/AST/sandbox validation ideas only where applicable | Required evidence families and fixed tool contracts pass | Remove as product architecture; keep minimal public fixture only if useful |
| JSON/JSONL generation and chunk-hash splitting | `packages/dataset` + `python/mlx_dataset` | Some normalization/dedup tests as regression seeds | All HF configs load; task/repo/time leakage suite passes | Delete mutable manifest coupling and repo-local outputs |
| Answer/text matching evaluation | `packages/benchmark` | Endpoint adapter and canonicalization where still correct | Worktree execution, graders, task-level results, paired statistics | Retire as primary benchmark; optional sanity adapter only |
| Training wrappers, parsers, supervisor scripts | `packages/training` + runtime process registry | Metric parser/supervisor concepts | exit-code, process-group, checkpoint/resume, installed-CLI preflight tests | Replace unsafe shell/env path assumptions |
| Process helpers/model server manager | `packages/runtime` | Health checks and abort plumbing | bounded logs, nonzero exit, timeout escalation, orphan cleanup | One shared process supervisor |
| Repository-local `data/` artifacts | `MLX_HOME` CAS/Parquet/runs/datasets/models | Synthetic samples after review | source tree contains fixtures only; doctor reports legacy inventory | Do not auto-import or auto-delete |
| iOS runtime/device deployment | None in required product path | No dependency for target acceptance | Target CLI/dataset/benchmark/training acceptance is independent | Quarantine or remove only after inventory; never block roadmap |

### Deletion Gate

A legacy component is removable only when all are true:

- target owner and contract are named;
- replacement validation command is green;
- production imports and executable routes are zero;
- persisted artifacts have an explicit keep/import/delete classification;
- synthetic fixture value has been preserved outside mutable runtime paths;
- privacy review confirms no generated/private material will be committed;
- destructive operator data action, if any, has separate confirmation.

## Suggested Build Order

The roadmap must preserve all eight boundaries below. Each boundary yields a usable, testable substrate and must not be collapsed into a generic MVP or polish phase.

| # | Mandatory Boundary | Build Scope | Independent Acceptance / Exit Contract | Depends On |
|---|---|---|---|---|
| 1 | **Identity, cleanup, baseline, and migration map** | `mlx` executable, product identity, collision-safe doctor, required script names, source-tree ignore/fixture rules, full legacy migration inventory and known baseline failures | Collision test cannot overwrite unrelated executable; user-facing identity audit; stable commands exist and report pass/fail/skip honestly; replacement matrix covers all legacy entrypoints/artifacts | None |
| 2 | **Foundation: configuration, SQLite, CAS, runs, and job queue** | Typed config/root paths, storage package, migrations/WAL/FKs, CAS, immutable manifests, run/job/lease/event model, cancellation/recovery | Fresh/upgrade migration tests; path/symlink escape tests; CAS corruption/atomicity tests; leased-job crash/retry/idempotency tests; no production writes outside `MLX_HOME` | 1 |
| 3 | **GitHub inventory, mirrors, identities, and accurate metrics** | Paginated metadata adapter, explicit selection, bare mirrors, pinned snapshots, identity normalization, deterministic metrics, synthetic Git histories | Unselected repo is never cloned; interrupted mirror recovers; aliases/renames/merges/reverts/binaries/generated exclusions match fixture expectations; populations/as-of/visibility are present | 2 |
| 4 | **Evidence extraction, accepted-state quality, and preference profile** | Immutable evidence records/CAS refs, task grouping, survival/verification/quality components, semantic role boundary, hierarchical preference graph/card | Evidence traces to snapshot/path/object/generator; Q0-Q4 gates are interpretable; counter-evidence/exceptions/uncertainty required; holdout evidence is excluded from training-time profile | 3 |
| 5 | **Hugging Face dataset compiler, deduplication, and leakage-safe splits** | Contract registry, Python compiler, all configs, explicit Features, Parquet, split-before-expansion, dedup/privacy/leakage reports, MLX-LM/TRL exports | Real build loads every config/split without custom code; checksums/card/Croissant present; JSONL parses; task-group, temporal, whole-repo and near-duplicate audits pass; any leakage blocks release | 4 |
| 6 | **Runtime tools, worktrees, MLX PersonalBench, and model adapters** | Fixed tools, allowlisted checks, worktree/process lifecycle, benchmark suites/graders/traces/statistics, local model adapter interface | Synthetic tasks prove patch/check/cleanup on success/failure/cancel/crash; no arbitrary shell; reference solution stays hidden; sample-level result manifest and benchmark smoke pass | 5 |
| 7 | **Apple Silicon MLX-LM training, experiment tracking, and paired evaluation** | Installed-version preflight, E2B ablations, E4B principal config, checkpoint/resume, adapters, base/profile/tuned matrix, paired statistics | On M4 Pro: real generation/tool call, bounded E4B QLoRA, save/resume/load, small paired benchmark, hardware/version/memory/throughput manifest; elsewhere explicit capability skip only | 5, 6 |
| 8 | **Studio, presentation mode, privacy review, and end-to-end acceptance** | Typed loopback API/SSE, nine required views, signed replay, labels, offline presentation, exact publish preview/private push, retention/GC, final audit | Studio build and browser tests; bind/auth/redaction tests; every metric labeled; no upload without explicit confirmation; full stable command suite plus real dataset, leakage, benchmark, and Apple acceptance evidence | 1-7 |

Phase 5 is the critical path: it proves the primary product independently of training. Phase 6 establishes trustworthy measurement before Phase 7 can claim a tuning gain. Phase 8 integrates already-accepted artifacts; it does not create substitute fixture results for missing earlier boundaries.

## Anti-Patterns to Avoid

### Direct Repository-to-Training Pipeline

**What:** Training reads mirrors, current files, or ad hoc JSONL generation directly.

**Why bad:** It bypasses immutable evidence, schema, privacy, dedup, and split audits.

**Instead:** Require a validated dataset release fingerprint and derived export manifest.

### SQLite as the Evidence Lake

**What:** Store source blobs, patches, traces, or high-volume analytical rows in operational tables.

**Why bad:** Queue/catalog contention, database growth, poor analytical scans, and unclear artifact integrity become coupled.

**Instead:** SQLite stores state and references; CAS stores bytes; Parquet stores facts.

### Two Schema Authorities

**What:** Hand-maintain unrelated TypeScript types, Python Features, and JSON schema definitions.

**Why bad:** Each runtime can validate a different dataset while claiming the same version.

**Instead:** Treat the dataset contract and versioned interchange fixtures as authority, with cross-runtime compatibility tests.

### Split After Example Expansion

**What:** Generate many rows, then randomly assign them to train/test.

**Why bad:** Siblings, future context, whole repositories, and preference evidence leak across boundaries.

**Instead:** Freeze task-group/repository/time assignments before variants.

### Long SQLite Transactions Around Work

**What:** Hold a transaction while fetching, extracting, invoking a model, or running checks.

**Why bad:** SQLite writers serialize and the entire local control plane stalls.

**Instead:** Claim, heartbeat, and commit outputs in short transactions; work outside them.

### Shell as an Extension API

**What:** Pass model/user strings into a shell command or use environment-controlled destructive paths.

**Why bad:** It defeats containment and makes execution policy unreviewable.

**Instead:** Fixed argv registries, typed parameters, contained cwd, minimal environment, and process supervision.

### Big-Bang Directory Migration

**What:** Move all root modules into the target tree and declare architecture complete.

**Why bad:** File placement does not prove replacement behavior, and private legacy artifacts can be lost or promoted incorrectly.

**Instead:** Replace commands behind contracts and delete only at explicit coverage gates.

### Studio as a Privileged Filesystem Client

**What:** Browser code chooses SQLite, Parquet, or filesystem paths directly.

**Why bad:** It couples UI to storage, weakens privacy projection, and exposes path attack surfaces.

**Instead:** Typed loopback read models and narrowly scoped command routes.

## Scale and Capacity Considerations

This is a single-operator local product. Scale should be measured by repositories, history, evidence, and tokens rather than users.

| Concern | Presentation Corpus | Core Corpus | Larger Full Corpus |
|---|---|---|---|
| Repository/history extraction | Per-repository jobs; simple partitions | Incremental snapshots and resumable task-group partitions | Adaptive scheduling, disk quotas, partition compaction |
| Evidence/dedup | In-memory exact + bounded near-dedup may suffice | Persist signatures/clusters; LSH or partitioned MinHash | Optional DataTrove blocks, still MLX-owned provenance/splits |
| Parquet layout | Few shards, avoid tiny files | Target useful shard sizes and partition by config/split | Compact immutable partitions; manifest-level pruning |
| SQLite | Single process/low worker count | WAL, indexes, short writers, event retention | Still suitable on one host if payloads remain out of DB; shard work, not catalog |
| CAS | Direct digest layout | Reachability index and integrity sampling | Retention classes, mark/sweep GC, disk pressure backoff |
| Studio queries | Read small Parquet directly via DuckDB | Materialized snapshot-scoped read models | Precomputed aggregates and bounded pagination |
| Local inference | Serialized/adaptive semantic jobs | Backpressure by model/memory capability | Multiple queues by resource class; never uncontrolled fan-out |

## Research Flags for Roadmap Phases

- **Phase 2:** Select and pin the Bun SQLite driver only after testing transaction, WAL, backup, and migration behavior on target macOS.
- **Phase 3:** Verify current GitHub CLI/API pagination, rate-limit, and permission behavior with official docs and synthetic fixtures before implementation.
- **Phase 5:** Pin compatible `datasets`, `pyarrow`, `polars`, `duckdb`, and `huggingface_hub` versions; validate `Json()` and multi-config repository metadata with a real local load test.
- **Phase 6:** Define the initial check registry and macOS process-group cleanup semantics before accepting repository execution.
- **Phase 7:** Inspect installed MLX-LM help and model cards at execution time; no remembered flag set is an architectural contract.
- **Phase 8:** Threat-model loopback API authorization and browser origin behavior before exposing private read models.

## Sources

### Authoritative Project Sources

- `docs/MLX_PROJECT_SPEC.md` - required layout, storage, security, jobs, eight roadmap boundaries, and definition of done (HIGH)
- `docs/MLX_DATASET_CONTRACT.md` - canonical schemas, configs, split-before-expansion rule, release artifacts, validation, privacy, and dedup contract (HIGH)
- `docs/MLX_BENCHMARK_SPEC.md` - worktree execution, benchmark suites, result provenance, cleanup, and paired statistics (HIGH)
- `docs/MLX_RESEARCH_RATIONALE.md` - technology rationale and current-research cautions (HIGH)
- `.planning/PROJECT.md` - active brownfield requirements and constraints (HIGH)
- `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/CONCERNS.md` - current implementation boundaries, gaps, risks, and replacement inputs (HIGH for current-worktree observations)

The pre-existing `.planning/research/SUMMARY.md` was intentionally not used as an architectural authority.

### Current Official Documentation Checked

- [SQLite Write-Ahead Logging](https://www.sqlite.org/wal.html) and [Transactions](https://www.sqlite.org/lang_transaction.html) - WAL concurrency and short transaction rationale (MEDIUM through the configured research provider; recheck against pinned driver behavior)
- [Git worktree documentation](https://git-scm.com/docs/git-worktree) - linked-worktree metadata, removal, prune, and recovery behavior (MEDIUM through the configured research provider)
- [Hugging Face Datasets repository structure](https://huggingface.co/docs/datasets/main/repository_structure), [dataset cards](https://huggingface.co/docs/datasets/main/dataset_card), and [loading methods](https://huggingface.co/docs/datasets/main/package_reference/loading_methods) - Parquet, configs/splits, metadata, Features, and custom-code-free loading (MEDIUM through the configured research provider)

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Component and acceptance boundaries | HIGH | Directly mandated by authoritative project specifications |
| Canonical data and split contracts | HIGH | Dataset contract explicitly overrides implementation convenience |
| Brownfield replacement coverage | HIGH | Based on current codebase maps and concern inventory; verify again immediately before deletion |
| SQLite/CAS/Parquet role separation | HIGH | Required by project constraints and consistent with current official storage semantics |
| Exact library/CLI APIs | MEDIUM | Versions are intentionally unpinned at research time and require phase-specific official-doc/preflight validation |
