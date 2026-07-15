<!-- refreshed: 2026-07-15 -->
# Architecture

**Analysis Date:** 2026-07-15

## System Overview

MLX — the personal coding dataset and model pipeline is specified in `docs/MLX_PROJECT_SPEC.md` as a local-first dataset, metrics, preference, benchmark, training, and Studio system. The implemented repository is a Bun/TypeScript operator CLI and local MLX-LM pipeline with a Swift iOS runtime. The current source layout is root-level `src/` and `lib/`, not the target `apps/` and `packages/` workspace layout described in `docs/MLX_PROJECT_SPEC.md`.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Operator Surfaces                         │
├──────────────────┬──────────────────┬───────────────────────┤
│ Ink CLI entry    │ Ink REPL          │ One-shot stage UI     │
│ `src/cli.tsx`    │ `src/repl.tsx`    │ `src/app-oneshot.tsx` │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Command and Stage Layer                     │
│ `src/commands/` + `src/components/`                          │
└────────┬──────────────────┬─────────────────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌────────────────┬────────────────┬───────────────────────────┐
│ Discovery      │ Data/Eval      │ Training + Adapter Ops     │
│ `lib/discovery`│ `lib/data`     │ `lib/training`, `lib/eval`,│
│                │                │ `lib/adapter`              │
└────────┬───────┴────────┬───────┴──────────────┬────────────┘
         │                │                      │
         ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Shared Runtime Services                                      │
│ local model client `lib/model.ts`, model server manager       │
│ `src/lib/server-manager.ts`, subprocess helpers `lib/server/`│
└────────┬───────────────────────┬────────────────────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ Local Artifacts              │ │ iOS Offline Runtime         │
│ `data/`, `scripts/`          │ │ `ios/SpecialistApp/`        │
└──────────────────────────────┘ └────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI entry | Parses process args, starts interactive REPL or one-shot command mode, optionally starts `mlx_lm.server`. | `src/cli.tsx` |
| Interactive REPL | Maintains Ink chat UI, model-server lifecycle, slash command dispatch, transient context, cancellation, and streaming assistant output. | `src/repl.tsx` |
| One-shot app | Runs `pipeline`, `discover`, `data-gen`, `train`, `eval`, `fuse`, and `deploy` as Ink one-shot flows. | `src/app-oneshot.tsx` |
| Command registry | Defines command context, aliases, lazy command loading, completions, and slash-input parsing. | `src/commands/index.ts` |
| Configuration | Loads typed defaults, environment overrides, and project/user settings into a Zod-validated config object. | `src/lib/config.ts` |
| Model server manager | Spawns and health-checks local `python -m mlx_lm.server`. | `src/lib/server-manager.ts` |
| Local model client | Wraps the OpenAI-compatible local MLX-LM endpoint for AI SDK calls. | `lib/model.ts` |
| Discovery pipeline | Designs, deduplicates, validates, and persists dynamic tool specs. | `lib/discovery/pipeline.ts` |
| Tool validation gates | Enforces schema, AST deny-list, sandbox, fuzz, and trajectory gates for generated tool bodies. | `lib/discovery/validate/index.ts` |
| Data pipeline | Generates QA and tool trajectories, judges them, deduplicates, stratifies, emits training/eval JSONL, and checks source overlap. | `lib/data/pipeline.ts` |
| Evaluation harness | Loads `data/eval.jsonl`, queries base/tuned endpoints and local teacher model, and scores exact text/tool-call behavior. | `lib/eval/run.ts` |
| Training runner | Wraps SFT/GRPO shell scripts, streams parsed training points, supervises rollback/abort conditions, and terminates children. | `lib/training/run-training.ts` |
| Adapter operations | Runs allowlisted fuse/deploy shell scripts with bounded log lines and abort handling. | `lib/adapter/run-adapter.ts` |
| Coordinator prototype | Creates a coordinator agent whose only tool delegates to typed worker roles. | `lib/coordinator/coordinator.ts` |
| iOS runtime | Loads MLX model/adapters, parses tool calls, executes registered JS tools, and presents SwiftUI verification views. | `ios/SpecialistApp/` |

## Pattern Overview

**Overall:** Local pipeline orchestrator with command-driven stage boundaries and file-based artifacts.

