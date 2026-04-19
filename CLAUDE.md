# CLAUDE.md — Project Instructions for Claude Code

> Offline Specialist-LLM Pipeline — CLI tool for producing narrow product expert models.

## Project Overview

CLI-driven pipeline that discovers a product corpus, designs dynamic tools, generates training data, fine-tunes a local Gemma model via MLX, and deploys the fused adapter + tools to an iPhone for fully offline inference.

## Tech Stack

- **Runtime**: Bun + Node >= 20
- **CLI UI**: Ink (React for terminal)
- **Inference**: Local Gemma via `mlx_lm.server` (OpenAI-compatible HTTP API)
- **AI SDK**: v6 (`ToolLoopAgent`, `generateText`, `generateObject`)
- **Training**: `mlx-lm==0.31.2`, `mlx-lm-lora==0.1.9` (Python CLI subprocesses)
- **Embeddings**: `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2`
- **Linter/Formatter**: Biome (tabs, single quotes, semicolons, 100 line width)
- **iOS**: Swift 5.9 / Xcode 16 / iOS 18 / MLX Swift LM / JavaScriptCore
- **Device deploy**: `xcrun devicectl`

## Repo Layout

```text
src/                  Ink CLI entry point and terminal UI components
lib/model.ts          centralized local model provider (mlx_lm.server)
lib/discovery/        corpus fetch, swarm, validation, manifest emission
lib/data/             QA generation, trajectories, dedupe, split, JSONL emission
lib/training/         rollback, supervisor, GRPO transforms
lib/eval/             three-way eval harness
lib/coordinator/      multi-worker coordinator agent
lib/adapter/          fuse + deploy step runner
ios/SpecialistApp/    offline Swift runtime
scripts/              bench, train, fuse, deploy, verify
data/                 generated manifests, datasets, adapters
```

## Key Commands

```bash
bun start pipeline    # full pipeline
bun src/cli.tsx discover|data-gen|train|eval|fuse|deploy|serve
bun run typecheck     # tsc --noEmit
bun run test          # vitest
bun run check         # biome check
bun run format        # biome format --write
```

## Hard Constraints

Do NOT introduce any of the following:

- PWA, WebLLM, transformers.js, llama.cpp paths.
- HuggingFace Transformers + MPS, Axolotl, LLaMA-Factory — use `mlx-lm` only.
- Python application code — Python is a pinned CLI subprocess only.
- Core ML / ExecuTorch — MLX Swift only.
- E2B / WebContainers / CodeSandbox for tool sandboxing — `node:vm` + `worker_threads` only.
- Any RAG / cloud fallback / hybrid-inference that weakens the airplane-mode story.
- Auto-formatting agent-generated JS tool bodies — reject, don't fix.
- Gemma 4 vision / audio modalities — text-only.
- Training runs longer than 20 minutes wall-clock.

## Base Model

`unsloth/gemma-4-E4B-it-UD-MLX-4bit`. Fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit`.

## Commit Conventions

- Never commit secrets or training-data with credentials.
- Code commits: descriptive subject line, no scope prefix required.
