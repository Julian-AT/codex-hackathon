# Feature Landscape

**Domain:** Local-first personal coding evidence, dataset, preference, benchmark, training, and presentation pipeline
**Product:** MLX — the personal coding dataset and model pipeline
**Researched:** 2026-07-15
**Overall confidence:** HIGH for required product capabilities; MEDIUM for current external library details

## Scope and Status Legend

This is a contract-driven brownfield feature landscape. "Table stakes" means required for MLX to satisfy its authoritative product contract, even when the same capability would be unusual in a smaller demo. Existing demo behavior is not automatically table stakes and does not prove contract acceptance.

| Status | Meaning |
|--------|---------|
| Existing | Implemented in the current repository in substantially reusable form. |
| Partial | A reusable mechanism exists, but its data model, safety properties, or acceptance behavior does not meet the MLX contract. |
| Missing | No target-product implementation is present in the mapped codebase. |
| Legacy | Present only in the earlier demo or iOS path and not part of the target product. |

Complexity is relative to this repository: **Low** is a focused change, **Med** crosses a few modules, and **High** requires a subsystem or end-to-end contract.

Source abbreviations used below:

- **PS** — `docs/MLX_PROJECT_SPEC.md`
- **DC** — `docs/MLX_DATASET_CONTRACT.md`
- **BS** — `docs/MLX_BENCHMARK_SPEC.md`
- **RR** — `docs/MLX_RESEARCH_RATIONALE.md`
- **CB** — `.planning/codebase/ARCHITECTURE.md` (brownfield status only, not product authority)

## Table Stakes

Features required by the product contract. Missing items make MLX incomplete, regardless of whether the local model demo still runs.

### Boundary 1: Identity, Cleanup, Baseline, and Migration Map

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Safe `mlx` identity and executable | The only operator-facing binary is `mlx`; first mention uses the full product name, state defaults to `~/.mlx` with `MLX_HOME`, and `mlx doctor` detects an unrelated Apple/ecosystem `mlx` collision without overwriting it. | Med | None | **Partial** — Bun/Ink CLI exists, but user-facing `codex` text, package identity, and `.codex` paths remain. | PS §§1, 24, 28.1, 29 |
| Complete operator CLI contract | Human-readable commands cover doctor/init/auth, repository review, mirrors, metrics, evidence, preferences, dataset, benchmark, training, model/agent, Studio, pipeline, and GC; practical commands also expose deterministic `--json`. | High | Safe identity; typed command contracts | **Partial** — command registry, REPL, one-shot stages, cancellation, and local server lifecycle exist, but most target commands and machine output do not. | PS §§24-25, 28.1 |
| Migration inventory and replacement proof | Brownfield discovery, JSONL, training, evaluation, shell, branding, and iOS paths must be classified before removal; destructive migration waits for replacement coverage. | Med | Codebase inventory; stable baseline tests | **Partial** — architecture mapping exists, but no migration manifest or replacement proof is implemented. | PS §§5-6, 28.1; RR "Data processing" |
| Stable validation surface | Portable checks, integration checks, dataset validation, benchmark smoke, Studio build, and capability-gated Apple Silicon checks provide repeatable acceptance rather than ad hoc demos. | Med | Script naming; fixture strategy | **Partial** — test/typecheck/check exist; required integration, Studio, dataset, benchmark, and local acceptance scripts are absent. | PS §§28.1, 29 |

### Boundary 2: Foundation — Configuration, SQLite, CAS, Runs, and Jobs

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Typed configuration and contained paths | Every artifact root, mode, repository policy, and subprocess path resolves beneath `MLX_HOME`; traversal and symlink escapes fail closed. | High | Boundary 1 identity | **Partial** — Zod configuration exists, but it targets legacy settings and direct `data/` paths rather than the required state layout. | PS §§7, 25-26, 28.2 |
| Migrated SQLite catalog | Operational state uses persisted migrations, WAL, foreign keys, repository/run/job lineage, and no ad hoc schema mutation. | High | Typed IDs and schemas | **Missing** — current persistent state is plain JSON/JSONL files. | PS §§6-7, 25, 28.2, 29 |
| SHA-256 content-addressed object store | Immutable source, patch, trace, and generated blobs are deduplicated by digest; SQLite and Parquet retain references rather than duplicating raw content. Integrity checks, atomic writes, and fsync protect reproducibility. | High | Contained paths; catalog | **Missing** | PS §§7, 10, 27-29 |
| Immutable run manifests and resumable jobs | Long stages have input/config hashes, idempotency keys, leases, heartbeats, retries, checkpoints, cancellation, recovery, event logs, and parent/child lineage. Identical deterministic inputs do not repeat expensive work. | High | Catalog; CAS; typed events | **Partial** — abort signals, subprocess registries, training checkpoints, and pipeline events are reusable, but there is no leased durable job model or immutable run manifest. | PS §§7, 25, 27-29 |
| Local storage operations | Disk usage, integrity inspection, retention, and `mlx gc` manage mirrors, worktrees, objects, datasets, models, caches, and logs without deleting referenced artifacts. | Med | Catalog; CAS; manifests | **Missing** | PS §§7, 24 |

