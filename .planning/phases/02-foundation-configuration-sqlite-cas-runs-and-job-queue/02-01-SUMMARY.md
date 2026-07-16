---
phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
plan: "01"
subsystem: foundation
tags: [typescript, zod, filesystem, containment, archives, atomic-writes]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: canonical MLX_HOME resolution, state ownership, and confined configuration
provides:
  - Component-wise non-following containment for every runtime destination
  - Side-effect-free archive member and link-target validation
  - Strict configuration with immutable canonical runtime-path projection
affects: [sqlite, cas, runs, jobs, datasets, models, mirrors]
tech-stack:
  added: []
  patterns: [lexical-before-filesystem validation, component-wise lstat containment, atomic config replacement]
key-files:
  created:
    - src/core/contained-path.ts
    - src/core/archive-path.ts
    - test/integration/foundation-config.test.ts
  modified:
    - src/lib/config.ts
    - src/lib/config.test.ts
key-decisions:
  - "Canonicalize MLX_HOME only after rejecting a symlink root, then inspect every existing component with lstat before permitting a missing suffix."
  - "Keep configured destinations relative and expose resolved absolute destinations only through an immutable runtime-path projection."
patterns-established:
  - "Filesystem destination pattern: reject lexically, inspect component-wise without following symlinks, then permit only a missing contained suffix."
  - "Archive pattern: validate member names and declared link targets independently without exposing extraction or write authority."
requirements-completed: [FNDN-01, FNDN-02]
coverage:
  - id: D1
    description: "Strict production configuration resolves every mutable destination beneath one canonical MLX_HOME and reports exact rejected fields."
    requirement: FNDN-01
    verification:
      - kind: unit
        ref: "src/lib/config.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/foundation-config.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Traversal, symlink, absolute-path, archive-member, and link-target escapes fail closed before filesystem writes."
    requirement: FNDN-02
    verification:
      - kind: unit
        ref: "src/core/contained-path.test.ts and src/core/archive-path.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/foundation-config.test.ts#rejects malformed configuration and hostile configured paths without writes"
        status: pass
    human_judgment: false
duration: 7 min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 01: Contained Configuration Foundation Summary

**Strict Zod configuration projected into canonical MLX_HOME paths, with non-following filesystem containment, archive escape rejection, and atomic explicit writes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T10:11:00Z
- **Completed:** 2026-07-16T10:18:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a single typed containment authority that rejects traversal, absolute injection, symlink roots/components/final targets, and realpath escape before accepting a path.
- Added pure archive member and link-target validation with no extraction or write primitive.
- Made production configuration strict, field-diagnostic, immutable at its runtime path boundary, and atomically replaceable only beneath canonical MLX_HOME.

## Task Commits

1. **Task 1: RED — Specify the contained production layout** — `682161d` (test)
2. **Task 2: GREEN — Implement the path and archive authorities** — `e7c80c3` (feat)
3. **Task 3: REFACTOR — Route production configuration through containment** — `204856d` (refactor)
4. **Scoped formatting normalization** — `e5f8e41` (style)
5. **Final symlink target coverage** — `bfd3020` (test)

## Files Created/Modified

- `src/core/contained-path.ts` — Typed lexical and component-wise non-following containment authority.
- `src/core/contained-path.test.ts` — Missing-suffix, traversal, absolute, ancestor-symlink, and final-symlink coverage.
- `src/core/archive-path.ts` — Pure validation for archive members and declared link targets.
- `src/core/archive-path.test.ts` — Absolute, traversal, NUL, drive, UNC, and link-escape cases.
- `src/lib/config.ts` — Strict schema, safe field diagnostics, canonical runtime layout, and atomic writes.
- `src/lib/config.test.ts` — Existing compatibility plus strict contained configuration behavior.
- `test/integration/foundation-config.test.ts` — Synthetic-root end-to-end hostile-path matrix with zero out-of-root writes.

## Decisions Made

- Existing root and path components must be ordinary non-symlink entries; conservative rejection avoids granting a symlink any destination authority even when its current target appears contained.
- Configuration stores relative destination names, while consumers receive a frozen absolute runtime layout. This keeps serialized configuration portable without weakening containment.
- Legacy `getProjectConfigPath` and `setProjectConfig` exports remain callable, but they retain no project-local precedence and writes use same-directory atomic replacement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the repository integration-test configuration for the planned integration gate**
- **Found during:** Task 1 RED verification
- **Issue:** The plan's literal Vitest command uses the unit config, whose include pattern excludes `test/integration/**`, so it returned “No test files found.”
- **Fix:** Ran the same test file through committed `vitest.integration.config.ts`; the RED assertions failed by named missing behavior and the final suite passed.
- **Files modified:** None beyond planned files.
- **Verification:** `bun x vitest run --config vitest.integration.config.ts test/integration/foundation-config.test.ts` passed all 3 tests.

---

**Total deviations:** 1 auto-fixed blocking verification issue.
**Impact on plan:** No product scope changed; the existing test configuration was required to collect the planned integration file.

## Issues Encountered

- `bun run check` executes a repository-wide Biome baseline and remains red on unrelated pre-existing operator files. A scoped Biome run over all seven plan files passed with no diagnostics; the failure is recorded in `deferred-items.md` and no unrelated hunks were touched.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/core/contained-path.test.ts src/core/archive-path.test.ts src/lib/config.test.ts` — 27 tests passed.
- `bun x vitest run --config vitest.integration.config.ts test/integration/foundation-config.test.ts` — 3 tests passed.
- `bun run typecheck` — LIVE PASS.
- Scoped `bun x biome check` across all seven plan files — passed.
- `bun run check` — LIVE FAIL from unrelated pre-existing files; no Plan 02-01 file appears in the diagnostics.

## Known Stubs

None. Empty arrays/objects found by the scan are typed test accumulators and configuration merge/default values, not unimplemented behavior.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: local-filesystem-path | `src/core/contained-path.ts` | New shared authority accepts untrusted destination strings only after lexical and component-wise containment checks. |
| threat_flag: archive-metadata | `src/core/archive-path.ts` | New pure boundary validates archive member and link metadata before any future extractor may write. |

## Next Phase Readiness

- SQLite, CAS, run, dataset, model, mirror, and job modules can consume one stable `RuntimePaths` projection rather than inventing destinations.
- The unrelated repository-wide Biome baseline remains deferred; focused Plan 02-01 quality gates are green.

## Self-Check: PASSED

- All seven plan files exist and all five task/follow-up commits resolve in repository history.
- The final tree passes 30 focused tests, typecheck, and scoped formatting/lint checks.
- No plan commit deletes a tracked file, and unrelated operator changes remain unstaged.

---
*Phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue*
*Completed: 2026-07-16*
