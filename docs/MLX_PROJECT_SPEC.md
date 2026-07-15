# MLX — Project and Acceptance Specification

**Status:** Authoritative product contract  
**Target machine:** Apple M4 Pro, 24 GB unified memory  
**Primary event date:** July 16, 2026  
**Product:** MLX — the personal coding dataset and model pipeline  
**CLI:** `mlx`  
**Local state:** `~/.mlx` or `MLX_HOME`

---

## 1. Executive summary

MLX converts an explicitly selected set of GitHub repositories into a reproducible, privacy-preserving personal software-engineering corpus.

Its primary product is not a LoRA adapter. Its primary product is a **high-quality, Hugging Face-native dataset** that captures:

1. what the operator has built,
2. how their repositories evolved,
3. which engineering patterns they repeatedly accept,
4. how they navigate, modify, test, and review code,
5. and whether a small local model can learn those behaviors without memorizing held-out repositories.

MLX must produce five visible outcomes:

- an accurate GitHub engineering profile,
- a provenance-rich evidence lake,
- a hierarchical preference profile with supporting and counter-evidence,
- versioned Hugging Face dataset configurations and MLX-LM exports,
- and an executable benchmark comparing base, prompted, and tuned models.

A model-training run is downstream of dataset quality. The system must remain useful even when no model is trained.

---

## 2. Product thesis

> A developer’s code style is not only formatting. It is the sequence of accepted engineering decisions visible in repository history: what was changed, what survived, what was tested, what was refactored, what was reverted, what was reviewed, and what local conventions were followed.

MLX turns those decisions into measurable evidence and verified learning tasks.

The system does **not** attempt to distinguish “human good” from “AI bad.” AI-assisted code is valid evidence when it was accepted into the repository and remains part of an approved engineering state.

---

## 3. Product principles

### 3.1 Dataset first

The evidence lake and dataset compiler are the critical path. Training must consume a stable, versioned dataset contract instead of reaching directly into Git repositories.

### 3.2 Local first and private by default

Repository mirrors, source snapshots, patches, traces, metrics, datasets, model weights, and logs remain under `MLX_HOME` unless the operator explicitly exports or uploads them.

### 3.3 Deterministic where possible

Use Git, parsers, linters, test runners, hashes, schemas, and statistics for objective work. Use language models only for semantic transformations.

### 3.4 Provenance over plausibility

Every claim and training example must be traceable. Unsupported style summaries are not accepted.

### 3.5 Accepted state over authorship mythology

The default quality signal comes from accepted repository state, survival, verification, semantic value, and uniqueness—not whether a person or an AI typed the code.

### 3.6 Evaluation without leakage

No benchmark claim is meaningful unless source-task groups, future commits, sibling examples, and entire repository holdouts are isolated.

### 3.7 Honest presentation

Studio must distinguish `LIVE`, `REPLAY`, and `FIXTURE`. It must never imply that a full dataset build or training run happened live when it did not.

---

## 4. Target users and modes

### 4.1 Primary operator

A single developer with public, private, organization, and collaborator repositories, running the system on a Mac.

### 4.2 Modes

- `local-private`: full repository content and metrics remain local.
- `hub-private`: sanitized dataset is pushed to a private Hugging Face dataset repository.
- `public-demo`: only pseudonymized aggregates and explicitly approved samples are exported.
- `presentation`: redacted, 16:9 Studio mode with stable replay support.

---

## 5. Non-goals

- Do not train on every file merely because it exists.
- Do not treat current line count as the only measure of engineering activity.
- Do not use random row splitting as the primary evaluation strategy.
- Do not upload private repositories implicitly.
- Do not collect hidden model chain-of-thought.
- Do not execute arbitrary model-generated shell commands.
- Do not claim the tuned model is better without paired, held-out evidence.
- Do not optimize exclusively for reproducing whitespace or formatting.
- Do not require the iPhone deployment path from the earlier project.
- Do not keep Supabase-specific discovery, dynamic generated JavaScript tools, or stale product branding as active architecture.

---

## 6. Required repository architecture

A recommended workspace layout is:

