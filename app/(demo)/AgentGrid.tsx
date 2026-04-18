'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/lib/coordinator/taskNotification';

import { AgentCard } from './AgentCard';

export function AgentGrid({
  agents,
}: {
  agents: Record<string, AgentStatus>;
}) {
  const entries = Object.entries(agents).slice(0, 20);
  const slots: ([string, AgentStatus] | null)[] = [...entries];
  while (slots.length < 20) slots.push(null);

  return (
    <div
      className="grid min-h-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      data-rows="4"
      data-cols="5"
    >
      {slots.map((slot, i) =>
        slot ? (
          <AgentCard key={slot[0]} id={slot[0]} {...slot[1]} />
        ) : (
          <Card
            key={`empty-${i}`}
            className={cn(
              'flex min-h-32 flex-col justify-center border-dashed bg-muted/10 py-3 shadow-none',
            )}
          >
            <div className="flex flex-col gap-2 px-3">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
          </Card>
        ),
      )}
    </div>
  );
}
