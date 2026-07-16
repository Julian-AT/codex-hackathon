# Requirements: MLX

**Defined:** 2026-07-15
**Core Value:** Produce a privacy-preserving, provenance-rich personal coding dataset whose quality, splits, and benchmark results are reproducible and defensible.

## v1 Requirements

### Identity, Baseline, and Migration

- [x] **IDEN-01**: Operator-facing product text identifies the product on first mention as "MLX — the personal coding dataset and model pipeline" and contains no legacy Forgeprint, forgeprint, or codex product branding
- [x] **IDEN-02**: Operator can invoke the product through the sole intended executable name `mlx`
- [x] **IDEN-03**: Operator can use `MLX_HOME` to override a default local state root of `~/.mlx`
- [x] **IDEN-04**: Operator can run `mlx doctor` to detect an unrelated existing `mlx` executable without MLX overwriting or shadowing it automatically
- [x] **IDEN-05**: Operator can access the complete documented command surface for initialization, auth, repositories, mirrors, metrics, evidence, preferences, datasets, benchmarks, training, models, agents, Studio, pipeline execution, and garbage collection
- [x] **IDEN-06**: Operator and automation can request deterministic `--json` output from practical CLI commands while human-readable output remains available
- [x] **IDEN-07**: Maintainer can inspect a migration inventory that classifies every legacy command, artifact path, generated dataset, script, product string, dynamic-tool path, and iOS component before destructive cleanup
- [x] **IDEN-08**: A legacy component can be removed only after its replacement owner and acceptance coverage are recorded
- [x] **IDEN-09**: Automation can run stable `check`, `typecheck`, unit, integration, Studio build, dataset validation, benchmark smoke, and local capability-check commands through the repository scripts
- [x] **IDEN-10**: Validation reports distinguish passed, failed, and capability-gated skipped checks without describing a skip, replay, fixture, or mock as a pass or live result

### Foundation, Storage, Runs, and Jobs

- [ ] **FNDN-01**: Operator configuration is validated through typed schemas at package boundaries and invalid production configuration fails with an actionable diagnostic
- [ ] **FNDN-02**: Every mutable artifact path resolves beneath the configured `MLX_HOME` root and traversal, symlink escape, and unsafe archive paths fail closed
- [ ] **FNDN-03**: Operational state is stored in SQLite through persisted numbered migrations with WAL mode and foreign keys enabled
- [ ] **FNDN-04**: Operator can initialize a fresh catalog and upgrade every supported prior schema without ad hoc mutation or data loss
- [ ] **FNDN-05**: `mlx doctor` reports the embedded SQLite version and enforces a single catalog-owner gate until the runtime is proven free of the relevant WAL-reset race
- [ ] **FNDN-06**: Immutable source, patch, trace, report, and generated blobs are stored by SHA-256 digest with atomic writes, integrity verification, and references from catalog or analytical records
- [ ] **FNDN-07**: Every run records an immutable manifest containing input/configuration hashes, implementation versions, parent/child lineage, outputs, and checksums
- [ ] **FNDN-08**: Repeating a long-running stage with identical deterministic inputs reuses completed valid work instead of repeating expensive side effects
- [ ] **FNDN-09**: Long-running work is represented by durable leased jobs with fencing, heartbeats, bounded retries, checkpoints, cancellation, and stale-lease recovery
- [ ] **FNDN-10**: Operator can resume a terminated job without duplicating committed outputs and can inspect structured status, progress, attempts, and failure events
- [ ] **FNDN-11**: Process supervision terminates and records child processes after success, failure, timeout, cancellation, or crash without leaving orphan work
- [ ] **FNDN-12**: Operator can inspect disk usage and run retention or `mlx gc` without deleting any object still referenced by a catalog row or immutable manifest

### Repositories, Identities, and Metrics

