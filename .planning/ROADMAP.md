# ROADMAP — Offline Specialist-LLM Pipeline

> 5 coarse phases mapped to the 12-hour execution plan in `PRD_SPEC.md` §14. Every v1 REQ is covered exactly once. Kill-points from §14 are preserved inside each phase's success criteria.

**Granularity:** coarse. **Parallelization:** on. **Mode:** yolo.

## Phase Summary

| # | Phase | Time-box | Goal | Requirements | Success Criteria |
|---|-------|----------|------|--------------|------------------|
| 1 | Foundation & Smoke Tests | H0 – H2 | Prove the critical load-bearing paths (training memory, adapter hot-swap, JS tool round-trip) before investing in orchestration or data-gen | TRAIN-05, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, OPS-05 | 5 |
| 2 | Orchestrator Harness | H3 | Stand up the Coordinator/Worker streaming UI and training subprocess wiring so every subsequent swarm and training run is observable | ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06 | 4 |
| 3 | Discovery, Tools, Data, Eval-Gen | H4 – H5 | Produce Supabase corpus, 8+ validated agent-authored tools, ≥1,500 training examples, and 70 held-out eval items | DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09, DATA-10 | 5 |
| 4 | Train → Deploy → Verify Model A | H6 – H7 | Run SFT+GRPO inside 17 min, fuse, deploy to iPhone, verify tool-calls work on device in airplane mode, record Tier 3 cassette | TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, DEMO-01, DEMO-02, DEMO-03, OPS-01 | 5 |
| 5 | Eval, Polish, Dry-Run, Pre-Flight | H8 – H11 | Produce the three-way scoreboard, rehearse the demo end-to-end, and lock the pre-flight checklist | EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, DEMO-04, DEMO-05, OPS-02, OPS-03, OPS-04 | 4 |

**Phase count:** 5. **v1 requirements mapped:** 33/33. **Coverage:** 100% ✓.

---

## Phase 1 — Foundation & Smoke Tests

**Time-box:** H0 – H2 (3 hours).
**Goal:** Prove three load-bearing paths before committing to the orchestration build: (a) Gemma 4 E4B QLoRA fits in 24 GB on M4 Pro, (b) a fused adapter can hot-swap on iPhone 17 over USB-C, (c) a `<|tool_call|>` token round-trips through `JSContext`. Any failure here re-shapes the entire remaining 9 hours.
**UI hint:** yes (iPhone app view; no laptop demo UI yet).

**Requirements:** TRAIN-05, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, OPS-05.

**Success criteria:**
1. H0 micro-bench completes on `unsloth/gemma-4-E4B-it-UD-MLX-4bit` with 50 iters + 20-example JSONL, records sec/iter and peak memory, and the decision (stay on E4B vs. fall back to E2B) is recorded in `STATE.md`.
2. LLMEval fork runs on physical iPhone 17 in airplane mode, base weights resident in app sandbox, one prompt generates at ≥ 40 tok/s.
3. A 50-iter toy adapter fuses, copies via `xcrun devicectl`, loads via `LoRATrain.loadLoRAWeights`, and visibly changes model behavior vs. the base.
4. `ToolRegistry` + `GemmaToolParser` execute a hand-written JS tool end-to-end on device: model emits `<|tool_call|>`, parser catches, JSContext dispatches, response injected back, generation continues coherently.
5. De-risk checklist (PRD §18) fully green: API keys verified, web-llm#753 still open (expected), Gemma 4 E4B download started, iPhone charged + iOS 18.2+, USB-C→HDMI→capture card pipeline tested in airplane mode, Xcode 16 signing works, Sentry project live, hotspot tested, git pushed.

**Kill-points (preserved from §14):**
- End of H0: peak training memory > 20 GB → swap every reference to E2B, re-download weights, re-bench before continuing.
- End of H1: adapter hot-swap dead even on the fallback "no-fuse" path → Tier 3 cassette becomes primary plan.
- End of H2: tool round-trip dead on device → fall back to static pre-baked Swift tools (DEMO-03 degrades to hand-written static tool demonstrating the same format).

**Plans:** 5 plans

Plans:
- [ ] 01-01-PLAN.md — OPS-05 de-risk checklist (API keys, iPhone trust, capture pipeline, Gemma download)
- [ ] 01-02-PLAN.md — TRAIN-05 H0 micro-bench + E4B/E2B decision
- [ ] 01-03-PLAN.md — PLAT-01 + PLAT-07 LLMEval fork → Gemma 4 on-device ≥40 tok/s
- [ ] 01-04-PLAN.md — PLAT-02 + PLAT-06 adapter fuse + devicectl copy + hot-swap
- [ ] 01-05-PLAN.md — PLAT-03 + PLAT-04 + PLAT-05 JSContext tool round-trip + offline pill

---

## Phase 2 — Orchestrator Harness

