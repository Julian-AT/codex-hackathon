import SwiftUI

struct StatusPill: View {
    @EnvironmentObject var monitor: OnlineMonitor
    @EnvironmentObject var model: ModelState

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(monitor.isOnline ? Color.green : Color.red)
                .frame(width: 10, height: 10)
            Text(monitor.isOnline ? "ONLINE" : "OFFLINE - AIRPLANE MODE")
                .font(.caption.bold())
                .foregroundStyle(monitor.isOnline ? .green : .red)
            Spacer()
            Text(model.currentAdapter)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(Color(.secondarySystemBackground).opacity(0.95))
        )
    }
}
