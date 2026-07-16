---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "08"
subsystem: validation
tags: [bun, typescript, subprocess, capabilities, fixed-argv, process-entry, tdd]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: immutable eight-check catalog and isolated validation runner/CLI contracts from Plans 06-07
provides:
  - Production Bun CheckRunnerPort restricted to exact catalog executable/argv pairs
  - Independently bounded stdout/stderr with timeout and interruption kill-and-await cleanup
  - Named Apple Silicon host-capability evidence derived only from platform and architecture
  - Executable validation entry for real run mode and sole direct external integration mode
affects: [package-script-wiring, validation-acceptance, privacy-boundary-tests, phase-01-acceptance]
tech-stack:
  added: []
  patterns:
    - Exact catalog token allowlist is revalidated at the host-process boundary
    - Bun token-array spawn uses ignored stdin, piped bounded streams, and no shell
    - Process entry buffers internal CLI output for one final write before assigning exitCode
key-files:
  created:
    - src/validation/process-adapter.ts
    - src/validation/process-adapter.test.ts
    - src/validation/host-capability.ts
    - src/validation/host-capability.test.ts
    - src/validation/process-entry.ts
    - src/validation/process-entry.test.ts
  modified: []
key-decisions:
  - "Recompute the process allowlist from fixed-process and external-harness catalog entries, then require exact executable and argument equality before spawning."
  - "Snapshot platform and architecture when constructing the host probe and reject every capability name except apple-silicon."
  - "Reserve direct integration Vitest execution for explicit external test:integration mode; ordinary run mode rejects that descriptor before constructing host dependencies."
patterns-established:
  - "Host process lifecycle: validate exact catalog request -> copy token array -> spawn shell-free -> drain bounded streams -> kill and await on timeout or interruption."
  - "Executable validation boundary: parse one declared mode -> construct real ports -> buffer internal CLI projection -> write once -> assign process.exitCode."
requirements-completed: [IDEN-09, IDEN-10]
coverage:
  - id: D1
    description: "The Bun process adapter accepts only exact catalog commands, ignores stdin, bounds both streams, and reports spawn, nonzero, timeout, interruption, and truncation outcomes."
    requirement: IDEN-09
    verification:
      - kind: unit
        ref: "src/validation/process-adapter.test.ts#createBunCheckRunner"
        status: pass
    human_judgment: false
  - id: D2
    description: "The host probe reports named apple-silicon availability only for Darwin arm64 and named unavailability on other platform/architecture pairs."
    requirement: IDEN-10
    verification:
      - kind: unit
        ref: "src/validation/host-capability.test.ts#createHostCapabilityProbe"
        status: pass
    human_judgment: false
  - id: D3
    description: "The executable entry reaches fixed processes, product gates, the host probe, and direct external Vitest through separate allowlisted branches with one final output write."
    requirement: IDEN-09
    verification:
      - kind: unit
        ref: "src/validation/process-entry.test.ts#runValidationProcessEntry"
        status: pass
      - kind: integration
        ref: "bun src/validation/process-entry.ts external test:integration --json"
        status: pass
    human_judgment: false
duration: 5 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 08: Production Validation Host Boundaries Summary

**Exact catalog-only Bun execution, a genuine Apple Silicon capability probe, and a one-write executable entry now connect the isolated validation runtime to real host behavior without shell or package-script recursion.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-16T09:20:27Z
- **Completed:** 2026-07-16T09:25:18Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a production `CheckRunnerPort` that rejects every noncanonical executable/argument combination before spawn, copies the accepted token array, ignores stdin, uses no shell, drains both streams with independent byte caps, and retains explicit process outcome evidence.
- Added deterministic timeout and interruption cleanup that kills at most once, awaits the child lifecycle, removes signal/timer hooks, and cannot turn spawn, nonzero, timeout, interruption, or truncation evidence into success.
- Added the pure named `apple-silicon` probe, with production defaults captured from `process.platform` and `process.arch` and injected host matrices in tests.
- Added an executable validation entry whose ordinary run mode reaches fixed process, product, and capability branches, while only explicit `external test:integration` starts direct fixed Vitest arguments.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Specify real process, capability, and entry boundaries** — `43dc392` (test)
2. **Task 2: GREEN — Implement the allowlisted Bun runner and host probe** — `2c96392` (feat)
3. **Task 3: REFACTOR — Wire real adapters into the executable validation entry** — `098f473` (refactor)

