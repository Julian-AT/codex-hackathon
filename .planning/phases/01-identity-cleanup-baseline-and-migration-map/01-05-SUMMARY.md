---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "05"
subsystem: migration
tags: [bun, typescript, zod, migration-inventory, reconciliation, removal-gate, deterministic-review]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: canonical CLI/package/state/doctor paths and immutable Phase 1 pre-edit change-scope evidence from Plans 01-04
provides:
  - Versioned canonical JSON with 167 exact brownfield records across all nine mandatory categories
  - Controlled tracked/source snapshot that reconciles all 55 archived planning records without private-root traversal
  - Digest-aware computed removal gate that rejects stale, unreviewed, disallowed, or incomplete evidence
  - Byte-stable generated maintainer review with a non-mutating drift-check mode
affects: [validation-baseline, phase-01-ownership-freeze, later-phase-cleanup, migration-audit]
tech-stack:
  added: []
  patterns:
    - Zod-validated discriminated disk contracts before reconciliation or rendering
    - Fixed category then Unicode code-point locator order for canonical artifacts
    - Injected controlled Git/source snapshot with explicit evidenced-zero and not-inspected scope
    - Current evidence recomputation instead of trusting declared removal eligibility
    - Exact current legacy-target digest/version verification before approved deletion
key-files:
  created:
    - src/migration/inventory-schema.ts
    - src/migration/inventory-schema.test.ts
    - src/migration/repository-scanner.ts
    - src/migration/repository-scanner.test.ts
    - src/migration/removal-gate.ts
    - src/migration/removal-gate.test.ts
    - src/migration/render-review.ts
    - src/migration/render-review.test.ts
    - migration/legacy-assets.v1.json
    - migration/legacy-assets.v1.md
  modified:
    - migration/legacy-assets.v1.json
    - migration/legacy-assets.v1.md
    - src/migration/inventory-schema.ts
    - src/migration/removal-gate.ts
    - src/migration/removal-gate.test.ts
    - src/migration/render-review.ts
    - src/migration/render-review.test.ts
key-decisions:
  - "Canonical reconciliation consumes an explicit tracked/source snapshot embedded in the inventory; it never recursively walks ignored, private, or operator-controlled roots."
  - "Stable record IDs hash category plus exact semantic locator, while duplicate exact locators fail even when categories differ."
  - "Every non-remove record remains removal-blocked, and remove eligibility is recomputed from current exact evidence, coverage, reviewed ownership, digest/version, and approval."
  - "The product-string category is evidenced zero from the completed Plan 02 identity audit instead of being filled with fake records."
  - "The post-merge prohibited root prompt is retained as an exact product-string migration record even after its separately gated deletion."
patterns-established:
  - "Inventory authority: validate JSON, scan the controlled snapshot, reconcile one-to-one, then render; no later stage may bypass an earlier gate."
  - "Privacy honesty: external/operator runtime classes say not-inspected with a reason instead of being reported absent."
  - "Review projection: Markdown is generated solely from canonical JSON and check mode never rewrites drift."
requirements-completed: [IDEN-07, IDEN-08]
coverage:
  - id: D1
    description: "A schema-valid canonical inventory contains 167 exact records across all nine categories, eleven runtime-state classes, and all 55 archived planning paths."
    requirement: IDEN-07
    verification:
      - kind: unit
        ref: "src/migration/inventory-schema.test.ts#MIGRATION_INVENTORY_SCHEMA"
        status: pass
      - kind: unit
        ref: "src/migration/repository-scanner.test.ts#reconciles the canonical inventory against its controlled Git/source snapshot"
        status: pass
    human_judgment: false
  - id: D2
    description: "Removal stays blocked unless the exact locator, reviewed owner, requirement and acceptance coverage, allowed current evidence, digest/version, and approval all pass."
    requirement: IDEN-08
    verification:
      - kind: unit
        ref: "src/migration/removal-gate.test.ts#computeRemovalEligibility"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete maintainer review regenerates byte-identically, detects drift without rewriting, and leaves the immutable preflight change-scope artifact unchanged."
    requirement: IDEN-07
    verification:
      - kind: unit
        ref: "src/migration/render-review.test.ts#renderMigrationReview"
        status: pass
      - kind: other
        ref: "bun src/migration/render-review.ts --check"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 1 migration review deletes no legacy production source or runtime asset."
    requirement: IDEN-08
    verification:
      - kind: other
        ref: "git diff --diff-filter=D --name-only c331d47^..b5ff657"
        status: pass
    human_judgment: false
  - id: D5
    description: "The prohibited root cloud-build prompt introduced by merge 3881d89 was deleted only after its exact current digest and required canonical MLX identity evidence computed eligible."
    requirement: IDEN-08
    verification:
      - kind: unit
        ref: "src/migration/removal-gate.test.ts#proves the inventoried prohibited root prompt is eligible only with exact current identity evidence"
        status: pass
      - kind: other
        ref: "commit 0838993 deletion scan"
        status: pass
    human_judgment: false
