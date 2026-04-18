# Phase 1: Foundation & Smoke Tests — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Source:** PRD Express Path (PRD_SPEC.md §5, §6.2, §8, §9, §14, §18)

<domain>
## Phase Boundary

**Time-box:** H0 – H2 (3 hours wall-clock).
**Goal:** Prove three load-bearing paths before committing remaining 9 hours of build:
- (a) Gemma 4 E4B QLoRA fits in 24 GB peak on M4 Pro (or fall back to E2B).
- (b) A fused adapter hot-swaps on physical iPhone 17 over USB-C.
- (c) A `<|tool_call|>` token round-trips through `JSContext` on-device.

**Plus** the entire PRD §18 de-risk checklist cleared before H0 kickoff.

Not in scope for Phase 1: orchestrator UI (Phase 2), training-data gen (Phase 3), full-length SFT/GRPO runs (Phase 4), scoreboard (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Base Model (PRD §5)
- **Primary:** `unsloth/gemma-4-E4B-it-UD-MLX-4bit`.
- **Fallback trigger:** H0 micro-bench peak memory > 20 GB → switch to `unsloth/gemma-4-E2B-it-UD-MLX-4bit`, re-download, re-bench, continue.
- Download started as part of OPS-05 de-risk before H0.

### Micro-Bench (TRAIN-05, H0)
- Pinned CLI: `mlx-lm==0.31.2`, `mlx-lm-lora==0.1.0`. Zero Python application code.
- 50 iterations on 20-example JSONL toy dataset (hand-written, in `data/smoke/`).
- Records: sec/iter and peak memory.
- Output: decision entry appended to `.planning/STATE.md` — "stay on E4B" or "switched to E2B".
- If peak > 20 GB → kill-point: swap every E4B reference to E2B and re-bench.

### iOS Platform — LLMEval Fork (PLAT-01)
- Fork `mlx-swift-examples/LLMEval`.
- Gemma 4 E4B base weights resident in app bundle (or app sandbox via first-launch copy).
- Entitlement `com.apple.developer.kernel.increased-memory-limit` set in Xcode project.
- Swift 5.9, Xcode 16, iOS 18 minimum deployment target.
- Dependencies: `mlx-swift-lm` 3.x, `swift-tokenizers-mlx ≥ 0.1.0`, `JavaScriptCore`, `Network`.

### On-Device Smoke Test (PLAT-07)
- One prompt generates at ≥ 40 tok/s on iPhone 17 in airplane mode.
- Airplane-mode verification: `NWPathMonitor` shows path not `.satisfied`.

### Adapter Hot-Swap (PLAT-02, TRAIN-04)
- Produce 50-iter toy adapter on laptop (`mlx_lm.lora` minimal config → `mlx_lm.fuse`).
- Stream to device via `xcrun devicectl device copy to <device> <local> /Documents/`.
- Load via `LoRATrain.loadLoRAWeights(model:, url:)`; hot-swap <2 s after file arrives.
- Verify visible behavior delta vs. base (prompt chosen so toy adapter produces a distinguishable completion).
- Fallback "no-fuse" path (adapter-only, not merged) also smoke-tested once.

### JSContext Tool Round-Trip (PLAT-03, PLAT-04)
- `ToolRegistry` actor wraps a single `JSContext`; registers native bridges: `console.log`, `nativeFetch` via `URLSession`.
- `GemmaToolParser` catches `<|tool_call|>…<|tool_response|>` pairs in streaming decoder, JSON-decodes args, dispatches via `JSValue.call`, injects response back, continues generation.
- End-to-end verification: model emits `<|tool_call|>`, parser catches, JSContext dispatches hand-written JS tool, response injected, generation resumes coherently.
- Kill-point H2: tool round-trip dead → fall back to static pre-baked Swift tools (DEMO-03 degrades).

### Adapter-Tools Bundle (PLAT-06)
- Loader reads `adapter-tools.json` at adapter-swap time and registers every `DynamicTool` into `ToolRegistry`.
- Phase 1 scope: loader wired and tested with a single hand-written entry; Phase 3 produces the real 8–12 tool manifest.

### Offline Enforcement (PLAT-05)
- `NWPathMonitor`-backed; any tool with `requiresNetwork:true` returns a structured error payload when path is not `.satisfied`.
- Online/offline status pill visible in the iOS app UI at all times.

### De-Risk Checklist (OPS-05, pre-H0)
Executed before H0 kickoff:
- API keys verified (Anthropic, OpenAI, Gemini).
- web-llm#753 status checked (expected still open; confirms PWA dead-end).
- Gemma 4 E4B MLX download started.
- iPhone 17 charged; iOS 18.2+ confirmed.
- USB-C → HDMI → capture card pipeline tested in airplane mode.
- Xcode 16 signing works against physical device.
- Sentry project live.
- Second-phone hotspot tested (laptop only — never demo phone).
- Git pushed to remote.

### Sandbox Model
- Tool sandbox for JS bodies: `node:vm` + `worker_threads`, 2 s AbortController, 64 MB cap. Not in Phase 1 scope — Phase 3 builds this.
- For Phase 1 smoke test, a hand-written JS tool body is used directly (no sandbox validation required).

### Claude's Discretion
- Exact toy dataset content for the 20-example JSONL and hand-written JS tool body: implementer picks. Dataset should be Supabase-flavored to prime later training and have enough lexical divergence from base to make adapter delta visible.
- Exact shell scripts vs. npm scripts for the bench and fuse commands: either, as long as commands are reproducible.
- Directory locations inside `scripts/` and `data/smoke/`: follow PRD §19.1 canonical layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Single Source of Truth
- `PRD_SPEC.md` — Authoritative spec; §5 (base model), §6 (training), §8 (iOS platform), §9 (tools), §14 (execution plan), §18 (de-risk), §19 (acceptance + repo layout + hard constraints).

### Planning Layer
- `.planning/ROADMAP.md` — Phase 1 section: success criteria, kill-points.
- `.planning/REQUIREMENTS.md` — Full v1 REQ list; Phase 1 covers TRAIN-05, PLAT-01..07, OPS-05.
- `.planning/STATE.md` — Decisions log (bench outcome will be appended here).

### Project Instructions
- `CLAUDE.md` — Hard constraints (dead-ends), tech stack locks, GSD workflow notes.

</canonical_refs>

<specifics>
## Specific Ideas

### Canonical Commands (from PRD §6 / §8)
- Bench: `mlx_lm.lora` with rank 16, 16 layers, batch 2, seq 1024, lr 1e-5, 50 iters.
- Fuse: `mlx_lm.fuse` → `adapter.safetensors`.
- Copy: `xcrun devicectl device copy to <device-id> <local-path> /Documents/`.
- iOS load: `LoRATrain.loadLoRAWeights(model:, url:)`.

### Hand-Written JS Tool Body (Phase 1 smoke only)
A trivial pure-JS tool (e.g., `echoArgs({text}) => ({echoed:text})`) is sufficient to prove the round-trip. A Supabase-flavored stub (`searchKnowledge({query}) => ({hits:[...]})`) is nicer but not required.

### Repo Layout (PRD §19.1)
Standard tree — `app/`, `lib/`, `ios/`, `scripts/`, `data/`.

</specifics>

<deferred>
## Deferred Ideas

- Full Coordinator/Worker streaming UI — Phase 2.
- Training-data generation + judge gating — Phase 3.
- 400-iter SFT + 150-iter GRPO pipeline — Phase 4.
- Three-way scoreboard + eval runner — Phase 5.
- Audience-pick pre-cache (Vercel AI SDK / Zod / Hono) — v2 stretch.
- `node:vm` + `worker_threads` tool validation sandbox — Phase 3.

</deferred>

---

*Phase: 01-foundation-smoke-tests*
*Context gathered: 2026-04-18 via PRD Express Path*
