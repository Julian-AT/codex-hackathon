---
phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
plan: "04"
subsystem: storage
tags: [sha256, cas, sqlite, atomic-writes, fsync, provenance]
requires:
  - phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
    provides: contained runtime destinations and checksum-verified numbered catalog migrations
provides:
  - Immutable SHA-256 object storage with verified reads and concurrent equal-write convergence
  - Durable typed source, patch, trace, report, and generated artifact references
  - Catalog migration 0002 with digest, size, kind, timestamp, and foreign-key integrity
affects: [evidence-lake, datasets, traces, reports, runs, retention]
tech-stack:
  added: []
  patterns: [exclusive same-filesystem temp publication, digest-derived CAS paths, verify-before-reference transactions]
key-files:
  created:
    - migrations/0002-blobs.sql
    - src/storage/atomic-file.ts
    - src/storage/object-store.ts
    - src/catalog/blob-references.ts
    - test/integration/object-store.test.ts
  modified:
    - src/catalog/migration-runner.ts
    - src/catalog/connection.ts
    - package.json
key-decisions:
  - "Publish immutable objects with a same-directory hard link so an existing digest path is never overwritten, then verify the final bytes before success."
  - "Keep arbitrary SQL out of the public catalog connection; the typed blob-reference module owns the fixed statements and transaction boundary."
  - "Insert a catalog reference only after digest and size verification, with equivalent duplicates idempotent and semantic conflicts rejected."
patterns-established:
  - "CAS write pattern: restrictive exclusive temp, file fsync, no-overwrite link publication, directory fsync, verified final read, owned-temp cleanup."
  - "Reference pattern: validate typed metadata, verify immutable bytes, upsert digest metadata, and insert the typed reference in one immediate transaction."
requirements-completed: [FNDN-06]
coverage:
  - id: D1
    description: "All required artifact kinds round-trip through immutable digest-derived paths, with corruption, substitution, truncation, and symlinks rejected."
    requirement: FNDN-06
    verification:
      - kind: unit
        ref: "src/storage/atomic-file.test.ts and src/storage/object-store.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/object-store.test.ts#round-trip and corruption cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Concurrent equal writes converge and durable typed references cannot precede verified committed object bytes."
    requirement: FNDN-06
    verification:
      - kind: integration
        ref: "test/integration/object-store.test.ts#concurrent writers and interrupted reference ordering"
        status: pass
      - kind: unit
        ref: "src/catalog/blob-references.test.ts"
        status: pass
    human_judgment: false
duration: 7 min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 04: Immutable Object Store and Blob References Summary

**Crash-safe SHA-256 content-addressed bytes with verified reads, concurrent convergence, and transactional typed catalog provenance**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T10:38:59Z
- **Completed:** 2026-07-16T10:45:27Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added an immutable object store at `objects/sha256/<prefix>/<digest>` that uses restrictive same-filesystem temp files, file and directory fsync, atomic no-overwrite publication, and SHA-256 verification on every trusted open.
- Proved required artifact-kind round trips, interrupted-write cleanup, six-process equal-write convergence, and fail-closed handling for malformed digests, corruption, truncation, symlinks, directories, and conflicting final bytes.
- Added migration 0002 and a typed durable reference API for source, patch, trace, report, and generated artifacts with schema validation, timestamps, foreign keys, idempotent equivalents, and semantic conflict rejection.

## Task Commits

1. **Task 1: RED — Specify object round-trip, convergence, and corruption** — `610dfb3` (test)
2. **Task 2: GREEN — Implement atomic immutable SHA-256 storage** — `6bf7e7f` (feat)
3. **Task 3: REFACTOR — Add typed durable blob references** — `e3583fa` (refactor)
4. **Package the storage implementation** — `0cf5d6e` (fix)
5. **Stabilize concurrent WAL activation** — `b8e8a51` (fix)

## Files Created/Modified

- `migrations/0002-blobs.sql` — Strict digest metadata and typed blob-reference tables with size, kind, timestamp, and foreign-key checks.
- `src/storage/atomic-file.ts` — Same-directory exclusive temp write, fsync, no-overwrite hard-link publication, and owned cleanup.
- `src/storage/atomic-file.test.ts` — Publication, convergence, interruption cleanup, name, and symlink coverage.
- `src/storage/object-store.ts` — Digest-derived immutable put, verified open, and size/digest verification boundary.
- `src/storage/object-store.test.ts` — Round-trip, idempotence, malformed digest, corruption, and symlink coverage.
- `src/catalog/blob-references.ts` — Typed fixed-SQL reference API with verify-before-transaction ordering.
- `src/catalog/blob-references.test.ts` — Idempotence, conflict, invalid metadata, missing-byte, and no-dangling-reference coverage.
- `test/integration/object-store.test.ts` — All artifact kinds, interruption, multi-process convergence, corruption, substitution, and reference-ordering acceptance.
- `src/catalog/migration-runner.ts` — Ordered application manifest entry for migration 0002.
- `src/catalog/connection.ts` — Bounded WAL activation retry for concurrent first openers.
- `src/catalog/connection.test.ts` — Schema version 2 expectation.
- `src/catalog/migration-runner.test.ts` — Two-migration ledger, gap, and future-version regression coverage.
- `test/integration/catalog-migrations.test.ts` — Schema version 2 concurrent and tampering regression coverage.
- `package.json` — Includes `src/storage/**/*.ts` in the distributable package without staging the operator dependency hunk.

