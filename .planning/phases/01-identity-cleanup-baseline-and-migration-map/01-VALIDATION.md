---
phase: 1
slug: identity-cleanup-baseline-and-migration-map
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
revised: 2026-07-16
---

# Phase 1 — Validation Strategy

> Phase 1 portable checks must pass; absent later products must fail explicitly. RED gates execute every intended suite, record every exit, and accept only collected behavior-assertion failures—not setup, import, collection, syntax, fixture, or no-tests errors.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest 3.2.4 with Bun 1.3.11 |
| Unit config | `vitest.config.ts` |
| Integration config | `vitest.integration.config.ts` with `test/integration/**/*.test.ts` only |
| Fail-first/external harness | `test/support/phase-1-gate.ts` created before other Plan 01 edits with the complete immutable ten-ID registry below |
| Quick run | Task-specific Vitest command listed in its PLAN |
| Portable acceptance | `bun test/support/phase-1-gate.ts verify validation-acceptance` runs every command independently |
| Estimated runtime | Target <30 s per focused suite and <120 s for portable acceptance |

## Immutable Gate Registry

Plan 01 Task 1 predeclares this complete registry. Plans 02-09 invoke it but never edit, extend, infer, or late-register an ID.

| Gate ID | Mode | Exact independently executed command mapping |
|---|---|---|
| `cli-contract` | `expect-red` | `bun x vitest run --config vitest.integration.config.ts test/integration/cli-contract.test.ts` |
| `identity-package` | `expect-red` | `bun x vitest run src/identity/audit.test.ts`; `bun x vitest run --config vitest.integration.config.ts test/integration/package-bin.test.ts` |
| `state-init` | `expect-red` | `bun x vitest run src/cli/command-tree.test.ts`; `bun x vitest run src/core/mlx-home.test.ts`; `bun x vitest run src/core/state-ownership.test.ts`; `bun x vitest run --config vitest.integration.config.ts test/integration/state-cli.test.ts` |
| `doctor` | `expect-red` | `bun x vitest run src/core/doctor.test.ts`; `bun x vitest run --config vitest.integration.config.ts test/integration/doctor-cli.test.ts` |
| `migration-inventory` | `expect-red` | `bun x vitest run src/migration/inventory-schema.test.ts`; `bun x vitest run src/migration/repository-scanner.test.ts`; `bun x vitest run src/migration/removal-gate.test.ts` |
| `validation-results` | `expect-red` | `bun x vitest run src/validation/result.test.ts`; `bun x vitest run src/validation/capabilities.test.ts` |
| `validation-runtime` | `expect-red` | `bun x vitest run src/validation/runner.test.ts`; `bun x vitest run src/validation/report.test.ts`; `bun x vitest run src/validation/cli.test.ts` |
| `validation-host` | `expect-red` | `bun x vitest run src/validation/process-adapter.test.ts`; `bun x vitest run src/validation/host-capability.test.ts`; `bun x vitest run src/validation/process-entry.test.ts` |
| `validation-integration` | `expect-red` | `bun x vitest run --config vitest.integration.config.ts test/integration/validation-scripts.test.ts`; `bun x vitest run --config vitest.integration.config.ts test/integration/privacy-boundaries.test.ts` |
| `validation-acceptance` | `verify` only | `bun run check`; `bun run typecheck`; `bun run test`; `bun run test:integration`; `bun run studio:build`; `bun run dataset:validate`; `bun run benchmark:smoke`; `bun run local:check` |

Every `expect-red` mapping runs all commands without short-circuiting, retains every exit/stdout/stderr result, uniformly rejects infrastructure, setup, import, collection, syntax, fixture, and no-tests failures, and accepts only genuine failed assertions for named missing behavior after every intended suite executes. Unknown IDs, mode/ID mismatches, caller-supplied command tokens/prose, duplicates, and mutation attempts fail closed.

