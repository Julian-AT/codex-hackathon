---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "01"
subsystem: cli
tags: [bun, typescript, vitest, command-catalog, deterministic-json]

requires: []
provides:
  - Side-effect-free `mlx` process entry with canonical root, parent, and leaf help
  - One typed owner-tagged catalog for all authoritative command paths and parse-only flags
  - Stable human and six-key JSON outcome renderers with honest later-phase unavailability
  - Immutable dirty-worktree baseline and closed ten-ID Phase 1 validation gate
affects: [phase-1-identity, state-init, doctor, migration-inventory, validation-baseline]

tech-stack:
  added: []
  patterns:
    - Entry to pure parser/orchestrator to isolated renderer dependency direction
    - Owner-phase dispatch guard before handler lookup
    - Compact ordered JSON envelope and control-safe width-aware human output

key-files:
  created:
    - migration/phase-1-change-scope.v1.json
    - test/support/phase-1-gate.ts
    - test/integration/cli-contract.test.ts
    - vitest.integration.config.ts
    - src/cli/command-tree.ts
    - src/cli/main.ts
    - src/cli/render-human.ts
    - src/cli/render-json.ts
  modified:
    - src/cli.tsx

key-decisions:
  - "Phase 2-8 leaves resolve to owner-tagged UNAVAILABLE before handler lookup; Phase 1 doctor and init retain explicit handler seams for their owning plans."
  - "The literal catalog preserves specification order, while aliases are optional metadata that fail closed on duplicates and structural-parent collisions."
  - "Human and JSON serialization remain separate plain-text modules; the entry performs one final write and never imports the legacy application graph."

patterns-established:
  - "Catalog authority: command paths, owners, help, arguments, options, aliases, and availability derive from COMMAND_TREE."
  - "Expected-result boundary: parse and unavailable outcomes are typed values; only internal catalog/handler invariant violations throw."
  - "Terminal safety: all human-facing dynamic text escapes C0/C1 controls and decisive values are wrapped rather than truncated."

requirements-completed:
  - IDEN-01
  - IDEN-05
  - IDEN-06

coverage:
  - id: D1
    description: "Bare MLX help uses the canonical product introduction once and never launches the legacy application."
    requirement: IDEN-01
    verification:
      - kind: integration
        ref: "test/integration/cli-contract.test.ts#prints canonical ordered help for a bare explicit-Bun invocation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every authoritative command and parse-only flag has one catalog entry, owner phase, deterministic parse, and honest unavailable shell."
    requirement: IDEN-05
    verification:
      - kind: unit
        ref: "src/cli/command-tree.test.ts#authoritative command catalog"
        status: pass
      - kind: integration
        ref: "test/integration/cli-contract.test.ts#returns deterministic owner-tagged UNAVAILABLE without running legacy work"
        status: pass
    human_judgment: false
  - id: D3
    description: "Human and JSON outcomes are deterministic, control-safe, width-aware, and serialized through one final process write."
    requirement: IDEN-06
    verification:
      - kind: unit
        ref: "src/cli/renderers.test.ts"
        status: pass
      - kind: unit
        ref: "src/cli/main.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/cli-contract.test.ts#emits one compact six-key JSON help envelope with one newline"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pre-edit 80-path dirty-worktree baseline and immutable ten-ID Phase 1 gate preserve operator ownership and pin fail-first behavior."
    verification:
      - kind: other
        ref: "bun test/support/phase-1-gate.ts expect-red cli-contract"
        status: pass
      - kind: other
        ref: "baseline JSON parse, count, and src/app.tsx ownership assertion"
        status: pass
    human_judgment: false

duration: 34 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 01: CLI Walking Skeleton Summary

