---
phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
plan: "05"
subsystem: orchestration
tags: [sqlite, sha256, canonical-json, lineage, idempotency, cas]
requires:
  - phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue
    provides: checksum-verified migrations and immutable content-addressed object storage
provides:
  - Strict versioned canonical run manifests committed atomically through CAS and SQLite
  - Immutable parent-child lineage with append-only lifecycle and invalidation events
  - Domain-separated deterministic stage claims with fail-closed verified reuse
affects: [jobs, evidence-lake, datasets, benchmarks, training, studio-replay]
tech-stack:
  added: []
  patterns: [code-point canonical JSON, CAS-before-catalog publication, unique producer claims, verify-before-reuse]
key-files:
  created:
    - migrations/0003-runs.sql
    - src/runs/run-manifest.ts
    - src/runs/run-manifest.test.ts
    - src/runs/stage-reuse.ts
    - src/runs/stage-reuse.test.ts
    - test/integration/run-reuse.test.ts
  modified:
    - src/catalog/migration-runner.ts
    - src/catalog/migration-runner.test.ts
    - src/catalog/connection.test.ts
    - test/integration/catalog-migrations.test.ts
    - package.json
key-decisions:
  - "Exclude run IDs and timestamps from the domain-separated stage fingerprint while retaining both in immutable manifest lineage."
  - "Treat terminal run rows as immutable; record reuse invalidation and all later observations only as append-only events."
  - "Return pending for a live unique producer claim, but recover from terminal, corrupt, missing-object, or validation-invalid evidence."
patterns-established:
  - "Manifest commit pattern: validate strict schema, verify outputs and lineage, publish canonical bytes to CAS, then atomically commit digest and terminal event."
  - "Reuse pattern: hash only validated deterministic identity, elect one producer by unique claim, and trust output only after manifest, CAS, checksum, schema, and validation verification."
requirements-completed: [FNDN-07, FNDN-08]
coverage:
  - id: D1
    description: "Terminal runs retain byte-stable checksummed CAS manifests containing deterministic inputs, configuration, implementation, parent lineage, outputs, and validations."
    requirement: FNDN-07
    verification:
      - kind: unit
        ref: "src/runs/run-manifest.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/run-reuse.test.ts#canonical child lineage and crash publication boundaries"
        status: pass
    human_judgment: false
  - id: D2
    description: "Equal deterministic stages execute once and reuse only completed schema-valid checksum-valid output evidence; invalid or incomplete candidates execute again."
    requirement: FNDN-08
    verification:
      - kind: unit
        ref: "src/runs/stage-reuse.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/run-reuse.test.ts#equal identity, changed identity, and invalid evidence matrix"
        status: pass
    human_judgment: false
duration: 8 min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 05: Run Lineage and Deterministic Stage Reuse Summary

**Canonical SHA-256 run lineage with immutable CAS manifests, append-only terminal evidence, and producer claims that reuse only fully verified deterministic outputs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T10:47:04Z
- **Completed:** 2026-07-16T10:55:19Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added migration 0003 with strict immutable run rows, append-only events, parent lineage, manifest blob integrity, and unique deterministic stage claims.
- Added strict schema-version-1 run manifests serialized by Unicode code-point key order, verified through CAS, and atomically committed only after every output and parent digest passes validation.
- Added domain-separated deterministic stage fingerprints and producer election that returns pending for active work, reuses only fully verified committed evidence, and recovers from failed, cancelled, corrupt, missing-object, checksum-mismatched, or validation-invalid candidates.

## Task Commits

1. **Task 1: RED — Specify run lineage and deterministic reuse** — `b560d38` (test)
2. **Task 2: GREEN — Commit canonical immutable run manifests** — `fa714d1` (feat)
3. **Task 3: REFACTOR — Claim and reuse verified deterministic stages** — `d35771c` (refactor)

## Files Created/Modified

- `migrations/0003-runs.sql` — Strict run, event, and stage-claim schema with terminal and append-only triggers.
- `src/runs/run-manifest.ts` — Canonical serializer, strict manifest schema, CAS commit, lineage validation, lifecycle events, and verifier.
- `src/runs/run-manifest.test.ts` — Canonical Unicode ordering, immutability, schema rejection, output verification, and crash-boundary tests.
- `src/runs/stage-reuse.ts` — Domain-separated fingerprinting, unique claim election, full evidence verification, invalidation, and recovery execution.
- `src/runs/stage-reuse.test.ts` — Fingerprint, producer, pending, corruption, and recovery coverage.
- `test/integration/run-reuse.test.ts` — Parent-child lineage, side-effect counting, identity changes, status matrix, missing/corrupt objects, and pre/post-publication interruption acceptance.
- `src/catalog/migration-runner.ts` — Ordered application manifest entry for migration 0003.
- `src/catalog/migration-runner.test.ts` — Schema version 3 ledger and future-version regression coverage.
- `src/catalog/connection.test.ts` — Schema version 3 connection expectation.
- `test/integration/catalog-migrations.test.ts` — Schema version 3 open, concurrency, drift, gap, and future regression coverage.
- `package.json` — Includes production run modules in package output without staging the unrelated operator dependency hunk.