- [ ] **REPO-01**: Operator can inspect GitHub authentication status and required scopes without exposing tokens in output or logs
- [ ] **REPO-02**: Operator can discover owned, private, organization, collaborator, archived, and fork repositories through complete paginated GitHub responses
- [ ] **REPO-03**: Discovered repositories remain `pending-review` until the operator explicitly assigns `included`, `excluded`, `holdout`, or `metrics-only`
- [ ] **REPO-04**: Repository access alone never causes MLX to clone, extract, train on, benchmark against, or publish that repository
- [ ] **REPO-05**: Operator can assign a separate export policy of `local-only`, `private-hub`, `metadata-only`, `public-samples-approved`, or `excluded` to each repository
- [ ] **REPO-06**: Selected repositories are maintained as resumable bare mirrors with pruned incremental updates and observable interruption recovery
- [ ] **REPO-07**: Every ingestion run pins immutable repository snapshot identifiers and never writes repository content into the application source tree
- [ ] **REPO-08**: Operator can normalize multiple author and committer identities, GitHub noreply addresses, `.mailmap`, co-authors, and manual aliases without guessed matches
- [ ] **REPO-09**: Metrics report identity coverage and unmatched contributors for the measured population
- [ ] **REPO-10**: Operator can inspect repository, ownership, visibility, activity, age, language, size, archive, and fork metrics with their exact source methods
- [ ] **REPO-11**: Operator can inspect authored, non-merge, merge, co-authored, temporal, patch-size, file-change, addition, deletion, net-change, and churn metrics using documented deterministic definitions
- [ ] **REPO-12**: Binary `numstat` rows are reported but excluded from addition, deletion, net-change, and churn arithmetic
- [ ] **REPO-13**: Operator can inspect current code, comment, blank, language, complexity, test, documentation, configuration, generated-code, hotspot, and large-file metrics after deterministic exclusions
- [ ] **REPO-14**: Blame-derived current ownership is labeled "surviving attributed lines" and is never presented as all code ever written
- [ ] **REPO-15**: Operator can inspect pull request, review, issue, merge-strategy, lifetime, revert, and follow-up-fix metrics when the selected GitHub scope provides them
- [ ] **REPO-16**: Operator can inspect engineering-pattern and language/framework evolution metrics derived from versioned deterministic extractors
- [ ] **REPO-17**: Every presented metric includes its population, exclusions, timestamp, repository snapshot, source classification, and `LIVE`, `REPLAY`, or `FIXTURE` label
- [ ] **REPO-18**: Synthetic repository fixtures deterministically exercise merges, reverts, renames, aliases, binaries, generated files, tests, and temporal history without accessing private repositories

### Evidence, Quality, and Preferences

- [ ] **EVID-01**: Every evidence record has a stable ID, schema version, snapshot, pseudonymous repository ID, source visibility, source kind, source references, SHAs, timestamp, paths, languages, object hashes, classifiers, validation, privacy result, generator lineage, and `task_group_id`
- [ ] **EVID-02**: Raw source, patch, and trace bytes live in the content-addressed store rather than being duplicated in mutable catalog rows
- [ ] **EVID-03**: All variants derived from one commit, pull request, issue, review chain, or synthetic regression share one stable `task_group_id`
- [ ] **EVID-04**: Deterministic extraction is reproducible for the same repository snapshot, extractor version, and configuration
- [ ] **EVID-05**: Evidence stores separate accepted-state, survival, verification, semantic-value, instruction-quality, context-sufficiency, uniqueness, recency, repository-weight, and privacy components
- [ ] **EVID-06**: Evidence is assigned an interpretable Q0-Q4 quality tier and privacy, schema, or leakage failure prevents training inclusion regardless of weighted score
- [ ] **EVID-07**: Human-authored and AI-assisted accepted code are evaluated by the same default quality policy while authorship origin may remain audit metadata
- [ ] **EVID-08**: Semantic workers for intent, context, preferences, trajectories, tests, leakage, execution, and curation emit schema-validated outputs with bounded retries and recorded prompt/model versions
- [ ] **EVID-09**: Semantic annotations are immutable sidecars and never silently rewrite deterministic source evidence
- [ ] **EVID-10**: Datasets retain observable messages, concise plans, tool calls, results, scores, and provenance without hidden chain-of-thought or private model reasoning
- [ ] **EVID-11**: Preference claims are scoped independently at global, language, framework, and repository-local levels
- [ ] **EVID-12**: Every preference claim includes stable ID, feature values, support count, independent-repository count, uncertainty, supporting evidence, counter-evidence, exceptions, and training implication
- [ ] **EVID-13**: Repository-local formatter or configuration rules are not promoted to global preferences without independent cross-repository evidence
- [ ] **EVID-14**: A profile snapshot produces both machine-readable `developer_profile.json` and concise prompt-ready `DEVELOPER_PROFILE.md`
- [ ] **EVID-15**: Preference artifacts used for training or prompting exclude evidence from whole-repository, temporal, and future benchmark holdouts according to the split policy

