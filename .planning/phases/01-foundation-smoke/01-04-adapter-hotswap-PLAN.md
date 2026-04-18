---
phase: 01-foundation-smoke
plan: 04
type: execute
wave: 2
depends_on: [02, 03]
files_modified:
  - scripts/fuse-bench.sh
  - scripts/deploy-adapter.sh
  - ios/SpecialistApp/SpecialistApp/AdapterLoaderView.swift
  - ios/SpecialistApp/SpecialistApp/ModelState.swift
  - ios/SpecialistApp/SpecialistApp/ContentView.swift
autonomous: false
requirements: [FND-08]

must_haves:
  truths:
    - "`mlx_lm.fuse` merges the 50-iter bench adapter (from plan 01-02) into a standalone `adapter.safetensors` of ~60 MB."
    - "`xcrun devicectl device copy to` transfers `adapter.safetensors` into the app's `/Documents/` in <3 seconds and `devicectl device info files` confirms the arrival (guards against PITFALLS P5 silent copy failure)."
    - "An `AdapterLoaderView` enumerates `/Documents/*.safetensors` and calls `LoRATrain.loadLoRAWeights(model:, url:)`; swap completes in <2 seconds."
    - "A deterministic probe prompt produces **different** output before vs after the swap (observable behavior change = FND-08 kill-point pass)."
    - "If swap > 2 s or devicectl silent-fails, the kill-point triggers and the phase narrative demotes to Tier 2 (static pre-trained tools)."
  artifacts:
    - path: "scripts/fuse-bench.sh"
      provides: "mlx_lm.fuse wrapper producing adapter.safetensors"
    - path: "scripts/deploy-adapter.sh"
      provides: "devicectl copy with post-copy size/hash assertion (PITFALLS P5)"
    - path: "ios/SpecialistApp/SpecialistApp/AdapterLoaderView.swift"
      provides: "/Documents/*.safetensors enumerator + loadLoRAWeights trigger"
    - path: "ios/SpecialistApp/SpecialistApp/ModelState.swift"
      provides: "Actor owning ModelContainer and adapter-swap method"
  key_links:
    - from: "scripts/deploy-adapter.sh"
      to: "iPhone /Documents/adapter.safetensors"
      via: "xcrun devicectl device copy to --domain-type appDataContainer"
      pattern: "devicectl device copy"
    - from: "ios/SpecialistApp/SpecialistApp/ModelState.swift"
      to: "LoRATrain.loadLoRAWeights"
      via: "actor method swapAdapter"
      pattern: "loadLoRAWeights"
---

<objective>
Prove the full adapter hot-swap loop: fuse a 50-iter adapter on the laptop → `devicectl` copy to iPhone → `loadLoRAWeights` on device → observable behavior change — all in under 5 s end-to-end.

Purpose: This is the FND-08 kill-point. If it fails, the live-training demo story collapses to Tier 2 (static pre-trained tools). The downstream Phase 6 deploy-adapter script is a direct evolution of this plan's `deploy-adapter.sh`.
Output: A working hot-swap smoke test on a physical iPhone 17 with before/after generation logs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD_SPEC.md
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/SUMMARY.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@.planning/phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md
@.planning/phases/01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md

<interfaces>
Preconditions from dependency plans:
- Plan 01-02 produced `data/bench/adapter-50iter/` containing adapter weights.
- Plan 01-03 produced a deployed iPhone app at bundle id `com.hackathon.SpecialistApp` (operator may have renamed) with UDID in `data/state/ios-device.json`.

Canonical `mlx_lm.fuse` command (PRD §14 H1):
```
mlx_lm.fuse \
  --model unsloth/gemma-4-E4B-it-UD-MLX-4bit \
  --adapter-path data/bench/adapter-50iter \
  --save-path data/bench/fused-50iter
```
(Adjust base model to E2B if `.env.base` says so.)

Canonical `xcrun devicectl` copy:
```
xcrun devicectl device copy to \
  --device $UDID \
  --domain-type appDataContainer \
  --domain-identifier com.hackathon.SpecialistApp \
  --source ./data/bench/fused-50iter/adapter.safetensors \
  --destination /Documents/adapter.safetensors
```

Post-copy verification (PITFALLS P5 — devicectl CAN silently fail):
```
xcrun devicectl device info files \
  --device $UDID \
  --domain-type appDataContainer \
  --domain-identifier com.hackathon.SpecialistApp \
  /Documents/
```
Assert the file exists with the expected size (within 1% of laptop source).

