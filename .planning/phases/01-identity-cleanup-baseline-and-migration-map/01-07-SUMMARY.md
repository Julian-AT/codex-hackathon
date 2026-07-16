---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "07"
subsystem: validation
tags: [bun, typescript, vitest, process-boundary, terminal-reporting, json, tdd]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: fail-closed validation results, named capability evidence, and the immutable eight-check catalog from Plan 06
provides:
  - Injected shell-disabled validation execution with immutable fixed argv, output bounds, timeouts, and explicit process failures
  - Required external-only integration adapter that prevents an in-suite baseline from recursively invoking test:integration
  - Complete deterministic human reports across 80, 40, and 39-column layouts
  - Internal run/baseline CLI with isolated one-document JSON output and pinned numeric exits
affects: [validation-host-adapters, validation-process-entry, package-script-wiring, phase-01-acceptance]
tech-stack:
  added: []
  patterns:
    - Host execution crosses an injected typed port carrying executable, frozen argv, shell false, byte cap, and timeout
    - External-only checks require caller-supplied evidence and cannot fall through to process execution
    - Human reporting and JSON serialization remain separate, with the human renderer late-loaded outside JSON mode
key-files:
  created:
    - src/validation/runner.ts
    - src/validation/runner.test.ts
    - src/validation/report.ts
    - src/validation/report.test.ts
    - src/validation/cli.ts
    - src/validation/cli.test.ts
  modified: []
key-decisions:
  - "Accept only the exact canonical catalog descriptor object before crossing an execution boundary; structurally similar caller input fails visibly."
  - "Bound stdout and stderr independently in the runner even when the injected host adapter claims to have bounded them, preserving defense in depth and deterministic truncation evidence."
  - "Late-load the default human renderer only after output mode selection so JSON mode has no human-renderer initialization path."
patterns-established:
  - "Validation process seam: canonical descriptor -> immutable ProcessRequest -> injected CheckRunnerPort -> normalized result."
  - "Responsive report seam: structured aggregate -> sanitized complete rows -> failure-dominant aggregate after every row."
requirements-completed: [IDEN-09, IDEN-10]
coverage:
  - id: D1
    description: "Canonical fixed-process checks cross only a shell-disabled injected port with immutable argv, bounded streams, a timeout, and explicit success/failure/timeout/interruption data."
    requirement: IDEN-09
    verification:
      - kind: unit
        ref: "src/validation/runner.test.ts#runValidationCheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Internal baselines preserve catalog order and require a controlled external result for test:integration while recording zero process calls for that descriptor."
    requirement: IDEN-09
    verification:
      - kind: unit
        ref: "src/validation/runner.test.ts#runValidationBaseline"
        status: pass
    human_judgment: false
  - id: D3
    description: "Human validation reports retain all status/source/check/reason evidence before the aggregate and wrap without clipping at 80, 40, and 39 columns."
    requirement: IDEN-10
    verification:
      - kind: unit
        ref: "src/validation/report.test.ts#renderValidationReport"
        status: pass
    human_judgment: false
  - id: D4
    description: "Internal run and baseline CLI modes emit one deterministic JSON document without initializing human rendering and map pass, fail, invalid, and interrupted states to pinned exits."
    requirement: IDEN-10
    verification:
      - kind: unit
        ref: "src/validation/cli.test.ts#runValidationCli"
        status: pass
    human_judgment: false
duration: 5 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 07: Isolated Validation Runtime and Reporting Summary

