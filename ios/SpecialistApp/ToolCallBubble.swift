import SwiftUI

struct ToolCallBubble: View {
    let messageContent: String
    let toolName: String
    let toolArgs: String?
    let toolResult: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(messageContent)
                .font(.caption2.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(.orange)

            Text(toolName)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.primary)

            if let args = toolArgs, !args.isEmpty {
                section(title: "Arguments", text: args)
            }

            if let result = toolResult, !result.isEmpty {
                section(title: "Result", text: result)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.orange.opacity(0.18))
        )
    }

    @ViewBuilder
    private func section(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.orange)
            Text(text)
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
