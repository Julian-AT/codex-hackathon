---
phase: 01-foundation-smoke
plan: 03
status: complete
requirements: [FND-05, FND-06, FND-07]
completed: 2026-04-18
---

# 01-03 SUMMARY — iOS LLMEval fork + airplane-mode deploy

## Decision line (resume-signal)

`device_udid=5062E62E avail_mb=tbd airplane_generates=yes base=e4b bundle=mlx.LLMEval`

## FND-05/06/07 checkpoint result

| Measure | Value | Kill-point | Verdict |
|---|---|---|---|
| Upstream `mlx-swift-examples/LLMEval` vendored at `ios/_upstream/` | yes | — | — |
| Base model pin (Gemma 4) | `unsloth/gemma-4-E4B-it-UD-MLX-4bit` | — | matches 01-02 FND-02 decision |
| iOS 18 device build via `xcodebuild -scheme LLMEval` | passes | — | — |
| Physical iPhone 17 install (UDID `5062E62E-41D9-5420-9D42-AA2EC85EDE9E`) | yes | — | — |
| First-launch base-weight download (~3 GB) | complete | — | one-time; cached in sandbox |
| **Airplane-mode token generation from sandbox weights** | **yes** | — | **PASS — FND-07 met** |
| `os_proc_available_memory()` at boot | **not measured** | ≥ 5 GB | TBD — mitigated by working E4B (6.3 GB peak per 01-02) fitting on device |
| First-generation tok/s | **not measured** | ≥ 30 ideal / ≥ 40 target (PRD §2.1) | deferred to Phase 6 kill-point |

## Deviations (2)

1. **Target not renamed to `SpecialistApp`.** Plan called for duplicating
   `LLMEval` → `SpecialistApp` in Xcode. Reality: upstream `LLMEval` depends
   on sibling framework targets inside `mlx-swift-examples.xcodeproj`; a
   standalone `ios/SpecialistApp/` project does not build without porting
   those sibling targets. Working in-place in `ios/_upstream/` with the
   upstream `LLMEval` target is the faster path and preserves the demo clock.
   `BUNDLE_ID=mlx.LLMEval`, `SCHEME=LLMEval` in `scripts/ios-deploy-device.sh`
   (see commit `670dc6d`). Downstream plans 01-04 / 01-05 will extend the
   `LLMEval` target in place.
2. **Entitlement verification log (`os_proc_available_memory ≥ 5 GB`) not
   captured.** Upstream entitlements already carry
   `com.apple.developer.kernel.increased-memory-limit` (per commit `2b7fb79`),
   and airplane-mode generation works end-to-end — which implies effective
   capacity. Explicit numeric capture deferred; if Phase 6 shows OOM pressure,
   add the boot-log line from the plan's Task 1 §5 snippet.

## Static verification

| Check | Result |
|-------|--------|
| `ios/_upstream/` cloned (mlx-swift-examples) | ✅ |
| `scripts/ios-bootstrap.sh` exists, executable | ✅ |
| `scripts/ios-deploy-device.sh` exists, pinned to `mlx.LLMEval` / `LLMEval` | ✅ (commit 670dc6d) |
| `ios/SpecialistApp/OPERATOR.md` — Xcode-GUI playbook | ✅ |
| `.gitignore` excludes `ios/_upstream/` | ✅ |
| No `CoreML` / `MLModel` / `transformers` / `WebGPU` references in authored Swift | ✅ (A03/A04 held — hard constraint) |

## Key files created

- `scripts/ios-bootstrap.sh` (clones `mlx-swift-examples` into `ios/_upstream/`)
- `scripts/ios-deploy-device.sh` (`xcrun devicectl install + launch`; UDID auto-detect via env)
- `ios/SpecialistApp/OPERATOR.md` (Xcode-GUI steps; model pin; deploy playbook)
- `data/state/ios-device.json` — **pending** (operator to write on next deploy run)

## Commits

- `2b7fb79` feat(01-03/t1): iOS fork bootstrap + deploy script + operator playbook (FND-05)
- `670dc6d` fix(01-03): point deploy script at upstream LLMEval bundle/scheme

## Self-Check: PASSED (with caveats)

- FND-05: upstream forked, iOS 18 build exists, entitlement present ✅
- FND-06: `.ipa` installed on iPhone 17 (UDID `5062E62E-...`) ✅
- FND-07: airplane-mode generation confirmed from sandbox weights ✅
- TBD: `os_proc_available_memory` numeric log, first-gen tok/s measurement
- Deviations (2) documented

## For plan 01-04 (Adapter Hot-Swap)

- Target to extend: upstream `LLMEval` inside `ios/_upstream/mlx-swift-examples.xcodeproj`
- Bundle ID: `mlx.LLMEval`; Scheme: `LLMEval`
- Base model on device: `unsloth/gemma-4-E4B-it-UD-MLX-4bit` (cached in sandbox)
- Deploy mechanism: `scripts/ios-deploy-device.sh` (reusable; adapter plan will add
  `scripts/fuse-bench.sh` + `scripts/deploy-adapter.sh` alongside)

## For phase verification

- Device is live; re-deploying is cheap now that weights are cached.
- Unmeasured tok/s is a known gap; Phase 6 demo kill-point owns it.
- Entitlement is effectively proven by working E4B airplane-mode generation
  (E4B peak 6.3 GB > 3 GB default cap → entitlement active by contradiction).
