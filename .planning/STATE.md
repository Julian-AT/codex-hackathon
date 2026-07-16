---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 2
current_phase_name: "Foundation: configuration, SQLite, CAS, runs, and job queue"
status: executing
stopped_at: Completed 02-05-PLAN.md
last_updated: "2026-07-16T10:56:20.016Z"
last_activity: 2026-07-16
last_activity_desc: Completed Phase 2 Plan 05 run lineage and deterministic reuse
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 18
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-16)

**Core value:** Produce a privacy-preserving, provenance-rich personal coding dataset whose quality, splits, and benchmark results are reproducible and defensible.
**Current focus:** Phase 2 — Foundation: configuration, SQLite, CAS, runs, and job queue

## Current Position

Phase: 2 — Foundation: configuration, SQLite, CAS, runs, and job queue
Plan: 5 of 9 complete
Status: Ready to execute
Last activity: 2026-07-16 — Completed run lineage and deterministic reuse

Progress: [████████░░] 78%

## Performance Metrics

**Velocity:**

- Total plans completed: 10
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 9 | - | - |
| 2 | 1 | 7 min | 7 min |

**Recent Trend:**

- Last 5 plans: -
- Trend: No execution data

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 34 min | 3 tasks | 12 files |
| Phase 01 P02 | 12 min | 3 tasks | 10 files |
| Phase 01 P03 | 12 min | 3 tasks | 12 files |
| Phase 01 P04 | 12 min | 3 tasks | 8 files |
| Phase 01 P05 | 8 min | 3 tasks | 10 files |
| Phase 01 P06 | 8 min | 3 tasks | 6 files |
| Phase 01 P07 | 5 min | 3 tasks | 6 files |
| Phase 01 P08 | 5 min | 3 tasks | 6 files |
| Phase 01 P09 | 8 min | 3 tasks | 8 files |
| Phase 02 P01 | 7 min | 3 tasks | 7 files |
| Phase 02 P03 | 7 min | 3 tasks | 7 files |
| Phase 02 P05 | 8 min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Preserve all eight acceptance boundaries mandated by the project specification.
- [Roadmap]: Treat the dataset and evidence lake as the critical path; training remains a downstream consumer.
- [Roadmap]: Track the July 16 event success floor separately from phase and project completion.
- [Phase 01]: Phase 2-8 leaves resolve to owner-tagged UNAVAILABLE before handler lookup; Phase 1 doctor and init retain explicit handler seams for their owning plans. — This makes later-phase shells honest and side-effect-free while leaving Phase 1 behavior injectable.
- [Phase 01]: The literal catalog preserves specification order, while aliases fail closed on duplicates and structural-parent collisions. — One catalog prevents parse/help drift and ambiguous command identity.
- [Phase 01]: Human and JSON serialization remain separate plain-text modules, and the entry performs one final write without the legacy graph. — The boundary preserves deterministic JSON and prevents legacy side effects.
- [Phase 01]: Use mlx-personal-coding-pipeline as the package identity while exporting only mlx. — Distinguishes package ownership from Apple's project without adding a fallback executable.
- [Phase 01]: Treat mlx.package.json as read-only ownership evidence with no mutation authority. — The shared executable name cannot authorize PATH or unrelated executable changes.
- [Phase 01]: Allow identity exclusions only for exact paths explicitly marked internal. — Prevents broad or user-facing exclusions from hiding product identity drift.
- [Phase 01]: Use a distinct .mlx-state-owner.json manifest with exclusive creation; package ownership evidence never authorizes state mutation. — Separates executable identity from local state ownership and fails closed under races.
- [Phase 01]: Keep legacy configuration function names temporarily callable while redirecting their only write target to MLX_HOME/config/config.json. — Preserves retained brownfield callers without preserving project-local legacy state precedence.
- [Phase 01]: Treat every exact mlx entry not proven owned as fail-closed collision evidence. — Preserves safe evidence for broken, cyclic, non-executable, and interrupted candidates.
- [Phase 01]: Require entry realpath plus exact packaged marker agreement for OWNED. — Neither a shared filename, executable mode, location, nor marker alone establishes package ownership.
- [Phase 01]: Canonical reconciliation uses an embedded controlled tracked/source snapshot and never walks ignored or operator roots. — This makes completeness repeatable while preserving private-state boundaries.
- [Phase 01]: Removal authority is recomputed from exact current reviewed evidence and never trusted from the declared status. — Stale, disallowed, incomplete, or pending evidence must fail closed.
- [Phase 01]: Validation SKIP requires a named unavailable capability probe. — Fixture, replay, mock, missing product, and unprobed evidence cannot authorize SKIP.
- [Phase 01]: The eight validation identities live in one immutable declarative catalog. — Later runners can consume only fixed argv or typed product, capability, and external-only gates.
- [Phase 01]: Accept only exact canonical catalog descriptors before process execution. — Prevents structurally compatible caller data from introducing arbitrary executable or argument values.
- [Phase 01]: Late-load human validation reporting only outside JSON mode. — Keeps JSON output isolated to one deterministic document with no renderer initialization side effects.
- [Phase 01]: Revalidate each production process request against the exact immutable catalog executable and argument vector before Bun spawn. — Keeps the host boundary deny-by-default without adding a generic command-string API.
- [Phase 01]: Reserve direct integration Vitest execution for explicit external test:integration mode. — Ordinary run mode and in-suite baselines cannot recurse through a package script.
- [Phase 01]: Derive named Apple Silicon evidence only from platform and architecture captured at probe construction. — Missing or unknown probe behavior fails instead of authorizing SKIP.
- [Phase 01]: Map every stable validation script directly to one canonical process-entry mode and check ID. — Prevents aliases, recursion, and caller-selected executable or argument tokens.
- [Phase 01]: Use a committed synthetic adapter-tools fixture through a test-only filesystem seam. — Makes schema validation deterministic without reading or rewriting mutable repository data.
- [Phase 01]: Preserve immutable operator evidence and record overlapping Phase hunks explicitly in the final manifest. — Keeps the operator-owned src/app.tsx deletion and unrelated dirty bytes outside Phase ownership.
- [Phase 01]: Disable formatting only for the exact operator-owned dirty test that blocked portable check. — Preserves operator bytes while retaining lint analysis and honest visible warnings.
- [Phase 02]: Keep configured destinations relative and expose resolved absolute destinations only through an immutable runtime-path projection. — Portable serialized configuration cannot weaken the canonical MLX_HOME containment boundary.
- [Phase 02]: Grant multi-owner catalog mutation only from a passing executable WAL concurrency probe; version strings never authorize it.
- [Phase 02]: Quarantine the whole owner directory atomically before compare/release or stale recovery so renewal races fail closed.
- [Phase 02]: Exclude run IDs and timestamps from domain-separated stage fingerprints while retaining both in immutable manifest lineage.
- [Phase 02]: Keep terminal run rows immutable and record reuse invalidation only through append-only events.
- [Phase 02]: Return pending for live unique producer claims and recover only after terminal invalid evidence is recorded.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 7]: Apple Silicon acceptance requires real M4 Pro evidence and cannot be closed by portable mocks or skips.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-16T10:56:12.202Z
Stopped at: Completed 02-05-PLAN.md
Resume file: None
