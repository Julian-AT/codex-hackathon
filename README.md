# Offline Specialist-LLM Pipeline

End-to-end CLI pipeline for producing a narrow product expert model, training it locally with MLX, and running it fully offline on an iPhone with agent-authored JavaScript tools.

- CLI surface: Ink terminal UI running on Bun.
- Inference: local Gemma via `mlx_lm.server` (OpenAI-compatible API).
- Training: `mlx-lm` SFT + GRPO, shell entrypoints in [`scripts/`](./scripts).
- Device runtime: SwiftUI + MLX Swift LM + `JavaScriptCore` + `Network`.
- Base model: `unsloth/gemma-4-E4B-it-UD-MLX-4bit`; fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit`.
- Tool contract: validated `adapter-tools.json` manifest copied alongside the adapter and executed on-device via `JSContext`.
- No cloud fallback, no RAG, no browser inference path.

## Architecture

```text
product target
  -> discovery swarm (local Gemma)
  -> tool-design swarm
  -> training/eval data generation
  -> MLX LoRA training (SFT + GRPO)
  -> adapter fuse + deploy
  -> iPhone offline runtime
```

The CLI is the operator surface. It orchestrates the full pipeline from discovery through deployment via commands that wire into `lib/` modules directly.

The iOS runtime lives in [`ios/SpecialistApp/`](./ios/SpecialistApp). [`ModelState.swift`](./ios/SpecialistApp/ModelState.swift) owns base-model lifetime and adapter swaps, [`GemmaToolParser.swift`](./ios/SpecialistApp/GemmaToolParser.swift) extracts tool-call tokens, and [`ToolRegistry.swift`](./ios/SpecialistApp/ToolRegistry.swift) executes bundled JS tools under offline policy checks.

## System Design

The repository is split into four operational layers:

- `lib/discovery`: fetches and chunks the product corpus, runs the tool-design swarm, validates candidate tools, and emits `adapter-tools.json`.
- `lib/data`: generates grounded Q&A and tool-use trajectories, applies schema gates and deduplication, and writes `training.jsonl` and `eval.jsonl`.
- `lib/training`: owns train-time transforms, rollback handling, and supervisor logic around MLX subprocess execution.
- `ios/SpecialistApp`: hosts the offline runtime, adapter loader, tool parser, tool registry, and UI for on-device verification.

The intended flow is strict:

1. Discover a bounded product corpus.
2. Synthesize dynamic tools against that corpus and reject invalid tool bodies.
3. Generate training and evaluation data pinned to the shipped tool schemas.
4. Fine-tune a Gemma 4 MLX base locally via LoRA.
5. Fuse or package the adapter, copy it and the tool manifest to the phone, and reload them at runtime.
6. Verify that the phone still answers and invokes tools correctly while offline.

This is deliberately not a general offline chat app. The system is designed around narrow specialization, explicit tool contracts, and reproducible deploy artifacts.

## Repo Layout

```text
src/                  Ink CLI entry point and terminal UI components
lib/discovery/        corpus fetch, swarm, validation, manifest emission
lib/data/             QA generation, trajectories, dedupe, split, JSONL emission
lib/training/         rollback, supervisor, GRPO transforms
lib/eval/             three-way eval harness
lib/model.ts          centralized local model provider (mlx_lm.server)
ios/SpecialistApp/    offline Swift runtime
scripts/              bench, train, fuse, deploy, verify, preflight
data/                 generated manifests, datasets, adapters
```

## Core Artifacts

- `data/adapter-tools.json`: validated dynamic tool manifest.
- `data/training.jsonl`: SFT training set in MLX-compatible chat/tool format.
- `data/eval.jsonl`: held-out evaluation set.
- `data/**/*.safetensors`: adapter checkpoints and fused outputs.

These artifacts are the contract between the discovery, training, evaluation, and device-runtime layers.

## CLI Commands

```bash
bun src/cli.tsx <command>
```

| Command | Description |
|---------|-------------|
| `pipeline` | Run the full pipeline (discover -> data-gen -> train -> eval -> fuse) |
| `discover` | Run the discovery swarm only |
| `data-gen` | Run data generation only |
| `train` | Run SFT training |
| `eval` | Run the evaluation harness |
| `fuse` | Fuse adapter weights |
| `deploy` | Deploy adapter to iPhone via `xcrun devicectl` |
| `serve` | Start `mlx_lm.server` standalone |

Options:
- `--help` — show help
- `--no-serve` — skip auto-starting `mlx_lm.server` (assumes already running)

## Runbook

```bash
bun install
cp .env.example .env.local

# Start the full pipeline
bun start pipeline

# Or run stages individually
bun src/cli.tsx discover
bun src/cli.tsx data-gen
bun src/cli.tsx train
bun src/cli.tsx eval
bun src/cli.tsx fuse
bun src/cli.tsx deploy
```

Training scripts (also invoked by CLI):

```bash
bash scripts/train.sh
bash scripts/grpo.sh
bash scripts/fuse.sh
bash scripts/deploy-adapter.sh
bash scripts/verify-device.sh
```

## Environment

Expected baseline:

- Bun >= 1.0
- Node >= 20
- Python 3.12 with `mlx-lm==0.31.2`, `mlx-lm-lora==0.1.9`
- Xcode 16 and iOS 18+ (for device deployment)
- Physical iPhone for the full offline path

Environment variables are defined in [`.env.example`](./.env.example).

## Runtime Boundaries

Three distinct runtimes:

- **Laptop CLI**: Bun + Ink terminal UI, AI SDK orchestration via local `mlx_lm.server`, dataset generation, evaluation, and MLX subprocess supervision.
- **Training subprocesses**: `mlx_lm.lora` and `mlx_lm_lora.train`, invoked from shell and streamed back into the CLI.
- **iPhone runtime**: base model, adapter hot-swap, tool-call parsing, JavaScript tool execution, and offline policy enforcement.

## Constraints

These are hard project constraints, not preferences:

- No PWA, WebLLM, `transformers.js`, or `llama.cpp` path.
- No authored Python application code; Python is CLI-only for MLX tooling.
- No cloud inference fallback or hybrid offline/online mode.
- No auto-rewriting malformed generated JS tool bodies; invalid tools are rejected.
- No model family drift outside the pinned Gemma 4 E4B / E2B path.
