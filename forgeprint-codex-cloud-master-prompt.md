# Forgeprint — Codex Cloud Master Build Prompt

Paste the prompt below into a Codex Cloud task for `Julian-AT/codex-hackathon` after committing the supplied root `AGENTS.md`.

---

You are the principal engineer responsible for rebuilding `Julian-AT/codex-hackathon` into a production-quality local system named **Forgeprint**.

Work autonomously from inspection through implementation and verification. Do not stop after writing a plan. Do not ask product questions unless a safety boundary makes implementation impossible; make sound engineering decisions, document them, and continue. Do not leave TODOs, placeholder production paths, fake success states, or unimplemented command shells. Prefer a smaller real vertical slice over broad scaffolding, but the final branch must satisfy all acceptance criteria below.

## Mission

Forgeprint converts the user’s accessible GitHub history—including private, internal, organization, and collaborator repositories—into a provenance-first evidence lake, evidence-backed coding-preference profile, verified repository-editing datasets, MLX-compatible training files, a locally fine-tuned Gemma 4 coding agent, executable evaluations, and a polished local presentation dashboard.

The target computer is an Apple Silicon **M4 Pro MacBook with 24 GB unified memory**. Codex Cloud cannot execute real MLX training; implement and test a real MLX command backend, a capability/preflight layer, and a deterministic mock backend. Never claim that Apple-Silicon-only integration passed in the cloud.

## Current repository context

The existing repository is a Bun + TypeScript + Ink CLI for a Supabase-specific offline specialist-model pipeline. It already contains useful ideas: local OpenAI-compatible model access, structured Zod outputs, worker orchestration, checkpoints, deduplication, training subprocess supervision, MLX shell entry points, and an evaluation runner. Reuse good generic mechanisms, but replace the Supabase product domain, dynamic generated JavaScript tools, chunk-level split, text-equality evaluation, iPhone deployment, and old demo-specific assumptions.

## Non-negotiable product decisions

1. The product and binary are named **Forgeprint** and **`forgeprint`**.
2. Never install or expose a binary, alias, package script, UI title, data directory, or user-facing command named `codex`. The GitHub repository may retain its historical name.
3. Forgeprint treats code accepted into selected repository histories as potentially good evidence whether written manually or with AI. Human-vs-AI authorship may be retained only as optional audit metadata and must not affect default quality scoring.
4. Private repository contents stay local by default. No dataset, mirror, prompt payload, adapter, source snippet, or repository name may be uploaded unless an explicit per-repository egress policy allows it.
5. The large persistent asset is an evidence lake. Training datasets are versioned, curated views over that lake; “more examples” must never override verification, deduplication, leakage control, or holdout integrity.
6. Runtime coding tools are fixed, typed, tested, path-safe, and host-executed. The model must not invent executable JavaScript tools and must not receive arbitrary shell execution.
7. Deterministic execution checks are the primary graders. LLM judges may add semantic assessments but may never replace patch application, tests, typecheck, lint, build, security, and leakage checks.
8. No teacher chain-of-thought is stored or trained. Store concise observable plans, tool calls, tool results, patches, and final answers only.
9. The dashboard must never fabricate values. Every view visibly identifies `LIVE`, `REPLAY`, or `FIXTURE`, and presentation mode redacts private information by default.
10. The final system must work without a cloud provider for scanning, statistics, dataset compilation, MLX training, inference, evaluation, and visualization. Cloud teacher generation is optional and explicit.

## Repository architecture

Convert the project into a private Bun workspace with this structure, or a strictly equivalent structure if the current tree makes a minor variation materially safer:

```text
apps/
  cli/                 Forgeprint binary, Ink operator UI, command parser
  studio/              Vite + React local dashboard and presentation UI
packages/
  core/                configuration, schemas, domain types, events, IDs
  catalog/             SQLite migrations, repositories, job queue, run registry
  github/              gh/git adapters, inventory, mirrors, PR metadata
  evidence/            history extraction, filters, scoring, provenance, stats
  agents/              provider abstraction and semantic workers
  dataset/             canonical examples, dedupe, splits, MLX compiler
  runtime/             fixed coding tools and local agent loop
  training/            MLX backend, mock backend, preflight, supervisor
  eval/                worktree runner, checks, comparisons, metrics
fixtures/
  repositories/        synthetic Git repositories built during tests
  api/                 deterministic GitHub/provider fixture payloads
  demo/                safe, synthetic presentation run
scripts/
  bootstrap-macos.sh
  verify-macos.sh
  cloud-check.sh
docs/
```

