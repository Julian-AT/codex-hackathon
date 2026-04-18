# Feature Landscape — Offline Specialist-LLM Pipeline

**Domain:** Agentic fine-tuning pipeline → on-device specialist LLM (hackathon demo)
**Researched:** 2026-04-18
**Source of truth:** `PRD_SPEC.md` §2, §8, §9, §10, §11, §12, §14, §15, §19.3, §19.4
**Window:** 12 hours total; H0 start → H12 demo

This catalog categorizes every capability enumerated in the PRD. No new features invented — every row maps to an explicit PRD section.

Legend:
- **Side:** `laptop` (Next.js/MLX/Python subprocess), `ios` (Swift/MLX Swift/JSContext), `both`
- **Complexity:** XS (<1h), S (1–2h), M (2–4h), L (4h+)
- **Category:** P0 table-stakes (Tier 1 must-have), P1 stretch (Tier 1 nice-to-have), ANTI (explicit non-goal)

---

## 1. Table-Stakes Features (P0) — Tier 1 Must-Haves

Without these, the demo fails. Derived from PRD §2.1 and §19.3 acceptance criteria.

### 1.1 Foundation & Smoke Tests (H0–H2)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F01 | Python 3.12 venv + `mlx-lm==0.31.2` + `mlx-lm-lora==0.1.0` install | §13, §14 H0 | Pinned CLI environment; zero `.py` authored | laptop | XS | — |
| F02 | Micro-benchmark: 50-iter LoRA on E4B, record sec/iter + peak memory | §14 H0 | Gate-decides E4B vs E2B fallback (>20 GB → switch) | laptop | S | F01 |
| F03 | Next.js 15 App Router scaffold + AI SDK v6 + Sentry init | §13, §14 H0 | `runtime='nodejs'` routes, `Sentry.vercelAIIntegration()` | laptop | S | — |
| F04 | Opus 4.7 / GPT-5 / Gemini 2.5 Pro smoke-test calls | §14 H0, §18 | Verify all three provider keys + TPM tier | laptop | XS | F03 |
| F05 | Fork `mlx-swift-examples/LLMEval`, pin to `gemma-4-E4B-it-UD-MLX-4bit` | §8.1, §14 H0 | Xcode 16, iOS 18 target, increased-memory-limit entitlement | ios | S | — |
| F06 | Deploy to physical iPhone 17 + first ~3 GB base download | §14 H1 | One-time bundle-resident base weights | ios | S | F05 |
| F07 | Airplane-mode inference sanity check | §2.1, §14 H1 | Same prompt after enabling airplane mode still generates | ios | XS | F06 |
| F08 | Adapter hot-swap smoke: fuse 50-iter adapter → `devicectl` → `LoRATrain.loadLoRAWeights` | §8.3, §14 H1 | <2 s swap, behavior observably differs from base | both | M | F02, F06 |
| F09 | `ToolRegistry` actor + `JSContext` with `nativeFetch`+`console.log` bridges | §8.2, §14 H2 | One `JSContext` per request, released after | ios | M | F06 |
| F10 | `GemmaToolParser` — regex capture of `<\|tool_call\|>…<\|tool_response\|>` stream | §5.4, §8.2, §14 H2 | Strict JSON-decode-or-retry; no format slop accepted | ios | M | F09 |
| F11 | End-to-end hand-written JS tool round-trip on device | §14 H2 | model emits call → parser → JS exec → response injected → generation continues | ios | S | F09, F10 |

### 1.2 Orchestration & UI (H3)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F12 | `/api/pipeline` route with `createUIMessageStream` + `writer.merge` | §10.4, §14 H3 | N parallel workers merged into one SSE stream | laptop | M | F03 |
| F13 | Coordinator/Worker harness (`ToolLoopAgent`, `spawnWorker` tool) | §10.1–10.3 | Coordinator delegates, never works; workers run to `task-notification` | laptop | M | F12 |
| F14 | 5×4 `AgentCard` grid with `useChat({onData})` routing by worker id | §10.4, §14 H3 | `data-agent-status` (transient) + `data-task-notification` (persistent) | laptop | S | F12 |
| F15 | `/api/train` SFT/GRPO subprocess route + regex stdout tail → `data-train` stream | §10.5, §14 H3 | `child_process.spawn` + `PYTHONUNBUFFERED=1` + readline; Recharts live loss/reward | laptop | M | F12 |
| F16 | Sentry per-worker `ai.agent` spans + training spans | §12.2 | `worker.${role}` + `training.sft`/`training.grpo` attrs | laptop | S | F03, F13 |