**Time-box:** H3 (1 hour).
**Goal:** Stand up the Next.js + AI SDK v6 streaming UI, the Coordinator/Worker harness, the training-subprocess loss pipe, and Sentry spans — so every downstream swarm and training run produces live observable output.
**UI hint:** yes (laptop demo UI — agent grid, loss curve placeholder, scoreboard placeholder).

**Requirements:** ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06.

**Success criteria:**
1. `/api/pipeline` route emits `createUIMessageStream`, with a test harness spawning 4 parallel no-op `ToolLoopAgent` workers that each push `data-agent-status` then `data-task-notification`.
2. Client `useChat({onData})` routes events by worker id into a 5×4 `AgentCard` grid; status messages mark `transient:true`, terminal results `transient:false`.
3. `/api/train` spawns a throwaway `mlx_lm.lora` subprocess against the 50-iter toy dataset from Phase 1, `PYTHONUNBUFFERED=1`, and `Iter N: Train loss X` regex-parsed lines render live in Recharts.
4. Sentry dashboard shows `worker.*` spans for each of the 4 test workers and a `training.sft` span for the toy run; `p-limit(15)` ceiling observed when N>15 workers are spawned in a stress test.

**Kill-point (from §14 H3):** no functional streaming UI → continue with a minimal UI (degrades demo polish, not demo core).

---

## Phase 3 — Discovery, Tools, Data, Eval-Gen

**Time-box:** H4 – H5 (2 hours).
**Goal:** Ingest Supabase docs, produce 8+ validated agent-authored tools, synthesize ≥1,500 judge-gated training examples, and generate 70 held-out eval items on a disjoint doc split — all via visible parallel swarms.
**UI hint:** yes (agent grid comes alive with Discovery, Tool-Design, Data-Gen, Eval-Gen lanes; tool-validation sandbox spans in Sentry).

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09, DATA-10.

**Success criteria:**
1. Discovery Worker chunks `supabase.com/llms.txt` + `llms/cli.txt` + `llms/guides.txt` into ~500-token windows and writes a `CORPUS` object to `data/corpus/`; hash-based 70/30 train/eval document split persists alongside.
2. Tool-Design Swarm (4 parallel workers) produces `adapter-tools.json` containing ≥ 8 tools (capped at 12), every one having passed all four validation gates (schema well-formedness, `acorn` syntax parse, `node:vm` fuzz with ≥ 8/10 well-formed returns, trajectory self-consistency). Rejected tools leave Sentry breadcrumbs; no auto-fix.
3. Data-Gen Workers write ≥ 1,500 (target ~1,750) training examples to `data/training/` as mlx-lm `tools`-format JSONL, every `<|tool_call|>` arg passes `jsonschema.validate`, GPT-5 judge ≥ 4 on every dimension, Gemini 2.5 Pro second-judge disagreements logged, MinHash + embedding dedup removes < 10% as duplicates, ≥ 30 examples per unique tool name.
4. Eval-Gen Worker writes 70 held-out items (40 factual / 10 reasoning / 15 single-turn tool / 5 multi-turn) to `data/eval/` from the 30% doc split; no overlap with training docs verified by hash.
5. Every worker's lifecycle — status + terminal — appears in the `AgentCard` grid and in Sentry as `worker.${role}` spans.

**Kill-point (from §14 H4 + H5):** < 4 validated tools → hand-write 4 known-good Supabase tool specs (`searchKnowledge`, `lookupRecord`, `filterList`, `formatResponse`) as backstop. < 1,200 valid training examples → proceed anyway with reduced dataset.

---

## Phase 4 — Train → Deploy → Verify Model A

**Time-box:** H6 – H7 (2 hours).
**Goal:** Run the SFT+GRPO pipeline end-to-end inside the 17-minute wall-clock target, fuse the adapter, stream it to the iPhone, verify it makes correct Supabase-specific responses and tool-calls in airplane mode, and record the Tier 3 cassette. This is the Tier 2 guarantee — from here everything is polish.
**UI hint:** yes (live loss + reward curves; on-device generation shown via wired USB-C mirror).

**Requirements:** TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, DEMO-01, DEMO-02, DEMO-03, OPS-01.

**Success criteria:**
1. `mlx_lm.lora` runs the canonical §6.2 config for 400 iters in ≤ 12 min; training loss drops monotonically (within expected variance) and streams to the UI Recharts at 5-step intervals; any NaN triggers revert-to-last-checkpoint.
2. `mlx_lm_lora.train --train-mode grpo` runs for 150 iters in ≤ 5 min with group size 4 and judge-jury float reward; final reward > initial reward; reward curve overlays the SFT loss curve in the same chart.
3. `mlx_lm.fuse` produces `adapter.safetensors` (~60 MB); `xcrun devicectl device copy to` lands both `adapter.safetensors` and `adapter-tools.json` in iPhone `/Documents/` in <5 s; hot-swap completes in <2 s. Fallback adapter-only path (no fuse) also works end-to-end (smoke-tested once).
4. On-device verification battery: (a) correct Supabase-specific answer to "Write an RLS policy for a users table." (b) correct tool invocation for "Show me the schema for the profiles table." (c) graceful refusal for a `requiresNetwork:true` tool with airplane mode on — matching the "I'd need to check live data, which isn't available offline, but here's the logic" pattern the training data taught.
5. 90-second screen capture of the verified working demo saved to laptop + USB stick + iPhone Photos as the Tier 3 cassette.

