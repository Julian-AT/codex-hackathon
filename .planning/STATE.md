# STATE — Offline Specialist-LLM Pipeline

> Project memory. Updated on every phase transition, plan creation, and major decision.

## Project Reference

- **Core value:** A phone in airplane mode answers a Supabase expert question and invokes an agent-designed tool correctly — live on stage, with the pre-training swarm and fine-tuning loss curve visible on the laptop next to it.
- **Source of truth:** `PRD_SPEC.md`
- **Demo:** 2026-04-18 H12 (today) · coding window ~6 h remaining
- **Tier floor:** Tier 3 cassette (recorded at H7 / end of Phase 6)

## Current Position

- **Current phase:** 1 — Foundation & Smoke (H0–H2)
- **Current plan:** (none — phase not yet planned)
- **Status:** planning
- **Phase progress:** `[----------] 0%`
- **Overall progress:** `[----------] 0 / 9 phases`

## Performance Metrics

- Velocity: n/a (pre-execution)
- Blockers resolved: 0
- Decisions logged: 10 (seeded from PRD §13)

## Accumulated Context

### Recent Decisions
- Roadmap locks 9-phase H0–H11 split verbatim from `research/SUMMARY.md §5`.
- v1 REQ coverage = 100% (56/56); stretch (7) concentrated in Phase 8.
- Kill-point phases: 1, 5, 6 with explicit fallback-tier demotion rules.

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

- Last session end: 2026-04-18 roadmap creation.
- Next session resume point: `/gsd-plan-phase 1` to plan Phase 1 (Foundation & Smoke).
- Critical next artifact: `.planning/phases/01-foundation-smoke-tests/01-CONTEXT.md` + plan files.

*Last updated: 2026-04-18 at roadmap creation.*
