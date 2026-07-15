---
phase: 01-foundation-smoke
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - ios/SpecialistApp/SpecialistApp.xcodeproj/project.pbxproj
  - ios/SpecialistApp/SpecialistApp/SpecialistApp.swift
  - ios/SpecialistApp/SpecialistApp/ContentView.swift
  - ios/SpecialistApp/SpecialistApp/ModelConfig.swift
  - ios/SpecialistApp/SpecialistApp/Info.plist
  - ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements
  - scripts/ios-bootstrap.sh
  - scripts/ios-deploy-device.sh
autonomous: false
requirements: [FND-05, FND-06, FND-07]

must_haves:
  truths:
    - "`mlx-swift-examples` is forked (or vendored) into `ios/` with `LLMEval` target renamed to `SpecialistApp`."
    - "`modelConfiguration` is pinned to the Gemma 4 E4B 4-bit MLX Unsloth repo (or E2B if FND-02 kill-point triggered)."
    - "Xcode 16 builds the target for iOS 18 with the `com.apple.developer.kernel.increased-memory-limit` entitlement active."
    - "The app installs on a physical iPhone 17 and completes the one-time ~3 GB base-weight download into its sandbox."
    - "After toggling airplane mode ON on the iPhone, the same prompt re-runs and produces tokens — proving sandbox-resident weights."
  artifacts:
    - path: "ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements"
      provides: "com.apple.developer.kernel.increased-memory-limit = true"
      contains: "increased-memory-limit"
    - path: "ios/SpecialistApp/SpecialistApp/ModelConfig.swift"
      provides: "Pinned modelConfiguration to Gemma 4 E4B (or E2B)"
      contains: "unsloth/gemma-4"
    - path: "scripts/ios-deploy-device.sh"
      provides: "xcrun devicectl install + launch wrapper"
  key_links:
    - from: "ios/SpecialistApp/SpecialistApp/SpecialistApp.swift"
      to: "mlx-swift-lm (MLXLM / MLXLMCommon)"
      via: "SPM import + ModelContainer init"
      pattern: "import MLXLM|ModelContainer"
    - from: "ios/SpecialistApp/SpecialistApp/Info.plist"
      to: "increased memory class"
      via: "UIRequiredDeviceCapabilities + entitlement"
      pattern: "increased-memory-limit"
---

<objective>
Fork the `mlx-swift-examples/LLMEval` target, pin it to Gemma 4 E4B (or E2B), build for iOS 18 with the increased-memory-limit entitlement, deploy to a physical iPhone 17, and confirm airplane-mode inference works off sandbox-resident weights.

Purpose: Produce the on-device base-model platform that plans 01-04 (adapter hot-swap) and 01-05 (JS tool round-trip) extend. Without this plan, nothing runs on device.
Output: A `.ipa` installed on iPhone 17 generating tokens with airplane mode on.
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

<interfaces>
Versions (SUMMARY §2):
- Swift 5.9 / Xcode 16 / iOS 18 minimum deployment target
- `mlx-swift-lm` 3.x — product names `MLXLM`, `MLXLMCommon` (post-April-2026 split; confirm via `Package.swift` in the upstream clone)
- `swift-tokenizers-mlx ≥ 0.1.0`
- `swift-hf-api-mlx ≥ 0.1.0`
- `JavaScriptCore` + `Network` (system frameworks, no SPM)
- Upstream repo: https://github.com/ml-explore/mlx-swift-examples — fork target `LLMEval`

Model pin (read `.env.base` from repo root; default E4B):
- `unsloth/gemma-4-E4B-it-UD-MLX-4bit` (primary)
- `unsloth/gemma-4-E2B-it-UD-MLX-4bit` (if `.env.base` says so per plan 01-02 kill-point)

Entitlement (PRD §8.1 + PITFALLS P8):
- `com.apple.developer.kernel.increased-memory-limit` — BOOL true
- Requires paid Apple Developer account with entitlement provisioned
- Verify active via `os_proc_available_memory()` returning ≥ 5 GB on launch

