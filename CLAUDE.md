# CLAUDE.md — Project Instructions for Claude Code

> Offline Specialist-LLM Pipeline — hackathon demo at Saturday 2026-04-18 H12.

## Single Source of Truth

`PRD_SPEC.md` is authoritative. `.planning/*.md` are the planning projection. If they ever disagree, PRD wins and the planning layer should be updated.

**Always read first when starting work:**
1. `PRD_SPEC.md` (the actual spec — sections relevant to the current phase)
2. `.planning/ROADMAP.md` (phase breakdown + success criteria)
3. `.planning/REQUIREMENTS.md` (REQ-IDs the current phase covers)
4. `.planning/STATE.md` (what's been decided / in progress)

## Workflow

This project uses the GSD (Get-Shit-Done) workflow — see the `gsd-*` skills in the Skill tool.

- `/gsd-plan-phase 1` — plan the current phase in detail before executing.
- `/gsd-execute-phase N` — execute a planned phase.
- `/gsd-next` — advance to the next logical step.
- `/gsd-progress` — check where the project is.

**Coarse granularity, YOLO mode, parallel execution.** See `.planning/config.json`.

## Hard Constraints (from PRD §19.4)

Do NOT introduce any of the following — they are confirmed dead-ends at this model size, hardware, or budget:

- PWA, WebLLM, transformers.js, llama.cpp paths.
- HuggingFace Transformers + MPS, Axolotl, LLaMA-Factory — use `mlx-lm` only.
- Python application code — Python is a pinned CLI subprocess (mlx-lm, mlx-lm-lora). Zero `.py` files authored.
- Core ML / ExecuTorch — MLX Swift is the only path hitting target throughput.
- E2B / WebContainers / CodeSandbox for tool sandboxing — `node:vm` + `worker_threads` only.
- Any RAG / cloud fallback / hybrid-inference affordance that weakens the airplane-mode story.
- Auto-formatting agent-generated JS tool bodies — reject, don't fix.
- Gemma 4 vision / audio modalities — text-only.
- Per-dimension multi-judge eval.
- Training runs longer than 20 minutes wall-clock.

## Tech Stack Locks (PRD §13)

- Node ≥ 20 / Next.js 15 App Router (`runtime='nodejs'` on routes that use `child_process`).
- `mlx-lm==0.31.2`, `mlx-lm-lora==0.1.0`.
- AI SDK v6 (`ToolLoopAgent`, `createUIMessageStream`, `writer.merge`).
- `@sentry/nextjs ≥ 9.29.0` with `Sentry.vercelAIIntegration()`.
- Swift 5.9 / Xcode 16 / iOS 18 minimum deployment target.
- `mlx-swift-lm` 3.x, `swift-tokenizers-mlx ≥ 0.1.0`, `JavaScriptCore`, `Network`.
- `xcrun devicectl` for on-device file copy.

## Base Model

`unsloth/gemma-4-E4B-it-UD-MLX-4bit`. Fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit` if H0 bench shows peak training memory > 20 GB on M4 Pro 24 GB.

## Fallback Tiers

Three tiers always prepared (PRD §15). Current floor: Tier 3 cassette (recorded at H7). Live narration can always deliver over a pre-recorded video while the airplane-mode iPhone is physically in the room.

## Repo Layout

See PRD §19.1 for the canonical directory structure (`app/`, `lib/`, `ios/`, `scripts/`, `data/`).

## Commit Conventions

- Planning-doc commits: `docs: ...` for PROJECT/REQUIREMENTS/ROADMAP, `chore: ...` for config.
- Code commits follow GSD phase/plan conventions during execution.
- Never commit secrets or training-data with credentials (training set would leak them at inference).

## What to Do Next

Run `/gsd-plan-phase 1` to plan **Phase 1 — Foundation & Smoke Tests** (H0–H2: micro-bench, iPhone deploy, adapter hot-swap, JSContext tool round-trip).
