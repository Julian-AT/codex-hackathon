# Codebase Structure

**Analysis Date:** 2026-07-15

## Directory Layout

```text
repository-root/
├── AGENTS.md              # Repository instructions and MLX product constraints
├── README.md              # Existing runbook for the local specialist pipeline
├── package.json           # Bun/TypeScript scripts and dependencies
├── tsconfig.json          # TypeScript config and `@/*` path alias
├── vitest.config.ts       # Vitest test discovery for `lib/` and `src/`
├── biome.json             # Biome lint/format config
├── bun.lock               # Bun dependency lockfile
├── requirements.txt       # Python MLX tooling requirements
├── docs/                  # Authoritative MLX product, dataset, benchmark, and runbook docs
├── src/                   # Operator CLI, Ink REPL, commands, UI components, local app config
├── lib/                   # Pipeline, model, discovery, data, evaluation, training, adapter logic
├── scripts/               # Shell/TS operational scripts for MLX-LM, fuse, deploy, smoke checks
├── ios/                   # Swift iOS runtime and upstream MLX Swift example source
├── data/                  # Generated/cached pipeline artifacts and model/training outputs
└── .planning/             # GSD planning artifacts, including generated codebase maps
```

The target architecture in `docs/MLX_PROJECT_SPEC.md` calls for `apps/`, `packages/`, `python/mlx_dataset/`, `schemas/`, `migrations/`, and `fixtures/`. Those implementation directories are not present in this worktree.

## Directory Purposes

**`docs/`:**
- Purpose: Product and acceptance source of truth.
- Contains: MLX project spec, Hugging Face dataset contract, PersonalBench spec, research rationale, event fast track, presentation runbook.
- Key files: `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`, `docs/MLX_RESEARCH_RATIONALE.md`.

**`src/`:**
- Purpose: Operator-facing CLI, Ink UI shell, command modules, and local config/conversation helpers.
- Contains: `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, `src/commands/`, `src/components/`, `src/lib/`.
- Key files: `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, `src/commands/index.ts`.

**`src/commands/`:**
- Purpose: Slash commands and one-shot command implementations.
- Contains: One file per command plus registry/tests.
- Key files: `src/commands/index.ts`, `src/commands/pipeline.ts`, `src/commands/discover.ts`, `src/commands/data-gen.ts`, `src/commands/train.ts`, `src/commands/eval.ts`, `src/commands/serve.ts`.

**`src/components/`:**
- Purpose: Ink React components for terminal UI.
- Contains: Prompt, message list, status bar, log view, train view, pipeline view, streaming text.
- Key files: `src/components/input-prompt.tsx`, `src/components/message-list.tsx`, `src/components/status-bar.tsx`, `src/components/pipeline-view.tsx`, `src/components/train-view.tsx`.

**`src/lib/`:**
- Purpose: CLI-local helpers that know about operator config, REPL context, conversation streaming, and model server process lifecycle.
- Contains: Config loader, context store, conversation streamer, server manager, tests.
- Key files: `src/lib/config.ts`, `src/lib/server-manager.ts`, `src/lib/conversation.ts`, `src/lib/context-store.ts`.

**`lib/`:**
- Purpose: Domain and runtime logic used by CLI commands.
- Contains: `lib/discovery/`, `lib/data/`, `lib/training/`, `lib/eval/`, `lib/adapter/`, `lib/coordinator/`, `lib/server/`, `lib/streams/`, `lib/workers/`, `lib/tools/`, `lib/model.ts`, `lib/tool-args.ts`.
- Key files: `lib/model.ts`, `lib/discovery/pipeline.ts`, `lib/data/pipeline.ts`, `lib/training/run-training.ts`, `lib/eval/run.ts`, `lib/adapter/run-adapter.ts`.

**`lib/discovery/`:**
- Purpose: Corpus fetching/chunking and dynamic tool design/validation/manifest emission.
- Contains: Corpus loader, prompt builder, swarm orchestration, worker, dedupe, manifest writer, validation gates, tests and fixtures.
- Key files: `lib/discovery/corpus.ts`, `lib/discovery/pipeline.ts`, `lib/discovery/worker.ts`, `lib/discovery/manifest.ts`, `lib/discovery/types.ts`, `lib/discovery/validate/index.ts`.

**`lib/discovery/validate/`:**
- Purpose: Gate generated JS tool bodies before they land in `data/adapter-tools.json`.
- Contains: Schema validation, AST/deny-list parsing, worker-thread sandbox, fuzzing, trajectory replay, tests.
- Key files: `lib/discovery/validate/schema.ts`, `lib/discovery/validate/parse.ts`, `lib/discovery/validate/sandbox.ts`, `lib/discovery/validate/sandbox.worker.mjs`, `lib/discovery/validate/fuzz.ts`, `lib/discovery/validate/trajectory.ts`.

**`lib/data/`:**
- Purpose: Generate, judge, deduplicate, stratify, split, and emit JSONL training/evaluation data.
- Contains: Types, personas, prompts, QA/traj/eval workers, checkpoint writer, embedding helper, split logic, schema gate, JSONL emitter, tests and fixtures.
- Key files: `lib/data/pipeline.ts`, `lib/data/types.ts`, `lib/data/split.ts`, `lib/data/emit-jsonl.ts`, `lib/data/qa-worker.ts`, `lib/data/traj-worker.ts`, `lib/data/judge.ts`, `lib/data/eval-gen.ts`.

**`lib/training/`:**
- Purpose: Run and supervise MLX-LM training flows.
- Contains: Subprocess runner, supervisor, checkpoint rollback, GRPO JSONL transform, tests.
- Key files: `lib/training/run-training.ts`, `lib/training/supervisor.ts`, `lib/training/rollback.ts`, `lib/training/transformGrpoJsonl.ts`.

**`lib/eval/`:**
- Purpose: Local evaluation harness for generated eval rows.
- Contains: Eval runner and result types.
- Key files: `lib/eval/run.ts`, `lib/eval/types.ts`.

**`lib/adapter/`:**
- Purpose: Invoke allowlisted adapter fuse/deploy scripts.
- Contains: Adapter action runner.
- Key files: `lib/adapter/run-adapter.ts`.

**`lib/server/`:**
- Purpose: Shared subprocess and error utilities.
- Contains: Child process registry and error formatting.
- Key files: `lib/server/processes.ts`, `lib/server/errors.ts`.

**`lib/coordinator/` and `lib/workers/`:**
- Purpose: Prototype coordinator/worker agent pattern.
- Contains: Coordinator agent, spawn-worker tool, worker roles, task notification types.
- Key files: `lib/coordinator/coordinator.ts`, `lib/coordinator/spawnWorker.ts`, `lib/workers/roles.ts`.

**`lib/streams/`:**
- Purpose: Parse streaming training output.
- Contains: Train parser and tests.
- Key files: `lib/streams/trainParser.ts`.

**`lib/tools/`:**
- Purpose: Static/fallback handwritten tools.
- Contains: Handwritten tool specs and tests.
- Key files: `lib/tools/hand-written-supabase.ts`.

**`scripts/`:**
- Purpose: Operational shell and TypeScript scripts invoked by CLI wrappers or used manually.
- Contains: MLX-LM training, GRPO, adapter fuse/deploy, iOS bootstrap/deploy/verify, smoke and benchmark scripts.
- Key files: `scripts/train.sh`, `scripts/grpo.sh`, `scripts/fuse.sh`, `scripts/deploy-adapter.sh`, `scripts/verify-device.sh`, `scripts/smoke-pipeline.ts`, `scripts/build-grpo-jsonl.ts`.

**`ios/SpecialistApp/`:**
- Purpose: Swift iOS runtime for local model/adapters and dynamic tools.
- Contains: SwiftUI views, model state, adapter loader, tool parser, tool registry, network monitor, tests.
- Key files: `ios/SpecialistApp/ModelState.swift`, `ios/SpecialistApp/ChatView.swift`, `ios/SpecialistApp/GemmaToolParser.swift`, `ios/SpecialistApp/ToolRegistry.swift`, `ios/SpecialistApp/AdapterToolsLoader.swift`, `ios/SpecialistApp/DynamicTool.swift`.

**`ios/_upstream/`:**
- Purpose: Upstream MLX Swift examples and support files used by the iOS runtime.
- Contains: Swift package/project content under `ios/_upstream/`.
- Key files: `ios/_upstream/mlx-swift-examples.xcodeproj`.

**`data/`:**
- Purpose: Generated pipeline artifacts and training/model state.
- Contains: Cached corpus, tool manifests, training/eval JSONL, checkpoints, adapters, benchmark state.
- Key files: `data/corpus.json`, `data/adapter-tools.json`, `data/adapter-tools.fallback.json`.
- Generated: Yes.
- Committed: Some files are present in the worktree; treat generated/private model outputs as non-source artifacts.

**`.planning/`:**
- Purpose: GSD planning and codebase intelligence artifacts.
- Contains: Codebase maps, phase plans, research notes.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `src/cli.tsx`: Bun executable entry point for interactive REPL, one-shot stages, and standalone model server.
- `src/repl.tsx`: Interactive Ink application and slash-command dispatch.
- `src/app-oneshot.tsx`: One-shot Ink app for stage commands.
- `src/commands/pipeline.ts`: REPL full-pipeline command.
- `scripts/train.sh`: SFT training script invoked by `lib/training/run-training.ts`.
- `scripts/grpo.sh`: GRPO training script invoked by `lib/training/run-training.ts`.
- `ios/SpecialistApp/ChatView.swift`: iOS chat/tool UI entry surface.

**Configuration:**
- `package.json`: Bun scripts, TypeScript dependencies, and package metadata.
- `tsconfig.json`: Strict TypeScript settings and `@/*` path alias to repository root.
- `vitest.config.ts`: Test file patterns and `@` alias resolution.
- `biome.json`: Formatter/linter rules.
- `requirements.txt`: Python MLX-LM package requirements.
- `.env.example`: Example environment configuration; do not read or copy `.env.local`.
- `src/lib/config.ts`: Runtime config schema, default values, user/project config paths, env overrides.

**Core Logic:**
- `lib/model.ts`: Local OpenAI-compatible model provider.
- `src/lib/server-manager.ts`: Starts and health-checks `mlx_lm.server`.
- `lib/discovery/pipeline.ts`: Tool discovery pipeline orchestrator.
- `lib/discovery/validate/index.ts`: Tool validation gate sequence.
- `lib/data/pipeline.ts`: Data generation orchestrator.
- `lib/data/emit-jsonl.ts`: Training/eval JSONL artifact writer and source-overlap checker.
- `lib/eval/run.ts`: Eval harness.
- `lib/training/run-training.ts`: Training subprocess wrapper.
- `lib/training/supervisor.ts`: Training stability supervisor.
- `lib/adapter/run-adapter.ts`: Adapter fuse/deploy subprocess wrapper.

**Contracts and Types:**
- `lib/discovery/types.ts`: Corpus, chunk, dynamic tool, and validation result types.
- `lib/data/types.ts`: Tool call, chat message, training example, judge score, eval item, and data-gen metadata types.
- `src/commands/index.ts`: Command and command-context types.
- `lib/eval/types.ts`: Eval summary/result types.
- `ios/SpecialistApp/DynamicTool.swift`: Swift representation of dynamic tools and JSON values.

**Testing:**
- `vitest.config.ts`: Includes `lib/**/*.test.ts`, `lib/**/*.spec.ts`, and `src/**/*.test.ts`.
- `lib/discovery/validate/*.test.ts`: Tool validation gate tests.
- `lib/data/*.test.ts`: Data split, dedupe, schema, emit, judge, and worker tests.
- `lib/training/*.test.ts`: Training transform, supervisor, and rollback tests.
- `src/commands/*.test.ts`: Command registry/command behavior tests.
- `src/lib/*.test.ts`: Config, context store, and conversation tests.
- `ios/SpecialistApp/GemmaToolParserTests.swift`: Swift parser unit tests.

**Generated Artifacts:**
- `data/corpus.json`: Cached external corpus.
- `data/adapter-tools.json`: Validated dynamic tool manifest.
- `data/adapter-tools.fallback.json`: Fallback tool manifest copied on discovery kill-point.
- `data/split.manifest.json`: Deterministic split manifest emitted by `lib/data/split.ts`.
- `data/training.jsonl`: MLX-LM training JSONL emitted by `lib/data/emit-jsonl.ts`.
- `data/eval.jsonl`: Evaluation JSONL emitted by `lib/data/emit-jsonl.ts`.
- `.next/`: Generated Next.js build/cache output present in the worktree.

**Not Detected:**
- `apps/`: Not detected.
- `packages/`: Not detected.
- `python/mlx_dataset/`: Not detected.
- `schemas/`: Not detected.
- `migrations/`: Not detected.
- SQLite catalog implementation: Not detected.
- Parquet/Hugging Face dataset compiler implementation: Not detected.
- Local Studio application matching `docs/MLX_PROJECT_SPEC.md`: Not detected.

## Naming Conventions

**Files:**
- CLI and module files use kebab-case for multiword names: `src/app-oneshot.tsx`, `src/lib/server-manager.ts`, `lib/training/run-training.ts`, `lib/streams/trainParser.ts` is an exception using camelCase for parser naming.
- Test files are colocated and named `*.test.ts` or `*.test.tsx`: `lib/data/split.test.ts`, `src/lib/config.test.ts`.
- Swift files use PascalCase matching primary types/views: `ModelState.swift`, `ToolRegistry.swift`, `GemmaToolParser.swift`.
- Shell scripts use kebab-case: `scripts/deploy-adapter.sh`, `scripts/smoke-pipeline.ts`.

**Directories:**
- Source domain directories use lowercase singular/plural names by function: `lib/discovery/`, `lib/data/`, `lib/training/`, `src/commands/`, `src/components/`.
- Validation submodules live under `lib/discovery/validate/`.
- Generated data is grouped under `data/` by artifact purpose: `data/training/`, `data/checkpoints/`, `data/bench/`.

**Exports and Imports:**
- Use named exports for shared functions/types in `lib/` and `src/lib/`.
- Command modules default-export a `Command` object from `src/commands/<name>.ts`.
- Use the `@/*` alias for root-relative TypeScript imports from `lib/` or cross-tree references, as configured in `tsconfig.json`.
- Use relative imports inside tightly coupled folders such as `lib/data/` and `lib/discovery/`.

## Where to Add New Code

**New CLI Command:**
- Implementation: `src/commands/<name>.ts`
- Registry entry: `src/commands/index.ts`
- UI component, if needed: `src/components/<name>-view.tsx`
- Tests: `src/commands/<name>.test.ts` or `src/commands/index.test.ts`
- Keep domain work in `lib/<domain>/`; command modules should orchestrate and render/log.

**New Pipeline Stage in Existing Layout:**
- Domain code: `lib/<stage>/`
- Command wrapper: `src/commands/<stage>.ts`
- Pipeline wiring: `src/commands/pipeline.ts` and `src/app-oneshot.tsx`
- Tests: `lib/<stage>/*.test.ts` plus command coverage in `src/commands/`.
- Prefer extracting shared orchestration into `lib/` when both REPL and one-shot paths need the same flow.

**New Discovery Gate:**
- Implementation: `lib/discovery/validate/<gate>.ts`
- Gate order wiring: `lib/discovery/validate/index.ts`
- Types, if needed: `lib/discovery/types.ts`
- Tests: `lib/discovery/validate/<gate>.test.ts`

**New Data Generator or Filter:**
- Implementation: `lib/data/<feature>.ts`
- Pipeline wiring: `lib/data/pipeline.ts`
- Shared row types: `lib/data/types.ts`
- Tests: `lib/data/<feature>.test.ts`
- Preserve source chunk provenance and split isolation through `DataGenMeta` and `verifyNoOverlap`.

**New Training Behavior:**
- TypeScript wrapper/supervision: `lib/training/`
- Shell entrypoint: `scripts/<name>.sh`
- Stream parsing: `lib/streams/trainParser.ts` when stdout format changes.
- Tests: `lib/training/*.test.ts` and `lib/streams/*.test.ts`
- Keep shell commands allowlisted and invoked through wrapper modules.

**New Evaluation Behavior:**
- Implementation: `lib/eval/`
- Input row changes: `lib/data/types.ts` and `lib/data/emit-jsonl.ts`
- Command integration: `src/commands/eval.ts`
- Tests: `lib/eval/*.test.ts` if new scoring logic is introduced.

**New iOS Runtime Feature:**
- Swift model/runtime logic: `ios/SpecialistApp/`
- Tool manifest shape changes: coordinate with `lib/discovery/types.ts`, `lib/discovery/manifest.ts`, and `ios/SpecialistApp/AdapterToolsLoader.swift`
- Parser tests: `ios/SpecialistApp/GemmaToolParserTests.swift` or a new Swift test file.

**New MLX Product Subsystem from the Authoritative Spec:**
- Use target directories from `docs/MLX_PROJECT_SPEC.md` instead of expanding root `lib/` indefinitely.
- CLI app: `apps/cli/`
- Studio app: `apps/studio/`
- Loopback API: `apps/local-api/`
- Shared TypeScript packages: `packages/<domain>/`
- Python dataset compiler: `python/mlx_dataset/`
- Versioned schemas: `schemas/`
- SQLite migrations: `migrations/`
- Synthetic/live-safe fixtures: `fixtures/`

**Utilities:**
- CLI-local utility: `src/lib/<name>.ts`
- Domain utility: `lib/<domain>/<name>.ts`
- Cross-domain runtime utility: `lib/server/`, `lib/streams/`, or a future `packages/core/` boundary.

## Special Directories

**`data/`:**
- Purpose: Generated manifests, cached corpus, JSONL datasets, checkpoints, adapters, and benchmark state.
- Generated: Yes.
- Committed: Partially present in worktree. Do not add private datasets, models, adapters, tokens, or raw traces.

**`.next/`:**
- Purpose: Generated Next.js build/cache output.
- Generated: Yes.
- Committed: Should be treated as generated output.

**`.venv/`:**
- Purpose: Local Python virtual environment.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: Installed JavaScript dependencies.
- Generated: Yes.
- Committed: No.

**`ios/_upstream/`:**
- Purpose: Upstream MLX Swift examples and support project.
- Generated: No.
- Committed: Present as vendored/upstream source; avoid editing unless iOS integration explicitly requires it.

**`.planning/`:**
- Purpose: Planning, codebase mapping, and phase artifacts.
- Generated: Yes.
- Committed: Project-dependent; only write assigned planning documents during codebase mapping.

**`.env.local`:**
- Purpose: Local environment configuration.
- Generated: Operator-specific.
- Committed: No. Existence only is noted; contents must not be read or quoted.

---

*Structure analysis: 2026-07-15*