### Dataset Compiler, Splits, and Release

- [ ] **DATA-01**: Canonical examples cover historical edit reconstruction, navigation/context selection, observable tool trajectories, test/debug tasks, real preference pairs, and repository-grounded architecture/explanation tasks
- [ ] **DATA-02**: Historical and executable task prompts contain only grounded pre-change information and never expose target patches or future repository state
- [ ] **DATA-03**: Context construction records its candidate universe, selection method, selected paths or symbols, token counts, and discovered omissions while enforcing bounded context levels
- [ ] **DATA-04**: Every release records an immutable semantic `schema_version` and fingerprinted `dataset_version` over source snapshots, identities, extractors, filters, prompts, models, quality thresholds, deduplication, splits, and feature schemas
- [ ] **DATA-05**: The canonical release is Parquet/Arrow with explicit Hugging Face `Features` for `profile`, `evidence`, `sft`, `messages`, `preference`, `tools`, `benchmark`, and `public_demo`
- [ ] **DATA-06**: Split assignments are deterministic and finalized at repository and `task_group_id` boundaries before sibling examples or synthetic variants are expanded
- [ ] **DATA-07**: No `task_group_id` has rows in more than one split
- [ ] **DATA-08**: Whole-repository holdouts contribute no source content or derived preference evidence to training
- [ ] **DATA-09**: Temporal holdouts reserve later meaningful task groups per eligible repository and record the cutoff and assignment reason
- [ ] **DATA-10**: Future tasks created after the dataset snapshot can be appended as a never-trained-on split
- [ ] **DATA-11**: Default filters reject or downgrade generated, vendored, binary, lock, build, minified, format-only, privacy-failing, incoherently large, or context-insufficient examples with recorded reasons
- [ ] **DATA-12**: Exact object, normalized patch, and normalized instruction hashes are applied before near-duplicate MinHash and syntax-fingerprint candidates
- [ ] **DATA-13**: Deduplication emits representative decisions, cluster membership, thresholds, and cross-split similarity reports rather than deleting rows opaquely
- [ ] **DATA-14**: Leakage audit detects target text, future state, sibling split crossings, near duplicates, holdout references in preferences, and embedded evaluation solutions, and any critical finding blocks release
- [ ] **DATA-15**: Every generated dataset config and split loads through Hugging Face `datasets.load_dataset` without custom repository code
- [ ] **DATA-16**: Every release includes a dataset card with YAML metadata, schemas, manifest, checksums, statistics, quality report, dedup report, leakage report, split manifest, Croissant metadata, and known limitations
- [ ] **DATA-17**: Dataset Viewer compatibility is validated where repository privacy permits and failures remain visible rather than being silently ignored
- [ ] **DATA-18**: Canonical data compiles deterministically into MLX-LM train/valid/test JSONL, TRL SFT/preference views, and LightEval-compatible exports with the source fingerprint recorded
- [ ] **DATA-19**: Long tool trajectories compile into prefix-to-next-assistant-action examples so intermediate assistant tool calls receive supervised loss under completion masking
- [ ] **DATA-20**: Release statistics track total and target tokens, languages, repositories, quality tiers, task mix, balance caps, truncation, tokenizer, and chat template rather than treating row count as sufficient
- [ ] **DATA-21**: Secret, PII, visibility, rights, license, and export-policy scans pass before any release leaves local storage
- [ ] **DATA-22**: Operator sees the exact files, metadata, checksums, visibility, and destination before an explicit confirmed private Hub push or publish action can transfer data
- [ ] **DATA-23**: The `public_demo` config contains only pseudonymized aggregates and samples the operator explicitly approved, with no private names, code, patches, emails, revealing paths, or commit URLs
- [ ] **DATA-24**: Published dataset versions are immutable and reproducible from their recorded manifests and checksums

