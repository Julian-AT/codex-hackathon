// AdapterLoaderView.swift — enumerates Documents/adapters/* directories that
// carry a LoRA adapter pair (adapter_config.json + adapters.safetensors),
// offers Load / Unload buttons, shows lastSwapMs and a deterministic probe diff.
//
// Mount into ios/_upstream/Applications/LLMEval/ via Xcode "Add Files to LLMEval".

import SwiftUI

struct AdapterLoaderView: View {
    @EnvironmentObject var model: ModelState
    @State private var timer: Timer? = nil
    @State private var adapters: [URL] = []
    @State private var status: String = ""
    @State private var baseOut: String = ""
    @State private var adapterOut: String = ""
    @State private var probePrompt: String = "Complete: The quick brown fox"

    private let registry = ToolRegistry.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Adapter:").bold()
                Text(model.currentAdapter)
                if model.lastSwapMs > 0 {
                    Text("(\(model.lastSwapMs) ms)")
                        .foregroundColor(model.lastSwapMs < 2000 ? .green : .red)
                }
                Spacer()
                Button("Refresh") { refresh() }
            }
            if adapters.isEmpty {
                Text("No adapter dirs in Documents/adapters/")
                    .font(.caption).foregroundColor(.secondary)
            }
            ForEach(adapters, id: \.self) { dir in
                HStack {
                    Button("Load \(dir.lastPathComponent)") {
                        Task {
                            do {
                                try await model.swapAdapter(directory: dir)
                                let toolCount = try await AdapterToolsLoader.loadAndRegister(
                                    from: dir,
                                    into: registry
                                )
                                status = "Loaded \(dir.lastPathComponent) + \(toolCount) tools in \(model.lastSwapMs) ms"
                            } catch {
                                status = "Load error: \(error.localizedDescription)"
                            }
                        }
                    }
                }
            }
            Button("Unload") {
                Task {
                    do { try await model.unloadAdapter(); status = "Unloaded → base" }
                    catch { status = "Unload error: \(error.localizedDescription)" }
                }
            }

            Divider()
            Text("Probe (temp=0, 32 tokens)").bold()
            TextField("prompt", text: $probePrompt)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Probe → base slot") {
                    Task {
                        do { baseOut = try await model.probe(prompt: probePrompt) }
                        catch { status = "Probe error: \(error.localizedDescription)" }
                    }
                }
                Button("Probe → adapter slot") {
                    Task {
                        do { adapterOut = try await model.probe(prompt: probePrompt) }
                        catch { status = "Probe error: \(error.localizedDescription)" }
                    }
                }
            }
            Text("base:    \(baseOut)").font(.caption).lineLimit(3)
            Text("adapter: \(adapterOut)").font(.caption).lineLimit(3)
            Text(baseOut.isEmpty || adapterOut.isEmpty
                 ? "Run both probes"
                 : (baseOut == adapterOut
                    ? "⚠️ probe_differs=NO — FND-08 KILL-POINT"
                    : "✓ probe_differs=YES — FND-08 PASS"))
                .font(.caption).bold()

            Text(status).font(.caption).foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .task {
            refresh()
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
                Task { @MainActor in refresh() }
            }
        }
        .onDisappear {
            timer?.invalidate()
            timer = nil
        }
    }

    private func refresh() {
        let fm = FileManager.default
        let docs = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let adaptersRoot = docs.appending(component: "adapters")
        let entries = (try? fm.contentsOfDirectory(at: adaptersRoot,
                                                   includingPropertiesForKeys: [.isDirectoryKey])) ?? []
        let nextAdapters = entries.filter { url in
            var isDir: ObjCBool = false
            let path = url.path
            guard fm.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue else { return false }
            let w = url.appending(component: "adapters.safetensors").path
            let c = url.appending(component: "adapter_config.json").path
            return fm.fileExists(atPath: w) && fm.fileExists(atPath: c)
        }
        if nextAdapters.count > adapters.count {
            status = "New adapter detected"
        }
        adapters = nextAdapters
    }
}
