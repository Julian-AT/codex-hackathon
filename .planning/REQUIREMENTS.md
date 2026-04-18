# REQUIREMENTS — Offline Specialist-LLM Pipeline (v1)

**Source of truth:** `PRD_SPEC.md`. Derived from `.planning/research/FEATURES.md` (F01–F63).
**Window:** Demo at H12 today 2026-04-18 — ~6 hrs coding remaining.
**Tier target:** Tier 2 minimum (live pipeline runs, Model A succeeds, pre-run eval scoreboard). Tier 1 (audience-pick live Model B) is stretch.

---

## v1 Requirements (Tier-1/Tier-2 must-haves)

Each requirement is atomic, user- or demo-centric, and traceable to one `F##` in FEATURES.md and one `§` in PRD_SPEC.md. REQ-ID prefix indicates category; phase mapping is filled in by roadmapper traceability.

### FND — Foundation & Smoke (P0, H0–H2)

- [ ] **FND-01**: Python 3.12 venv with `mlx-lm==0.31.2` and `mlx-lm-lora==0.1.0` is installable and the `mlx_lm.lora --help` CLI responds. *(F01 · §13, §14 H0)*
- [ ] **FND-02**: 50-iter LoRA micro-bench on `unsloth/gemma-4-E4B-it-UD-MLX-4bit` records sec/iter and peak-memory; **if peak > 20 GB, the config switches to E2B before H1**. *(F02 · §14 H0, kill-point)*
- [ ] **FND-03**: Next.js 15 App Router scaffold boots with AI SDK v6, `@sentry/nextjs` ≥9.29.0 initialized via `Sentry.vercelAIIntegration()`, and routes using `child_process` carry `export const runtime = 'nodejs'`. *(F03 · §13, §14 H0)*
- [ ] **FND-04**: One successful `generateText` call each to Claude Opus 4.7, GPT-5, and Gemini 2.5 Pro verifies provider keys and TPM tier. *(F04 · §14 H0, §18)*
- [ ] **FND-05**: `mlx-swift-examples/LLMEval` is forked, `modelConfiguration` pinned to Gemma 4 E4B (4-bit MLX Unsloth), Xcode 16 project builds for iOS 18 with `com.apple.developer.kernel.increased-memory-limit` entitlement. *(F05 · §8.1, §14 H0)*
- [ ] **FND-06**: The forked app deploys to a physical iPhone 17 and completes the one-time ~3 GB base-weight download into the app sandbox. *(F06 · §14 H1)*
- [ ] **FND-07**: After toggling airplane mode on the iPhone, the same prompt still generates — proving sandbox-resident base weights. *(F07 · §2.1, §14 H1)*
- [ ] **FND-08**: A fused 50-iter adapter is copied to the iPhone `/Documents/` via `xcrun devicectl` in <3 s and `LoRATrain.loadLoRAWeights` swaps it in <2 s with observable behavior change. *(F08 · §8.3, §14 H1, kill-point)*
- [ ] **FND-09**: A `ToolRegistry` actor wraps a single `JSContext` and registers `nativeFetch` + `console.log` bridges without leaking between requests. *(F09 · §8.2, §14 H2)*
- [ ] **FND-10**: A `GemmaToolParser` captures `<|tool_call|>…<|tool_response|>` on the streaming decoder output via regex, JSON-decodes, and rejects malformed output with a retry. *(F10 · §5.4, §8.2, §14 H2)*
- [ ] **FND-11**: A hand-written JS tool round-trips end-to-end on device: model emits call → parser captures → JSContext executes → response injected → generation continues coherently. *(F11 · §14 H2, kill-point)*

### ORC — Orchestrator Harness (P0, H3)

