// ToolRegistry.swift — actor-isolated registry + fresh JSContext per dispatch.
// PITFALLS P6: a fresh JSContext per invocation avoids state bleed + leaks.
// Offline gating: tools with requiresNetwork==true fail-closed when OnlineMonitor says offline.
// Mount into upstream LLMEval target via Xcode "Add Files to LLMEval".

import Foundation
import JavaScriptCore

enum ToolError: Error, LocalizedError {
    case notFound(String)
    case offlineBlocked(String)
    case jsException(String)
    case badResult(String)

    var errorDescription: String? {
        switch self {
        case .notFound(let n): return "tool not found: \(n)"
        case .offlineBlocked(let n): return "tool \(n) requires network (offline)"
        case .jsException(let m): return "js exception: \(m)"
        case .badResult(let m): return "bad tool result: \(m)"
        }
    }
}

actor ToolRegistry {
    static let shared = ToolRegistry()

    private var tools: [String: DynamicTool] = [:]

    func register(_ tool: DynamicTool) {
        tools[tool.name] = tool
    }

    func unregister(name: String) {
        tools.removeValue(forKey: name)
    }

    func list() -> [DynamicTool] { Array(tools.values) }

    /// Dispatch a tool by name with JSON-encodable args. Returns JSON string of the result.
    /// - Parameter isOnline: snapshot from OnlineMonitor at call time (default-closed).
    func dispatch(name: String, args: [String: Any], isOnline: Bool) throws -> String {
        guard let tool = tools[name] else { throw ToolError.notFound(name) }
        if tool.requiresNetwork && !isOnline {
            let payload = ["error": "This tool requires network. Device is offline."]
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            return String(data: data, encoding: .utf8) ?? "{\"error\":\"This tool requires network. Device is offline.\"}"
        }

        // Fresh context per call (P6).
        guard let ctx = JSContext() else {
            throw ToolError.jsException("failed to create JSContext")
        }

        var jsError: String?
        ctx.exceptionHandler = { _, exception in
            jsError = exception?.toString() ?? "unknown"
        }

        // Bridges: console.log → Swift print; nativeFetch → offline stub (not wired to URLSession here).
        let consoleLog: @convention(block) (String) -> Void = { msg in
            print("[tool:\(name)] \(msg)")
        }
        ctx.setObject(
            ["log": unsafeBitCast(consoleLog, to: AnyObject.self)],
            forKeyedSubscript: "console" as NSString
        )

        let nativeFetch: @convention(block) (String) -> [String: Any] = { _ in
            // Stub: real fetch would post back through a Swift-side handler.
            // Default-closed offline story — leave unimplemented in 01-05.
            return ["ok": false, "error": "nativeFetch not implemented offline"]
        }
        ctx.setObject(nativeFetch, forKeyedSubscript: "nativeFetch" as NSString)

        // Install the tool body as `__tool_fn`.
        let wrapped = "var __tool_fn = \(tool.body);"
        ctx.evaluateScript(wrapped)
        if let e = jsError { throw ToolError.jsException(e) }

        // Encode args as JSON literal so JS sees a plain object.
        let argsJSON = try JSONSerialization.data(withJSONObject: args, options: [])
        let argsStr = String(data: argsJSON, encoding: .utf8) ?? "{}"
        let call = "JSON.stringify(__tool_fn(\(argsStr)))"
        let result = ctx.evaluateScript(call)

        if let e = jsError { throw ToolError.jsException(e) }
        guard let s = result?.toString(), s != "undefined" else {
            throw ToolError.badResult("tool returned undefined")
        }
        return s
    }
}