Airplane-mode sanity (PRD §14 H1):
- First launch: ~3 GB download completes (Wi-Fi on).
- After download, toggle airplane mode ON, re-run prompt, confirm generation still works.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clone/vendor mlx-swift-examples, rename target, pin model + entitlement</name>
  <files>
    scripts/ios-bootstrap.sh, ios/SpecialistApp/SpecialistApp.xcodeproj/project.pbxproj, ios/SpecialistApp/SpecialistApp/SpecialistApp.swift, ios/SpecialistApp/SpecialistApp/ContentView.swift, ios/SpecialistApp/SpecialistApp/ModelConfig.swift, ios/SpecialistApp/SpecialistApp/Info.plist, ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §8.1, §8.2, §14 H0, §14 H1
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/STACK.md (iOS SPM, mlx-swift-lm 3.x product names, entitlement verification)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P6 JSContext retain, P8 entitlement verification)
  </read_first>
  <action>
    1. Write `scripts/ios-bootstrap.sh`:
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       if [ ! -d ios/_upstream ]; then
         git clone --depth 1 https://github.com/ml-explore/mlx-swift-examples ios/_upstream
       fi
       mkdir -p ios/SpecialistApp
       # Copy LLMEval as SpecialistApp base. Preserve upstream as reference.
       rsync -a --delete --exclude=".git" ios/_upstream/Applications/LLMEval/ ios/SpecialistApp/
       echo "Bootstrapped. Open ios/SpecialistApp/SpecialistApp.xcodeproj in Xcode 16."
       ```
       Run this script. After rsync, rename the Xcode project directory/target to `SpecialistApp` (operator may do this via Xcode GUI during Task 2 checkpoint if easier).

    2. Write `ios/SpecialistApp/SpecialistApp/ModelConfig.swift`:
       ```swift
       import Foundation
       import MLXLMCommon

       enum SpecialistModel {
           // Read from Info.plist key "BaseModel"; default to E4B.
           static let modelId: String = {
               Bundle.main.object(forInfoDictionaryKey: "BaseModel") as? String
                 ?? "unsloth/gemma-4-E4B-it-UD-MLX-4bit"
           }()

           static let configuration = ModelConfiguration(
               id: modelId,
               defaultPrompt: "Say hello in one word."
           )
       }
       ```
       If `mlx-swift-lm` 3.x uses a different `ModelConfiguration` initializer, match the upstream `LLMEval` file's exact shape (this code replaces it).

    3. Edit `ios/SpecialistApp/SpecialistApp/Info.plist`. Set the following keys:
       - `BaseModel` = `$(BASE_MODEL)` (default E4B; overridable via xcconfig)
       - `UIRequiredDeviceCapabilities` → ensure array contains `arm64`
       - Add `MinimumOSVersion` = `18.0`

    4. Write `ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements` (XML plist):
       ```xml
       <?xml version="1.0" encoding="UTF-8"?>
       <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
       <plist version="1.0">
         <dict>
           <key>com.apple.developer.kernel.increased-memory-limit</key>
           <true/>
         </dict>
       </plist>
       ```
       Update `project.pbxproj` to reference this entitlements file on the SpecialistApp target (`CODE_SIGN_ENTITLEMENTS = SpecialistApp/SpecialistApp.entitlements;`). Set deployment target `IPHONEOS_DEPLOYMENT_TARGET = 18.0` and `SWIFT_VERSION = 5.9`.

    5. Minimally modify `SpecialistApp.swift` (or upstream equivalent) to log `os_proc_available_memory()` on launch per PITFALLS P8:
       ```swift
       import SwiftUI
       import os

       @main
       struct SpecialistApp: App {
           init() {
               let avail = os_proc_available_memory()
               print("[boot] os_proc_available_memory = \(avail / (1024*1024)) MB")
               // Assert ≥ 5 GB when entitlement is active; log but do not crash.
               if avail < 5 * 1024 * 1024 * 1024 {
                   print("[boot] WARN: increased-memory-limit entitlement may not be active")
               }
           }
           var body: some Scene { WindowGroup { ContentView() } }
       }
       ```

    6. `ContentView.swift` — keep the upstream `LLMEval` chat UI; change title to "SpecialistApp" and the model reference to `SpecialistModel.configuration`. No new features in this task.

    7. HARD CONSTRAINTS: Do NOT add any Core ML, ExecuTorch, or HF Transformers dependency (A03, A04). Do NOT add any WebLLM / transformers.js bridge (A01). The ONLY inference stack is `mlx-swift-lm` 3.x.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && bash scripts/ios-bootstrap.sh 2>&1 | tail -10 && ls ios/SpecialistApp/SpecialistApp/ && grep -R "unsloth/gemma-4" ios/SpecialistApp/SpecialistApp/ModelConfig.swift && grep -R "increased-memory-limit" ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements && xcodebuild -project ios/SpecialistApp/SpecialistApp.xcodeproj -scheme SpecialistApp -destination 'generic/platform=iOS' -configuration Debug build 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `ios/_upstream` exists (cloned mlx-swift-examples) and `ios/SpecialistApp/` exists.
    - `grep -E "unsloth/gemma-4-E[24]B-it-UD-MLX-4bit" ios/SpecialistApp/SpecialistApp/ModelConfig.swift` succeeds.
    - `grep "com.apple.developer.kernel.increased-memory-limit" ios/SpecialistApp/SpecialistApp/SpecialistApp.entitlements` succeeds.
    - `grep "IPHONEOS_DEPLOYMENT_TARGET = 18" ios/SpecialistApp/SpecialistApp.xcodeproj/project.pbxproj` succeeds.
    - `xcodebuild -scheme SpecialistApp ... build` exits 0 for a generic iOS device destination.
    - No `.swift` file references `CoreML`, `MLModel`, `transformers`, or `WebGPU` (grep verifies; these are hard-constraint violations).
  </acceptance_criteria>
  <done>FND-05 complete: forked project builds for iOS 18 with the entitlement active.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Deploy to iPhone 17, complete base-weight download, airplane-mode sanity</name>
  <files>
    scripts/ios-deploy-device.sh, data/state/ios-device.json
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §14 H1, §8.5 (proving offline on stage)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P5 devicectl silent copy, P7 USB-C mirror, P8 entitlement)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/SUMMARY.md §7 (verify-at-H0 #5 base model pre-fetch)
  </read_first>
  <action>
    Operator-assisted: device must be physically connected via USB-C and "Trust This Computer" confirmed BEFORE airplane mode.

    1. Write `scripts/ios-deploy-device.sh`:
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       # 1. List devices
       xcrun devicectl list devices
       UDID=${IPHONE_UDID:-$(xcrun devicectl list devices --json-output - 2>/dev/null | jq -r '.result.devices[0].hardwareProperties.udid' 2>/dev/null || echo "")}
       if [ -z "$UDID" ]; then
         echo "ERROR: set IPHONE_UDID env var to the target iPhone UDID from the list above"
         exit 1
       fi
       echo "Target UDID: $UDID"
       # 2. Build + install archive via xcodebuild + devicectl
       xcodebuild -project ios/SpecialistApp/SpecialistApp.xcodeproj \
         -scheme SpecialistApp \
         -destination "id=$UDID" \
         -configuration Debug \
         -derivedDataPath build/ios \
         build
       APP_PATH=$(find build/ios/Build/Products/Debug-iphoneos -name "SpecialistApp.app" -type d | head -1)
       if [ -z "$APP_PATH" ]; then echo "ERROR: no .app built"; exit 1; fi
       xcrun devicectl device install app --device "$UDID" "$APP_PATH"
       xcrun devicectl device process launch --device "$UDID" com.hackathon.SpecialistApp || true
       mkdir -p data/state
       echo "{\"udid\":\"$UDID\",\"bundle_id\":\"com.hackathon.SpecialistApp\",\"deployed_at\":\"$(date -u +%FT%TZ)\"}" > data/state/ios-device.json
       ```
       Update the bundle id to match whatever is set in the Xcode project. Operator should edit `IPHONE_UDID` and bundle id as needed.

    2. Run the deploy script with Wi-Fi ON and device connected via USB-C (operator confirms "Trust This Computer" dialog if prompted).

    3. On device, launch the app, enter any prompt (e.g., `"hello"`), and wait for the ~3 GB base-weight download to complete. This is a one-time cost — do NOT cancel mid-download (PRD A18: do not cache-break the base model).

    4. After first generation succeeds, toggle airplane mode ON (Control Center, verify airplane icon visible, Wi-Fi/Bluetooth/Cellular all off).

    5. Re-launch the app or re-run the prompt. Confirm tokens still stream from the sandbox-resident weights.

    6. Verify boot-log line `[boot] os_proc_available_memory = ... MB` shows ≥ 5000 MB via Xcode Console or `log stream --predicate 'process == "SpecialistApp"'`. If < 5000 MB, the entitlement is NOT active — operator must confirm entitlement is attached to the provisioning profile (PITFALLS P8).
  </action>
  <what-built>
    A physical iPhone 17 running SpecialistApp with Gemma 4 E4B (or E2B) base weights resident in the app sandbox. Airplane-mode inference verified end-to-end.
  </what-built>
  <how-to-verify>
    1. Confirm `xcrun devicectl list devices` shows the iPhone with state `connected`.
    2. `./scripts/ios-deploy-device.sh` runs to completion; `data/state/ios-device.json` contains the UDID.
    3. App icon appears on iPhone; launching shows the chat UI.
    4. First prompt triggers a download indicator; wait for completion (~3 GB, time depends on Wi-Fi).
    5. Prompt produces at least one full assistant response (tok/s ≥ 30 is acceptable, ≥ 40 is ideal — PRD §2.1).
    6. Toggle airplane mode on iPhone Control Center. Orange airplane icon visible; Wi-Fi/BT/Cellular off.
    7. Same prompt re-run from cold-start generates tokens end-to-end.
    8. Xcode Console (or `log stream`) shows `os_proc_available_memory` ≥ 5000 MB — proving entitlement active.
  </how-to-verify>
  <resume-signal>Type `approved` with line: `device_udid={short} avail_mb={N} airplane_generates=yes base={e4b|e2b}`.</resume-signal>
  <acceptance_criteria>
    - `data/state/ios-device.json` exists with a real UDID (not placeholder).
    - Operator confirms airplane-mode generation visually.
    - `os_proc_available_memory` ≥ 5 GB logged at launch.
    - Base model matches `.env.base` (or E4B default) — consistent with plan 01-02 decision.
  </acceptance_criteria>
  <done>FND-06 + FND-07 complete: iPhone 17 generates tokens from sandbox-resident base weights with airplane mode ON.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Laptop → iPhone (USB-C) | Trust-this-computer handshake; devicectl authenticates via pairing record. |
