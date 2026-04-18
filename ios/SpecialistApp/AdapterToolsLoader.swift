import Foundation

private struct AdapterToolManifest: Decodable {
    let tools: [AdapterToolRecord]
}

private struct AdapterToolRecord: Decodable {
    let function: AdapterToolFunction
    let meta: AdapterToolMeta
}

private struct AdapterToolFunction: Decodable {
    let name: String
    let description: String
    let parameters: [String: AnyCodable]
}

private struct AdapterToolMeta: Decodable {
    let jsBody: String
    let requiresNetwork: Bool
}

struct AdapterToolsLoader {
    static func loadAndRegister(from adapterDir: URL, into registry: ToolRegistry) async throws -> Int {
        let candidateFiles = [
            adapterDir.appending(component: "adapter-tools.json"),
            adapterDir.deletingLastPathComponent().appending(component: "adapter-tools.json")
        ]

        guard let toolsFile = candidateFiles.first(where: {
            FileManager.default.fileExists(atPath: $0.path)
        }) else {
            return 0
        }

        let data = try Data(contentsOf: toolsFile)
        let manifest = try JSONDecoder().decode(AdapterToolManifest.self, from: data)

        for tool in await registry.list() {
            await registry.unregister(name: tool.name)
        }

        for record in manifest.tools {
            await registry.register(
                DynamicTool(
                    name: record.function.name,
                    description: record.function.description,
                    parameters: record.function.parameters,
                    body: record.meta.jsBody,
                    requiresNetwork: record.meta.requiresNetwork
                )
            )
        }

        return manifest.tools.count
    }
}
