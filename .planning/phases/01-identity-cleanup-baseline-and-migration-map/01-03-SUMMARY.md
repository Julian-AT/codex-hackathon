---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "03"
subsystem: state
tags: [bun, typescript, mlx-home, state-ownership, cli, zod]
requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: side-effect-free command tree, typed CLI results, and public process entry
provides:
  - Pure absolute MLX_HOME resolution with a default ~/.mlx root
  - Versioned fail-closed ownership inspection and explicit state-root adoption
  - Public mlx init and mlx init --adopt behavior through the canonical command parser
  - Operator configuration confined to MLX_HOME/config
affects: [phase-02-foundation, doctor, configuration, local-state]
tech-stack:
  added: []
  patterns: [pure injected path resolution, non-following final-path inspection, exclusive ownership marker writes]
key-files:
  created:
    - src/core/mlx-home.ts
    - src/core/state-ownership.ts
    - src/cli/init.ts
    - src/core/mlx-home.test.ts
    - src/core/state-ownership.test.ts
    - test/integration/state-cli.test.ts
  modified:
    - src/cli/command-tree.ts
    - src/cli/command-tree.test.ts
    - src/cli/main.ts
    - src/cli/render-human.ts
    - src/lib/config.ts
    - src/lib/config.test.ts
key-decisions:
  - "Use a distinct .mlx-state-owner.json manifest with exclusive creation; package ownership evidence never authorizes state mutation."
  - "Keep the legacy setProjectConfig export temporarily callable while redirecting its only write target to MLX_HOME/config/config.json."
patterns-established:
  - "State mutation pattern: resolve purely, inspect with lstat, fail closed, then make one exclusive marker write."
  - "Operator-path pattern: configuration derives from the canonical MLX root and never falls back to project-local legacy state."
requirements-completed: [IDEN-03]
coverage:
  - id: D1
    description: "mlx init safely initializes, adopts, and reopens an owned state root while all other Phase 1 shells remain read-only."
    requirement: IDEN-03
    verification:
      - kind: unit
        ref: "src/core/mlx-home.test.ts and src/core/state-ownership.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/state-cli.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Operator configuration reads and writes only MLX_HOME/config/config.json and reports invalid roots or config content actionably."
    requirement: IDEN-03
    verification:
      - kind: unit
        ref: "src/lib/config.test.ts"
        status: pass
    human_judgment: false
duration: 12 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 03: Canonical State Root and Owned Initialization Summary

**Pure MLX_HOME resolution, an exclusive versioned ownership marker, explicit `mlx init --adopt`, and operator configuration confined to the canonical MLX state root**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T08:03:00Z
- **Completed:** 2026-07-16T08:15:08Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added deterministic default/override MLX_HOME resolution without realpath, directory creation, or tilde expansion.
- Made `mlx init` the sole Phase 1 state-creating shell, with idempotent ownership and explicit byte-preserving adoption.
- Removed public legacy configuration precedence and confined current operator configuration to `MLX_HOME/config/config.json`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Define root, ownership, and no-creation matrices** — `af8b074` (test)
2. **Task 2: GREEN — Implement owned initialization through the public CLI** — `48c0ae3` (feat)
3. **Task 3: REFACTOR — Redirect operator configuration while preserving legacy evidence** — `63d6dbd` (refactor)
4. **Repository formatting normalization** — `686761a` (style)

## Files Created/Modified

- `src/core/mlx-home.ts` — Pure injected resolver for default and absolute override roots.
- `src/core/state-ownership.ts` — Versioned ownership inspection, exclusive initialization, and explicit adoption.
- `src/cli/init.ts` — Typed adapter from root resolution to state initialization.
- `src/cli/command-tree.ts` — Sole declaration and parser validation for `init --adopt`.
- `src/cli/main.ts` — Public init dispatch and deterministic success/error envelopes.
- `src/cli/render-human.ts` — Exact root, reason, changed-state, and safe-action output for init.
- `src/lib/config.ts` — Actionable canonical MLX configuration boundary.
- `test/integration/state-cli.test.ts` — Process coverage for default, override, adoption, idempotence, and no-creation behavior.

## Decisions Made

- The state marker is `.mlx-state-owner.json`, distinct from `mlx.package.json`, so executable/package evidence cannot grant state ownership.
- Marker creation uses exclusive writes. A concurrent winner is accepted only if a fresh non-following inspection validates the exact MLX ownership schema.
- The existing `getProjectConfigPath` and `setProjectConfig` exports remain temporarily compatible for retained brownfield callers, but both now target the sole canonical MLX configuration file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Rendered actionable state outcomes at the human boundary**
- **Found during:** Task 2 (public CLI wiring)
- **Issue:** The planned file list omitted `src/cli/render-human.ts`, but leaving the generic success renderer unchanged would hide the resolved root and whether any file changed, violating the locked UI/error contract.
- **Fix:** Added deterministic init-specific human rendering with quoted root, ownership status, changed-state, reason, and one safe action.
- **Files modified:** `src/cli/render-human.ts`
- **Verification:** State process integration and renderer/unit suites passed; JSON remains a single independent envelope.
- **Committed in:** `48c0ae3`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality).
**Impact on plan:** The additional focused renderer change was required by the plan's own UI contract and introduced no new state or later-phase subsystem.

## Issues Encountered

- The RED gate rejects import/setup failures. Missing production modules were therefore loaded dynamically inside collected tests so the initial failures were behavior assertions rather than test-infrastructure failures.
- The current configuration seam was untracked before execution. Its existing schema and env behavior were retained while the plan-owned path and error boundaries were changed; no unrelated dirty path was staged.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/core/mlx-home.test.ts src/core/state-ownership.test.ts src/lib/config.test.ts` — 28 tests passed.
- `bun x vitest run --config vitest.integration.config.ts test/integration/state-cli.test.ts test/integration/cli-contract.test.ts` — 11 tests passed.
- `bun run typecheck` — passed.
- Scoped Biome check across all changed source/test files — passed.
- Deletion inspection from the RED base through final code commits — zero deleted paths.

## Known Stubs

None. Empty objects found by the stub scan are typed accumulator/default values, not UI or behavior placeholders. The existing owner-tagged `UNAVAILABLE` shell text belongs to the contract-complete command tree and is not part of this plan's init implementation.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: local-filesystem-write | `src/core/state-ownership.ts` | `mlx init` introduces the first intentional state write, bounded to an exclusively created ownership marker after non-following root/marker inspection. |

## Next Phase Readiness

- The canonical local-root and ownership seams are ready for collision diagnosis and the Phase 2 storage foundation.
- Full ancestor containment, durable atomic/fsync manifests, SQLite, CAS, and migration of remaining writers remain explicitly deferred to their owning plans/phases.

## Self-Check: PASSED

- All six created files exist.
- All four task/refactor commits resolve in repository history.
- The recorded unit, integration, typecheck, formatting, and deletion checks passed on the final tree.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
