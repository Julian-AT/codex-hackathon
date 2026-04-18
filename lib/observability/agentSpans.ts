// lib/observability/agentSpans.ts
// Sentry span wrappers for coordinator-spawned workers.
// op: 'ai.agent' — one span per worker invocation, keyed by role + id.
//
// Verified at plan-time via node_modules/.ignored/ai/dist/index.d.ts:
//   ai exports: { ToolLoopAgent (aliased as Experimental_Agent), createUIMessageStream,
//                 createUIMessageStreamResponse, stepCountIs, tool, ... }
// Note: `writer.merge(stream)` in ai@6.0.168 takes only a ReadableStream — no
// { sendStart, sendFinish } options. createUIMessageStream itself does not emit
// framing chunks, so merge is already clean (PITFALLS P9 is non-issue at this version).

import * as Sentry from '@sentry/nextjs';

export function withAgentSpan<T>(
  role: string,
  id: string,
  fn: (span: Sentry.Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    { op: 'ai.agent', name: `worker.${role}` },
    async (span) => {
      span.setAttribute('worker.role', role);
      span.setAttribute('worker.id', id);
      return fn(span);
    },
  );
}

/**
 * Defensive attribute setter per PITFALLS P11 — vercelAIIntegration() may miss
 * gen_ai.tool.name / gen_ai.tool.arguments. Stamping them from inside the tool
 * execute() body guarantees they land on the active span.
 *
 * Arguments are truncated to 2000 chars to prevent large-payload span bloat.
 */
export function setToolCallAttributes(name: string, args: unknown): void {
  const span = Sentry.getActiveSpan();
  if (!span) return;
  span.setAttribute('gen_ai.tool.name', name);
  try {
    span.setAttribute(
      'gen_ai.tool.arguments',
      JSON.stringify(args).slice(0, 2000),
    );
  } catch {
    span.setAttribute('gen_ai.tool.arguments', '[unserializable]');
  }
}
