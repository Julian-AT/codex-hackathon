# Phase 1: Identity, cleanup, baseline, and migration map — Specification

**Created:** 2026-07-15
**Ambiguity score:** 0.17 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

MLX — the personal coding dataset and model pipeline exposes one collision-safe `mlx` command contract, resolves Phase 1-owned state through `MLX_HOME`, provides an honest eight-command validation baseline, and records every brownfield asset's migration owner before any destructive cleanup.

## Background

The repository is a brownfield Offline Specialist-LLM Pipeline. At specification time, `package.json` has no `bin` entry and is named `codex-hackathon`; `src/cli.tsx`, the REPL, and one-shot UI still present `codex` product text; help exposes eight legacy pipeline commands through `bun src/cli.tsx`; and `command -v mlx` finds no executable. Operator configuration resolves through `~/.codex` and a project `.codex` directory, while legacy corpus, manifest, training, evaluation, adapter, and device paths still target the application checkout.

The existing planning migration inventory covers 55 archived planning artifacts and explicitly states that repository commands, paths, generated data, scripts, product strings, dynamic-tool code, and iOS components remain uninventoried. Validation is also incomplete: `bun run typecheck` passes, `bun run test` has one mutable-manifest-dependent failure, `bun run check` scans `.next` and fails, and `test:integration`, `studio:build`, `dataset:validate`, `benchmark:smoke`, and `local:check` do not exist.

Phase 1 establishes the safe public contract and the verified migration map. It does not make the later repository, dataset, benchmark, training, or Studio commands functional, and it does not perform destructive legacy cleanup.

## Requirements

1. **Canonical product identity (`IDEN-01`)**: Every operator-facing source, package description, help surface, built artifact, screenshot, and generated artifact identifies the product on first mention as “MLX — the personal coding dataset and model pipeline” and contains no legacy `Forgeprint`, `forgeprint`, or `codex` product branding.
   - Current: Package metadata and multiple CLI/REPL surfaces use legacy identity, while no built-artifact identity audit exists.
   - Target: The canonical phrase is used exactly on first mention; scoped source and built/generated artifact scans find no forbidden user-facing product branding, with justified exclusions for historical/internal material that is not user-facing.
   - Acceptance: AC-01 and AC-02 pass.

2. **Sole collision-safe executable (`IDEN-02`)**: The only intended user-facing executable exported by this product is `mlx`, and acquiring or invoking that name never changes an unrelated executable or shell environment automatically.
   - Current: The product is invoked with `bun src/cli.tsx`; `package.json` exports no binary; no ownership or collision behavior exists.
   - Target: Package metadata exports exactly one product binary named `mlx`; repeated, interrupted, and concurrent collision scenarios fail closed without modifying the existing command, PATH, aliases, links, or shell configuration.
   - Acceptance: AC-03 and AC-04 pass.

3. **Canonical local state root (`IDEN-03`)**: Phase 1-owned configuration and CLI state resolve beneath an absolute `MLX_HOME` override or the default `~/.mlx` root.
   - Current: User and project settings use `.codex`, and several legacy artifact writers target repository-local `data/` paths.
   - Target: One canonical resolver handles Phase 1-owned paths; unset or blank `MLX_HOME` selects `~/.mlx`; relative overrides fail actionably; valid absolute paths, including paths with spaces or Unicode, are preserved. Remaining legacy writers are inventoried for Phase 2 rather than silently treated as compliant.
   - Acceptance: AC-05 and AC-06 pass.

4. **Non-mutating collision diagnosis (`IDEN-04`)**: `mlx doctor` deterministically distinguishes this product's executable, an unrelated `mlx`, and no resolvable `mlx` without executing or mutating a detected candidate.
   - Current: No `doctor` command or executable ownership marker exists.
   - Target: Human and JSON results expose the classification, resolved path where safe, actionable guidance, and a success/failure exit status; repeated and concurrent checks are read-only and equivalent for unchanged inputs.
   - Acceptance: AC-07 and AC-08 pass.

5. **Contract-complete command hierarchy (`IDEN-05`)**: Every command path in the authoritative CLI contract parses, appears in deterministic help, and has a unique owner even when its implementation belongs to a later phase.
   - Current: Help exposes only the legacy `pipeline`, `discover`, `data-gen`, `train`, `eval`, `fuse`, `deploy`, and `serve` commands.
   - Target: The hierarchy includes `doctor`, `init`, `auth status`, `repos scan`, `repos review`, `repos set`, `mirror`, `metrics build`, `metrics show`, `evidence build`, `preferences build`, `dataset build`, `dataset validate`, `dataset inspect`, `dataset push`, `benchmark build`, `benchmark run`, `benchmark compare`, `train preflight`, `train run`, `model serve`, `agent run`, `studio`, `demo`, `pipeline`, and `gc`. Later-phase leaves return a structured unavailable result and perform no legacy or production side effect.
   - Acceptance: AC-09, AC-10, and AC-11 pass.

