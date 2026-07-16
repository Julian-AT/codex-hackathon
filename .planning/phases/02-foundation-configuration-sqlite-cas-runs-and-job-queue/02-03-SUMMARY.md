---
phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
plan: "03"
subsystem: database
tags: [bun, sqlite, wal, concurrency, leases, doctor]
requires:
  - phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
    provides: contained owned runtime paths and migrated Bun SQLite catalog
provides:
  - Real embedded SQLite version, pragma, and bounded WAL concurrency evidence
  - Exclusive renewable catalog-owner lease with explicit stale recovery
  - Additive human and JSON doctor reporting that preserves executable collision priority
affects: [catalog-services, jobs, runs, retention, doctor]
tech-stack:
  added: []
  patterns: [isolated runtime capability probes, atomic lock-directory quarantine, additive doctor evidence]
key-files:
  created:
    - src/core/sqlite-capability.ts
    - src/catalog/catalog-owner.ts
    - src/cli/doctor.test.ts
  modified:
    - src/cli/doctor.ts
    - src/cli/render-human.ts
key-decisions:
  - "Grant multi-owner mutation only from a passing two-process WAL probe; an embedded version string never authorizes it."
  - "Move the whole owner directory to a nonce-named quarantine before compare/release or stale deletion so renewal races fail closed."
patterns-established:
  - "Capability pattern: execute bounded disposable work below the owned root, report sanitized evidence, and remove the fixture on every outcome."
  - "Lease pattern: exclusive directory creation plus immutable nonce/process identity and compare-before-delete quarantine."
requirements-completed: [FNDN-05]
coverage:
  - id: D1
    description: "Doctor reports the actual embedded SQLite version, pragma state, concurrent WAL result, and catalog-owner policy without weakening executable collision outcomes."
    requirement: FNDN-05
    verification:
      - kind: unit
        ref: "src/cli/doctor.test.ts"
        status: pass
      - kind: integration
        ref: "MLX_HOME=<owned-temp> bun src/cli.tsx doctor --json"
        status: pass
    human_judgment: false
  - id: D2
    description: "Catalog mutation authority is unique, renewable, compare-released, and only explicitly recoverable after expiration and process death."
    requirement: FNDN-05
    verification:
      - kind: unit
        ref: "src/catalog/catalog-owner.test.ts"
        status: pass
      - kind: integration
        ref: "src/core/sqlite-capability.test.ts#bounded WAL concurrency"
        status: pass
    human_judgment: false
duration: 7 min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 03: SQLite Capability and Catalog Owner Summary

**Real two-process WAL evidence gates multi-owner mutation, while atomic renewable ownership and additive doctor output preserve fail-closed catalog and executable safety**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T10:29:51Z
- **Completed:** 2026-07-16T10:36:40Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added an isolated SQLite probe that reads `sqlite_version()` from Bun's actual connection, verifies WAL and foreign keys, drives two concurrent writer processes through 50 unique transactions, checkpoints during contention, and cleans up every capability database.
- Added exclusive catalog ownership with nonce, PID/start identity, expiry, renewal, process-liveness checks, explicit stale recovery, and atomically quarantined compare/release behavior.
- Extended `mlx doctor` human and JSON data with sanitized SQLite and owner-gate evidence while retaining executable collision/not-found as the primary status and exit code.

## Task Commits

1. **Task 1: RED — Specify doctor capability and owner exclusion** — `0255080` (test)
2. **Task 2: GREEN — Implement the capability probe and catalog owner** — `2671506` (feat)
3. **Task 3: REFACTOR — Add SQLite evidence to doctor** — `f50a086` (refactor)

## Files Created/Modified

- `src/core/sqlite-capability.ts` — Bounded real-runtime version, pragma, checkpoint, and concurrent-writer probe.
- `src/core/sqlite-capability.test.ts` — Actual Bun runtime, repeatability, cleanup, and unowned-root coverage.
- `src/catalog/catalog-owner.ts` — Exclusive renewable owner acquisition, quarantine recovery, and compare/release API.
- `src/catalog/catalog-owner.test.ts` — Contention, renewal, stale recovery, malformed evidence, and changed-nonce coverage.
- `src/cli/doctor.ts` — Typed executable/SQLite probe composition and sanitized owner policy projection.
- `src/cli/doctor.test.ts` — Human/JSON evidence, collision precedence, unsafe-version, error sanitization, and owner exclusion tests.
- `src/cli/render-human.ts` — Human-readable SQLite, concurrency, and catalog-owner status.

## Decisions Made

