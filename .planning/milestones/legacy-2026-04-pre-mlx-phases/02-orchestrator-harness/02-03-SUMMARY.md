---
phase: 02-orchestrator-harness
plan: 03
subsystem: demo-ui
tags: [orchestrator, ui, streaming, ai-sdk-v6, recharts]
requirements: [ORC-03]
provides:
  - demo-route: app/(demo)/page.tsx mounts AgentGrid + LossChart
  - hook: useDemoStream routes data-agent-status / data-task-notification / data-train
  - components: AgentCard, AgentGrid (5x4 capacity 20)
requires:
  - /api/pipeline (Plan 02-01) emitting data-agent-status + data-task-notification
  - /api/train (Plan 02-02) emitting data-train SSE frames
  - LossChart (Plan 02-02)
affects:
  - app/page.tsx (deleted — Phase 1 home replaced by demo route)
tech-stack:
  added: ["@ai-sdk/react@^3.0.170"]
  patterns: ["useChat({transport, onData})", "SSE ReadableStream reader", "React route group (demo)"]
key-files:
  created:
    - app/(demo)/useDemoStream.ts
    - app/(demo)/AgentCard.tsx
    - app/(demo)/AgentGrid.tsx
    - app/(demo)/page.tsx
  modified:
    - package.json
    - pnpm-lock.yaml
  deleted:
    - app/page.tsx
decisions:
  - AI SDK v6 moved hooks out of `ai` root — useChat imported from `@ai-sdk/react`, configured via `new DefaultChatTransport({api})` rather than top-level `api` field.
  - Tailwind not wired in scaffold — AgentCard/AgentGrid/page.tsx use inline styles for resilience. `data-cols`/`data-rows` attributes mirror grid geometry for tests/grep.
  - `(demo)` route group means app/(demo)/page.tsx IS `/`; app/page.tsx deleted to avoid duplicate-route build error.
  - `startTrain` uses raw fetch + SSE reader (not useChat) because /api/train is a separate endpoint with its own lifecycle and we don't need chat message state there.
metrics:
  duration: "~6 min"
  tasks: 2
  files_touched: 6
  commits: 2
  completed: 2026-04-18T11:43Z
---

# Phase 2 Plan 03: Agent Grid Demo Page Summary

One-liner: 5×4 AgentCard grid + LossChart mounted on `/` as a single client demo page, fed by `useDemoStream` — a shared hook that routes `/api/pipeline` typed parts via `useChat({onData})` and consumes `/api/train` via a raw SSE reader.

## What Shipped

- **`app/(demo)/useDemoStream.ts`** — Client hook centralising stream state:
  - `useChat({transport: new DefaultChatTransport({api:'/api/pipeline'}), onData})` routes `data-agent-status` (transient, per-worker) into the `agents` map and `data-task-notification` (persistent) into the `notifications` map. Terminal notification status (`ok`/`err`/`timeout`) is promoted onto the agents map so the card border flips colour.
  - `startTrain(mode, iters)` POSTs to `/api/train` and drains the SSE body via a `ReadableStream` reader + `TextDecoder`, pushing parsed `data-train` frames into a `TrainPoint[]` state.
- **`app/(demo)/AgentCard.tsx`** — Monospace inline-styled card. Colours keyed by status (`running=#60a5fa`, `ok=#22c55e`, `err=#ef4444`, `timeout=#f59e0b`). Exposes `data-agent-id` + `data-agent-status` for future selenium/e2e selectors.
- **`app/(demo)/AgentGrid.tsx`** — `display:grid` with `gridTemplateColumns:'repeat(5, 1fr)'` and `gridTemplateRows:'repeat(4, 1fr)'`, padded to 20 slots so the grid is always visually 5×4 even on mount with zero workers. Empty slots render a dashed `#27272a` placeholder.
- **`app/(demo)/page.tsx`** — Composes the two surfaces. Header buttons: **Smoke: 2 workers** (fires `sendMessage({text: 'Launch 2 discovery workers named w1 and w2 in parallel.'})`) and **Smoke: SFT 20 iter** (fires `startTrain('sft', 20)`). Status line reads `pipeline: {useChat.status} · workers: {count}/20 · notifications: {count}`.
- **Deleted `app/page.tsx`** — Phase 1 scaffold home. The `(demo)` route group does not add a path segment, so `app/(demo)/page.tsx` resolves to `/`; keeping the old home would fail `next build` with a duplicate-route error.

