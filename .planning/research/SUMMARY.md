# Research Synthesis — Offline Specialist-LLM Pipeline

**Demo:** Saturday 2026-04-18 H12 · **Coding window:** ~6 h remaining
**Authoritative spec:** `PRD_SPEC.md` (§14 execution plan, §16 risk register, §19.4 conventions)
**Synthesized from:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md

---

## 1. Executive Summary

A 12-hour agentic fine-tuning pipeline that produces a 4-bit Gemma-4 E4B LoRA adapter + agent-authored JS tools, deployed via USB-C to an airplane-mode iPhone 17. Architecture is fully pinned by PRD: Next.js 15 (Node runtime) orchestrator spawns `mlx-lm` / `mlx-lm-lora` Python CLIs; AI SDK v6 coordinator/worker swarm generates corpus → tools → training data; adapter is fused and `devicectl`-copied to device; Swift/MLX-Swift app hot-swaps adapter in <2 s and dispatches tools in a per-session `JSContext`. Three fallback tiers always prepared; Tier 3 cassette at H7 is the floor.

Roadmap is constrained to 9 coarse phases mapping to H0–H11. Phase 1 is the non-negotiable kill-point gate (F02 micro-bench, F08 adapter hot-swap, F11 JS tool round-trip). After Phase 1 passes, all downstream phases become conditional-go. Critical risks are concentrated at the boundaries: tokenizer special-token handling (H2/H6), GRPO reward-fn API shape (H0/H6), devicectl silent failures (H1/H7), JSContext retain cycles on swap (H2), and solo-operator cognitive load (H10).

---

## 2. Tech Stack (condensed, with verify-at-H0 flags)