Swift interface (mlx-swift-examples `LoraCommands.swift` reference):
```
LoRATrain.loadLoRAWeights(model: ModelContainer, url: URL)
```
Exact symbol name may differ in mlx-swift-lm 3.x; plan 01-03 task 2 confirmed the actual import surface — match it.

KILL-POINT (FND-08):
- Copy > 3 s OR swap > 2 s OR silent copy failure → demote to Tier 2 (static pre-trained tools ship, no live adapter hot-swap in demo). Document the failure mode in the SUMMARY.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fuse 50-iter bench adapter + deploy script with post-copy verification</name>
  <files>
    scripts/fuse-bench.sh, scripts/deploy-adapter.sh
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §8.3 (hot-swap mechanism), §14 H1
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P5 devicectl silent fail, P18 fuse flag surface)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md (adapter path)
  </read_first>
  <action>
    1. Write `scripts/fuse-bench.sh`:
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       source .venv/bin/activate
       if [ -f .env.base ]; then source .env.base; fi
       BASE_MODEL=${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}
       ADAPTER=${ADAPTER:-data/bench/adapter-50iter}
       OUT=${OUT:-data/bench/fused-50iter}
       rm -rf "$OUT"
       START=$(date +%s)
       mlx_lm.fuse \
         --model "$BASE_MODEL" \
         --adapter-path "$ADAPTER" \
         --save-path "$OUT"
       END=$(date +%s)
       echo "Fuse elapsed: $((END-START))s"
       ls -lh "$OUT"
       # Emit a single "adapter.safetensors" path for deploy-adapter.sh. Some mlx-lm versions write
       # a merged "model.safetensors"; we want the LoRA-only or merged file depending on target.
       if [ -f "$OUT/adapter.safetensors" ]; then
         echo "FUSED_PATH=$OUT/adapter.safetensors"
       elif [ -f "$OUT/model.safetensors" ]; then
         echo "FUSED_PATH=$OUT/model.safetensors"
       else
         ls "$OUT"
         echo "ERROR: no fused safetensors found" >&2
         exit 1
       fi
       ```
    2. Write `scripts/deploy-adapter.sh` with **MANDATORY post-copy verification** (PITFALLS P5):
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       UDID=${IPHONE_UDID:-$(jq -r .udid data/state/ios-device.json 2>/dev/null)}
       BUNDLE=${IPHONE_BUNDLE:-$(jq -r .bundle_id data/state/ios-device.json 2>/dev/null)}
       SRC=${SRC:-data/bench/fused-50iter/adapter.safetensors}
       if [ ! -f "$SRC" ]; then SRC=data/bench/fused-50iter/model.safetensors; fi
       if [ -z "$UDID" ] || [ -z "$BUNDLE" ] || [ ! -f "$SRC" ]; then
         echo "ERROR: need IPHONE_UDID, IPHONE_BUNDLE, and $SRC"; exit 1
       fi
       SRC_SIZE=$(wc -c < "$SRC")
       echo "Copying $SRC ($SRC_SIZE bytes) to $BUNDLE:/Documents/adapter.safetensors"
       START=$(date +%s%N)
       xcrun devicectl device copy to \
         --device "$UDID" \
         --domain-type appDataContainer \
         --domain-identifier "$BUNDLE" \
         --source "$SRC" \
         --destination /Documents/adapter.safetensors
       END=$(date +%s%N)
       ELAPSED_MS=$(( (END - START) / 1000000 ))
       echo "Copy elapsed: ${ELAPSED_MS} ms"
       # MANDATORY verification — devicectl can silently succeed with no file on device (P5)
       echo "Verifying on-device file..."
       xcrun devicectl device info files \
         --device "$UDID" \
         --domain-type appDataContainer \
         --domain-identifier "$BUNDLE" \
         /Documents/ | tee /tmp/devicectl-info.txt
       if ! grep -q "adapter.safetensors" /tmp/devicectl-info.txt; then
         echo "ERROR: adapter.safetensors NOT present on device (PITFALLS P5 silent-fail)"; exit 2
       fi
       # Soft threshold check (FND-08 kill-point: >3000 ms → demote Tier 2)
       if [ "$ELAPSED_MS" -gt 3000 ]; then
         echo "WARN: copy exceeded 3 s threshold — FND-08 kill-point at risk"
       fi
       ```
    3. Run `./scripts/fuse-bench.sh` then `./scripts/deploy-adapter.sh` to validate the laptop-side pipeline end-to-end. Record the two elapsed times into the plan summary.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && bash scripts/fuse-bench.sh 2>&1 | tail -15 && ls -lh data/bench/fused-50iter/ && bash scripts/deploy-adapter.sh 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `data/bench/fused-50iter/` contains a `.safetensors` file.
    - Fuse elapsed logged.
    - `devicectl device copy to` exits 0 AND subsequent `devicectl device info files` lists `adapter.safetensors`.
    - Copy elapsed ≤ 3000 ms (if > 3000 ms, KILL-POINT flag emitted; operator decides).
    - `grep -E "devicectl device copy to" scripts/deploy-adapter.sh` succeeds.
    - `grep -E "devicectl device info files" scripts/deploy-adapter.sh` succeeds (verification guard — MANDATORY per P5).
  </acceptance_criteria>
  <done>Laptop-side hot-swap pipeline works with verified on-device file arrival.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: AdapterLoaderView + ModelState actor; observable behavior change on swap</name>
  <files>
    ios/SpecialistApp/SpecialistApp/AdapterLoaderView.swift, ios/SpecialistApp/SpecialistApp/ModelState.swift, ios/SpecialistApp/SpecialistApp/ContentView.swift
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §8.2 items 1, 2; §8.3 (hot-swap)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/ios/_upstream/Tools/llm-tool/LoraCommands.swift (upstream reference for `loadLoRAWeights`)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P6 JSContext retain — dispose pattern also applies to ModelContainer swap)
  </read_first>
  <action>
    1. `ios/SpecialistApp/SpecialistApp/ModelState.swift`:
       ```swift
       import Foundation
       import MLX
       import MLXLMCommon
       import MLXLM

       @MainActor
       final class ModelState: ObservableObject {
           @Published var currentAdapter: String = "base"
           @Published var lastSwapMs: Int = 0
           private var container: ModelContainer?

           func ensureLoaded() async throws {
               if container != nil { return }
               container = try await LLMModelFactory.shared.loadContainer(
                   configuration: SpecialistModel.configuration
               )
           }

           func swapAdapter(url: URL) async throws {
               try await ensureLoaded()
               guard let container else { throw NSError(domain: "ModelState", code: -1) }
               let start = Date()
               try await container.perform { ctx in
                   try LoRATrain.loadLoRAWeights(model: ctx.model, url: url)
               }
               let ms = Int(Date().timeIntervalSince(start) * 1000)
               lastSwapMs = ms
               currentAdapter = url.lastPathComponent
               print("[swap] loaded \(url.lastPathComponent) in \(ms) ms")
           }

           func generate(prompt: String) async throws -> String {
               try await ensureLoaded()
               guard let container else { return "" }
               return try await container.perform { ctx in
                   var out = ""
                   let tokenizer = ctx.tokenizer
                   let input = try await ctx.processor.prepare(
                       input: .init(messages: [["role": "user", "content": prompt]])
                   )
                   let stream = try MLXLMCommon.generate(
                       input: input, parameters: .init(temperature: 0.0), context: ctx
                   )
                   for await token in stream {
                       if case .chunk(let text) = token { out += text }
                   }
                   return out
               }
           }
       }
       ```
       Exact API may differ in mlx-swift-lm 3.x — match the upstream `LLMEval` ContentView's inference pattern. If `LoRATrain.loadLoRAWeights` takes different args in 3.x, adapt (this is one of the H1 verify items).

    2. `ios/SpecialistApp/SpecialistApp/AdapterLoaderView.swift`:
       ```swift
       import SwiftUI

       struct AdapterLoaderView: View {
           @EnvironmentObject var model: ModelState
           @State private var files: [URL] = []
           @State private var status: String = ""

           var body: some View {
               VStack(alignment: .leading, spacing: 8) {
                   HStack {
                       Text("Adapter:").bold()
                       Text(model.currentAdapter)
                       if model.lastSwapMs > 0 { Text("(\(model.lastSwapMs) ms)").foregroundColor(.secondary) }
                   }
                   ForEach(files, id: \.self) { url in
                       Button(url.lastPathComponent) {
                           Task {
                               do {
                                   try await model.swapAdapter(url: url)
                                   status = "Loaded \(url.lastPathComponent)"
                               } catch { status = "Error: \(error)" }
                           }
                       }
                   }
                   Text(status).font(.caption).foregroundColor(.secondary)
               }
               .onAppear { refresh() }
               .task { refresh() }
           }

           private func refresh() {
               let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
               files = (try? FileManager.default.contentsOfDirectory(at: docs, includingPropertiesForKeys: nil))?
                   .filter { $0.pathExtension == "safetensors" } ?? []
           }
       }
       ```

    3. Mount `AdapterLoaderView` at the top of `ContentView.swift` as a pill/toolbar area above the existing chat UI.

    4. **Probe prompt pattern** — add a button "Probe" that sends a deterministic prompt (e.g., `"Complete: The quick brown fox"`) at temperature 0.0 and records the first 32 tokens before swap and after swap. Both runs' output should be captured in a `.txt` file in `/Documents/probe.log` so the operator can diff them on device or after a USB-C `devicectl` pull.

    5. After fuse + deploy (Task 1), run the swap on device and confirm:
       - `lastSwapMs` < 2000 ms in the UI pill.
       - Probe output **differs** between base and adapter (even a 50-iter adapter changes at least a few tokens on a deterministic decode — this is the observable behavior change required by FND-08).
  </action>
  <what-built>
    On-device UI that enumerates `/Documents/*.safetensors`, triggers `LoRATrain.loadLoRAWeights`, records swap elapsed ms, and produces a deterministic probe output showing different tokens before vs after swap.
  </what-built>
  <how-to-verify>
    1. Run `./scripts/fuse-bench.sh && ./scripts/deploy-adapter.sh` — confirm copy < 3 s and `devicectl device info files` lists the file.
    2. On the iPhone, tap the adapter button for `adapter.safetensors`. Confirm the pill shows the swap ms value < 2000.
    3. Before swap, hit "Probe" and note first 32 tokens of output.
    4. After swap, hit "Probe" again with the exact same prompt. Confirm output differs (even 1 token diff counts).
    5. Repeat swap once more to exercise the load→dispose→reload path (PITFALLS P6). Confirm second swap still < 2000 ms and app does not OOM.
    6. If swap > 2000 ms OR second swap OOMs OR probe outputs are byte-identical → KILL-POINT FND-08 triggered. Record failure mode in SUMMARY and demote downstream phases to Tier 2 (static pre-trained tools).
  </how-to-verify>
  <resume-signal>Type `approved` with line: `swap1_ms={N} swap2_ms={N} probe_differs=yes|no verdict={pass|kill-point}`. If `kill-point`, describe the failure mode in one sentence.</resume-signal>
  <acceptance_criteria>
    - `grep "loadLoRAWeights" ios/SpecialistApp/SpecialistApp/ModelState.swift` succeeds.
    - `grep "lastSwapMs" ios/SpecialistApp/SpecialistApp/ModelState.swift` succeeds.
    - Build succeeds for iOS device: `xcodebuild -scheme SpecialistApp -destination "id=$UDID" build` exits 0.
    - Operator-verified: swap1_ms < 2000 AND probe_differs=yes.
    - Double-swap test passes (no OOM on second load — PITFALLS P6).
  </acceptance_criteria>
  <done>FND-08 kill-point resolved: adapter hot-swap works end-to-end in under 5 s total (copy + swap) with observable behavior change. If it fails, kill-point documented and downstream phases demote to Tier 2.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Laptop shell → `mlx_lm.fuse` | Trusted venv subprocess; reads weight files from local disk only. |
