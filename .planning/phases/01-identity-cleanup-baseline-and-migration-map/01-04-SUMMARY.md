---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "04"
subsystem: identity
tags: [bun, typescript, doctor, path, executable-ownership, security]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: sole packaged mlx executable, ownership marker, typed CLI dispatch, and non-creating state boundary
provides:
  - Read-only PATH-ordered mlx executable discovery with complete shadowed evidence
  - Two-factor executable ownership from entry realpath and validated packaged marker
  - Deterministic owned, collision, and not-found human/JSON outcomes with pinned exits
  - Synthetic hostile executable, symlink, metadata, repetition, and concurrency proof
affects: [phase-01-validation, package-bin, local-installation, phase-02-foundation]
tech-stack:
  added: []
  patterns:
    - Injected read-only filesystem ports for hostile host metadata inspection
    - Error-as-data candidate evidence with PATH-order preservation
    - Separate exact JSON evidence and terminal-sanitized human projection
key-files:
  created:
    - src/core/doctor.ts
    - src/core/doctor.test.ts
    - src/cli/doctor.ts
    - test/integration/doctor-cli.test.ts
    - fixtures/phase-1/doctor/candidates.json
  modified:
    - src/cli/main.ts
    - src/cli/main.test.ts
    - src/cli/render-human.ts
key-decisions:
  - "Treat every exact mlx path entry that cannot be proven owned, including broken, cyclic, non-executable, or interrupted metadata, as fail-closed collision evidence."
  - "Require both candidate-to-declared-entry realpath equality and exact validated mlx.package.json contents before returning OWNED."
  - "Preserve duplicate, empty, and relative PATH entries in their original diagnostic order rather than deduplicating evidence."
patterns-established:
  - "Host inspection: lstat/stat/realpath exact candidates, read only the known package marker, and expose no remediation or candidate-body API."
  - "Doctor concurrency: purity and read-only operations provide repeat/parallel equivalence without locks or writes."
requirements-completed: [IDEN-02, IDEN-04]
coverage:
  - id: D1
    description: "mlx doctor classifies the effective candidate and all shadowed candidates as owned, collision, or not-found with PATH-ordered evidence in human and JSON modes."
    requirement: IDEN-04
    verification:
      - kind: unit
        ref: "src/core/doctor.test.ts#inspectExecutableCandidates"
        status: pass
      - kind: integration
        ref: "test/integration/doctor-cli.test.ts#public mlx doctor"
        status: pass
      - kind: other
        ref: "bun run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hostile executable bodies, symlinks, PATH data, aliases, shell configuration, and state sentinels remain byte- and mode-identical across repeated, interrupted, and parallel diagnosis."
    requirement: IDEN-02
    verification:
      - kind: unit
        ref: "src/core/doctor.test.ts#leaves bytes modes links aliases shell data and state roots unchanged"
        status: pass
      - kind: integration
        ref: "test/integration/doctor-cli.test.ts#never executes or mutates a hostile body"
        status: pass
      - kind: integration
        ref: "test/integration/package-bin.test.ts"
        status: pass
    human_judgment: false
duration: 12 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 04: Read-Only Executable Collision Doctor Summary

**PATH-ordered executable diagnosis that requires entry-realpath and packaged-marker agreement, retains hostile inspection evidence, and never executes or mutates a candidate**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T08:15:00Z
- **Completed:** 2026-07-16T08:26:52Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added an injected doctor core that inspects exact `mlx` candidates with read-only metadata calls, preserves PATH order and duplicates, and reports broken or incomplete inspection as safe evidence.
- Wired the public `doctor` leaf to deterministic `OWNED`, `COLLISION`, and `NOT FOUND` human output plus equivalent structured JSON and stable nonzero failure exits.
- Proved executable bodies are never opened or launched and that repeated, interrupted, and parallel diagnoses preserve candidate, symlink, PATH, alias, shell, and state sentinels.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Build the synthetic doctor attack matrix** — `bdf2f61` (test)
2. **Task 1 fixture correction — Model an installed executable without mutating the repository entry** — `c2588db` (test)
3. **Task 2: GREEN — Classify effective and shadowed candidates read-only** — `14efd0a` (feat)
4. **Task 3: REFACTOR — Close symlink, concurrency, and terminal-evidence gaps** — `51d1de6` (test)

## Files Created/Modified