## Files Created/Modified

- `src/validation/process-adapter.ts` — Exact catalog request validation, Bun spawn seam, bounded stream draining, and timeout/interruption cleanup.
- `src/validation/process-adapter.test.ts` — Fixed-token, rejection, truncation, process-error, timeout, and interruption matrices without live children.
- `src/validation/host-capability.ts` — Pure named Apple Silicon host probe with production platform/architecture defaults.
- `src/validation/host-capability.test.ts` — Injected platform/architecture availability matrix and unknown-probe rejection.
- `src/validation/process-entry.ts` — Internal run/external parser, production dependency factory, direct integration adapter, buffered CLI IO, and final exit assignment.
- `src/validation/process-entry.test.ts` — Branch reachability, direct-Vitest, malformed-mode, named-probe, one-write, and bounded-exception proofs.

## Decisions Made

- Kept the Plan 07 `ProcessRequest` port unchanged and enforced authority again inside the production adapter by comparing the complete executable and argument vector against the immutable catalog.
- Exposed no command-string helper. The default Bun seam receives a copied `cmd` token array; the injected seam also records `shell: false` so safety remains testable without launching a process.
- Rejected `run test:integration` rather than supplying a recursive fallback. Only `external test:integration` constructs its direct catalog request, and that request contains `vitest.integration.config.ts` but no package-script name.
- Converted internal exceptions to stable bounded copy without stack traces, environment values, or private paths before the one final write.

## TDD Gate Compliance

- **RED:** `bun test/support/phase-1-gate.ts expect-red validation-host` independently collected 5 adapter, 5 capability, and 15 entry assertion failures with no import/setup/collection/syntax/fixture/no-tests failure. Commit `43dc392` records the RED evidence.
- **GREEN:** Commit `2c96392` follows RED and made all 10 adapter/capability tests plus strict typecheck pass.
- **REFACTOR:** Commit `098f473` added the executable entry and made all 25 Plan 08 tests pass; the complete validation domain passes 111 tests.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial late-load entry shim still exposed a missing-module typecheck error after its RED collection role succeeded. The shim was typed through a runtime module path before GREEN verification, preserving the absent-module RED behavior and restoring strict typecheck without changing the production contract.

## Verification

- `bun test/support/phase-1-gate.ts expect-red validation-host` — accepted all three independent RED suites before production modules existed.
- `bun x vitest run src/validation/process-adapter.test.ts src/validation/host-capability.test.ts src/validation/process-entry.test.ts` — 3 files and 25 tests passed.
- `bun x vitest run src/validation/*.test.ts` — 9 files and 111 tests passed, including Plan 07 fake-only runner/baseline and JSON isolation coverage.
- `bun run typecheck` — passed.
- `bun x biome check src/validation` — 18 files passed.
- `bun src/validation/process-entry.ts run typecheck --json` — real direct TypeScript process returned one LIVE PASS result.
- `bun src/validation/process-entry.ts run local:check --json` — production host facts returned one named LIVE Apple Silicon PASS result on Darwin arm64.
- `bun src/validation/process-entry.ts run studio:build --json` — absent Phase 8 product remained one explicit LIVE FAIL result.
- `bun src/validation/process-entry.ts external test:integration --json` — direct fixed Vitest argv ran 4 integration files and 17 fixture tests once without package-script recursion.
- Static inspection found no shell string, `shell: true`, caller argument append path, watch mode, `bun run`, network call, model launch, MLX_HOME initialization, operator-state read, or legacy product import in the production graph.

## Known Stubs

None. Spawn, timer, interrupt, and entry factories are required dependency-injection seams for deterministic tests; production defaults connect them to Bun, process signals, and actual host facts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09 can map the eight stable package scripts to catalog IDs and the executable entry without inventing executable or argument data.
- Its external acceptance harness can call `external test:integration` exactly once and retain Plan 07's in-suite external stub, preventing self-recursion.
- Portable baseline repairs and package-script changes remain entirely unmodified and owned by Plan 09.

## Self-Check: PASSED

- All six Plan 01-08 production/test files exist.
- Commits `43dc392`, `2c96392`, and `098f473` resolve in RED → GREEN → REFACTOR order.
- All 111 validation tests, strict typecheck, focused Biome, direct TypeScript execution, named Apple Silicon evidence, explicit product FAIL, and direct external Vitest integration passed.
- Coverage classification accepted all three deliverables as automated and fully proven.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
