# STATE — Offline Specialist-LLM Pipeline

> Project memory. Updated on every phase transition, plan creation, and major decision.

## Project Reference

- **Core value:** A phone in airplane mode answers a Supabase expert question and invokes an agent-designed tool correctly — live on stage, with the pre-training swarm and fine-tuning loss curve visible on the laptop next to it.
- **Source of truth:** `PRD_SPEC.md`
- **Demo:** 2026-04-18 H12 (today) · coding window ~6 h remaining
- **Tier floor:** Tier 3 cassette (recorded at H7 / end of Phase 6)

## Current Position

- **Current phase:** 2 — Orchestrator Harness — all 3 plans executed (02-03 awaits human-verify checkpoint)
- **Current plan:** (none running — 02-03 shipped; checkpoint deferred to user)
- **Status:** Phase 2 code-complete (Plans 02-01, 02-02, 02-03 all landed); Phase 3 plans queued
- **Phase progress:** Phase 2 `[##########] 100%` (3/3 plans)
- **Overall progress:** `[##--------] 2 / 9 phases` (Phase 2 complete pending human gate)

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

- Last session end: 2026-04-18 H3 — Plan 02-03 shipped; demo page live at `/`.
- Stopped at: Task 3 human-verify checkpoint deferred to user.
- Next session resume point: user runs `pnpm next build && pnpm next start`, verifies grid populates on Smoke click + loss line renders on SFT click; then `/gsd-next` advances to Phase 3.
- Critical next artifact: Phase 3 execution (`.planning/phases/03-discovery-tool-design/` plans already exist).

*Last updated: 2026-04-18T11:43Z at Plan 02-03 completion.*