### Runtime and PersonalBench

- [ ] **BNCH-01**: Model-facing tools are limited to host-implemented `list_tree`, `read_file`, `search_code`, `read_symbol`, `git_show`, `git_diff`, `apply_patch`, `run_check`, and `finish` JSON Schema contracts
- [ ] **BNCH-02**: Tool outputs are bounded and paginated, paths are contained, symlink escapes fail closed, and every call and result is recorded as an observable trace
- [ ] **BNCH-03**: `run_check` accepts only an inspected allowlisted `check_id` and never arbitrary model-generated shell text
- [ ] **BNCH-04**: Every repository execution task starts from its recorded `base_sha` in a fresh disposable worktree and never mutates the operator's source checkout
- [ ] **BNCH-05**: Harness cleanup removes worktrees and orphan process groups after success, failure, timeout, cancellation, or crash and records cleanup status
- [ ] **BNCH-06**: RepoTaskBench executes implementation and repair tasks from repository, temporal, future, and verified synthetic sources and reports `resolved@1`
- [ ] **BNCH-07**: NavBench reports file and symbol recall, MRR, irrelevant reads, and context-token use
- [ ] **BNCH-08**: StyleBench evaluates repository-aligned patch preferences with pairwise accuracy, calibration, Bradley-Terry score, and sampled human agreement
- [ ] **BNCH-09**: GeneralizationBench, TemporalBench, and FutureBench preserve their whole-repository, later-history, and never-trained-on isolation guarantees
- [ ] **BNCH-10**: Compared model variants use identical tasks, tool schemas, context budgets, step budgets, checks, sampling policy, and hardware policy
- [ ] **BNCH-11**: The minimum comparison matrix separates E2B base, E4B base, E4B base plus profile, tuned E2B, tuned E4B, and tuned E4B plus profile when those adapters exist
- [ ] **BNCH-12**: Private tasks are never sent to a cloud model without explicit sanitization, egress-policy approval, and operator confirmation
- [ ] **BNCH-13**: Each task result records patch/check/regression, localization, preference, safety, latency, token, tool-call, throughput, memory, and error data where applicable
- [ ] **BNCH-14**: Reports include paired task deltas, bootstrap confidence intervals, McNemar results, Bradley-Terry estimates, effect sizes, task counts, and separate missing/error categories
- [ ] **BNCH-15**: A contamination audit verifies benchmark tasks, source snapshots, preference versions, prompts, tools, models, adapters, and training releases before results are publishable
- [ ] **BNCH-16**: Benchmark tasks and sample-level results are available as Parquet/Hugging Face artifacts, with compatible metrics exposed to LightEval while repository execution remains native

### Apple Silicon Training and Experiments

