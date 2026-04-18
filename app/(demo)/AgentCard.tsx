// app/(demo)/AgentCard.tsx
// Single worker card for the 5x4 agent grid. Inline-styled for resilience —
// Tailwind is not yet wired in this scaffold (Phase 1 layout is a bare HTML shell).

'use client';

import type { AgentStatus } from './useDemoStream';

const COLOR: Record<AgentStatus['status'], string> = {
  running: '#60a5fa',
  ok: '#22c55e',
  err: '#ef4444',
  timeout: '#f59e0b',
};

export function AgentCard({
  id,
  status,
  role,
  step,
  lastLine,
}: { id: string } & AgentStatus) {
  return (
    <div
      style={{
        border: `2px solid ${COLOR[status]}`,
        borderRadius: 8,
        padding: 8,
        minHeight: 96,
        fontFamily: 'monospace',
        fontSize: 11,
        background: '#0a0a0a',
        color: '#f5f5f5',
      }}
      data-agent-id={id}
      data-agent-status={status}
    >
      <div style={{ opacity: 0.7 }}>{id}</div>
      <div style={{ fontWeight: 600 }}>{role}</div>
      <div style={{ color: COLOR[status] }}>
        {status}
        {step ? ` · ${step}` : ''}
      </div>
      {lastLine ? (
        <div
          style={{
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lastLine}
        </div>
      ) : null}
    </div>
  );
}