### 1.3 Agent Swarm — Discovery & Tool Design (H4)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F17 | Discovery Worker: `fetchLlmsTxt`, `fetchGithubTree`, `scrapeSitemap`, `chunkAndIndex` | §10.3, §14 H4, §17.1 | Pull supabase.com/llms*.txt, ~500-token windows → `CORPUS` | laptop | M | F13 |
| F18 | Tool-Design Swarm (4 parallel workers) | §9.2, §10.3, §14 H4 | Produce DynamicToolSpec: name/desc/schema/jsBody/requiresNetwork/trajectories | laptop | M | F17 |
| F19 | Tool validation gate 1 — JSON Schema well-formedness | §9.3 | `jsonschema.validate` the schema itself | laptop | XS | F18 |
| F20 | Tool validation gate 2 — JS body syntax parse (`acorn`) | §9.3 | Reject on syntax error; no auto-fix | laptop | XS | F18 |
| F21 | Tool validation gate 3 — `node:vm` + `worker_threads` sandbox execution | §9.3 | 2 s `AbortController` timeout, 64 MB cap, no `eval` | laptop | M | F18 |
| F22 | Tool validation gate 4 — 10-input fuzz test | §9.3 | All 10 must not throw; ≥8 return serializable JSON | laptop | S | F21 |
| F23 | Tool validation gate 5 — trajectory self-consistency check | §9.3 | Run jsBody with stated args, confirm result matches | laptop | S | F21 |
| F24 | `adapter-tools.json` manifest writer | §9.4 | Ships alongside `adapter.safetensors` | laptop | XS | F19–F23 |

### 1.4 Data Generation & Eval Set (H5)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F25 | Data-Gen-QA Worker — 500 grounded Q&A (Genstruct × PersonaHub, `p-limit(15)`) | §7.1, §10.3, §14 H5 | Persona × difficulty × chunk stratification | laptop | M | F17 |
| F26 | Data-Gen-Traj Worker — 800 single-turn + 200 multi-turn + 100 parallel/dependent + 50 refusal | §7.1, §10.3, §14 H5 | APIGen + APIGen-MT + When2Call; pinned to shipped tool schemas | laptop | L | F24, F25 |
| F27 | Judge-gate (GPT-5, 4-dim Likert ≥4) with regen queue on rejection | §7.2 #3 | Cross-family judge; rejections re-enter with negative-feedback addendum | laptop | M | F25, F26 |
| F28 | Cross-family judge sample (Gemini 2.5 Pro on 20% of examples) | §7.2 #4 | Jury averaging; >1-point disagreement logged | laptop | S | F27 |
| F29 | Schema-gate on every `<\|tool_call\|>` — reject-don't-patch | §7.2 #2 | Hallucinated signatures never survive | laptop | S | F26 |
| F30 | Dedup pass: MinHash 0.7 + embedding cosine 0.92 | §7.2 #5 | `datasketch` MinHash | laptop | S | F25–F26 |
| F31 | Stratification enforcement: ≥30 examples per unique tool name | §7.2 #6 | Prevents mode collapse on top tools | laptop | XS | F30 |
| F32 | mlx-lm `tools` JSONL writer | §7.3 | `messages` + `tools` OpenAI-schema format; auto chat-template | laptop | XS | F31 |
| F33 | Eval-Gen Worker — 40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool | §11.3, §14 H5 | 70 items total, GPT-5 generator (cross-family) | laptop | M | F17 |
| F34 | Deterministic 70/30 doc-level hash split + no-overlap verification | §11.2, §19.3 | Hash-based splitter; same corpus → same split | laptop | S | F17 |

