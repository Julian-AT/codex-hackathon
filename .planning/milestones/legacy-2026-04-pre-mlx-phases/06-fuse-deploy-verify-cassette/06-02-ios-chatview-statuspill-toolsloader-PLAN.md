---
phase: 6
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - ios/SpecialistApp/ChatView.swift
  - ios/SpecialistApp/StatusPill.swift
  - ios/SpecialistApp/AdapterLoaderView.swift
  - ios/SpecialistApp/AdapterToolsLoader.swift
  - ios/SpecialistApp/DynamicTool.swift
autonomous: true
requirements: [TRN-07, DEV-01, DEV-02, DEV-03, DEV-04, DEV-05]
---

<objective>
Complete the iOS demo app: ChatView with user/assistant/tool-call messages, OnlineMonitor status pill, file watcher for auto-detect adapters, and adapter-tools.json loader that re-registers tools into ToolRegistry on every swap.
</objective>

<tasks>

<task id="1" type="execute">
<title>Create ChatView.swift</title>
<read_first>
- ios/SpecialistApp/ModelState.swift
- ios/SpecialistApp/GemmaToolParser.swift
- ios/SpecialistApp/ToolRegistry.swift
- ios/SpecialistApp/OnlineMonitor.swift
</read_first>
<files>ios/SpecialistApp/ChatView.swift</files>
<action>
Create `ios/SpecialistApp/ChatView.swift` — SwiftUI chat interface for the demo.

Message model:
```swift
enum ChatRole { case user, assistant, toolCall }
struct ChatMessage: Identifiable {
    let id = UUID()
    let role: ChatRole
    let content: String
    var toolName: String? = nil
    var toolArgs: String? = nil
    var toolResult: String? = nil
}
```

ChatView:
- `@EnvironmentObject var model: ModelState`
- `@EnvironmentObject var monitor: OnlineMonitor`
- `@State var messages: [ChatMessage] = []`
- `@State var input: String = ""`
- `@State var isGenerating: Bool = false`
- Access a shared `ToolRegistry` instance (passed via environment or singleton)

Layout:
- ScrollView of messages with ScrollViewReader for auto-scroll
- Each message styled by role:
  - `.user`: right-aligned, blue background, white text
  - `.assistant`: left-aligned, gray background
  - `.toolCall`: left-aligned, orange/amber background, shows tool name + collapsed args + result
- TextField + Send button at bottom
- StatusPill at top (from StatusPill.swift)

Send action:
1. Append user message
2. Set isGenerating = true
3. Call `model.generateWithTools(prompt:registry:isOnline:)`
4. Parse result: append assistant message; for each tool call, append a `.toolCall` message with name/args/result
5. Set isGenerating = false

Use `Task { @MainActor in ... }` for async work.
</action>
<acceptance_criteria>
- `ios/SpecialistApp/ChatView.swift` exists
- File contains `struct ChatView: View`
- File contains `enum ChatRole`
- File contains `generateWithTools` call
- File contains `.toolCall` rendering with toolName display
</acceptance_criteria>
</task>

<task id="2" type="execute">
<title>Create StatusPill.swift</title>
<read_first>
- ios/SpecialistApp/OnlineMonitor.swift
</read_first>
<files>ios/SpecialistApp/StatusPill.swift</files>
<action>
Create `ios/SpecialistApp/StatusPill.swift`:

```swift
import SwiftUI

struct StatusPill: View {
    @EnvironmentObject var monitor: OnlineMonitor
    @EnvironmentObject var model: ModelState

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(monitor.isOnline ? Color.green : Color.red)
                .frame(width: 10, height: 10)
            Text(monitor.isOnline ? "ONLINE" : "OFFLINE — AIRPLANE MODE")
                .font(.caption).bold()
                .foregroundColor(monitor.isOnline ? .green : .red)
            Spacer()
            Text(model.currentAdapter)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.systemBackground).opacity(0.95))
    }
}
```

The pill shows:
- Green dot + "ONLINE" when network available
- Red dot + "OFFLINE — AIRPLANE MODE" when airplane mode on
- Current adapter name on the right
</action>
<acceptance_criteria>
- `ios/SpecialistApp/StatusPill.swift` exists
- Contains `OFFLINE — AIRPLANE MODE` string literal
- Contains green/red Circle based on `monitor.isOnline`
- Shows `model.currentAdapter`
</acceptance_criteria>
</task>

