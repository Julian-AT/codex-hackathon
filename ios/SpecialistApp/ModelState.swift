// ModelState.swift — actor owning ModelContainer + adapter hot-swap.
// Mount into ios/_upstream/Applications/LLMEval/ via Xcode "Add Files to LLMEval".
//
// Uses mlx-swift-lm 3.x adapter API (verified in DerivedData):
//   LoRAContainer.from(directory: URL) -> LoRAContainer
//   try model.load(adapter: LoRAContainer)
//   model.unload(adapter: LoRAContainer)

import Foundation
import MLX
import MLXLMCommon
import MLXLLM

@MainActor
final class ModelState: ObservableObject {
    @Published var currentAdapter: String = "base"
    @Published var lastSwapMs: Int = 0
    @Published var lastProbe: String = ""

    private var container: ModelContainer?
    private var loadedAdapter: LoRAContainer?

    func ensureLoaded(configuration: ModelConfiguration) async throws {
        if container != nil { return }
        container = try await LLMModelFactory.shared.loadContainer(
            configuration: configuration
        )
    }

    /// Swap to the LoRA adapter at `directory` (must contain adapter_config.json + adapters.safetensors).
    /// If another adapter is already loaded, unload it first (PITFALLS P6: avoid stacking).
    func swapAdapter(directory: URL) async throws {
        guard let container else {
            throw NSError(domain: "ModelState", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "model not loaded"])
        }
        let start = Date()
        let new = try LoRAContainer.from(directory: directory)
        let previous = loadedAdapter
        try await container.perform { context in
            if let previous {
                context.model.unload(adapter: previous)
            }
            try context.model.load(adapter: new)
        }
        loadedAdapter = new
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        lastSwapMs = ms
        currentAdapter = directory.lastPathComponent
        print("[swap] loaded \(directory.lastPathComponent) in \(ms) ms")
    }

    func unloadAdapter() async throws {
        guard let container, let adapter = loadedAdapter else { return }
        try await container.perform { context in
            context.model.unload(adapter: adapter)
        }
        loadedAdapter = nil
        currentAdapter = "base"
    }

    /// Deterministic probe — temperature 0.0, capture first ~32 tokens.
    func probe(prompt: String, maxTokens: Int = 32) async throws -> String {
        guard let container else { return "" }
        return try await container.perform { context in
            let input = try await context.processor.prepare(
                input: .init(messages: [["role": "user", "content": prompt]])
            )
            var out = ""
            let params = GenerateParameters(temperature: 0.0)
            let stream = try MLXLMCommon.generate(
                input: input, parameters: params, context: context
            )
            var count = 0
            for await event in stream {
                if case .chunk(let text) = event {
                    out += text
                    count += 1
                    if count >= maxTokens { break }
                }
            }
            return out
        }
    }
}