Use TypeScript strict mode, Zod at every external boundary, named exports, explicit error types, and Biome with the repository’s established tabs, single quotes, semicolons, and 100-character line width. Use Bun workspaces and keep internal packages private.

Use `bun:sqlite` with WAL mode, foreign keys, versioned migrations, transactions, and a single-writer discipline for the catalog and persistent job queue. Store large immutable derived payloads in a content-addressed filesystem store. Do not duplicate full Git blobs that already exist in local bare mirrors. Use SHA-256 IDs and atomic temp-file-to-rename writes.

Default data root:

```text
~/.forgeprint/
  config.yaml
  catalog.sqlite
  mirrors/
  objects/
  runs/
  datasets/
  models/
  logs/
```

Support `FORGEPRINT_HOME` for tests and custom installations. Nothing below this directory may be committed.

## Command surface

Implement a real nested CLI with useful help, exit codes, `--json`, `--non-interactive`, cancellation, and resumability:

```text
forgeprint doctor
forgeprint init
forgeprint repos scan
forgeprint repos review
forgeprint mirror
forgeprint stats
forgeprint mine
forgeprint dataset build
forgeprint dataset inspect
forgeprint train preflight
forgeprint train run
forgeprint eval run
forgeprint agent
forgeprint studio
forgeprint demo
forgeprint pipeline
```

The no-argument command should show concise help or an operator TUI. Add a `bin` entry and Bun shebang so `bun link` exposes exactly `forgeprint`. Development commands may use `bun run forgeprint -- ...`.

All long-running commands must create a run record, emit typed JSON events, show progress in Ink, persist checkpoints, handle SIGINT/SIGTERM, release child processes/worktrees, and resume safely after interruption. Use stable idempotency keys and leased jobs with retry counts; stale running jobs must be recoverable.

## Configuration

Create a documented YAML configuration validated by Zod. It must include:

- GitHub host and repository affiliations
- include/exclude rules, archive/fork policy, selected and holdout repositories
- author identity aliases for personal statistics
- repository importance weights
- generated/vendor/lockfile/minified/snapshot path rules
- per-repository egress policy: `forbidden`, `metadata_only`, `minimal_code`, or `allowed`
- teacher and judge providers/models/concurrency/budgets
- dataset profiles and token budgets
- split salt and policies
- training model/profile/memory budget
- check allowlists and timeouts
- presentation redaction aliases

Defaults must be privacy-preserving: private/internal repositories have `forbidden` cloud egress, forks and archived repositories are excluded, arbitrary commands are disabled, and Studio binds only to `127.0.0.1`.

## GitHub inventory and mirrors

Use the authenticated GitHub CLI rather than storing tokens. `forgeprint doctor` must check `gh auth status`, Git, Bun, Python/uv, MLX availability, `rg`, and optional `scc` and `gitleaks`.

Inventory must use paginated `gh api graphql` and include repositories accessible through owner, collaborator, and organization-member affiliations. Capture repository ID, full name, host, visibility, owner, default branch, archive/fork status, disk size metadata, and selected policy. Support github.com and a configurable GitHub Enterprise host.

Mirror selected repositories as local bare mirrors using safe process argument arrays, never shell-concatenated strings. Perform incremental fetch/prune and record exact ref/SHA snapshots per run. Fetch PR, issue, review, and check metadata through cached, paginated GitHub API calls when enabled. Handle rate limits, retries, partial failure, and deleted/renamed repositories without corrupting prior snapshots. Never persist GitHub credentials.

Implement an interactive repository review screen that marks each repository `include`, `exclude`, or `holdout`, supports bulk filters, and clearly distinguishes public/private/internal without exposing names in presentation mode.

