# PROJECT — Offline Specialist-LLM Pipeline

> **Authoritative source:** [`PRD_SPEC.md`](../PRD_SPEC.md). This file is a planning-layer summary. If they disagree, PRD_SPEC.md wins.

## What This Is

An agentic pipeline that ingests a product (Supabase primary; Vercel AI SDK / Zod / Hono as audience-pick stretch) and produces a **specialized 4B-parameter Gemma 4 E4B model that runs fully offline on iPhone 17**, outperforming its base on domain-specific Q&A and approaching a frontier model's ceiling on that narrow slice.

The on-device model ships with **domain-specific callable tools whose JavaScript bodies were written by the pre-training agent swarm itself** — shipped alongside the fine-tuned LoRA adapter and executed on-device inside Apple's `JSContext`.

Pipeline is composed of visible agent swarms running live during the demo. Teacher: Claude Opus 4.7. Judge jury: GPT-5 + Gemini 2.5 Pro (cross-family anti-leakage). QLoRA fine-tuning runs locally on an M4 Pro 24 GB MacBook in ≤ 17 minutes. Fused adapter streams to iPhone over USB-C and hot-swaps into a pre-baked native Swift app. Phone is in airplane mode before the demo begins.

**Thesis:** _Cloud AI asks you to trust it. This one doesn't have to — because it literally cannot phone home._

## Core Value

**The ONE thing that must work:** A tuned Gemma 4 E4B adapter runs on an airplane-mode iPhone 17 and correctly invokes an agent-written tool on a domain-specific question, with the audience watching the three-way scoreboard show tuned ≫ base.

Everything else is supporting evidence.

## Context

- **Format:** Hackathon demo. 12 hours to build, single-shot live delivery at H12.
- **Operator:** Solo. All narration + orchestration by one person.
- **Hardware:** MacBook Pro M4 Pro 24 GB (training), iPhone 17 A19 (inference, airplane mode), USB-C → HDMI → capture card → OBS mirror.
- **Budget:** Teacher API tokens unlimited during build. Cross-family redundancy (Anthropic + OpenAI + Gemini) against rate limits.
- **Friday prep time is lost.** Saturday is H0→H12 hard with no slack.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Base: `unsloth/gemma-4-E4B-it-UD-MLX-4bit` (fallback E2B) | Apache-2.0, 45–60 tok/s on iPhone 17, native `<\|tool_call\|>` tokens, day-one MLX support | — Pending H0 micro-bench |
| Fine-tune stack: `mlx-lm==0.31.2` SFT + `mlx-lm-lora==0.1.0` GRPO | Only confirmed M4 path hitting target wall-clock; GRPO converges <5 min for our group | — Pending |
| iOS: Native Swift fork of `mlx-swift-examples/LLMEval` | PWA/WebLLM confirmed broken for ≥3B on iOS 26 Safari (web-llm#753) | — Pending |
| Tool sandbox: `node:vm` + `worker_threads` | No E2B / WebContainers — zero external dependency, 2s AbortController, 64MB cap | — Pending |
| Orchestration: Coordinator/Worker cribbed from Claude Code source | Proven pattern in a production agent system; parallel fan-out + typed task-notifications | — Pending |
| Observability: `@sentry/nextjs` ≥ 9.29.0 with `vercelAIIntegration()` | Auto gen_ai spans for every teacher/worker call; dashboard doubles as secondary scoreboard | — Pending |
| No PWA, no transformers.js, no llama.cpp, no HF Transformers+MPS, no Core ML, no Python app code | All confirmed dead-ends at this model size / hardware / budget | — Hard locked |
| Airplane mode enforced via `NWPathMonitor` + Guided Access | Any tool with `requiresNetwork:true` returns structured error; model trained on both success and offline-refusal trajectories | — Pending |
| Primary product: Supabase (audience-pick cache: Vercel AI SDK → Zod → Hono) | Rich llms.txt corpus, clean tool surface, recognizable developer vocabulary | — Pending |

## Requirements

### Validated

(None yet — ship to validate. Greenfield.)

### Active

See `.planning/REQUIREMENTS.md` for the full scoped list with REQ-IDs.

### Out of Scope

- PWA / WebLLM / transformers.js paths — confirmed broken for ≥3B on iOS 26 Safari (web-llm#753).
- Voice I/O (Web Speech in WKWebView flaky; `SpeechTranscriber` out of budget).
- Second-product live speedrun on stage — dishonest at 4B in 60s.
- Full dynamic base-model architecture discovery — one pinned base + one fallback only.
- Core ML / ExecuTorch conversion — MLX Swift is the only path hitting target throughput.
- Python application code — Python is a pinned CLI subprocess only; zero Python files authored.
- Swift Sentry SDK integration on iOS — no gen_ai equivalent; not demo-critical.
- Vision / audio modalities of Gemma 4 — text-only demo.
- Per-dimension multi-judge eval — out of token budget (eight calls/item × 70 × 3).

## Fallback Tiers (from PRD §15)

- **Tier 1 — Full Live (~40%):** Model A warmup + audience-picked Model B live-trained in 17 min + hot-swap + full scoreboard.
- **Tier 2 — Partial Live (~50%):** Model A warmup + live training visible but not deployed; narration pivots to a second Model A prompt. Scoreboard uses pre-run H8 numbers.
- **Tier 3 — Cassette (~10%):** Pre-recorded 90s video from H7 with live narration. Airplane-mode iPhone still physically in the room.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After demo:** Full retrospective — what worked, what needed the fallback ladder, what to extract as a reusable pattern.

---
*Last updated: 2026-04-18 after initialization (auto-mode from PRD_SPEC.md).*
