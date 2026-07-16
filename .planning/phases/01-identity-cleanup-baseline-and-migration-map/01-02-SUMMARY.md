---
phase: 01-identity-cleanup-baseline-and-migration-map
plan: "02"
subsystem: identity
tags: [bun, typescript, package-bin, identity-audit, privacy]

requires:
  - phase: 01-identity-cleanup-baseline-and-migration-map
    provides: Side-effect-free typed CLI entry and canonical root help from Plan 01
provides:
  - One installable user-facing executable named `mlx`
  - Versioned package/executable ownership marker that survives packing
  - Deterministic path-scoped identity audit with safe exact exclusions
  - Canonical MLX and Apple-distinction copy across retained user-facing surfaces
affects: [doctor, state-init, migration-inventory, validation-baseline]

tech-stack:
  added: []
  patterns:
    - Network-free local package packing and isolated bin installation fixture
    - Explicit source-list identity scanning with path containment and fail-closed exclusions
    - Stable category/path/rule ordering with evidenced zero mandatory categories

key-files:
  created:
    - mlx.package.json
    - fixtures/phase-1/identity/scoped-tree.json
    - src/identity/audit.ts
    - src/identity/audit.test.ts
    - test/integration/package-bin.test.ts
  modified:
    - package.json
    - README.md
    - src/repl.tsx
    - src/app-oneshot.tsx
    - src/lib/conversation.ts

key-decisions:
  - "The package uses the unambiguous npm identity `mlx-personal-coding-pipeline` while exporting only the shared executable name `mlx`."
  - "The ownership marker is read-only package evidence; it grants no authority to install over or mutate another executable."
  - "Identity audits consume exact declared paths rather than walking repositories or operator roots, and only sources explicitly marked internal may be excluded."

patterns-established:
  - "Package ownership: package name, sole bin, entry, and marker must agree byte-for-byte before doctor can classify ownership."
  - "Audit safety: reject traversal, wildcards, private roots, and user-facing exclusions before invoking the reader."
  - "Evidence completeness: required identity categories remain present with count zero instead of disappearing from reports."

requirements-completed:
  - IDEN-01
  - IDEN-02

coverage:
  - id: D1
    description: "A clean packed artifact exposes exactly one runnable mlx binary and its matching versioned ownership marker without install scripts or network access."
    requirement: IDEN-02
    verification:
      - kind: integration
        ref: "test/integration/package-bin.test.ts#packed mlx executable ownership"
        status: pass
    human_judgment: false
  - id: D2
    description: "The identity audit scans only exact safe paths, rejects broad or user-facing exclusions, reports stable path/rule findings, and preserves evidenced zero screenshot coverage."
    requirement: IDEN-01
    verification:
      - kind: unit
        ref: "src/identity/audit.test.ts#auditIdentity"
        status: pass
      - kind: other
        ref: "bun run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "README, package metadata, generated help, and retained copy distinguish this product from Apple's MLX without implying affiliation or endorsement."
    requirement: IDEN-01
    verification:
      - kind: unit
        ref: "src/identity/audit.test.ts#finds no identity drift in scoped retained source and fresh package/help output"
        status: pass
    human_judgment: true
    rationale: "Affiliation and endorsement implications remain a copy judgment even with deterministic phrase checks; fresh outputs were inspected and use an explicit non-affiliation statement."

duration: 12 min
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 02: Package Identity and Sole Executable Summary

**A locally packed MLX artifact now exports one marked `mlx` executable, while a deterministic identity audit prevents legacy branding drift without reading private or operator-controlled roots.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-16T07:53:00Z
- **Completed:** 2026-07-16T08:05:10Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Replaced the ambiguous package identity with `mlx-personal-coding-pipeline`, exported exactly one `mlx` bin through the checked-in Bun entry, and packaged a matching schema-versioned ownership marker.
- Added a network-disabled pack/install fixture that invokes canonical help and proves unrelated executable, symlink, aliases-as-data, PATH, and shell sentinels remain byte-identical across repeated and concurrent checks.
- Added a deterministic audit over exact declared sources and fresh artifacts, including stable findings, private-root denial, exact internal exclusions, and explicit zero-count screenshot evidence.
- Normalized retained unreachable UI copy and verified scoped README/help/package output has no forbidden legacy product branding.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Specify the sole-bin and identity-audit contract** - `1333272` (test)
2. **Task 2: GREEN — Publish one marked mlx package surface** - `6e3deea` (feat)
3. **Task 3: REFACTOR — Make identity drift mechanically detectable** - `b8ed8a4` (refactor)
4. **Rule 2 hardening: Prevent exclusion abuse** - `b30bc53` (fix)
5. **Fixture formatting and strict typing** - `4bccd06` (style)

**Plan metadata:** _(this commit)_

## Files Created/Modified

