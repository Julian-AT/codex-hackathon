# PROJECT — Offline Specialist-LLM Pipeline

> **Source of truth:** `PRD_SPEC.md`. This document is a condensed projection for planning agents. If the two disagree, PRD wins.

**Demo:** Saturday, 2026-04-18, H12. **Coding window:** ~6 hours remaining.

---

## What This Is

An agentic pipeline that takes a product (Supabase primary; Vercel AI SDK / Zod / Hono as audience picks) as input and produces a **specialized 4B-parameter Gemma 4 E4B LLM that runs fully offline on an iPhone 17 in airplane mode**, outperforming its own base model on domain-specific Q&A and approaching a frontier model's ceiling on the same narrow slice.

The final on-device model is not just a Q&A bot — it ships with **domain-specific callable tools whose JavaScript bodies were written by the pre-training agent swarm itself**, validated in `node:vm`, bundled beside the adapter, and executed on-device inside Apple's `JSContext`.

## Core Value (the ONE thing)

**A phone in airplane mode answers a Supabase expert question and invokes an agent-designed tool correctly — live on stage, with the pre-training swarm and fine-tuning loss curve visible on the laptop next to it.**

Thesis: _"Cloud AI asks you to trust it. This one doesn't have to — because it literally cannot phone home."_

## Must-Haves (Tier 1 demo, PRD §2.1)

1. Native iOS app on iPhone 17 in airplane mode serving Gemma 4 E4B (4-bit MLX quant) with zero network.
2. Fine-tuning completes live on stage in ≤17 min on M4 Pro 24 GB — SFT (400 iters) + GRPO (150 iters), loss + reward streaming to UI.
3. Tuned model correctly invokes an agent-written JS tool; tool body was authored during this run.
4. Three-way scoreboard (base vs tuned vs teacher) + latency stopwatch (on-device vs cloud).
5. Visible agent orchestration — ≥4 Coordinator/Worker swarms running in parallel with live `task-notification` cards.

## Nice-to-Haves (stretch)

6. Audience-pick second product (Vercel AI SDK / Zod / Hono) live.
7. Distillation Sankey viz.
8. Sentry `gen_ai` dashboard as secondary screen.
9. On-device tool-call message bubble inline in chat.

## Non-Goals (hard constraints, PRD §19.4)

