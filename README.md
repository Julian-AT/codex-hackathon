<h1 align="center">Offline Specialist-LLM Pipeline</h1>

<p align="center">
  <strong>Agentic product-to-model pipeline: discovery swarm, dynamic tool design, judge-gated data generation, local MLX fine-tuning, and offline iPhone inference in one deployable system</strong>
</p>

<p align="center">
  

https://github.com/user-attachments/assets/b3b7906b-b16d-4755-8b06-12855f8ec9de



https://github.com/user-attachments/assets/2039d6d2-f806-4e9d-8255-d179653d646d


</p>

<p align="center">
  
</p>

<p align="center">
  <a href="https://github.com/Julian-AT/codex-hackathon"><img src="https://img.shields.io/badge/OpenClaw-Hack__001-blue?style=flat-square" alt="OpenClaw Hack_001"></a>
  <img src="https://img.shields.io/badge/Stack-Next.js_15_·_AI_SDK_6_·_MLX_Swift-black?style=flat-square" alt="Stack">
  <img src="https://img.shields.io/badge/Training-mlx--lm_%2B_mlx--lm--lora-orange?style=flat-square" alt="Training">
  <img src="https://img.shields.io/badge/Runtime-iPhone_offline-0F766E?style=flat-square" alt="iPhone">
  <img src="https://img.shields.io/badge/Product-Any_specialist_model-111827?style=flat-square" alt="Specialist model">
</p>

## Overview

This project takes a product surface and turns it into a narrow specialist model that can run **fully offline on an iPhone**.

The system is intentionally end-to-end. A visible coordinator/worker swarm discovers the product surface, designs callable tools, and synthesizes training data. A local MLX LoRA path fine-tunes the model on a MacBook. The resulting adapter and tool manifest are copied into a native Swift app, where the phone can answer specialist questions and execute bundled JavaScript tools while in **airplane mode**.

## The challenge

Most offline AI products get softer as soon as they leave the landing page: hidden retrieval, cloud fallback, or browser-only inference. This project takes the stricter path:

- a specialist model, not generic chat
- dynamic tools authored by the swarm itself
- local training on consumer hardware
- native mobile inference instead of a browser wrapper
- a single system that connects discovery, data generation, training, and runtime

## Core capabilities

| Track | What ships |
| --- | --- |
| **Swarm** | `/api/pipeline` coordinator/worker orchestration, worker status streaming, dashboard agent grid |
| **Discovery** | product corpus ingestion, tool-design swarm, validation gates, `adapter-tools.json` emission |
| **Data** | grounded Q&A, tool trajectories, eval-set generation, schema-gated tool-call examples |
| **Training** | local `mlx_lm.lora` SFT, optional GRPO path, streamed loss/reward telemetry, rollback safeguards |
| **Mobile runtime** | Swift app, runtime adapter loading, tool-token parsing, `JavaScriptCore` tool execution, offline enforcement |
| **Operations** | fuse, deploy, verify, and preflight scripts for reproducible delivery |

---

## Product surface

The dashboard is the main product surface. It keeps the full workflow in one place: **agent swarms**, **training telemetry**, **evaluation state**, and **device handoff**. The goal is clarity over spectacle, with the swarm and model lifecycle always visible.

## Implementation: how it actually works

### System architecture

```mermaid
flowchart TB
  subgraph product["Product Surface"]
    TARGET["Product target"]
    DASH["Dashboard"]
  end

  subgraph swarm["Pipeline"]
    PIPE["/api/pipeline"]
    COORD["Coordinator"]
    DISC["Discovery swarm"]
    TOOLS["Tool design"]
    DATA["Data generation"]
    EVALGEN["Eval generation"]
  end

  subgraph artifacts["Artifacts"]
    CORPUS["Corpus"]
    MANIFEST["adapter-tools.json"]
    TRAINJSON["training.jsonl"]
    EVALJSON["eval.jsonl"]
  end

  subgraph training["Training And Delivery"]
    TRAIN["/api/train"]
    MLX["MLX LoRA"]
    FUSE["scripts/fuse.sh"]
    DEPLOY["scripts/deploy-adapter.sh"]
    VERIFY["scripts/verify-device.sh"]
  end

  subgraph device["Offline Runtime"]
    IOS["iPhone app"]
    MODEL["Model state"]
    PARSER["Tool parser"]
    REG["Tool runtime"]
    CHAT["Chat UI"]
  end

  TARGET --> DASH --> PIPE --> COORD
  COORD --> DISC --> CORPUS
  COORD --> TOOLS --> MANIFEST
  COORD --> DATA --> TRAINJSON
  COORD --> EVALGEN --> EVALJSON
  DASH --> TRAIN --> MLX --> FUSE --> DEPLOY --> IOS
  DEPLOY --> VERIFY
  IOS --> MODEL --> PARSER --> REG --> CHAT
  MANIFEST --> DEPLOY
  TRAINJSON --> TRAIN
  EVALJSON --> DASH
```

### End-to-end flow

```mermaid
sequenceDiagram
  participant USER as User
  participant UI as Dashboard
  participant P as /api/pipeline
  participant D as /api/data-gen
  participant T as /api/train
  participant A as /api/adapter
  participant I as iPhone App

  USER->>UI: Start pipeline
  UI->>P: Run orchestration
  P-->>UI: Worker status and results
  UI->>D: Generate datasets
  D-->>UI: Progress and acceptance stats
  UI->>T: Train adapter
  T-->>UI: Loss and reward telemetry
  UI->>A: Package and deploy
  A->>I: Copy adapter and tools
  I->>I: Load runtime assets
  USER->>I: Ask a specialist question
  I-->>USER: Respond offline
```

