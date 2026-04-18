// ToolRoundTripView.swift — FND-11 round-trip smoke UI.
// Registers `addNumbers`, runs a fixed prompt 3 times, parses tool calls,
// dispatches via ToolRegistry (fresh JSContext per dispatch), tallies successes.
// Mount into upstream LLMEval target via Xcode "Add Files to LLMEval".

import SwiftUI
import MLXLMCommon

struct ToolRoundTripView: View {
    @ObservedObject var model: ModelState
    @StateObject private var monitor = OnlineMonitor()
    @State private var registry = ToolRegistry()
    @State private var registered = false
    @State private var successCount = 0
    @State private var totalAttempts = 0
    @State private var lastRaw: String = ""
    @State private var lastResults: [String] = []
    @State private var running = false

    private static let addNumbersBody = """
    function(args) {
        var a = Number(args.a) || 0;
        var b = Number(args.b) || 0;
        return { sum: a + b };
    }
    """

    private static let prompt = """
    Call the addNumbers tool with a=2, b=3. \
    Respond using <|tool_call|>{"name":"addNumbers","args":{"a":2,"b":3}}<|tool_response|>.
    """

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Tool round-trip").font(.headline)
                Spacer()
                Text(monitor.isOnline ? "online" : "offline")
                    .font(.caption).foregroundStyle(.secondary)
                Text("\(successCount)/\(totalAttempts)")
                    .font(.caption.monospacedDigit())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(successCount >= 2 ? .green.opacity(0.25) : .gray.opacity(0.2),
                                in: Capsule())
            }
            HStack {
                Button("Run ×3") { Task { await runThree() } }
                    .disabled(running)
                Button("Reset") {
                    successCount = 0; totalAttempts = 0; lastRaw = ""; lastResults = []
                }
            }
            if !lastRaw.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("raw:").font(.caption.bold())
                        Text(lastRaw).font(.caption.monospaced())
                        Text("results:").font(.caption.bold()).padding(.top, 4)
                        ForEach(lastResults.indices, id: \.self) { i in
                            Text(lastResults[i]).font(.caption.monospaced())
                        }
                    }
                }
                .frame(maxHeight: 160)
            }
        }
        .padding(8)
        .task {
            if !registered {
                await registry.register(DynamicTool(
                    name: "addNumbers",
                    description: "Adds two numbers a + b and returns { sum }.",
                    body: Self.addNumbersBody,
                    requiresNetwork: false
                ))
                registered = true
            }
        }
    }

    private func runThree() async {
        running = true
        defer { running = false }
        for _ in 0..<3 {
            totalAttempts += 1
            do {
                let (raw, calls, results) = try await model.generateWithTools(
                    prompt: Self.prompt,
                    registry: registry,
                    isOnline: monitor.isOnline
                )
                lastRaw = raw
                lastResults = results
                // Success = at least one call that dispatched without ERROR prefix.
                if !calls.isEmpty,
                   let first = results.first,
                   !first.hasPrefix("ERROR") {
                    successCount += 1
                }
            } catch {
                lastRaw = "generate failed: \(error.localizedDescription)"
                lastResults = []
            }
        }
    }
}