- PWA / WebLLM / transformers.js / llama.cpp (confirmed broken at 3B+ on iOS 26 Safari — web-llm issue #753).
- HuggingFace Transformers + MPS / Axolotl / LLaMA-Factory — `mlx-lm` only.
- Python application code — Python is a pinned CLI subprocess. Zero `.py` files authored.
- Core ML / ExecuTorch — MLX Swift only hits 45+ tok/s on iPhone 17.
- E2B / WebContainers / CodeSandbox for tool sandboxing — `node:vm` + `worker_threads` only.
- Any RAG / cloud fallback / hybrid-inference affordance that weakens the airplane-mode story.
- Auto-formatting agent-generated JS tool bodies — reject, don't fix.
- Gemma 4 vision/audio modalities — text-only.
- Per-dimension multi-judge eval.
- Training runs >20 min wall-clock.
- Voice I/O (WKWebView Web Speech flaky; `SpeechTranscriber` out of 12hr scope).
- Second-product live speedrun in demo.

## Tech Stack Locks (PRD §13)

- **Runtime:** Node ≥20 / Next.js 15 App Router (`runtime='nodejs'` on routes using `child_process`). Python 3.12 venv (CLI only). Swift 5.9 / Xcode 16 / iOS 18 min target.
- **Training:** `mlx-lm==0.31.2` (SFT, fuse, generate), `mlx-lm-lora==0.1.0` (GRPO).
- **Orchestrator:** AI SDK v6 (`ToolLoopAgent`, `createUIMessageStream`, `writer.merge()`), `@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google`.
- **Observability:** `@sentry/nextjs ≥9.29.0` with `Sentry.vercelAIIntegration()` — auto `gen_ai` spans.
- **iOS:** `mlx-swift-lm` 3.x, `swift-tokenizers-mlx ≥0.1.0`, `swift-hf-api-mlx ≥0.1.0`, `JavaScriptCore`, `Network` (for `NWPathMonitor`).
- **Deploy:** `xcrun devicectl` USB-C copy.
- **Schema/sandbox:** `zod` + `zod-to-json-schema`, `jsonschema`, `p-limit` (6.x), `recharts`, `chokidar`, `eventsource-parser`, `datasketch` (Python).
- **Base model:** `unsloth/gemma-4-E4B-it-UD-MLX-4bit`. Fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit` if H0 peak training mem > 20 GB.

## Key Decisions (seeded from PRD)

| # | Decision | Rationale | Outcome |
|---|----------|-----------|---------|
| 1 | Native Swift, not PWA | web-llm issue #753 crashes iOS 26 Safari on 3B+ models; transformers.js caps <2B | Locked |
| 2 | MLX Swift over Core ML/ExecuTorch | Only path hitting 45–60 tok/s on iPhone 17 | Locked |
| 3 | `mlx-lm` + `mlx-lm-lora`, not Axolotl/LLaMA-Factory | M4 Pro support verified; Unsloth Gemma 4 MLX quants are community standard | Locked |
| 4 | Pre-bake base, stream only adapter | Base ~3 GB ships in bundle; ~60 MB adapter via `devicectl` in <3 s; hot-swap in ~2 s | Locked |
| 5 | Cross-family teacher/judge (Opus gen, GPT-5+Gemini judge) | Prevents preference leakage (arXiv 2502.01534) | Locked |
| 6 | Coordinator/Worker pattern | Lifted from Claude Code source; proven production pattern | Locked |
| 7 | Supabase as Saturday Model A product | Public `llms.txt`, 4 MB guide corpus, 5 tool families, audience-recognizable vocab | Locked |
| 8 | SFT (400 iters) → GRPO (150 iters), rank-16 LoRA, last 16 layers | Projected ~13–15 GB peak on 24 GB M4 Pro; 12 + 5 min wall-clock | Locked (H0 bench verifies) |
| 9 | Three fallback tiers (live / partial / cassette) | Operator honesty over brittle promises | Locked |
| 10 | Audience options constrained to pre-cached set | Live discovery+tool-design during demo would kill timing | Locked |

## Fallback Tiers (PRD §15)

- **Tier 1 (Full Live, ~40%):** Model A warmup + audience-picked Model B live-trained in 17 min + full scoreboard.
- **Tier 2 (Partial Live, ~50%):** Model A warmup + training visible but Model B doesn't deploy in time; narration pivots to a second Model A prompt + H8 pre-run scoreboard.
- **Tier 3 (Cassette, ~10%):** Pre-recorded 90-s video from H7 played with live narration; airplane-mode iPhone physically present.

**Current floor:** Tier 3 cassette recorded at H7 — ensures demo success even if everything else fails after that.

## Risk Top-5 (PRD §16)

1. **R2** (score 20): Total SFT+GRPO > 17 min → aggressive iter budget; 02:00 demo kill-point.
2. **R3** (16): Venue Wi-Fi flakes → hotspot; pre-cache all audience options at H9.
3. **R4** (16): Gemma 4 tool-call format drift → fine-tune on well-formed trajectories; strict stream parser; BFCL-AST enforcement.
4. **R5** (16): Solo operator overload → 8 memorized guidepost phrases; auto-advancing scoreboard.
5. **R17** (16): Friday cut forces broken smoke path → H0-H2 are explicit kill-point gates.

## Repo Layout (PRD §19.1)

```
app/          Next.js 15 App Router (api/pipeline, api/train, api/eval, api/adapter, (demo)/page.tsx, instrumentation.ts)
lib/          coordinator/, workers/, tools/, sandbox/, judge/, streams/
ios/          SpecialistApp (SwiftUI shell) + SpecialistCore (ToolRegistry, GemmaToolParser, DynamicTool, OnlineMonitor)
scripts/      micro-bench.sh, train.sh, grpo.sh, fuse.sh, deploy-adapter.sh
data/         corpus/, tools/, training/, eval/
```

## Requirements

### Validated
(None yet — greenfield project, ship to validate)

### Active
All v1 capabilities are defined in `.planning/REQUIREMENTS.md` and traced to phases in `.planning/ROADMAP.md`.

### Out of Scope
See "Non-Goals" above — hard constraints from PRD §19.4.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason.
2. Requirements validated? → Move to Validated with phase reference.
3. New requirements emerged? → Add to Active.
4. Decisions to log? → Add to Key Decisions.

**After each milestone:**
1. Full section review.
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?

---

*Last updated: 2026-04-18 after initialization. Source: `PRD_SPEC.md`.*