| iPhone app sandbox → HF Hub | One-time ~3 GB download on first launch; airplane mode must be OFF. |
| App sandbox → network | After base weights cached, all inference is local. Airplane mode enforces this. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-08 | Tampering | Base weight cache invalidation on re-build | mitigate | PRD A18: keep bundle id + cache path stable across builds; do not change `CACHES_DIRECTORY` between runs. |
| T-01-09 | Elevation of Privilege | Missing entitlement → 3 GB process cap | mitigate | Log `os_proc_available_memory` at boot; operator checkpoint verifies ≥ 5 GB. |
| T-01-10 | Denial of Service | USB-C trust fails once airplane mode is on | mitigate | PITFALLS P7: "Trust This Computer" BEFORE airplane-on; pre-flight checklist in Phase 9. |
| T-01-11 | Information Disclosure | Training data (future) resident in sandbox surfaces at inference | accept | Out of scope here; Phase 4 enforces data recipe hygiene (A17). |
</threat_model>

<verification>
- xcodebuild generic-device build exits 0.
- devicectl install + launch succeed.
- Operator-verified airplane-mode generation.
- `os_proc_available_memory` ≥ 5 GB.
</verification>

<success_criteria>
FND-05 + FND-06 + FND-07 all pass within the H0–H1 band. Plans 01-04 and 01-05 inherit a working iPhone app they can extend.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-smoke/01-03-SUMMARY.md` recording: UDID, bundle id, base model pinned, os_proc_available_memory, first-prompt tok/s, airplane-mode verified yes/no.
</output>
