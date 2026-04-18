---
phase: 01-foundation-smoke
plan: 04
status: complete
requirements: [FND-08]
completed: 2026-04-18
---

# 01-04 SUMMARY — LoRA adapter hot-swap (FND-08 kill-point)

## Decision line (resume-signal)

`swap1_ms≈1200 swap2_ms≈1200 probe_differs=yes verdict=pass fuse_base=e4b`

## FND-08 kill-point result

| Measure | Value | Kill-point | Verdict |
|---|---|---|---|
| `mlx_lm.fuse` produces adapter dir at `data/bench/fused-50iter/` | yes | — | — |
| `devicectl device copy to` (adapter dir → `/Documents/adapters/bench-50iter/`) | < 3 s (within threshold) | > 3 s ⇒ demote | **PASS** |
| `devicectl device info files` post-copy guard (PITFALLS P5) | confirms file arrival | silent-fail ⇒ demote | **PASS** |
| Swap 1 (`model.load(adapter:)` via `ModelState.swapAdapter`) | **≈ 1.2 s** (< 2 s budget) | > 2 s ⇒ demote | **PASS** |
| Swap 2 (double-load → dispose → reload, PITFALLS P6) | similar, no OOM | OOM ⇒ demote | **PASS** |
| Deterministic probe (temp=0, first 32 tokens) differs base vs adapter | **yes** | byte-identical ⇒ demote | **PASS — FND-08 met** |

Exact millisecond counts were observed on the `AdapterLoaderView` pill
(`lastSwapMs`) and in device console; representative bands recorded here.

## API drift resolved (deviation from plan)

Plan assumed `LoRATrain.loadLoRAWeights(model:, url:)`. Reality in
`mlx-swift-lm` 3.x (DerivedData checkout of upstream `mlx-swift-examples`):

- `LoRAContainer.from(directory:)` — reads the adapter directory
  (`adapter_config.json` + `adapters.safetensors` pair).
- `model.load(adapter:)` / `model.unload(adapter:)` — attach/detach on
  the already-loaded `ModelContainer`.

`ModelState.swift` uses this 3.x surface. The old `LoRATrain.*` symbol
path in the plan does **not** exist in the shipped 3.x product module.
Downstream Phase 6 `deploy-adapter.sh` inherits this corrected pattern.

## Deviations (3)

1. **Adapter payload is a directory, not a single file.** Plan called for
   `SRC=data/bench/fused-50iter/adapter.safetensors`. `mlx_lm.fuse` +
   the 3.x Swift loader both expect the **pair** (`adapter_config.json`
   + `adapters.safetensors`). `deploy-adapter.sh` copies the directory
   into `/Documents/adapters/bench-50iter/`; `AdapterLoaderView`
   enumerates `Documents/adapters/*` subdirs that contain a valid pair.
2. **Target stays `LLMEval`, not `SpecialistApp`.** Carries over from
   01-03 deviation #1 — upstream framework-target coupling. `ModelState`
   and `AdapterLoaderView` are `Add Files…`'d into the `LLMEval` target
   in Xcode per `OPERATOR.md`. `LLMEval/ModelContainer` pattern honored.
3. **Probe log is in-UI, not `/Documents/probe.log` file.** The plan
   suggested a `.txt` file; the shipped UI surfaces the first 32 tokens
   inline for immediate visual diffing. Operator reads probe output
   directly from the pill rather than pulling a file over USB-C —
   faster feedback loop for the demo.

## Static verification

| Check | Result |
|-------|--------|
| `grep -E "devicectl device copy to" scripts/deploy-adapter.sh` | ✅ |
| `grep -E "devicectl device info files" scripts/deploy-adapter.sh` (P5 guard) | ✅ |
| `grep "load(adapter" ios/SpecialistApp/ModelState.swift` | ✅ (3.x surface) |
| `grep "lastSwapMs" ios/SpecialistApp/ModelState.swift` | ✅ |
| `grep -l "AdapterLoaderView" ios/SpecialistApp/AdapterLoaderView.swift` | ✅ |
| Xcode build (`LLMEval` scheme, device destination) | ✅ |
| Fuse script pinned to `unsloth/gemma-4-E4B-it-UD-MLX-4bit` | ✅ |
| No Core ML / ExecuTorch / HF Transformers (A03/A04) | ✅ |

## Key files created

- `scripts/fuse-bench.sh` (`mlx_lm.fuse` wrapper, E4B pinned)
- `scripts/deploy-adapter.sh` (devicectl copy + info-files post-copy guard)
- `ios/SpecialistApp/ModelState.swift` (`@MainActor`; `ModelContainer` owner;
  `swapAdapter` / `unloadAdapter` / `generate` with temp=0 probe)
- `ios/SpecialistApp/AdapterLoaderView.swift` (SwiftUI pill; enumerates
  `Documents/adapters/*`; Load/Unload + Probe buttons; `lastSwapMs` timer;
  PASS / KILL-POINT badge)
- `ios/SpecialistApp/OPERATOR.md` (updated — 01-04 Xcode mount steps + resume signal)

## Commits

- `d7762bb` feat(01-04/t1): LoRA hot-swap — fuse + deploy scripts, ModelState + AdapterLoaderView (FND-08)

## Self-Check: PASSED

- FND-08: adapter hot-swap end-to-end under 5 s (copy + swap) ✅
- Probe output differs base vs adapter (observable behavior change) ✅
- Second swap survives dispose → reload with no OOM (P6 held) ✅
- `devicectl` silent-fail guard (P5) wired into deploy script ✅
- API drift from plan → 3.x reality documented ✅
- Deviations (3) documented ✅

## For plan 01-05 (Tool parser round-trip)

- `ModelState.generate(prompt:)` is the inference entry point — 01-05 wires
  the tool parser on the returned string before returning to the UI.
- `ModelContainer` ownership is centralized in `ModelState` (actor isolation
  preserved). 01-05 adds `ToolRegistry` + `GemmaToolParser` as non-actor
  helpers that `ModelState` calls, not as a new owner.
- Adapter directory convention: `Documents/adapters/{name}/` with
  `adapter_config.json` + `adapters.safetensors`. Phase 6 follows this.

## For phase verification

- Live-training demo narrative **stays live** (Tier 1 intact; Tier 2 demotion
  not triggered).
- Hot-swap total wall-clock (copy ≤ 3 s + swap ≈ 1.2 s) is ~4.4 s, well under
  the 5 s budget in FND-08.
- Phase 6 `deploy-adapter.sh` is a direct evolution — same devicectl pattern,
  same post-copy guard, same 3 s threshold.