## Decisions Made

- Deterministic stage identity contains only schema version, stage type, ordered validated input hashes, configuration hash, and implementation version. Run IDs and timestamps remain observable lineage but cannot cause or prevent reuse.
- A committed run row is never edited again. Reuse invalidation is an append-only event, so corruption discoveries remain auditable without weakening terminal evidence.
- A unique claim owned by a running producer returns `pending`; unclaimed incomplete runs do not suppress work, and terminal invalid claims are released only after their failure is recorded.
- Manifest publication is CAS-first and catalog-second. An interruption can leave an unreferenced immutable object, but can never expose a committed catalog row whose manifest bytes were not durably published.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Migration Regression] Advanced prior migration acceptance for schema version 3**
- **Found during:** Task 2 and final integration verification
- **Issue:** Existing catalog tests treated version 2 as current and migration 3 as a synthetic future row, which became stale after the planned migration.
- **Fix:** Advanced current expectations to version 3 and future evidence to migration 4.
- **Files modified:** `src/catalog/migration-runner.test.ts`, `src/catalog/connection.test.ts`, `test/integration/catalog-migrations.test.ts`
- **Verification:** Four focused catalog/run unit files passed 14 tests, and the combined catalog/object/run integration suite passed 12 tests.
- **Committed in:** `fa714d1`, `d35771c`

**2. [Rule 2 - Missing Critical] Included run modules in package output**
- **Found during:** Task 3 packaging verification
- **Issue:** The package allowlist had no production `src/runs/**/*.ts` entry, so the new APIs would be absent from an installed package.
- **Fix:** Added the run-module glob with partial staging that preserved the unrelated dependency edit.
- **Files modified:** `package.json`
- **Verification:** `bun pm pack --dry-run` listed migration 0003 and both production run modules and left no archive behind.
- **Committed in:** `d35771c`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 regression, 1 Rule 2 missing critical package path).
**Impact on plan:** Both changes were necessary to preserve migration compatibility and ship the planned production modules; no dependency or product scope was added.

## Issues Encountered

- The plan's literal Vitest commands use the unit configuration, whose include pattern omits `test/integration/**/*.test.ts`. The unit portion passed literally, while the run-reuse integration file was executed with `vitest.integration.config.ts` and directly under Bun.
- `bun run test:integration` remains red on a pre-existing packed-doctor failure: `src/core/sqlite-capability.ts` imports `src/lib/config.ts`, but the earlier package allowlist omits that file. This is recorded in `deferred-items.md`; all Plan 02-05 and related catalog/object integration tests pass.
- `bun run test` remains red on the two pre-existing `src/commands/commands.test.ts` default-`~/.mlx` cases already recorded by Plan 02-03.

## User Setup Required

None - no external service configuration required.

## Verification

- RED gate — integration suite failed on missing `src/runs/run-manifest`, proving the new behavior was absent before implementation.
- Focused Vitest run-manifest and stage-reuse suites — 8 tests passed.
- Direct Bun run-manifest, stage-reuse, and run-reuse suites — 11 tests passed with 51 assertions.
- Run-reuse integration suite repeated three consecutive times — 9/9 executions passed and the equal-input side-effect count remained one per isolated harness.
- Combined catalog/object/run integration suite — 12 tests passed.
- Combined catalog/run unit regression suite — 14 tests passed.
- `bun run typecheck` — LIVE PASS.
- `bun run check` — LIVE PASS with ten unrelated existing warnings.
- Scoped Biome check across all Plan 02-05 TypeScript files — passed after formatting.
- `bun pm pack --dry-run` — migration 0003 and both production run modules included; no generated archive remained.

## Known Stubs

None. Empty test accumulators, nullable pre-commit manifest fields, and test-only crash hooks are deliberate lifecycle and verification seams rather than unimplemented behavior.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: deterministic-cache-identity | `src/runs/stage-reuse.ts` | Validates and domain-separates stage/config/input/implementation/schema identity before unique claim election. |
| threat_flag: immutable-local-artifact | `src/runs/run-manifest.ts` | Publishes canonical manifest bytes through verified CAS before fixed transactional catalog statements. |
| threat_flag: durable-lineage-schema | `migrations/0003-runs.sql` | Adds immutable parent-linked runs, append-only events, blob foreign keys, and unique producer claims. |

## Next Phase Readiness

- Job workers can use stage keys and run manifests as their durable idempotency and lineage boundary.
- Evidence, dataset, benchmark, training, and replay workflows can reference immutable manifest digests instead of mutable run directories.
- The unrelated packed-doctor allowlist gap remains deferred and does not affect run lineage or deterministic reuse behavior.

## Self-Check: PASSED

- All eleven plan-created or modified implementation files exist, all three task commits resolve in repository history, and no task commit deleted a tracked file.
- Unit, integration, direct Bun, repeated side-effect, typecheck, repository check, formatting, package-content, migration-regression, and crash-boundary evidence support the claims above.
- Unrelated operator changes remain unstaged; only the `src/runs/**/*.ts` package hunk was included.

---
*Phase: 02-foundation-configuration-sqlite-cas-runs-and-job-queue*
*Completed: 2026-07-16*