`validation-acceptance` is not an inferred RED branch. Its `verify` adjudicator runs all eight commands independently in the listed order and succeeds only when the first four portable commands pass, the three absent-product commands return explicit nonzero `LIVE` `FAIL` results owned by Phases 8/5/6, and `local:check` returns a probed `LIVE` `PASS` or a named unavailable `apple-silicon` capability `SKIP` rather than hiding missing behavior.

## Sampling and Recursion Rules

- After each task, run its `<automated>` command; public type changes also run typecheck.
- RED specs use `phase-1-gate.ts expect-red <gate>` so a nonzero first suite never suppresses later suites. The harness parses Vitest results, records exits/output, and rejects setup, import, collection, syntax, fixture, and no-tests failures. `migration-inventory` and `validation-host` each execute three independently recorded suites.
- After each wave, run every completed plan's focused green suites independently; do not describe unexecuted checks as sampled.
- `test:integration` is external-harness-only. Tests inside that suite inject a fake descriptor result; only the outer acceptance harness invokes the live package script once, and that package path reaches Vitest directly through Plan 08's fixed argv rather than invoking itself.
- Before verification, the external acceptance harness independently samples four portable scripts, three required product FAIL gates, and local capability behavior.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Primary proof | Automated command / relation | Status |
|---|---:|---:|---|---|---|---|
| 01-01-01 | 01 | 1 | IDEN-01/05/06 | pre-edit baseline + CLI process RED + reusable gate | `phase-1-gate.ts expect-red cli-contract` | pending |
| 01-01-02 | 01 | 1 | IDEN-05/06 | entry/tree/render GREEN | CLI integration + typecheck | pending |
| 01-01-03 | 01 | 1 | IDEN-05/06 | catalog/render edge hardening | CLI unit + integration + typecheck | pending |
| 01-02-01 | 02 | 2 | IDEN-01/02 | identity and package RED, both sampled | `phase-1-gate.ts expect-red identity-package` | pending |
| 01-02-02 | 02 | 2 | IDEN-02 | isolated sole-bin package | package-bin integration | pending |
| 01-02-03 | 02 | 2 | IDEN-01/02 | retained-copy audit and judgment | identity + package/CLI integration + typecheck | pending |
| 01-03-01 | 03 | 2 | IDEN-03 | command/root/state/process RED, all sampled | `phase-1-gate.ts expect-red state-init` | pending |
| 01-03-02 | 03 | 2 | IDEN-03 | registered `--adopt` → init wiring | state/command unit + process + typecheck | pending |
| 01-03-03 | 03 | 2 | IDEN-03 | config path migration | root/state/config unit + process + typecheck | pending |
| 01-04-01 | 04 | 3 | IDEN-02/04 | doctor unit/process RED, both sampled | `phase-1-gate.ts expect-red doctor` | pending |
| 01-04-02 | 04 | 3 | IDEN-04 | read-only classification | doctor/state process + typecheck | pending |
| 01-04-03 | 04 | 3 | IDEN-04 | symlink/concurrency/nonmutation | doctor/package/state integration + typecheck | pending |
| 01-05-01 | 05 | 4 | IDEN-07/08 | schema/reconciliation/removal RED, all three collected and sampled | `phase-1-gate.ts expect-red migration-inventory` | pending |
| 01-05-02 | 05 | 4 | IDEN-07/08 | canonical inventory and gate | migration unit + typecheck | pending |
| 01-05-03 | 05 | 4 | IDEN-07/08 | deterministic review drift; immutable preflight remains untouched | migration unit + typecheck | pending |
| 01-06-01 | 06 | 5 | IDEN-10 | result/capability RED | `phase-1-gate.ts expect-red validation-results` | pending |
| 01-06-02 | 06 | 5 | IDEN-10 | normalization/capability GREEN | result/capability unit + typecheck | pending |
| 01-06-03 | 06 | 5 | IDEN-09/10 | eight-check catalog and recursion policy | validation-core unit + typecheck | pending |
| 01-07-01 | 07 | 6 | IDEN-09/10 | runner/report/CLI RED using fakes | `phase-1-gate.ts expect-red validation-runtime` | pending |
| 01-07-02 | 07 | 6 | IDEN-09/10 | fake-port shell/bounds/report/JSON proof | runtime unit + typecheck | pending |
| 01-07-03 | 07 | 6 | IDEN-10 | truncation/interruption/report edges | all validation unit + typecheck | pending |
| 01-08-01 | 08 | 7 | IDEN-09/10 | production runner/probe/entry RED, all three collected and sampled | `phase-1-gate.ts expect-red validation-host` | pending |
| 01-08-02 | 08 | 7 | IDEN-09/10 | allowlisted Bun process adapter + genuine host probe | adapter/capability unit + typecheck | pending |
| 01-08-03 | 08 | 7 | IDEN-09/10 | real process-entry wiring + direct external Vitest path | adapter/probe/entry unit + typecheck | pending |
| 01-09-01 | 09 | 8 | IDEN-09/10 | scripts/privacy RED, both sampled | `phase-1-gate.ts expect-red validation-integration` | pending |
| 01-09-02 | 09 | 8 | IDEN-09 | eight production-entry mappings + narrow `.next/` scope | focused mapping test + typecheck | pending |
| 01-09-03 | 09 | 8 | IDEN-08/09/10 | fast fixture/privacy/final-ownership proof before plan acceptance | focused unit + integration filters (<30 s target) | pending |