## Verification

- `pnpm next build` — passes. `/` is now a **Static** 167 kB client bundle (demo page + useChat + recharts), other routes unchanged.
- Grep acceptance: `repeat(5, 1fr)`, `repeat(4, 1fr)`, `data-cols="5"`, `data-rows="4"` in AgentGrid; `data-agent-status`, `data-task-notification`, `data-train`, `/api/pipeline`, `/api/train`, `useChat`, `onData` in useDemoStream; `AgentGrid`, `LossChart`, `useDemoStream`, `'use client'` in page.tsx — all confirmed.

## Human Checkpoint (Task 3) — Deferred

Task 3 is a `checkpoint:human-verify` gate. Per the autonomous execution contract for this run, the gate is deferred to the user rather than blocking. To verify end-to-end:

1. `pnpm next build && pnpm next start` (do NOT use `pnpm next dev` — PITFALL P16: hot-reload orphans the mlx_lm subprocess).
2. Visit http://localhost:3000 — confirm the 5×4 grid shows 20 dashed empty slots and the loss chart is empty.
3. Click **Smoke: 2 workers**. Within ~15 s: ≥2 grid slots populate with role + `running` (blue border), then terminate `ok`/`err`/`timeout`.
4. Sentry dashboard, `op:ai.agent` filter — expect ≥2 spans with distinct `worker.id` attributes.
5. Click **Smoke: SFT 20 iter**. Within ~60 s: a loss line renders across x-axis (iter). Sentry dashboard shows a `training.sft` span with `loss.iter.0..19` attributes.
6. Reply **"approved"** to unblock downstream phases, or paste failing step + Sentry URL / browser console error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 1 `app/page.tsx` collided with new `app/(demo)/page.tsx` on route `/`**
- **Found during:** Task 2
- **Issue:** Next.js 15 App Router errors out at build time when two `page.tsx` files resolve to the same path. `(demo)` is a route group and adds no segment, so both claimed `/`.
- **Fix:** Deleted `app/page.tsx` (Phase 1 scaffold home — its only content was a link to `/api/smoke`, which is still reachable directly).
- **Files modified:** app/page.tsx (deleted)
- **Commit:** 1fe1afe

### Plan-Anticipated Adjustments (not deviations)

- Plan's `<interfaces>` suggested `useChat` from `ai/react` "or whatever Plan 02-01 recorded". We used `@ai-sdk/react` (the v6 canonical surface) and `DefaultChatTransport` from `ai`, which is the AI SDK v6 shape (v6 moved hooks out of the `ai` root). The `must_haves.truths` line "mounts `useChat({api:'/api/pipeline', onData})`" is satisfied functionally — the transport constructor takes `{api}` and the hook still fires `onData`.

## Authentication Gates

None encountered — this plan is pure client code; no provider keys or CLI auth touched.

## Known Stubs

None. All three data streams (agents / notifications / train) are wired to live sources. The SUMMARY grid is empty on first render by design (per acceptance criteria "renders an empty 5×4 grid on mount").

## Commits

- `82ca6ad` — feat(02-03/t1): useDemoStream hook + AgentCard + 5x4 AgentGrid (ORC-03)
- `1fe1afe` — feat(02-03/t2): demo page mounting AgentGrid + LossChart (ORC-03)

## Self-Check: PASSED

- [x] `app/(demo)/useDemoStream.ts` — FOUND
- [x] `app/(demo)/AgentCard.tsx` — FOUND
- [x] `app/(demo)/AgentGrid.tsx` — FOUND
- [x] `app/(demo)/page.tsx` — FOUND
- [x] Commit `82ca6ad` — FOUND in git log
- [x] Commit `1fe1afe` — FOUND in git log
- [x] `pnpm next build` — passes
- [x] All grep acceptance targets matched