**Key Characteristics:**
- Use `src/` for operator UI, command context, and CLI lifecycle; keep pipeline implementation under `lib/`.
- Use dynamic imports in `src/commands/*.ts` so command modules load only when invoked.
- Use local files in `data/` as stage contracts: `data/corpus.json`, `data/adapter-tools.json`, `data/split.manifest.json`, `data/training.jsonl`, and `data/eval.jsonl`.
- Use `AbortSignal` through command and pipeline boundaries for cancellation.
- Use fixed shell scripts in `scripts/` for MLX-LM training, adapter fuse, deploy, and smoke flows.
- Use TypeScript interfaces and Zod/AJV validation at package-like boundaries, but no generated `schemas/` directory is present.

## Layers

**Operator UI Layer:**
- Purpose: Present CLI/REPL state and route operator actions.
- Location: `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, `src/components/`
- Contains: Ink React components, command dispatch, local context, server status, progress rendering.
- Depends on: `src/commands/`, `src/lib/config.ts`, `src/lib/server-manager.ts`, selected `lib/` stage modules.
- Used by: `bun src/cli.tsx` and `bun start`.

**Command Layer:**
- Purpose: Convert slash commands or one-shot commands into typed stage calls.
- Location: `src/commands/`
- Contains: Command registry, command modules, aliases, command context API.
- Depends on: `src/lib/`, `src/components/`, and domain modules in `lib/`.
- Used by: `src/repl.tsx` and `src/app-oneshot.tsx`.

**Discovery Layer:**
- Purpose: Fetch/chunk external documentation corpus, generate dynamic tool specs, validate tool bodies, and persist the tool manifest.
- Location: `lib/discovery/`
- Contains: Corpus fetch/cache, prompt construction, tool-design workers, swarm fan-out, dedupe, manifest writing, validation gates.
- Depends on: Local model provider `lib/model.ts`, AI SDK, Zod, AJV, Acorn, worker threads.
- Used by: `src/commands/discover.ts`, `src/commands/pipeline.ts`, and `src/app-oneshot.tsx`.

**Data Generation Layer:**
- Purpose: Build MLX-LM training/eval JSONL from corpus chunks and validated tool schemas.
- Location: `lib/data/`
- Contains: Deterministic split, QA generation, trajectory generation, judging, MinHash/cosine dedupe, stratification, JSONL emission, overlap check.
- Depends on: `lib/discovery/types.ts`, `data/adapter-tools.json`, local model provider, Hugging Face Transformers embeddings.
- Used by: `src/commands/data-gen.ts`, `src/commands/pipeline.ts`, and `src/app-oneshot.tsx`.

**Evaluation Layer:**
- Purpose: Compare base, tuned, and teacher responses against generated eval items.
- Location: `lib/eval/`
- Contains: Eval item loading, endpoint querying, text normalization, tool-call canonicalization, summary scoring.
- Depends on: `data/eval.jsonl`, local model provider, optional `EVAL_BASE_URL` and `EVAL_TUNED_URL`.
- Used by: `src/commands/eval.ts`, `src/commands/pipeline.ts`, and `src/app-oneshot.tsx`.

**Training Layer:**
- Purpose: Execute MLX-LM SFT/GRPO jobs and recover from unstable training signals.
- Location: `lib/training/`, `lib/streams/`, `scripts/train.sh`, `scripts/grpo.sh`
- Contains: Subprocess wrapper, train-line parser, supervisor, checkpoint rollback, GRPO transform.
- Depends on: Shell scripts, Python MLX-LM environment, adapter directory under `data/training/`.
- Used by: `src/commands/train.ts`, `src/commands/pipeline.ts`, and `src/app-oneshot.tsx`.

**Adapter and Device Layer:**
- Purpose: Fuse adapters, deploy to iPhone, and verify offline device behavior.
- Location: `lib/adapter/`, `scripts/fuse.sh`, `scripts/deploy-adapter.sh`, `scripts/ios-*.sh`, `ios/SpecialistApp/`
- Contains: Allowlisted adapter actions, Swift model state, adapter loader, tool registry, parser, SwiftUI verification screens.
- Depends on: Xcode/device tooling, MLX Swift packages under `ios/_upstream/`, local adapter artifacts.
- Used by: `src/commands/fuse.ts`, `src/commands/deploy.ts`, `src/app-oneshot.tsx`, and the iOS app.

**Target MLX Architecture Contract:**
- Purpose: Authoritative architecture to converge on for the product contract.
- Location: `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`
- Contains: Required `apps/`, `packages/`, `python/`, `schemas/`, `migrations/`, SQLite catalog, Parquet/Hugging Face compiler, PersonalBench, Studio, and privacy gates.
- Depends on: Explicit repository selection, deterministic Git metrics, content-addressed objects, SQLite migrations, Parquet/Arrow.
- Used by: Future architecture work. No `apps/`, `packages/`, `python/mlx_dataset/`, `schemas/`, or `migrations/` implementation directories are present in this worktree.

## Data Flow

### Primary CLI Pipeline Path

1. Operator invokes the CLI (`src/cli.tsx:49`).
2. CLI chooses interactive REPL or validates one-shot command (`src/cli.tsx:58`, `src/cli.tsx:69`).
3. CLI starts or reuses local `mlx_lm.server` unless `--no-serve` is passed (`src/cli.tsx:113`).
4. Pipeline command starts the model server if needed and initializes stage UI (`src/commands/pipeline.ts:10`, `src/commands/pipeline.ts:19`).
5. Discovery fetches corpus chunks and runs the tool-design/validation pipeline (`src/commands/pipeline.ts:40`, `lib/discovery/pipeline.ts:35`).
6. Discovery writes validated tools to `data/adapter-tools.json` (`lib/discovery/manifest.ts:6`, `lib/discovery/manifest.ts:18`).
7. Data generation loads corpus, split manifest, and tools (`lib/data/pipeline.ts:76`, `lib/data/pipeline.ts:86`).
8. Data generation runs QA and trajectory generation in parallel, judges examples, deduplicates, stratifies, and emits JSONL (`lib/data/pipeline.ts:93`, `lib/data/pipeline.ts:121`, `lib/data/pipeline.ts:130`, `lib/data/pipeline.ts:187`).
9. Training runs `scripts/train.sh` through `runTraining` and streams parsed progress (`src/commands/pipeline.ts:67`, `lib/training/run-training.ts:23`).
10. Evaluation loads `data/eval.jsonl` and scores base/tuned/teacher variants (`lib/eval/run.ts:175`).
11. Adapter fuse runs `scripts/fuse.sh` through the adapter action wrapper (`src/commands/pipeline.ts:99`, `lib/adapter/run-adapter.ts:17`).

### Interactive REPL Path

1. No command starts `Repl` (`src/cli.tsx:60`).
2. `Repl` initializes config, transient context, message state, and model-server health checks (`src/repl.tsx:29`, `src/repl.tsx:39`, `src/repl.tsx:66`).
3. Plain text input streams through `streamConversation` (`src/repl.tsx:204`, `src/lib/conversation.ts:62`).
4. Slash commands load command modules from the registry and receive a `CommandContext` (`src/repl.tsx:249`, `src/commands/index.ts:13`).
5. Commands update shared transient context keys such as `lastDiscovery`, `lastDataGen`, `lastTraining`, and `lastEval` (`src/repl.tsx:270`, `src/commands/status.ts:14`).

### Discovery Tool Validation Flow

1. `fetchCorpus` loads `data/corpus.json` or fetches three documentation sources (`lib/discovery/corpus.ts:39`).
2. `designToolsSwarm` partitions chunks across tool-design workers (`lib/discovery/swarm.ts:17`).
3. `toolDesignWorker` requests structured tool candidates from the local model and normalizes them to `DynamicToolSpec` (`lib/discovery/worker.ts:88`).
4. `runDiscoveryPipeline` deduplicates by normalized name (`lib/discovery/pipeline.ts:43`).
5. Each spec passes schema, parse, sandbox, fuzz, and trajectory gates (`lib/discovery/validate/index.ts:8`).
6. Valid survivors are capped and written to the manifest; too few survivors copy the fallback manifest and throw a kill-point error (`lib/discovery/pipeline.ts:101`, `lib/discovery/pipeline.ts:108`).

### Data Generation Flow

1. Corpus is split by deterministic chunk hash and optionally persisted (`lib/data/split.ts:77`).
2. The tool manifest is loaded from `data/adapter-tools.json` (`lib/data/pipeline.ts:86`).
3. QA and trajectory workers generate examples concurrently (`lib/data/pipeline.ts:95`).
4. Jury judging filters accepted examples (`lib/data/pipeline.ts:121`).
5. MinHash dedupe and embedding cosine dedupe remove near-duplicates (`lib/data/pipeline.ts:130`, `lib/data/pipeline.ts:146`).
6. Stratification checks minimum examples per tool (`lib/data/pipeline.ts:176`).
7. `emitTrainingJsonl` strips tool `meta` and writes MLX-LM-compatible lines (`lib/data/emit-jsonl.ts:60`).
8. `generateEvalSet` and `emitEvalJsonl` produce eval rows, then `verifyNoOverlap` checks source chunk separation (`lib/data/pipeline.ts:192`, `lib/data/emit-jsonl.ts:101`).

### Training and Rollback Flow

1. `runTraining` spawns `scripts/train.sh` for SFT or `scripts/grpo.sh` for GRPO (`lib/training/run-training.ts:43`).
2. `parseTrainLine` extracts loss or reward points from subprocess stdout (`lib/streams/trainParser.ts:12`).
3. `TrainSupervisor` tracks NaN loss, loss spikes, and GRPO reward collapse (`lib/training/supervisor.ts:17`).
4. Supervisor rollback copies the latest numbered adapter checkpoint to `adapters.safetensors` (`lib/training/rollback.ts:10`).
5. Subprocesses are tracked and terminated on abort or before process exit (`lib/server/processes.ts:17`).

### iOS Runtime Flow

1. Adapter artifacts and `adapter-tools.json` are deployed by shell scripts invoked through `lib/adapter/run-adapter.ts`.
2. `AdapterLoaderView` discovers adapter directories containing `adapters.safetensors` and `adapter_config.json` (`ios/SpecialistApp/AdapterLoaderView.swift`).
3. `AdapterToolsLoader` decodes the adapter tool manifest and registers dynamic tools (`ios/SpecialistApp/AdapterToolsLoader.swift`).
4. `ModelState` loads the base model, swaps LoRA adapters, generates text, parses tool calls, and dispatches tools (`ios/SpecialistApp/ModelState.swift`).
5. `GemmaToolParser` extracts `<|tool_call|>` frames (`ios/SpecialistApp/GemmaToolParser.swift`).
6. `ToolRegistry` executes registered JS bodies through `JavaScriptCore` and blocks network-required tools while offline (`ios/SpecialistApp/ToolRegistry.swift`).

**State Management:**
- Persistent generated artifacts are plain files under `data/`.
- Runtime config is loaded from user/project settings paths and environment variables in `src/lib/config.ts`.
- REPL context is in-memory only through `src/lib/context-store.ts`.
- No SQLite catalog, migrations, content-addressed object store, or Parquet evidence lake is implemented in the source tree.

## Key Abstractions

**Command:**
- Purpose: Standard command module shape for REPL and one-shot execution.
- Examples: `src/commands/index.ts`, `src/commands/discover.ts`, `src/commands/pipeline.ts`
- Pattern: `Command` union with `kind: 'action' | 'immediate'`, lazy module loading, `CommandContext` dependency injection.

**ResolvedConfig:**
- Purpose: Typed runtime configuration with defaults and environment overrides.
- Examples: `src/lib/config.ts`, `src/commands/config.ts`
- Pattern: Zod schema parse after deep merge.

**DynamicToolSpec:**
- Purpose: Canonical generated tool shape spanning discovery, data generation, manifest writing, and iOS runtime loading.
- Examples: `lib/discovery/types.ts`, `lib/discovery/worker.ts`, `lib/discovery/manifest.ts`, `ios/SpecialistApp/DynamicTool.swift`
- Pattern: OpenAI function schema plus `meta` sidecar containing JS body, network flag, trajectories, worker provenance, and source chunks.

**PipelineEvent:**
- Purpose: Progress/event contract from domain pipelines to UI.
- Examples: `lib/discovery/pipeline.ts`, `lib/data/pipeline.ts`, `src/app-oneshot.tsx`, `src/commands/pipeline.ts`
- Pattern: Simple discriminated event objects logged or rendered by Ink views.

**TrainingExample and EvalItem:**
- Purpose: JSONL row contracts for MLX-LM training and local evaluation.
- Examples: `lib/data/types.ts`, `lib/data/emit-jsonl.ts`, `lib/eval/run.ts`
- Pattern: TypeScript interfaces serialized as one JSON object per line under `data/`.

**TrainPoint and SupervisorSignal:**
- Purpose: Convert unstructured training subprocess output into stable UI and recovery decisions.
- Examples: `lib/streams/trainParser.ts`, `lib/training/supervisor.ts`, `lib/training/run-training.ts`
- Pattern: Parser emits points; supervisor emits continue/rollback/abort signals.

**ToolRegistry:**
- Purpose: iOS runtime registry for dynamic tools bundled with adapters.
- Examples: `ios/SpecialistApp/ToolRegistry.swift`, `ios/SpecialistApp/AdapterToolsLoader.swift`
- Pattern: Swift registry dispatches JS tool bodies through `JavaScriptCore` with offline policy checks.

## Entry Points

**Operator CLI:**
- Location: `src/cli.tsx`
- Triggers: `bun src/cli.tsx`, `bun start`, `bun src/cli.tsx <command>`.
- Responsibilities: Parse args, start server, render REPL or one-shot app, stop owned server process.

**Interactive command registry:**
- Location: `src/commands/index.ts`
- Triggers: Slash command input from `src/repl.tsx`.
- Responsibilities: Resolve aliases, load command modules, provide completions.

**Full pipeline command:**
- Location: `src/commands/pipeline.ts`
- Triggers: `/pipeline` in REPL.
- Responsibilities: Run discovery, data generation, SFT training, evaluation, and adapter fuse.

**One-shot pipeline app:**
- Location: `src/app-oneshot.tsx`
- Triggers: `bun src/cli.tsx pipeline` or individual one-shot stage names.
- Responsibilities: Render command progress and run the same domain modules outside the REPL command registry.

**Discovery pipeline:**
- Location: `lib/discovery/pipeline.ts`
- Triggers: `discover` command or pipeline stage.
- Responsibilities: Generate, validate, and persist dynamic tool specs.

**Data pipeline:**
- Location: `lib/data/pipeline.ts`
- Triggers: `data-gen` command or pipeline stage.
- Responsibilities: Generate, filter, dedupe, stratify, emit, and validate JSONL training/eval files.

**Training runner:**
- Location: `lib/training/run-training.ts`
- Triggers: `train` command or pipeline stage.
- Responsibilities: Spawn MLX-LM scripts, parse metrics, supervise rollback/abort.

**Evaluation runner:**
- Location: `lib/eval/run.ts`
- Triggers: `eval` command or pipeline stage.
- Responsibilities: Load eval rows and compare model responses.

**Adapter runner:**
- Location: `lib/adapter/run-adapter.ts`
- Triggers: `fuse`, `deploy`, and pipeline fuse stage.
- Responsibilities: Execute allowlisted adapter scripts.

**iOS app runtime:**
- Location: `ios/SpecialistApp/`
- Triggers: Xcode/device launch.
- Responsibilities: Load MLX model/adapters, register tools, parse and execute tool calls, display verification UI.

## Architectural Constraints

- **Threading:** JavaScript runtime is event-loop based; tool sandboxing uses Node worker threads in `lib/discovery/validate/sandbox.ts`; iOS uses Swift async generation in `ios/SpecialistApp/ModelState.swift`.
- **Global state:** `src/repl.tsx` has module-level `msgCounter`; `lib/training/run-training.ts` and `lib/adapter/run-adapter.ts` each create module-level child-process registries; `ios/SpecialistApp/ToolRegistry.swift` exposes `ToolRegistry.shared`.
- **Circular imports:** Not detected in the sampled import graph. Keep `src/` depending on `lib/`, and avoid importing Ink/UI code from `lib/`.
- **Local-only default:** Model calls target `MLX_SERVER_URL` or `http://localhost:8080/v1` through `lib/model.ts`; model serving starts `python -m mlx_lm.server` through `src/lib/server-manager.ts`.
- **File artifact contracts:** `lib/data/pipeline.ts` assumes `data/adapter-tools.json` exists before data generation; `lib/eval/run.ts` assumes `data/eval.jsonl` exists before evaluation.
- **Generated data:** `data/`, `.next/`, and `ios/_upstream/` contain runtime/generated or vendored artifacts. New source code should not depend on generated files unless they are explicit pipeline artifacts.
- **Target architecture gap:** Required MLX components for GitHub inventory, SQLite catalog, migrations, CAS, Parquet/Hugging Face dataset compiler, PersonalBench worktree runner, and Studio are contracts in `docs/` but not implemented as directories.

