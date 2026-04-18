# SpecialistApp — Operator Playbook (Phase 01-03)

## Reality check vs PLAN
The plan assumed rsyncing `Applications/LLMEval/` into a standalone project would build. It will not — `LLMEval` depends on sibling library targets (`MLXLLM`, `MLXLMCommon`, `MLXHuggingFace`) defined inside `ios/_upstream/mlx-swift-examples.xcodeproj`. Do not try to promote `ios/SpecialistApp/` into its own `.xcodeproj` during the hackathon. Work **inside** the upstream Xcode project and duplicate the `LLMEval` target.

Current device (probed from this machine): **iPhone 17 / `5062E62E-41D9-5420-9D42-AA2EC85EDE9E` / paired**.

## The actual flow (≈5 minutes in Xcode)

1. `open ios/_upstream/mlx-swift-examples.xcodeproj`
2. Project Navigator → right-click the `LLMEval` target → **Duplicate**. Xcode creates `LLMEval copy`.
3. Rename the duplicate:
   - Target: `SpecialistApp`
   - Scheme (Product → Scheme → Manage Schemes): `SpecialistApp`, mark **shared**.
   - `PRODUCT_BUNDLE_IDENTIFIER = com.hackathon.SpecialistApp`
   - `IPHONEOS_DEPLOYMENT_TARGET = 18.0`
   - `CODE_SIGN_ENTITLEMENTS` → `Applications/LLMEval/LLMEval.entitlements` (already carries `com.apple.developer.kernel.increased-memory-limit = true`).
   - Signing → your team, "Automatically manage signing" ON. If the entitlement is rejected on a personal team, switch to a paid team.
4. Edit `Applications/LLMEval/ViewModels/LLMEvaluator.swift` line 50:

   ```swift
   // WAS: var modelConfiguration = LLMRegistry.qwen3_8b_4bit
   var modelConfiguration = ModelConfiguration(
       id: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
       defaultPrompt: "Say hello in one word."
   )
   ```

   If `ModelConfiguration(id:defaultPrompt:)` is not public in this revision, use whatever initializer autocompletes — the **only** hard pin is the HF id string `unsloth/gemma-4-E4B-it-UD-MLX-4bit`.

   Kill-point fallback: if plan 01-02 flipped `.env.base` to E2B (peak training mem > 20 GB on M4 Pro 24 GB), swap id to `unsloth/gemma-4-E2B-it-UD-MLX-4bit`.

5. `Applications/LLMEval/LLMEvalApp.swift` — add a boot-time memory log so you can eyeball the entitlement:

   ```swift
   import os
   @main
   struct LLMEvalApp: App {
       init() {
           let avail = os_proc_available_memory()
           print("[boot] os_proc_available_memory = \(avail / (1024*1024)) MB")
       }
       var body: some Scene { WindowGroup { ContentView().environment(DeviceStat()) } }
   }
   ```

   iPhone 17 Pro + entitlement active → ≥ 5000 MB. Under 3000 MB = entitlement not applied.

6. Build & deploy from this repo root:
   ```
   export IPHONE_UDID=5062E62E-41D9-5420-9D42-AA2EC85EDE9E
   bash scripts/ios-deploy-device.sh
   ```

   First launch: enter any prompt (`hello`). ~3 GB Gemma-4-E4B-4bit weights download — do NOT cancel (PRD A18).

7. After first generation succeeds: toggle airplane mode ON (Control Center). Re-run the same prompt. Tokens must stream — FND-07 passes.

## Resume signal
Once the above works, reply with:
```
approved
device_udid=5062E62E avail_mb=<N> airplane_generates=yes base=<e4b|e2b>
```
I will then write `01-03-SUMMARY.md` and advance to plan 01-04 (adapter hot-swap).

## If something blocks

| Symptom | Likely cause | Fix |
|---|---|---|
| `xcodebuild` fails signing | No paid Apple Dev team | Xcode GUI signing tab; personal team first, paid team if entitlement rejected |
| `avail_mb` < 3000 MB | increased-memory-limit not applied | Provisioning profile must carry the entitlement |
| Model download stalls / hash mismatch | HF rate limit / network | Retry on Wi-Fi; do NOT cache-break (PRD A18) |
| `ModelConfiguration(id:defaultPrompt:)` won't compile | API drift | Use whatever initializer compiles; keep the HF id string intact |
| Airplane run re-downloads weights | Sandbox cache invalidated | Re-pin bundle id; do not change `CACHES_DIRECTORY` between builds |

## Hard constraints
No Core ML, ExecuTorch, HF Transformers, WebLLM (PRD §19.4). No Python in the iOS app. mlx-swift-lm path only.