**Kill-point (from §14 H6 + H7):** Loss NaN / unrecoverable divergence → revert to last 100-iter checkpoint; if still broken, ship SFT-only Model A (skip GRPO). Any failure here locks us to Tier 3 for the final run but the cassette guarantees the demo still happens.

---

## Phase 5 — Eval, Polish, Dry-Run, Pre-Flight

**Time-box:** H8 – H11 (4 hours).
**Goal:** Produce the three-way scoreboard that tells the story in 5 seconds, land the on-device tool-call bubble for narrative punch, pre-cache at least one audience-pick option, rehearse the full run twice, and lock the pre-flight checklist.
**UI hint:** yes (scoreboard, tool-call bubble, Sentry secondary screen).

**Requirements:** EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, DEMO-04, DEMO-05, OPS-02, OPS-03, OPS-04.

**Success criteria:**
1. Three-way eval runner executes 70 items across base / tuned / teacher in parallel (on-device via a tiny HTTP server over USB-C; cloud via AI SDK), two-judge jury (Opus + Gemini) grades with tool-call AST match, and the scoreboard shows Base < Tuned < Teacher with 1-decimal numeric scores and the on-device-vs-cloud latency stopwatch.
2. `ToolCallBubble` SwiftUI view lands — tool calls intercepted during on-device generation render inline in chat with tool name, collapsed args, and result. Sentry `gen_ai` dashboard loads and pins as a secondary screen. At least Vercel AI SDK is pre-cached (discovery + tool-design stages only) for audience pick; Zod/Hono cached if time permits.
3. Dry-run #1 at H10 runs end-to-end on the hardware stack that will ship, is recorded as a second backup cassette including the live-training leg, total runtime ≤ 5:30 (target 4:30); every jank (flashing transitions, unexplained delays, unreadable projector text) is logged for H11 fixes.
4. H11 pre-flight checklist fully green: iPhone battery 100% + MagSafe wired, Guided Access enabled with triple-click-exit passcode, Airplane + Wi-Fi + Bluetooth + Cellular all off and double-checked, two USB-C→HDMI dongles pre-tested, capture card + OBS scene rehearsed, `caffeinate -dims` running on laptop, second-phone hotspot tested (for laptop only — never the demo phone). Fallback decision tree printed and within reach.

**Kill-points (from §14 H8 – H11):**
- H8 scoreboard shows unexpected gap ordering → debug judge rubric before proceeding (likely prompt disagreement).
- H9 short on time → constrain audience pick to Vercel AI SDK only; drop Sankey and Sentry-as-secondary-screen stretches.
- H10 total runtime > 5:30 → cut stretch content (Sankey, dashboard) to hit 4:30.
- H11 any pre-flight item fails → Tier 3 cassette becomes primary plan.

---

## Traceability (inverse map)

| REQ-ID | Phase |
|--------|-------|
| DEMO-01, DEMO-02, DEMO-03 | 4 |
| DEMO-04, DEMO-05 | 5 |
| DEMO-06, DEMO-07, DEMO-08, DEMO-09 | v2 (deferred) |
| PLAT-01 … PLAT-07 | 1 |
| ORCH-01 … ORCH-06 | 2 |
| TRAIN-01 … TRAIN-04 | 4 |
| TRAIN-05 | 1 |
| DATA-01 … DATA-10 | 3 |
| EVAL-01 … EVAL-05 | 5 |
| OPS-01 | 4 |
| OPS-02, OPS-03, OPS-04 | 5 |
| OPS-05 | 1 |

**Coverage check:** 33 v1 requirements × 1 phase each = 33 mappings. No duplicates. No orphans. ✓

---

## Demo (H12) — not a build phase

The H12 slot is live delivery, not a planning phase. Decision tree per PRD §15.4 drives Tier 1 / Tier 2 / Tier 3 selection at run-time:
- **T-5 min:** phone airplane mode + USB-C mirror OK? else Tier 3.
- **01:35:** first agent lit up? else silent Tier 2 language.
- **02:10:** tool-call token parsed? else re-prompt once, then Tier 3 at 02:20.
- **03:30:** Model B adapter loaded? else Tier 2 (second Model A prompt).
- **04:00:** close — cassette or live, operator narrates.