## Anti-Patterns

### UI-Owned Business Logic

**What happens:** `src/app-oneshot.tsx` contains an independent full-pipeline implementation in addition to `src/commands/pipeline.ts`.
**Why it's wrong:** Stage ordering and error handling can diverge between one-shot and REPL command paths.
**Do this instead:** Put reusable orchestration in a non-UI module under `lib/` and let `src/app-oneshot.tsx` and `src/commands/pipeline.ts` call the same function.

### Direct Data Artifact Coupling

**What happens:** `lib/data/pipeline.ts` reads `data/adapter-tools.json` directly and `lib/eval/run.ts` reads `data/eval.jsonl` directly.
**Why it's wrong:** It hides preconditions and makes future `MLX_HOME` relocation harder.
**Do this instead:** Pass artifact paths through typed config or a storage/path service, following the existing config boundary in `src/lib/config.ts`.

### New Root-Level Monoliths

**What happens:** Root `src/` and `lib/` already carry multiple product responsibilities.
**Why it's wrong:** The product spec requires explicit `apps/`, `packages/`, `python/`, `schemas/`, and `migrations/` boundaries.
**Do this instead:** For new MLX product subsystems, create the target package boundary from `docs/MLX_PROJECT_SPEC.md`; for small changes inside the existing implementation, place UI in `src/commands/` or `src/components/` and pure logic in `lib/<domain>/`.

