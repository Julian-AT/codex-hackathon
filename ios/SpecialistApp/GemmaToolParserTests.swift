// GemmaToolParserTests.swift — XCTest cases for the tool-token parser.
// Mount into LLMEvalTests (or whichever test target mirrors LLMEval).

import XCTest
@testable import LLMEval

final class GemmaToolParserTests: XCTestCase {
    let parser = GemmaToolParser()

    func test_plainText_noFrames() {
        let frames = parser.parse("hello there")
        XCTAssertEqual(frames, [.text("hello there")])
    }

    func test_wellFormedCall_nameAndArgsObject() {
        let s = "sure <|tool_call|>{\"name\":\"addNumbers\",\"args\":{\"a\":2,\"b\":3}}<|tool_response|> ok"
        let frames = parser.parse(s)
        XCTAssertEqual(frames.count, 3)
        if case .call(let c) = frames[1] {
            XCTAssertEqual(c.name, "addNumbers")
            XCTAssertEqual(c.args["a"] as? Int, 2)
            XCTAssertEqual(c.args["b"] as? Int, 3)
        } else { XCTFail("expected call frame, got \(frames[1])") }
    }

    func test_malformedJSON_reportedAsMalformed() {
        let s = "<|tool_call|>{not json<|tool_response|>"
        let frames = parser.parse(s)
        XCTAssertEqual(frames.count, 1)
        if case .malformed = frames[0] { } else { XCTFail("expected malformed") }
    }

    func test_unterminatedFrame_tailMalformed() {
        let s = "prefix <|tool_call|>{\"name\":\"x\"}"
        let frames = parser.parse(s)
        XCTAssertEqual(frames.first, .text("prefix "))
        XCTAssertTrue(frames.contains { if case .malformed = $0 { return true } else { return false } })
    }
}
