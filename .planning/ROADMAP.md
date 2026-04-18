# ROADMAP — Offline Specialist-LLM Pipeline

> **Source of truth:** `PRD_SPEC.md` §14 execution plan. This roadmap projects v1 REQs (`REQUIREMENTS.md`) onto a 9-phase, H0–H11 timeline ending in the H12 demo.

**Demo:** Saturday 2026-04-18 H12 · **Coding window remaining:** ~6 h · **Mode:** YOLO · **Granularity:** coarse · **Parallelization:** within-phase

---

## Executive Summary

Nine coarse phases execute against the PRD §14 hour-band schedule. Phase 1 is the **non-negotiable gate** — if its three kill-point REQs (FND-02, FND-08, FND-11) fail, downstream work demotes to Tier 2 or Tier 3 immediately. Phases 5 and 6 are additional kill-points (training NaN recovery; on-device verification + Tier-3 cassette). Phase 6 must end with the **cassette recorded** (DEV-07 / F48) — the demo floor.

- **v1 REQ count:** 56 (FND 11, ORC 5, SWR 8, DAT 10, TRN 7, DEV 7, EVL 6, POL 2) — every REQ owns exactly one phase.
- **Stretch REQ count:** 7 (STR-01..STR-07) — all land in Phase 8, all cuttable, cut order: STR-06 → STR-02 → STR-03 → STR-04 → STR-05 → STR-01 → STR-07.
- **Kill-point phases:** 1, 5, 6.
- **Parallelism:** fully parallel within Phases 1 (H0 sub-tasks), 3 (tool-design swarm ×4), 4 (QA + Traj + Eval-Gen fan-out), 7 (item × model × judge). Strictly serial within Phases 5, 6.
- **Never cut:** FND-02, FND-08, FND-11, SWR-08, DEV-06, **DEV-07 (cassette)**.

---

## Phases

- [ ] **Phase 1 — Foundation & Smoke (H0–H2)** — Verify env, micro-bench, iPhone base deploy, adapter hot-swap, JSContext tool round-trip.
- [ ] **Phase 2 — Orchestrator Harness (H3)** — Coordinator/Worker AI-SDK-v6 skeleton with merged SSE stream, agent grid, and train-pipe.
- [x] **Phase 3 — Discovery + Tool Design (H4)** — Supabase corpus + 4-worker tool-design swarm → validated `adapter-tools.json`. ✓ 2026-04-18
- [x] **Phase 4 — Data + Eval Gen (H5)** — 500 QA + 1,150 trajectories + 70-item eval set, judge-gated, deduped, stratified. ✓ 2026-04-18
- [ ] **Phase 5 — Train Model A (H6)** — SFT 400-iter + GRPO 150-iter on MLX, loss/reward live-streamed, NaN-safe.
- [ ] **Phase 6 — Fuse, Deploy, Verify, Cassette (H7)** — Fuse adapter → `devicectl` → on-device verify → **Tier-3 cassette recorded**.
- [ ] **Phase 7 — Three-Way Eval (H8)** — Base vs Tuned vs Teacher scoreboard + latency stopwatch.
- [ ] **Phase 8 — Polish & Pre-Cache (H9)** — Guided Access + wired mirror + stretch tasks (cuttable).
- [ ] **Phase 9 — Dry-Run + Pre-Flight (H10–H11)** — Full rehearsal, memorized narration, final air-gap check.

---

## Phase Details

### Phase 1 — Foundation & Smoke (H0–H2)
**Goal**: Prove every high-risk seam works end-to-end before we build on it: training env, iPhone base model, adapter hot-swap, JS tool round-trip.
**Depends on**: Nothing (entry phase).
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08, FND-09, FND-10, FND-11
**Success Criteria** (what must be TRUE):
  1. `mlx_lm.lora --help` responds in a fresh Python 3.12 venv and `generateText` hello calls return from Opus 4.7, GPT-5, and Gemini 2.5 Pro (FND-01, FND-04).
  2. A 50-iter LoRA micro-bench on E4B logs sec/iter and peak-mem; if peak > 20 GB, config is switched to E2B before H1 ends (FND-02 — kill-point).
  3. iPhone 17 runs Gemma 4 E4B from its sandbox with airplane mode ON, same prompt generates both before and after the toggle (FND-06, FND-07).
  4. A fused 50-iter adapter `devicectl`-copies in <3 s and hot-swaps in <2 s with observable behavior change (FND-08 — kill-point).
  5. A hand-written JS tool round-trips on device: parser captures `<|tool_call|>…<|tool_response|>`, JSContext executes, generation continues coherently (FND-09, FND-10, FND-11 — kill-point).