- Multi-owner safety is a property of the exact runtime's successful executable probe, not a semantic-version threshold. Any failure or error retains the exclusive owner requirement.
- Owner recovery first atomically renames the entire lock directory. Only byte-identical expired evidence from a dead PID is deleted, and recovery requires an explicit flag.
- PID reuse is handled conservatively: any live PID blocks automatic recovery even when the recorded start identity differs. This may require operator intervention but cannot grant two owners.
- Probe subprocesses use a fixed Bun executable and static source without a shell or caller-selected command boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added human doctor rendering for the planned evidence**
- **Found during:** Task 3
- **Issue:** Updating only `src/cli/doctor.ts` would make JSON truthful but leave the plan's required human output unaware of SQLite and owner-gate status.
- **Fix:** Extended the existing doctor renderer and asserted its version, WAL, and owner-policy lines.
- **Files modified:** `src/cli/render-human.ts`, `src/cli/doctor.test.ts`
- **Verification:** `bun x vitest run src/cli/doctor.test.ts src/cli/renderers.test.ts` passed.
- **Committed in:** `f50a086`

**2. [Rule 3 - Verification] Corrected the live verification shell variable**
- **Found during:** Final CLI verification
- **Issue:** Zsh reserves `status`, so the first diagnostic wrapper stopped after printing valid doctor JSON and before cleanup.
- **Fix:** Removed the isolated temporary root, reran with `exit_code`, asserted the JSON fields programmatically, and removed all temporary artifacts.
- **Files modified:** None.
- **Verification:** The repeated live run reported SQLite 3.51.0, 50 committed writes, a passing probe, and the expected executable-not-found exit 6.

---

**Total deviations:** 2 auto-fixed (1 missing critical output path, 1 verification wrapper issue).
**Impact on plan:** Product scope did not change; the human renderer was necessary to satisfy the stated human/JSON contract, and the verification retry left no artifact.

## Issues Encountered

- The full `bun run test` gate reaches 498 passing tests and fails two unrelated pre-existing `src/commands/commands.test.ts` cases because those tests call production configuration against a missing default `~/.mlx`. The failure is recorded in `deferred-items.md`; all Plan 02-03 tests pass in both Vitest and direct Bun execution.
- `bun run check` passes with ten existing lint warnings in unrelated legacy files.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/cli/doctor.test.ts src/core/sqlite-capability.test.ts src/catalog/catalog-owner.test.ts` — 11 tests passed.
- `bun test src/cli/doctor.test.ts src/core/sqlite-capability.test.ts src/catalog/catalog-owner.test.ts` — 11 direct Bun tests passed.
- Related doctor/render suite — 26 tests passed.
- `bun run typecheck` — LIVE PASS.
- Scoped Biome check across all seven plan files — passed.
- `bun run check` — LIVE PASS with ten unrelated existing warnings.
- Isolated owned-root `bun src/cli.tsx doctor --json` — real SQLite 3.51.0, WAL, foreign keys, 2 contenders, 50 committed writes, concurrency PASS; executable status remained honestly `not-found` with exit 6.
- `bun run test` — FIXTURE FAIL from two unrelated config-command cases; 498 tests passed, including every Plan 02-03 case.

## Known Stubs

None. Empty test accumulators, optional nullable probe state, and default dependency objects are deliberate typed lifecycle state rather than unimplemented behavior.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: local-process-execution | `src/core/sqlite-capability.ts` | Runs a fixed Bun writer program with bounded lifetime and no shell/caller-selected command authority. |
| threat_flag: local-filesystem-lease | `src/catalog/catalog-owner.ts` | Creates and atomically renames owner evidence only beneath the owned, contained catalog root. |
| threat_flag: diagnostic-output | `src/cli/doctor.ts` | Exposes only version/status/count evidence and sanitized error identifiers. |

## Next Phase Readiness

- Catalog services can require `acquireCatalogOwner` whenever the capability evidence does not explicitly permit multi-owner mutation.
- The explicit Phase 2 SQLite blocker is resolved by executable runtime evidence rather than a version assumption.
- The unrelated default-config command tests remain deferred and do not affect this plan's catalog/doctor surface.

## Self-Check: PASSED

- All seven plan files exist and the three task commits resolve in repository history.
- Focused Vitest and Bun-native suites, related doctor tests, typecheck, scoped formatting, repository check, and isolated live doctor verification produced the evidence claimed above.
- No plan commit deleted a tracked file; unrelated operator work remains unstaged.

---
*Phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue*
*Completed: 2026-07-16*
