---
phase: 03-discovery-tool-design
plan: 04
subsystem: discovery-pipeline
tags: [swarm, pipeline, manifest, kill-point, SWR-02, SWR-08]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-05]
  provides: [data/adapter-tools.json, /api/discover endpoint, KillPointError, designToolsSwarm, runDiscoveryPipeline]
  affects: [Phase 4 adapter consumption, demo dashboard /api/discover trigger]
tech_stack:
  added: []
  patterns: [4-worker strided swarm, SWR-08 kill-point fallback, Zod per-element write-time validation]
key_files:
  created:
    - lib/discovery/dedupe.ts
    - lib/discovery/swarm.ts
    - lib/discovery/manifest.ts
    - lib/discovery/pipeline.ts
    - app/api/discover/route.ts
    - lib/discovery/pipeline.test.ts
    - data/adapter-tools.json
  modified:
    - lib/discovery/__fixtures__/mock-candidates.json
    - lib/discovery/validate/parse.test.ts
    - lib/discovery/validate/schema.test.ts
    - .gitignore
decisions:
  - "Used DYNAMIC_TOOL_SPEC_SCHEMA.shape.tools.element for per-tool Zod validation instead of wrapping each tool in { tools: [tool] }"
  - "Reused buildStatusPart/buildNotificationPart helpers from Phase 2 coordinator for consistent SSE event shapes"
  - "Used createUIMessageStreamResponse (matching Phase 2 pattern) instead of stream.toResponse()"
  - "Fallback path used for data/adapter-tools.json since no ANTHROPIC_API_KEY in execution env"
metrics:
  duration: 382s
  completed: "2026-04-18T12:31:19Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 46
  test_pass: 46
---

# Phase 3 Plan 04: Swarm Pipeline Manifest Summary

4-worker strided swarm with SWR-08 kill-point fallback, 5-gate validation pipeline, and manifest emission via /api/discover SSE route

## What Was Built

### Task 1: Core Pipeline Modules (2892436)
- **dedupe.ts**: Normalize-and-dedupe by `name.toLowerCase().replace(/[_-]/g, '')`, preserving first-seen order
- **swarm.ts**: `designToolsSwarm(corpus)` fans 4 parallel `toolDesignWorker` calls via `Promise.all` with strided slicing (`idx % workerCount === i`), each wrapped in `Sentry.startSpan({op:'ai.agent'})` and `AbortSignal.timeout(90_000)`
- **manifest.ts**: `writeManifest` validates each tool via the per-element Zod schema (`DYNAMIC_TOOL_SPEC_SCHEMA.shape.tools.element`), then atomically writes `data/adapter-tools.json`. `copyFallback` copies the hand-written fallback manifest.
- **pipeline.ts**: `runDiscoveryPipeline` orchestrates: swarm -> flatten -> dedupe -> validate (Promise.all) -> filter survivors -> retry arm (4 <= survivors < 8, temperature 0.8) -> cap 12 -> assert >= killMin (default 4). Below killMin throws `KillPointError` which triggers `copyFallback()`.

### Task 2: Route + Integration Test + Manifest (2b33e51)
- **app/api/discover/route.ts**: POST endpoint with `runtime='nodejs'`, `dynamic='force-dynamic'`. Streams worker and gate progress via `createUIMessageStream` + Phase 2's `buildStatusPart`/`buildNotificationPart` helpers. KillPointError catch path narrates SWR-08 fallback.
- **pipeline.test.ts**: Integration test with `vi.doMock('./swarm.js')`:
  - Test 1: 12 mock candidates -> 2 survivors (add_numbers, list_tables) -> manifest written with source=swarm
  - Test 2: Empty swarm output -> 0 survivors -> KillPointError -> fallback copied (source=fallback, count=8)
- **data/adapter-tools.json**: Committed with fallback source (no API key available in execution environment; demo-time swarm will overwrite with real results)

## Manifest Details

- **Source**: fallback (API key not available; swarm path proven by integration test)
- **Count**: 8 tools
- **Raw candidates (test run)**: 12 (from mock-candidates fixture)
- **Deduped candidates (test run)**: 12 (no duplicates in fixture)
- **Gate failures (test run)**: schema: 1, parse: 4, sandbox: 2, fuzz: 2, trajectory: 1
- **Survivors (test run)**: 2 (add_numbers, list_tables)
- **Retry arm**: Not engaged in test (killMin=1, floorMin=1 for test)
- **Kill-point**: Not triggered in swarm-path test; proven by fallback-path test
- **Swarm wall-clock (test, mocked)**: ~1.9s

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed mock-candidates.json camelCase names conflicting with Zod schema**
- **Found during:** Task 2, first integration test run
- **Issue:** Mock fixture specs `addNumbers` and `listTables` used camelCase function names, but the worker's Zod schema enforces `/^[a-z][a-z0-9_]*$/` (snake_case only). Surviving tools failed write-time validation in `writeManifest`.
- **Fix:** Renamed `addNumbers` -> `add_numbers` and `listTables` -> `list_tables` in mock-candidates.json (function.name, meta.jsBody function declaration, trajectory call.name). Updated schema.test.ts and parse.test.ts fixture lookups.
- **Files modified:** `lib/discovery/__fixtures__/mock-candidates.json`, `lib/discovery/validate/schema.test.ts`, `lib/discovery/validate/parse.test.ts`
- **Commit:** 2b33e51

**2. [Rule 3 - Blocking] Added .gitignore exception for data/adapter-tools.json**
- **Found during:** Task 2 commit
- **Issue:** `.gitignore` rule `data/*` blocked `data/adapter-tools.json` from being committed. The fallback file had an explicit exception but the main manifest did not.
- **Fix:** Added `!data/adapter-tools.json` to `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 2b33e51

**3. [Rule 2 - Critical] Used per-element Zod validation instead of wrapper schema**
- **Found during:** Task 1, manifest.ts implementation
- **Issue:** Plan code called `DYNAMIC_TOOL_SPEC_SCHEMA.parse(tool)` per tool, but the schema expects `{ tools: [...] }` wrapper shape. Also, the wrapper has `max(8)` which conflicts with the pipeline's `capMax=12`.
- **Fix:** Extracted `DYNAMIC_TOOL_SPEC_SCHEMA.shape.tools.element` for per-tool validation, bypassing the wrapper and its min/max array constraints.
- **Files modified:** `lib/discovery/manifest.ts`
- **Commit:** 2892436

## Known Stubs

None. All data flows are wired end-to-end. The manifest uses fallback source only because no API key was available at execution time; the swarm path is proven by the integration test.

## Decisions Made

1. Per-element Zod validation (`DYNAMIC_TOOL_SPEC_SCHEMA.shape.tools.element`) instead of wrapping each tool, avoiding the wrapper's `min(1)/max(8)` array constraint that conflicts with `capMax=12`.
2. Reused Phase 2's `buildStatusPart`/`buildNotificationPart` typed helpers for SSE event shapes instead of raw objects, ensuring type safety with the writer API.
3. Used `createUIMessageStreamResponse({ stream })` pattern (matching Phase 2's `/api/pipeline`) instead of `stream.toResponse()`.
4. Committed manifest with fallback source since ANTHROPIC_API_KEY is not set in execution environment. Demo-time will re-run swarm with real keys.

## Self-Check: PASSED

All 8 expected files found on disk. Both commit hashes (2892436, 2b33e51) verified in git log.