- [ ] **TRNG-01**: Operator can run a preflight that inspects installed MLX-LM help, model revision, tokenizer, chat template, tool format, disk, memory, and software/hardware versions before training
- [ ] **TRNG-02**: E2B is used for bounded smoke tests, tool-format checks, and data-scaling ablations before E4B principal experiments
- [ ] **TRNG-03**: E4B training profiles enforce a measured memory budget with safe, balanced, and aggressive sequence/layer/rank configurations rather than assuming one profile works
- [ ] **TRNG-04**: Training consumes only validated fingerprinted dataset exports and records exact configuration, commands, seeds, checkpoints, metrics, and source release
- [ ] **TRNG-05**: Operator can terminate and resume a training run from a saved checkpoint without losing experiment lineage
- [ ] **TRNG-06**: On the target Apple Silicon machine, acceptance proves E2B load/generation and a structured tool call with recorded versions and resource measurements
- [ ] **TRNG-07**: On the target Apple Silicon machine, acceptance proves E4B preflight, bounded QLoRA training, checkpoint save/resume, adapter inference, and paired benchmark-subset evaluation
- [ ] **TRNG-08**: Experiment manifests and model cards connect the base model, adapter, dataset fingerprint, profile version, benchmark version, hardware/software, results, and limitations
- [ ] **TRNG-09**: Paired reports distinguish base-model ability, developer-profile prompting gain, fine-tuning gain, and combined gain without claiming improvement from unavailable or failed variants
- [ ] **TRNG-10**: Mock backends and non-Apple environments may test portable behavior but cannot satisfy or be reported as passing the Apple Silicon acceptance gate

### Studio, Privacy, and End-to-End Acceptance

- [ ] **STUD-01**: Operator can run a real local React Studio backed by typed catalog, Parquet, result, and event APIs bound to loopback by default
- [ ] **STUD-02**: Studio rejects unintended remote origins and remains usable offline with no implicit external asset or analytics dependency
- [ ] **STUD-03**: GitHub DNA shows repository, commit, churn, SLOC, language, and activity metrics with populations and provenance
- [ ] **STUD-04**: Language Evolution shows language and framework usage over time from a selected immutable snapshot
- [ ] **STUD-05**: Evidence Funnel shows selected repositories through evidence, quality tiers, filtering, deduplication, and final dataset rows
- [ ] **STUD-06**: Preference Fingerprint shows scoped claims, confidence, supporting evidence, counter-evidence, and exceptions
- [ ] **STUD-07**: Dataset Explorer shows configs, splits, examples, tokens, languages, quality, provenance, manifests, and validation status
- [ ] **STUD-08**: Benchmark Arena shows paired sample-level results, checks, error categories, component metrics, deltas, and confidence intervals
- [ ] **STUD-09**: Training shows loss, validation, throughput, memory, checkpoints, model/dataset identity, and experiment status
- [ ] **STUD-10**: Live Trace shows only observable model messages, tool calls, tool results, checks, and final outcomes for the selected run
- [ ] **STUD-11**: Privacy shows repository/export policy, redaction, scan results, publication preview, and egress mode before any publication action
- [ ] **STUD-12**: Every displayed metric or artifact is bound to one immutable snapshot, release, run, and source label of `LIVE`, `REPLAY`, or `FIXTURE`
- [ ] **STUD-13**: Presentation mode is redacted, offline-capable, keyboard-operable, 16:9, and deterministically replayed from a signed run manifest
- [ ] **STUD-14**: Replay or fixture data cannot impersonate a live repository scan, dataset build, benchmark execution, or training run
- [ ] **STUD-15**: Synthetic end-to-end acceptance covers repository selection, mirrors, metrics, evidence, preferences, dataset validation, worktree benchmark, Studio, privacy gates, recovery, and failure paths
- [ ] **STUD-16**: Full completion requires all portable checks, a real Hugging Face dataset build, a passing leakage audit, an executable benchmark, the local Studio, required Apple Silicon evidence, and no unresolved critical issue in an independent final audit
- [ ] **STUD-17**: Event-floor evidence is tracked separately from full completion and never implies a 25k-50k core dataset, final E4B adapter, or complete acceptance when those results do not exist

## v2 Requirements

### Scale and Optional Integrations

- **SCAL-01**: Operator can expand a release toward 100,000 examples only when held-out scaling curves justify the additional data
- **SCAL-02**: Operator can run DataTrove as an isolated optional worker through versioned Parquet and checksummed manifests when corpus-scale statistics or deduplication justify it
- **SCAL-03**: Operator can compare additional local or public benchmark models after the native PersonalBench matrix and egress policy are stable
- **SCAL-04**: Operator can generate large-scale synthetic repository tasks after real-evidence grouping, validation, and split integrity are mature
- **SCAL-05**: Operator can publish broader public datasets only after explicit rights review and sample-level approval
- **SCAL-06**: Operator can deploy an optional iOS runtime after all dataset-first acceptance boundaries are satisfied