## Wave 0 and Direct-Automation Relationships

- [ ] Plan 01 Task 1 first captures `migration/phase-1-change-scope.v1.json`, including the pre-existing `D src/app.tsx`, before any other edit.
- [ ] Plan 01 Task 1 creates `test/support/phase-1-gate.ts` and `vitest.integration.config.ts`; all later multi-suite RED gates depend on this Wave 1 support.
- [ ] Every behavior-producing plan creates its missing tests in its own RED task; late-loading assertions ensure tests collect and fail on named behavior rather than uncaught imports.
- [ ] `migration-inventory` runs schema, scanner, and removal suites independently; explanatory RED prose never appears in the executable command.
- [ ] Plan 06 declares fixed allowlisted argv and `test:integration` external-only; Plan 07 proves injected fake/stub behavior; Plan 08 wires the production runner/probe/entry and direct external Vitest argv; Plan 09 alone invokes the package path from the outer harness.
- [ ] Plan 09 Task 3 first runs focused fixture/privacy/change-ownership checks; the plan-level `<verification>` then runs `phase-1-gate.ts verify validation-acceptance` as the full phase acceptance gate.
- [ ] No test uses real PATH, home, `.mlx`, `.codex`, credentials, repositories, models, adapters, ignored data, or network services.

`wave_0_complete` remains false until Plan 01 Task 1 lands; Nyquist compliance is true because every one of the 27 finalized tasks has a direct automated command, the full acceptance harness is a plan-level gate after a focused Task 09-03 loop, and all prerequisite test/harness creation is explicit.

## Manual-Only Verification

| Behavior | Requirement | Instructions |
|---|---|---|
| Product wording does not imply affiliation with Apple's MLX | IDEN-01 | Inspect fresh README, root/parent/leaf help, package metadata, and doctor guidance; record the judgment in Plan 02 summary. |

All other Phase 1 behaviors require automated fixture, fake-port, process, or package proof.

## Sign-Off Gates

- [x] All 27 tasks have direct `<automated>` verification.
- [x] No RED command uses `&&` to sequence expected-failing suites.
- [x] Multi-suite RED gates run all suites and validate failure reasons.
- [x] Runner/report/CLI have isolated fake-port tests for shell safety, output bounds, edge states, JSON, and recursion.
- [x] Production process/capability adapters and the executable validation entry have focused tests; external integration reaches direct fixed Vitest argv.
- [x] Live `test:integration` is reserved for the external harness.
- [x] `.next/` ownership is narrow and explicit in Plan 09.
- [x] Dirty-worktree protection precedes edits; Plan 09 alone appends final Plan 01-09 path/hunk ownership while preserving the immutable baseline and operator-owned `D src/app.tsx` deletion verbatim.
- [x] Later products remain explicit FAIL; capability-only SKIP and source labels are independent.

**Approval:** ready for execution
