---
phase: "04"
plan: "04"
subsystem: data-gen
tags: [trajectory, tool-call, training-data, schema-gate, anthropic]
dependency_graph:
  requires: ["04-01 (types, personas, split)", "04-02 (schema-gate, dedupe, stratify)"]
  provides: ["generateTrajBatch — 1150 tool-call trajectories for SFT training"]
  affects: ["04-05 (pipeline orchestration)", "Phase 5 (training JSONL)"]
tech_stack:
  added: []
  patterns: ["p-limit concurrency", "Zod structured output via AI SDK generateObject", "Sentry span tracing", "schema-gate validation loop with retry"]
key_files:
  created:
    - lib/data/traj-prompts.ts
    - lib/data/traj-worker.ts
    - lib/data/traj-worker.test.ts
  modified: []
decisions:
  - "Four trajectory types: single-turn (APIGen), multi-turn (APIGen-MT), parallel/dependent, refusal (When2Call)"
  - "Shared p-limit(15) ceiling across all 4 trajectory types — prevents TPM overload"
  - "Inverse-frequency tool bias: tools with fewer examples get higher sampling weight"
  - "Retry with negative feedback: failed schema-gate attempts re-enter queue with error context"
metrics:
  duration_seconds: 305
  completed: "2026-04-18T13:22:27Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 7
  test_pass: 7
  files_created: 3
  files_modified: 0
---

# Phase 04 Plan 04: Data-Gen Trajectory Worker Summary

Trajectory generation worker producing 1,150 tool-call training examples across 4 APIGen/When2Call strategies, with DAT-03 schema-gate enforcement on every tool_call.

## Task Results

### Task 1: traj-prompts.ts -- 4 prompt strategies + Zod schemas
**Commit:** `4e6a26e`

Created four Zod response schemas and four prompt builder functions:

| Schema | Pattern | Description |
|--------|---------|-------------|
| SINGLE_TURN_SCHEMA | APIGen | userQuery + toolCall + toolResult + assistantAnswer |
| MULTI_TURN_SCHEMA | APIGen-MT | 4-12 turns with interleaved tool calls |
| PARALLEL_DEP_SCHEMA | Multi-tool | 2-4 tool calls (parallel or dependent) in one turn |
| REFUSAL_SCHEMA | When2Call | userQuery + refusal response, NO tool calls |

Each prompt builder accepts tool specs and grounding chunks, producing system/user prompt pairs for `generateObject`.

### Task 2: traj-worker.ts -- 4-type trajectory generation + schema-gate + test
**Commit:** `6651399`

Built `generateTrajBatch(opts)` orchestrating 4 sub-generators through a shared `p-limit(15)`:

| Type | Default Count | Message Structure |
|------|--------------|-------------------|
| Single-turn | 800 | system + user + assistant(tool_calls) + tool + assistant = 5 msgs |
| Multi-turn | 200 | system + 4-12 interleaved turns >= 6 msgs |
| Parallel/dep | 100 | system + user + assistant(2+ tool_calls) + 2 tool responses + assistant |
| Refusal | 50 | system + user + assistant = 3 msgs, NO tool_calls |

**Total default:** 1,150 examples.

**Schema-gate enforcement (DAT-03):**
- Every `tool_call` in every trajectory validated via `validateToolCall`
- Multi-turn: ALL tool_calls across ALL turns validated independently (T-04-08)
- Failures retry with negative feedback up to `maxRetries` (default 2), then discard
- Refusal trajectories post-processed to ensure zero tool_calls (T-04-09)

**Tool selection bias:** Inverse-frequency weighting ensures under-represented tools get more examples (supports DAT-07 stratification).

**Tests (7/7 passing):**
1. Single-turn: 5+ messages with correct structure
2. Multi-turn: 6+ messages with interleaved tool calls
3. Refusal: exactly 3 messages, NO tool_calls anywhere
4. Schema-gate called for single-turn tool_calls
5. byType counts match input counts across all 4 types
6. Rejection tracking when schema-gate fails after max retries
7. Parallel/dep: 2 tool_calls in one assistant turn + 2 tool responses

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Shared p-limit ceiling:** All 4 trajectory types share one `p-limit(15)` instance rather than separate pools. This prevents accidentally exceeding Anthropic's TPM budget (T-04-10).
2. **Inverse-frequency tool bias:** `sampleToolBiased` weights tool selection inversely to current example count, helping ensure even tool distribution for stratification.
3. **Prompt-based test discrimination:** Test mock uses system prompt content to discriminate trajectory type rather than Zod schema introspection (schemas don't JSON-stringify predictably).

## Threat Mitigations Applied

| Threat | Mitigation | Verification |
|--------|-----------|-------------|
| T-04-08 (hallucinated second call in multi-turn) | Every tool_call in every turn validated; entire trajectory rejected if ANY fails | Multi-turn test confirms interleaved validation |
| T-04-09 (refusal with accidental tool_calls) | Refusal messages constructed without tool_calls field | Refusal test asserts tool_calls undefined on all messages |
| T-04-10 (TPM overload at 1150 x p-limit(15)) | Shared p-limit ceiling, configurable concurrency | p-limit import + usage verified in code |
| T-04-11 (ANTHROPIC_BASE_URL shadow) | `createAnthropic({ baseURL: 'https://api.anthropic.com' })` | grep confirms pinned baseURL |

## Self-Check: PASSED

- [x] `lib/data/traj-prompts.ts` exists
- [x] `lib/data/traj-worker.ts` exists
- [x] `lib/data/traj-worker.test.ts` exists
- [x] Commit `4e6a26e` exists
- [x] Commit `6651399` exists
- [x] 7/7 tests pass
- [x] TypeScript compiles without errors in traj files
