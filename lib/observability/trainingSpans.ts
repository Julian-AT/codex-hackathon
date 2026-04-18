// lib/observability/trainingSpans.ts
// Thin wrapper over Sentry.startSpan to ensure every training run is observable.
// op: 'training.sft' | 'training.grpo' — keep op values stable for dashboards.

import * as Sentry from '@sentry/nextjs';

export function withTrainingSpan<T>(
  kind: 'sft' | 'grpo',
  iters: number,
  fn: (span: Sentry.Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    { op: `training.${kind}`, name: `${kind}.${iters}iter` },
    async (span) => {
      span.setAttribute('training.kind', kind);
      span.setAttribute('training.iters', iters);
      return fn(span);
    },
  );
}