## Statistics

Forgeprint must answer the user’s original question with methodologically separate metrics:

- accessible, selected, public/private/internal, owned/collaborator/org repositories
- authored commits, authored non-merge commits, coauthored commits, accepted-history commits
- additions, deletions, net change, and code churn after configured path filters
- current source lines by language using `scc` when available, with an explicitly labeled internal fallback
- surviving authored lines via cached `git blame`, optional because it is expensive
- pull requests, reviews, issues, active days, files touched, language distribution, and time series
- per-repository totals and uncertainty/identity warnings

Identity resolution must combine explicit aliases, local Git config, GitHub noreply patterns, and discovered author candidates. Never silently merge ambiguous identities. Write `docs/METRICS.md` describing exactly what each metric means and why GitHub profile contributions are not equivalent to Git-history totals.

## Evidence model and accepted-state quality

Create normalized schemas/tables for repositories, snapshots, refs, commits, parents, file changes, PRs, reviews, checks, blobs, evidence records, task groups, preferences, examples, validations, splits, experiments, metrics, events, and jobs.

Every derived record must include provenance: repository ID, snapshot SHA, commit/PR/issue identifiers, parent/base SHA, paths, source hashes, extractor/prompt versions, provider/model ID, timestamps, and validation results.

Default quality scoring must be based on accepted repository state, not authorship origin. Include configurable factors for:

- presence on selected default/release branch
- merged PR evidence
- survival across later commits
- successful CI/local checks
- fail-to-pass repair evidence
- revert or immediate corrective follow-up
- semantic change value
- generated/vendor/template likelihood
- uniqueness and duplication
- recency and repository importance

Store the factors separately; do not hide them inside one opaque score. Reverted changes and earlier failing revisions are valuable negative/preference evidence, not automatically discarded.

## Extraction and task families

Build canonical task groups from real repository history. Keep every derivative of one commit/PR in the same task group.

Implement these example families:

1. `historical_edit`: parent-state context + real intent -> accepted patch
2. `tool_trajectory`: observable repository inspection/tool calls -> verified patch/final response
3. `fail_to_pass`: regression test fails on parent and passes on target/solution
4. `review_preference`: earlier/rejected/failing change versus accepted correction
5. `repository_understanding`: file localization, check selection, architecture/convention questions

Intent source priority: merged PR title/body and linked issue, then useful commit message, then teacher reconstruction. Context must come only from the parent/base state. The target patch and after-state contents must never enter solver prompts.

Implement leakage gates that reject examples containing after-state files, target patches, long added-code spans, target-only identifiers that make the answer trivial, or task-family cross-split contamination. Use exact hashes plus token/n-gram overlap heuristics and record rejection reasons.

Filter or downweight lockfiles, generated code, vendor trees, minified files, binaries, large assets, build output, copied templates, formatting-only commits, and mass mechanical migrations according to config and `.gitattributes`/repository evidence. Renames and multi-parent commits must be handled explicitly. Do not treat an exception as an empty successful result.

## Semantic workers and providers

Retain the current useful structured-output pattern, but replace Supabase roles with:

- intent reconstructor
- context selector
- preference miner
- trajectory solver
- regression-test synthesizer
- leakage critic
- semantic critic
- dataset curator

Use a provider interface with at least:

- `fixture` deterministic provider for tests/demo
- `local-openai-compatible` for `mlx_lm.server`
- `openai` as an optional explicit cloud teacher

Do not hardcode a changing cloud model name; require/configure model IDs. Every call has a prompt version, schema version, timeout, retry budget, token budget, concurrency limit, cache key, and egress decision. Before any cloud request, apply the repository egress policy, secret scan, path filtering, and minimal-context selection; support a dry-run that prints a redacted payload manifest without sending it.

Never request, store, or train hidden chain-of-thought. Ask for concise plans or evidence summaries only. Store tool calls, tool outputs, patches, and final responses as observable trajectories.

Preference mining must distinguish global, language, framework, and repository-local rules. A preference requires independent evidence and counterevidence; formatter config alone is a repository constraint, not automatically a global personal preference. Generate a versioned developer profile and per-repository profile with citations back to evidence records.

