---
phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
plan: "02"
subsystem: database
tags: [bun, sqlite, migrations, wal, checksums, containment]
requires:
  - phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
    provides: owned MLX_HOME resolution and component-wise contained runtime paths
provides:
  - Owned-root-only Bun SQLite connection boundary with verified WAL, foreign keys, and busy timeout
  - Persisted ordered migration manifest with exact SQL-byte checksums and immediate transactions
  - Fresh, prior-schema, repeated, failure, tampering, and concurrent-open acceptance coverage
affects: [catalog-owner, object-store, runs, jobs, retention]
tech-stack:
  added: []
  patterns: [application-owned migration manifest, locked ledger recheck, Bun-runtime test delegation]
key-files:
  created:
    - migrations/0001-catalog.sql
    - src/catalog/connection.ts
    - src/catalog/connection.test.ts
    - src/catalog/migration-runner.ts
    - src/catalog/migration-runner.test.ts
    - test/integration/catalog-migrations.test.ts
  modified:
    - package.json
key-decisions:
  - "Load migration SQL only from a fixed application manifest and checksum the exact packaged bytes."
  - "Re-read and verify the ledger after BEGIN IMMEDIATE acquires the writer lock so concurrent first opens converge."
  - "Expose only close, pragma/schema inspection, and callback transaction APIs; do not expose a caller-selected SQL boundary."
patterns-established:
  - "Catalog open pattern: prove root ownership and containment, configure and verify pragmas, run migrations, then return an opaque handle."
  - "Migration pattern: preflight the ledger, recheck under the immediate writer lock, apply one exact file, and record its number/name/checksum atomically."
requirements-completed: [FNDN-03, FNDN-04]
coverage:
  - id: D1
    description: "Fresh and supported prior catalogs upgrade transactionally with WAL and foreign keys proven before use."
    requirement: FNDN-03
    verification:
      - kind: integration
        ref: "test/integration/catalog-migrations.test.ts#fresh, prior, repeated, and concurrent opens"
        status: pass
      - kind: unit
        ref: "src/catalog/connection.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Checksum drift, ledger gaps, future schemas, and interrupted statements fail without committing partial schema state."
    requirement: FNDN-04
    verification:
      - kind: unit
        ref: "src/catalog/migration-runner.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/catalog-migrations.test.ts#rollback and tampering cases"
        status: pass
    human_judgment: false
duration: 10 min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 02: Durable SQLite Catalog Summary

**Contained Bun SQLite catalogs with checksum-verified numbered migrations, durable pragmas, transactional rollback, and concurrent-open convergence**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-16T10:18:00Z
- **Completed:** 2026-07-16T10:28:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added an opaque catalog handle that opens only below an owned, non-symlinked MLX state root and proves `busy_timeout=5000`, `foreign_keys=ON`, and `journal_mode=WAL` before use.
- Added a packaged base SQL migration plus an ordered application-owned runner that hashes exact bytes and rejects drift, gaps, invalid ledgers, and unsupported future versions.
- Proved fresh, repeated, supported-prior, interrupted, tampered, and four-process concurrent opens while preserving prior rows and rolling back partial schema work.

## Task Commits

1. **Task 1: RED — Specify fresh, repeat, and prior-schema upgrades** — `008e08c` (test)
2. **Task 2: GREEN — Implement the contained SQLite connection** — `acbfc2f` (feat)
3. **Task 3: REFACTOR — Persist and verify numbered migrations** — `f51eab7` (refactor)
4. **Bun-native Vitest bridge** — `1528dc8` (test)
5. **Scoped import normalization** — `6482744` (style)
6. **Concurrent migration serialization** — `0513c9f` (fix)

## Files Created/Modified

- `migrations/0001-catalog.sql` — Strict migration ledger and stable catalog metadata base table.
- `src/catalog/connection.ts` — Owned, contained SQLite open boundary and opaque connection API.
- `src/catalog/connection.test.ts` — Ownership, path, pragma, and public-surface tests.
- `src/catalog/migration-runner.ts` — Fixed manifest loading, checksumming, ledger verification, and immediate migration transactions.
- `src/catalog/migration-runner.test.ts` — Idempotence, rollback, drift, gap, and future-version unit coverage.
- `test/integration/catalog-migrations.test.ts` — Fresh/prior/reopen/concurrency/failure/tampering acceptance suite.
- `package.json` — Packages catalog TypeScript and persisted SQL migrations while preserving the operator dependency hunk unstaged.