### 1.5 Training & Deploy (H6–H7)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F35 | `scripts/train.sh` — SFT via `mlx_lm.lora`, 400 iters, rank 16, batch 2, seq 1024, grad-ckpt, LR 1e-5 | §6.2, §14 H6 | ~12 min wall-clock target | laptop | S | F15, F32 |
| F36 | `scripts/grpo.sh` — `mlx_lm_lora.train --train-mode grpo`, 150 iters, group 4, LR 5e-6 | §6.2, §14 H6 | Judge-jury float 0–1 reward; ~5 min | laptop | M | F35 |
| F37 | Live loss + reward overlay streaming to Recharts at 5-step cadence | §6.4, §10.5 | Same chart, two series | laptop | S | F15, F35, F36 |
| F38 | Grad clip + 100-iter checkpoint + divergence revert | §14 H6 kill-point | Recovers from NaN; falls back to SFT-only if unrecoverable | laptop | S | F35 |
| F39 | `scripts/fuse.sh` — `mlx_lm.fuse` → `adapter.safetensors` (~60 MB) | §14 H7 | Optional fallback: load adapter directly over quantized base | laptop | XS | F36 |
| F40 | `scripts/deploy-adapter.sh` — `xcrun devicectl` copy to `/Documents/` (<3 s) | §8.3, §14 H7 | USB-C wired transfer | laptop | XS | F39 |
| F41 | `chokidar` watch in Swift adapter loader UI — auto-detect new `.safetensors` | §8.2 #1 | Status pill shows current adapter | ios | S | F06 |

### 1.6 On-Device Runtime — Full (H7)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F42 | Model state actor — owns `ModelContainer`, one-time base init at app launch | §8.2 #2 | Adapter swap <2 s at runtime | ios | S | F05 |
| F43 | Adapter-tools bundle loader — reads `adapter-tools.json` at swap time, registers in `ToolRegistry` | §8.2 #6, §9.4 | Re-registers on every adapter swap | ios | S | F09, F41 |
| F44 | SwiftUI ChatView — user/assistant/tool-call message types | §8.2 #5 | Baseline; tool-call rendering is stretch (F57) | ios | S | F42 |
| F45 | `OnlineMonitor` — `NWPathMonitor` observer + status pill (green ONLINE / red OFFLINE) | §8.4, §8.5 #5 | Always visible in app UI | ios | XS | F05 |
| F46 | Offline enforcement — `requiresNetwork:true` + not satisfied → structured error payload | §8.4, §9.5 | `{"error":"This tool requires network..."}` returned in-band | ios | XS | F09, F45 |
| F47 | Verified battery of test prompts on device | §14 H7, §19.3 | RLS policy answer + schema tool call + graceful offline refusal | ios | S | F43 |
| F48 | Tier 3 cassette recording — 90 s screen capture from verified device | §14 H7, §15.3 | Triple-backed (laptop + USB + iPhone Photos) | both | XS | F47 |

### 1.7 Evaluation (H8)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F49 | 3-way eval harness — base, tuned, teacher across 70 items in parallel | §11.6, §14 H8, §19.3 | On-device reached via USB-C HTTP; cloud via AI SDK | both | M | F33, F47 |
| F50 | Judge-jury scoring (Opus 4.7 + Gemini 2.5 Pro), 0–4 Likert × 4 dims, temp=0, shuffled columns | §11.4 | Normalized 0–1 float per item | laptop | M | F49 |
| F51 | BFCL-AST strict tool-call match — name exact + `jsonschema.validate` args + canonical-value match | §11.5 | Format slop cannot grade correct | laptop | S | F33 |
| F52 | Three-way bar chart (Base / Tuned / Teacher) + numeric scores to 1 decimal | §11.6 | Recharts stacked horizontal bars | laptop | S | F50 |
| F53 | Latency stopwatch — on-device time-to-last-token vs. cloud round-trip for fixed prompt | §11.7 | Asymmetry is the point (compute-only vs. compute+net) | both | S | F49 |
| F54 | Auto-advancing scoreboard transitions | §16 R5 | Reduces operator cognitive load during narration | laptop | XS | F52 |

### 1.8 Demo-Critical Polish (H9)

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F55 | Guided Access on iPhone (triple-click lock) + airplane-mode pre-show audience reveal beat | §8.5 #1–3 | Orange icon held for 2 full seconds | ios | XS | F07 |
| F56 | Wired USB-C → HDMI → capture card → OBS mirror pipeline | §8.5 #4, §18 #5 | AirPlay fails in airplane mode; wired is only option | both | S | — |