- `package.json` - Canonical package identity, description, file allowlist, and sole `bin.mlx` mapping; the pre-existing dependency hunk remains unstaged and operator-owned.
- `mlx.package.json` - Versioned package/executable ownership evidence for later read-only doctor classification.
- `README.md` - Exact canonical first mention followed immediately by the Apple-project distinction.
- `fixtures/phase-1/identity/scoped-tree.json` - Synthetic identity rules, exact internal exclusions, mandatory categories, and unrelated-state sentinels.
- `src/identity/audit.ts` - Deterministic safe-path reader boundary, rule evaluator, exclusion validator, and stable report projector.
- `src/identity/audit.test.ts` - Identity success/failure/order/privacy/exclusion tests plus fresh repository output audit.
- `test/integration/package-bin.test.ts` - Network-free local pack/install, marker/bin agreement, runnable help, and nonmutation proof.
- `src/repl.tsx` - Canonical identity in the retained unreachable REPL surface.
- `src/app-oneshot.tsx` - Canonical identity in the retained unreachable one-shot surface.
- `src/lib/conversation.ts` - Canonical identity and explicit brownfield status in the retained conversation prompt.

## Decisions Made

- Kept `private: true`, ESM, the current dependency versions, and the Plan 01 entry path. No install script, postinstall behavior, alias executable, global link, or dependency upgrade was added.
- Used the package name `mlx-personal-coding-pipeline` to distinguish package ownership from Apple's product while preserving the required sole executable name `mlx`.
- Made identity inputs explicit and caller-scoped. The audit never recursively walks the repository, ignored data, real homes, `.mlx`, `.codex`, mirrors, models, adapters, or raw traces.
- Restricted exclusions to exact rule/path pairs on sources explicitly designated as internal; exact user-facing paths and wildcard/directory exclusions fail closed.

## TDD Gate Compliance

- **RED:** `bun test/support/phase-1-gate.ts expect-red identity-package` accepted both suites as collected behavior failures. The identity suite reported missing audit behavior; the package suite reported the legacy package name, absent sole bin, and absent marker.
- **GREEN:** Commit `6e3deea` followed the RED commit and made the isolated package suite pass.
- **REFACTOR:** Commit `b8ed8a4` added the deterministic audit and retained-surface normalization; the complete identity, package, CLI, and typecheck gates remained green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Prevented exact exclusions from hiding user-facing product text**
- **Found during:** Task 3 (identity audit hardening)
- **Issue:** Exact path/rule validation alone could allow a configured exclusion for a user-facing path such as `README.md`.
- **Fix:** Sources must now opt into exclusion eligibility as internal evidence; user-facing exact paths and broad patterns fail closed.
- **Files modified:** `fixtures/phase-1/identity/scoped-tree.json`, `src/identity/audit.ts`, `src/identity/audit.test.ts`
- **Verification:** Unit coverage proves both `README.md` and `generated/**` exclusion attempts return `invalid-exclusion` findings.
- **Committed in:** `b30bc53`

---

**Total deviations:** 1 auto-fixed (1 missing critical).
**Impact on plan:** The fix closes a security/correctness gap in the planned audit boundary without expanding product scope.

## Issues Encountered

- The installed Bun version rejects simultaneous `bun pm pack --destination` and `--filename`. The RED fixture was corrected to use an absolute `--filename`, then rerun until the fail-first gate accepted only intended behavior failures.

## Judgment Review

Fresh README, root help, parent/leaf help, package description, ownership marker, and scoped retained strings were inspected. The first product mentions use the canonical phrase; README and package metadata explicitly say the product is distinct from Apple's MLX project and is not affiliated with or endorsed by Apple. No copy claims executable takeover, affiliation, or endorsement. Doctor collision remediation remains owned by its later Phase 1 plan and was not invented here.

## Known Stubs

None. Retained REPL/one-shot/conversation modules remain deliberately unreachable brownfield code, not a public MLX implementation or acceptance substitute.

## User Setup Required

None - no external service configuration required.

## Verification

- `bun x vitest run src/identity/audit.test.ts` — 5 tests passed.
- `bun x vitest run --config vitest.integration.config.ts test/integration/package-bin.test.ts test/integration/cli-contract.test.ts` — 8 tests passed.
- `bun run typecheck` — passed.
- Focused Biome check across all Plan 02 TypeScript paths — passed.
- Package/marker JSON assertions — sole `mlx` bin, marker agreement, private package, and marker inclusion passed.
- Scoped forbidden-brand scan — zero `Forgeprint`, `forgeprint`, or `codex` product-brand matches.
- Plan range deletion scan — zero production deletions; the operator-owned `src/app.tsx` deletion remains unstaged and untouched.

## Self-Check: PASSED

- All five key created files exist and coverage metadata validates without schema errors.
- Commits `1333272`, `6e3deea`, `b8ed8a4`, `b30bc53`, and `4bccd06` exist in the required RED → GREEN → REFACTOR order.
- All task acceptance criteria and plan-level automated verification commands pass.
- Root, parent, and leaf help plus scoped source/package copy contain zero forbidden legacy product-brand matches.
- No plan commit deletes a production path or stages the operator-owned `src/app.tsx` deletion.

## Next Phase Readiness

- The sole-bin marker and package entry are ready for Plan 01-03 state-root work and Plan 01-04 read-only doctor ownership classification.
- No Plan 02 blocker remains. The unrelated pre-existing `package.json` dependency hunk and all other dirty-tree changes remain outside these commits.

---
*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Completed: 2026-07-16*
