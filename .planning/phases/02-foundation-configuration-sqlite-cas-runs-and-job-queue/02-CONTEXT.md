# Phase 2: Foundation: configuration, SQLite, CAS, runs, and job queue - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** Auto-generated (pure infrastructure phase)

<domain>
## Phase Boundary

Establish the contained, durable foundation used by every later MLX workflow: validated configuration rooted beneath `MLX_HOME`, a migrated SQLite catalog, immutable content-addressed artifacts, checksummed run lineage, deterministic stage reuse, and recoverable leased jobs with safe retention.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
- All implementation choices are at the agent's discretion because this is a pure infrastructure phase.
- Preserve the existing thin `mlx` CLI and typed, co-located module/test conventions.
- Treat the authoritative project specification and dataset contract as hard boundaries, especially privacy, containment, idempotency, and provenance requirements.
- Preserve unrelated and pre-existing worktree changes; build incrementally around the Phase 1 identity and state-ownership foundation.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/mlx-home.ts` already resolves the default `~/.mlx` root and rejects relative overrides.
- `src/core/state-ownership.ts` already implements an explicit ownership marker and fail-closed adoption behavior.
- `src/lib/config.ts` already provides Zod-backed configuration diagnostics and confines configuration to `MLX_HOME/config/config.json`.
- `src/cli/doctor.ts`, `src/core/doctor.ts`, and the validation modules provide existing CLI and capability-reporting integration points.
- Existing subprocess helpers and `AbortSignal` patterns can inform durable job cancellation and child cleanup.

### Established Patterns
- Use focused kebab-case TypeScript modules with co-located Vitest tests and typed schemas at boundaries.
- Keep CLI entry points thin and render structured domain results separately from execution logic.
- Prefer deterministic filesystem, hashing, validation, and lifecycle logic over model inference.
- Generated or private runtime data must remain outside the repository under the owned MLX state root.

### Integration Points
- Extend the state-root initialization and doctor flow for catalog ownership and SQLite capability checks.
- Add explicit foundation modules rather than expanding command registries or entry files into monoliths.
- Expose stable CLI commands through the current command tree while preserving the only user-facing executable name `mlx`.
- Wire later phases to stable catalog, object-store, run-manifest, and job-queue APIs rather than direct ad hoc files.

</code_context>

<specifics>
## Specific Ideas

No additional product choices are needed for this infrastructure phase. Follow the roadmap success criteria and authoritative MLX specifications.

</specifics>

<deferred>
## Deferred Ideas

None — implementation remains inside the Phase 2 foundation boundary.

</deferred>
