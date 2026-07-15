# MLX Repository Instructions

## Product identity

- The product is named **MLX**.
- The only intended user-facing executable is `mlx`.
- The default local state directory is `~/.mlx`, overridable with `MLX_HOME`.
- Do not introduce or preserve the product names `Forgeprint`, `forgeprint`, or `codex` in user-facing product text, binaries, package descriptions, screenshots, or generated artifacts.
- The GitHub repository itself may retain its current remote name during development; do not rename remotes automatically.
- Because Apple also uses the name MLX, always describe this product in documentation as **“MLX — the personal coding dataset and model pipeline”** on first mention. Add a collision check in `mlx doctor`; never overwrite an existing unrelated `mlx` executable without explicit operator action.

## Source of truth

Read these files before planning or changing architecture:

1. `docs/MLX_PROJECT_SPEC.md`
2. `docs/MLX_DATASET_CONTRACT.md`
3. `docs/MLX_BENCHMARK_SPEC.md`
4. `docs/MLX_RESEARCH_RATIONALE.md`

The dataset contract has priority over convenience. A model-training demo is not a substitute for a correct dataset pipeline.

## Core goal

Build a local-first system that turns explicitly authorized GitHub repositories into:

- accurate personal engineering metrics,
- a provenance-rich evidence lake,
- a hierarchical coding-preference profile,
- versioned Hugging Face-native dataset configurations,
- MLX-LM-compatible training exports,
- and an executable benchmark comparing base, prompted, and tuned models.

The system learns from accepted repository states. Human-authored and AI-assisted code are both valid evidence. Authorship origin may be stored for audit but must not reduce quality by default.

## Privacy and safety

- Private repositories are private by default.
- Never upload source, patches, traces, repository names, metrics, adapters, or datasets without an explicit `--push`/`--publish` action and confirmation.
- Never enumerate or clone all private repositories merely to test the implementation. Use synthetic repositories and explicitly selected live repositories.
- Never commit `~/.mlx`, Git mirrors, models, adapters, tokens, raw traces, secrets, generated datasets, or private repository manifests.
- Run secret and PII scanning before any export or Hub upload.
- Do not preserve hidden chain-of-thought or private model reasoning in datasets. Store observable messages, tool calls, concise plans, outputs, scores, and provenance only.
- Shell execution is deny-by-default. Repository checks must come from an inspected, allowlisted command registry.
- Prevent path traversal, symlink escape, command injection, unsafe archive extraction, and writes outside configured roots.

## Engineering rules

- Prefer deterministic extraction over LLM inference.
- Git history, metrics, hashes, splits, deduplication, filtering, schema validation, and executable checks must be deterministic and testable.
- Use LLMs only for semantic tasks such as intent reconstruction, context selection, preference synthesis, trajectory generation, and critique.
- Every generated example must retain provenance to repository snapshot, commit/PR/task group, file paths, generator version, validation results, and split assignment.
- All examples derived from the same source task belong to the same `task_group_id` and must never cross splits.
- Whole-repository and temporal holdouts are mandatory. Random row splitting is forbidden for the primary benchmark.
- Fixtures are test assets, not production implementations. Never report fixture, replay, or mock output as live.
- Every presentation metric must be labeled `LIVE`, `REPLAY`, or `FIXTURE`.
- Avoid giant `index.ts` modules. Keep boundaries explicit and testable.
- Use typed schemas at package boundaries.
- Persist migrations; never mutate production database shape ad hoc.
- Long-running jobs must be resumable, idempotent, observable, and recoverable after process termination.

## Technology direction

- Operator CLI and local services: Bun + TypeScript.
- Presentation Studio: React + Vite or an equivalent local static/client stack, served only on loopback by default.
- Data compiler: Python managed by `uv`, using current compatible versions of Hugging Face `datasets`, `pyarrow`, `polars`, `duckdb`, and `huggingface_hub`.
- Operational state: SQLite with migrations, WAL mode, foreign keys, leased jobs, heartbeats, retries, and recovery.
- Canonical analytical data: Parquet/Arrow, queryable through DuckDB.
- Content-addressed blobs: SHA-256 objects under `MLX_HOME`.
- Optional large-scale dedup/statistics blocks may use Hugging Face DataTrove when the workload justifies it.
- Training: MLX-LM on Apple Silicon, with E2B for smoke/ablations and E4B as the principal model.
- Hugging Face is a first-class export target. The canonical dataset must load through `datasets.load_dataset` without custom code.

## Validation commands

The repository must expose stable scripts for at least:

```bash
bun run check
bun run typecheck
bun run test
bun run test:integration
bun run studio:build
bun run dataset:validate
bun run benchmark:smoke
bun run local:check
```

Mac-only tests must be capability-gated and explicitly reported as skipped outside Apple Silicon. A skipped test is never described as passed.

## Git behavior

- Do not force-push, merge, rename remotes, or publish artifacts without explicit operator approval.
- Make focused commits with descriptive messages.
- Preserve unrelated working-tree changes.
- Before destructive migration, create a migration inventory and prove replacement coverage.

## Completion rule

Do not claim the project is complete because the CLI surface exists or mock tests pass. Completion requires the acceptance criteria in `docs/MLX_PROJECT_SPEC.md`, including a real Hugging Face dataset build, leakage audit, executable benchmark, local Studio, and Apple Silicon MLX smoke acceptance.