**Kill-Point Gates**:
  - FND-02 fails (>20 GB peak) → switch base model to E2B (keep pipeline).
  - FND-08 fails (>2 s swap or `devicectl` silent failure) → demote to Tier 2, ship static pre-trained tools only.
  - FND-11 fails (parser cannot round-trip) → demote to Tier 3 cassette early, pre-record without live tool-call beat.
**Plans**: 5 plans across 3 waves
  - [ ] 01-01-next-scaffold-sentry-providers-PLAN.md — Next.js 15 + AI SDK v6 + Sentry + 3-provider smoke (FND-03, FND-04) · wave 1
  - [ ] 01-02-python-venv-microbench-PLAN.md — Python 3.12 venv + mlx-lm install + 50-iter E4B micro-bench (FND-01, FND-02 kill-point) · wave 1
  - [ ] 01-03-ios-llmeval-fork-deploy-PLAN.md — Fork LLMEval, pin E4B, deploy to iPhone 17, airplane-mode sanity (FND-05, FND-06, FND-07) · wave 1
  - [ ] 01-04-adapter-hotswap-PLAN.md — Fuse + devicectl copy + LoRATrain.loadLoRAWeights round-trip (FND-08 kill-point) · wave 2
  - [ ] 01-05-toolregistry-parser-roundtrip-PLAN.md — ToolRegistry + GemmaToolParser + end-to-end JS tool round-trip (FND-09, FND-10, FND-11 kill-point) · wave 3
**UI hint**: yes

### Phase 2 — Orchestrator Harness (H3)
**Goal**: A coordinator/worker AI-SDK-v6 surface that fans N workers into one SSE stream, renders them in a live agent grid, and streams training loss to Recharts.
**Depends on**: Phase 1 (FND-03 Next.js scaffold, FND-04 provider keys).
**Requirements**: ORC-01, ORC-02, ORC-03, ORC-04, ORC-05
**Success Criteria**:
  1. `/api/pipeline` merges ≥2 live parallel worker streams into one client SSE via `createUIMessageStream` + `writer.merge` (ORC-01).
  2. Coordinator never does domain work; `spawnWorker` tool invokes workers that return via `task-notification`; grid visibly populates (ORC-02, ORC-03).
  3. `/api/train` spawns `mlx_lm.lora` as a child process and `data-train` parts render on a live Recharts chart (ORC-04).
  4. Every worker invocation and training step emits a Sentry `ai.agent` / `training.sft` / `training.grpo` span visible in the dashboard (ORC-05).
**Plans**: 3 plans across 2 waves
  - [ ] 02-01-pipeline-coordinator-worker-PLAN.md — /api/pipeline + coordinator/worker harness + ai.agent spans (ORC-01, ORC-02, ORC-05) · wave 1
  - [ ] 02-02-train-subprocess-loss-chart-PLAN.md — /api/train child_process + readline + LossChart + training.sft/grpo spans (ORC-04, ORC-05) · wave 1
  - [x] 02-03-agent-grid-demo-page-PLAN.md — useChat onData router + 5x4 AgentGrid + demo page (ORC-03) · wave 2
**UI hint**: yes

### Phase 3 — Discovery + Tool Design (H4)
**Goal**: Crawl the Supabase corpus and produce a validated `adapter-tools.json` manifest via a 4-worker tool-design swarm with 5 validation gates.
**Depends on**: Phase 2 (coordinator/worker harness).
**Requirements**: SWR-01, SWR-02, SWR-03, SWR-04, SWR-05, SWR-06, SWR-07, SWR-08
**Success Criteria**:
  1. `CORPUS` object holds chunked Supabase `llms*.txt` (~4 MB, ~500-token windows) (SWR-01).
  2. 4 tool-design workers complete in parallel and each emits `DynamicToolSpec` objects with ≥3 example trajectories (SWR-02).
  3. Every candidate tool passes all 5 gates (schema well-formed, `acorn` parse, `node:vm` sandbox exec with 2 s / 64 MB caps, 10-input fuzz ≥8 serializable, trajectory self-consistency) (SWR-03..SWR-07).
  4. `adapter-tools.json` on disk contains ≥8 unique validated Supabase tools, capped at 12 (SWR-08 — kill-point; <4 tools → fall back to hand-written set and narrate).