**A deterministic, side-effect-free `mlx` command shell now exposes the complete owner-tagged CLI contract without importing or executing the legacy application.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-07-16T07:14:22Z
- **Completed:** 2026-07-16T07:49:18Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Captured all 80 pre-existing dirty paths before the first Phase 1 edit, preserving `src/app.tsx` as an explicit operator-owned deletion, and installed a closed ten-ID validation gate.
- Replaced the legacy public entry with one typed catalog, pure parser/orchestrator, complete root/parent/leaf help, and owner-tagged side-effect-free `UNAVAILABLE` outcomes.
- Added compact six-key JSON plus width-aware human renderers with stable bytes, terminal-control sanitization, and one final process write.
- Hardened the catalog and renderer boundaries with 58 unit checks and five isolated public-process checks spanning every command, flag, invariant, output mode, and width breakpoint.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Pin the public CLI happy path before replacing the entry** - `55c59ff` (test)
2. **Task 2: GREEN — Deliver the side-effect-free command-to-output slice** - `4813b93` (feat)
3. **Task 3: REFACTOR — Harden catalog completeness and terminal edge states** - `f92a6a7` (refactor)

**Plan metadata:** _(this commit)_

## Files Created/Modified

- `migration/phase-1-change-scope.v1.json` - Immutable pre-edit status, blobs, patch hashes, hunk fingerprints, modes, and operator ownership for 80 dirty paths.
- `test/support/phase-1-gate.ts` - Frozen ten-ID RED/acceptance registry with independent tokenized subprocess execution and fail-closed adjudication.
- `vitest.integration.config.ts` - Bounded Node integration-test configuration isolated to public process fixtures.
- `test/integration/cli-contract.test.ts` - Explicit-Bun process proof for help, JSON, parse failures, unavailability, and absence of side effects.
- `src/cli/command-tree.ts` - Single command/owner/argument/option/alias catalog, invariant validator, parser, and help projector.
- `src/cli/main.ts` - Injected CLI orchestration and exit-code boundary.
- `src/cli/render-json.ts` - Compact ordered six-key JSON serializer.
- `src/cli/render-human.ts` - Plain width-aware terminal renderer with C0/C1 escaping and no truncation.
- `src/cli.tsx` - Thin Bun entry with one `runCli` call, one write, and one `process.exitCode` assignment.
- `src/cli/command-tree.test.ts` - Table-driven coverage of all 26 leaves, parse-only flags, aliases, and fail-closed invariants.
- `src/cli/renderers.test.ts` - Determinism, Unicode/control, JSON-byte, and 80/40/39-column coverage.
- `src/cli/main.test.ts` - Renderer selection, unavailable short-circuit, typed handler, and invariant coverage.

## Decisions Made

- Phase 2-8 ownership metadata is sufficient to return `UNAVAILABLE` before any handler lookup; Phase 1 doctor/init remain explicit injected handler seams for Plans 03 and 04.
- Specification order remains display order. The only sorted projection uses a literal code-point comparator, never locale-dependent sorting.
- The public graph stays plain TypeScript: no React, Ink, configuration, model, server, REPL, app, or legacy command import is reachable from `src/cli.tsx`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/cli/command-tree.test.ts src/cli/renderers.test.ts src/cli/main.test.ts` — 58 tests passed.
- `bun x vitest run --config vitest.integration.config.ts test/integration/cli-contract.test.ts` — 5 tests passed.
- `bun run typecheck` — passed.
- Focused Biome check across all Plan 01 TypeScript paths — passed.
- Public entry import graph inspection — no Ink, React, model, server, configuration, REPL, app, or legacy command dependency.
- Baseline integrity assertion — 80 recorded dirty paths and `src/app.tsx` remains the operator-owned unstaged deletion.

## Self-Check: PASSED

- All task acceptance criteria and plan-level verification commands pass.
- RED evidence was a collected five-assertion public-contract failure; the same process suite is now green.
- Commits `55c59ff`, `4813b93`, and `f92a6a7` exist with the required RED/GREEN/REFACTOR prefixes.
- No unrelated working-tree path was staged or committed.

## Next Phase Readiness

- The stable CLI entry and catalog are ready for Plan 01-02 identity/package ownership work.
- No blockers remain; doctor and init behavior intentionally stay behind their Phase 1 handler seams until their owning plans.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
