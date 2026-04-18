---
phase: 01-foundation-smoke
plan: 05
type: execute
wave: 3
depends_on: [03, 04]
files_modified:
  - ios/SpecialistApp/SpecialistCore/ToolRegistry.swift
  - ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift
  - ios/SpecialistApp/SpecialistCore/DynamicTool.swift
  - ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift
  - ios/SpecialistApp/SpecialistApp/ContentView.swift
  - ios/SpecialistApp/SpecialistApp/ModelState.swift
  - ios/SpecialistApp/SpecialistAppTests/GemmaToolParserTests.swift
autonomous: false
requirements: [FND-09, FND-10, FND-11]

must_haves:
  truths:
    - "A `ToolRegistry` actor wraps a single `JSContext`, registers `console.log` + `nativeFetch` bridges, and cleans up the context between requests (no leak across requests per PITFALLS P6)."
    - "A `GemmaToolParser` reads streaming decoder output and regex-captures complete `<|tool_call|>...<|tool_response|>` (or `<|tool_call|>` followed by tool result injection) windows; malformed JSON triggers a retry, not a crash."
    - "One hand-written JS tool (e.g., `addNumbers({a,b})`) round-trips end-to-end on device: model emits tool_call → parser catches → `JSContext` executes → result is injected as `<|tool_response|>` → generation continues coherently."
    - "If the round-trip fails (parser cannot reliably catch the token, or JSContext crashes), the FND-11 kill-point triggers and the phase demotes to Tier 3 cassette with static tools."
  artifacts:
    - path: "ios/SpecialistApp/SpecialistCore/ToolRegistry.swift"
      provides: "Actor owning one JSContext per request with nativeFetch + console.log bridges"
      contains: "JSContext"
    - path: "ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift"
      provides: "Streaming parser for <|tool_call|>...<|tool_response|> windows"
      contains: "tool_call"
    - path: "ios/SpecialistApp/SpecialistCore/DynamicTool.swift"
      provides: "Struct: name, description, schema, jsBody, requiresNetwork"
    - path: "ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift"
      provides: "NWPathMonitor wrapper for requiresNetwork gating (Phase 6 extends this)"
  key_links:
    - from: "ModelState.generate"
      to: "GemmaToolParser + ToolRegistry"
      via: "stream interceptor pipeline"
      pattern: "parser\\.ingest|registry\\.dispatch"
    - from: "ToolRegistry.dispatch"
      to: "JSContext.evaluateScript"
      via: "JSValue.call(withArguments:)"
      pattern: "evaluateScript|JSValue"
---

<objective>
Complete the Phase 1 foundation by proving the dynamic-tool round-trip works end-to-end on device: Gemma 4 emits `<|tool_call|>` → Swift parser captures it → `JSContext` executes a hand-written JS body → result is injected as `<|tool_response|>` → generation continues.

Purpose: FND-11 is the third kill-point. If this round-trip fails, the dynamic-tool story collapses and the demo demotes to Tier 3 cassette — pre-record without live tool-call beat. This plan also scaffolds `ToolRegistry`, `DynamicTool`, and `OnlineMonitor` types that Phase 6 will extend.
Output: A physical iPhone 17 generating a coherent answer that embeds a tool call invoking agent-written JS.
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
@.planning/research/PITFALLS.md
@.planning/phases/01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md

<interfaces>
Preconditions:
- Plan 01-03 delivered a working iPhone SpecialistApp with `ModelState` (base weights resident, airplane-mode sanity verified).
- This plan does NOT require an adapter — the hand-written JS tool test runs against the UNMODIFIED E4B base. PRD §14 H2: "Force the unmodified E4B to emit a `<|tool_call|>` token by constructing a prompt with a tool definition in context."

Gemma 4 tool tokens (PRD §5.2, §5.4):
- `<|tool>` — tool definition marker
- `<|tool_call|>` — start of a tool call
- `<|tool_response|>` — start of the tool's response (injected back by the parser)
- These ship as dedicated tokens in the Gemma 4 tokenizer. Do NOT rely on text-level matches of these strings alone — verify the tokenizer encodes each as a single token id (PITFALLS P1).

JSContext (Apple):
- `JSContext().evaluateScript(body)` loads the JS function body.
- `JSContext.objectForKeyedSubscript("functionName").call(withArguments: [args])` invokes.
- Native bridging: `setObject(_:forKeyedSubscript:)` with a Swift `@objc` class conforming to `JSExport` — register `console.log`, `nativeFetch`, `Date.now`.