## Fixed coding-agent runtime

Implement a local agent loop with these fixed tools:

- `list_files`
- `read_file` with line ranges and size limits
- `search_text`
- `git_status`
- `git_diff`
- `apply_patch`
- `run_check`
- `finish`

All tool schemas must be Zod-defined and exported in model-compatible JSON schema. The host validates every call. Prevent path traversal, symlink escape, writes outside the disposable worktree, oversized reads/patches, binary edits, and unbounded loops. `run_check` accepts only discovered/configured check IDs such as `test`, `typecheck`, `lint`, and `build`; it never accepts an arbitrary command string. Use process argument arrays, timeouts, output limits, and cancellation.

By default, agent tasks run in a disposable detached Git worktree. Do not modify the user’s working tree unless a separate explicit apply step is approved. Record all steps and cleanup worktrees on success, failure, and signals.

## Dataset curation and MLX compilation

Persist a rich canonical example format first; compile model-specific JSONL only at the end. Every example must contain task type, instruction, parent/base context refs, target/solution, observable trajectory, tools, provenance, quality factors, validation, task group, split, weight, and redaction metadata.

Implement:

- exact hash deduplication
- MinHash/lexical near-deduplication
- optional local embedding deduplication
- task-lineage deduplication
- repository and language balancing
- per-repository caps
- quality-threshold and token-budget sampling
- deterministic seeds and reproducible manifests

Create dataset profiles rather than one unlimited file:

- `smoke`: tiny fixture/Mac integration dataset
- `demo`: fast, presentation-safe subset
- `core`: highest-quality verified data
- `full`: larger curated view

Report both total tokens and assistant-target tokens. Do not assume that the largest view is the best.

Splits must be deterministic and leakage-safe:

- all records from one task group stay together
- selected repositories are complete repository holdouts
- selected recent periods are temporal holdouts
- future tasks can be registered as a separate future holdout
- validation/test source material never appears in training derivatives

Compile valid MLX `chat`/`tools` JSONL into `train.jsonl`, `valid.jsonl`, and `test.jsonl`, plus manifests and a generated dataset card. Because MLX prompt masking learns the final completion, explode multi-turn trajectories into prefix-to-next-assistant examples so each assistant tool call/final answer becomes a supervised target without training on user/tool tokens. Validate the resulting Gemma 4 chat/tool format and never hand-build undocumented special tokens when the tokenizer chat template can be used.

Integrate `gitleaks` when installed and a conservative built-in fallback. Quarantine, do not print, any suspected secret. Never commit generated datasets.

## Training backend for M4 Pro 24 GB

Replace hardcoded 400-iteration scripts with a typed `TrainingBackend` interface and implementations:

- `mock` deterministic backend for CI/cloud
- `mlx-lm` real subprocess backend for Apple Silicon

Pin and document a tested MLX-LM version, initially `mlx-lm[train]==0.31.3`, but centralize the version. Run `mlx_lm.lora --help` in `doctor/preflight` and capability-detect flags rather than assuming every historical flag exists. Use YAML/config files where supported. The primary model is `unsloth/gemma-4-E4B-it-UD-MLX-4bit`; the fast ablation/fallback model is `unsloth/gemma-4-E2B-it-UD-MLX-4bit`. Keep IDs configurable.

Default to instruction-tuned E4B QLoRA/SFT, not GRPO. Remove or archive the old GRPO path from the active pipeline unless a separately tested backend proves it works; do not make third-party reward training part of the default success path.

Implement a Mac preflight benchmark that tries profiles in order, measures wall time, tokens/sec, process RSS/system memory pressure where available, detects OOM/pressure, and writes a recommended config. Never reserve all 24 GB; default memory budget is 18 GB and must be configurable.

Initial candidates—not unconditional claims—are:

```yaml
safe:
  max_seq_length: 2048
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 12
  lora_rank: 16
  grad_checkpoint: true

balanced:
  max_seq_length: 4096
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 16
  lora_rank: 32
  grad_checkpoint: true

aggressive:
  max_seq_length: 4096
  batch_size: 1
  grad_accumulation_steps: 8
  num_layers: 24
  lora_rank: 32
  grad_checkpoint: true
```