### Boundary 3: GitHub Inventory, Mirrors, Identities, and Accurate Metrics

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Authenticated, paginated, explicit repository inventory | GitHub CLI plus paginated GraphQL/REST discovers owned, private, organization, collaborator, archived, and fork repositories, but persists an operator-reviewed `included`, `excluded`, `holdout`, `metrics-only`, or `pending-review` state instead of silently ingesting everything. | High | Foundation; GitHub auth adapter | **Missing** | PS §8.1, §§24, 28.3, 29; RR "GitHub metrics" |
| Incremental bare mirrors and snapshot identity | Selected repositories become resumable, observable bare mirrors with pruned updates, immutable snapshot IDs, interruption recovery, and no content written into the application repository. | High | Explicit selection; jobs; contained paths | **Missing** | PS §§7, 8.2, 28.3, 29 |
| Identity normalization with coverage reporting | Names, emails, GitHub noreply addresses, `.mailmap`, co-authors, and manual aliases are reconciled without guessing; unmatched contributors and identity coverage remain visible. | Med | Mirrors; GitHub metadata | **Missing** | PS §8.3, §§9.2, 27-29 |
| Accurate repository and collaboration metrics | Counts distinguish access, selection, ownership, organization/collaboration, visibility, archived/fork state, PRs, reviews, issues, merge strategy, lifetimes, reverts, and follow-up fixes. | High | Inventory; GitHub pagination; identities | **Missing** | PS §§9.1, 9.5, 28.3; RR "GitHub metrics" |
| Accurate Git-history activity metrics | Authored/non-merge/merge/co-authored commits, churn, net change, patch percentiles, files, activity, streaks, time distribution, and binary row treatment use explicit deterministic definitions. | High | Mirrors; identities | **Missing** | PS §9.2; RR "GitHub metrics" |
| Current-code, survival, and engineering-pattern metrics | Deterministic source counting excludes generated/vendor/build/minified content; blame is labeled "surviving attributed lines"; tests/docs/config proportions, tooling adoption, complexity, hotspots, error patterns, and language/framework evolution are measured. Every display includes population, exclusions, timestamp, and data provenance. | High | Mirrors; identities; inspected counter configuration | **Missing** | PS §§9.3-9.6; RR "GitHub metrics" and "Recommended size" |

### Boundary 4: Evidence, Accepted-State Quality, and Preferences

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Immutable provenance-rich evidence lake | Every commit/PR/review/issue/file/config/trace record has schema, snapshot, repository policy, source refs, SHAs, time, paths, blob/patch object hashes, classifiers, validation, generator/prompt versions, privacy result, and `task_group_id`. | High | Mirrors; catalog; CAS; schemas | **Missing** | PS §§10, 27-29; DC §§2, 4.2, 14 |
| Deterministic accepted-state quality tiers | Interpretable acceptance, survival, verification, semantic value, instruction/context quality, uniqueness, recency, repository weight, and privacy components produce Q0-Q4 tiers. Privacy, schema, and leakage remain hard gates; authorship origin is audit metadata only. | High | Evidence; repository checks; quality calibration | **Missing** | PS §11; DC §§5, 9 |
| Bounded semantic enrichment | Intent reconstruction, context selection, preference mining, trajectory solving, test synthesis, and critique use typed structured outputs, recorded model/prompt versions, bounded retries, observable outcomes, and never rewrite source evidence silently or retain hidden reasoning. | High | Evidence schemas; model adapter; jobs | **Partial** — model workers and schema gates exist for legacy documentation/tool generation, not repository evidence roles or target schemas. | PS §12; DC §§6-8 |
| Hierarchical evidence-backed preference profile | `global`, language, framework, and repository-local claims carry stable IDs, deterministic features, support and independent-repository counts, uncertainty/shrinkage, supporting evidence, counter-evidence, exceptions, and training implications. Repository formatter settings stay local unless cross-repository evidence supports promotion. | High | Evidence; quality tiers; split policy | **Missing** | PS §17, §28.4; BS §§2.3, 3 |
| Prompt-ready and machine-readable profile artifacts | Each snapshot emits `developer_profile.json` as the evidence graph and `DEVELOPER_PROFILE.md` as a concise profile card with confidence and exceptions; benchmark variants use the exact profile version. | Med | Preference aggregation; manifests | **Missing** | PS §§17, 21, 27; BS §§3, 7 |

