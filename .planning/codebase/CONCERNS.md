# Codebase Concerns

**Analysis Date:** 2026-07-15

## Tech Debt

**Product identity and CLI contract mismatch:**
- Issue: The runnable surface is `bun src/cli.tsx` with demo pipeline commands, while the product contract requires a user-facing `mlx` executable and MLX command set. Non-MLX product identity strings remain in terminal UI and configuration paths.
- Files: `package.json`, `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, `src/lib/config.ts`, `src/lib/conversation.ts`, `docs/MLX_PROJECT_SPEC.md`
- Impact: The binary, help text, config location, and command names do not satisfy the product identity and acceptance requirements. Operators can confuse demo output with the intended MLX pipeline.
- Fix approach: Add a real `mlx` bin entry in `package.json`, move config defaults to `~/.mlx` / `MLX_HOME`, rename user-facing strings, and implement `mlx doctor` collision detection before expanding the CLI.

**Demo corpus pipeline instead of repository evidence pipeline:**
- Issue: Data generation consumes Supabase documentation from fixed URLs and emits chat/tool JSONL files; it does not ingest explicitly selected GitHub repositories, mirrors, commit history, PRs, reviews, accepted-state evidence, or repository metrics.
- Files: `lib/discovery/corpus.ts`, `lib/discovery/pipeline.ts`, `lib/data/pipeline.ts`, `lib/data/types.ts`, `data/corpus.json`, `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`
- Impact: The generated artifacts cannot satisfy MLX evidence, provenance, privacy, or Hugging Face dataset acceptance criteria.
- Fix approach: Build the repository-selection, mirror, identity, metrics, evidence, and dataset compiler layers before treating generated examples as MLX training data.

**Canonical storage is under the repo instead of `MLX_HOME`:**
- Issue: Generated corpus, split manifest, checkpoints, training data, adapters, bench logs, and device state are written under `data/` in the application repository.
- Files: `lib/discovery/corpus.ts`, `lib/discovery/manifest.ts`, `lib/data/split.ts`, `lib/data/checkpoint.ts`, `lib/data/emit-jsonl.ts`, `scripts/_lib.sh`, `scripts/fuse.sh`, `scripts/deploy-adapter.sh`, `data/`
- Impact: Private artifacts can mix with source control, pollute verification, and bypass the local-first storage layout required by MLX.
- Fix approach: Centralize all mutable state behind a path module rooted at `MLX_HOME`, keep only synthetic fixtures under the repo, and add tests proving writes cannot escape configured roots.

**Stable validation scripts are incomplete:**
- Issue: `package.json` exposes `check`, `typecheck`, and `test`, but lacks required stable scripts such as `test:integration`, `studio:build`, `dataset:validate`, `benchmark:smoke`, and `local:check`.
- Files: `package.json`, `AGENTS.md`, `docs/MLX_PROJECT_SPEC.md`
- Impact: Orchestrators and CI cannot run the mandated acceptance gates consistently.
- Fix approach: Add the required scripts early, even if some start as capability-gated checks that report explicit skips.

**Generated and vendored workspace clutter affects tooling:**
- Issue: Large ignored directories live inside the repo root: `.claude/` is about 1.2 GB, `.venv/` about 598 MB, `ios/_upstream/` about 1.3 GB, and `.next/` about 17 MB.
- Files: `.claude/`, `.venv/`, `.next/`, `ios/_upstream/`, `.gitignore`, `biome.json`
- Impact: Repository scans, code search, and linting become slow or noisy. `bun run check` scans `.next/` and fails on generated Next.js files.
- Fix approach: Move agent worktrees and upstream checkouts outside the project root, add `.next` to Biome ignores, and keep generated build output out of normal verification paths.

## Known Bugs

**Tool schema gate rejects a test-declared valid tool call:**
- Symptoms: `bun run test` fails at `lib/data/schema-gate.test.ts` with `expected false to be true` for `supabase_rls_policy_template`.
- Files: `lib/data/schema-gate.ts`, `lib/data/schema-gate.test.ts`, `data/adapter-tools.json`, `data/adapter-tools.fallback.json`
- Trigger: Run `bun run test`.
- Workaround: None in code. Align tests with the committed manifest or make tests load a fixed fixture manifest instead of mutable generated data.

**Lint/check command fails on generated `.next` output:**
- Symptoms: `bun run check` fails because Biome scans `.next/static/...` and reports generated-file size and lint diagnostics.
- Files: `package.json`, `biome.json`, `.gitignore`, `.next/`
- Trigger: Run `bun run check` with `.next/` present.
- Workaround: Delete `.next/` before checking or add `.next` to `biome.json` ignored files.

**Training subprocess exit code is ignored:**
- Symptoms: `runTraining` reads stdout until close and returns after `waitForChildExit` without checking the child exit code.
- Files: `lib/training/run-training.ts`, `lib/server/processes.ts`, `scripts/train.sh`, `scripts/grpo.sh`
- Trigger: A training script exits non-zero after writing no parseable stdout failure marker.
- Workaround: Inspect shell output manually; do not treat the CLI "done" state as authoritative until exit-code handling is added.

**GRPO smoke script is machine-specific:**
- Symptoms: `scripts/grpo-smoke.sh` sources an absolute virtualenv path under one developer's checkout.
- Files: `scripts/grpo-smoke.sh`
- Trigger: Run the script from any different path or machine.
- Workaround: Use `scripts/_lib.sh` style relative activation or set `VIRTUAL_ENV` manually.

## Security Considerations

**No secret/PII scanning gate before data emission:**
- Risk: Generated JSONL, checkpoints, manifests, and future repository-derived datasets can include credentials, private code, URLs, names, or traces without a blocking privacy scan.
- Files: `lib/data/emit-jsonl.ts`, `lib/data/checkpoint.ts`, `lib/data/pipeline.ts`, `lib/discovery/manifest.ts`, `data/adapter-tools.json`, `docs/MLX_DATASET_CONTRACT.md`
- Current mitigation: `.env.local` is ignored and was not read; generated tool validation rejects some unsafe JavaScript identifiers in `lib/discovery/validate/parse.ts`.
- Recommendations: Add secret scanning, PII scanning, repository visibility propagation, redaction policy, and export preview before writing publishable artifacts.

**Shell execution is not governed by a command registry:**
- Risk: Adapter and training actions spawn `bash` scripts and inherit the full environment. `scripts/fuse.sh` removes `$OUT_DIR`, which is environment-controlled and not constrained to a safe root.
- Files: `lib/training/run-training.ts`, `lib/adapter/run-adapter.ts`, `scripts/train.sh`, `scripts/grpo.sh`, `scripts/fuse.sh`, `scripts/deploy-adapter.sh`, `docs/MLX_PROJECT_SPEC.md`
- Current mitigation: Adapter actions are mapped through a small TypeScript action table in `lib/adapter/run-adapter.ts`.
- Recommendations: Replace shell script dispatch with an inspected allowlisted command registry, validate every path against `MLX_HOME`, reject symlink escapes, and never run destructive filesystem operations on env-derived paths without containment checks.

**Dynamic tool JavaScript lacks device-side validation and runtime limits:**
- Risk: The TypeScript validator gates generated `jsBody` before writing `data/adapter-tools.json`, but the Swift runtime executes bundled tool bodies in `JavaScriptCore` without revalidating the AST, enforcing schema arguments, or applying timeout/memory limits.
- Files: `lib/discovery/validate/parse.ts`, `lib/discovery/validate/sandbox.ts`, `ios/SpecialistApp/ToolRegistry.swift`, `ios/SpecialistApp/DynamicTool.swift`, `data/adapter-tools.json`
- Current mitigation: TypeScript validation uses Acorn deny lists and worker-thread limits; Swift creates a fresh `JSContext` per dispatch and has a default-closed network flag.
- Recommendations: Sign manifests, validate them on load, enforce argument schemas in Swift, add execution timeout/cancellation, and reject any manifest not produced by the trusted validator.

**Model/eval endpoints can send prompts outside the local boundary:**
- Risk: `EVAL_BASE_URL`, `EVAL_TUNED_URL`, and `MLX_SERVER_URL` can point anywhere, with no egress policy, approval prompt, sanitization, or private-task guard.
- Files: `lib/eval/run.ts`, `lib/model.ts`, `src/lib/server-manager.ts`, `src/cli.tsx`, `src/repl.tsx`
- Current mitigation: Defaults point to loopback local model server.
- Recommendations: Add an explicit egress policy, URL allowlist, private-content blocking, and visible local/cloud labels for every eval or model call.

## Performance Bottlenecks

**Deduplication is quadratic and memory-heavy:**
- Problem: MinHash dedupe scans kept signatures with repeated lookups, and embedding dedupe compares each item to all kept embeddings.
- Files: `lib/data/dedupe.ts`, `lib/data/pipeline.ts`
- Cause: In-memory O(n^2) algorithms are acceptable for small demo sets but not for 25k-50k core examples.
- Improvement path: Use LSH buckets, streaming clustering, persisted dedup reports, and DataTrove-style scalable stages for larger corpora.

**High default generation concurrency can overload local inference:**
- Problem: Data generation, judging, eval generation, and discovery default to concurrency around 15 against a local MLX model server.
- Files: `src/lib/config.ts`, `lib/data/pipeline.ts`, `lib/data/qa-worker.ts`, `lib/data/traj-worker.ts`, `lib/data/judge.ts`, `lib/data/eval-gen.ts`
- Cause: The concurrency defaults match API-style fan-out, not a single local Apple Silicon inference server.
- Improvement path: Add adaptive concurrency, model-server backpressure, queue metrics, retries with jitter, and a single job system with heartbeats.

**Long operations are not resumable as jobs:**
- Problem: The pipeline has checkpoints for generated examples, but no catalog, leased jobs, input hashes, cancellation state, recovery, or idempotent stage reuse.
- Files: `lib/data/checkpoint.ts`, `lib/data/pipeline.ts`, `lib/training/run-training.ts`, `src/commands/pipeline.ts`, `docs/MLX_PROJECT_SPEC.md`
- Cause: Stage orchestration is a direct in-process sequence.
- Improvement path: Introduce SQLite-backed jobs, manifests, input fingerprints, leases, heartbeats, and per-stage recovery before repository-scale processing.

## Fragile Areas

**Split and leakage model is chunk-based instead of task/repository-based:**
- Files: `lib/data/split.ts`, `lib/data/emit-jsonl.ts`, `lib/data/pipeline.ts`, `data/split.manifest.json`, `docs/MLX_DATASET_CONTRACT.md`
- Why fragile: The split hash is deterministic, but the unit is a documentation chunk. It does not preserve `task_group_id`, temporal holdouts, whole-repository holdouts, sibling-example isolation, or cross-split similarity audits.
- Safe modification: Replace chunk splitting with a task-group split manifest that records repository, time, reason, deterministic hash, and holdout assignment.
- Test coverage: `lib/data/split.test.ts` covers the 70/30 chunk split only; it does not cover repository/task leakage.

**Quality judging is self-referential and mislabeled:**
- Files: `lib/data/judge.ts`, `lib/model.ts`, `lib/data/pipeline.ts`
- Why fragile: Comments and score fields describe external judges, but `judgeExample` calls `getModel()` for both primary and secondary labels. Generator and judge can be the same local model, so anti-leakage and independent quality claims are weak.
- Safe modification: Make judge provider/model IDs explicit in artifacts, enforce generator-vs-judge separation when enabled, and label local self-judging as a lower-confidence heuristic.
- Test coverage: `lib/data/judge.test.ts` mocks model output; it does not prove provider separation or calibrated quality.

**Mutable generated manifests are used as test fixtures and runtime contracts:**
- Files: `data/adapter-tools.json`, `data/adapter-tools.fallback.json`, `lib/data/schema-gate.ts`, `lib/discovery/manifest.ts`, `lib/data/schema-gate.test.ts`
- Why fragile: Tests and runtime validation read `data/adapter-tools.json`, but discovery can overwrite it. This creates test nondeterminism and makes a generated artifact part of source-level correctness.
- Safe modification: Keep committed fixtures under `fixtures/`, write generated manifests under `MLX_HOME`, and inject manifest paths into tests and runtime.
- Test coverage: The current failing `lib/data/schema-gate.test.ts` demonstrates drift between test expectations and committed manifest content.

**Configuration silently ignores malformed JSON and invalid local files:**
- Files: `src/lib/config.ts`, `src/lib/config.test.ts`
- Why fragile: `readJsonSafe` returns `{}` for any parse/read error, so an invalid config can silently fall back to defaults.
- Safe modification: Report config parse errors through `mlx doctor` and fail closed for project config unless the operator explicitly ignores it.
- Test coverage: `src/lib/config.test.ts` covers defaults and overrides, not invalid-config diagnostics.

**Process termination is best-effort only:**
- Files: `lib/server/processes.ts`, `lib/training/run-training.ts`, `lib/adapter/run-adapter.ts`, `src/lib/server-manager.ts`
- Why fragile: Termination sends `SIGTERM` only, has no timeout escalation, and does not clean process groups or orphaned children. `startModelServer` calls `unref`, which can leave a server running after CLI exit paths.
- Safe modification: Track process groups, escalate to `SIGKILL` after a timeout, wait for closure, and record cleanup status in run manifests.
- Test coverage: `lib/training/supervisor.test.ts` and related tests do not exercise orphan cleanup or non-zero process exits.

## Scaling Limits

**No SQLite catalog, migrations, or CAS layer:**
- Current capacity: JSON files under `data/` and in-memory arrays.
- Limit: Repository-scale evidence, metrics, object hashes, provenance, and resumable jobs cannot be queried or recovered reliably.
- Scaling path: Implement `packages/core`, `packages/catalog`, migrations, WAL-mode SQLite, content-addressed objects, and Parquet outputs described in `docs/MLX_PROJECT_SPEC.md`.

**No Hugging Face-native dataset compiler:**
- Current capacity: `data/training.jsonl` and `data/eval.jsonl` chat/tool files.
- Limit: The dataset cannot load through `datasets.load_dataset` with configs such as `profile`, `evidence`, `sft`, `messages`, `preference`, `tools`, `benchmark`, and `public_demo`.
- Scaling path: Build explicit schema modules, Parquet writers, features validation, dataset cards, Croissant metadata, shard checksums, and `mlx dataset validate`.

**Benchmark harness is answer-matching, not repository execution:**
- Current capacity: `lib/eval/run.ts` scores generated Q&A/tool-call items from `data/eval.jsonl`.
- Limit: It cannot measure RepoTaskBench, NavBench, temporal/whole-repo holdouts, patch application, build/test pass, or paired confidence intervals.
- Scaling path: Implement disposable worktrees, allowed checks, patch capture, trace recording, contamination audits, and result manifests from `docs/MLX_BENCHMARK_SPEC.md`.

## Dependencies at Risk

**Floating dependency versions:**
- Risk: `jsonschema` and `zod-to-json-schema` use `latest`, and several core packages use broad caret ranges.
- Impact: Schema generation, validation, and AI SDK behavior can change without code changes.
- Migration plan: Pin exact versions for schema/toolchain packages, add dependency update batches, and record versions in dataset and benchmark manifests.

**MLX-LM shell flags are assumed by scripts:**
- Risk: Training scripts hard-code `mlx_lm` / `mlx_lm_lora.train` flags.
- Impact: Installed CLI changes can break training or silently alter adapter configuration.
- Migration plan: Add preflight commands that inspect installed `--help`, generate compatible args, and record the exact command in run manifests.

## Missing Critical Features

**Repository inventory and privacy selection:**
- Problem: No implementation for `mlx repos scan`, explicit include/exclude/holdout modes, identity normalization, mirrors, or GitHub metadata.
- Blocks: Accurate profile metrics, evidence extraction, repository holdouts, and private-by-default guarantees.

**Metrics, evidence lake, and preference profile:**
- Problem: No deterministic Git metrics, accepted-state evidence records, survival signals, preference aggregation, or evidence-backed profile artifacts.
- Blocks: The core MLX value proposition and prompt profile comparison.

**Studio and presentation labeling:**
- Problem: There is no local Studio app with required views or `LIVE`/`REPLAY`/`FIXTURE` presentation labels.
- Blocks: Honest presentation mode and operator inspection workflows.

**Publication gates and Hub upload path:**
- Problem: There is no `mlx dataset push --private`, upload preview, license policy, checksummed release manifest, or public-demo sanitizer.
- Blocks: Safe Hugging Face integration and private/default publishing.

## Test Coverage Gaps

**Security/privacy gates:**
- What's not tested: Secret scanning, PII scanning, path traversal, symlink escape, shell argument safety, unsafe archive extraction, private-content egress, and raw credential logging.
- Files: `lib/data/emit-jsonl.ts`, `lib/data/checkpoint.ts`, `lib/training/run-training.ts`, `lib/adapter/run-adapter.ts`, `ios/SpecialistApp/ToolRegistry.swift`, `scripts/fuse.sh`
- Risk: Private repository content or credentials can enter artifacts or leave the machine unnoticed.
- Priority: High

**Dataset contract validation:**
- What's not tested: Hugging Face `Features`, Parquet readability, config/split loading, row sizes, object references, duplicate IDs, task-group integrity, leakage, Croissant metadata, and dataset card completeness.
- Files: `lib/data/types.ts`, `lib/data/emit-jsonl.ts`, `lib/data/pipeline.ts`, `docs/MLX_DATASET_CONTRACT.md`
- Risk: Dataset artifacts can appear usable while failing the canonical MLX contract.
- Priority: High

**Benchmark execution harness:**
- What's not tested: Disposable worktree creation, allowed check execution, patch application, cleanup after crash, paired statistics, and contamination audits.
- Files: `lib/eval/run.ts`, `lib/eval/types.ts`, `docs/MLX_BENCHMARK_SPEC.md`
- Risk: Evaluation scores can overstate model quality and miss leakage.
- Priority: High

**Verification status:**
- What's not tested: `bun run typecheck` passes. `bun run test` fails on `lib/data/schema-gate.test.ts`. `bun run check` fails because `.next/` is scanned by Biome. Required scripts `test:integration`, `studio:build`, `dataset:validate`, `benchmark:smoke`, and `local:check` are not present.
- Files: `package.json`, `biome.json`, `lib/data/schema-gate.test.ts`, `.next/`
- Risk: The repo has no green baseline for the mandated acceptance gates.
- Priority: High

---

*Concerns audit: 2026-07-15*
