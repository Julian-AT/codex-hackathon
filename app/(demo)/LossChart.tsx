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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrainPoint } from '@/lib/streams/trainParser';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
      <ChartContainer
        className="h-full rounded-xl border bg-background p-4"
        config={{
          loss: { label: 'Loss', color: 'var(--chart-1)' },
          reward: { label: 'Reward', color: 'var(--chart-2)' },
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: -8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis
              dataKey="iter"
              type="number"
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
            />
            <YAxis
              yAxisId="loss"
              orientation="left"
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              yAxisId="reward"
              orientation="right"
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Line
              yAxisId="loss"
              type="monotone"
              dataKey="loss"
              stroke="var(--color-loss)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="reward"
              type="monotone"
              dataKey="reward"
              stroke="var(--color-reward)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