### Boundary 5: Hugging Face Dataset Compiler, Deduplication, and Safe Splits

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Canonical task families and selective context | Historical edits, navigation, observable tool trajectories, test/debug tasks, real preference pairs, and architecture/explanation tasks use pre-change state, grounded instructions, bounded context levels, hard negatives where appropriate, and coherent task units. | High | Evidence; semantic enrichment; fixed tools | **Partial** — legacy chat/tool trajectory generation exists, but it is documentation-derived rather than accepted repository-state data. | PS §§13-14; DC §§5-8; RR "Code history as data" and "Selective context" |
| Versioned Parquet/Arrow release with eight configs | Immutable `schema_version` and fingerprinted `dataset_version` produce explicit `datasets.Features` for `profile`, `evidence`, `sft`, `messages`, `preference`, `tools`, `benchmark`, and `public_demo`, with sane shards and no custom loader. | High | Evidence; profile; schemas; Python compiler | **Missing** — no Python dataset package, Parquet lake, explicit HF schemas, or target configs exist. | PS §§18-19, 27-29; DC §§1-4; RR "Hugging Face Datasets" and "TRL and tool data" |
| Quality filtering and auditable multi-layer deduplication | Generated/vendor/binary/lock/build/minified/format-only/privacy-failing/incoherent tasks are excluded or downgraded; exact object/patch and instruction hashes, MinHash, syntax fingerprints, and reviewable similarity candidates emit cluster and decision reports. | High | Evidence quality; object hashes; parsers | **Partial** — legacy MinHash/cosine dedup and source-overlap checks exist, but not target filters, provenance, ordered reports, or split-aware policy. | PS §15; DC §§9-10; RR "Data processing" |
| Leakage-safe task-group, temporal, repository, and future splits | Split assignment happens before variants expand; siblings never cross splits; whole repositories, later history, and future tasks remain isolated; global preferences cannot leak holdout evidence. A leakage failure blocks release even for a small corpus. | High | Task groups; snapshot manifest; dedup | **Missing** — current chunk-hash splitting and overlap checks do not satisfy repository/task/time isolation. | PS §16, §§28.5, 29; DC §§10-13; BS §§2.4-2.6, 7 |
| HF-native release artifacts and loading validation | Dataset card/YAML, manifest, schemas, checksums, Croissant, statistics, quality/dedup/leakage reports, split manifest, and known limitations accompany a release. Every config/split loads through `datasets.load_dataset`; Viewer compatibility is checked where privacy allows. | High | Parquet configs; privacy gates; release manifest | **Missing** | PS §§18, 27-29; DC §§4.10-4.11, 13-14; RR "Croissant metadata" |
| Derived training and evaluation exports | Canonical data compiles deterministically to MLX-LM train/valid/test JSONL, TRL SFT/preference views, and LightEval-compatible data. Exports record source fingerprint, chat template, token estimates, truncation, and prefix-to-next-action transformation for intermediate tool calls. | High | Validated canonical release; tokenizer/template | **Partial** — MLX-LM JSONL emission exists, but it is a legacy canonical artifact rather than a fingerprinted derived view. | PS §19; DC §§4.3-4.6, 13; RR "MLX-LM" |