<task id="3" type="execute">
<title>Create AdapterToolsLoader.swift</title>
<read_first>
- ios/SpecialistApp/DynamicTool.swift
- ios/SpecialistApp/ToolRegistry.swift
</read_first>
<files>ios/SpecialistApp/AdapterToolsLoader.swift</files>
<action>
Create `ios/SpecialistApp/AdapterToolsLoader.swift`:

A utility that reads `adapter-tools.json` from an adapter directory and registers all tools into ToolRegistry.

```swift
import Foundation

struct AdapterToolsLoader {
    static func loadAndRegister(
        from adapterDir: URL,
        into registry: ToolRegistry
    ) async throws -> Int {
        let toolsFile = adapterDir.appending(component: "adapter-tools.json")
        let data = try Data(contentsOf: toolsFile)
        let tools = try JSONDecoder().decode([DynamicTool].self, from: data)
        // Clear previous tools
        for existing in await registry.list() {
            await registry.unregister(name: existing.name)
        }
        // Register new tools
        for tool in tools {
            await registry.register(tool)
        }
        return tools.count
    }
}
```

DynamicTool must be Codable. Check DynamicTool.swift — if it's not Codable, add `Codable` conformance. DynamicTool fields: `name: String`, `description: String`, `schema: [String: Any]` (use AnyCodable or raw JSON string), `body: String`, `requiresNetwork: Bool`.

If DynamicTool uses `[String: Any]` for schema, store schema as a raw JSON String instead for Codable compat, or use a custom decoder.
</action>
<acceptance_criteria>
- `ios/SpecialistApp/AdapterToolsLoader.swift` exists
- Contains `adapter-tools.json` file read
- Contains `registry.register(tool)` call
- Contains `registry.unregister` to clear previous tools
</acceptance_criteria>
</task>

<task id="4" type="execute">
<title>Add file watcher to AdapterLoaderView</title>
<read_first>
- ios/SpecialistApp/AdapterLoaderView.swift
</read_first>
<files>ios/SpecialistApp/AdapterLoaderView.swift</files>
<action>
Add a simple timer-based file watcher to AdapterLoaderView (DispatchSource file descriptors don't work well for directory monitoring on iOS; use a 2-second Timer instead):

1. Add `@State private var timer: Timer? = nil`
2. In `.task { }` modifier, start a repeating Timer:
```swift
timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
    Task { @MainActor in refresh() }
}
```
3. In `.onDisappear`, invalidate timer
4. When `refresh()` detects a new adapter not previously in the list, show a brief "New adapter detected" status

Also integrate AdapterToolsLoader: after a successful `model.swapAdapter(directory:)`, call:
```swift
let toolCount = try await AdapterToolsLoader.loadAndRegister(from: dir, into: registry)
status = "Loaded \(dir.lastPathComponent) + \(toolCount) tools in \(model.lastSwapMs) ms"
```

This requires passing `registry: ToolRegistry` into AdapterLoaderView (add as an init param or environment).
</action>
<acceptance_criteria>
- AdapterLoaderView.swift contains `Timer.scheduledTimer`
- AdapterLoaderView.swift contains `AdapterToolsLoader.loadAndRegister`
- Timer interval is 2.0 seconds
</acceptance_criteria>
</task>

</tasks>

<verification>
- All 4 Swift files exist in ios/SpecialistApp/
- ChatView contains message rendering for user/assistant/toolCall roles
- StatusPill shows ONLINE/OFFLINE text
- AdapterToolsLoader reads adapter-tools.json and registers into ToolRegistry
- AdapterLoaderView has timer-based file watching
</verification>

<success_criteria>
- iOS app has a full chat interface (DEV-03)
- Status pill always visible showing online/offline state (DEV-04)
- Adapter-tools.json re-registered on every adapter swap (DEV-02)
- File watcher auto-detects new adapters (TRN-07)
- Offline enforcement works via existing ToolRegistry + OnlineMonitor (DEV-05)
- ModelState already handles base init + runtime swap (DEV-01)
</success_criteria>

<must_haves>
- TRN-07: Auto-detect new adapter files on device
- DEV-01: ModelState one-time init + <2s swap (already built in Phase 1)
- DEV-02: adapter-tools.json re-registers tools on swap
- DEV-03: ChatView renders user/assistant/tool-call messages
- DEV-04: Status pill always visible with ONLINE/OFFLINE
- DEV-05: requiresNetwork+offline returns in-band error (already built in Phase 1 ToolRegistry)
</must_haves>
