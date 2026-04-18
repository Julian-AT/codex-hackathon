---
phase: 03-discovery-tool-design
plan: 02
subsystem: discovery-validation
tags: [validation, sandbox, security, worker-threads, vm, ajv, acorn, fuzz, trajectory]
dependency_graph:
  requires: [03-01]
  provides: [validateTool, validateSchema, validateParse, runInSandbox, validateFuzz, validateTrajectories]
  affects: [03-03, 03-04]
tech_stack:
  added: [ajv/2020, acorn, fast-deep-equal, node:vm, node:worker_threads]
  patterns: [AST-deny-list, sandbox-double-jail, fuzz-testing, trajectory-replay]
key_files:
  created:
    - lib/discovery/validate/index.ts
    - lib/discovery/validate/schema.ts
    - lib/discovery/validate/parse.ts
    - lib/discovery/validate/sandbox.ts
    - lib/discovery/validate/sandbox.worker.mjs
    - lib/discovery/validate/fuzz.ts
    - lib/discovery/validate/trajectory.ts
    - lib/discovery/__fixtures__/mock-candidates.json
    - lib/discovery/validate/schema.test.ts
    - lib/discovery/validate/parse.test.ts
    - lib/discovery/validate/sandbox.test.ts
    - lib/discovery/validate/fuzz.test.ts
    - lib/discovery/validate/trajectory.test.ts
    - lib/discovery/validate/index.test.ts
  modified: []
decisions:
  - "Broadened sandbox smoke regex to catch OOM/memory/resource/terminated errors (not just timeout/exit)"
  - "Used import.meta.url-based path resolution for sandbox.worker.mjs to work in both vitest and runtime"
  - "vm.Script inner timeout (1500ms) fires before parent setTimeout (2000ms) for infinite loops"
metrics:
  duration: "4m 48s"
  completed: "2026-04-18T12:11:28Z"
  tasks: 3
  tests: 35
  files_created: 14
---

# Phase 3 Plan 02: Validator Gates Summary

5-gate tool validator pipeline (schema, parse, sandbox, fuzz, trajectory) with 35 tests across 6 test files; all 12 fixture candidates match their expected gate failure.

## Task Results

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Gates 1+2 (schema, parse) | e268f69 | schema.ts, parse.ts, mock-candidates.json, 2 test files |
| 2 | Gate 3 sandbox | 9653a7a | sandbox.ts, sandbox.worker.mjs, sandbox.test.ts |
| 3 | Gates 4+5 + orchestrator | aeeeadd | fuzz.ts, trajectory.ts, index.ts, 3 test files |

## Architecture

`validateTool(spec)` runs 5 gates in sequence and short-circuits on first failure:

1. **Gate 1 (schema)**: `ajv/dist/2020.js` compile-time check (draft 2020-12, strict: false)
2. **Gate 2 (parse)**: `acorn` parse + AST walk for 9 banned identifiers + 3 banned member accesses
3. **Gate 3 (sandbox)**: `worker_threads.Worker` with `vm.createContext({})` empty context, 64MB old-gen cap, 1.5s vm.Script timeout + 2s parent timeout
4. **Gate 4 (fuzz)**: 10 schema-conforming inputs, 0 throws required, >=8 JSON-serializable returns
5. **Gate 5 (trajectory)**: `fast-deep-equal` comparison of actual sandbox output vs stated trajectory results (>=3 trajectories required)

## Assumption A4 Verification (resourceLimits)

`resourceLimits.maxOldGenerationSizeMb: 64` is **enforced** on Node v24.13.0. The memoryBomb fixture (allocates ~200MB) is killed by the Worker resource limit in ~94ms (much faster than the 2s timeout). The error surfaces through the Worker `error` event with a message containing "terminated" or via `exit` event with non-zero code.

## Per-Gate Timing Observations

From the integration test run against all 12 fixtures:

| Gate | Candidate | Time |
|------|-----------|------|
| schema | schemaBad | <1ms |
| parse | parseBad, fetchBanned, Date.now, Math.random | <1ms each |
| sandbox | infiniteLoop | ~1512ms (vm.Script timeout at 1500ms) |
| sandbox | memoryBomb | ~355ms (Worker OOM kill) |
| fuzz | throwsOnEmpty | ~30ms (10 sandbox invocations) |
| fuzz | nonSerializable | ~30ms |
| trajectory | trajectoryMismatch | ~42ms (3 sandbox invocations) |
| all-pass | addNumbers | ~92ms |
| all-pass | listTables | ~72ms |

Worker spin-up is ~8-12ms per invocation. Budget ~100ms per gate-4 candidate (10 invocations), ~60ms per gate-5 (3 trajectories). Total per-candidate for a passing spec: ~160ms.

## Fixture Coverage

All 12 fixtures in `mock-candidates.json` match their `expectedFailedGate`:
- 2 pass all gates (addNumbers, listTables)
- 1 fails schema (schemaBad — `type: "objekt"`)
- 4 fail parse (parseBad, fetchBanned, nondeterministicDate, nondeterministicRandom)
- 2 fail sandbox (infiniteLoop, memoryBomb)
- 2 fail fuzz (throwsOnEmpty, nonSerializable)
- 1 fails trajectory (trajectoryMismatch — stated result {sum:999} vs actual {sum:5})

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broadened sandbox smoke regex in validateTool orchestrator**
- **Found during:** Task 3 integration testing
- **Issue:** The sandbox smoke check regex `/timeout|timed out|exit/` did not match Worker OOM error messages (e.g., "Worker terminated due to reaching memory limit"). The memoryBomb fixture was incorrectly passing through to fuzz gate instead of failing at sandbox gate.
- **Fix:** Broadened regex to `/timeout|timed out|exit|memory|resource|killed|terminated/i` to catch all worker-crash error patterns.
- **Files modified:** lib/discovery/validate/index.ts
- **Commit:** aeeeadd

**2. [Rule 1 - Bug] Fixed sandbox timeout test regex**
- **Found during:** Task 2 initial test run
- **Issue:** vm.Script inner timeout (1500ms) fires before parent setTimeout (2000ms), producing error "Script execution timed out after 1500ms" which did not match `/timeout|exit/`.
- **Fix:** Updated test regex to `/timeout|timed out|exit/` to match the vm.Script timeout message.
- **Files modified:** lib/discovery/validate/sandbox.test.ts
- **Commit:** 9653a7a

## Known Stubs

None -- all gates are fully wired with real implementations.

## Self-Check: PASSED

All 14 files found. All 3 commit hashes verified. All 11 acceptance criteria grep patterns matched.