### Boundary 6: Runtime Tools, Worktrees, PersonalBench, and Model Adapters

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Fixed host-implemented repository tools | Stable JSON Schema tools provide tree, file, search, symbol, Git, diff, patch, allowlisted check, and finish operations with bounded/paginated output, path and symlink containment, and full observable traces. `run_check` accepts only inspected `check_id` values. | High | Foundation safety; repository snapshots | **Partial** — generated JavaScript tools have schema/AST/sandbox/fuzz gates, but the target fixed repository tool surface and inspected check registry are absent. | PS §20, §§26, 28.6; BS §4 |
| Disposable worktree execution harness | Every task starts at its recorded `base_sha`, applies changes only inside a disposable worktree, runs approved checks, captures patch/process/timing/resource data, and cleans worktrees and orphan processes after success, error, cancellation, or crash. | High | Mirrors; jobs; fixed tools | **Partial** — child-process cleanup exists, but no benchmark worktree lifecycle or repository check harness exists. | PS §§20-21, 29; BS §4 |
| MLX PersonalBench suites | RepoTaskBench, NavBench, StyleBench, GeneralizationBench, TemporalBench, and FutureBench cover execution, localization, preferences, whole-repository transfer, later history, and never-trained-on tasks. | High | Leakage-safe benchmark config; harness | **Missing** | PS §21; BS §§1-2, 8 |
| Controlled model comparison matrix | Minimum variants separate E2B/E4B base ability, E4B profile prompting, E2B/E4B tuning, and tuned E4B plus profile under identical task/tool/context/step/hardware policies. Cloud APIs see private tasks only after explicit sanitization and approval. | High | Model adapters; profile versions; harness | **Partial** — endpoint comparison exists, but not the required models, task controls, or privacy policy. | PS §21; BS §§1, 3 |
| Task-level scoring and paired statistics | Resolved/check/regression, localization, preference, safety, efficiency, token, latency, throughput, and memory outputs remain visible per task; bootstrap confidence intervals, paired deltas, McNemar, Bradley-Terry, effect sizes, counts, and error categories prevent unsupported aggregate claims. | High | Executed result manifests | **Missing** | BS §§5-7 |

### Boundary 7: Apple Silicon Training, Experiments, and Paired Evaluation

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Version-compatible MLX-LM preflight | The operator inspects installed `mlx_lm.lora --help`, model/chat-template/tool compatibility, disk and memory headroom, and records exact software/hardware versions rather than assuming remembered flags. | Med | Derived MLX-LM export; model acquisition policy | **Partial** — fixed scripts and local server startup exist, but target E2B/E4B preflight and version-recorded config generation are absent. | PS §22.2; RR "MLX-LM" and "Gemma 4" |
| E2B ablation and E4B principal training | E2B validates data mixes and tool format cheaply; E4B is the principal model. Runs use bounded profiles near an 18 GB budget, tracked config, dataset fingerprint, checkpoints, metrics, and limitations. | High | Validated dataset; preflight; experiment catalog | **Partial** — SFT/GRPO wrappers, metric parsing, supervisor, rollback, fuse, and adapter loading are reusable, but they consume the legacy corpus and lack target experiment lineage. | PS §§14, 22, 27-29; RR "Recommended size" |
| Real Apple Silicon smoke and recovery acceptance | On the M4 Pro, acceptance loads/generates with E2B, validates a tool call, preflights E4B, runs bounded E4B QLoRA, saves and resumes a checkpoint, loads the adapter, evaluates a paired subset, and records peak memory, tokens/s, time, and versions. Mocks may test code but cannot satisfy this gate. | High | Training runner; adapters; PersonalBench | **Partial** — smoke/training scripts exist, but no recorded proof of the complete target acceptance sequence is present. | PS §22.3, §§28.7, 29 |
| Paired base/profile/tuned evaluation and model cards | Signed experiment results connect base model, adapter, dataset fingerprint, profile version, benchmark version, hardware/software, statistics, and known limitations; tuning gain is not conflated with prompt conditioning. | High | PersonalBench; completed training; manifests | **Missing** | PS §§21-22, 27-29; BS §§3, 6-8 |

### Boundary 8: Studio, Presentation, Privacy Review, and End-to-End Acceptance

| Feature | Why Expected | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|--------------|------------|--------------|-------------------|---------------------|
| Loopback-only local API and Studio | A real local React application reads typed catalog/Parquet/result APIs and event streams; it binds loopback by default and works offline. | High | Foundation; domain query APIs; signed runs | **Missing** | PS §§6, 23, 26, 28.8 |
| Nine required operational views | GitHub DNA, Language Evolution, Evidence Funnel, Preference Fingerprint, Dataset Explorer, Benchmark Arena, Training, Live Trace, and Privacy expose drill-down provenance and component metrics instead of static marketing panels. | High | Metrics through training outputs | **Missing** | PS §23, §§28.8, 29 |
| Honest presentation and deterministic replay | A 16:9, keyboard-operable, redacted presentation mode replays a signed run manifest and labels every displayed metric `LIVE`, `REPLAY`, or `FIXTURE`; replay never impersonates a live build, benchmark, or training run. | High | Studio; run manifests; privacy policy | **Missing** | PS §§3.7, 23, 28.8, 29; BS §10 |
| Private-by-default export and egress gates | Repository visibility and per-repository export policy propagate into evidence and datasets. Secret/PII/license/policy scans, redaction, exact upload preview, checksums/signatures, explicit `--push`/`--publish`, and confirmation precede any Hub or provider egress. | High | Catalog policy; evidence/dataset provenance | **Missing** — local model calls are local by default, but the complete scanner, preview, publication, and provider policy gates do not exist. | PS §§4.2, 26-29; DC §12 |
| End-to-end synthetic and real acceptance | Known-history synthetic repositories cover merges, reverts, renames, aliases, binaries, generated files, tests, and temporal history; portable checks, real HF loading, leakage audit, executable benchmark, Studio, and capability-gated M4 tests culminate in an independent critical-issue audit. | High | All prior boundaries | **Missing** | PS §§28.8, 29 |

