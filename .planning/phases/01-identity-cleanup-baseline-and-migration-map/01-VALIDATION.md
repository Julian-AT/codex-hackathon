---
phase: 1
slug: identity-cleanup-baseline-and-migration-map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 1 portable checks must pass; later-phase product gates must fail explicitly until their owning phases implement them.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 with Bun 1.3.11 |
| **Config file** | `vitest.config.ts`; Wave 0 adds an isolated integration configuration or explicit integration include |
| **Quick run command** | `bun run test -- <target>` |
| **Full suite command** | `bun run check && bun run typecheck && bun run test && bun run test:integration` |
| **Estimated runtime** | Under 30 seconds for the portable Phase 1 suite after baseline repair |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted `bun run test -- <target>` command plus `bun run typecheck` when public types or CLI contracts change.
- **After every plan wave:** Run `bun run check && bun run typecheck && bun run test && bun run test:integration`.
- **Before `$gsd-verify-work`:** The portable suite must be green, and tests must prove `studio:build`, `dataset:validate`, and `benchmark:smoke` return explicit later-phase `FAIL` results rather than successful no-ops.
- **Max feedback latency:** 30 seconds for targeted checks; 120 seconds for the full portable suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | IDEN-01 | T-01 | Canonical first mention and scoped identity audit reject forbidden user-facing branding | unit | `bun run test -- identity` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | IDEN-02 | Package exposes one `mlx` bin and never mutates unrelated executables | integration | `bun run test:integration -- package-bin` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | IDEN-05 | Every documented command path is unique, ordered, help-visible, and owner-tagged | unit | `bun run test -- command-tree` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | IDEN-06 | JSON mode emits one deterministic uncontaminated object for every outcome | integration | `bun run test -- cli-json` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | IDEN-03 | State roots reject relative/traversal cases and read-only commands create no state | unit | `bun run test -- mlx-home` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | IDEN-04 | Doctor never executes or mutates PATH candidates and classifies in PATH order | integration | `bun run test -- doctor` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | IDEN-07 | Scanner reconciliation covers exact locators, exclusions, and evidenced zero categories | unit | `bun run test -- migration-inventory` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | IDEN-08 | Removal eligibility fails closed for absent, stale, mocked, fixture, replay, or unavailable evidence | unit | `bun run test -- removal-gate` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 3 | IDEN-09 | All eight package scripts reach real checks or explicit product/capability gates without private side effects | integration | `bun run test:integration -- validation-scripts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 3 | IDEN-10 | Invalid results normalize to `FAIL`; status and evidence source stay independent; aggregate retains every row | unit | `bun run test -- validation-result` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cli/identity.test.ts` — canonical product and user-facing identity audit fixtures for IDEN-01.
- [ ] `src/cli/command-tree.test.ts` and `src/cli/json.test.ts` — command/help/unavailable/JSON contracts for IDEN-05 and IDEN-06.
- [ ] `src/core/mlx-home.test.ts` — isolated state-root and ownership fixtures for IDEN-03.
- [ ] `src/doctor/doctor.test.ts` — synthetic PATH, symlink, repeated, concurrent, and execution-sentinel fixtures for IDEN-04.
- [ ] `src/migration/inventory.test.ts` and `src/migration/removal-gate.test.ts` — reconciliation, deterministic report, and evidence eligibility for IDEN-07/08.
- [ ] `src/validation/result.test.ts` — result normalization, ordering, aggregation, and source classification for IDEN-10.
- [ ] `tests/integration/cli.test.ts`, `tests/integration/package-bin.test.ts`, and integration test configuration — process/package/script boundaries for IDEN-02/04/06/09.
- [ ] Shared temp-fixture helpers that never use real PATH, `~/.mlx`, `~/.codex`, credentials, private repositories, or repository `data/`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Product wording does not imply affiliation with or endorsement by Apple's MLX project | IDEN-01 | Contract AC-02 requires judgment review in addition to deterministic scans | Inspect freshly generated root/parent/leaf help, package metadata, README first mention, and doctor guidance; confirm the canonical product phrase is used and no affiliation claim appears. |

All remaining Phase 1 behaviors require automated fixture or process verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Wave 0 covers every missing test reference.
- [ ] No watch-mode flags appear in verification commands.
- [ ] Portable feedback latency remains under 120 seconds.
- [ ] Expected later-phase product failures are asserted and never promoted to pass/skip.
- [ ] `nyquist_compliant: true` is set only after the task map matches finalized plans and commands execute as specified.

**Approval:** pending