- `src/core/doctor.ts` — Injected read-only candidate discovery, ownership validation, and deterministic result contract.
- `src/core/doctor.test.ts` — PATH ordering, marker mismatch, symlink, metadata, no-body-read, and nonmutation matrix.
- `src/cli/doctor.ts` — Production read-only filesystem adapter and public doctor result projection.
- `src/cli/main.ts` — Lazy built-in doctor dispatch, statuses, errors, and pinned exit codes.
- `src/cli/main.test.ts` — Built-in doctor dispatch and absent-candidate no-read proof.
- `src/cli/render-human.ts` — Terminal-sanitized, complete doctor evidence and remediation guidance.
- `test/integration/doctor-cli.test.ts` — Public process human/JSON/exit/no-execution/repeat/parallel/long-path proof.
- `fixtures/phase-1/doctor/candidates.json` — Versioned attack scenarios and repeat/parallel parameters.

## Decisions Made

- Exact but non-executable, broken, cyclic, or unreadable `mlx` entries are collision evidence rather than silently disappearing as not-found; this preserves safe evidence and fails closed.
- Ownership requires an executable regular file whose realpath equals the package-declared entry plus an exact, schema-versioned ownership marker. Filename, mode, realpath, or marker alone is insufficient.
- Empty and relative PATH entries resolve lexically against the injected working directory, while duplicate entries remain duplicated in the report so diagnostics reflect the operator's actual PATH order.

## TDD Gate Compliance

- **RED:** `bun test/support/phase-1-gate.ts expect-red doctor` accepted three collected unit behavior failures and two collected process behavior failures. Commit `bdf2f61` includes the explicit `RED:` evidence in its body.
- **GREEN:** Commit `14efd0a` follows the RED commits and makes the focused unit, public-process, state-boundary, CLI-contract, and typecheck suites pass.
- **REFACTOR:** Commit `51d1de6` pins exact failed-inspection evidence, fixture-driven repeat/parallel counts, and human not-found copy while the complete targeted suite stays green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Modeled owned execution through an isolated installed package fixture**
- **Found during:** Task 2 GREEN
- **Issue:** The checked-in Bun source entry is intentionally invoked through `bun` and is not executable in the working tree, so a direct symlink could not model an installed executable without mutating repository mode bits.
- **Fix:** Copied the package's CLI/core graph into the test sandbox, set executable mode only on that isolated entry, and ran the public process against it.
- **Files modified:** `test/integration/doctor-cli.test.ts`
- **Verification:** Owned, foreign-first/owned-shadowed, and not-found process scenarios pass; repository entry mode remains untouched.
- **Committed in:** `c2588db`

**2. [Rule 1 - Cross-Plan Test Assumption] Updated the CLI unit contract for the newly implemented doctor leaf**
- **Found during:** Task 2 GREEN regression verification
- **Issue:** Plan 01-01 tests expected `doctor` to have no built-in handler and supplied a deliberately partial handler result that the real doctor renderer correctly rejected.
- **Fix:** Kept handler override coverage with an isolated renderer and replaced the obsolete missing-handler assertion with an injected absent-PATH built-in doctor proof.
- **Files modified:** `src/cli/main.test.ts`
- **Verification:** CLI unit, CLI contract integration, doctor integration, and state integration suites pass.
- **Committed in:** `14efd0a`

---

**Total deviations:** 2 auto-fixed bugs.
**Impact on plan:** Both changes were required to preserve existing test intent and prove the public behavior without mutating repository or operator state; no later-phase scope was introduced.

## Issues Encountered

- The Phase 1 RED gate correctly rejected an early test that allowed an empty subprocess response to throw during JSON parsing. The test was changed before the RED commit so missing behavior remained a collected assertion failure rather than setup/transform evidence.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/core/doctor.test.ts` — 3 tests passed.
- `bun x vitest run --config vitest.integration.config.ts test/integration/doctor-cli.test.ts test/integration/state-cli.test.ts test/integration/package-bin.test.ts` — 12 tests passed.
- `bun x vitest run src/cli/main.test.ts` — 6 tests passed.
- `bun run typecheck` — passed.
- Forbidden-operation scan over `src/core/doctor.ts` and `src/cli/doctor.ts` found no shell/process execution, lookup command, write, unlink, rename, chmod, install, or link seam.
- Plan commit-range deletion scan found zero deleted paths.

## Known Stubs

None. Empty arrays and nullable values in the doctor core represent deterministic zero-candidate and not-yet-inspected evidence states, not placeholder behavior. Existing owner-tagged later-phase `UNAVAILABLE` copy remains outside this plan's doctor implementation.

## Next Phase Readiness

- The package marker, executable entry, state boundary, and doctor classification now form a complete collision-safe Phase 1 operator surface.
- Migration inventory and validation plans can cite stable doctor paths, codes, and ownership evidence without inspecting live operator state during tests.

## Self-Check: PASSED

- All five created files and three modified contract files exist.
- Commits `bdf2f61`, `c2588db`, `14efd0a`, and `51d1de6` resolve in history in RED → GREEN → REFACTOR order.
- Unit, public-process, package, state-boundary, CLI-contract, typecheck, forbidden-operation, and deletion checks passed on the final tree.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