## Differentiators

These are not optional polish. They are the combinations that distinguish MLX from a generic metrics dashboard, dataset converter, or LoRA demo, and they depend on the table-stakes foundations above.

| Feature | Value Proposition | Complexity | Dependencies | Brownfield Status | Contract References |
|---------|-------------------|------------|--------------|-------------------|---------------------|
| Accepted-state learning rather than authorship policing | Learns from changes the operator accepted, retained, and verified, while keeping human/AI origin only for audit. This makes quality claims defensible without assuming AI-assisted code is inferior. | High | Evidence quality model | **Missing** | PS §§2, 3.5, 11; DC §9 |
| Evidence-backed preference graph with uncertainty | Converts repeated engineering decisions into scoped, challengeable claims with support, counter-evidence, exceptions, and shrinkage instead of a plausible but unsupported style paragraph. | High | Evidence lake; multiple repositories | **Missing** | PS §§3.4, 17; BS §2.3 |
| Dataset remains the product when training fails | Metrics, evidence, preference profiles, HF configs, and benchmark tasks retain standalone value; adapters are derived consumers and can be regenerated from an immutable release. | High | Canonical dataset contract | **Missing** | PS §§1, 3.1, 18-19; DC §1; RR "Hugging Face Datasets" |
| Personal transfer measured without memorization | Whole-repository, temporal, and future holdouts plus contamination audits test whether behavior transfers to unseen code and later work rather than rewarding source recall. | High | Split contract; PersonalBench | **Missing** | PS §§3.6, 16, 21; BS §§2.4-2.6, 7 |
| Prompt gain separated from tuning gain | Base, base+profile, tuned, and tuned+profile variants quantify what comes from explicit evidence-based context versus learned adapter behavior. | High | Profile card; benchmark matrix; training | **Missing** | PS §§17, 21; BS §3 |
| Repository-native learning tasks and navigation supervision | Git history supplies grounded pre-state/task/accepted-result examples, while NavBench and selective context explicitly train and measure finding the right files, symbols, and checks. | High | Evidence reconstruction; fixed tools | **Missing** | PS §§13, 20-21; DC §§6-8; RR "Code history as data" and "Selective context" |
| Auditable lineage from repository snapshot to result | Snapshot, identity, object, task group, schema, generator, privacy, split, dataset, export, model, profile, benchmark, and hardware fingerprints make every visible claim reproducible. | High | All manifests and typed boundaries | **Missing** | PS §§10, 27, 29; DC §§2, 14; BS §7 |
| Honest local presentation of private evidence | A polished offline Studio can show real private work without uploading it, and its explicit data-origin labels prevent replay or fixtures from overstating event progress. | High | Studio; privacy; run manifests | **Missing** | PS §§3.2, 3.7, 23, 26 |

## V2 / Deferred Items

Deferred means intentionally sequenced after the contract critical path or conditional on evidence. It does not include any of the eight acceptance boundaries.

| Feature | Why Defer | Revisit When | Complexity | References |
|---------|-----------|--------------|------------|------------|
| Expand toward 100,000 examples | Row count is not success; expansion is justified only if deduplicated held-out scaling curves continue improving beyond the 25k-50k core range. | 1k/5k/10k/25k/50k ablations show statistically useful gains. | High | PS §14; RR "Recommended size" |
| Large-scale DataTrove blocks | MLX-owned schemas, provenance, filters, and splits must work first; DataTrove is useful only when corpus size makes reusable distributed statistics/dedup blocks worthwhile. | Canonical compiler is stable and local throughput is a demonstrated bottleneck. | Med | PS §15; RR "Data processing" |
| Additional local or API model adapters | The minimum E2B/E4B matrix already isolates prompting and tuning. Extra models multiply adapter, policy, and reproducibility work. | Core PersonalBench is stable; private-task egress policy is enforced. | Med | PS §21; BS §3 |
| Broader public coding sanity suites | PersonalBench is primary. Full SWE-bench is operationally heavy and not required for the event; a small licensed compatibility suite can later detect catastrophic general degradation. | Native worktree harness and paired personal results are reliable. | High | BS §9 |
| Scaled verified synthetic regression generation | Synthetic tasks can broaden executable coverage, but must not displace accepted-state evidence or introduce unverified/future-state leakage. | Real evidence extraction, task grouping, and fail-before/pass-after validation are mature. | High | PS §§13, 16, 21; BS §§2.1, 4 |
| Public dataset publication beyond `public_demo` | Private/local and private-Hub modes are sufficient for core value. Broad publication requires source-by-source rights, PII, path/name, license, and sample approval. | Export policy proves every published object is redistributable and operator-approved. | High | PS §§4.2, 18, 26; DC §§4.8, 12 |