**Shell-free injected check execution, recursion-proof integration stubs, complete responsive reports, and one-write internal JSON output now implement the runtime contract above Plan 06's pure validation semantics.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-16T09:08:36Z
- **Completed:** 2026-07-16T09:12:48Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a canonical-descriptor runner that forwards only a fixed executable and frozen arguments through an injected `CheckRunnerPort`, always requests `shell: false`, bounds both streams, requires a timeout, and preserves explicit nonzero, spawn, timeout, interruption, and truncation evidence.
- Made `test:integration` require a caller-supplied external result, with fake-port proof that internal baselines never send its direct Vitest descriptor to the process port.
- Added complete fixed-order human reports with sanitized evidence, explicit empty-run failure copy, responsive 80/40/39-column layouts, and the aggregate only after every row.
- Added internal `run` and `baseline` CLI modes whose JSON branch emits one compact deterministic envelope plus newline without initializing the human renderer.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Specify runner, report, and internal CLI boundaries with fakes** — `a849ee2` (test)
2. **Task 2: GREEN — Implement shell-free execution and deterministic reporting** — `4f2510e` (feat)
3. **Task 3: REFACTOR — Close truncation, interruption, and report-edge gaps** — `9d59b83` (refactor)

## Files Created/Modified

- `src/validation/runner.ts` — Canonical descriptor validation, immutable process requests, bounded result normalization, product/capability gates, external-only evidence, and ordered baselines.
- `src/validation/runner.test.ts` — Recording fake-port matrices for exact argv, output limits, process outcomes, capability/product gates, integration recursion prevention, and repeatability.
- `src/validation/report.ts` — Sanitized complete-row projection, responsive wrapping, approved empty copy, counts, and aggregate rendering.
- `src/validation/report.test.ts` — Zero/one/many, empty, partial, control, long, width-boundary, row-order, and byte-stability proofs.
- `src/validation/cli.ts` — Internal run/baseline selection, pinned exits, deterministic JSON envelopes, and late human-renderer loading.
- `src/validation/cli.test.ts` — In-memory IO proof for one-write JSON, no human initialization, invalid/failure/interruption exits, and repeated-byte equality.

## Decisions Made

- Required descriptor object identity against the frozen catalog rather than accepting structurally similar process requests. This prevents callers from smuggling arbitrary executable or argument values through a compatible-looking object.
- Kept bounds in both the runner request and result normalization. Plan 08's host adapter must enforce capture limits, while this layer still refuses to trust injected output as already safe.
- Represented interruption as an explicit failed validation row and exit 130. Human output cannot print a success summary, and JSON still writes one complete parseable final document when the controlled runner returns interruption data.

## TDD Gate Compliance

- **RED:** `bun test/support/phase-1-gate.ts expect-red validation-runtime` executed all three registered suites and accepted 26 collected behavior assertion failures. No suite used a live process, package script, shell, network, model, or capability probe. Commit `a849ee2` records the RED evidence before implementation.
- **GREEN:** Commit `4f2510e` follows RED and made the 26 focused runner/report/CLI tests plus strict typecheck pass.
- **REFACTOR:** New exact-limit and 80/40/39 wrapping assertions produced three focused report failures before hardening. Commit `9d59b83` added complete responsive wrapping and repeatability coverage; the final validation tree passes 86 tests.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `bun test/support/phase-1-gate.ts expect-red validation-runtime` — passed the RED adjudicator after all three suites independently collected named assertion failures.
- `bun x vitest run src/validation/*.test.ts` — 6 files and 86 tests passed.
- `bun run typecheck` — passed.
- `bun x biome check src/validation` — 12 files passed.
- Commit-scope inspection — the three task commits changed only the six Plan 01-07 paths; no package script, dependency, host adapter, process entry, or real host execution was added.
- Static boundary inspection — no child-process import, shell-true request, `bun run` recursion, watch flag, `process.exit()`, or later-product import exists in the runtime, report, or internal CLI modules.

## Known Stubs

None. The injected process, capability, and external-integration functions are required dependency ports rather than successful placeholders; Plan 08 owns their concrete host adapters.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08 can implement the production process and Apple Silicon capability adapters against the now-tested ports, then provide the executable validation entry.
- Plan 09 remains the sole owner of package-script wiring and outer integration-suite invocation.

## Self-Check: PASSED

- All six Plan 01-07 files exist.
- Commits `a849ee2`, `4f2510e`, and `9d59b83` resolve in RED → GREEN → REFACTOR order.
- All 86 validation tests, strict typecheck, focused Biome, fixed-argv/fake-port assertions, report-width boundaries, and deterministic JSON checks passed on the final tree.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
