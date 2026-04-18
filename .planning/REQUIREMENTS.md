# REQUIREMENTS — v1 Scoped

> Derived from `PRD_SPEC.md` §2 (Goals), §8–11 (Runtime, Tools, Orchestration, Eval), §14 (Execution Plan), §19 (Acceptance Criteria). Every item is a hypothesis until shipped and validated at the H12 demo.

**REQ-ID format:** `[CATEGORY]-[NN]`. Categories: DEMO (must-have deliverables), PLAT (iOS platform), ORCH (orchestrator / UI), TRAIN (fine-tuning), DATA (data/tool pipeline), EVAL (scoring), OPS (operations/fallback).

---

## v1 Requirements

### DEMO — Tier 1 Must-Haves (PRD §2.1)

- [ ] **DEMO-01** — A native iOS app runs on iPhone 17 in airplane mode, serving a fine-tuned Gemma 4 E4B model with no network available.
- [ ] **DEMO-02** — Fine-tuning completes live on stage in ≤ 17 minutes on the laptop; training loss and a secondary reward curve stream to a visible UI.
- [ ] **DEMO-03** — The tuned model correctly invokes a domain-specific callable tool whose JavaScript body was written by an agent during the pipeline run and bundled with the model.
- [ ] **DEMO-04** — A three-way evaluation scoreboard (base vs. tuned vs. teacher) renders with numeric scores and a latency comparison (on-device ms vs. cloud round-trip ms).
- [ ] **DEMO-05** — Visible agent orchestration — audience sees 4+ swarms running in parallel with live status updates.

### PLAT — iOS Platform (PRD §8)

- [ ] **PLAT-01** — Native Swift app forked from `mlx-swift-examples/LLMEval`, Gemma 4 E4B base weights resident in app bundle, `com.apple.developer.kernel.increased-memory-limit` entitlement set.
- [ ] **PLAT-02** — Adapter hot-swap via `LoRATrain.loadLoRAWeights(model:, url:)` completes in <2 s after a ~60 MB `adapter.safetensors` arrives in `/Documents/`.
- [ ] **PLAT-03** — `ToolRegistry` actor wraps a single `JSContext`, registers native bridges (`console.log`, `nativeFetch` via `URLSession`), loads agent-provided JS tool bodies, dispatches via `JSValue.call`.
- [ ] **PLAT-04** — `GemmaToolParser` catches `<\|tool_call\|>…<\|tool_response\|>` pairs in the streaming decoder, JSON-decodes, dispatches, injects response back, continues generation.
- [ ] **PLAT-05** — `NWPathMonitor`-backed offline enforcement: any tool with `requiresNetwork:true` returns a structured error payload when path is not `.satisfied`; online/offline status pill visible in UI at all times.
- [ ] **PLAT-06** — Adapter-tools bundle loader reads `adapter-tools.json` at adapter-swap time and registers every `DynamicTool` into `ToolRegistry`.
- [ ] **PLAT-07** — Inference throughput ≥ 40 tok/s on iPhone 17 in airplane mode for Gemma 4 E4B (per PRD §19.3 acceptance).

### ORCH — Orchestrator & Demo UI (PRD §10, §12)

- [ ] **ORCH-01** — Next.js 15 (App Router) + AI SDK v6 `createUIMessageStream` with `writer.merge({sendStart:false, sendFinish:false})` for N parallel workers.
- [ ] **ORCH-02** — Coordinator/Worker pattern: coordinator only orchestrates, workers are single-purpose with tightly-scoped prompts and narrow tool allowlists; results flow via typed `<task-notification>` messages.
- [ ] **ORCH-03** — Worker roles emit `{type:'data-agent-status', ...}` on state change and `{type:'data-task-notification', ...}` on completion; client `useChat({onData})` routes by worker id into a 5×4 `AgentCard` grid.
- [ ] **ORCH-04** — SFT + GRPO subprocesses spawned via `child_process.spawn` with `PYTHONUNBUFFERED=1`; `Iter N: Train loss X` regex parses stdout and streams `data-train` parts; Recharts plots loss + reward overlay live.
- [ ] **ORCH-05** — Sentry root init with `Sentry.vercelAIIntegration()`; custom spans around each worker (`worker.${role}`, op `ai.agent`), SFT/GRPO (`training.sft`, `training.grpo`), and tool-validation sandboxes.
- [ ] **ORCH-06** — Concurrency controlled by `p-limit(15)` to respect frontier API rate limits.