## Anti-Features

Features and shortcuts to explicitly not build or preserve as target behavior.

| Anti-Feature | Why Avoid | What to Do Instead | Contract References |
|--------------|-----------|-------------------|---------------------|
| Train-first or adapter-first product flow | A working LoRA can hide incorrect provenance, privacy, splits, and evaluation. Training directly from repositories makes releases irreproducible. | Build evidence and a versioned canonical dataset first; train only from fingerprinted exports. | PS §§1, 3.1, 18-19; DC §1 |
| Silent enumeration, cloning, or training on all accessible repositories | Access is not authorization; this expands privacy, license, cost, and contamination exposure. | Inventory with pagination, require explicit repository mode and export policy, and use selected mirrors only. | PS §§3.2, 8.1, 26; DC §12 |
| Implicit upload, cloud judging, or public release | Private source, metrics, traces, datasets, or adapters can leave the machine without informed review. | Local-private defaults, scanners, exact egress preview, explicit action, confirmation, and provider policy. | PS §§4.2, 26; DC §12 |
| Random row splitting or sibling variants across splits | Near-identical examples and shared source tasks inflate benchmark results and obscure memorization. | Assign deterministic repository/task/time groups before expanding variants and block release on leakage. | PS §§3.6, 16; DC §11 |
| Current SLOC presented as personal authorship or productivity | Current files include collaborators, generated/vendor code, deletion work, and surviving history; a single count is misleading. | Show separately defined current code, churn, commits, collaboration, and surviving attributed lines with exclusions and timestamps. | PS §9; RR "GitHub metrics" |
| Unsupported global style summaries | Formatting or one repository convention can be mistaken for a universal preference, erasing exceptions and uncertainty. | Use hierarchical claims with independent support, counter-evidence, confidence, and repository-local constraints. | PS §§3.4, 17 |
| Penalizing AI-assisted code by default | Origin is not a reliable quality coefficient once a change is accepted, survives, and passes verification. | Store origin for audit; score accepted state, survival, checks, semantic value, and uniqueness. | PS §§2, 3.5, 11 |
| Hidden chain-of-thought or unsanitized raw trace collection | Reasoning traces can expose private code, credentials, and unverifiable internal text. | Retain observable messages, concise plans, fixed tool calls/results, scores, and provenance only after privacy policy. | PS §§5, 12, 26; DC §§6.3, 12 |
| Arbitrary model-generated shell execution | It enables command injection, traversal, destructive writes, and non-reproducible checks. | Expose fixed host tools and an inspected `check_id` registry inside disposable worktrees. | PS §§5, 20, 26; BS §4 |
| Dynamic generated JavaScript tools as the target coding runtime | Legacy generated tools solve a different demo and complicate audit, portability, and deny-by-default execution. | Preserve validation ideas where useful, but implement the fixed repository tool contract. | PS §§5, 20; CB "Discovery Tool Validation Flow" |
| Fixtures, mocks, or replay reported as live | This creates false metrics and false completion claims, especially under event pressure. | Label every metric `LIVE`, `REPLAY`, or `FIXTURE`; require real HF, benchmark, and M4 evidence for their gates. | PS §§3.7, 22.3, 23, 29 |
| Full-repository prompt dumps | Irrelevant context wastes tokens, may harm retrieval, and increases private-data exposure. | Record candidate context, select minimal pre-state files/symbols, bound tool results, and measure retrieval quality. | DC §§7-8; RR "Selective context" |
| Fabricated rejected answers or arbitrary hunk splitting | Fake negatives and incoherent micro-tasks teach unsupported preferences and break causal task meaning. | Use real revisions/failures/reverts or independently verified candidates; decompose only with dependency evidence. | PS §15; DC §6.5 |
| Mutable dataset versions or ad hoc production schemas | In-place changes destroy reproducibility and can invalidate model/benchmark lineage. | Persist migrations; publish immutable schema/dataset versions with manifests and checksums. | PS §§7, 27; DC §2 |
| Plain JSONL as the canonical evidence lake | JSONL training files cannot carry the required analytical schemas, object references, release configs, and lineage as the source of truth. | Use SQLite for operations, CAS for blobs, Parquet/Arrow for canonical analytics, and JSONL only as a derived export. | PS §§7, 18-19; DC §1 |
| iPhone deployment, Supabase discovery, or stale branding as an acceptance path | These legacy surfaces do not satisfy the dataset-first product and consume effort without closing an acceptance boundary. | Keep only reusable implementation patterns; prioritize `mlx`, GitHub evidence, HF data, PersonalBench, training, and Studio. | PS §5 |
| Giant root modules or UI-owned orchestration | Duplicated stage logic and hidden artifact coupling make recovery, testing, and migration unsafe. | Use explicit typed package boundaries and shared non-UI orchestration. | PS §6; CB "Anti-Patterns" |

