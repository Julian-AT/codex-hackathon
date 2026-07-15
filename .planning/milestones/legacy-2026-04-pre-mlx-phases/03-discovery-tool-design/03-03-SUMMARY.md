---
phase: 03-discovery-tool-design
plan: 03
subsystem: discovery
tags: [ai-sdk, generateObject, zod, worker, prompt-engineering, mocked-test]
dependency_graph:
  requires: [03-01]
  provides: [toolDesignWorker, DYNAMIC_TOOL_SPEC_SCHEMA, buildToolDesignPrompt, BANNED_LIST]
  affects: [03-04, 03-05]
tech_stack:
  added: [MockLanguageModelV3 from ai/test]
  patterns: [generateObject + Zod schema, server-side field stamping, LanguageModelV3 spec]
key_files:
  created:
    - lib/discovery/prompts.ts
    - lib/discovery/worker.ts
    - lib/discovery/worker.test.ts
  modified: []
decisions:
  - "Used AI SDK v6 MockLanguageModelV3 from ai/test instead of hand-rolled stub or vi.mock — official test utility is more robust and version-aligned"
  - "LanguageModel interface is LanguageModelV3 (specificationVersion v3) in this AI SDK version — Wave 3 must pass v3-compatible models"
metrics:
  duration: "2m 51s"
  completed: "2026-04-18T12:09:46Z"
  tasks: 2
  files_created: 3
  files_modified: 0
  test_count: 3
  test_pass: 3
---

# Phase 3 Plan 03: Tool-Design Worker Summary

Single tool-design worker function (`toolDesignWorker`) with Zod-validated `generateObject` call against Claude Opus 4.5, BANNED_LIST prompt embedding, and server-side `sourceWorker` stamping.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | prompts.ts + worker.ts with generateObject + Zod schema | 7feb84c | lib/discovery/prompts.ts, lib/discovery/worker.ts |
| 2 | Mocked unit test -- no network | baab035 | lib/discovery/worker.test.ts |

## Implementation Details

### Task 1: prompts.ts + worker.ts

**prompts.ts** exports:
- `BANNED_LIST`: 12 identifiers blocked by the AST deny-list gate (fetch, require, import, process, globalThis, eval, Function, crypto, performance, Math.random, Date.now, constructor.constructor).
- `buildToolDesignPrompt(workerId, slice)`: Returns `{ system, user }` where system names all 5 validation gates and the user message embeds chunks as `<chunk id="..." source="...">` XML blocks.

**worker.ts** exports:
- `DYNAMIC_TOOL_SPEC_SCHEMA`: Zod schema enforcing snake_case names, 10-400 char descriptions, 20-4000 char jsBody, 3-6 trajectories, 1-8 tools per batch.
- `ToolDesignWorkerInput`: Interface taking workerId, slice, optional model/temperature/maxCandidatesPerWorker.
- `toolDesignWorker(input)`: Calls `generateObject` with Zod schema validation, defaults to `anthropic('claude-opus-4-5')` with temperature 0.4, wires `experimental_telemetry` for Sentry spans, and server-side stamps `sourceWorker` on every returned spec.

### Task 2: Mocked unit test

Used AI SDK v6's official `MockLanguageModelV3` from `ai/test` (LanguageModelV3, specificationVersion v3). The mock returns a hand-crafted `fakeSpec` as text content in `doGenerate`, which `generateObject` parses and validates against the Zod schema.

Three tests:
1. Valid `DynamicToolSpec[]` with correct shape returned
2. `sourceWorker` overwritten with passed `workerId` (server-side enforcement)
3. `DYNAMIC_TOOL_SPEC_SCHEMA.parse(fakeSpec)` succeeds (Zod contract)

**Mock approach:** `MockLanguageModelV3` with `doGenerate` result object (not `vi.mock`). Required adding `warnings: []` to the result since AI SDK's `logWarnings` expects the field.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `warnings: []` to MockLanguageModelV3 result**
- **Found during:** Task 2
- **Issue:** AI SDK v6's `generateObject` calls `logWarnings` which reads `.length` on the warnings array. `MockLanguageModelV3` does not include it by default.
- **Fix:** Added `warnings: []` to the `doGenerate` result object.
- **Files modified:** lib/discovery/worker.test.ts
- **Commit:** baab035

## Decisions Made

1. **MockLanguageModelV3 over vi.mock:** The plan offered two approaches. Used the official `MockLanguageModelV3` from `ai/test` because it implements the full `LanguageModelV3` interface and will track SDK upgrades automatically.
2. **LanguageModelV3 spec version:** AI SDK v6.0.168 uses `specificationVersion: "v3"` (not v2). The `LanguageModel` type is a union of `GlobalProviderModelId | LanguageModelV3 | LanguageModelV2`. Wave 3 should pass v3-compatible model instances.

## Self-Check: PASSED

All 3 created files exist on disk. Both task commits (7feb84c, baab035) verified in git log.