---

## 2. Stretch Features (P1) — Tier 1 Nice-to-Haves

Add only if H9–H11 have slack. Derived from PRD §2.2 and §14 H9.

| # | Feature | PRD § | One-liner | Side | Complexity | Depends on |
|---|---------|-------|-----------|------|------------|------------|
| F57 | `ToolCallBubble` SwiftUI view — distinct inline bubble for tool invocations | §2.2 #9, §8.2 #5, §14 H9 | Shows tool name + collapsed args + result | ios | S | F44 |
| F58 | Audience-pick pre-cache (Vercel AI SDK → Zod → Hono, priority order) | §2.2 #6, §14 H9, §17.2 | Discovery + tool-design only; no training | laptop | M | F18 |
| F59 | Distillation Sankey viz (generated N → filtered M → trained → lifted X) | §2.2 #7 | Visual pipeline throughput | laptop | M | F25–F31 |
| F60 | Sentry dashboard as secondary screen with `gen_ai` spans | §2.2 #8, §12.1, §14 H9 | Pre-loaded; auto-captured from `vercelAIIntegration()` | laptop | XS | F16 |
| F61 | Live audience-picked Model B training during demo narration (17 min) | §15.1 Tier 1 | Hot-swap at the 3:15 beat | both | L | F58, F35–F40 |
| F62 | Disagreement-log human-spot-check for >1-pt judge divergence | §7.2 #4 | Log-only; not auto-acted | laptop | XS | F28 |
| F63 | H10 dry-run #1 recording (second cassette, includes live-training leg) | §14 H10 | Separate backup from H7 Tier-3 cassette | both | XS | F48 |

---

## 3. Anti-Features — Explicit Non-Goals

The agents might be tempted to build these. **Do not.** PRD §2.3 + §19.4.