## Feature Dependencies

```text
Boundary 1 identity + migration baseline
  -> Boundary 2 typed paths + SQLite + CAS + jobs
  -> Boundary 3 explicit inventory + mirrors + identities
  -> Boundary 3 deterministic metrics
  -> Boundary 4 immutable evidence + quality tiers
  -> Boundary 4 hierarchical preferences
  -> Boundary 5 canonical HF dataset + splits + release validation
  -> Boundary 6 fixed tools + worktrees + PersonalBench
  -> Boundary 7 E2B/E4B training + paired evaluation
  -> Boundary 8 Studio + privacy review + end-to-end acceptance

Repository selection + export policy -> every mirror, evidence row, dataset row, trace, and publication decision
Mirrors + identities -> metrics and accepted-state evidence
CAS + evidence schema -> deterministic quality, preferences, and dataset examples
Task-group IDs -> dedup decisions, split manifest, benchmark isolation, and future append
Fixed tools + allowlisted checks -> tool trajectories, executable quality tiers, and RepoTaskBench
Validated HF release -> MLX-LM/TRL/LightEval exports -> training experiments
Profile version + PersonalBench -> base vs base+profile -> tuned vs tuned+profile attribution
Immutable events/manifests across all stages -> Studio live views and signed replay
Privacy/leakage gates -> dataset release, provider egress, benchmark publication, and presentation
```

## MVP Recommendation

Do not collapse this project into a conventional "MVP plus polish" roadmap. The project contract requires eight independently verifiable boundaries, in this order:

1. **Identity, cleanup, baseline, and migration map** — make `mlx` and its validation surface safe before extending the legacy pipeline.
2. **Foundation** — establish contained state, migrations, CAS, immutable runs, and durable jobs so later data is reproducible.
3. **Repository ingestion and metrics** — prove explicit selection, mirror recovery, identity coverage, and exact fixture-backed metrics.
4. **Evidence and preferences** — make accepted-state records and challengeable preference claims the semantic source of truth.
5. **Dataset and Hugging Face release** — compile, deduplicate, split, privacy-check, load, and fingerprint the canonical product.
6. **Runtime and PersonalBench** — execute held-out tasks with fixed tools and paired task-level statistics.
7. **Training and paired evaluation** — run E2B ablations and real E4B smoke from validated exports, then attribute prompt and tuning gains.
8. **Studio and final acceptance** — present every required view with honest provenance labels and complete the independent audit.

Parallel work is reasonable inside a boundary, but later acceptance must not substitute for an earlier one. In particular, an existing CLI, JSONL generator, training script, replay, or model adapter does not close the dataset contract.

## Event Success Floor — Not Project Completion

The July 16, 2026 presentation floor is a narrower, honest delivery target. Meeting it does not waive or complete the eight acceptance boundaries above.