6. **Deterministic machine-readable output (`IDEN-06`)**: Every Phase 1 command and later-phase command shell supports deterministic `--json` output while human-readable output remains the default.
   - Current: CLI output is human-only and mixes direct console output with Ink rendering.
   - Target: JSON mode emits exactly one valid UTF-8 object for success, failure, help, collision, and unavailable states; it contains no human preamble or unstable ordering and is equivalent for identical controlled inputs and state.
   - Acceptance: AC-12 passes.

7. **Complete migration inventory (`IDEN-07`)**: A version-controlled, machine-validatable inventory contains one record for every legacy command, executable name, runtime path, generated dataset or artifact, script, user-facing product string, dynamic-tool path, iOS component, and planning artifact.
   - Current: `.planning/migrations/2026-07-15-legacy-planning-inventory.md` inventories only archived planning records and declares the repository inventory incomplete.
   - Target: Each exact asset locator has one stable record with category, legacy purpose, disposition (`retain`, `adapt`, `fixture-only`, `archive`, or `remove`), replacement owner, mapped requirement coverage, replacement evidence, and removal status. All mandatory categories appear, including evidenced zero counts, and records are deterministically ordered.
   - Acceptance: AC-13, AC-14, and AC-15 pass.

8. **Replacement-coverage removal gate (`IDEN-08`)**: No legacy asset may be classified as removable until its exact record has a reviewed replacement owner, acceptance mapping, and valid replacement evidence.
   - Current: The planning inventory documents a removal rule, but no repository-wide inventory validator enforces it.
   - Target: Inventory validation fails closed for missing, duplicate, stale, or incomplete removal records; a plan, placeholder, mock, fixture, replay, or category-level phase mapping alone is not replacement evidence. Phase 1 performs no destructive source cleanup.
   - Acceptance: AC-16, AC-17, and AC-18 pass.

9. **Stable validation commands (`IDEN-09`)**: Automation can invoke all eight required repository validation commands through stable package scripts with honest exit behavior.
   - Current: Only `check`, `typecheck`, and unit `test` scripts exist; check and unit test are red for known baseline defects; five required scripts are missing.
   - Target: `bun run check`, `bun run typecheck`, `bun run test`, `bun run test:integration`, `bun run studio:build`, `bun run dataset:validate`, `bun run benchmark:smoke`, and `bun run local:check` are distinct and runnable. Current portable code-health checks pass; absent later-phase products fail explicitly; only a genuinely unavailable host capability may be skipped.
   - Acceptance: AC-19, AC-20, AC-21, and AC-24 pass.

10. **Honest result classification (`IDEN-10`)**: Every validation check emits exactly one deterministic `PASS`, `FAIL`, or capability-gated `SKIP` status and an honest evidence-source classification.
    - Current: There is no shared validation result schema or baseline report, and fixture/mock tests can be confused with live product acceptance.
    - Target: Missing implementations, missing results, no-op placeholders, and unclassifiable outcomes are `FAIL`; `SKIP` requires an identified unavailable capability and reason; `LIVE`, `REPLAY`, and `FIXTURE` remain separate from check status; fixture, replay, or mock success never satisfies a live-required gate.
    - Acceptance: AC-22 and AC-23 pass.

## Boundaries

**In scope:**

- Canonical MLX identity across operator-facing source, package metadata, help, built output, screenshots, and generated artifacts, plus a reproducible identity audit.
- One exported `mlx` binary and collision fixtures that represent owned, unrelated, and absent executable states without changing the operator's real PATH or binaries.
- The Phase 1 `MLX_HOME` resolver and migration of current operator-facing configuration/CLI state paths from `.codex` to the MLX root.
- Functional Phase 1 identity/path/doctor behavior and a contract-complete parse/help/JSON shell for later-phase commands.
- A comprehensive repository migration inventory and validator covering all legacy categories and enforcing replacement evidence before a `remove` disposition can become eligible.
- The eight stable validation script names, repair of current portable baseline failures, explicit later-phase failure results, capability-gated local checks, and deterministic baseline reporting.
- Synthetic tests and fixtures for identity, collisions, state-root behavior, command contracts, inventory completeness, and result classification.

**Out of scope:**