### TRAIN — Fine-Tuning Pipeline (PRD §6)

- [ ] **TRAIN-01** — QLoRA SFT via `mlx_lm.lora` with config from §6.2 (rank 16, 16 layers, batch 2, seq 1024, grad-ckpt, lr 1e-5, 400 iters); wall-clock ≤ 12 min.
- [ ] **TRAIN-02** — GRPO via `mlx_lm_lora.train --train-mode grpo` on the SFT adapter (group size 4, seq 512, lr 5e-6, 150 iters, judge-jury float reward); wall-clock ≤ 5 min.
- [ ] **TRAIN-03** — `mlx_lm.fuse` merges adapter into `adapter.safetensors` (~60 MB).
- [ ] **TRAIN-04** — `xcrun devicectl device copy to` streams `adapter.safetensors` + `adapter-tools.json` to iPhone `/Documents/` in <5 s over USB-C.
- [ ] **TRAIN-05** — H0 micro-bench (50 iters, 20-example JSONL) records sec/iter and peak memory; if peak > 20 GB, pipeline auto-switches to E2B base.

### DATA — Discovery, Tools, Data-Gen, Eval-Gen (PRD §7, §9, §11)

- [ ] **DATA-01** — Discovery Worker fetches Supabase `llms.txt` / `llms/cli.txt` / `llms/guides.txt`, chunks into ~500-token windows, indexes into `CORPUS` object.
- [ ] **DATA-02** — Document-level deterministic 70/30 split (hash-based) separates train-eligible docs from held-out eval docs; no Q&A-level leakage.
- [ ] **DATA-03** — Tool-Design Swarm (4 parallel workers) produces ≥ 8 validated `DynamicToolSpec` objects for Supabase, capped at 12 tools, deduped by name.
- [ ] **DATA-04** — Every tool passes all four validation gates: JSON Schema well-formedness, `acorn` JS syntax parse, `node:vm` + `worker_threads` fuzz (10 inputs, ≥ 8 well-formed returns, 2s AbortController, 64 MB cap), trajectory self-consistency. Reject-don't-fix.
- [ ] **DATA-05** — `adapter-tools.json` manifest written with `name`, `description`, `schema`, `jsBody`, `requiresNetwork`, `exampleTrajectories` for every shipped tool.
- [ ] **DATA-06** — Data-Gen produces ≥ 1,500 valid training examples (target ~1,750 per §7.1 mix: 500 QA, 100 Evol, 800 single-turn trajectories, 200 multi-turn, 100 parallel/dependent, 50 refusal/no-tool) with ≥ 30 examples per unique tool name.
- [ ] **DATA-07** — Every `<\|tool_call\|>` arguments JSON passes `jsonschema.validate` against shipped schemas; rejections re-enter queue, never patched.
- [ ] **DATA-08** — GPT-5 judge rates generation quality (faithfulness, tool correctness, naturalness, grounding on 1–5 Likert); rejections <4 on any dimension regenerate. Gemini 2.5 Pro second-judge on 20% sample.
- [ ] **DATA-09** — Dedup: MinHash signature @ 0.7 + embedding cosine @ 0.92.
- [ ] **DATA-10** — Eval-Gen Worker produces 70 held-out items on the 30% doc split (40 factual Q&A, 10 reasoning, 15 single-turn tool-call, 5 multi-turn); generator is GPT-5 (cross-family vs. teacher).

### EVAL — Three-Way Scoring (PRD §11)