## Decisions Made

- Hard-link publication was selected over rename because it is atomic on the same filesystem and fails with `EEXIST` instead of replacing a previously published immutable object.
- Every existing path component is inspected with `lstat`; symlinks and non-directory components are rejected, and final objects must be regular files before their bytes are trusted.
- Blob references accept only the five required kinds and fixed SQL owned by the service. The public catalog connection remains opaque and does not expose caller-selected query authority.
- Object verification occurs before the immediate catalog transaction; the transaction then records canonical digest metadata and the reference together, preventing a reference insert from preceding durable verified bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Advanced prior migration tests for migration 0002**
- **Found during:** Task 3 regression verification
- **Issue:** Existing catalog tests hard-coded schema version 1 and used migration number 2 to simulate gaps and future schemas, which became invalid after adding the planned second migration.
- **Fix:** Updated expected schema versions and manifest rows, represented a gap by deleting migration 1, and represented a future schema with migration 3.
- **Files modified:** `src/catalog/connection.test.ts`, `src/catalog/migration-runner.test.ts`, `test/integration/catalog-migrations.test.ts`
- **Verification:** The 17-test combined catalog/object integration suite passed under Bun.
- **Committed in:** `e3583fa`

**2. [Rule 2 - Missing Critical] Included storage modules in package output**
- **Found during:** Final package verification
- **Issue:** The existing package allowlist included catalog and core modules but omitted the new production storage implementation.
- **Fix:** Added only `src/storage/**/*.ts` to the package files list while leaving the pre-existing operator dependency change unstaged.
- **Files modified:** `package.json`
- **Verification:** `bun pm pack --dry-run` listed both storage modules and migration 0002; no archive remained afterward.
- **Committed in:** `0cf5d6e`

**3. [Rule 1 - Concurrency] Retried WAL activation when simultaneous first openers report SQLITE_BUSY**
- **Found during:** Final integration verification
- **Issue:** Concurrent catalog openers could race at `PRAGMA journal_mode = WAL` before the migration lock, intermittently returning `SQLITE_BUSY` despite the configured busy timeout.
- **Fix:** Added a fixed, bounded retry around the application-owned WAL pragma without exposing caller-selected SQL or unbounded waiting.
- **Files modified:** `src/catalog/connection.ts`
- **Verification:** The complete catalog migration integration suite passed five consecutive direct Bun runs, followed by the final Vitest and Bun suites.
- **Committed in:** `b8e8a51`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical packaging path).
**Impact on plan:** All changes were required to preserve migration compatibility, package the production feature, and uphold the planned concurrent-open guarantee; no product scope or dependency was added.

## Issues Encountered

- The plan's literal Vitest command uses the unit configuration and therefore collects the catalog unit test but not `test/integration/object-store.test.ts`. The integration file passed through `vitest.integration.config.ts` and directly under Bun.
- `bun run check` passed with ten existing warnings in unrelated legacy discovery tests.

## User Setup Required

None - no external service configuration required.

## Verification

- Focused unit Vitest suite — 7 tests passed.
- Integration Vitest suite — 9 tests passed, including catalog regression coverage.
- Direct Bun combined suite — 22 tests passed with 97 assertions.
- Catalog migration integration suite repeated five times — 25/25 executions passed, including four-process first-open contention on each run.
- `bun run typecheck` — LIVE PASS.
- `bun run check` — LIVE PASS with ten unrelated existing warnings.
- Scoped Biome checks across all plan-owned TypeScript files — passed.
- `bun pm pack --dry-run` — included migration 0002 and all storage/catalog modules; no generated archive remained.
- Repository inspection found no generated object or SHA-256 directory outside temporary test roots.

## Known Stubs

None. Test-only interruption hooks and Bun-runtime delegation are explicit verification seams, not production placeholders.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: untrusted-artifact-bytes | `src/storage/object-store.ts` | Hashes input, derives the only destination path, and re-hashes final bytes before trust. |
| threat_flag: local-filesystem-publication | `src/storage/atomic-file.ts` | Uses exclusive restrictive temps, no-overwrite same-directory links, fsync, and owned cleanup. |
| threat_flag: durable-provenance | `src/catalog/blob-references.ts` | Validates typed metadata and verifies committed bytes before fixed transactional SQL. |

## Next Phase Readiness

- Run, job, evidence, dataset, trace, and report services can now retain immutable bytes through a typed digest reference instead of storing mutable paths.
- The catalog is at schema version 2 with fresh, prior, repeated, tampered, and concurrent-open regression coverage green.

## Self-Check: PASSED

- All plan artifacts exist, all five Plan 02-04 commits resolve in history, and no task commit deleted a tracked file.
- Unit, integration, direct Bun, typecheck, repository check, scoped quality, package-content, concurrency-repeat, and filesystem-location checks produced the evidence claimed above.
- All unrelated operator changes remain unstaged and untouched by Plan 02-04 commits.

---
*Phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue*
*Completed: 2026-07-16*
