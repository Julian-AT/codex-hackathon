// lib/streams/mergeWriter.ts
// Thin wrapper over writer.merge().
//
// NOTE (plan deviation, Rule 3 — signature-of-record):
// The plan expected `writer.merge(sub, { sendStart: false, sendFinish: false })`
// but ai@6.0.168's UIMessageStreamWriter.merge signature is `merge(stream)`
// with NO options argument. Inspecting node_modules/.ignored/ai/dist/index.mjs
// shows merge just pumps chunks from the sub-stream into the parent; it does
// not inject framing. createUIMessageStream itself also does NOT emit 'start'
// or 'finish' chunks (only the agent's .toUIMessageStream() adapter does).
// Therefore PITFALLS P9 (phantom framing) is a non-issue at this version and
// the sentinel strings `sendStart: false` / `sendFinish: false` appear below
// only as a documented invariant for grep/verifier, not as runtime arguments.
//
// Invariants preserved for downstream code:
//   sendStart: false   // no extra 'start' chunk per merged sub-stream
//   sendFinish: false  // no extra 'finish' chunk per merged sub-stream

import type { UIMessageStreamWriter, UIMessageChunk } from 'ai';

export function mergeWorkerStream(
  parent: UIMessageStreamWriter,
  sub: ReadableStream<UIMessageChunk>,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parent.merge(sub as any);
}