```text
apps/
  cli/                    # `mlx` operator CLI
  studio/                 # local React presentation and analytics UI
  local-api/              # typed loopback API + SSE/event stream
packages/
  core/                   # configuration, paths, IDs, errors, events
  catalog/                # SQLite migrations, repositories, runs, jobs
  github/                 # gh/GraphQL/REST adapters and pagination
  git/                    # mirrors, worktrees, history, blame, diffs
  metrics/                # profile metrics and aggregation
  evidence/               # evidence records, extraction, quality components
  preferences/            # feature extraction and preference aggregation
  dataset/                # canonical schemas, filters, dedup, splits, manifests
  benchmark/              # task definitions, runners, graders, statistics
  runtime/                # fixed coding tools and model adapters
  training/               # MLX-LM config, subprocess, metrics, checkpoints
python/
  mlx_dataset/            # HF Dataset/Parquet compiler and validation package
schemas/                  # versioned JSON schemas
migrations/               # SQLite migration files
fixtures/
  git/                     # synthetic repositories with known histories
  github/                  # paginated API fixtures
  training/                # MLX output parser fixtures
  demo/                    # public, non-sensitive presentation data
docs/
  ...
scripts/
  bootstrap-macos.sh
  verify-macos.sh
```

Avoid monolithic package entry files. `index.ts` files may re-export public APIs but must not contain an entire subsystem.

---

## 7. Local storage architecture

```text
~/.mlx/
  config/
    config.json
    identities.json
    repository-selection.json
  catalog/
    mlx.sqlite
    migrations.lock
  mirrors/
    <host>/<owner>/<repo>.git
  worktrees/
    <run-id>/<task-id>/
  objects/
    sha256/<prefix>/<digest>
  parquet/
    evidence/
    metrics/
    examples/
    benchmark/
  runs/
    <run-id>/manifest.json
  datasets/
    <dataset-version>/
  models/
    <experiment-id>/
  cache/
    huggingface/
    embeddings/
  logs/
```

Requirements:

- Atomic writes and fsync for manifests that gate reproducibility.
- SQLite WAL mode and foreign keys.
- Content-addressed object integrity checks.
- Disk-usage reporting and retention commands.
- No repository content in the application Git repository.

---

## 8. GitHub and repository ingestion

### 8.1 Repository inventory

Use the authenticated GitHub CLI and paginated GraphQL/REST calls where appropriate.

Discover:

- repositories owned by the user,
- private repositories,
- organization repositories accessible to the user,
- collaborator repositories,
- archived repositories,
- forks,
- default branches,
- visibility,
- primary languages,
- permissions,
- pull requests, reviews, and issues when selected.

Inventory must not silently include every accessible repository. Persist an explicit selection state:

```text
included
excluded
holdout
metrics-only
pending-review
```

### 8.2 Mirrors

Use bare mirrors as the local source of truth:

```bash
git clone --mirror ...
git remote update --prune
```

Mirror operations must be resumable, observable, and safe after interruption.

### 8.3 Identity normalization

Support multiple author and committer names/emails, `.mailmap`, GitHub noreply addresses, and optional manual aliases.

Metrics must report identity coverage and unmatched contributors instead of guessing.

---

## 9. Personal engineering metrics

The profile must include exact definitions and source methods.

### 9.1 Repository metrics

- accessible repositories,
- selected repositories,
- owned vs organization vs collaborator,
- public/private/internal/archive/fork counts,
- repository age and active period,
- default branch and latest activity,
- repository size and current language composition.

### 9.2 Commit metrics

- authored commits,
- non-merge authored commits,
- merge commits,
- co-authored commits,
- commits by repository/language/year/month,
- active days,
- longest activity streak,
- time-of-day and day-of-week distribution,
- median and percentile patch size,
- files changed,
- additions, deletions, net change, and churn.

Definitions:

```text
net change = additions - deletions
code churn = additions + deletions
```

Binary `numstat` rows must be tracked but excluded from line arithmetic.

### 9.3 Current code metrics

Use `scc` or an equivalent deterministic counter to report:

- current source lines,
- code/comment/blank lines,
- language breakdown,
- complexity estimates,
- unique line estimates where supported,
- tests/docs/config/generated proportions,
- hotspots and large-file distribution.

Exclude dependencies, build artifacts, generated outputs, vendored code, minified files, and operator-defined patterns.

### 9.4 Surviving authored lines

Use `git blame --line-porcelain` on selected current default-branch files to estimate lines currently attributed to normalized identities.

Label this metric clearly as **surviving attributed lines**, not “all lines ever written.”

### 9.5 Collaboration metrics

Where GitHub metadata is available:

- opened and merged pull requests,
- reviews submitted,
- review comments,
- issues opened/closed,
- median PR lifetime,
- merge strategy distribution,
- reverts and follow-up fixes.

### 9.6 Engineering-pattern metrics

- test-to-production code ratio,
- configuration coverage,
- strict type-check adoption,
- linter/formatter usage,
- dependency-change frequency,
- module/function size distributions,
- exception/error handling patterns,
- documentation and comment density,
- language and framework evolution over time.

All displayed metrics must include their population, exclusions, and timestamp.

---

## 10. Evidence model

The canonical evidence record is immutable and schema-versioned.

Every record includes:

- `evidence_id`,
- `schema_version`,
- `snapshot_id`,
- repository pseudonymous ID and optionally encrypted/local display name,
- source visibility and permissions,
- source kind (`commit`, `pr`, `review`, `issue`, `file`, `config`, `trace`),
- source SHA/PR/review IDs,
- parent/base/head SHAs,
- timestamps,
- normalized identities,
- paths and languages,
- before/after blob hashes,
- patch object hash,
- source text object hashes,
- generated/vendor/binary/format-only classifiers,
- acceptance and survival signals,
- executable validation outcomes,
- semantic annotations,
- quality components,
- generator and prompt versions,
- privacy scan result,
- `task_group_id`.

Raw source content belongs in the content-addressed object store, not repeated in SQLite rows.

---

## 11. Accepted-state quality model

Authorship origin is metadata only. It has no default negative coefficient.

Store interpretable components rather than a single unexplained score:

- `accepted_state`: merged/default/release branch status,
- `survival`: persistence across subsequent history,
- `verification`: tier and pass status,
- `semantic_value`: feature/fix/refactor/test/review value,
- `instruction_quality`: clarity of issue/PR/derived instruction,
- `context_sufficiency`: whether the task is solvable from the provided pre-state,
- `uniqueness`: duplicate and near-duplicate penalty,
- `recency_relevance`: configurable, not absolute,
- `repository_weight`: explicit operator importance,
- `privacy_pass`: mandatory gate.

Default quality tiers:

```text
Q0 rejected       critical privacy/schema/leakage failure
Q1 metadata-only  useful for analytics, not training
Q2 trainable      patch applies and syntax/schema checks pass
Q3 verified       lint/typecheck/build or meaningful checks pass
Q4 executable     fail-to-pass or repository tests validate the task
```

The `core` training view should primarily use Q2–Q4, with preference toward Q3–Q4.

---

## 12. Semantic agent roles

LLM workers may perform:

- **Intent Reconstructor** — converts issue/PR/commit evidence into a clean task statement without leaking the target implementation.
- **Context Selector** — chooses a minimal sufficient pre-change file/symbol context.
- **Preference Miner** — proposes preference claims with support and counter-evidence.
- **Trajectory Solver** — solves a task from the base state using fixed tools without target diff access.
- **Test Synthesizer** — creates a regression check that fails before and passes after.
- **Leakage Critic** — detects target or future-state leakage.
- **Execution Critic** — checks patch, tests, unnecessary changes, and policy compliance.
- **Dataset Curator** — balances and filters after deterministic gates.

Requirements:

- Structured outputs validated by JSON Schema or equivalent typed schema.
- Prompt version and model ID recorded.
- Retry policies bounded and observable.
- Generated outputs never silently patch source evidence.
- No hidden chain-of-thought retained.

---

## 13. Required dataset families

The canonical dataset must support at least these families:

1. **Historical edit reconstruction**  
   Pre-change repository context plus a grounded task → accepted patch or final response.

2. **Repository navigation and context selection**  
   Task → relevant repositories/files/symbols/checks, including negative distractors.

3. **Tool-use trajectories**  
   Observable agent messages and fixed tool calls for reading, searching, patching, and checking.

4. **Test and debugging tasks**  
   Failure or regression evidence → fix, preferably fail-before/pass-after.

5. **Review and preference pairs**  
   Prompt plus accepted `chosen` result and rejected/reverted/failing `rejected` result.

6. **Architecture and explanation tasks**  
   Repository-grounded explanations of design, conventions, or change rationale.

See `MLX_DATASET_CONTRACT.md` for schemas and mixes.

---

## 14. Dataset size strategy

Do not select size by row count alone. Track total tokens, assistant/completion target tokens, language balance, repository balance, and verified task count.

Recommended targets:

```text
smoke       100–500 examples
presentation 500–2,000 examples
core        25,000–50,000 high-quality examples
full        up to 100,000 examples only if held-out curves keep improving
```

Recommended `core` token target:

```text
20–50 million total serialized tokens
10–25 million target/completion tokens
```

These are starting budgets, not mandatory padding targets. Prefer 20,000 strong examples over 100,000 repetitive examples.

Create data-scaling experiments at approximately:

```text
1k, 5k, 10k, 25k, 50k examples
```

Train E2B ablations first and select the smallest dataset whose held-out curve remains competitive. Move the best one or two mixes to E4B.

---

## 15. Filtering and deduplication

Mandatory exclusions by default:

- lockfiles,
- minified files,
- binaries,
- generated clients and generated code,
- build outputs,
- vendored dependencies,
- snapshots with no semantic value,
- massive template/vendor imports,
- pure formatting changes,
- secrets or high-risk PII,
- patches too large to form a coherent task.

Large commits should be decomposed only when dependency analysis supports independent task groups. Do not arbitrarily split hunks into misleading tasks.

Dedup layers:

- exact content and normalized patch hashes,
- normalized instruction hashes,
- MinHash/token-shingle near-dedup,
- AST or syntax-tree fingerprints where parsers are available,
- sibling/source-group dedup,
- train/eval cross-split similarity audit.

DataTrove may be used for scalable statistics and MinHash stages, but the canonical schemas and provenance remain MLX-owned.

---

## 16. Leakage-safe splitting

Primary splits are group-based and deterministic.

### 16.1 Task-group integrity

All variants derived from the same commit, PR, issue, review chain, or synthetic regression task share one `task_group_id` and stay in one split.

### 16.2 Temporal holdout

For selected training repositories, reserve the latest meaningful history segment for evaluation. Compute the cutoff per repository and record it.

### 16.3 Whole-repository holdout

Reserve complete repositories stratified by language, framework, size, and importance. These repositories must contribute no source content or derived preference evidence to training.

### 16.4 Future holdout

Support appending real tasks created after the dataset snapshot date. These are the strongest anti-contamination tasks.

### 16.5 Leakage audit

The compiler must detect:

- future files in pre-change context,
- target diff text in prompts,
- sibling examples across splits,
- near-duplicate instructions/patches across splits,
- repository holdout references in global preference summaries,
- evaluation solutions embedded in metadata or logs.

A leakage failure blocks dataset release.

---

## 17. Preference profile

The profile is hierarchical:

```text
global
language
framework
repository-local constraints
```

Formatting configured by a repository is a local constraint, not automatically a global personal preference.

Each preference includes:

- stable ID,
- scope,
- concise claim,
- deterministic feature values,
- support count and independent repository count,
- recency-weighted estimate,
- confidence interval or posterior uncertainty,
- supporting evidence references,
- counter-evidence references,
- exceptions,
- training implication,
- generated-at snapshot.

Use empirical-Bayes/Beta-Binomial style shrinkage for repeated binary preferences where appropriate. Rare evidence must remain uncertain instead of being promoted into a global rule.

Produce two artifacts:

1. `developer_profile.json` — machine-readable evidence graph.
2. `DEVELOPER_PROFILE.md` — concise prompt-ready profile card with confidence and exceptions.

The benchmark must compare base model performance with and without this profile card to isolate prompting gains from fine-tuning gains.

---

## 18. Hugging Face-native output

Hugging Face integration is a first-class requirement.

The canonical dataset release must:

- use Parquet/Arrow,
- define explicit `datasets.Features`,
- load with `datasets.load_dataset` without custom repository code,
- support multiple configs,
- include train/validation/test or named benchmark splits,
- include a complete dataset card and YAML metadata,
- include schema and manifest versions,
- include file checksums and snapshot fingerprint,
- include Croissant metadata,
- validate Dataset Viewer compatibility,
- push privately by default only through an explicit command.

Required configs:

```text
profile
evidence
sft
messages
preference
tools
benchmark
public_demo
```

See `MLX_DATASET_CONTRACT.md`.

---

## 19. Training exports

In addition to Hugging Face configs, compile:

```text
exports/mlx_lm/train.jsonl
exports/mlx_lm/valid.jsonl
exports/mlx_lm/test.jsonl
exports/trl/sft/
exports/trl/preference/
exports/lighteval/
```

Requirements:

- Conversational prompt-completion examples for completion-only loss.
- Tool examples with `messages` and JSON-schema `tools`.
- Preference examples with `prompt`, `chosen`, and `rejected`.
- Long trajectories transformed into prefix→next-assistant-action examples so every assistant tool call can receive loss under final-completion masking.
- Token estimates and truncation records per export.
- Exact export config and source dataset fingerprint recorded.

---

## 20. Fixed coding tools

The model-facing tool surface is stable and host-implemented:

```text
list_tree
read_file
search_code
read_symbol
git_show
git_diff
apply_patch
run_check
finish
```

Properties:

- JSON Schema contracts.
- Bounded outputs and pagination.
- Path containment and symlink checks.
- `run_check` accepts an allowlisted `check_id`, never arbitrary shell.
- Patches apply only inside disposable task worktrees.
- All calls and results recorded as observable trace events.

---

## 21. Benchmark and model comparison

Implement **MLX PersonalBench**, described in `MLX_BENCHMARK_SPEC.md`.

Minimum compared variants:

1. Gemma 4 E2B base.
2. Gemma 4 E4B base.
3. E4B base + developer profile card.
4. Tuned E2B.
5. Tuned E4B.
6. Tuned E4B + developer profile card.

Optional adapters may compare other local or API models, but private tasks must not be sent to cloud APIs without explicit sanitization and approval.

Primary benchmark categories:

- repository task execution,
- localization/navigation,
- style/preference choice,
- whole-repository generalization,
- temporal/future generalization.

Report task-level outputs, not only aggregate scores.

---

## 22. MLX-LM training on M4 Pro 24 GB

### 22.1 Model roles

- E2B: smoke tests, dataset ablations, tool-format validation.
- E4B: principal personal model and final evaluation.

### 22.2 Resource policy

Default training memory budget: approximately 18 GB, leaving headroom for macOS and the operator UI.

Benchmark candidate profiles rather than assuming one works:

```yaml
safe:
  max_seq_length: 2048
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 12
  lora_rank: 16
  gradient_checkpointing: true

balanced:
  max_seq_length: 4096
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 16
  lora_rank: 32
  gradient_checkpointing: true

aggressive:
  max_seq_length: 4096
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 24
  lora_rank: 32
  gradient_checkpointing: true
```

The implementation must inspect the installed `mlx_lm.lora --help` and generate version-compatible configs. Never assume remembered flags.

### 22.3 Required smoke acceptance

On the M4 Pro:

1. Load E2B and generate a response.
2. Validate a structured tool call.
3. Run E4B preflight.
4. Run a bounded E4B QLoRA smoke training.
5. Save a checkpoint.
6. Resume from checkpoint.
7. Load the adapter for inference.
8. Evaluate at least a small paired benchmark subset.
9. Record peak memory, tokens/s, wall time, and versions.

Mock backend tests remain required but do not satisfy this gate.

---

## 23. Studio and presentation

Studio is a real local application, not a generated static text fixture.

Required views:

1. **GitHub DNA** — repository counts, commits, churn, SLOC, languages, activity timeline.
2. **Language Evolution** — language and framework use over time.
3. **Evidence Funnel** — raw repositories → evidence → quality tiers → dedup → final datasets.
4. **Preference Fingerprint** — hierarchical preferences, confidence, evidence and exceptions.
5. **Dataset Explorer** — configs, examples, tokens, languages, quality, splits, provenance.
6. **Benchmark Arena** — paired model comparison and confidence intervals.
7. **Training** — loss, validation, throughput, memory, checkpoints, experiment metadata.
8. **Live Trace** — model tool calls and task execution.
9. **Privacy** — redaction status and publication mode.

Presentation mode:

- 16:9 layout,
- large typography,
- no secrets or private names by default,
- deterministic replay from a signed run manifest,
- visible `LIVE`/`REPLAY`/`FIXTURE` badges,
- operator keyboard navigation,
- offline operation.

---

## 24. CLI contract

Required commands:

```text
mlx doctor
mlx init
mlx auth status
mlx repos scan
mlx repos review
mlx repos set <repo> --mode included|excluded|holdout|metrics-only
mlx mirror
mlx metrics build
mlx metrics show
mlx evidence build
mlx preferences build
mlx dataset build --profile smoke|presentation|core|full
mlx dataset validate
mlx dataset inspect
mlx dataset push --private
mlx benchmark build
mlx benchmark run
mlx benchmark compare
mlx train preflight --model e2b|e4b
mlx train run
mlx model serve
mlx agent run
mlx studio
mlx demo
mlx pipeline
mlx gc
```