| Event-Floor Capability | Required Evidence | References |
|------------------------|------------------|------------|
| Real metrics | A small explicitly selected repository set with real, correctly defined metrics. | PS §30 |
| Real preference profile | Evidence-linked claims with visible support, confidence, counter-evidence, and exceptions. | PS §§17, 30 |
| Presentation dataset | 500-2,000 validated Hugging Face-ready examples in a private/local dataset that actually loads through `datasets`. | PS §30; DC §§4.10, 13 |
| Held-out benchmark | 20-50 tasks spanning at least two repositories, or one whole-repository holdout plus temporal tasks. | PS §30; BS §10 |
| Paired comparison | E4B base versus E4B base+profile with sample-level results, visible checks, and confidence intervals. | PS §30; BS §§6, 10 |
| Live execution with fallback | One genuine live task execution plus deterministic replay fallback. | BS §10 |
| Optional tuning result | Tuned E2B or E4B may be shown only if a real validated adapter exists; it is not required for the event floor. | PS §30; BS §10 |
| Honest Studio replay | Polished 16:9 replay with private names/secrets redacted and every metric visibly labeled `LIVE`, `REPLAY`, or `FIXTURE`. | PS §§23, 30 |

Do not claim a 25k-50k core dataset, final E4B adapter, full benchmark conclusion, or complete project unless the corresponding artifacts and acceptance gates have actually passed.

## Sources

### Authoritative Product Contracts

- [MLX Project and Acceptance Specification](../../docs/MLX_PROJECT_SPEC.md) — primary feature, acceptance-boundary, safety, and event-floor contract. **Confidence: HIGH**
- [MLX Hugging Face Dataset Contract](../../docs/MLX_DATASET_CONTRACT.md) — canonical schema, config, quality, split, validation, privacy, and release contract. **Confidence: HIGH**
- [MLX PersonalBench Specification](../../docs/MLX_BENCHMARK_SPEC.md) — benchmark suites, harness, scoring, statistics, integrity, and event benchmark contract. **Confidence: HIGH**
- [MLX Research Rationale](../../docs/MLX_RESEARCH_RATIONALE.md) — reviewed rationale and primary-source index for dataset, training, retrieval, metrics, and benchmark choices. **Confidence: HIGH for project decisions**

### Current Official Documentation Checks

- [Hugging Face Datasets loading documentation](https://github.com/huggingface/datasets/blob/main/docs/source/loading.mdx) — direct Parquet loading and explicit feature support.
- [Hugging Face dataset configuration documentation](https://github.com/huggingface/datasets/blob/main/docs/source/load_hub.mdx) — named configuration loading.
- [Hugging Face Hub dataset upload guide](https://github.com/huggingface/hub-docs/blob/main/docs/hub/datasets-upload-guide-llm.md) — multi-config Parquet layout and Viewer metadata.
- [Hugging Face dataset cards](https://github.com/huggingface/hub-docs/blob/main/docs/hub/datasets-cards.md) — README YAML metadata.
- [MLX-LM LoRA documentation v0.31.0](https://github.com/ml-explore/mlx-lm/blob/v0.31.0/mlx_lm/LORA.md) — local/Hugging Face data inputs and LoRA workflow.
- [MLX-LM LoRA configuration](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/examples/lora_config.yaml) — current training and memory-control configuration surface.

The current documentation checks were routed through the GSD research-plan seam and Context7. The seam classified Context7 confidence as **MEDIUM**, so installed package versions and CLI `--help` remain the final implementation authority, as required by PS §22.2 and RR.

### Brownfield Status Source

- [Codebase Architecture Map](../codebase/ARCHITECTURE.md) — current CLI, discovery, JSONL, evaluation, training, subprocess, and iOS implementation inventory. **Confidence: HIGH for mapped repository state; not a product contract**

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Required features and anti-features | HIGH | Directly specified by the four authoritative local contracts. |
| Eight-boundary ordering | HIGH | Mandated verbatim by PS §28 and reinforced by dependency analysis. |
| Event success floor | HIGH | Explicit in PS §30 and BS §10; kept separate from project completion. |
| Brownfield status | HIGH | Cross-checked against the current architecture map, file inventory, package scripts, and targeted repository search. |
| Hugging Face/MLX-LM ecosystem compatibility | MEDIUM | Current official docs were retrieved through Context7; exact installed versions and CLI signatures still require phase implementation checks. |

## Research Gaps

- Exact GitHub GraphQL/REST pagination, permission, rate-limit, and PR/review field choices need implementation-phase validation against the authenticated GitHub CLI and current official API schemas.
- Exact pinned versions for `datasets`, `pyarrow`, `polars`, `duckdb`, `huggingface_hub`, MLX-LM, and Gemma artifacts must follow environment and Apple Silicon compatibility tests rather than this feature document.
- Quality thresholds, repository weights, shrinkage priors, dataset mixes, and the presentation composite are initial policies that require sensitivity analysis and paired benchmark evidence.
- Public sanity benchmark candidates require a later license and runner-compatibility review; PersonalBench remains primary.