### Unreviewed Shell Expansion

**What happens:** Training and adapter operations execute shell scripts from wrappers in `lib/training/run-training.ts` and `lib/adapter/run-adapter.ts`.
**Why it's wrong:** The project contract requires deny-by-default shell execution and inspected allowlisted command registries.
**Do this instead:** Keep shell entrypoints fixed and allowlisted; add new subprocess behavior through a registry module under `lib/server/` or a future `packages/runtime/` boundary.

## Error Handling

**Strategy:** Stage functions throw errors to their command/UI caller; command layers catch and render operator-facing messages. Long-running subprocesses are abort-aware and use bounded stderr/log text.

**Patterns:**
- Discovery kill-points use a typed `KillPointError` and fallback manifest copy (`lib/discovery/pipeline.ts`).
- Model server startup converts readiness failures into concise REPL/CLI messages (`src/repl.tsx`, `src/lib/server-manager.ts`).
- Training converts subprocess instability into supervisor signals and rollback/abort actions (`lib/training/supervisor.ts`).
- Adapter steps reject non-zero script exits and sanitize log lines to 400 characters (`lib/adapter/run-adapter.ts`).
- Evaluation marks missing external endpoints unavailable rather than throwing (`lib/eval/run.ts`).

## Cross-Cutting Concerns

