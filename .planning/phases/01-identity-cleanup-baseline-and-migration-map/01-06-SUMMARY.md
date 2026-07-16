---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "06"
subsystem: validation
tags: [bun, typescript, zod, validation, capabilities, immutable-catalog, tdd]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: canonical CLI identity, safe state/doctor behavior, and complete migration authority from Plans 01-05
provides:
  - Fail-closed validation result normalization with independent status and evidence source
  - Named host capability evidence as the sole authority for a validation SKIP
  - Failure-dominant ordered aggregation that retains every normalized row
  - Immutable ordered descriptors for all eight required validation identities
  - External-only integration descriptor with an explicit internal stub seam
affects: [validation-runtime, validation-host-adapters, package-script-wiring, phase-01-acceptance]
tech-stack:
  added: []
  patterns:
    - Strict Zod parsing at untrusted validation and capability boundaries
    - Discriminated PASS/FAIL/SKIP results with source classification kept independent
    - Deep-frozen literal check descriptors with fixed direct executable arguments
    - External-only self-integration policy requiring injected internal stubs
key-files:
  created:
    - src/validation/result.ts
    - src/validation/result.test.ts
    - src/validation/capabilities.ts
    - src/validation/capabilities.test.ts
    - src/validation/check-catalog.ts
    - src/validation/check-catalog.test.ts
  modified: []
key-decisions:
  - "Malformed checker input becomes a visible LIVE FAIL normalization row; a valid declared source is preserved when available and is never inferred from status."
  - "Only strict named capability evidence with available=false authorizes SKIP; fixture, replay, mock, missing product, and unprobed states cannot."
  - "Unit and integration suite descriptors are labeled FIXTURE, while code-health checks, product gates, and host capability checks remain LIVE."
  - "test:integration is declaratively external-only with fixed direct Vitest argv and an integration-suite-self stub ID; no catalog descriptor executes a package script."
patterns-established:
  - "Validation normalization: strict parse, preserve safe identity/source evidence, fail closed, and retain the row."
  - "Validation aggregation: preserve input order and apply FAIL over SKIP over PASS without suppressing rows."
  - "Check authority: later runners consume only frozen catalog executable/argv or typed product/capability/external gates."
requirements-completed: [IDEN-09, IDEN-10]
coverage:
  - id: D1
    description: "Malformed, empty, contradictory, unknown, and invalid-skip checker inputs normalize deterministically to visible FAIL rows while valid status and source remain independent."
    requirement: IDEN-10
    verification:
      - kind: unit
        ref: "src/validation/result.test.ts#normalizeValidationResult"
        status: pass
      - kind: unit
        ref: "src/validation/capabilities.test.ts#canSkipForCapability"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ordered aggregation retains all rows, synthesizes an explicit empty-run FAIL, and applies FAIL over SKIP over PASS."
    requirement: IDEN-10
    verification:
      - kind: unit
        ref: "src/validation/result.test.ts#aggregateValidationResults"
        status: pass
    human_judgment: false
  - id: D3
    description: "All eight validation identities have unique frozen descriptors with fixed direct argv or typed product, capability, and external-only execution policies."
    requirement: IDEN-09
    verification:
      - kind: unit
        ref: "src/validation/check-catalog.test.ts#CHECK_CATALOG"
        status: pass
      - kind: other
        ref: "bun -e catalog static assertions"
        status: pass
    human_judgment: false
duration: 8 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 06: Pure Validation Semantics and Ordered Check Contract Summary

**Strict validation normalization, capability-only SKIP authority, and eight frozen non-recursive check descriptors now define the contract later host runners must obey.**

## Performance

- **Duration:** 8 min active implementation, followed by incident-safe verification-only close-out
- **Started:** 2026-07-16T08:47:00Z
- **Completed:** 2026-07-16T09:03:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added strict capability and validation boundaries that preserve honest source labels, turn malformed or contradictory input into stable visible failures, and never promote fixture, replay, mock, missing-product, or unprobed evidence into a valid SKIP.
- Added deterministic ordered aggregation with explicit zero-row failure synthesis, complete row retention, and failure-dominant status precedence.
- Added one immutable eight-entry catalog covering direct Biome, TypeScript, unit Vitest, and integration Vitest tokens plus explicit Phase 8/5/6 product failures and the named Apple Silicon capability gate.
- Made `test:integration` external-harness-only with fixed direct Vitest arguments and a typed stub identity, preventing in-suite recursive execution by construction.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Define fail-closed result and capability matrices** — `635b2f6` (test)
2. **Task 2: GREEN — Implement truthful normalization and capability evidence** — `86e2cf5` (feat)
3. **Task 3: REFACTOR — Pin the ordered eight-check catalog and recursion policy** — `05ba623` (refactor)

