# STATE — Offline Specialist-LLM Pipeline

> Project memory. Updated on every phase transition, plan creation, and major decision.

## Project Reference

- **Core value:** A phone in airplane mode answers a Supabase expert question and invokes an agent-designed tool correctly — live on stage, with the pre-training swarm and fine-tuning loss curve visible on the laptop next to it.
- **Source of truth:** `PRD_SPEC.md`
- **Demo:** 2026-04-18 H12 (today) · coding window ~6 h remaining
- **Tier floor:** Tier 3 cassette (recorded at H7 / end of Phase 6)

## Current Position

- **Current phase:** 5 — Train Model A — not yet planned
- **Current plan:** (none running — Phase 4 complete)
- **Status:** Phase 4 complete (5/5 plans, 92 tests); Phase 5 next
- **Phase progress:** Phase 4 `[##########] 100%` (5/5 plans)
- **Overall progress:** `[####------] 4 / 9 phases` (Phase 4 complete)

## Performance Metrics

- Velocity: n/a (pre-execution)
- Blockers resolved: 0
- Decisions logged: 10 (seeded from PRD §13)

## Accumulated Context

### Recent Decisions
- Roadmap locks 9-phase H0–H11 split verbatim from `research/SUMMARY.md §5`.
- v1 REQ coverage = 100% (56/56); stretch (7) concentrated in Phase 8.
- Kill-point phases: 1, 5, 6 with explicit fallback-tier demotion rules.
- AI SDK v6: useChat imported from `@ai-sdk/react` + `DefaultChatTransport` from `ai` (hooks moved out of `ai` root in v6).
- `(demo)` route group owns `/`; Phase 1 `app/page.tsx` deleted to resolve duplicate-route collision.
- Tailwind not wired in Phase 1 scaffold — demo UI uses inline styles; `data-cols`/`data-rows` attrs mirror grid geometry for tests.

### Active Todos
- Run `/gsd-plan-phase 1` to decompose Phase 1 into executable plans.

### Known Blockers
- None at roadmap creation. H0 verify items (SUMMARY §7) are the first resolution targets:
  - `mlx-lm-lora==0.1.0` GRPO reward-fn surface
  - AI SDK v6 `Experimental_Agent`/`ToolLoopAgent` import path
  - Anthropic org TPM headroom
  - iOS 18.2+ increased-memory-class Info.plist key
  - mlx-swift-lm 3.x product/module names

### Open Questions
- Which audience-pick product pre-caches first in Phase 8 (Vercel AI SDK, Zod, or Hono)?
- Does `mlx-lm-lora` GRPO require a `reward_bridge.py` CLI shim (resolve in Phase 1)?

## Session Continuity

- Last session end: 2026-04-18 — Phase 3 complete (5 plans, 3 waves, 49 tests).
- Stopped at: Phase 3 verification passed (human_needed for live swarm + SSE rendering).
- Next session resume point: `/gsd-plan-phase 4` to plan Data + Eval Gen.
- Critical next artifact: Phase 4 plans (training JSONL + eval set generation).

*Last updated: 2026-04-18T14:35Z at Phase 3 completion.*
