// app/(demo)/LossChart.tsx
// Recharts LineChart for live training telemetry (SFT loss + GRPO reward).
// Mounted by Plan 03's demo page; consumes `data-train` parts surfaced via useChat.
//
// Notes:
//   - `isAnimationActive={false}` — tweening at live data rates causes stutter
//     (PITFALLS P27 defense at the component level).
//   - Dual Y axis — loss on left, reward on right — so SFT and GRPO coexist
//     cleanly on a single chart (TRN-03).
//   - Sentinel `iter=-1` points (fallback regex matches) are filtered out.

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrainPoint } from '@/lib/streams/trainParser';

import { cn } from '@/lib/utils';

export function LossChart({
  points,
  className,
}: {
  points: TrainPoint[];
  className?: string;
}) {
  // Drop sentinel iter=-1 fallback points from the visual (no real iter axis value).
  const data = points.filter((p) => p.iter >= 0);
  return (
    <div className={cn('h-80 w-full min-w-0', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="iter" type="number" domain={['auto', 'auto']} />
          <YAxis yAxisId="loss" orientation="left" domain={['auto', 'auto']} />
          <YAxis yAxisId="reward" orientation="right" domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="loss"
            stroke="#e11d48"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="reward"
            type="monotone"
            dataKey="reward"
            stroke="#0ea5e9"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
