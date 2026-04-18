// DynamicTool.swift — tool descriptor + JSON-safe AnyCodable for JSContext bridges.
// Mount into upstream LLMEval target via Xcode "Add Files to LLMEval".

import Foundation

struct DynamicTool: Codable, Identifiable {
    var id: String { name }
    let name: String
    let description: String
    let parameters: [String: AnyCodable]   // JSON Schema fragment
    let body: String                        // JS source: function(args) { ... }
    let requiresNetwork: Bool

    init(name: String,
         description: String,
         parameters: [String: AnyCodable] = [:],
         body: String,
         requiresNetwork: Bool = false) {
        self.name = name
        self.description = description
        self.parameters = parameters
        self.body = body
        self.requiresNetwork = requiresNetwork
    }
}

/// Minimal JSON-any box so tool args / results can cross Swift↔JS without ceremony.
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self.value = NSNull(); return }
        if let b = try? c.decode(Bool.self) { self.value = b; return }
        if let i = try? c.decode(Int.self) { self.value = i; return }
        if let d = try? c.decode(Double.self) { self.value = d; return }
        if let s = try? c.decode(String.self) { self.value = s; return }
        if let a = try? c.decode([AnyCodable].self) { self.value = a.map { $0.value }; return }
        if let o = try? c.decode([String: AnyCodable].self) {
            self.value = o.mapValues { $0.value }; return
        }
        throw DecodingError.dataCorruptedError(
            in: c, debugDescription: "AnyCodable: unsupported JSON scalar"
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case is NSNull: try c.encodeNil()
        case let b as Bool: try c.encode(b)
        case let i as Int: try c.encode(i)
        case let d as Double: try c.encode(d)
        case let s as String: try c.encode(s)
        case let a as [Any]: try c.encode(a.map { AnyCodable($0) })
        case let o as [String: Any]: try c.encode(o.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, .init(
                codingPath: encoder.codingPath,
                debugDescription: "AnyCodable: unsupported value"
            ))
        }
    }
}