## Decisions Made

- The runtime migration authority is a fixed in-code manifest of packaged URLs; callers cannot provide migration names, paths, SQL, or checksums.
- Catalog connections expose no database or query object. Future typed services compose their own operations behind the callback transaction seam.
- Each pending migration rechecks the full ledger only after acquiring `BEGIN IMMEDIATE`, closing the time-of-check/time-of-use race between concurrent first openers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Delegated SQLite tests from Node-hosted Vitest into Bun**
- **Found during:** Task 2 verification
- **Issue:** `bun x vitest` launches Vitest under Node, where the required built-in `bun:sqlite` module does not exist.
- **Fix:** Test files detect the host runtime; Node-hosted Vitest synchronously delegates the same file to `bun test` and fails if that native run fails. Direct Bun runs still execute every assertion normally.
- **Files modified:** `src/catalog/connection.test.ts`, `src/catalog/migration-runner.test.ts`, `test/integration/catalog-migrations.test.ts`
- **Verification:** Both Vitest entry paths and direct `bun test` passed the same 11-test catalog suite.
- **Committed in:** `1528dc8`

**2. [Rule 1 - Concurrency] Closed the fresh-open migration race**
- **Found during:** Final threat-model review for T-02-05
- **Issue:** Two openers could both preflight an empty ledger before one waited on the immediate writer lock, causing the second to replay already-applied SQL.
- **Fix:** Re-read and verify the ledger inside every immediate transaction and return idempotently when the waited-on migration is already recorded.
- **Files modified:** `src/catalog/migration-runner.ts`, `test/integration/catalog-migrations.test.ts`
- **Verification:** Four independent Bun processes concurrently opened one fresh owned catalog and converged on schema version 1.
- **Committed in:** `0513c9f`

---

**Total deviations:** 2 auto-fixed (1 blocking test-runtime issue, 1 concurrency bug).
**Impact on plan:** Both fixes enforce the planned Bun runtime and concurrent-open safety boundary without adding product scope or dependencies.

## Issues Encountered

- `bun run check` remains `LIVE FAIL` on the unrelated pre-existing repository Biome baseline (`lib/discovery/validate/parse.test.ts` and other operator files). Scoped Biome checks over every Plan 02-02 TypeScript/JSON file pass with no diagnostics.
- The plan's literal Vitest command uses the unit include configuration and therefore collects the unit migration-runner file only. The integration file passed separately with `vitest.integration.config.ts` and directly under Bun.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/catalog/connection.test.ts src/catalog/migration-runner.test.ts` — 6 tests passed through verified Bun-native delegation.
- `bun x vitest run --config vitest.integration.config.ts test/integration/catalog-migrations.test.ts` — 5 tests passed through verified Bun-native delegation.
- `bun test src/catalog/connection.test.ts src/catalog/migration-runner.test.ts test/integration/catalog-migrations.test.ts` — 11 direct Bun tests passed.
- `bun run typecheck` — LIVE PASS.
- Scoped `bunx biome check` across all Plan 02-02 TypeScript and package files — passed.
- `bun pm pack --dry-run` — confirmed `migrations/0001-catalog.sql` and `src/catalog/**` are packaged; the generated local archive was removed immediately.
- `bun run check` — LIVE FAIL only on unrelated pre-existing operator files.

## Next Phase Readiness

- Plan 02-03 can probe the embedded SQLite runtime and place the catalog-owner gate in front of this stable open boundary.
- Later object, run, and job services can build typed APIs over the opaque connection/transaction seam and add migrations to the fixed ordered manifest.

## Self-Check: PASSED

- All seven plan-owned files exist, and all six implementation/follow-up commits resolve in repository history.
- Fresh, repeated, prior-schema, failure, tampering, and concurrent-open checks pass under Bun; typecheck and scoped quality checks are green.
- The existing operator dependency change in `package.json` remains unstaged and was not included in any Plan 02-02 commit.

---
*Phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue*
*Completed: 2026-07-16*
