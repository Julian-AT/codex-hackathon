// GemmaToolParser.swift — Gemma 4 tool-token round-trip parser.
// Scans model output for <|tool_call|> ... <|tool_response|> frames,
// extracts a JSON object via balanced-brace walk (PITFALLS P1), and
// reports malformed frames without crashing the stream.
// Mount into upstream LLMEval target via Xcode "Add Files to LLMEval".

import Foundation

struct ToolCall: Equatable {
    let name: String
    let args: [String: Any]

    static func == (lhs: ToolCall, rhs: ToolCall) -> Bool {
        lhs.name == rhs.name &&
        (NSDictionary(dictionary: lhs.args).isEqual(to: rhs.args))
    }
}

enum ParsedFrame: Equatable {
    case text(String)
    case call(ToolCall)
    case malformed(String)   // raw inner body — caller decides retry strategy

    static func == (a: ParsedFrame, b: ParsedFrame) -> Bool {
        switch (a, b) {
        case (.text(let x), .text(let y)): return x == y
        case (.call(let x), .call(let y)): return x == y
        case (.malformed(let x), .malformed(let y)): return x == y
        default: return false
        }
    }
}

struct GemmaToolParser {
    static let openTag = "<|tool_call|>"
    static let closeTag = "<|tool_response|>"

    /// Parse a completed generation string into ordered frames.
    func parse(_ input: String) -> [ParsedFrame] {
        var frames: [ParsedFrame] = []
        var cursor = input.startIndex

        while cursor < input.endIndex {
            guard let openRange = input.range(of: Self.openTag, range: cursor..<input.endIndex) else {
                let tail = String(input[cursor..<input.endIndex])
                if !tail.isEmpty { frames.append(.text(tail)) }
                break
            }
            // Text before the tag.
            if openRange.lowerBound > cursor {
                frames.append(.text(String(input[cursor..<openRange.lowerBound])))
            }
            // Find close tag.
            guard let closeRange = input.range(
                of: Self.closeTag, range: openRange.upperBound..<input.endIndex
            ) else {
                // Unterminated — bail with the rest as malformed.
                frames.append(.malformed(String(input[openRange.upperBound..<input.endIndex])))
                break
            }
            let inner = String(input[openRange.upperBound..<closeRange.lowerBound])
            if let call = extractCall(inner) {
                frames.append(.call(call))
            } else {
                frames.append(.malformed(inner))
            }
            cursor = closeRange.upperBound
        }
        return frames
    }

    /// Extract the first balanced {...} JSON object in `s`; decode to ToolCall.
    /// Tolerates leading whitespace and a leading name token like `addNumbers {...}`.
    func extractCall(_ s: String) -> ToolCall? {
        guard let jsonRange = balancedObjectRange(in: s) else { return nil }
        let jsonStr = String(s[jsonRange])
        let leading = s[s.startIndex..<jsonRange.lowerBound]
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = jsonStr.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let dict = obj as? [String: Any] else {
            return nil
        }
        // Accept either: {"name": "addNumbers", "args": {...}} OR a bare args object with a name prefix.
        if let name = dict["name"] as? String {
            let args = (dict["args"] as? [String: Any]) ?? [:]
            return ToolCall(name: name, args: args)
        }
        if !leading.isEmpty {
            return ToolCall(name: leading, args: dict)
        }
        return nil
    }

    /// Walk chars counting { } balance to find the first complete JSON object range.
    private func balancedObjectRange(in s: String) -> Range<String.Index>? {
        guard let start = s.firstIndex(of: "{") else { return nil }
        var depth = 0
        var inString = false
        var escape = false
        var i = start
        while i < s.endIndex {
            let c = s[i]
            if escape { escape = false; i = s.index(after: i); continue }
            if inString {
                if c == "\\" { escape = true }
                else if c == "\"" { inString = false }
            } else {
                if c == "\"" { inString = true }
                else if c == "{" { depth += 1 }
                else if c == "}" {
                    depth -= 1
                    if depth == 0 {
                        return start..<s.index(after: i)
                    }
                }
            }
            i = s.index(after: i)
        }
        return nil
    }
}
