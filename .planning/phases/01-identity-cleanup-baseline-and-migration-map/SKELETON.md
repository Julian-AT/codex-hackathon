# Walking Skeleton — MLX

**Phase:** 1
**Generated:** 2026-07-15

## Capability Proven End-to-End

An operator can invoke the locally packaged `mlx` executable, receive deterministic human or JSON command results, initialize only an explicitly owned MLX state root, diagnose executable-name collisions read-only, inspect the complete legacy replacement map, and run an honestly labeled validation baseline.

This is the full-stack equivalent for a local terminal product: terminal interaction → typed command/parser contract → domain port → owned filesystem read/write or read-only host inspection → deterministic human/JSON response. Phase 1 does not pull forward a browser, network API, or SQLite catalog that the authoritative roadmap assigns to later phases.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime/framework | Bun + strict TypeScript ESM | Required by the project contract and already installed; no new runtime dependency is needed. |
| User interface | Plain deterministic terminal text with separate human and JSON renderers | Phase 1 is a CLI. Static output does not need Ink, and JSON must remain isolated from renderer side effects. |
| Command/API boundary | One typed command tree and pure `runCli(args, io, deps)` orchestration boundary | Parsing, help, ownership, arguments, availability, and JSON behavior stay synchronized and integration-testable. |
| Phase 1 data layer | Versioned Zod-validated JSON for package/state ownership and migration inventory | Phase 1 needs one real owned write plus deterministic migration records; SQLite, CAS, manifests, and durable jobs remain Phase 2. |
| State root | `~/.mlx` or an absolute `MLX_HOME`; only explicit `mlx init` may create it | Prevents read-only commands from mutating state and blocks implicit adoption of unrelated `.mlx`/`.codex` data. |
| Executable ownership | Declared `package.json.bin.mlx` realpath plus packaged ownership marker | Shared `mlx` filename or executable bit alone cannot safely establish ownership. |
| Authentication | None in Phase 1 | No GitHub, Hugging Face, model, or remote service is contacted; auth status remains an unavailable Phase 3 shell. |
| Persistence after Phase 1 | SQLite catalog with numbered migrations, WAL, and foreign keys in Phase 2 | The project specification fixes this target; the JSON ownership/inventory contracts do not replace the catalog. |
| Deployment target | Local packed package / checked-in Bun entry, exercised in an isolated prefix | The product is local-first; a network deployment would add no Phase 1 acceptance value and would violate the phase boundary. |
| Directory layout | Focused `src/cli`, `src/core`, `src/identity`, `src/migration`, and `src/validation` modules; later product subsystems use the specified `apps/` and `packages/` layout | Keeps the brownfield entry small without prematurely moving unrelated legacy code or creating giant index modules. |
| Validation execution | Pure result/catalog semantics → injected fake-tested runner → production Bun process/capability adapters and executable entry → external package-script acceptance | Proves the stable scripts reach real allowlisted tools or a genuine named host probe, while fixed direct Vitest argv and in-suite stubs prevent `test:integration` recursion. |
| Dirty-worktree preservation | Pre-edit path/status/patch/hash/hunk baseline captured before the first Phase 1 edit | Final review can distinguish Phase 1-owned hunks from operator state, including the existing `D src/app.tsx`, without restoring or staging unrelated work. |

## Stack Touched in Phase 1

- [ ] Project/package scaffold — canonical package identity, exactly one `mlx` bin, build/lint/type/test scripts, and isolated integration configuration.
- [ ] Routing — one real root/parent/leaf typed command tree with implemented `init` and `doctor` plus owner-tagged later-phase shells.
- [ ] Data read/write — a real owned state-marker write/read and a real schema-validated migration-inventory read/generate/check cycle.
- [ ] UI interaction — operator argv produces width-safe human output or one deterministic JSON object and stable exit status.
- [ ] Local deployment — isolated pack/install invocation and documented `bun src/cli.tsx` local run path exercise the complete CLI stack.
- [ ] Validation host boundary — `src/validation/process-entry.ts` wires the real shell-free Bun runner and named Apple-Silicon probe; package scripts select catalog IDs only, and external integration starts Vitest directly from fixed argv.

## Out of Scope (Deferred to Later Slices)

- SQLite catalog, migrations, CAS, immutable run manifests, leases/jobs, recovery, retention, and full filesystem containment — Phase 2.
- GitHub authentication, repository inventory/selection, mirrors, identities, and metrics — Phase 3.
- Evidence extraction, accepted-state quality, semantic workers, and preference profiles — Phase 4.
- Hugging Face/Parquet dataset compiler, deduplication, leakage-safe splits, derived exports, and Hub publication — Phase 5.
- Fixed model tools, disposable worktrees, PersonalBench, model adapters, and executable repository evaluation — Phase 6.
- Real E2B/E4B MLX-LM training, checkpoints, inference, experiment lineage, and paired target-machine evaluation — Phase 7.
- Browser Studio, loopback API, presentation/replay mode, privacy UI, and complete end-to-end acceptance — Phase 8.
- Destructive deletion of the retained brownfield pipeline, generated-tool path, training/evaluation scripts, or iOS runtime — only an owning phase may reconsider removal after the Phase 1 evidence gate passes.

## Subsequent Slice Plan

Each later phase adds one vertical operator capability on this skeleton without renegotiating the identity, state-root, command, ownership, result-label, privacy, or replacement-evidence contracts:

- Phase 2: Operators can initialize and recover contained durable local operations.
- Phase 3: Operators can explicitly select repositories and inspect reproducible engineering facts.
- Phase 4: Operators can build provenance-complete evidence and challengeable preference profiles.
- Phase 5: Operators can build and validate immutable Hugging Face-native dataset releases.
- Phase 6: Operators can execute isolated PersonalBench tasks and compare model variants.
- Phase 7: Operators can run and resume real target-machine MLX-LM experiments with paired evaluation.
- Phase 8: Operators can inspect and present all validated artifacts privately and close end-to-end acceptance.

## Non-Negotiable Skeleton Invariants

- The public entry never defaults to the legacy REPL/pipeline and never loads later-phase handlers for an unavailable shell.
- Human and JSON modes share structured outcomes but have separate renderers; JSON stdout is exactly one object.
- Read-only commands do not create MLX_HOME; no command automatically reads or migrates `.codex`.
- Doctor never executes or mutates an `mlx` candidate and trusts neither filename nor PATH order as ownership by itself.
- Validation status and evidence source remain independent, and later-product absence remains FAIL.
- No private repository, credential, model, adapter, raw trace, dataset, or operator state is needed for Phase 1 tests.
- Canonical migration JSON is the removal-coverage authority; its Markdown review is a generated projection, and Phase 1 performs no production cleanup.
- The pre-edit dirty-worktree baseline is immutable evidence; only the last plan appends complete Plan 01-09 path/hunk ownership, preserves the recorded operator-owned `D src/app.tsx` deletion verbatim, and proves zero Phase 1-owned production deletion.
- Validation unit tests use injected fake process/capability ports; production package scripts use the real adapter/probe entry, while the integration descriptor is stubbed in-suite and reaches direct fixed Vitest argv only once from the external acceptance harness.