- [ ] **ORC-01**: `/api/pipeline` route uses `createUIMessageStream` + `writer.merge` to fan N parallel workers into one SSE stream. *(F12 · §10.4, §14 H3)*
- [ ] **ORC-02**: Coordinator/Worker harness implements the `spawnWorker` tool (AI SDK v6 agent); coordinator never performs work itself, workers return via `task-notification`. *(F13 · §10.1–§10.3)*
- [ ] **ORC-03**: Client `useChat({onData})` routes `data-agent-status` (transient) and `data-task-notification` (persistent) events into a 5×4 `AgentCard` grid keyed by worker id. *(F14 · §10.4, §14 H3)*
- [ ] **ORC-04**: `/api/train` spawns `mlx_lm.lora` and `mlx_lm_lora.train` via `child_process.spawn` with `PYTHONUNBUFFERED=1`; readline regex extracts `Iter N: Train loss X` and emits `data-train` parts that Recharts renders live. *(F15 · §10.5, §14 H3)*
- [ ] **ORC-05**: Each worker invocation is wrapped in `Sentry.startSpan({ op: 'ai.agent', name: 'worker.${role}' })`; training runs emit `training.sft` and `training.grpo` spans with per-iter loss/reward attributes. *(F16 · §12.2)*

### SWR — Discovery & Tool-Design Swarm (P0, H4)

- [ ] **SWR-01**: Discovery Worker fetches `supabase.com/llms.txt`, `llms/cli.txt`, `llms/guides.txt` (~4 MB) and indexes them into a `CORPUS` object with ~500-token chunks. *(F17 · §10.3, §14 H4, §17.1)*
- [ ] **SWR-02**: Tool-Design Swarm runs 4 parallel workers producing `DynamicToolSpec` objects with `name`, `description`, JSON Schema, JS body string, `requiresNetwork`, and ≥3 example trajectories each. *(F18 · §9.2, §10.3, §14 H4)*
- [ ] **SWR-03**: Tool validation gate — schema well-formedness via `jsonschema.validate` on the schema itself. *(F19 · §9.3)*
- [ ] **SWR-04**: Tool validation gate — JS body parses cleanly via `acorn`; syntax errors reject the worker output (no auto-fix). *(F20 · §9.3)*
- [ ] **SWR-05**: Tool validation gate — `node:vm` + `worker_threads` sandboxed execution with 2 s `AbortController` timeout and 64 MB memory cap; no `eval`, no external sandbox. *(F21 · §9.3, §19.4)*
- [ ] **SWR-06**: Tool validation gate — 10 fuzz inputs conforming to the JSON Schema are invoked against the JS body; none may throw and ≥8 return JSON-serializable objects. *(F22 · §9.3)*
- [ ] **SWR-07**: Tool validation gate — trajectory self-consistency check confirms `jsBody(call.arguments) === stated result`. *(F23 · §9.3)*
- [ ] **SWR-08**: A final `adapter-tools.json` manifest is written with ≥8 validated tools for Supabase, cap 12, no duplicates by name. *(F24 · §9.4, §19.3, kill-point)*

### DAT — Data Generation & Eval Set (P0, H5)