Only select a profile after a real local benchmark. Fall back from E4B to E2B only when requested or when E4B preflight cannot meet the configured memory/stability budget.

Use QLoRA for quantized models, `--mask-prompt` for supported chat/completion data, gradient accumulation, validation loss, periodic checkpoints, resume, early stopping, and gradient checkpointing. Derive optimizer steps from assistant-target token budget and effective batch, not a universal iteration constant. Preserve and improve the existing child-process registry, signal handling, rollback/checkpoint concepts, but emit normalized structured training events and make parsers version-tested. Keep adapters unfused for experiments; fuse only as an explicit release step after evaluation.

Create `scripts/bootstrap-macos.sh` and `scripts/verify-macos.sh`. They must be idempotent, check arm64/macOS, create a Python 3.12 environment with `uv` when available, install pinned MLX dependencies, and print exact remediation rather than making unsafe system changes.

## Evaluation

Build an executable evaluation harness using isolated worktrees. Compare at least:

- base E4B
- base E4B + developer/repository profile
- tuned E4B
- tuned E4B + developer/repository profile

Allow E2B comparisons. Use the same task, tool limits, context budget, sampling configuration, and check commands. Support multiple attempts/seeds without conflating them.

Primary metrics:

- patch applied
- fail-to-pass tests
- pass-to-pass regression tests
- typecheck/lint/build result
- correct file localization
- valid tool-call rate
- steps, tokens, latency, and memory
- changed lines and unrelated-file changes
- secret/security violations
- repository-convention features

Never declare a win from normalized string equality or an LLM judge alone. Store full machine-readable results and a concise comparison report. Blind semantic/style judging is optional and must not reveal model identity.

## Forgeprint Studio

Build `apps/studio` as a polished, local-only Vite + React application served by Forgeprint. Use a typed local JSON API and Server-Sent Events for live/replayed run events. No external analytics, fonts, CDNs, or telemetry. Bind to loopback only.

Create two modes:

1. operator mode for inspection and control
2. `--presentation` mode optimized for 16:9 projection, large typography, keyboard navigation, and automatic private-data redaction

Required views:

- **Overview:** repositories, years, commits, churn, current SLOC, active days, languages
- **Evidence Funnel:** repositories -> commits/PRs -> accepted evidence -> tasks -> verified examples -> train/valid/test
- **Agent Swarm:** live worker cards, queue depth, role, repository alias, status, throughput, rejection reasons
- **Preference Map:** evidence-backed global/language/framework/repo preferences with confidence and counterevidence
- **Dataset Explorer:** type/language/repository distribution, token budgets, quality factors, provenance drill-down with redaction
- **Training:** profile, model, loss/validation, tokens/sec, memory, checkpoints, status
- **Eval Arena:** base versus prompted versus tuned, side-by-side patch summary, checks, latency, and winner only when verified
- **Live Trace:** observable tool calls and outputs for one coding task

Use a coherent dark visual system suitable for a technical event, but prioritize readability over decorative effects. Provide keyboard shortcuts and fullscreen behavior. Never show private repository names or code in presentation mode unless explicitly allowlisted. Use stable aliases and indicate redaction.

Implement deterministic event replay from a run JSONL file. Commit a safe synthetic fixture run for visual tests. The UI must always show a prominent `LIVE`, `REPLAY`, or `FIXTURE` badge and timestamp; do not present replay as live. Add a static presentation snapshot/export that contains no private content.

## Migration

- Replace every user-facing `codex — ...` title with Forgeprint.
- Remove the Supabase corpus/prompt/tool assumptions from active code.
- Remove the iOS deployment runtime and commands from the active product; preserve only a concise historical note in docs if useful.
- Replace dynamic generated JS tools with the fixed coding tools.
- Replace chunk-based train/eval splitting with task-group, repository, temporal, and future holdouts.
- Replace text-equality evaluation with executable evaluation.
- Parameterize model, paths, steps, and profiles; eliminate stale Gemma 3 defaults.
- Keep reusable process supervision, checkpointing, structured generation, dedupe, and local model-provider ideas when they remain correct.
- Update package metadata, README, help text, examples, environment files, and ignore rules.

