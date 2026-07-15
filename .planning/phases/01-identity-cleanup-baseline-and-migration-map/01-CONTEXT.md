# Phase 1: Identity, cleanup, baseline, and migration map - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish one collision-safe MLX product surface, a deterministic and honestly labeled validation baseline, and a complete migration inventory with enforceable replacement coverage. Phase 1 exposes contract-complete shells for later commands but does not implement later-phase products or delete legacy production assets.

</domain>

<decisions>
## Implementation Decisions

### CLI Contract and Unavailable Commands
- Use a typed command tree with one leaf per documented command path so parsing, help, and JSON output are deterministic.
- Bare `mlx` prints the canonical product introduction plus ordered help and exits successfully; it does not launch the legacy REPL.
- Later-phase commands parse fully but return a structured `UNAVAILABLE` result naming their owning phase, exit nonzero, and perform no side effects until implemented.
- JSON mode uses one stable envelope with `schemaVersion`, `ok`, `command`, `status`, `data`, and `error`; collections are sorted and stdout contains JSON only.

### Doctor and Executable Collision Handling
- Recognize an MLX-owned executable through read-only realpath inspection plus an adjacent or package ownership marker; never execute a candidate or trust its filename alone.
- Inspect every `mlx` candidate in PATH order, classify the effective first candidate, and report shadowed candidates.
- `owned` exits zero; `collision` and `not-found` exit nonzero with stable machine-readable codes.
- Remediation is guidance only. MLX never overwrites, unlinks, renames, installs over, or modifies PATH, aliases, symlinks, shell configuration, or an unrelated executable automatically.

### MLX_HOME and Legacy State
- Unset or blank `MLX_HOME` resolves to `~/.mlx`; nonblank overrides must be absolute and are normalized without following unsafe symlinks.
- Create state directories lazily only for commands that intentionally mutate state; help and doctor remain read-only.
- An existing unowned `.mlx` root fails closed unless it has an MLX ownership manifest or the operator explicitly initializes or adopts it.
- Never automatically read, copy, or migrate `.codex` state. Move current operator-facing configuration to MLX paths and inventory remaining legacy writers for their owning phase.

### Migration Inventory and Validation Baseline
- Use versioned, schema-validated JSON as the canonical migration inventory and generate a deterministic Markdown review from it.
- Reconcile the inventory with a deterministic repository scanner covering exact locators, explicit path-specific exclusions, and evidenced zero-count mandatory categories.
- Default legacy assets to blocked `adapt` or `retain` dispositions. A `remove` disposition requires current exact replacement evidence, and Phase 1 deletes no legacy production assets.
- Each validation check reports one `PASS`, `FAIL`, or `SKIP` independently from its `LIVE`, `REPLAY`, or `FIXTURE` evidence source. Missing later-phase products fail explicitly, and aggregates never hide individual failures.

### the agent's Discretion
- Exact internal module boundaries, numeric exit-code assignments, ownership-marker encoding, inventory schema field representation, and deterministic report locations are at the agent's discretion within the Phase 1 specification and repository conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.tsx`, `src/commands/index.ts`, and the focused modules under `src/commands/` provide the current Bun/TypeScript command entry and registry patterns.
- `src/lib/config.ts` and its tests provide a typed Zod-based configuration boundary that can be redirected to MLX state paths.
- Existing Vitest suites, Biome configuration, and process helpers provide fixtures and deterministic validation patterns.
- The existing phase specification and codebase maps already identify brownfield command, discovery, data, training, adapter, and iOS assets that must feed the migration inventory.

### Established Patterns
- Use strict TypeScript, Zod at typed boundaries, discriminated unions for result states, and focused kebab-case modules with co-located tests.
- Expected validation failures return structured results; unrecoverable invariants throw typed or actionable errors.
- CLI modules route operator output through command contexts, while process entry points own stdout/stderr discipline.
- Biome formatting and Vitest are the portable baseline; fixture and capability classifications must remain explicit.

### Integration Points
- `package.json` owns the sole `mlx` binary declaration and the eight stable validation scripts.
- `src/cli.tsx` is the operator entry point; command-tree parsing and JSON/human presentation should remain separated from domain behavior.
- State-root resolution integrates through `src/lib/config.ts` and any current operator-facing paths, while other legacy writers remain inventoried for Phase 2.
- Migration inventory schemas, scanners, reports, and baseline check descriptors should be version-controlled and exercised through package scripts.

</code_context>

<specifics>
## Specific Ideas

Use the accepted recommendations from smart discuss without preserving legacy REPL launch behavior as the default product surface. Collision and state-root tests must use controlled synthetic fixtures and never inspect or mutate real unrelated operator state.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