- [ ] **DAT-01**: Data-Gen-QA Worker produces 500 grounded Q&A via Opus 4.7 Genstruct × PersonaHub prompting under `p-limit(15)`, stratified by persona × difficulty × chunk. *(F25 · §7.1, §14 H5)*
- [ ] **DAT-02**: Data-Gen-Traj Worker produces 800 single-turn + 200 multi-turn + 100 parallel/dependent + 50 refusal trajectories via APIGen/APIGen-MT/When2Call patterns, pinned to shipped tool schemas. *(F26 · §7.1, §14 H5)*
- [ ] **DAT-03**: Every `<|tool_call|>` arguments object passes `jsonschema.validate` against the shipped tool schema; hallucinations re-enter the queue with a negative-feedback addendum (never patched). *(F29 · §7.2 #2, §19.4)*
- [ ] **DAT-04**: GPT-5 judge rates each example on 4 Likert dimensions (faithfulness, tool correctness, naturalness, grounding); examples below 4 on any dimension regenerate. *(F27 · §7.2 #3)*
- [ ] **DAT-05**: Gemini 2.5 Pro is a second judge on a 20% sample; jury scores average and >1-Likert-point disagreements are logged. *(F28 · §7.2 #4)*
- [ ] **DAT-06**: MinHash (0.7) + embedding cosine (0.92) dedup pass runs before training-JSONL emission. *(F30 · §7.2 #5)*
- [ ] **DAT-07**: Final training set enforces ≥30 examples per unique tool name to prevent mode collapse. *(F31 · §7.2 #6)*
- [ ] **DAT-08**: Training JSONL is written in mlx-lm `tools` format (`messages` + `tools` OpenAI schema) so the Gemma 4 chat template auto-applies at training time. *(F32 · §7.3, kill-point)*
- [ ] **DAT-09**: Deterministic document-level 70/30 hash-based split produces identical splits across runs, verified by hash that no eval doc appears in training. *(F34 · §11.2, §19.3)*
- [ ] **DAT-10**: Eval-Gen Worker (GPT-5 generator — cross-family) produces 40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool = 70 held-out items on the 30% doc split. *(F33 · §11.3, §14 H5)*

### TRN — Training & Deploy (P0, H6–H7 early)

- [ ] **TRN-01**: `scripts/train.sh` runs `mlx_lm.lora` SFT with: base E4B (or E2B per FND-02), rank 16, last 16 layers, batch 2, seq 1024, grad-checkpoint on, LR 1e-5, 400 iters, steps-per-report 5 — completing in ≤12 min wall-clock. *(F35 · §6.2, §14 H6)*
- [ ] **TRN-02**: `scripts/grpo.sh` runs `mlx_lm_lora.train --train-mode grpo` on the SFT adapter with group size 4, completion 512, LR 5e-6, 150 iters, judge-jury float reward — completing in ≤5 min. *(F36 · §6.2, §14 H6)*
- [ ] **TRN-03**: Loss and reward curves stream to the same Recharts chart at 5-step cadence; reward overlays loss once GRPO begins. *(F37 · §6.4, §10.5)*
- [ ] **TRN-04**: Gradient clipping is on, checkpoints emit every 100 iters, divergence/NaN reverts to last checkpoint; if unrecoverable, GRPO is skipped and SFT-only adapter ships. *(F38 · §14 H6 kill-point)*
- [ ] **TRN-05**: `scripts/fuse.sh` merges the final adapter into `adapter.safetensors` (~60 MB); the adapter-only (no-fuse) fallback path is also verified. *(F39 · §14 H7)*
- [ ] **TRN-06**: `scripts/deploy-adapter.sh` copies `adapter.safetensors` + `adapter-tools.json` to iPhone `/Documents/` via `xcrun devicectl` in <5 s. *(F40 · §8.3, §14 H7)*
- [ ] **TRN-07**: The Swift adapter-loader UI uses `chokidar`/file-watch to auto-detect the new `.safetensors` and shows a status pill with the current adapter name. *(F41 · §8.2 #1)*

### DEV — On-Device Runtime & Tier-3 Cassette (P0, H7)

- [ ] **DEV-01**: `ModelState` actor owns the `ModelContainer`, initializes base weights once at app launch (off the demo clock), and performs runtime adapter swap in <2 s. *(F42 · §8.2 #2)*
- [ ] **DEV-02**: At adapter-swap time, `adapter-tools.json` is read and every `DynamicTool` is registered into `ToolRegistry`; a previous swap's tools are fully released. *(F43 · §8.2 #6, §9.4)*
- [ ] **DEV-03**: SwiftUI `ChatView` renders user, assistant, and baseline tool-call message types. *(F44 · §8.2 #5)*
- [ ] **DEV-04**: `OnlineMonitor` wraps `NWPathMonitor` and surfaces a green "ONLINE" / red "OFFLINE — AIRPLANE MODE" status pill always visible in the app UI. *(F45 · §8.4, §8.5 #5)*
- [ ] **DEV-05**: Offline enforcement — when `requiresNetwork:true` and path status is not `.satisfied`, the registry returns `{"error":"This tool requires network. Device is offline."}` in-band without dispatching to `JSContext`. *(F46 · §8.4, §9.5)*
- [ ] **DEV-06**: A battery of verification prompts passes on device: Supabase RLS-policy answer, profiles-table schema tool call, graceful refusal of a `requiresNetwork:true` tool while offline. *(F47 · §14 H7, §19.3, kill-point)*
- [ ] **DEV-07**: A 90-second screen capture of the verified working demo is recorded and triple-backed (laptop + USB stick + iPhone Photos) — this is the Tier-3 cassette and must exist before H8 begins. *(F48 · §14 H7, §15.3, NEVER CUT)*

### EVL — 3-Way Evaluation & Scoreboard (P0, H8)

- [ ] **EVL-01**: 3-way eval harness runs Base, Tuned, and Teacher across all 70 held-out items in parallel; on-device inference is reached over USB-C via a local HTTP shim inside the Swift app, cloud models via AI SDK. *(F49 · §11.6, §14 H8)*
- [ ] **EVL-02**: Judge-jury scoring (Opus 4.7 + Gemini 2.5 Pro) uses 0–4 Likert × 4 dimensions, temperature 0, randomized column order; per-item score normalized to 0–1. *(F50 · §11.4)*
- [ ] **EVL-03**: Tool-call items are graded via BFCL-AST strict match: tool name exact, arguments pass `jsonschema.validate`, canonical-value args must exact-match. *(F51 · §11.5)*
- [ ] **EVL-04**: A three-way horizontal bar chart renders Base / Tuned / Teacher scores to 1 decimal place, with expected ordering Base < Tuned < Teacher. *(F52 · §11.6)*
- [ ] **EVL-05**: Latency stopwatch renders on-device time-to-last-token vs cloud round-trip for a fixed prompt; asymmetry is labeled as compute-only vs compute+network. *(F53 · §11.7)*
- [ ] **EVL-06**: Scoreboard transitions advance automatically to reduce solo-operator cognitive load during narration. *(F54 · §16 R5)*

### POL — Demo-Critical Polish & Stage Setup (P0)

- [ ] **POL-01**: iPhone is set to airplane mode + Wi-Fi off + Bluetooth off + Cellular off with Guided Access enabled (triple-click-to-exit passcode set) before any on-stage reveal. *(F55 · §8.5 #1–3)*
- [ ] **POL-02**: Wired USB-C → HDMI → capture card → OBS mirror pipeline is tested end-to-end with the iPhone in airplane mode. *(F56 · §8.5 #4, §18 #5)*

---

## v2 Requirements (Tier-1 stretch, add only if H9–H11 slack)

- [ ] **STR-01**: `ToolCallBubble` SwiftUI view renders intercepted tool calls inline with tool name, collapsed arguments, and result. *(F57 · §2.2 #9, §14 H9)*
- [ ] **STR-02**: Audience-pick pre-cache runs discovery + tool-design (no training, no data-gen) for Vercel AI SDK → Zod → Hono, priority order. *(F58 · §2.2 #6, §14 H9, §17.2)*
- [ ] **STR-03**: Distillation Sankey visualization shows generated N → filtered M → trained → lifted X points. *(F59 · §2.2 #7)*
- [ ] **STR-04**: Sentry dashboard with `gen_ai` spans is pre-loaded and visible as a secondary screen during demo. *(F60 · §2.2 #8, §12.1, §14 H9)*
- [ ] **STR-05**: Live audience-picked Model B trains during demo narration in ≤17 min and hot-swaps to iPhone at the 3:15 beat. *(F61 · §15.1 Tier 1)*
- [ ] **STR-06**: Judge-disagreement human-spot-check log captures >1-Likert-point divergences (log-only, not auto-acted). *(F62 · §7.2 #4)*
- [ ] **STR-07**: H10 dry-run #1 is recorded as a second cassette that includes the live-training leg (separate backup from DEV-07). *(F63 · §14 H10)*

---

## Out of Scope (PRD §19.4 Hard Constraints)

Explicit non-goals — agents MUST NOT build these. See `.planning/research/FEATURES.md` §3 for the full rationale table.

- **A01**: PWA / WebLLM / transformers.js — confirmed broken at ≥3B on iOS 26 Safari (web-llm #753).
- **A02**: llama.cpp / LM Studio — Gemma 4 tool-call format drift.
- **A03**: Core ML / ExecuTorch — insufficient throughput on iPhone 17.
- **A04**: HuggingFace Transformers+MPS / Axolotl / LLaMA-Factory — weaker M4 Pro support than mlx-lm.
- **A05**: Authored Python code — `.py` subprocesses only.
- **A06**: E2B / WebContainers / CodeSandbox — `node:vm` + `worker_threads` only.
- **A07**: RAG / cloud fallback / hybrid inference — weakens airplane-mode thesis.
- **A08**: Voice I/O — out of 12 h scope.
- **A09**: Auto-formatting agent-generated JS tool bodies — reject, don't fix.
- **A10**: Vision / audio modalities on Gemma 4 — text-only.
- **A11**: Per-dimension multi-judge eval — out of token budget.
- **A12**: Training runs >20 min wall-clock — iterate iter count.
- **A13**: Full dynamic base-model architecture discovery — pin E4B + E2B fallback only.
- **A14**: Live second-product speedrun — pre-cache only.
- **A15**: Swift Sentry SDK / iOS `gen_ai` instrumentation — laptop-side only.
- **A16**: Session Replay / Sentry MCP — unnecessary.
- **A17**: Secrets/PII in training corpus — student model verbatim-leaks.
- **A18**: Re-downloading base weights at demo — keep bundle hash stable.
- **A19**: Open audience choice — constrain to pre-cached list.
- **A20**: Silent cloud fallback on inference failure — narrate fallback explicitly.

---

## Traceability

Maps each REQ-ID to its owning phase and primary success criterion. Coverage: **56/56 v1 REQs mapped** + **7/7 stretch REQs mapped**. No orphans, no duplicates.

| REQ-ID | Phase | Success Criterion |
|--------|-------|-------------------|
| FND-01 | Phase 1 — Foundation & Smoke (H0–H2) | venv + `mlx_lm.lora --help` responds |
| FND-02 | Phase 1 — Foundation & Smoke (H0–H2) | 50-iter bench logs sec/iter + peak-mem; E2B fallback if >20 GB **(kill-point)** |
| FND-03 | Phase 1 — Foundation & Smoke (H0–H2) | Next.js 15 + AI SDK v6 + Sentry boots; `runtime='nodejs'` on child_process routes |
| FND-04 | Phase 1 — Foundation & Smoke (H0–H2) | Opus 4.7 + GPT-5 + Gemini 2.5 Pro `generateText` hellos pass |
| FND-05 | Phase 1 — Foundation & Smoke (H0–H2) | Forked LLMEval builds for iOS 18 w/ increased-memory-limit entitlement |
| FND-06 | Phase 1 — Foundation & Smoke (H0–H2) | iPhone 17 deploy + first ~3 GB base-weight download |
| FND-07 | Phase 1 — Foundation & Smoke (H0–H2) | Same prompt generates before and after airplane mode toggle |
| FND-08 | Phase 1 — Foundation & Smoke (H0–H2) | devicectl copy <3 s + `loadLoRAWeights` swap <2 s, behavior change **(kill-point)** |
| FND-09 | Phase 1 — Foundation & Smoke (H0–H2) | `ToolRegistry` actor + JSContext with no cross-request leaks |
| FND-10 | Phase 1 — Foundation & Smoke (H0–H2) | `GemmaToolParser` regex-captures tool-call + rejects malformed |
| FND-11 | Phase 1 — Foundation & Smoke (H0–H2) | End-to-end hand-written JS tool round-trip on device **(kill-point)** |
| ORC-01 | Phase 2 — Orchestrator Harness (H3) | `/api/pipeline` merges parallel worker streams into one SSE |
| ORC-02 | Phase 2 — Orchestrator Harness (H3) | Coordinator never works; workers return via `task-notification` |
| ORC-03 | Phase 2 — Orchestrator Harness (H3) | 5×4 `AgentCard` grid renders live `useChat({onData})` events |
| ORC-04 | Phase 2 — Orchestrator Harness (H3) | `/api/train` streams `data-train` parts from `mlx_lm` child process to Recharts |
| ORC-05 | Phase 2 — Orchestrator Harness (H3) | Sentry `ai.agent` + `training.sft/grpo` spans land in dashboard |
| SWR-01 | Phase 3 — Discovery + Tool Design (H4) | Supabase `llms*.txt` chunked into `CORPUS` (~500-token windows) |
| SWR-02 | Phase 3 — Discovery + Tool Design (H4) | 4 parallel workers emit `DynamicToolSpec` with ≥3 trajectories each |
| SWR-03 | Phase 3 — Discovery + Tool Design (H4) | Schema well-formedness gate passes |
| SWR-04 | Phase 3 — Discovery + Tool Design (H4) | `acorn` parse gate passes (no auto-fix) |
| SWR-05 | Phase 3 — Discovery + Tool Design (H4) | `node:vm` + `worker_threads` sandbox exec with 2 s / 64 MB caps |
| SWR-06 | Phase 3 — Discovery + Tool Design (H4) | 10-input fuzz: none throw, ≥8 JSON-serializable |
| SWR-07 | Phase 3 — Discovery + Tool Design (H4) | Trajectory self-consistency check passes |
| SWR-08 | Phase 3 — Discovery + Tool Design (H4) | `adapter-tools.json` ≥8 validated tools (cap 12) **(kill-point)** |
| DAT-01 | Phase 4 — Data + Eval Gen (H5) | 500 grounded Q&A under `p-limit(15)`, stratified |
| DAT-02 | Phase 4 — Data + Eval Gen (H5) | 800 single + 200 multi + 100 parallel/dep + 50 refusal trajectories |
| DAT-03 | Phase 4 — Data + Eval Gen (H5) | Every `<\|tool_call\|>` passes `jsonschema.validate` — reject, don't patch |
| DAT-04 | Phase 4 — Data + Eval Gen (H5) | GPT-5 4-dim Likert ≥4 judge-gate; rejects regenerate |
| DAT-05 | Phase 4 — Data + Eval Gen (H5) | Gemini 20% cross-judge + >1-pt disagreement log |
| DAT-06 | Phase 4 — Data + Eval Gen (H5) | MinHash 0.7 + cosine 0.92 dedup before JSONL emission |
| DAT-07 | Phase 4 — Data + Eval Gen (H5) | ≥30 examples per unique tool name enforced |
| DAT-08 | Phase 4 — Data + Eval Gen (H5) | `training.jsonl` in mlx-lm `tools` format **(kill-point)** |
| DAT-09 | Phase 4 — Data + Eval Gen (H5) | Deterministic 70/30 doc-hash split, no overlap (hash-verified) |
| DAT-10 | Phase 4 — Data + Eval Gen (H5) | 70-item `eval.jsonl` on 30% split (40/10/15/5) |
| TRN-01 | Phase 5 — Train Model A (H6) | SFT 400-iter completes in ≤12 min wall-clock |
| TRN-02 | Phase 5 — Train Model A (H6) | GRPO 150-iter completes in ≤5 min with judge-jury reward |
| TRN-03 | Phase 5 — Train Model A (H6) | Loss + reward stream to same Recharts chart at 5-step cadence |
| TRN-04 | Phase 5 — Train Model A (H6) | Grad clip + 100-iter ckpt + NaN revert; SFT-only fallback **(kill-point)** |
| TRN-05 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `fuse.sh` emits `adapter.safetensors`; no-fuse fallback also verified |
| TRN-06 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `devicectl` copy of adapter + tools to iPhone `/Documents/` in <5 s |
| TRN-07 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `chokidar` watcher updates adapter-name status pill on device |
| DEV-01 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `ModelState` actor one-time base init + <2 s runtime swap |
| DEV-02 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `adapter-tools.json` re-registers into `ToolRegistry` on every swap |
| DEV-03 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `ChatView` renders user / assistant / tool-call message types |
| DEV-04 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `OnlineMonitor` pill always visible (green ONLINE / red OFFLINE) |
| DEV-05 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | `requiresNetwork:true` + offline → in-band error payload, no JSContext dispatch |
| DEV-06 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | RLS answer + schema tool call + graceful offline refusal all pass **(kill-point)** |
| DEV-07 | Phase 6 — Fuse, Deploy, Verify, Cassette (H7) | 90-s Tier-3 cassette triple-backed before H8 begins **(NEVER CUT)** |
| EVL-01 | Phase 7 — Three-Way Eval (H8) | 3-way harness runs 70 items in parallel (on-device via USB-C shim + cloud) |
| EVL-02 | Phase 7 — Three-Way Eval (H8) | Opus+Gemini jury: 0–4 Likert × 4 dims, temp 0, shuffled, normalized |
| EVL-03 | Phase 7 — Three-Way Eval (H8) | BFCL-AST strict match on tool-call items |
| EVL-04 | Phase 7 — Three-Way Eval (H8) | 3-way bar chart renders Base < Tuned < Teacher to 1 decimal |
| EVL-05 | Phase 7 — Three-Way Eval (H8) | Latency stopwatch: on-device TTLT vs cloud RTT, labeled |
| EVL-06 | Phase 7 — Three-Way Eval (H8) | Scoreboard transitions auto-advance |
| POL-01 | Phase 8 — Polish & Pre-Cache (H9) | Airplane/Wi-Fi/BT/Cell off + Guided Access locked before on-stage reveal |
| POL-02 | Phase 8 — Polish & Pre-Cache (H9) | USB-C → HDMI → capture card → OBS mirror holds signal in airplane mode |
| STR-01 | Phase 8 — Polish & Pre-Cache (H9) | `ToolCallBubble` renders inline tool invocations *(stretch, cuttable)* |
| STR-02 | Phase 8 — Polish & Pre-Cache (H9) | Audience-pick pre-cache for Vercel AI SDK → Zod → Hono *(stretch, cuttable)* |
| STR-03 | Phase 8 — Polish & Pre-Cache (H9) | Distillation Sankey viz shows N→M→trained→lift *(stretch, cuttable)* |
| STR-04 | Phase 8 — Polish & Pre-Cache (H9) | Sentry `gen_ai` dashboard loaded as secondary screen *(stretch, cuttable)* |
| STR-05 | Phase 8 — Polish & Pre-Cache (H9) | Live Model B trains in demo in ≤17 min + hot-swap at 3:15 *(stretch, cuttable)* |
| STR-06 | Phase 8 — Polish & Pre-Cache (H9) | Judge-disagreement spot-check log captures >1-pt divergences *(stretch, cuttable)* |
| STR-07 | Phase 8 — Polish & Pre-Cache (H9) | H10 dry-run #1 recorded as second cassette w/ live-train leg *(stretch, cuttable)* |

**Phase 9 — Dry-Run + Pre-Flight (H10–H11)** owns no individual REQ-IDs; it is a rehearsal/ops phase that exercises Phases 1–8 end-to-end.

---

## Requirement Quality

- Every v1 requirement traces to exactly one `F##` feature in FEATURES.md and at least one PRD section. No invented capabilities.
- Requirements are atomic, testable, and either (a) produce a concrete artifact (JSONL, `.safetensors`, `adapter-tools.json`, screen capture) or (b) produce an observable demo behavior.
- Kill-point requirements (FND-02, FND-08, FND-11, SWR-08, DAT-08, TRN-04, DEV-06, DEV-07) have explicit escape hatches baked into their text — if the primary path fails, the fallback path is named.

*Last updated: 2026-04-18 after roadmap creation. Source: `PRD_SPEC.md` via `.planning/research/FEATURES.md`.*