The dashboard is backed by typed stream parts, coordinator status, training telemetry, and deployment logs. It is a working operator surface, not a static shell.

### Discovery and tool-design swarm

Discovery and tool design are separated on purpose. The system fetches and chunks the product corpus, then runs a **4-worker tool-design swarm** that proposes dynamic tool specs. Every tool passes schema, parse, sandbox, fuzz, and trajectory checks before it lands in `adapter-tools.json`.

```mermaid
flowchart LR
  C["fetchCorpus()"]
  S["designToolsSwarm()"]
  V["validateTool()"]
  M["writeManifest()"]

  C --> S --> V --> M
```

### Data generation pipeline

The data path combines:

- grounded Q&A generation
- single-turn and multi-turn tool trajectories
- judge-gated acceptance
- MinHash and embedding dedup
- stratification checks
- training/eval JSONL emission

This keeps the model grounded in product behavior rather than turning the repository into a generic chat wrapper.

### Training and mobile runtime

The training side stays intentionally narrow:

- `scripts/train.sh` runs the SFT path
- `scripts/grpo.sh` remains optional
- `/api/train` streams structured training telemetry into the dashboard
- supervisor and rollback utilities preserve a valid checkpoint under failure

The iPhone runtime is equally explicit:

- `ModelState.swift` owns model lifetime and adapter swaps
- `GemmaToolParser.swift` intercepts streamed tool-call tokens
- `ToolRegistry.swift` executes bundled JS tool bodies in `JavaScriptCore`
- `AdapterToolsLoader.swift` reloads `adapter-tools.json` on swap
- `ChatView.swift` and `ToolCallBubble.swift` expose tool activity in the UI

## Technology stack

| Layer | Choices |
| --- | --- |
| App | Next.js 15 App Router, React 19, TypeScript |
| Agent runtime | AI SDK v6, streamed UI message parts, coordinator/worker orchestration |
| Providers | Google and OpenAI |
| Validation | Zod, AJV, `jsonschema`, `acorn`, `node:vm` |
| Training | `mlx-lm`, `mlx-lm-lora`, shell wrappers in `scripts/` |
| Mobile | SwiftUI, MLX Swift LM, `JavaScriptCore`, `Network` |
| UI | shadcn/ui, Tailwind CSS v4, Recharts |
| Quality | TypeScript, Vitest, shell verification |

## Reliability

- Typed stream contracts for worker status and task completion
- Validation gates for dynamic tools before manifest emission
- Rollback and fallback handling in the training path
- Explicit deploy, verify, and preflight scripts for delivery and validation

## Prerequisites

- Node 20+
- `pnpm`
- Python 3.12 with the MLX CLIs available for training
- Xcode 16 and iOS 18+ for the device runtime
- A physical iPhone for the full offline runtime
- API keys for the generation and evaluation providers you want to use

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open the dashboard at `http://localhost:3000`.

## Environment variables

See [`.env.example`](.env.example) for the full list. The most important ones are:

| Variable | Role |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI judge / generation surfaces |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini discovery and data-generation path |
| `ANTHROPIC_API_KEY` | Optional provider compatibility path |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Observability |
| `EVAL_BASE_URL`, `EVAL_TUNED_URL` | External eval endpoints if wired |
| `NEXT_PUBLIC_IPHONE_UDID` | `devicectl` target |
| `NEXT_PUBLIC_BUNDLE_ID` | App container target for adapter deploys |

## Quickstart

The shortest path through the full system is:

```bash
pnpm dev
curl -N -X POST http://localhost:3000/api/data-gen -H 'content-type: application/json'
bash scripts/train.sh
bash scripts/fuse.sh --no-fuse
bash scripts/deploy-adapter.sh
bash scripts/verify-device.sh
bash scripts/preflight-demo.sh
```

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/train.sh` | MLX SFT entrypoint |
| `scripts/grpo.sh` | Optional GRPO stage |
| `scripts/fuse.sh` | Build fused or adapter-only payloads |
| `scripts/deploy-adapter.sh` | Copy adapter + tools to the iPhone app container |
| `scripts/verify-device.sh` | Record device verification state |
| `scripts/preflight-demo.sh` | Capture final preflight state |

## Project layout

```text
app/
  api/pipeline/        Coordinator/worker orchestration route
  api/data-gen/        Training/eval data generation route
  api/train/           MLX training subprocess route
  api/eval/            Three-way eval entrypoint
  api/adapter/         Fuse and deploy actions
  (demo)/              Dashboard page, stream hooks, charts, agent cards
components/dashboard/  Dashboard surface
ios/SpecialistApp/     Offline iPhone app, adapter loading, tool runtime
lib/discovery/         Corpus fetch, swarm, validation, manifest
lib/data/              QA/trajectory generation and JSONL emission
lib/training/          Supervisor, rollback, transforms
lib/eval/              Eval harness
scripts/               Train, fuse, deploy, verify, preflight helpers
data/                  Generated datasets, manifests, adapter artifacts
assets/                README media and screen recordings
```

## Current focus

The current focus is a reusable specialist-model pipeline. The same architecture can be pointed at different product surfaces, knowledge domains, or tool environments with the same core loop:

- corpus discovery
- tool manifest generation
- training and eval data synthesis
- local fine-tuning
- offline mobile runtime

---

<p align="center">
  Built for <strong>OpenClaw Hack_001</strong> · Vienna · agent swarms, local fine-tuning, and an airplane-mode iPhone
</p>
