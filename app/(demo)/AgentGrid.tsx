// app/(demo)/AgentGrid.tsx
// 5x4 CSS grid (capacity 20) of AgentCard, keyed by worker id.
// Empty slots render a dashed placeholder so the grid is always visually 5x4.
// Grid dimensions are inline (`repeat(5, 1fr)` / `repeat(4, 1fr)`) rather than
// Tailwind classes because Tailwind is not wired in the Phase 1 scaffold;
// data-cols / data-rows attributes mirror the visual layout for tests/grep.

'use client';

import { AgentCard } from './AgentCard';
import type { AgentStatus } from './useDemoStream';

export function AgentGrid({
  agents,
}: {
  agents: Record<string, AgentStatus>;
}) {
  const entries = Object.entries(agents).slice(0, 20);
  // Pad to 20 slots so the grid always shows 5x4 even when no workers reported yet.
  const slots: ([string, AgentStatus] | null)[] = [...entries];
  while (slots.length < 20) slots.push(null);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gap: 8,
      }}
      data-rows="4"
      data-cols="5"
    >
      {slots.map((slot, i) =>
        slot ? (
          <AgentCard key={slot[0]} id={slot[0]} {...slot[1]} />
        ) : (
          <div
            key={`empty-${i}`}
            style={{
              border: '1px dashed #27272a',
              borderRadius: 8,
              minHeight: 96,
            }}
          />
        ),
      )}
    </div>
  );
}