## Out of Scope

| Feature | Reason |
|---------|--------|
| Random row splitting for primary evaluation | It leaks sibling tasks and cannot prove repository or temporal generalization |
| Implicit enumeration, cloning, training, or publishing of every accessible private repository | Repository access is not authorization and private data is local by default |
| Repository-to-trainer or repository-to-Studio shortcuts | Every consumer must use the versioned evidence, release, and manifest contracts |
| Hidden chain-of-thought collection | Only observable messages, concise plans, calls, outputs, scores, and provenance may be retained |
| Arbitrary model-generated shell execution | Checks are selected only from an inspected host allowlist |
| Authorship-origin quality penalties | Accepted human and AI-assisted code use the same default evidence-quality policy |
| Row count, current line count, formatting imitation, or adapter existence as the sole success measure | Quality, provenance, validated target tokens, leakage-safe evaluation, and executable evidence are primary |
| Legacy Supabase discovery and generated JavaScript tools as production MLX architecture | They are migration inputs or fixtures, not the target repository tool contract |
| iPhone deployment in the initial acceptance roadmap | The authoritative product explicitly does not require the earlier device path |
| Fixture, replay, or mock output presented as live | Honest source labeling is a hard product requirement |

## Traceability

Every v1 requirement maps to exactly one roadmap phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDEN-01 | Phase 1 | Complete |
| IDEN-02 | Phase 1 | Complete |
| IDEN-03 | Phase 1 | Complete |
| IDEN-04 | Phase 1 | Complete |
| IDEN-05 | Phase 1 | Complete |
| IDEN-06 | Phase 1 | Complete |
| IDEN-07 | Phase 1 | Complete |
| IDEN-08 | Phase 1 | Complete |
| IDEN-09 | Phase 1 | Complete |
| IDEN-10 | Phase 1 | Complete |
| FNDN-01 | Phase 2 | Pending |
| FNDN-02 | Phase 2 | Pending |
| FNDN-03 | Phase 2 | Pending |
| FNDN-04 | Phase 2 | Pending |
| FNDN-05 | Phase 2 | Pending |
| FNDN-06 | Phase 2 | Pending |
| FNDN-07 | Phase 2 | Pending |
| FNDN-08 | Phase 2 | Pending |
| FNDN-09 | Phase 2 | Pending |
| FNDN-10 | Phase 2 | Pending |
| FNDN-11 | Phase 2 | Pending |
| FNDN-12 | Phase 2 | Pending |
| REPO-01 | Phase 3 | Pending |
| REPO-02 | Phase 3 | Pending |
| REPO-03 | Phase 3 | Pending |
| REPO-04 | Phase 3 | Pending |
| REPO-05 | Phase 3 | Pending |
| REPO-06 | Phase 3 | Pending |
| REPO-07 | Phase 3 | Pending |
| REPO-08 | Phase 3 | Pending |
| REPO-09 | Phase 3 | Pending |
| REPO-10 | Phase 3 | Pending |
| REPO-11 | Phase 3 | Pending |
| REPO-12 | Phase 3 | Pending |
| REPO-13 | Phase 3 | Pending |
| REPO-14 | Phase 3 | Pending |
| REPO-15 | Phase 3 | Pending |
| REPO-16 | Phase 3 | Pending |
| REPO-17 | Phase 3 | Pending |
| REPO-18 | Phase 3 | Pending |
| EVID-01 | Phase 4 | Pending |
| EVID-02 | Phase 4 | Pending |
| EVID-03 | Phase 4 | Pending |
| EVID-04 | Phase 4 | Pending |
| EVID-05 | Phase 4 | Pending |
| EVID-06 | Phase 4 | Pending |
| EVID-07 | Phase 4 | Pending |
| EVID-08 | Phase 4 | Pending |
| EVID-09 | Phase 4 | Pending |
| EVID-10 | Phase 4 | Pending |
| EVID-11 | Phase 4 | Pending |
| EVID-12 | Phase 4 | Pending |
| EVID-13 | Phase 4 | Pending |
| EVID-14 | Phase 4 | Pending |
| EVID-15 | Phase 4 | Pending |
| DATA-01 | Phase 5 | Pending |
| DATA-02 | Phase 5 | Pending |
| DATA-03 | Phase 5 | Pending |
| DATA-04 | Phase 5 | Pending |
| DATA-05 | Phase 5 | Pending |
| DATA-06 | Phase 5 | Pending |
| DATA-07 | Phase 5 | Pending |
| DATA-08 | Phase 5 | Pending |
| DATA-09 | Phase 5 | Pending |
| DATA-10 | Phase 5 | Pending |
| DATA-11 | Phase 5 | Pending |
| DATA-12 | Phase 5 | Pending |
| DATA-13 | Phase 5 | Pending |
| DATA-14 | Phase 5 | Pending |
| DATA-15 | Phase 5 | Pending |
| DATA-16 | Phase 5 | Pending |
| DATA-17 | Phase 5 | Pending |
| DATA-18 | Phase 5 | Pending |
| DATA-19 | Phase 5 | Pending |
| DATA-20 | Phase 5 | Pending |
| DATA-21 | Phase 5 | Pending |
| DATA-22 | Phase 5 | Pending |
| DATA-23 | Phase 5 | Pending |
| DATA-24 | Phase 5 | Pending |
| BNCH-01 | Phase 6 | Pending |
| BNCH-02 | Phase 6 | Pending |
| BNCH-03 | Phase 6 | Pending |
| BNCH-04 | Phase 6 | Pending |
| BNCH-05 | Phase 6 | Pending |
| BNCH-06 | Phase 6 | Pending |
| BNCH-07 | Phase 6 | Pending |
| BNCH-08 | Phase 6 | Pending |
| BNCH-09 | Phase 6 | Pending |
| BNCH-10 | Phase 6 | Pending |
| BNCH-11 | Phase 6 | Pending |
| BNCH-12 | Phase 6 | Pending |
| BNCH-13 | Phase 6 | Pending |
| BNCH-14 | Phase 6 | Pending |
| BNCH-15 | Phase 6 | Pending |
| BNCH-16 | Phase 6 | Pending |
| TRNG-01 | Phase 7 | Pending |
| TRNG-02 | Phase 7 | Pending |
| TRNG-03 | Phase 7 | Pending |
| TRNG-04 | Phase 7 | Pending |
| TRNG-05 | Phase 7 | Pending |
| TRNG-06 | Phase 7 | Pending |
| TRNG-07 | Phase 7 | Pending |
| TRNG-08 | Phase 7 | Pending |
| TRNG-09 | Phase 7 | Pending |
| TRNG-10 | Phase 7 | Pending |
| STUD-01 | Phase 8 | Pending |
| STUD-02 | Phase 8 | Pending |
| STUD-03 | Phase 8 | Pending |
| STUD-04 | Phase 8 | Pending |
| STUD-05 | Phase 8 | Pending |
| STUD-06 | Phase 8 | Pending |
| STUD-07 | Phase 8 | Pending |
| STUD-08 | Phase 8 | Pending |
| STUD-09 | Phase 8 | Pending |
| STUD-10 | Phase 8 | Pending |
| STUD-11 | Phase 8 | Pending |
| STUD-12 | Phase 8 | Pending |
| STUD-13 | Phase 8 | Pending |
| STUD-14 | Phase 8 | Pending |
| STUD-15 | Phase 8 | Pending |
| STUD-16 | Phase 8 | Pending |
| STUD-17 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 122 total
- Mapped to phases: 122
- Unmapped: 0

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after roadmap creation*