Hand-written smoke tool (this plan's round-trip target):
```js
// addNumbers({a, b}) -> {sum}
function addNumbers(args) {
  return { sum: args.a + args.b };
}
```
Schema: `{ type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a","b"] }`
`requiresNetwork: false`.

KILL-POINT (FND-11):
- Parser cannot reliably capture `<|tool_call|>` on 3 separate prompts → demote to Tier 3 cassette — pre-record without live tool-call beat.
- JSContext crashes/OOMs on repeated round-trip → same fallback.
- Document the failure class in the plan SUMMARY.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: DynamicTool + OnlineMonitor + ToolRegistry actor with JSContext bridges</name>
  <files>
    ios/SpecialistApp/SpecialistCore/DynamicTool.swift, ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift, ios/SpecialistApp/SpecialistCore/ToolRegistry.swift
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §8.2 items 3, 4; §8.4 (offline enforcement); §9.1 (what a tool is)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P6 JSContext retain, P17 NWPathMonitor lag)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (hard constraint A06 — no E2B, only JSContext on device)
  </read_first>
  <action>
    1. `ios/SpecialistApp/SpecialistCore/DynamicTool.swift`:
       ```swift
       import Foundation

       struct DynamicTool: Codable, Identifiable {
           let name: String
           let description: String
           let schema: [String: AnyCodable]       // JSON Schema
           let jsBody: String                      // JS function body as a string
           let requiresNetwork: Bool
           var id: String { name }
       }

       // Minimal AnyCodable for JSON-in-Swift. Plan 03 (Phase 3) may replace with a richer type.
       struct AnyCodable: Codable {
           let value: Any
           init(_ v: Any) { value = v }
           init(from decoder: Decoder) throws {
               let c = try decoder.singleValueContainer()
               if let s = try? c.decode(String.self) { value = s; return }
               if let d = try? c.decode(Double.self) { value = d; return }
               if let b = try? c.decode(Bool.self) { value = b; return }
               if let a = try? c.decode([AnyCodable].self) { value = a.map { $0.value }; return }
               if let o = try? c.decode([String: AnyCodable].self) { value = o.mapValues { $0.value }; return }
               value = NSNull()
           }
           func encode(to encoder: Encoder) throws {
               var c = encoder.singleValueContainer()
               switch value {
               case let s as String: try c.encode(s)
               case let d as Double: try c.encode(d)
               case let i as Int: try c.encode(i)
               case let b as Bool: try c.encode(b)
               default: try c.encodeNil()
               }
           }
       }
       ```

    2. `ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift`:
       ```swift
       import Network
       import Combine

       @MainActor
       final class OnlineMonitor: ObservableObject {
           @Published private(set) var isOnline: Bool = false  // default-closed per PITFALLS P17
           private let monitor = NWPathMonitor()
           private let queue = DispatchQueue(label: "OnlineMonitor")

           init() {
               monitor.pathUpdateHandler = { [weak self] path in
                   let online = path.status == .satisfied
                   Task { @MainActor in self?.isOnline = online }
               }
               monitor.start(queue: queue)
           }
       }
       ```

    3. `ios/SpecialistApp/SpecialistCore/ToolRegistry.swift`:
       ```swift
       import Foundation
       import JavaScriptCore

       actor ToolRegistry {
           private var tools: [String: DynamicTool] = [:]
           private weak var onlineMonitor: OnlineMonitor?

           init(onlineMonitor: OnlineMonitor? = nil) {
               self.onlineMonitor = onlineMonitor
           }

           func register(_ tool: DynamicTool) { tools[tool.name] = tool }
           func registerAll(_ list: [DynamicTool]) { list.forEach { tools[$0.name] = $0 } }
           func reset() { tools.removeAll() }

           /// Dispatch a tool call. PRD §8.4: requiresNetwork + offline → in-band error payload.
           /// Uses a FRESH JSContext per request to guarantee no cross-request leaks (PITFALLS P6).
           func dispatch(name: String, argumentsJSON: String) async -> String {
               guard let tool = tools[name] else {
                   return #"{"error":"tool not found: \#(name)"}"#
               }
               if tool.requiresNetwork {
                   let online = await MainActor.run { onlineMonitor?.isOnline ?? false }
                   if !online {
                       return #"{"error":"This tool requires network. Device is offline."}"#
                   }
               }
               let ctx = JSContext()!
               // console.log bridge
               let consoleLog: @convention(block) (String) -> Void = { msg in
                   print("[JS] \(msg)")
               }
               let console = JSValue(newObjectIn: ctx)!
               console.setObject(consoleLog, forKeyedSubscript: "log" as NSString)
               ctx.setObject(console, forKeyedSubscript: "console" as NSString)
               // nativeFetch bridge — stub for now; real impl in Phase 6
               let nativeFetch: @convention(block) (String) -> String = { _ in
                   #"{"error":"nativeFetch not implemented in H2"}"#
               }
               ctx.setObject(nativeFetch, forKeyedSubscript: "nativeFetch" as NSString)
               // Evaluate tool body + invoke
               let script = """
               \(tool.jsBody)
               JSON.stringify(\(tool.name)(\(argumentsJSON)))
               """
               guard let result = ctx.evaluateScript(script)?.toString() else {
                   return #"{"error":"JSContext returned nil"}"#
               }
               return result
           }
       }
       ```
       IMPORTANT: a fresh `JSContext()` per request ensures no retain cycles (PITFALLS P6). Do NOT cache contexts across requests in this plan; Phase 6 may optimize if needed.

    4. Build the Xcode target for iOS device. Confirm compile clean.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && grep -l "JSContext" ios/SpecialistApp/SpecialistCore/ToolRegistry.swift && grep -l "NWPathMonitor" ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift && grep -l "requiresNetwork" ios/SpecialistApp/SpecialistCore/DynamicTool.swift && xcodebuild -project ios/SpecialistApp/SpecialistApp.xcodeproj -scheme SpecialistApp -destination 'generic/platform=iOS' -configuration Debug build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "actor ToolRegistry" ios/SpecialistApp/SpecialistCore/ToolRegistry.swift` succeeds.
    - `grep "JSContext()" ios/SpecialistApp/SpecialistCore/ToolRegistry.swift` succeeds (fresh context per request per P6).
    - `grep "requiresNetwork" ios/SpecialistApp/SpecialistCore/ToolRegistry.swift` succeeds (offline-gate path present).
    - `grep "isOnline: Bool = false" ios/SpecialistApp/SpecialistCore/OnlineMonitor.swift` succeeds (default-closed per P17).
    - Xcode build for generic iOS device exits 0.
  </acceptance_criteria>
  <done>FND-09 scaffolded: `ToolRegistry` actor compiles, `JSContext` is fresh per request, offline gating wired to `OnlineMonitor`.</done>
</task>

<task type="auto">
  <name>Task 2: GemmaToolParser with regex capture + malformed-retry; unit test</name>
  <files>
    ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift, ios/SpecialistApp/SpecialistAppTests/GemmaToolParserTests.swift
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §5.4 (tool-token format drift mitigations), §8.2 item 3 (parser)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P1 tokenizer split)
  </read_first>
  <action>
    1. `ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift`:
       ```swift
       import Foundation

       /// Streaming parser for Gemma 4 tool-call windows.
       /// Gemma 4 emits `<|tool_call|>` then a JSON object {"name":"...", "arguments":{...}} then `<|tool_response|>`
       /// (or EOS and we inject a <|tool_response|> ourselves). This parser buffers until it sees a complete
       /// JSON object after `<|tool_call|>`, dispatches via a callback, and injects the response string back.
       final class GemmaToolParser {
           struct ToolCall { let name: String; let argumentsJSON: String }
           enum Event {
               case text(String)
               case toolCall(ToolCall)
               case malformed(String)
           }

           private var buffer = ""
           private let openTag = "<|tool_call|>"
           private let closeTag = "<|tool_response|>"

           /// Feed a new streaming chunk. Returns events emitted (possibly multiple).
           func ingest(_ chunk: String) -> [Event] {
               buffer += chunk
               var events: [Event] = []
               while let openRange = buffer.range(of: openTag) {
                   let pre = String(buffer[..<openRange.lowerBound])
                   if !pre.isEmpty { events.append(.text(pre)) }
                   let afterOpen = buffer[openRange.upperBound...]
                   // Try to find closing tag OR end-of-json-object
                   if let closeRange = afterOpen.range(of: closeTag) {
                       let jsonSlice = String(afterOpen[..<closeRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                       if let call = parseToolCall(jsonSlice) {
                           events.append(.toolCall(call))
                       } else {
                           events.append(.malformed(jsonSlice))
                       }
                       buffer = String(afterOpen[closeRange.upperBound...])
                       continue
                   }
                   // No close tag yet — try balanced-brace extraction in the buffered JSON
                   if let (call, consumed) = tryBalancedExtract(String(afterOpen)) {
                       events.append(.toolCall(call))
                       let remainder = String(afterOpen.dropFirst(consumed))
                       buffer = remainder
                       continue
                   }
                   // Not enough data yet — stop
                   return events
               }
               // No open tag in buffer — flush as text if no partial open-tag suffix
               if !buffer.hasSuffix("<") && !buffer.hasSuffix("<|") && !buffer.hasSuffix("<|t") {
                   events.append(.text(buffer))
                   buffer.removeAll()
               }
               return events
           }

           /// Inject a tool response back into the stream position (caller appends to continuation prompt).
           func responseEnvelope(_ json: String) -> String {
               "\(closeTag)\(json)\(closeTag)"
           }

           private func parseToolCall(_ s: String) -> ToolCall? {
               guard let data = s.data(using: .utf8),
                     let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                     let name = obj["name"] as? String else { return nil }
               let args = obj["arguments"] ?? [:]
               let argsData = (try? JSONSerialization.data(withJSONObject: args)) ?? Data("{}".utf8)
               return ToolCall(name: name, argumentsJSON: String(data: argsData, encoding: .utf8) ?? "{}")
           }

           private func tryBalancedExtract(_ s: String) -> (ToolCall, Int)? {
               var depth = 0; var started = false; var end: String.Index?
               for i in s.indices {
                   let c = s[i]
                   if c == "{" { depth += 1; started = true }
                   if c == "}" { depth -= 1; if started && depth == 0 { end = s.index(after: i); break } }
               }
               guard let e = end else { return nil }
               let jsonSlice = String(s[..<e])
               guard let call = parseToolCall(jsonSlice) else { return nil }
               return (call, jsonSlice.count)
           }
       }
       ```

    2. `ios/SpecialistApp/SpecialistAppTests/GemmaToolParserTests.swift`:
       ```swift
       import XCTest
       @testable import SpecialistApp

       final class GemmaToolParserTests: XCTestCase {
           func testSingleCall_withCloseTag() {
               let p = GemmaToolParser()
               let events = p.ingest("I will add. <|tool_call|>{\"name\":\"addNumbers\",\"arguments\":{\"a\":2,\"b\":3}}<|tool_response|>")
               XCTAssertTrue(events.contains { if case .text(let t) = $0 { return t.contains("add") } else { return false } })
               XCTAssertTrue(events.contains { if case .toolCall(let c) = $0 { return c.name == "addNumbers" } else { return false } })
           }
           func testBalancedBraces_noCloseTag() {
               let p = GemmaToolParser()
               let events = p.ingest("<|tool_call|>{\"name\":\"addNumbers\",\"arguments\":{\"a\":1,\"b\":2}}")
               XCTAssertTrue(events.contains { if case .toolCall(let c) = $0 { return c.name == "addNumbers" } else { return false } })
           }
           func testMalformed_emitsMalformed() {
               let p = GemmaToolParser()
               let events = p.ingest("<|tool_call|>{\"name\":}<|tool_response|>")
               XCTAssertTrue(events.contains { if case .malformed = $0 { return true } else { return false } })
           }
           func testStreamingChunks_reassemble() {
               let p = GemmaToolParser()
               _ = p.ingest("<|tool_call|>{\"name\":\"x\",")
               let events = p.ingest("\"arguments\":{}}<|tool_response|>")
               XCTAssertTrue(events.contains { if case .toolCall(let c) = $0 { return c.name == "x" } else { return false } })
           }
       }
       ```

    3. Run `xcodebuild test` against the simulator to confirm parser tests pass.

    4. Tokenizer sanity: (PITFALLS P1) add a one-shot test asserting the base tokenizer encodes `<|tool_call|>` as a SINGLE token id. If it splits into multiple ids, the parser still works (text-level capture) but downstream Phase 4 data-gen must be advised. Log the finding in the plan SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && xcodebuild test -project ios/SpecialistApp/SpecialistApp.xcodeproj -scheme SpecialistApp -destination 'platform=iOS Simulator,name=iPhone 17' 2>&1 | tail -30 | grep -E "(Test Case|PASS|FAIL|Executed)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep 'func ingest' ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift` succeeds.
    - `grep '"<|tool_call|>"' ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift` succeeds.
    - `grep '.malformed' ios/SpecialistApp/SpecialistCore/GemmaToolParser.swift` succeeds (retry path exists).
    - All 4 parser unit tests pass in the simulator.
  </acceptance_criteria>
  <done>FND-10 complete: parser captures `<|tool_call|>...<|tool_response|>`, rejects malformed, reassembles chunked streams.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: End-to-end JS tool round-trip on device (FND-11 kill-point)</name>
  <files>
    ios/SpecialistApp/SpecialistApp/ModelState.swift, ios/SpecialistApp/SpecialistApp/ContentView.swift
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §14 H2 (JSContext + Gemma tool-token parser), §8.2
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P1, P6)
  </read_first>
  <action>
    Wire `GemmaToolParser` + `ToolRegistry` into `ModelState.generate` and prove a round-trip with an unmodified base Gemma 4.

    1. Register a hand-written `addNumbers` `DynamicTool` into `ToolRegistry` at app init (in `SpecialistApp.swift` or `ContentView.onAppear`):
       ```swift
       Task {
           await toolRegistry.register(DynamicTool(
             name: "addNumbers",
             description: "Adds two numbers.",
             schema: [:],  // minimal; real schema in Phase 3
             jsBody: "function addNumbers(args) { return { sum: args.a + args.b }; }",
             requiresNetwork: false
           ))
       }
       ```

    2. Modify `ModelState.generate` to thread streaming decoder chunks through `GemmaToolParser`. When a `.toolCall` event fires:
       - Call `await registry.dispatch(name:, argumentsJSON:)`.
       - Wrap the result in `<|tool_response|>…<|tool_response|>` via `parser.responseEnvelope(result)`.
       - Feed the envelope back into the model's continuation prompt and resume decoding.

       Pseudocode (exact mlx-swift-lm API must match upstream `LLMEval` continuation pattern):
       ```swift
       let parser = GemmaToolParser()
       var collected = ""
       for await tok in stream {
           if case .chunk(let text) = tok {
               for ev in parser.ingest(text) {
                   switch ev {
                   case .text(let t): collected += t
                   case .toolCall(let call):
                       let result = await registry.dispatch(name: call.name, argumentsJSON: call.argumentsJSON)
                       collected += parser.responseEnvelope(result)
                       // Re-prompt model with collected so far; upstream LLMEval exposes a continuation API
                       try await continueGeneration(with: collected)
                   case .malformed(let s):
                       print("[parser] malformed tool_call: \(s) — retrying")
                       // Retry = ask model to regenerate the last call (single attempt)
                   }
               }
           }
       }
       ```
       If mlx-swift-lm 3.x does not expose a continuation primitive cleanly, fall back to prompt-concat-and-generate-twice (documented acceptable pattern per PRD §8.2 #3).

    3. Prompt the unmodified E4B with a template that forces a tool call (PRD §14 H2: "construct a prompt with a tool definition in context"):
       ```
       System: You have access to the tool `addNumbers(a: number, b: number) -> {sum}`.
               When the user asks for arithmetic, you MUST call it using <|tool_call|>{"name":"addNumbers","arguments":{"a":...,"b":...}}<|tool_response|>.
       User: What is 17 plus 25?
       ```

    4. On device, run this prompt. Observe:
       - Parser captures the `<|tool_call|>` window.
       - `ToolRegistry` dispatches to `JSContext` and returns `{"sum":42}`.
       - Parser injects `<|tool_response|>{"sum":42}<|tool_response|>`.
       - Model emits a coherent final answer using 42.

    5. Run the same prompt 3 times to gauge reliability. If ≥2/3 succeed → FND-11 PASS. If 0–1/3 succeed → KILL-POINT triggered; document failure mode and demote to Tier 3 cassette — pre-record without live tool-call beat per ROADMAP Phase 1 kill-point rules.

    6. HARD CONSTRAINTS: no WebLLM, no transformers.js fallback, no silent cloud offload (A01, A07, A20). If this fails, narrate failure and demote — do not paper over.
  </action>
  <what-built>
    End-to-end tool round-trip on the unmodified E4B base: prompt → stream → `<|tool_call|>` → JSContext → response injected → coherent final answer on the iPhone screen.
  </what-built>
  <how-to-verify>
    1. Run the addNumbers smoke prompt on device 3 times. Record outputs.
    2. For each run, the final assistant message must contain the number `42` (or the correct answer for whatever integers were used) AND show no `<|tool_call|>` leaking into the user-visible text.
    3. Verify in Xcode Console that `[JS]` log lines from the `console.log` bridge appear (proves JSContext executed).
    4. Verify `JSContext` was freed between requests (memory does not monotonically grow across 3 runs — manual Instruments or a simple Memory graph check).
    5. Toggle airplane mode ON and re-run. Because `addNumbers` is `requiresNetwork: false`, it MUST still work — demonstrates the offline gate does not block local tools.
    6. Optionally register a second dummy tool with `requiresNetwork: true` and confirm it returns the offline-error payload (validates OnlineMonitor wiring early for Phase 6).
    7. Record success count out of 3. If ≥ 2/3 → `approved`. Otherwise → kill-point declared.
  </how-to-verify>
  <resume-signal>Type `approved` with line: `roundtrip_success={N}/3 offline_local_works=yes|no verdict={pass|kill-point}`. On kill-point, describe the failure class in one sentence (parser / tokenizer / JSContext / continuation).</resume-signal>
  <acceptance_criteria>
    - Build succeeds for iOS device.
    - Operator confirms ≥ 2/3 successful round-trips with correct arithmetic result.
    - Operator confirms `[JS]` log appeared in Xcode Console.
    - Memory does not grow across 3 successive runs (PITFALLS P6).
    - Airplane-mode run of `addNumbers` (local tool) still succeeds.
    - If kill-point: SUMMARY captures the failure class and links it to the ROADMAP Phase 1 demotion rule (Tier 3 cassette).
  </acceptance_criteria>
  <done>FND-11 kill-point resolved. Phase 1 complete; Phase 2+ may proceed with confidence in the dynamic-tool path.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Model stream → GemmaToolParser | Untrusted text from base model; parser must fail-safe on malformed JSON. |
| Parser → ToolRegistry.dispatch | Untrusted tool name + arguments; registry must only execute registered tools. |
| ToolRegistry → JSContext | Trusted JS body (hand-written in this plan; agent-written in Phase 3 gated by `node:vm` fuzz). JSContext sandboxes; no FS access. |
| JSContext → nativeFetch | Bridged callback; in this plan a stub. Phase 6 implements real URLSession-backed fetch with requiresNetwork gating. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-16 | Tampering | Model emits `<|tool_call|>` with unknown tool name | mitigate | Registry returns `{"error":"tool not found"}` in-band; parser does not crash. |
| T-01-17 | Denial of Service | Malformed JSON in tool_call loops generation | mitigate | Parser emits `.malformed` event; caller retries once then moves on. |
| T-01-18 | Information Disclosure | `console.log` bridge leaks JS-side state to Xcode console | accept | Dev-only; production demo does not surface Xcode console. |
| T-01-19 | Elevation of Privilege | JSContext retains across requests leaks prior tool args | mitigate | Fresh `JSContext()` per dispatch (PITFALLS P6); assert memory does not grow across 3 runs. |
| T-01-20 | Tampering | Agent-written JS body (future) executes malicious ops on device | defer | Out of scope here; Phase 3 `node:vm` fuzz + schema validation gates on the laptop side before any JS body reaches device. |
</threat_model>

<verification>
- Parser unit tests pass.
- iOS build succeeds.
- Operator-verified ≥ 2/3 round-trip on device.
- JSContext fresh-per-request grep confirmed.
- Airplane-mode local-tool run succeeds.
</verification>

<success_criteria>
FND-09 + FND-10 + FND-11 all pass within H2. Phase 1 Foundation & Smoke is complete; the dynamic-tool path is proven end-to-end on the demo hardware.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-smoke/01-05-SUMMARY.md` recording: roundtrip_success (N/3), tokenizer atomicity of `<|tool_call|>` (single id yes/no), JSContext memory stability, verdict (pass|kill-point), and any failure mode if kill-point.
</output>