- Functional repository ingestion, metrics, evidence, preference, dataset, benchmark, training, model-agent, or Studio workflows — these belong to Phases 3–8; Phase 1 exposes only their command contracts.
- SQLite catalogs, content-addressed storage, immutable runs, leased jobs, and full path containment for every legacy writer — Phase 2 owns those foundations.
- Moving every legacy corpus, generated-data, training, adapter, and device writer beneath `MLX_HOME` — Phase 1 inventories the remaining migrations; Phase 2 provides the durable storage boundary.
- Destructive deletion of legacy CLI, discovery, generated-tool, data, evaluation, training, deployment, or iOS source — removal requires the inventory and replacement evidence produced here and occurs only in its owning phase.
- Enumerating or cloning private repositories, building a real dataset, executing PersonalBench, or running MLX-LM training to establish the Phase 1 baseline — these would cross later acceptance boundaries and privacy rules.
- Renaming the Git remote or repository remote name — development remotes may retain their current name.
- Treating the iOS runtime as a required v1 product path — it is inventoried and mapped to optional `SCAL-06` or later replacement owners.

## Constraints

- Operator CLI and Phase 1 runtime code use Bun and TypeScript.
- The user-facing product has exactly one intended executable, `mlx`; no fallback product binary or automatic collision takeover is allowed.
- The canonical local root is `~/.mlx`, overridden only by a valid absolute `MLX_HOME` value.
- Private repositories, real credentials, models, adapters, generated datasets, and operator state are not accessed or produced by Phase 1 validation.
- JSON output must be one UTF-8 document with stable schema and ordering for identical controlled state.
- Historical planning material, internal implementation references, and the Git remote may retain legacy words only when they are not user-facing product branding and the identity audit records the exclusion.
- Capability `SKIP` is limited to a genuine environmental absence; missing code, missing scripts, no-op placeholders, and later-phase nonimplementation are failures.
- Existing unrelated working-tree changes must be preserved; the migration inventory cannot infer removal authority from repository dirtiness.

## Acceptance Criteria