## Tests and fixtures

The cloud test suite must not require GitHub authentication, private repositories, internet, Apple Silicon, or MLX. Build synthetic Git repositories during tests with branches, merges, reverts, renames, generated files, ambiguous authors, and failing/passing checks.

Add strong tests for:

- config parsing/migrations
- inventory pagination and affiliation fixtures
- mirror command construction and partial failure
- author identity ambiguity
- numstat/filter/stat calculations
- accepted-state quality factors and reverts
- task grouping and parent-only context
- leakage rejection
- secret quarantine
- idempotent jobs/resume/cancellation
- dedupe and deterministic splits
- multi-turn MLX compilation
- fixed tool schemas, path traversal, symlink escape, output limits, and check allowlists
- mock training events, checkpoint/resume, parser fixtures, preflight selection
- executable eval on fixture repositories
- Studio API/SSE/replay/redaction and production build
- CLI smoke tests and exact absence of a `codex` binary alias

Create these scripts and make them pass in Codex Cloud:

```text
bun run check
bun run typecheck
bun run test
bun run test:integration
bun run studio:build
bun run cloud:check
```

Mac-only tests must be explicitly gated behind `FORGEPRINT_MLX_INTEGRATION=1` and documented. A skipped Mac test is not a pass; report it as unverified.

## Documentation

Write complete, current documentation:

- `README.md` with product story, quickstart, screenshots/placeholders generated from fixture UI, and privacy warning
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_AND_PRIVACY.md`
- `docs/METRICS.md`
- `docs/EVIDENCE_AND_DATASET.md`
- `docs/TRAINING_M4_PRO_24GB.md`
- `docs/EVALUATION.md`
- `docs/PRESENTATION_RUNBOOK.md`
- `docs/CLOUD_VS_MAC_VERIFICATION.md`
- dataset-card and model-card templates
- configuration reference

Document exactly what Codex Cloud verified and what must be verified on the M4 Pro.

## Definition of done

The task is complete only when all of the following are true:

- the only installed project binary is `forgeprint`
- fixture mode runs end to end without network or secrets
- real GitHub inventory/mirror/stat code is implemented behind adapters and tested with fixtures
- catalog, migrations, CAS, jobs, runs, and resumability are functional
- repository statistics are methodologically separated and exportable
- evidence/task/preference pipelines are provenance-first and privacy-gated
- historical edit and tool-trajectory examples compile into validated MLX JSONL
- leakage-safe repo/temporal/task-group splits exist
- fixed coding tools are sandboxed and tested
- mock training and fixture evaluation run end to end
- real MLX backend, preflight, scripts, and commands are implemented and documented without claiming cloud execution
- Studio builds and replays the committed safe fixture run with presentation redaction
- all required checks pass
- no secrets, private data, generated datasets, adapters, mirrors, or absolute local paths are committed
- no active Supabase/iPhone/dynamic-tool behavior remains
- no production TODOs, empty handlers, fake scores, silent catch blocks, or placeholder success messages remain

## Execution instructions

1. Inspect the entire current repository, tests, package scripts, and Git history available in the checkout.
2. Write `docs/IMPLEMENTATION_PLAN.md` with architecture decisions, migration map, risks, and a checklist.
3. Continue immediately into implementation; do not stop for plan approval.
4. Work in coherent vertical milestones, keeping tests green as you migrate.
5. Prefer typed, testable adapters and fixture-backed integration tests over global mocks.
6. Run all required checks, fix failures, and inspect `git diff --check`.
7. Search the final tree for stale product names, Supabase-only assumptions, iPhone commands, unsafe shell construction, TODO/FIXME markers, committed data paths, and accidental secrets.
8. Finish with a precise summary of architecture, commands, tests run, known limitations, and a separate list of Mac-only verification that remains. Do not call unexecuted MLX work verified.