- [ ] **EVAL-01** — Three-way eval runner executes all 70 items across base, tuned, and teacher in parallel; on-device inference exposed via simple HTTP over USB-C.
- [ ] **EVAL-02** — Two-judge jury (Claude Opus 4.7 + Gemini 2.5 Pro) grades each response 0–4 × 4 dimensions (correctness, groundedness, completeness, tool-validity), averaged to 0–1 float per item. Temperature 0. Shuffled column order for positional-bias neutralization.
- [ ] **EVAL-03** — Tool-call AST match: exact tool-name match, args pass `jsonschema.validate`, canonical-value args require exact match, free-param args only need schema conformance (judge partial credit).
- [ ] **EVAL-04** — Scoreboard (Recharts): three stacked horizontal bars (Base / Tuned / Teacher) with 1-decimal numeric scores and latency stopwatch (on-device ms vs cloud round-trip ms) below.
- [ ] **EVAL-05** — Base < Tuned < Teacher ordering holds on the final run (PRD §19.3 acceptance).

### OPS — Operations & Fallback (PRD §14, §15, §18)

- [ ] **OPS-01** — H7 Tier 3 cassette: 90-second screen capture of verified working demo, triple-backed-up (laptop / USB stick / iPhone Photos).
- [ ] **OPS-02** — Fallback decision tree wired with explicit demo-time checkpoints (T-5 / 01:35 / 02:10 / 03:30 / 04:00 beats per §15.4).
- [ ] **OPS-03** — Pre-flight checklist executed at H11: battery 100%, MagSafe wired, Guided Access enabled, Airplane + Wi-Fi + Bluetooth + Cellular off (double-checked), two USB-C→HDMI dongles pre-tested, OBS scene ready, `caffeinate -dims` running, second-phone hotspot ready (laptop only).
- [ ] **OPS-04** — Dry-run #1 at H10 timed end-to-end, recorded as second backup cassette including live-training leg; total runtime ≤ 5:30, target 4:30.
- [ ] **OPS-05** — De-risk checklist from PRD §18 executed before H0 (API keys verified, web-llm#753 status checked, Gemma 4 E4B download started, iPhone charged + iOS 18.2+, USB-C→HDMI→capture path tested, Xcode 16 signing works, Sentry project live, second-phone hotspot tested, git pushed to remote).

---

## v2 Requirements (deferred stretch — PRD §2.2)

- [ ] **DEMO-06** — Second pre-cached audience-selected product (Vercel AI SDK → Zod → Hono priority) with discovery + tool-design stages cached so audience pick runs at demo time.
- [ ] **DEMO-07** — Distillation Sankey visualization (generated N → filtered M → trained → lifted X points).
- [ ] **DEMO-08** — Sentry `gen_ai` telemetry dashboard on a secondary screen.
- [ ] **DEMO-09** — On-device tool-call message bubble — distinct SwiftUI row type showing tool name, collapsed args, and result inline in chat.

---

## Out of Scope (explicit exclusions — see PROJECT.md "Out of Scope")

- PWA / WebLLM / transformers.js — web-llm#753 confirms iOS 26 Safari breaks ≥3B models.
- Voice I/O — Web Speech in WKWebView is flaky; `SpeechTranscriber` out of budget.
- Second-product live speedrun in demo — dishonest at 4B in 60s.
- Dynamic base-model architecture discovery — one pinned base + fallback only.
- Core ML / ExecuTorch conversion — MLX Swift is the only path to target throughput.
- Python application code — CLI subprocess only; zero Python files authored.
- Swift Sentry SDK on iOS — no gen_ai equivalent; not demo-critical.
- Gemma 4 vision / audio modalities — text-only.
- Per-dimension multi-judge eval — token budget.
- E2B / WebContainers / CodeSandbox for tool sandboxing — `node:vm` + `worker_threads` is sufficient.

---

## Traceability

Filled by roadmapper. Every v1 REQ maps to exactly one phase in `ROADMAP.md`.

| REQ-ID | Phase |
|--------|-------|
| *(populated by ROADMAP.md)* | |
