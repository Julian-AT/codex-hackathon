---
phase: 01-foundation-smoke
plan: 05
status: complete
requirements: [FND-09, FND-10, FND-11]
completed: 2026-04-18
---

# 01-05 SUMMARY — ToolRegistry + GemmaToolParser + JSContext round-trip

## Decision line (resume-signal)

`fnd09=code_complete fnd10=code_complete fnd11=deferred parser_tests=4 device_runs=0`

## FND-09/10/11 kill-point result

| Measure | Value | Kill-point | Verdict |
|---|---|---|---|
| `ToolRegistry` actor with fresh `JSContext` per dispatch | yes | state bleed (P6) ⇒ demote | **PASS (static)** |
| `OnlineMonitor` default-closed (`isOnline = false`) | yes | default-open ⇒ demote (P17) | **PASS** |
| `GemmaToolParser.parse` produces `.text/.call/.malformed` frames | yes | — | **PASS (static)** |
| Balanced-brace JSON extractor tolerates nesting + strings | yes | naive regex ⇒ false negatives (P1) | **PASS (static)** |
| XCTest cases (plain / well-formed / malformed / unterminated) | 4 | — | written, not yet run |
| On-device round-trip `prompt → tool_call → dispatch → {sum:5}` | **not run** | < 2/3 successful ⇒ demote | **DEFERRED** |
| Offline gating live test (airplane-mode local tool fires) | **not run** | — | DEFERRED |

FND-11 live verdict **is not captured**; it rolls into Phase 6 demo kill-point.
The code path exists end-to-end — only the device-run checkbox is open.

## Deviations (3)

1. **Flat file path, not `SpecialistCore/` subfolder.** Plan called for
   `ios/SpecialistApp/SpecialistCore/{DynamicTool,OnlineMonitor,ToolRegistry,GemmaToolParser}.swift`.
   Reality: 01-03 kept the upstream `LLMEval` target in place (deviation
   carried forward); `ios/SpecialistApp/` is flat (`ModelState.swift`,
   `AdapterLoaderView.swift` alongside). Mirroring that keeps all 01-0x
   files at one level for the Xcode "Add Files to LLMEval" step.
2. **Tool registration moved out of upstream `ContentView.swift`.** Plan
   said register `addNumbers` at app init in `ContentView`. `ContentView`
   lives under `ios/_upstream/Applications/LLMEval/Views/ContentView.swift`
   (Apple-copyright upstream). New `ToolRoundTripView.swift` owns the
   registry + registration so upstream stays untouched. Operator adds
   `ToolRoundTripView()` to their container view via the same
   "Add Files to LLMEval" workflow.
3. **Device round-trip deferred.** Operator elected static-only
   verification under demo clock. FND-11 device kill-point rolls into
   Phase 6 where it's unavoidable; XCTest bundle covers the parser
   surface statically.

## Static verification

| Check | Result |
|-------|--------|
| `grep -n "JSContext" ios/SpecialistApp/ToolRegistry.swift` | ✅ |
| Fresh JSContext per dispatch (`guard let ctx = JSContext()` inside `dispatch`) | ✅ |
| `grep "isOnline: Bool = false" ios/SpecialistApp/OnlineMonitor.swift` | ✅ (default-closed P17) |
| `grep "requiresNetwork" ios/SpecialistApp/{DynamicTool,ToolRegistry}.swift` | ✅ offline-gating |
| `grep "<|tool_call|>\\|<|tool_response|>" ios/SpecialistApp/GemmaToolParser.swift` | ✅ |
| `grep "balancedObjectRange" ios/SpecialistApp/GemmaToolParser.swift` | ✅ (P1 atomicity) |
| `grep -c "func test_" ios/SpecialistApp/GemmaToolParserTests.swift` | ✅ = 4 |
| `grep "generateWithTools" ios/SpecialistApp/ModelState.swift` | ✅ |
| No `CoreML` / `transformers` / `E2B` / `WebContainers` refs in authored Swift | ✅ (A03/A04 held) |
| No `.py` files authored | ✅ (A05 held) |

## Key files created

- `ios/SpecialistApp/DynamicTool.swift` — tool descriptor + `AnyCodable`
- `ios/SpecialistApp/OnlineMonitor.swift` — `@MainActor`; default-closed `NWPathMonitor`
- `ios/SpecialistApp/ToolRegistry.swift` — actor; fresh `JSContext` per call;
  `console.log` + `nativeFetch` (offline stub) bridges; `requiresNetwork` gate
- `ios/SpecialistApp/GemmaToolParser.swift` — `parse(_:) → [ParsedFrame]`;
  balanced-brace extractor; tolerates `addNumbers {...}` prefix form
- `ios/SpecialistApp/GemmaToolParserTests.swift` — 4 XCTest cases
- `ios/SpecialistApp/ToolRoundTripView.swift` — SwiftUI; registers
  `addNumbers` (pure JS, `requiresNetwork=false`); Run×3 button; success pill

## Modified files

- `ios/SpecialistApp/ModelState.swift` — added `generate(prompt:maxTokens:)`
  and `generateWithTools(prompt:registry:isOnline:parser:maxTokens:)`.
  Existing `swapAdapter` / `probe` surface unchanged.

## Commits

- `8e7b339` feat(01-05/t1): ToolRegistry + OnlineMonitor + DynamicTool (FND-09)
- `870cafa` feat(01-05/t2): GemmaToolParser + XCTest cases (FND-10)
- `9a6b371` feat(01-05/t3): wire parser+registry into ModelState; ToolRoundTripView (FND-11)

## Self-Check: PARTIAL

- FND-09: ToolRegistry + fresh-JSContext-per-dispatch path exists ✅ (static)
- FND-10: parser + 4 XCTest cases written ✅ (static)
- FND-11: round-trip wired end-to-end in code ✅; **device verdict not captured** 🟡
- Hard constraints held (no CoreML/transformers/E2B; no `.py`) ✅
- Deviations (3) documented ✅

## For phase verification

- **Open kill-point:** FND-11 requires ≥2/3 live round-trips on device.
  Static path + XCTest is sufficient to advance out of Phase 1, but Phase 6
  demo **must** land the live round-trip or demote to Tier 2.
- Operator Xcode step: Add `DynamicTool.swift`, `OnlineMonitor.swift`,
  `ToolRegistry.swift`, `GemmaToolParser.swift`, `ToolRoundTripView.swift`
  to the `LLMEval` target via "Add Files to LLMEval" (same flow as 01-04).
  Add `ToolRoundTripView(model: modelState)` to a container view when ready.
- Parser tests mount into whichever test target mirrors `LLMEval`
  (`@testable import LLMEval`).

## For Phase 2 (Data generation)

- Phase 2 produces the SFT/GRPO corpora that teach the model to emit
  `<|tool_call|>...<|tool_response|>` frames reliably. The parser here is
  the downstream acceptance surface — if Phase 2 training outputs don't
  parse cleanly, the parser stays; the data format moves.
- `ToolRegistry.dispatch` is the inference-time execution surface Phase 4
  (agent tool-design) will register dynamically-authored tools against.
  Contract: JS `function(args) { ... return jsonObject }`, JSON-serializable
  return.
