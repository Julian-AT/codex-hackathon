---
phase: 04-data-eval-gen
plan: 03
subsystem: data-gen
tags: [data-generation, qa-worker, opus-4-7, schema-gate, training-data]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [generateQABatch, QA_RESPONSE_SCHEMA, buildQASystemPrompt, buildQAUserPrompt]
  affects: [04-05]
tech_stack:
  added: []
  patterns: [p-limit fan-out, Genstruct x PersonaHub prompting, schema-gate reject-never-patch, Sentry AI telemetry]
key_files:
  created:
    - lib/data/qa-prompts.ts
    - lib/data/qa-worker.ts
    - lib/data/qa-worker.test.ts
decisions:
  - Opus 4.7 (claude-opus-4-7) as generation model per PRD SS7.2
  - baseURL pinned to https://api.anthropic.com to bypass shell-shadowed ANTHROPIC_BASE_URL
  - p-limit(15) default concurrency per PRD SS7.1 rate-limit guidance
  - Max 2 retries on schema-gate failure before reject (DAT-03)
  - Temperature 0.7 for diverse yet grounded generation
metrics:
  duration_seconds: 157
  completed: 2026-04-18T13:19:43Z
  tasks_completed: 2
  tasks_total: 2
  test_count: 4
  test_pass: 4
  files_created: 3
  files_modified: 0
---

# Phase 4 Plan 3: Data-Gen QA Worker Summary

Opus 4.7 fan-out QA generator with persona x difficulty x chunk stratification, p-limit(15) concurrency, schema-gate reject-never-patch enforcement (DAT-03), and Sentry AI telemetry.

## What Was Built

### Task 1: qa-prompts.ts (f9ad219)

Created Genstruct-style prompt builders and Zod response schema:

- **QA_RESPONSE_SCHEMA**: Zod schema enforcing `{ question, answer, toolCalls?, reasoning? }` with min/max length constraints.
- **buildQASystemPrompt(persona, tools)**: Injects persona voice and enumerates available tool names/descriptions so the model never invents tool names.
- **buildQAUserPrompt(difficulty, chunks)**: Frames difficulty (easy = single-fact lookup, medium = synthesis, hard = multi-hop reasoning/tool-usage) and embeds chunks in `[CONTEXT]...[/CONTEXT]` block.

### Task 2: qa-worker.ts + tests (2d8465e)

Created the core QA generation worker:

- **generateQABatch(opts)**: Top-level export. Fans out `count` (default 500) generation calls via `p-limit(concurrency ?? 15)` to Opus 4.7 using AI SDK `generateObject` with Zod schema.
- **Persona x difficulty stratification**: Each call gets a seeded random persona, difficulty, and 1-3 corpus chunks (1 for easy, 2 for medium, 3 for hard).
- **Schema-gate enforcement**: Every `toolCalls` response is validated by `validateToolCall` from `schema-gate.ts`. Failures re-enter the queue with negative feedback (max 2 retries), then are rejected (DAT-03 reject-never-patch).
- **Rate-limit handling**: 429 errors trigger exponential backoff (2^attempt * 1000ms, max 2 retries).
- **Sentry telemetry**: Each generation wrapped in `Sentry.startSpan({ op: 'ai.agent', name: 'data-gen-qa' })` with persona, difficulty, chunkIds, attempt attributes.
- **Output shape**: Returns `{ examples: TrainingExample[], meta: DataGenMeta[], rejected: number }`.

**Tests (4/4 passing):**
1. Produces `TrainingExample[]` with correct message shape (system, user, assistant).
2. Returns `meta` array matching `examples` length with correct generator and difficulty values.
3. Calls `Sentry.startSpan` with correct op/name for telemetry.
4. Invokes schema-gate on tool_calls and correctly rejects invalid ones (fake tool name).

## Key Implementation Details

| Detail | Value |
|--------|-------|
| Model ID | `claude-opus-4-7` |
| Anthropic baseURL | `https://api.anthropic.com` (hardcoded bypass) |
| Default concurrency | p-limit(15) |
| Default count | 500 |
| Max retries (schema-gate) | 2 |
| Max retries (429 rate limit) | 2 |
| Temperature | 0.7 |
| Chunk selection | 1 (easy), 2 (medium), 3 (hard) |
| PRNG | mulberry32 via `makeRng(seed)` |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | f9ad219 | feat | qa-prompts.ts -- Genstruct prompt builders + Zod response schema |
| 2 | 2d8465e | feat | qa-worker.ts -- Opus 4.7 fan-out QA generator + schema-gate + tests |

## Self-Check: PASSED

All 3 created files exist on disk. Both commit hashes (f9ad219, 2d8465e) verified in git log.
