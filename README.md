# Offline Specialist-LLM Pipeline

End-to-end pipeline for producing a narrow product expert model, training it locally with MLX, and running it fully offline on an iPhone with agent-authored JavaScript tools.

- Control plane: Next.js 15 App Router + AI SDK v6 streaming routes.
- Training path: `mlx-lm==0.31.2` SFT, `mlx-lm-lora==0.1.9` GRPO, shell entrypoints in [`scripts/`](./scripts).
- Device runtime: SwiftUI + MLX Swift LM + `JavaScriptCore` + `Network`.
- Base model: `unsloth/gemma-4-E4B-it-UD-MLX-4bit`; fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit`.
- Tool contract: validated `adapter-tools.json` manifest copied alongside the adapter and executed on-device via `JSContext`.
- Demo constraint: no cloud fallback, no RAG, no browser inference path.

## Architecture

```text
product target
  -> discovery swarm
  -> tool-design swarm
  -> training/eval data generation
  -> MLX LoRA training
  -> adapter fuse + deploy
  -> iPhone runtime
```

The web app is the operator surface. It exposes the coordinator/worker pipeline in [`app/api/pipeline/route.ts`](./app/api/pipeline/route.ts), data generation in [`app/api/data-gen/route.ts`](./app/api/data-gen/route.ts), training in [`app/api/train/route.ts`](./app/api/train/route.ts), evaluation in [`app/api/eval/route.ts`](./app/api/eval/route.ts), and deploy actions in [`app/api/adapter/route.ts`](./app/api/adapter/route.ts). The demo UI in [`app/(demo)/`](./app/(demo)) renders worker state, loss curves, and operator progress as a single stream-backed surface.

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
app/                  Next.js routes and demo UI
lib/discovery/        corpus fetch, swarm, validation, manifest emission
lib/data/             QA generation, trajectories, dedupe, split, JSONL emission
lib/training/         rollback, supervisor, GRPO transforms
lib/eval/             three-way eval harness
ios/SpecialistApp/    offline Swift runtime
scripts/              bench, train, fuse, deploy, verify, preflight
data/                 generated manifests, datasets, adapters
```

## Core Artifacts

The main artifacts produced by the pipeline are:

- `data/adapter-tools.json`: validated dynamic tool manifest.
- `data/training.jsonl`: SFT training set in MLX-compatible chat/tool format.
- `data/eval.jsonl`: held-out evaluation set.
- `data/**/*.safetensors`: adapter checkpoints and fused outputs.

These artifacts are the contract between the discovery, training, evaluation, and device-runtime layers. The README stays intentionally focused on those interfaces rather than on internal prompt details.

## Runtime Boundaries

There are three distinct runtimes in the system:

- Laptop control plane: Next.js routes, AI SDK orchestration, dataset generation, evaluation control, and MLX subprocess supervision.
- Training subprocesses: `mlx_lm.lora` and `mlx_lm_lora.train`, invoked from shell and streamed back into the UI.
- iPhone runtime: base model, adapter hot-swap, tool-call parsing, JavaScript tool execution, and offline policy enforcement.

The phone is the terminal runtime. The project does not rely on browser inference or hidden retrieval to complete the demo path.

## Runbook

```bash
pnpm install
cp .env.example .env.local
pnpm dev

bash scripts/micro-bench.sh
bash scripts/train.sh
bash scripts/grpo.sh
bash scripts/fuse.sh --no-fuse
bash scripts/deploy-adapter.sh
bash scripts/verify-device.sh
bash scripts/preflight-demo.sh
```

Useful checks:

- `pnpm typecheck`
- `pnpm test`
- `bash scripts/grpo-smoke.sh`
- `tsx scripts/smoke-pipeline.ts`

## Environment

Expected baseline:

- Node `>=20`
- `pnpm`
- Python 3.12 for MLX CLI tooling
- Xcode 16 and iOS 18+
- physical iPhone for the full offline path

Environment variables are defined in [`.env.example`](./.env.example). In practice the repo expects provider keys for generation and judging, Sentry configuration, and device identifiers for `devicectl`-based deployment.

## API Surface

Main routes:

- [`app/api/pipeline/route.ts`](./app/api/pipeline/route.ts): coordinator/worker orchestration stream
- [`app/api/discover/route.ts`](./app/api/discover/route.ts): corpus discovery and tool-manifest generation
- [`app/api/data-gen/route.ts`](./app/api/data-gen/route.ts): dataset generation and JSONL emission
- [`app/api/train/route.ts`](./app/api/train/route.ts): training subprocess orchestration and telemetry
- [`app/api/eval/route.ts`](./app/api/eval/route.ts): evaluation harness
- [`app/api/adapter/route.ts`](./app/api/adapter/route.ts): fuse and deploy actions
- [`app/api/smoke/route.ts`](./app/api/smoke/route.ts): provider and route smoke checks

## iOS Runtime

The Swift app is not a thin shell over a web demo. It carries its own runtime responsibilities:

- adapter lifecycle and hot-swap in [`ModelState.swift`](./ios/SpecialistApp/ModelState.swift)
- tool-call token parsing in [`GemmaToolParser.swift`](./ios/SpecialistApp/GemmaToolParser.swift)
- JS tool execution and network gating in [`ToolRegistry.swift`](./ios/SpecialistApp/ToolRegistry.swift)
- manifest loading in [`AdapterToolsLoader.swift`](./ios/SpecialistApp/AdapterToolsLoader.swift)
- UI and verification surfaces in [`ChatView.swift`](./ios/SpecialistApp/ChatView.swift), [`ToolCallBubble.swift`](./ios/SpecialistApp/ToolCallBubble.swift), and [`StatusPill.swift`](./ios/SpecialistApp/StatusPill.swift)

This keeps the offline guarantee in the native runtime rather than in the web control plane.

## Status

Current source of truth is [`PRD_SPEC.md`](./PRD_SPEC.md) plus the planning state in [`.planning/`](./.planning).

- Phase 3 complete: discovery + tool-design swarm.
- Phase 4 complete: training/eval data generation.
- Phase 5 is next: live MLX training, rollback handling, loss/reward streaming.
- Tier-3 floor remains the recorded cassette at Phase 6.

## Constraints

These are hard project constraints, not preferences:

- No PWA, WebLLM, `transformers.js`, or `llama.cpp` path.
- No authored Python application code; Python is CLI-only for MLX tooling.
- No cloud inference fallback or hybrid offline/online mode.
- No auto-rewriting malformed generated JS tool bodies; invalid tools are rejected.
- No model family drift outside the pinned Gemma 4 E4B / E2B path.

## References

- [`PRD_SPEC.md`](./PRD_SPEC.md): product and architecture source of truth
- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md): phase breakdown and success criteria
- [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md): requirement traceability
- [`.planning/STATE.md`](./.planning/STATE.md): current execution state