**Kill-Point Gates**:
  - SWR-08 <4 validated tools after retry → copy hand-written fallback manifest and narrate as Tier 2 (NEVER CUT).
**Plans**: 5 plans across 3 waves
  - [x] 03-01-corpus-fetch-chunk-PLAN.md — Supabase corpus fetch + chunking + shared types (SWR-01) · wave 1
  - [x] 03-02-validator-gates-PLAN.md — 5-gate validator: schema / acorn parse / node:vm sandbox / fuzz / trajectory (SWR-03..SWR-07) · wave 2
  - [x] 03-03-tool-design-worker-PLAN.md — generateObject tool-design worker with Zod DynamicToolSpec schema (SWR-02) · wave 2
  - [x] 03-05-fallback-hand-written-tools-PLAN.md — 8 hand-written Supabase tools + fallback manifest (SWR-08 kill-point safety net) · wave 2
  - [x] 03-04-swarm-pipeline-manifest-PLAN.md — 4-worker swarm + dedupe + gates + retry + manifest write + /api/discover (SWR-02, SWR-08) · wave 3

### Phase 4 — Data + Eval Gen (H5)
**Goal**: Produce the training JSONL (≥1,200 examples, judge-gated, deduped, stratified) and the 70-item held-out eval set with deterministic 70/30 split.
**Depends on**: Phase 3 (corpus + adapter-tools.json schemas).
**Requirements**: DAT-01, DAT-02, DAT-03, DAT-04, DAT-05, DAT-06, DAT-07, DAT-08, DAT-09, DAT-10
**Success Criteria**:
  1. Data-Gen-QA produces 500 grounded Q&A (persona × difficulty × chunk) and Data-Gen-Traj produces 800 single + 200 multi + 100 parallel/dependent + 50 refusal trajectories (DAT-01, DAT-02).
  2. Every `<|tool_call|>` passes `jsonschema.validate` against shipped schemas; hallucinations re-enter the queue (reject-don't-patch) (DAT-03).
  3. GPT-5 + Gemini jury filters examples to ≥4 on all 4 Likert dims, logging >1-point disagreements; MinHash 0.7 + cos 0.92 dedup runs before JSONL emission; every tool has ≥30 examples (DAT-04, DAT-05, DAT-06, DAT-07).
  4. `training.jsonl` is written in mlx-lm `tools` format (`messages` + `tools` OpenAI schema) and the 70-item `eval.jsonl` (40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool) exists with a hash-verified no-overlap 70/30 doc split (DAT-08, DAT-09, DAT-10).
**Plans**: 5 plans across 3 waves
  - [ ] 04-01-doc-split-types-personas-PLAN.md — Deterministic 70/30 hash split + Phase 4 vocabulary + persona pool + fixtures (DAT-09) · wave 1
  - [ ] 04-02-schema-gate-dedup-stratify-PLAN.md — AJV schema-gate + MinHash/cosine dedup + tool-name stratification (DAT-03, DAT-06, DAT-07) · wave 1
  - [ ] 04-03-data-gen-qa-worker-PLAN.md — 500 grounded Q&A via Opus 4.7 Genstruct x PersonaHub (DAT-01, DAT-03) · wave 2
  - [ ] 04-04-data-gen-traj-worker-PLAN.md — 800+200+100+50 trajectories via APIGen/MT/When2Call (DAT-02, DAT-03) · wave 2
  - [ ] 04-05-judge-pipeline-eval-emission-PLAN.md — Judge-jury + dedup + stratify + JSONL emission + eval-gen + /api/data-gen (DAT-04..DAT-10) · wave 3

### Phase 5 — Train Model A (H6)
**Goal**: Produce a live-trained LoRA adapter with loss and reward curves visible on the stream, within a 17-minute wall-clock budget.
**Depends on**: Phase 4 (training JSONL).
**Requirements**: TRN-01, TRN-02, TRN-03, TRN-04
**Success Criteria**:
  1. `scripts/train.sh` completes SFT (400 iters, rank 16, last 16 layers, batch 2, seq 1024, LR 1e-5) in ≤12 min (TRN-01).
  2. `scripts/grpo.sh` completes GRPO (150 iters, group 4, LR 5e-6, judge-jury float reward) in ≤5 min (TRN-02).
  3. Loss and reward stream to the same Recharts chart at 5-step cadence; reward overlays once GRPO begins (TRN-03).
  4. Grad clip on, checkpoints every 100 iters, NaN/divergence reverts; if GRPO unrecoverable, the SFT-only adapter ships (TRN-04 — kill-point).
**Kill-Point Gates**:
  - TRN-04 unrecoverable NaN during SFT → abandon training, ship previous-checkpoint adapter and narrate as Tier 2.
  - TRN-02 GRPO collapse (reward variance <0.01 for 10 steps) → kill GRPO, ship SFT-only adapter.
**Plans**: 4 plans across 3 waves
  - [ ] 05-01-smoke-and-version-bump-PLAN.md — Version pin 0.1.9 + rank-flag verify + 5-iter GRPO smoke + final iter count lock (TRN-01, TRN-02, TRN-03) · wave 1
  - [ ] 05-02-training-scripts-PLAN.md — scripts/_lib.sh + scripts/train.sh (SFT) + scripts/grpo.sh (Path A + Path C short-circuit) (TRN-01, TRN-02) · wave 2
  - [ ] 05-03-supervisor-rollback-transform-PLAN.md — TrainSupervisor NaN/spike/variance-collapse + rollback util + SFT→GRPO transform + tests (TRN-02, TRN-04) · wave 2
  - [ ] 05-04-integration-e2e-PLAN.md — Wire supervisor into /api/train, optional parser patch, E2E SFT→GRPO dry run + kill-point exercise (TRN-01, TRN-02, TRN-03, TRN-04) · wave 3
**UI hint**: yes

### Phase 6 — Fuse, Deploy, Verify, Cassette (H7)
**Goal**: Fuse the adapter, deploy to iPhone, verify the on-device behavior battery, and record the Tier-3 cassette — the demo's absolute floor.
**Depends on**: Phase 5 (adapter) and Phase 1 (iPhone base + JSContext).
**Requirements**: TRN-05, TRN-06, TRN-07, DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06, DEV-07
**Success Criteria**:
  1. `scripts/fuse.sh` writes `adapter.safetensors` (~60 MB) and the no-fuse adapter-only fallback is also confirmed working (TRN-05).
  2. `scripts/deploy-adapter.sh` copies `adapter.safetensors` + `adapter-tools.json` to `/Documents/` via `xcrun devicectl` in <5 s; iOS `chokidar` watcher shows the new adapter name in a status pill (TRN-06, TRN-07, DEV-01, DEV-02).
  3. `OnlineMonitor` pill is always visible and flips to red "OFFLINE — AIRPLANE MODE" when airplane mode is on; `requiresNetwork:true` tools return an in-band error without dispatch to JSContext (DEV-03, DEV-04, DEV-05).
  4. The verification prompt battery passes on device: RLS-policy answer, profiles-table schema tool call, graceful offline refusal (DEV-06 — kill-point).
  5. A 90-second cassette screen-capture of the verified demo is recorded and triple-backed (laptop + USB stick + iPhone Photos) **before H8 begins** (DEV-07 — NEVER CUT).
**Kill-Point Gates**:
  - DEV-06 device battery passes with <3/5 prompts correct → demote to Tier 2 narration (pre-run scoreboard).
  - DEV-07 not recorded before H8 → STOP all feature work, record cassette on whatever adapter exists, even SFT-only.
**Plans**: 3 plans across 2 waves
  - [ ] 06-01-fuse-deploy-scripts-PLAN.md — scripts/fuse.sh + enhanced deploy-adapter.sh (TRN-05, TRN-06) · wave 1
  - [ ] 06-02-ios-chatview-statuspill-toolsloader-PLAN.md — ChatView + StatusPill + AdapterToolsLoader + file watcher (TRN-07, DEV-01..DEV-05) · wave 1
  - [ ] 06-03-verify-battery-cassette-PLAN.md — On-device verification battery + Tier-3 cassette recording (DEV-06, DEV-07) · wave 2
**UI hint**: yes

### Phase 7 — Three-Way Eval (H8)
**Goal**: Generate the headline scoreboard — Base vs Tuned vs Teacher across 70 items — plus the on-device-vs-cloud latency stopwatch.
**Depends on**: Phase 6 (deployed tuned model) and Phase 4 (eval.jsonl).
**Requirements**: EVL-01, EVL-02, EVL-03, EVL-04, EVL-05, EVL-06
**Success Criteria**:
  1. The 3-way harness runs all 70 items in parallel with on-device reached via a local USB-C HTTP shim and cloud via AI SDK (EVL-01).
  2. Opus 4.7 + Gemini 2.5 Pro judge-jury produces 0–4 Likert × 4 dims (temp 0, shuffled columns) normalized per-item to 0–1; tool-call items are BFCL-AST strict-matched (EVL-02, EVL-03).
  3. Horizontal bar chart renders Base < Tuned < Teacher to 1 decimal place; latency stopwatch labels compute-only vs compute+network (EVL-04, EVL-05).
  4. Scoreboard transitions auto-advance to reduce operator load during narration (EVL-06).
**Plans**: TBD
**UI hint**: yes

### Phase 8 — Polish & Pre-Cache (H9)
**Goal**: Lock the stage-critical hardware polish (Guided Access, wired mirror) and opportunistically add stretch features while they fit.
**Depends on**: Phase 7 (scoreboard live), Phase 1 (iPhone build).
**Requirements**: POL-01, POL-02, STR-01, STR-02, STR-03, STR-04, STR-05, STR-06, STR-07
**Success Criteria**:
  1. iPhone is airplane-mode + Wi-Fi/Bluetooth/Cellular off, Guided Access locked with triple-click passcode verified (POL-01).
  2. Wired USB-C → HDMI → capture card → OBS mirror pipeline holds a signal for ≥10 min with the iPhone in airplane mode (POL-02).
  3. P1 stretch: `ToolCallBubble` renders intercepted calls inline; pre-cache worker has at least one of {Vercel AI SDK, Zod, Hono} ready; Sankey / Sentry dashboard / disagreement-log / Model-B live-train / H10 cassette ship as slack allows (STR-01..STR-07, all cuttable).
**Cut order when squeezed**: STR-06 → STR-02 → STR-03 → STR-04 → STR-05 → STR-01 → STR-07.
**Plans**: TBD
**UI hint**: yes

### Phase 9 — Dry-Run + Pre-Flight (H10–H11)
**Goal**: Rehearse the full 12-minute narration twice end-to-end, finalize memorized recovery phrases, and verify every hardware/air-gap assumption one last time.
**Depends on**: Phase 8 (hardware locks).
**Requirements**: (ops-only phase — owns no v1 REQ-IDs; validates everything in Phases 1–8)
**Success Criteria**:
  1. Dry-run #1 completes full pipeline end-to-end with no operator intervention outside the 8 memorized guidepost phrases.
  2. Dry-run #2 completes with the iPhone physically in airplane mode on the capture pipeline; training wall-clock ≤17 min, cassette fallback confirmed one-button.
  3. Pre-flight checklist (PRD §18) fully ticked: cables labeled, capture card powered, TPM budget OK, HF cache warm, Trust-This-Computer done before airplane-on.
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Smoke | 0/5 | Planned (3 waves) | - |
| 2. Orchestrator Harness | 3/3 | Code-complete (human gate pending) | 2026-04-18 |
| 3. Discovery + Tool Design | 5/5 | Complete | 2026-04-18 |
| 4. Data + Eval Gen | 5/5 | Complete | 2026-04-18 |
| 5. Train Model A | 0/4 | Planned (3 waves) | - |
| 6. Fuse, Deploy, Verify, Cassette | 0/3 | Planned (2 waves) | - |
| 7. Three-Way Eval | 0/? | Not started | - |
| 8. Polish & Pre-Cache | 0/? | Not started | - |
| 9. Dry-Run + Pre-Flight | 0/? | Not started | - |

---

## Coverage

- v1 REQs mapped: **56 / 56** ✓
- Stretch REQs mapped: **7 / 7** (all Phase 8)
- Orphans: none
- Duplicates: none
- Never-cut REQs explicit: FND-02, FND-08, FND-11 (Phase 1); SWR-08 (Phase 3); DEV-06, DEV-07 (Phase 6)

*Last updated: 2026-04-18 after Phase 4 planning.*
