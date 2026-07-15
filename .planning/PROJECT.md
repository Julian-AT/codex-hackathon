# MLX

## What This Is

MLX — the personal coding dataset and model pipeline is a local-first system for a single developer that turns explicitly authorized GitHub repositories into accurate engineering metrics, a provenance-rich evidence lake, an evidence-backed coding-preference profile, Hugging Face-native datasets, MLX-LM training exports, and an executable personal benchmark. The product remains useful without training a model: the dataset, profile, metrics, and benchmark are primary outputs, while adapters and model comparisons are downstream consumers.

## Core Value

Produce a privacy-preserving, provenance-rich personal coding dataset whose quality, splits, and benchmark results are reproducible and defensible.

## Requirements

### Validated

- ✓ A Bun/TypeScript Ink CLI and REPL can orchestrate a local MLX-LM server and command-driven pipeline stages — existing
- ✓ The current discovery layer can generate, deduplicate, validate, and persist dynamic tool specifications through schema, parse, sandbox, fuzz, and trajectory gates — existing
- ✓ The current data layer can generate chat and tool-use JSONL, apply deterministic chunk splits, judge candidates, deduplicate examples, and emit a local evaluation set — existing
- ✓ Fixed local scripts and TypeScript wrappers exist for MLX-LM SFT/GRPO training, checkpoint supervision, adapter fusion, and device deployment — existing
- ✓ An iOS MLX Swift runtime exists for adapter loading, Gemma tool-call parsing, and JavaScriptCore tool dispatch — existing but outside the target product's required deployment path

### Active

- [ ] Establish MLX product identity, the `mlx` executable, safe `MLX_HOME` paths, collision detection, required validation scripts, and a migration inventory for legacy architecture
- [ ] Implement typed configuration, SQLite migrations, content-addressed objects, immutable run manifests, and resumable leased jobs with recovery
- [ ] Inventory only explicitly authorized GitHub repositories, maintain mirrors, normalize identities, and compute accurate provenance-labeled engineering metrics
- [ ] Extract immutable accepted-state evidence and synthesize hierarchical coding preferences with support, counter-evidence, exceptions, and uncertainty
- [ ] Compile versioned Parquet/Arrow releases with all required Hugging Face configs, explicit schemas, privacy gates, deduplication, and leakage-safe task-group splits
- [ ] Provide fixed repository tools, disposable worktrees, allowlisted checks, MLX PersonalBench tasks, model adapters, and paired statistical comparison
- [ ] Produce MLX-LM-compatible exports and complete real E2B/E4B Apple Silicon smoke acceptance with experiment tracking
- [ ] Deliver the loopback-only Studio with all required analytics, dataset, benchmark, training, trace, and privacy views plus honest `LIVE`, `REPLAY`, and `FIXTURE` labels
- [ ] Pass the full portable and Apple Silicon acceptance suite, including a real Hugging Face dataset build, leakage audit, executable benchmark, and independent final audit

### Out of Scope

- Training indiscriminately on every accessible repository or file — repository inclusion is explicit and quality-gated
- Treating current line count, row count, formatting, or model training as the product's primary success measure — accepted engineering evidence and dataset quality come first
- Random row splitting for the primary benchmark — task groups, temporal history, and whole repositories require deterministic isolation
- Inferring that AI-assisted code is lower quality — accepted-state evidence is evaluated independently of authorship origin
- Implicit upload of repositories, source, traces, datasets, adapters, metrics, or models — egress requires an explicit publish action and confirmation
- Hidden chain-of-thought collection or arbitrary model-generated shell execution — only observable traces and allowlisted host tools are retained
- iPhone deployment as a required product path — the existing Swift runtime may remain only where it does not distract from the dataset-first contract
- Supabase-specific discovery, generated JavaScript tools, and the legacy demo corpus as the target MLX architecture — they are migration inputs, fixtures, or removable legacy behavior

## Context

This is a brownfield repository. It currently contains a Bun/TypeScript Ink operator interface, local MLX-LM model orchestration, a documentation-driven tool discovery and JSONL generation pipeline, training/evaluation wrappers, and an iOS runtime. Those capabilities provide implementation patterns and migration material, but the repository does not yet contain the required GitHub inventory, SQLite catalog and migrations, content-addressed evidence store, Parquet/Hugging Face compiler, leakage-safe repository/task splitting, executable repository benchmark, or local Studio.