| Layer | Pin | Verify@H0 |
|---|---|---|
| Node | ≥20 (22 LTS pref) · Next `~15.5.15` (NOT 16.x) | — |
| AI SDK | `ai@^6.0.168` (NOT `ai-v6` tag → 6.0.132; NOT `beta` → 7.x) | ✅ import path `Experimental_Agent as Agent` |
| Providers | `@ai-sdk/anthropic@^3.0.71` · `@ai-sdk/openai@^3.0.53` · `@ai-sdk/google@^3.0.64` | ✅ model alias smoke test (opus-4-5/gpt-5/gemini-2.5-pro) |
| Sentry | `@sentry/nextjs@^10.49.0` (PRD floor 9.29.0 OK; 10 recommended) · `Sentry.vercelAIIntegration()` | ✅ first `gen_ai` span lands |
| Python | 3.12 venv · `mlx-lm[train]==0.31.2` · `mlx-lm-lora==0.1.0` (pin `==`, don't bump) | ✅ `mlx_lm.generate` hello + `mlx_lm.fuse --help` flags |
| iOS | Swift 5.9 · Xcode 16 · iOS 18 min · `mlx-swift-lm` 3.x (`MLXLM`/`MLXLMCommon`) · `swift-tokenizers-mlx ≥0.1.0` · `swift-hf-api-mlx ≥0.1.0` · JavaScriptCore + Network (system) | ✅ clone repo at H1, confirm product names + `LoRATrain.loadLoRAWeights` symbol |
| Entitlement | `com.apple.developer.kernel.increased-memory-limit` (paid dev acct) + extended VA | ✅ `os_proc_available_memory() >= 5 GB` on launch |
| Base model | `unsloth/gemma-4-E4B-it-UD-MLX-4bit` · fallback E2B if peak >20 GB | ✅ H0 micro-bench gate |
| Sandbox | `node:vm` + `worker_threads` · `acorn@^8` (pin `ecmaVersion: 2022`) · RSS monitor (cap 128 MB) | — |
| Misc | `zod@^3.25.76` · `zod-to-json-schema` · `p-limit@^6` · `recharts` · `chokidar` (`awaitWriteFinish`) · `eventsource-parser` · `datasketch` | — |

Install note: `mlx-lm[train]` pulls `torch` (~700 MB, 2–3 min). Do NOT start install at H0:55.

---

## 3. Table-Stakes Features (P0) by Phase Cluster

Feature IDs reference FEATURES.md. Ordering = critical path.

- **Phase 1 — Foundation (H0–H2)** · F01 venv · F02 micro-bench kill-point · F03 Next.js+Sentry · F04 3-provider smoke · F05 LLMEval fork · F06 iPhone deploy · F07 airplane-mode sanity · F08 adapter hot-swap smoke · F09 ToolRegistry+JSContext · F10 GemmaToolParser · F11 JS round-trip
- **Phase 2 — Orchestrator (H3)** · F12 `/api/pipeline` + UIMessageStream merge · F13 Coordinator/Worker harness · F14 5×4 AgentCard grid · F15 `/api/train` SSE skeleton · F16 Sentry `ai.agent` spans
- **Phase 3 — Discovery + Tool Design (H4)** · F17 Discovery worker · F18 Tool-Design swarm (4 parallel) · F19–F23 5-gate validation (JSON schema / acorn / node:vm sandbox / 10-input fuzz / trajectory self-consistency) · F24 `adapter-tools.json`
- **Phase 4 — Data + Eval Gen (H5)** · F25 QA (500) · F26 Trajectories (800+200+100+50) · F27 GPT-5 judge-gate · F28 Gemini 20% cross-judge · F29 schema-gate reject-don't-patch · F30 dedup (MinHash 0.7 + cos 0.92) · F31 ≥30/tool stratify · F32 mlx-lm tools JSONL · F33 Eval-Gen (70 items) · F34 deterministic 70/30 doc-hash split
- **Phase 5 — Train (H6)** · F35 SFT 400-iter · F36 GRPO 150-iter · F37 loss/reward overlay · F38 NaN revert
- **Phase 6 — Fuse, Deploy, Verify, Cassette (H7)** · F39 fuse · F40 devicectl copy · F41 chokidar watcher · F42 ModelState actor · F43 adapter-tools loader · F44 ChatView · F45 OnlineMonitor pill · F46 offline-error payload · F47 verified prompt battery · **F48 Tier-3 cassette (NEVER CUT)**
- **Phase 7 — 3-Way Eval (H8)** · F49 harness · F50 judge-jury · F51 BFCL-AST strict match · F52 3-way bar chart · F53 latency stopwatch · F54 auto-advance scoreboard
- **Phase 8 — Polish (H9)** · F55 Guided Access · F56 wired USB-C→HDMI→OBS · (stretch: F57 ToolCallBubble · F58 audience pre-cache · F59 Sankey · F60 Sentry dash · F61 live Model B)
- **Phase 9 — Dry-Run + Pre-Flight (H10–H11)** · ops only, not feature work

---

## 4. Anti-Features — Do-NOT-Build (hard gates for roadmapper)

| # | Reject | Why | Instead |
|---|---|---|---|
| A01 | PWA / WebLLM / transformers.js | web-llm #753 breaks ≥3B on iOS 26 Safari | Native Swift + MLX |
| A02 | llama.cpp / LM Studio | Gemma-4 tool-call format drift | mlx-lm + mlx-swift-lm |
| A03 | Core ML / ExecuTorch | Don't hit 45+ tok/s on iPhone 17 | MLX Swift |
| A04 | HF Transformers+MPS / Axolotl / LLaMA-Factory | weaker M4 Pro support | `mlx-lm` + `mlx-lm-lora` |
| A05 | Authored `.py` files | pinned CLI subprocess only | TS orchestrator + `spawn` |
| A06 | E2B / WebContainers / CodeSandbox | adds latency + external dep | `node:vm` + `worker_threads` |
| A07 | RAG / cloud fallback / hybrid | weakens airplane-mode thesis | airplane mode IS the product |
| A08 | Voice I/O | WKWebView flaky, scope blow | text-only |
| A09 | Auto-format agent JS tool bodies | training data ≠ shipped code | reject, re-prompt |
| A10 | Gemma-4 vision/audio | memory pressure | text-only |
| A11 | Per-dimension multi-judge | 1680+ judge calls — budget blow | 2-judge jury × 4-dim-averaged |
| A12 | Training >20 min wall-clock | budget is 17 min | iterate on iter count |
| A13 | Dynamic arch discovery | flaky in 12h | pin E4B + E2B fallback |
| A14 | 2nd product live speedrun | 60 s dishonest at 4B | pre-cache + narrate one pick |
| A15 | Swift Sentry `gen_ai` | no equiv for mlx-swift | laptop-side Sentry only |
| A16 | Session Replay / MCP | overkill | dashboard only |
| A17 | Secrets/PII in training corpus | verbatim-leaks at inference | scrub to public llms.txt + GH |
| A18 | Cache-break iPhone base bundle | 3 GB re-download = dead demo | stable bundle hash |
| A19 | Open audience choice | could pick uncached | constrain to pre-cached set |
| A20 | Silent cloud fallback on failure | breaks honesty contract | narrate fallback explicitly |

---

## 5. 9-Phase Architecture Split (with kill-points)

| Phase | H-band | Deliverable | Kill-point |
|---|---|---|---|
| 1 Foundation & Smoke | H0–H2 | env + bench + iOS base + hot-swap toy + JS round-trip | **F02** peak >20 GB → E2B fallback · **F08** >2 s swap → static tools · **F11** parser fails → hand-written tools |
| 2 Orchestrator Harness | H3 | coord/worker + streams + grid UI + train SSE skeleton | SSE merge broken → escalate to Tier-3 cassette early |
| 3 Discovery + Tool Design | H4 | corpus + validated `adapter-tools.json` | **F24** <4 validated tools → hand-write Supabase tools |
| 4 Data + Eval Gen | H5 | training.jsonl (≥1200 ex, dedup, stratified) + eval.jsonl (70 items) | **F32** <1200 ex → proceed with less |
| 5 Train Model A | H6 | `adapter.safetensors` (SFT + GRPO) | **F38** NaN unrecoverable → SFT-only; GRPO regression → revert checkpoint |
| 6 Fuse, Deploy, Verify, Cassette | H7 | device-verified model + **Tier-3 cassette recorded** | **F47** device battery fails → Tier 2 narration · cassette missing → abort to Tier 3 impossible |
| 7 Three-Way Eval | H8 | scoreboard + latency stopwatch | judges biased (P15) → show with disagreement log |
| 8 Polish & Pre-Cache | H9 | ToolCallBubble + pre-cache + Sentry screen | stretch only; any of F57–F61 cuttable |
| 9 Dry-Run + Pre-Flight | H10–H11 | rehearsal + checklist | cognitive-load patterns (P24) surface → rescope mid-H10 |

**Parallel-safe vs strictly serial:**
- **Parallel within Phase 1 (H0 only):** Sentry init · venv install · iOS fork · base model download · micro-bench
- **Parallel within Phase 1 (H2):** ToolRegistry + Parser can progress while Phase 2 scaffolds
- **Parallel within Phase 3 (H4):** Discovery → {Tool-Design swarm × 4} once corpus lands
- **Parallel within Phase 4 (H5):** Data-Gen-QA · Data-Gen-Traj · Eval-Gen all fan out from corpus
- **Strictly serial:** Phase 5 (SFT→GRPO) · Phase 6 (fuse→devicectl→verify→cassette) · Phase 7 (eval after deploy)
- **Single-writer rule:** fuse, devicectl copy, train subprocesses — never concurrent with each other

---

## 6. Top 10 Pitfalls → Phase Gates

| # | Pitfall | Phase | Gate to bake in |
|---|---|---|---|
| P6 | JSContext retain cycle on 2nd adapter load → OOM | 1 (H2) | Smoke must include simulated swap (load → dispose → reload); dispose context entirely per swap |
| P1 | Gemma-4 `<\|tool_call\|>` tokenizer split → atomic id not learned | 1 (H2) → 5 (H6) | H2 assertion: encode chat-template example, confirm single special-token id; data-gen invariant |
| P2 | `mlx-lm-lora==0.1.0` GRPO reward-fn signature mismatch | 1 (H0) | 5-iter GRPO smoke bolt-on at H0 with trivial reward; author `scripts/reward_bridge.py` if needed |
| P5 | `devicectl` silent copy failure (wrong domain-id / app not foregrounded / bad cable) | 1 (H1) → 6 (H7) | After every copy, `devicectl device info files` to assert size; labeled cable; app foreground during copy |
| P8 | `increased-memory-limit` entitlement not actually active | 1 (H1) | Log `os_proc_available_memory()` on launch; assert ≥5 GB; verify via `security cms -D -i embedded.mobileprovision` |
| P7 | USB-C→HDMI airplane-mode mirror fails | pre-H0 + 9 (H11) | "Trust this computer" BEFORE airplane-on; powered capture card; 10-min signal-hold test |
| P3 | GRPO collapse at group size 4 (reward variance too low) | 5 (H6) | Monitor reward variance per step; kill GRPO if var<0.01 for 10 steps → ship SFT-only; explicit `--beta 0.04` |
| P12 | `worker_threads` 64 MB cap soft (off-heap ArrayBuffer bypass) | 3 (H4) | External RSS monitor (`setInterval` check 128 MB hard cap); acorn-deny `ArrayBuffer`/`SharedArrayBuffer`/`WebAssembly`/`Atomics` |
| P13 | `acorn` accepts ES2024, iOS 18 `JSContext` rejects | 3 (H4) | Pin `ecmaVersion: 2022`; smoke every generated body through macOS `JSContext` before ship |
| P24 | Solo-operator cognitive overload | 9 (H10) | One-panel focus rule; auto-advance on training complete; 3 memorized recovery phrases; MUTE at score reveal |

Also watch: **P10** ToolLoopAgent infinite loop (set `maxSteps: 8` + 90 s wall-clock budget) · **P16** Next.js dev-mode hot-reload kills child_process (use `next build && next start` from H5:55) · **P17** `NWPathMonitor` lag (default `.offline`, 2 s grace) · **P21** `zod-to-json-schema` must be wrapped `{type:'function',function:{...}}` for mlx-lm · **P22** Anthropic TPM is org-level (add token-budget tracker).

---

## 7. Five Critical Verify-at-H0 Items (do FIRST)

1. **`mlx-lm-lora==0.1.0` GRPO API** — run 5-iter smoke with trivial length-based reward; confirm reward-fn surface (CLI flag vs Python file). If blocked, author `scripts/reward_bridge.py` bridge. (**P2**)
2. **H0 micro-bench kill-point** — 50-iter LoRA on E4B, record sec/iter + peak GB. If peak >20 GB → switch to E2B immediately. (**F02**)
3. **AI SDK v6 import surface** — confirm `Experimental_Agent as Agent` vs PRD's `ToolLoopAgent` name; lock exact beta or stable version; verify `writer.merge({sendStart:false})` shape. (**P9/P10**)
4. **Provider model aliases** — `generateText` hello against Opus 4.5/4.7, GPT-5, Gemini 2.5 Pro; providers rotate aliases. (**F04**)
5. **Base model pre-fetched to HF cache** — `mlx_lm.generate --model unsloth/gemma-4-E4B-it-UD-MLX-4bit --max-tokens 2` must not trigger a fresh ~3 GB download during the coding window. (**STACK pitfall #4**)

Bonus (H0 verify, <10 min each): `mlx_lm.fuse --help` flag surface (**P18**) · NaN-on-step-1 check with `--iters 10 --grad-checkpoint` (**P19**).

---

## 8. Recommended Roadmap Shape (9 coarse phases → H0–H11)

| Phase | Hours | Nature | Parallelism |
|---|---|---|---|
| **1 Foundation & Smoke** | H0–H2 | serial gates with parallel sub-tasks | H0 fully parallel; H1 iOS serial; H2 tooling parallel to Phase 2 scaffold |
| **2 Orchestrator Harness** | H3 | serial (single orchestrator surface) | can overlap last ~30 min with Phase 1 H2 work |
| **3 Discovery + Tool Design** | H4 | 1 serial (Discovery) → 4 parallel (Tool-Design swarm) | after corpus lands, fully parallel |
| **4 Data + Eval Gen** | H5 | parallel fan-out under coordinator | QA · Traj · Eval-Gen concurrent; gated by `p-limit(15)` + 900K TPM tracker |
| **5 Train Model A** | H6 | strictly serial (SFT → GRPO) | single-writer to disk; other phases dark |
| **6 Fuse, Deploy, Verify, Cassette** | H7 | strictly serial | single-writer to device; record cassette LAST |
| **7 Three-Way Eval** | H8 | parallel item × {base,tuned,teacher} × 2 judges | `p-limit` bounded |
| **8 Polish & Pre-Cache** | H9 | parallel stretch tasks | cuttable in any order per FEATURES.md §5 |
| **9 Dry-Run + Pre-Flight** | H10–H11 | serial ops | cassette #2 during H10 rehearsal |

**Research flags for `/gsd-plan-phase`:**
- **Needs research:** Phase 1 (P1/P2/P4/P6/P8 — verify tokenizer, GRPO CLI, mlx-swift-lm imports, entitlement mechanics) · Phase 5 (P2/P3/P19/P20 — GRPO hyperparams, NaN recovery) · Phase 6 (P5/P14/P18 — devicectl + chokidar + fuse flags)
- **Standard patterns (lighter research):** Phase 2 (SSE merge well-spec'd in PRD §10) · Phase 4 (data-gen recipe in PRD §7 explicit) · Phase 7 (eval rubric in PRD §11 explicit) · Phase 9 (ops checklist in PRD §18)

**Never cut:** F02, F08, F11, F24, F47, **F48 (cassette)** — cassette is the Tier-3 floor.
**Cut order when squeezed:** F28 → F58 → F59 → F60 → F61 → F57.

---

## 9. Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH (npm) · MEDIUM (MLX Python coords) · MEDIUM (iOS SPM) | npm versions verified; mlx-swift-lm 3.x product names need H1 clone-confirm |
| Features | HIGH | Every feature enumerated verbatim in PRD; no invention |
| Architecture | HIGH | Fully pinned in PRD §4/§8/§9/§10; this is projection, not design |
| Pitfalls | MIXED — HIGH on stable platform (JSContext, node:vm, devicectl, USB-C); LOW on 2026 package specifics (mlx-lm-lora 0.1.0, AI SDK v6 beta, mlx-swift-lm 3.x split) | Upgrade LOW→MEDIUM at H0 by 20 min reading `mlx-lm-lora` 0.1.0 README + mlx-swift-lm 3.x manifest + AI SDK v6 changelog |

**Unresolved gaps (flag during planning):**
- Exact `ToolLoopAgent` / `Experimental_Agent` import path in v6 stable — resolve at H3
- `mlx-lm-lora==0.1.0` GRPO reward-fn surface (CLI `--reward-fn-path` vs stdin bridge) — resolve at H0
- `mlx-swift-lm` 3.x product/module names post-April-2026 split — resolve at H1 via source diff
- iOS 18.2+ `Info.plist` key for increased memory class declaration — resolve at H1 via developer.apple.com
- Anthropic org-level TPM headroom at demo time — resolve via live 429 probe during H5

---

## 10. Sources

- `PRD_SPEC.md` — authoritative (§2, §4, §5.4, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §18, §19)
- `.planning/research/STACK.md` — package pins, install commands, iOS SPM, entitlements, install pitfalls
- `.planning/research/FEATURES.md` — F01–F63 catalog with dependencies and MVP cut order
- `.planning/research/ARCHITECTURE.md` — runtime topology, component contracts, data-flow, dependency matrix, patterns/anti-patterns
- `.planning/research/PITFALLS.md` — P1–P30 supplementing PRD §16 R1–R17, phase-mapped
- `CLAUDE.md` — hard constraints re-asserted

*End SUMMARY.md. Ready for `/gsd-plan-phase 1`.*