| # | Anti-Feature | PRD § | Why Avoid | What to Do Instead |
|---|--------------|-------|-----------|--------------------|
| A01 | PWA / WebLLM / transformers.js path | §2.3, §4.2, §19.4 | Confirmed broken on iOS 26 Safari for ≥3 B models (web-llm #753) | Native Swift + MLX only |
| A02 | llama.cpp / LM Studio path | §2.3, §5.4, §19.4 | Tool-call format drift reported on Gemma 4 series | mlx-lm + mlx-swift-lm only |
| A03 | Core ML / ExecuTorch conversion | §2.3, §19.4 | Neither hits 45+ tok/s on iPhone 17 at 4B | MLX Swift |
| A04 | HuggingFace Transformers + MPS / Axolotl / LLaMA-Factory | §19.4 | Weaker M4 Pro support than mlx-lm | `mlx-lm` + `mlx-lm-lora` |
| A05 | Python application code (authored `.py` files) | §3 #6, §13.1, §19.4 | Pinned CLI subprocess only | TypeScript orchestrator calls `mlx_lm.*` via `child_process.spawn` |
| A06 | E2B / WebContainers / CodeSandbox sandboxing | §9.3, §19.4 | Adds latency + external dep for trusted internal output | `node:vm` + `worker_threads` |
| A07 | RAG / cloud fallback / hybrid inference | §2.3, §3 #2, §19.4 | Weakens the airplane-mode thesis | Airplane mode is the product |
| A08 | Voice I/O (Web Speech / `SpeechTranscriber`) | §2.3 | Flaky in WKWebView; out of scope for 12 h | Text-only |
| A09 | Auto-format agent-generated JS tool bodies | §19.4 | A patched body is a body the training data didn't see | Reject, re-prompt worker |
| A10 | Gemma 4 vision / audio modalities | §2.3, §19.4 | Adds memory pressure + preprocessing | Text-only |
| A11 | Per-dimension multi-judge eval | §19.4 | 1,680+ judge calls — out of budget | 2-judge jury × 4-dim-averaged |
| A12 | Training runs >20 min wall-clock | §19.4 | Demo budget is 17 min | Iterate on iter count, not time |
| A13 | Full dynamic model architecture discovery | §2.3 | Flaky in 12 h | Pin E4B + E2B fallback only |
| A14 | Second product live speedrun in demo | §2.3 | 60 s run dishonest at 4 B | Pre-cache + narrated live for one audience pick (F61) |
| A15 | Swift Sentry SDK + `gen_ai` iOS instrumentation | §12.3 | No `gen_ai` equivalent for mlx-swift | Skip; rely on laptop-side Sentry |
| A16 | Session Replay / Sentry MCP | §12.3 | Overkill for single-operator demo | Dashboard only |
| A17 | Storing secrets/PII in training corpus | §19.4 | Student model verbatim-leaks at inference | Scrub; only public llms.txt + GitHub |
| A18 | Cache-breaking the iPhone base model bundle | §19.4 | 3 GB re-download would blow the demo clock | Keep bundle hash stable |
| A19 | Offering open audience choice | §16 R14 | Could pick uncached option | Constrain to pre-cached list |
| A20 | Silent cloud fallback on inference failure | §3 #8 | Breaks the honesty contract | Narrate the fallback explicitly |

---

## 4. Feature Dependencies (critical path)

```
F01 (venv) ─► F02 (bench) ─► [E4B vs E2B decision]
F03 (Next.js) ─► F04 (API smoke) ─► F12 (pipeline route) ─► F13 (coord/worker) ─► F17 (discovery) ─► F18 (tool design) ─► F24 (adapter-tools.json)
                                                                                         │
                                                                                         ├─► F25/F26 (data-gen) ─► F27–F31 (filter) ─► F32 (JSONL) ─► F35 (SFT) ─► F36 (GRPO) ─► F39 (fuse) ─► F40 (deploy)
                                                                                         └─► F33 (eval-gen) ─────────────────────────────────────────────────────────────────────► F49 (3-way eval)

F05 (fork) ─► F06 (deploy) ─► F07 (airplane) ─► F08 (hot-swap smoke)
                         └─► F09 (ToolRegistry) ─► F10 (parser) ─► F11 (round-trip)
                                                                └─► F43 (tools loader) ─► F46 (offline enforcement) ─► F47 (verify) ─► F48 (cassette)

F40 + F41 (watch) ─► F43 ─► F47 ─► F49 ─► F52 (scoreboard) ─► F54 (transitions)
```

Hard gates (kill-points): F02 (→E2B), F08 (→Tier 3), F11 (→static tools), F24 (→hand-written tools), F32 (→proceed with less data), F38 (→SFT-only), F47 (→Tier 2/3).

---

## 5. MVP Recommendation (Tier-2 minimum)

If time collapses, ship these and only these:

**Bare-minimum Tier 2 (Supabase-only, pre-run eval):**
F01–F11 (foundation) + F12–F14 + F17–F24 (one validated swarm pass) + F25 + F32 + F33 + F35 + F39 + F40 + F42–F47 + F49 + F52 + F53 + F55 + F56.

**Defer first when squeezed:** F28, F58, F59, F60, F61, F62, F57 (in that order).

**Never cut:** F02, F08, F11, F24, F47, F48 (cassette) — cassette is the Tier-3 floor; without it the demo has no fallback.

---

## 6. Phase Mapping Hint for Roadmapper

| Suggested phase | Features | H-band |
|-----------------|----------|--------|
| Phase 1 — Foundation & Smoke | F01–F11 | H0–H2 |
| Phase 2 — Orchestrator Harness | F12–F16 | H3 |
| Phase 3 — Discovery & Tool Design | F17–F24 | H4 |
| Phase 4 — Data Gen & Eval Set | F25–F34 | H5 |
| Phase 5 — Training & Deploy | F35–F41 | H6–H7 early |
| Phase 6 — On-Device Verification + Cassette | F42–F48 | H7 |
| Phase 7 — 3-Way Eval & Scoreboard | F49–F54 | H8 |
| Phase 8 — Polish & Pre-Cache | F55–F63 | H9 |
| Phase 9 — Dry-Run + Pre-Flight | (H10–H11 ops, not feature work) | H10–H11 |

Phase 1 is the non-negotiable gate. Everything downstream is conditional on F02/F08/F11 passing.

---

## Sources

- `PRD_SPEC.md` — sections cited inline. Single source of truth.
- `CLAUDE.md` — hard-constraint reaffirmation of anti-features.
- No external research needed; this catalog is a categorization of the already-authoritative spec.

**Confidence:** HIGH — every feature is literally enumerated in the PRD; no invented capability.