## Files Created/Modified

- `src/validation/result.ts` — Strict result parsing, structured fail-closed normalization, ordered row retention, empty-run failure, and aggregate precedence.
- `src/validation/capabilities.ts` — Strict named capability evidence parsing and unavailable-only SKIP eligibility.
- `src/validation/check-catalog.ts` — Frozen ordered descriptors for the eight required validation identities and their execution policies.
- `src/validation/result.test.ts` — Twenty-seven status/source/invalid-input/aggregation behavior tests.
- `src/validation/capabilities.test.ts` — Seventeen capability parsing and SKIP-authority tests.
- `src/validation/check-catalog.test.ts` — Eleven ordering, uniqueness, source, ownership, argv, immutability, lookup, and recursion-policy tests.

## Decisions Made

- Used `LIVE` as the source of the normalizer's own fail-closed row only when malformed input supplies no valid source. A valid `LIVE`, `REPLAY`, or `FIXTURE` source survives normalization independently from status.
- Labeled real unit and synthetic integration suite execution as `FIXTURE`; this prevents green test output from impersonating live product acceptance.
- Kept the catalog completely declarative. Plan 07 must supply injected execution ports and external stubs, Plan 08 must supply host adapters, and Plan 09 alone may wire package scripts.
- Used the exact stable script names as check IDs so package mapping cannot introduce aliases or mutable caller-selected arguments.

## TDD Gate Compliance

- **RED:** `bun test/support/phase-1-gate.ts expect-red validation-results` accepted both suites after collecting 44 named behavior assertion failures with no setup, import, collection, syntax, fixture, or no-tests failure. Commit `635b2f6` records `RED:` evidence.
- **GREEN:** Commit `86e2cf5` follows RED and makes all 44 result/capability tests plus strict typecheck pass.
- **REFACTOR:** The catalog suite first collected 11 missing-behavior assertions, then commit `05ba623` added the immutable declaration. The final tree passes all 55 tests, typecheck, and focused Biome.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A concurrent external Git merge appeared between the GREEN and REFACTOR commits. Execution halted without altering history; operator-authorized remediation later removed the unrelated artifact. All three Plan 01-06 commits remained intact and were reverified from the remediated HEAD before close-out.

## Verification

- `bun x vitest run src/validation/result.test.ts src/validation/capabilities.test.ts src/validation/check-catalog.test.ts` — 3 files and 55 tests passed.
- `bun run typecheck` — passed.
- `bun x biome check src/validation` — 6 files passed.
- Catalog static assertions — exactly eight unique ordered IDs; all descriptors/execution records frozen; no shell field, recursive `bun run`, mutable argv, alias, or callable handler; `test:integration` is external-only.
- Commit-scope assertion — Plan 01-06 changed only the six `src/validation/` contract/test paths; no host adapter, process entry, package script, dependency, or lockfile wiring was added by the plan commits.

## Known Stubs

None. The three product gates are intentional typed LIVE FAIL contracts for absent Phase 8/5/6 products, and the external integration stub ID is an explicit non-recursive dependency seam owned by Plan 07 rather than a successful placeholder.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 07 can implement its runner/report/CLI exclusively against typed normalized results and the frozen descriptor union, using an injected stub for `test:integration`.
- Plan 08 can later implement the catalog's direct host process and Apple Silicon capability adapters without accepting raw executable or argv input.
- Package scripts remain untouched and correctly owned by Plan 09.

## Self-Check: PASSED

- All six plan-owned files exist.
- Commits `635b2f6`, `86e2cf5`, and `05ba623` resolve in RED → GREEN → REFACTOR order and remain reachable from the remediated HEAD.
- All 55 focused tests, strict typecheck, focused Biome, catalog invariants, and no-host/no-package-wiring assertions passed on the final tree.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