duration: 8 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 05: Canonical Migration Inventory and Removal Gate Summary

**A 167-record, privacy-bounded migration authority reconciles every discovered legacy locator and now verifies the exact current target before any approved cleanup.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T08:39:54Z
- **Completed:** 2026-07-16T08:46:58Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added a versioned Zod contract and canonical JSON containing 167 exact records: 22 legacy commands, 3 executable invocations, 22 runtime paths, 29 generated artifacts, 15 scripts, 9 dynamic-tool paths, 11 iOS components, all 55 archived planning paths, and one exact prohibited product-string artifact introduced by merge `3881d89`.
- Added deterministic one-to-one repository reconciliation over controlled tracked paths and source declarations, with exact exclusions and explicit not-inspected runtime/operator classes that never open sensitive roots.
- Added a computed removal gate that ignores declared eligibility and blocks missing ownership, coverage, evidence, stale digest/version, disallowed evidence kind, absent locator, or pending review.
- Generated a complete byte-stable Markdown review from validated JSON and proved drift checks do not rewrite either the review or Plan 01's immutable change-scope baseline.
- Reconciled and removed `forgeprint-codex-cloud-master-prompt.md` only after current target digest/version plus README, identity-schema, identity-test, and package-marker evidence computed eligible.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Specify schema, reconciliation, and removal failures** — `c331d47` (test)
2. **Task 2: GREEN — Reconcile the canonical complete JSON inventory** — `d4115fe` (feat)
3. **Task 3: REFACTOR — Generate the deterministic maintainer review** — `b5ff657` (refactor)
4. **Incident RED — Require exact target and identity evidence** — `377576f` (test)
5. **Incident gate — Inventory and approve the prohibited merged artifact** — `99b93cf` (fix)
6. **Incident cleanup — Delete only the approved root artifact** — `0838993` (fix)

## Files Created/Modified

- `src/migration/inventory-schema.ts` — Versioned category, runtime-state, locator, exclusion, record, evidence, review, and inventory schemas with deterministic IDs/order.
- `src/migration/repository-scanner.ts` — Controlled tracked/source discovery, exact exclusion checks, mandatory-category enforcement, and one-to-one reconciliation.
- `src/migration/removal-gate.ts` — Current-evidence digest calculation and fail-closed removal computation/validation.
- `src/migration/render-review.ts` — Pure complete Markdown projection plus internal `--write` and non-mutating `--check` modes.
- `src/migration/*.test.ts` — 30 focused schema, scanner, reconciliation, privacy, removal, determinism, rendering, and drift tests.
- `migration/legacy-assets.v1.json` — Canonical versioned inventory authority with 166 records.
- `migration/legacy-assets.v1.md` — Generated complete maintainer review.
- `forgeprint-codex-cloud-master-prompt.md` — Deleted after exact inventory, current-digest, replacement-evidence, and approval gates passed; provenance remains in canonical JSON/review.

## Decisions Made

- Stored the controlled tracked/source snapshot inside the canonical JSON so reconciliation can be repeated without scanning ignored roots or depending on volatile dirty-worktree counts.
- Derived record identity from category plus exact path/kind/value locator and rejected duplicate semantic locators independently from record IDs.
- Kept every legacy asset non-removable in Phase 1. Even future `remove` records must pass computed current-evidence checks; declarations alone have no authority.
- Represented the clean product-string category as evidenced zero and external/operator state as not-inspected, preserving the difference between absence and deliberately unopened scope.
- After merge `3881d89` introduced a prohibited root cloud prompt, converted product-string coverage from evidenced zero to one exact record and required its SHA-256/blob version plus four current canonical identity evidence locators before deletion.

## TDD Gate Compliance