- [ ] **AC-01 — Identity audit:** A scoped audit of user-facing source plus freshly built/generated test artifacts finds the exact canonical first mention where required and zero forbidden legacy product-brand occurrences; every exclusion is path-specific and justified.
- [ ] **AC-02 — Apple distinction:** Judgment review confirms product text, help, and package metadata do not claim or imply identity with, affiliation with, or endorsement by Apple's MLX project.
- [ ] **AC-03 — Binary contract:** Package inspection and a clean install fixture expose exactly one product binary named `mlx`; no legacy or fallback user-facing binary is exported.
- [ ] **AC-04 — Collision safety:** Owned, unrelated, absent, repeated, interrupted, and concurrent executable fixtures produce the documented outcome while hashes and metadata for the unrelated executable, PATH fixture, aliases, links, and shell configuration remain unchanged.
- [ ] **AC-05 — State-root matrix:** Tests prove unset and blank `MLX_HOME` resolve to `~/.mlx`, absolute overrides resolve beneath the supplied root, relative overrides fail actionably, and absolute roots containing spaces or Unicode round-trip correctly.
- [ ] **AC-06 — Unrelated-state isolation:** Sentinel `.codex`, Apple MLX, and pre-existing unrelated `.mlx` fixtures remain unread, uncopied, unmodified, and undeleted unless a test explicitly models operator-approved migration.
- [ ] **AC-07 — Doctor classification:** Controlled PATH fixtures make `mlx doctor` report `owned`, `collision`, and `not-found` states in human and JSON formats with documented exit status and actionable guidance.
- [ ] **AC-08 — Doctor is read-only:** A candidate executable that records execution is never launched; repeated and parallel doctor runs return equivalent classifications and leave all candidate and shell-state sentinels unchanged.
- [ ] **AC-09 — Complete command parse:** Every authoritative CLI path listed in R5 parses and appears in root or parent help; unknown paths fail with a deterministic diagnostic and nonzero exit.
- [ ] **AC-10 — Empty and ordering behavior:** Bare `mlx` prints deterministically ordered help and exits zero; bare `mlx --json` emits a structured help object; no command path or alias resolves to more than one leaf.
- [ ] **AC-11 — Honest later-phase shells:** Each unimplemented later-phase leaf exits with the documented nonzero unavailable result, identifies its owning phase, and produces no model process, network action, repository mutation, or artifact write.
- [ ] **AC-12 — JSON contract:** For controlled success, failure, help, collision, and unavailable cases, `--json` emits exactly one parseable UTF-8 object on stdout with stable keys and sorted collections, no human preamble, and byte-equivalent output for identical nonvolatile state.
- [ ] **AC-13 — Inventory coverage:** A repository inventory scan reconciles every mandatory category to exactly one record per exact locator; duplicate locators, omitted discovered assets, and unacknowledged empty categories fail validation.
- [ ] **AC-14 — Inventory determinism:** Rebuilding the inventory from the same Git snapshot produces the same machine-readable records in path-sorted order and an equivalent human-readable summary.
- [ ] **AC-15 — Inventory schema:** Every record validates with stable ID, exact locator, category, legacy purpose, disposition, replacement owner, requirement coverage, replacement evidence, removal status, and provenance; conditional fields cannot be silently omitted.
- [ ] **AC-16 — Removal gate:** Inventory validation rejects every `remove` candidate lacking exact reviewed ownership, mapped acceptance coverage, and current replacement evidence; plans, category-only mappings, mocks, fixtures, replays, and unavailable features do not satisfy the evidence field.
- [ ] **AC-17 — Repeatable review:** Revalidating an unchanged inventory preserves record identity, disposition, evidence result, and eligibility; stale or changed evidence returns the asset to a blocked state.
- [ ] **AC-18 — No destructive cleanup:** The Phase 1 change manifest contains no deletion of legacy production source or runtime assets; any archival movement is explicitly inventoried and preserves recoverable provenance.
- [ ] **AC-19 — Eight script entries:** Package-script inspection finds all eight required validation names exactly once, and invoking each reaches a real checker or an explicit failing capability/product gate rather than a missing command or successful no-op.
- [ ] **AC-20 — Portable baseline:** `bun run check`, `bun run typecheck`, `bun run test`, and `bun run test:integration` pass on the supported portable development environment using deterministic fixtures.
- [ ] **AC-21 — Failure versus skip:** `studio:build`, `dataset:validate`, and `benchmark:smoke` return explicit `FAIL` while their products are absent; `local:check` uses `SKIP` only for a probed unavailable host capability and never for missing implementation.
- [ ] **AC-22 — Result schema:** Every validation check has one mutually exclusive `PASS`, `FAIL`, or `SKIP`, plus check ID, reason, and `LIVE`, `REPLAY`, or `FIXTURE` source; missing, empty, contradictory, and unknown results normalize to `FAIL`.
- [ ] **AC-23 — Deterministic baseline report:** Repeated controlled runs list commands and check IDs in the fixed documented order and produce equivalent status/source results; an aggregate cannot hide an individual failure or promote fixture/replay evidence into live acceptance.
- [ ] **AC-24 — Baseline privacy:** Instrumented validation proves Phase 1 checks do not enumerate or clone private repositories, read real credentials/private datasets, publish or upload artifacts, launch model training, or require private operator data.

## Edge Coverage