Commands must have machine-readable `--json` output and human-readable output where practical.

---

## 25. Run and job model

Long operations are jobs with:

- immutable input/config hash,
- idempotency key,
- status,
- lease owner and expiration,
- heartbeat,
- bounded retries,
- checkpoint state,
- structured event log,
- cancellation,
- recovery after crash,
- parent/child lineage.

No stage should repeat expensive work when its deterministic inputs and implementation version are unchanged.

---

## 26. Security and privacy gates

Mandatory tests and controls:

- secret scanning before dataset inclusion and export,
- PII scanning and configurable redaction,
- repository visibility propagation,
- path traversal and symlink escape tests,
- shell argument safety,
- archive extraction safety,
- no raw credentials in logs,
- no private content in fixture bundles,
- explicit egress policy for teacher or judge providers,
- loopback-only local servers by default,
- signed/checksummed run and dataset manifests,
- publication preview showing exact files and metadata to be uploaded.

---

## 27. Research and reproducibility artifacts

Every dataset version includes:

- source snapshot manifest,
- selected repository manifest,
- normalized identity manifest,
- filter configuration,
- prompt/model versions,
- schema versions,
- quality thresholds,
- dedup configuration,
- split manifest,
- tokenization/model template information,
- file checksums,
- dataset card,
- Croissant metadata,
- benchmark contamination/leakage audit,
- known limitations.

Every model experiment includes a model card with dataset fingerprint, base model, adapter configuration, evaluation results, hardware, software versions, and limitations.

---

## 28. Required roadmap phases

GSD must preserve these independent acceptance boundaries:

1. **Identity, cleanup, baseline, and migration map**
2. **Foundation: configuration, SQLite, CAS, runs, and job queue**
3. **GitHub inventory, mirrors, identities, and accurate metrics**
4. **Evidence extraction, accepted-state quality, and preference profile**
5. **Hugging Face dataset compiler, deduplication, and leakage-safe splits**
6. **Runtime tools, worktrees, MLX PersonalBench, and model adapters**
7. **Apple Silicon MLX-LM training, experiment tracking, and paired evaluation**
8. **Studio, presentation mode, privacy review, and end-to-end acceptance**

Do not collapse these into “MVP” and “polish.”

---

## 29. Definition of done

The project is complete only when all of the following are true:

- Product identity is consistently MLX; no user-facing Forgeprint remnants remain.
- The `mlx` binary works or reports a collision with a safe fallback.
- Synthetic repositories exercise merges, reverts, renames, aliases, binary files, generated files, tests, and temporal history.
- Repository inventory is paginated and explicit-selection based.
- Mirrors update incrementally and recover after interruption.
- Metrics match known fixture expectations.
- SQLite migrations, leases, retries, and crash recovery are tested.
- Evidence is immutable, provenance-rich, and content-addressed.
- Preference claims include uncertainty and counter-evidence.
- The dataset builds to Parquet/Hugging Face configs and validates through `load_dataset`.
- Dataset Viewer compatibility is tested locally where possible.
- Dataset card, schemas, manifest, and Croissant metadata are generated.
- Deduplication and leakage audits pass.
- Whole-repository and temporal holdouts are real.
- MLX-LM JSONL exports are generated and parsed.
- The benchmark executes patches in disposable worktrees with allowlisted checks.
- Base, base+profile, tuned, and tuned+profile results are paired and statistically reported.
- Real E2B/E4B MLX acceptance runs on the M4 Pro.
- Studio implements every required view and labels live/replay/fixture data.
- No secret, private repository, model, or dataset artifact is committed.
- All portable checks pass.
- An independent final audit finds no unresolved critical issue.

---

## 30. Event-specific success floor

For the July 16, 2026 presentation, the honest minimum is:

- real metrics from a small explicitly selected repository set,
- a real preference profile with evidence,
- 500–2,000 validated Hugging Face-ready examples,
- a private/local dataset that loads through `datasets`,
- 20–50 held-out benchmark tasks,
- a paired base vs base+profile comparison,
- optional tuned E2B smoke results if completed,
- a polished Studio replay with accurate labels.

Do not risk the event by claiming a full 25k–50k dataset or final E4B adapter if those artifacts have not been fully validated.
