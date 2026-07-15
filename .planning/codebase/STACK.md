# Technology Stack

**Analysis Date:** 2026-07-15

MLX — the personal coding dataset and model pipeline is currently implemented as a local-first Bun/TypeScript CLI with an MLX-LM Python training and serving toolchain plus an iOS Swift runtime. Use the product contract in `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`, and `docs/MLX_RESEARCH_RATIONALE.md` as the target stack direction when adding new technology.

## Languages

**Primary:**
- TypeScript 5.9.3 - strict ESM application code in `src/**/*.ts`, `src/**/*.tsx`, and `lib/**/*.ts`; configured by `tsconfig.json`.
- TSX/React JSX - Ink terminal UI components in `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, and `src/components/*.tsx`.

**Secondary:**
- Bash - operational scripts for MLX-LM setup, training, adapter fusion, benchmarking, and iOS deployment in `scripts/*.sh`.
- Swift - on-device runtime components in `ios/SpecialistApp/*.swift`.
- Python 3.12 - required runtime for MLX-LM command-line tools installed from `requirements.txt`; repository application code invokes Python subprocesses but does not contain first-party Python modules.
- Markdown - product and dataset contracts in `docs/*.md`; these documents are authoritative for the intended MLX architecture.

## Runtime

**Environment:**
- Bun - primary CLI runtime, script runner, and package manager; `package.json` scripts run `bun src/cli.tsx`.
- Node.js >=20 - required by `package.json` `engines.node`; TypeScript code uses Node APIs such as `node:child_process`, `node:fs`, and global `fetch`.
- Python 3.12 virtual environment - created by `scripts/setup-venv.sh`; installs `mlx-lm[train]==0.31.2`, `mlx-lm-lora==0.1.9`, `wandb`, `datasketch`, and `jsonschema` from `requirements.txt`.
- macOS Apple Silicon - required by `docs/MLX_PROJECT_SPEC.md` for MLX-LM training on an Apple M4 Pro 24 GB target.
- iOS 18+ and Xcode 16 - required for the on-device Swift runtime and deployment scripts in `ios/SpecialistApp/` and `scripts/ios-deploy-device.sh`.

**Package Manager:**
- Bun - `bun.lock` is present and should remain the source of locked JavaScript dependency resolution.
- Python packaging uses `uv` when available, with `pip` fallback in `scripts/setup-venv.sh`.
- Lockfile: `bun.lock` present; no committed Python lockfile detected.

## Frameworks

**Core:**
- Ink 5.2.1 + React 18.3.1 - terminal UI framework used by `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, and `src/components/*.tsx`.
- Vercel AI SDK 6.0.168 - model orchestration through `generateText`, `generateObject`, `streamText`, `ToolLoopAgent`, and middleware in `lib/model.ts`, `src/lib/conversation.ts`, `lib/discovery/worker.ts`, `lib/data/*.ts`, `lib/eval/run.ts`, and `lib/coordinator/*.ts`.
- `@ai-sdk/openai-compatible` 2.0.41 - OpenAI-compatible local model provider in `lib/model.ts`.
- MLX-LM 0.31.2 - local model server, SFT LoRA training, and fuse commands invoked by `src/lib/server-manager.ts`, `scripts/train.sh`, `scripts/fuse.sh`, and `scripts/fuse-bench.sh`.
- `mlx-lm-lora` 0.1.9 - GRPO training path invoked by `scripts/grpo.sh` and `scripts/grpo-smoke.sh`.
- MLX Swift / MLXLMCommon / MLXLLM - iOS runtime dependencies imported by `ios/SpecialistApp/ModelState.swift`.
- JavaScriptCore - on-device dynamic tool execution in `ios/SpecialistApp/ToolRegistry.swift`.

**Testing:**
- Vitest 3.2.4 - Node test runner configured by `vitest.config.ts`; test files live under `lib/**/*.test.ts`, `lib/**/*.spec.ts`, and `src/**/*.test.ts`.
- XCTest - Swift parser tests in `ios/SpecialistApp/GemmaToolParserTests.swift`.

**Build/Dev:**
- TypeScript 5.9.3 - type checking through `bun run typecheck` and `tsconfig.json`.
- Biome 1.9.4 - linting and formatting through `bun run check` and `bun run format`; configured by `biome.json`.
- Bun scripts - stable repository commands in `package.json`: `start`, `pipeline`, `test`, `test:watch`, `typecheck`, `check`, and `format`.
- Xcode command-line tools - `xcrun devicectl` is used by `scripts/deploy-adapter.sh` and `scripts/ios-deploy-device.sh`.

## Key Dependencies

**Critical:**
- `ai` 6.0.168 - central abstraction for local model calls and structured generation; use it through `lib/model.ts`.
- `@ai-sdk/openai-compatible` 2.0.41 - connects the AI SDK to `mlx_lm.server` at the OpenAI-compatible `/v1` interface.
- `zod` 3.25.76 - typed configuration and structured-output schemas in `src/lib/config.ts`, `lib/discovery/worker.ts`, `lib/data/qa-prompts.ts`, `lib/data/traj-prompts.ts`, `lib/data/judge.ts`, and `lib/data/eval-gen.ts`.
- `ajv` 8.18.0 - JSON Schema validation for generated tool manifests and calls in `lib/data/schema-gate.ts` and `lib/discovery/validate/schema.ts`.
- `@huggingface/transformers` 3.8.1 - local embedding generation in `lib/data/embed.ts` using `Xenova/all-MiniLM-L6-v2`.
- `gpt-tokenizer` 2.9.0 - corpus chunk token estimation in `lib/discovery/corpus.ts`.
- `datasketch` - Python MinHash support required by `requirements.txt`; TypeScript has in-repo dedupe logic in `lib/data/dedupe.ts` and `lib/discovery/dedupe.ts`.

**Infrastructure:**
- `ink-spinner` 5.0.0 - terminal progress indicators in `src/components/*.tsx`.
- `p-limit` 6.2.0 - concurrency control dependency available for fan-out work.
- `jsonschema` 1.5.0 - installed JavaScript schema utility; active validation primarily uses `ajv`.
- `fast-deep-equal` 3.1.3 - structural equality utility dependency.
- `zod-to-json-schema` 3.25.2 - available for Zod-to-JSON-Schema conversion.
- `wandb` - Python package required by the MLX-LM LoRA stack; `scripts/_lib.sh` forces `WANDB_MODE=offline`.

## Configuration

**Environment:**
- `MLX_SERVER_URL` overrides the OpenAI-compatible model endpoint in `lib/model.ts`, `src/lib/config.ts`, `src/cli.tsx`, and `src/repl.tsx`.
- `LOCAL_MODEL` selects the model ID for `mlx_lm.server` and the AI SDK provider in `src/lib/config.ts`, `src/lib/server-manager.ts`, `lib/model.ts`, and `src/repl.tsx`.
- `ADAPTER_DIR` selects adapter output/input paths for training, fusion, and deployment in `src/lib/config.ts`, `lib/training/run-training.ts`, `scripts/_lib.sh`, `scripts/fuse.sh`, and `scripts/deploy-adapter.sh`.
- `IPHONE_UDID` selects the deployment device in `src/lib/config.ts`, `scripts/deploy-adapter.sh`, and `scripts/ios-deploy-device.sh`.
- `EVAL_BASE_URL` and `EVAL_TUNED_URL` configure optional external evaluation endpoints in `lib/eval/run.ts`.
- `DATA_GEN_CHECKPOINT_EVERY` configures checkpoint cadence in `lib/data/checkpoint.ts`.
- Training scripts also accept `MODEL`, `ITERS`, `DATA_DIR`, `NUM_LAYERS`, `BATCH`, `SEQ_LEN`, `LR`, `SAVE_EVERY`, `STEPS_PER_REPORT`, `RESUME_ADAPTER`, `RANK_STRATEGY`, `BASE_MODEL`, `OUT_DIR`, `TOOLS_JSON`, and GRPO-specific variables in `scripts/train.sh`, `scripts/grpo.sh`, `scripts/_lib.sh`, and `scripts/fuse.sh`.
- `.env.example` and `.env.local` are present; their contents were not read because `.env*` files are treated as secret-bearing environment files.

**Build:**
- `package.json` defines Bun scripts and dependency constraints.
- `bun.lock` pins JavaScript dependency resolution.
- `tsconfig.json` enables strict TypeScript, ESM, `moduleResolution: "bundler"`, JSX via `react-jsx`, and the `@/*` path alias to the repository root.
- `vitest.config.ts` configures Node tests, non-global APIs, `@` alias resolution, and serial file execution.
- `biome.json` configures linting, import organization, tab indentation, single quotes, semicolons, and ignored generated/runtime directories.
- `requirements.txt` pins the Python MLX-LM training packages.

## Platform Requirements

**Development:**
- Install JavaScript dependencies with `bun install` from `package.json` and `bun.lock`.
- Set up Python with `scripts/setup-venv.sh`; prefer `uv` for Python 3.12 acquisition and package installation.
- Use `bun run typecheck`, `bun run check`, and `bun run test` for portable verification.
- Keep generated model, adapter, dataset, and runtime artifacts under `data/` out of product source changes unless explicitly intended.
- New MLX implementation work should follow the target state in `docs/MLX_PROJECT_SPEC.md`: local state under `~/.mlx` or `MLX_HOME`, Hugging Face-native Parquet/Arrow datasets, SQLite catalog with migrations, and loopback-only local services by default.

**Production:**
- Primary deployment target is local macOS execution with an optional iPhone runtime.
- Model serving is local through `mlx_lm.server`, started by `src/lib/server-manager.ts` or `bun src/cli.tsx serve`.
- Training outputs are MLX LoRA adapters in `data/training/model-a-adapter` by default.
- Fused or packaged adapters are produced by `scripts/fuse.sh` and deployed to iOS app containers by `scripts/deploy-adapter.sh`.
- Hugging Face Hub publication, GitHub repository ingestion, SQLite cataloging, DuckDB/Parquet analytical storage, and Studio are required by `docs/MLX_PROJECT_SPEC.md` but are not detected as implemented runtime packages in `package.json`, `requirements.txt`, or current `src/` and `lib/` code.

---

*Stack analysis: 2026-07-15*