**Coverage:** 24/24 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| Empty / degenerate | R1 | ⛔ dismissed | A surface with no user-facing product text has no first-mention obligation; AC-01 still requires its exclusion to be identified and justified. |
| Encoding / representation | R1 | ✅ covered | AC-01 fixes the canonical phrase and scans decoded source plus built/generated user-facing text for forbidden branding variants. |
| Idempotency / repetition | R2 | ✅ covered | AC-04 repeats collision scenarios and requires unchanged sentinels. |
| Concurrency / effect ordering | R2 | ✅ covered | AC-04 covers interrupted and concurrent attempts and requires fail-closed nonmutation. |
| Empty / degenerate | R3 | ✅ covered | AC-05 specifies unset, blank, and relative override behavior. |
| Encoding / representation | R3 | ✅ covered | AC-05 covers absolute roots containing spaces and Unicode. |
| Idempotency / repetition | R4 | ✅ covered | AC-08 requires equivalent repeated diagnoses without mutation. |
| Concurrency / effect ordering | R4 | ✅ covered | AC-08 requires parallel doctor runs to remain read-only. |
| Adjacency / touching | R5 | ✅ covered | AC-10 requires each command path and alias to resolve to at most one leaf. |
| Empty / degenerate | R5 | ✅ covered | AC-10 defines bare human and JSON invocation behavior. |
| Ordering / stability | R5 | ✅ covered | AC-10 requires deterministic documented help ordering. |
| Empty / degenerate | R6 | ✅ covered | AC-12 requires one valid JSON object for every documented outcome, never blank output. |
| Encoding / representation | R6 | ✅ covered | AC-12 requires parseable UTF-8 and deterministic serialization. |
| Adjacency / touching | R7 | ✅ covered | AC-13 requires exactly one record per exact locator and rejects duplicates. |
| Empty / degenerate | R7 | ✅ covered | AC-13 requires every mandatory category, including evidenced zero counts. |
| Ordering / stability | R7 | ✅ covered | AC-14 requires deterministic path-sorted output. |
| Idempotency / repetition | R8 | ✅ covered | AC-17 requires unchanged review and eligibility on repeated validation. |
| Concurrency / effect ordering | R8 | ⛔ dismissed | Phase 1 performs no destructive cleanup; AC-18 verifies that boundary. |
| Adjacency / touching | R9 | ✅ covered | AC-19 requires eight distinct script entries and prevents successful aliases/no-ops. |
| Empty / degenerate | R9 | ✅ covered | AC-21 makes absent implementation a failure and reserves skip for probed capability absence. |
| Ordering / stability | R9 | ✅ covered | AC-23 fixes command and check ordering in the baseline report. |
| Adjacency / touching | R10 | ✅ covered | AC-22 requires exactly one mutually exclusive status per check. |
| Empty / degenerate | R10 | ✅ covered | AC-22 maps missing, empty, contradictory, and unknown results to failure. |
| Ordering / stability | R10 | ✅ covered | AC-23 requires deterministic ordering by command and check ID. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT imply that this product is Apple's MLX project or is affiliated with or endorsed by Apple. | R1 | resolved | `judgment` — AC-02 routes product text and metadata to explicit review. |
| MUST NOT execute, overwrite, unlink, rename, shadow, or modify an unrelated `mlx`, PATH entry, alias, symlink, or shell configuration during collision handling. | R2/R4 | resolved | `test` — AC-04 and AC-08 define fail-first sentinel fixtures; wired-check descriptor intentionally deferred because the test files do not yet exist. |
| MUST NOT silently read, copy, adopt, modify, or delete unrelated `.codex`, Apple MLX, or pre-existing `.mlx` state. | R3 | resolved | `test` — AC-06 defines unrelated-state sentinels; wired-check descriptor intentionally deferred. |
| MUST NOT run legacy pipeline behavior, launch a model, or write artifacts while presenting a later-phase command shell as implemented MLX functionality. | R5 | resolved | `test` — AC-11 checks unavailable status and absence of side effects; wired-check descriptor intentionally deferred. |
| MUST NOT enumerate private repositories, consume real private data or credentials, publish artifacts, or perform model training merely to establish the Phase 1 validation baseline. | R9 | resolved | `test` — AC-24 uses instrumented validation; wired-check descriptor intentionally deferred. |

Canon security concerns such as path traversal, symlink escape, command injection, secret scanning, and PII scanning remain owned by `$gsd-secure-phase` and their mapped implementation phases; they are not duplicated as bespoke prohibitions here.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.91 | 0.75 | ✓ | Outcome is tied to ten IDEN requirements and concrete artifacts/behaviors. |
| Boundary Clarity | 0.76 | 0.70 | ✓ | Later-phase functionality, full writer migration, and destructive cleanup are explicitly excluded. |
| Constraint Clarity | 0.82 | 0.65 | ✓ | Identity, executable safety, state-root, JSON, privacy, and validation semantics are fixed. |
| Acceptance Criteria | 0.79 | 0.70 | ✓ | Twenty-four pass/fail checks cover requirements, behavioral edges, and prohibitions. |
| **Ambiguity** | **0.17** | **≤0.20** | **✓** | Weighted gate passed after Round 1. |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What does a complete command surface mean before later phases exist? | All authoritative paths parse, appear in help, support JSON, and return explicit unavailable results until their owner phase implements them. |
| 1 | Researcher | How far does Phase 1 migrate `MLX_HOME` paths? | Establish the canonical resolver and migrate operator-facing config/CLI state; inventory remaining legacy writers for Phase 2. |
| 1 | Researcher | What validation state completes Phase 1? | All eight scripts are runnable; portable current checks pass; missing later-phase products fail; genuine capability gaps alone may skip. |
| Gate | Seed Closer | Ambiguity reached 0.17; proceed? | User approved edge and prohibition probes and SPEC generation. |
| Edge probe | Completeness | Resolve 24 applicable behavior-shape edges. | User accepted 22 explicit acceptance checks and 2 reasoned dismissals; none remain unresolved. |
| Prohibition probe | Completeness | Resolve five bespoke product/safety/transparency must-NOT constraints. | User retained all five; one uses judgment review and four use fail-closed test-tier verification. |

---

*Phase: 01-identity-cleanup-baseline-and-migration-map*
*Spec created: 2026-07-15*
*Next step: $gsd-discuss-phase 1 — implementation decisions (how to build what is specified above)*