**Logging:** UI logging is callback-based through `CommandContext.log` and `PipelineEvent` callbacks. Subprocess stdout/stderr is streamed line-by-line in `lib/training/run-training.ts` and `lib/adapter/run-adapter.ts`.

**Validation:** Runtime validation uses Zod for config and generated tool objects (`src/lib/config.ts`, `lib/discovery/worker.ts`), AJV for JSON Schema validation (`lib/discovery/validate/schema.ts`, `lib/data/schema-gate.ts`), Acorn/deny-list parsing for JS tool bodies (`lib/discovery/validate/parse.ts`), and worker-thread sandbox execution (`lib/discovery/validate/sandbox.ts`).

**Authentication:** No GitHub, Hugging Face, or user identity authentication layer is implemented in source. Local model server calls use an OpenAI-compatible client with a placeholder local API key in `lib/model.ts`.

**Privacy:** The project contracts in `docs/MLX_PROJECT_SPEC.md` and `docs/MLX_DATASET_CONTRACT.md` require local-first storage, explicit publication, secret/PII scanning, and leakage audits. The implemented pipeline has source-overlap checks in `lib/data/emit-jsonl.ts` but does not include the full privacy/export gates.

**Persistence:** The implemented pipeline persists JSON/JSONL artifacts in `data/`. No SQLite migration layer, CAS root, Parquet lake, or Hugging Face dataset compiler is present.

---

*Architecture analysis: 2026-07-15*
