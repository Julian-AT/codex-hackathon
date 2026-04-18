// OnlineMonitor.swift — default-closed network gate (PITFALLS P17).
// `isOnline` starts false; only NWPathMonitor's .satisfied flips it true.
// Mount into upstream LLMEval target via Xcode "Add Files to LLMEval".

import Foundation
import Network

@MainActor
final class OnlineMonitor: ObservableObject {
    @Published private(set) var isOnline: Bool = false   // default-closed (P17)

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "OnlineMonitor")

    init(autoStart: Bool = true) {
        if autoStart { start() }
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = (path.status == .satisfied)
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: queue)
    }

    func stop() {
        monitor.cancel()
    }
}