- **RED:** The registered `migration-inventory` gate collected all three independent suites and accepted 26 named public-behavior failures with no import, setup, syntax, fixture, or no-tests failure. Commit `c331d47` records `RED:` evidence.
- **GREEN:** Commit `d4115fe` follows RED, adds the schema/scanner/gate and canonical JSON, and makes the schema, reconciliation, removal, and typecheck gates pass.
- **REFACTOR:** Commit `b5ff657` adds the pure deterministic projection and drift-check process; the complete 30-test suite and typecheck remain green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Reconciled and safely removed a prohibited post-plan root artifact**
- **Found during:** Post-merge incident remediation after merge `3881d89`
- **Issue:** `forgeprint-codex-cloud-master-prompt.md` reintroduced prohibited Forgeprint/codex product identity and unsafe private-repository instructions, but was absent from the canonical migration inventory.
- **Fix:** Added exact locator/source digest/blob version/provenance, mapped reviewed MLX identity ownership and requirements, hardened removal eligibility to require current target and named replacement evidence, proved computed eligibility, then deleted only the approved artifact.
- **Files modified:** `migration/legacy-assets.v1.{json,md}`, `src/migration/{inventory-schema,removal-gate,render-review}.ts`, focused tests, and the exact root artifact.
- **Verification:** 33 migration tests, 5 identity-audit tests, typecheck, focused Biome, canonical help, byte-stable review, exact computed eligibility, and single-path deletion scan passed.
- **Committed in:** `377576f`, `99b93cf`, `0838993`

---

**Total deviations:** 1 auto-fixed missing-critical incident.
**Impact on plan:** The follow-up operator authorization permitted deletion of this exact non-production prompt artifact only; no Plan 01-06 source or operator-owned path changed.

## Issues Encountered

- Zod's default regex error for a broad exclusion did not identify the fail-closed rule clearly. The scanner now converts it into an actionable exact-path/broad/wildcard error before reconciliation.
- Vitest runs under Node in this repository, so the renderer process test invokes the checked-in Bun runtime explicitly instead of relying on `process.execPath` to execute TypeScript.
- Merge `3881d89` arrived after Plan 01-05 completion and invalidated the earlier evidenced-zero product-string count; remediation preserved merge history and repaired the inventory rather than rewriting Git state.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/migration/*.test.ts` — 4 files and 33 tests passed after incident hardening.
- `bun x vitest run src/identity/audit.test.ts` — 5 tests passed.
- `bun run typecheck` — passed.
- `bun src/migration/render-review.ts --write` followed by `--check` — passed; review SHA-256 remained `2c98d7a09fe13bc064bbc94912c69090e34646af3f1263a7d18b08192325929a`.
- Canonical reconciliation — 167 records, 55 planning artifacts, 9 categories, and 11 runtime-state classes; zero missing/extra/duplicate/order/coverage findings.
- Incident removal gate — record `4e52e5b7239ce8a85cb331f27c8699f9a2091bca702422a2bbe6500e1860f033` computed `eligible` with no reasons; current and recorded target digest both equaled `d27cd18bd26590b013d92a4f5663a9f498f6794ecff8209485b56ffd8f8bc95e`.
- Cleanup commit `0838993` deleted exactly `forgeprint-codex-cloud-master-prompt.md` and no other path.
- Immutable preflight baseline — SHA-256 remained `012397cb2e5651535cf7eea7e24250bcbe38ced0f9debe60ebe692a1ebf06677` before and after regeneration.
- Plan commit-range deletion scan — zero deleted paths.

## Known Stubs

None. Empty replacement-evidence arrays are intentional fail-closed data for non-remove records; they cannot authorize cleanup.

## Next Phase Readiness

- Plan 06 can build honest validation results against a complete machine-readable migration authority.
- Plan 09 retains sole ownership of the final Phase 1 path/hunk ownership freeze and deletion audit after Plans 06-09 finish.
- No production legacy asset was deleted, moved, or rewritten by this plan.
- The prohibited non-production root prompt is absent while its exact incident provenance and approved removal evidence remain reviewable.

## Self-Check: PASSED

- All ten plan-owned files exist.
- Commits `c331d47`, `d4115fe`, `b5ff657`, `377576f`, `99b93cf`, and `0838993` resolve in the required inventory-before-deletion order.
- All focused tests, identity audit, typecheck, canonical help, canonical reconciliation, deterministic regeneration, immutable-baseline, removal-eligibility, and exact-deletion guards passed on the final tree.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