The authoritative product contracts are `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`, and `docs/MLX_RESEARCH_RATIONALE.md`. The dataset contract takes priority over implementation convenience. Existing fixture, replay, generated, or mock output cannot be reported as live, and an MLX-LM demo does not substitute for a correct dataset pipeline.

The primary target machine is an Apple M4 Pro with 24 GB unified memory. The July 16, 2026 presentation has a narrower honest success floor, but the project definition of done remains the full acceptance specification. Event pressure must not justify false completion claims or unsafe publication.

## Constraints

- **Product identity**: User-facing identity is MLX; the executable is `mlx`; local state defaults to `~/.mlx` and supports `MLX_HOME`; `mlx doctor` must detect unrelated executable collisions before operator action
- **Technology**: Operator CLI and services use Bun + TypeScript; Studio uses a local React client; the data compiler is Python managed by `uv` with Hugging Face Datasets, PyArrow, Polars, DuckDB, and Hugging Face Hub
- **Canonical storage**: Operational state uses migrated SQLite with WAL and foreign keys; analytical data uses Parquet/Arrow; blobs use SHA-256 content addressing under `MLX_HOME`
- **Privacy**: Private repositories and all derived artifacts remain local by default; secret, PII, visibility, and licensing gates run before export; publication always requires an explicit action and confirmation
- **Determinism**: Git history, metrics, hashes, filtering, deduplication, splits, schema validation, and executable checks are deterministic and testable; LLMs are reserved for semantic transformations
- **Provenance**: Every example retains repository snapshot, source task group, file paths, generator version, validation results, privacy result, and split assignment
- **Leakage**: Sibling examples remain in one `task_group_id`; whole-repository and temporal holdouts are mandatory; leakage failures block dataset release
- **Execution safety**: Shell execution is deny-by-default through an inspected allowlisted command registry; all filesystem and archive operations prevent traversal, symlink escape, injection, and writes outside configured roots
- **Operations**: Long-running stages are idempotent, resumable, observable, recoverable, cancellable jobs with leases, heartbeats, retries, checkpoints, and immutable input/config hashes
- **Training hardware**: E2B is used for smoke tests and ablations; E4B is the principal model; real Apple Silicon acceptance is capability-gated and cannot be replaced by mocks or fixtures
- **Validation**: Stable commands include `bun run check`, `bun run typecheck`, `bun run test`, `bun run test:integration`, `bun run studio:build`, `bun run dataset:validate`, `bun run benchmark:smoke`, and `bun run local:check`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat the dataset and evidence lake as the critical path | The product must remain valuable without a successful training run, and downstream claims require stable, auditable data | — Pending |
| Learn from accepted repository states regardless of human or AI authorship | Acceptance, survival, verification, semantic value, and uniqueness are more defensible quality signals than origin mythology | — Pending |
| Use explicit repository selection and local-private defaults | The operator may access private and organization repositories that must never be enumerated, cloned, or published implicitly | — Pending |
| Separate deterministic extraction from semantic LLM work | Objective properties need repeatable tests, while intent reconstruction and preference synthesis require semantic judgment | — Pending |
| Make Parquet/Arrow with explicit Hugging Face configs the canonical release | This preserves rich provenance while supporting `datasets.load_dataset`, Dataset Viewer, TRL, MLX-LM, and analytical queries | — Pending |
| Evaluate with task-group, temporal, whole-repository, and future holdouts | Random rows and sibling leakage would overstate personalization and memorization resistance | — Pending |
| Preserve the eight acceptance boundaries mandated by the project specification | Identity/foundation, repository ingestion, evidence, datasets, runtime benchmark, training, and Studio each need independently verifiable completion | — Pending |
| Migrate brownfield code only after inventory and replacement coverage | Existing demo and iOS paths contain useful components but also unsafe storage, weak splits, and legacy product assumptions | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason
2. Requirements validated? Move to Validated with phase reference
3. New requirements emerged? Add to Active
4. Decisions to log? Add to Key Decisions
5. "What This Is" still accurate? Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check: still the right priority?
3. Audit Out of Scope: reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-15 after initialization*
