import SwiftUI

enum ChatRole {
    case user
    case assistant
    case toolCall
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: ChatRole
    let content: String
    var toolName: String? = nil
    var toolArgs: String? = nil
    var toolResult: String? = nil
}

struct ChatView: View {
    @EnvironmentObject var model: ModelState
    @EnvironmentObject var monitor: OnlineMonitor

    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var isGenerating = false

    private let registry = ToolRegistry.shared

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Circle()
                    .fill(monitor.isOnline ? .green : .red)
                    .frame(width: 8, height: 8)
                Text(monitor.isOnline ? "Online" : "Offline")
                    .font(.caption)
                Spacer()
                if let adapter = model.currentAdapter {
                    Text(adapter).font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(messages) { message in
                            bubble(for: message)
                                .id(message.id)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                }
                .onChange(of: messages.count) { _, _ in
                    guard let lastId = messages.last?.id else { return }
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Ask the Specialist model", text: $input)
                    .textFieldStyle(.roundedBorder)
                    .disabled(isGenerating)
                Button(isGenerating ? "Running..." : "Send") {
                    Task { await send() }
                }
                .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isGenerating)
            }
        }
        .padding()
    }

    @ViewBuilder
    private func bubble(for message: ChatMessage) -> some View {
        switch message.role {
        case .toolCall:
            VStack(alignment: .leading, spacing: 4) {
                Text(message.toolName ?? "Tool call")
                    .font(.caption.bold())
                if let args = message.toolArgs {
                    Text(args).font(.caption2).foregroundStyle(.secondary)
                }
                if let result = message.toolResult {
                    Text(result).font(.caption2)
                }
            }
            .padding(8)
            .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            standardBubble(for: message)
        }
    }

    @ViewBuilder
    private func standardBubble(for message: ChatMessage) -> some View {
        let alignment: HorizontalAlignment = message.role == .user ? .trailing : .leading
        let fill: Color = message.role == .user ? .blue : Color(.secondarySystemBackground)

        VStack(alignment: alignment, spacing: 4) {
            Text(message.content)
                .foregroundStyle(message.role == .user ? .white : .primary)
                .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
        }
        .padding(12)
        .background(fill, in: RoundedRectangle(cornerRadius: 16))
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }

    @MainActor
    private func send() async {
        let prompt = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }

        messages.append(ChatMessage(role: .user, content: prompt))
        input = ""
        isGenerating = true
        defer { isGenerating = false }

        do {
            let result = try await model.generateWithTools(
                prompt: prompt,
                registry: registry,
                isOnline: monitor.isOnline
            )

            let cleaned = result.raw.trimmingCharacters(in: .whitespacesAndNewlines)
            messages.append(
                ChatMessage(
                    role: .assistant,
                    content: cleaned.isEmpty ? "No assistant text returned." : cleaned
                )
            )

            for (index, call) in result.calls.enumerated() {
                let resultText = index < result.results.count ? result.results[index] : ""
                let argsData = try? JSONSerialization.data(withJSONObject: call.args, options: [.prettyPrinted])
                let argsText = argsData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                messages.append(
                    ChatMessage(
                        role: .toolCall,
                        content: "Tool dispatch",
                        toolName: call.name,
                        toolArgs: argsText,
                        toolResult: resultText
                    )
                )
            }
        } catch {
            messages.append(
                ChatMessage(
                    role: .assistant,
                    content: "Generation failed: \(error.localizedDescription)"
                )
            )
        }
    }
}