| Laptop → iPhone `/Documents/` | USB-C devicectl authenticated channel; writes into app's sandboxed container. |
| App → `/Documents/*.safetensors` | App reads files under its own sandbox; no broader FS access. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-12 | Tampering | Silent devicectl copy failure yields stale adapter illusion | mitigate | Mandatory `devicectl device info files` post-copy check in `deploy-adapter.sh` (P5). |
| T-01-13 | Elevation of Privilege | Malicious adapter file in `/Documents/` executed as weights | accept | App sandbox is private; only operator's devicectl writes here. Weights are parameter tensors, not executable. |
| T-01-14 | Denial of Service | Double-swap leaks ModelContainer memory | mitigate | Dispose previous container on swap (PITFALLS P6). Assert second swap still < 2 s. |
| T-01-15 | Repudiation | No audit of which adapter was last loaded | mitigate | `currentAdapter` + `lastSwapMs` persisted in UI pill + printed to log at every swap. |
</threat_model>

<verification>
- Fuse produces `.safetensors`.
- Copy verified via `devicectl device info files`.
- Swift build exits 0.
- Operator-verified swap < 2 s with behavior change.
</verification>

<success_criteria>
FND-08 passes: 50-iter fused adapter copies to iPhone in < 3 s, swaps in < 2 s, probe output differs. Plan 01-05 inherits a working `ModelState` it can extend with tool dispatch. Phase 6 `deploy-adapter.sh` inherits the verified-copy pattern.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-smoke/01-04-SUMMARY.md` recording: fuse_elapsed_s, copy_elapsed_ms, swap1_ms, swap2_ms, probe_differs, final FND-08 verdict.
</output>
