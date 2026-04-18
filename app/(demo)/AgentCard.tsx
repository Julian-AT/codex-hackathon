'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import type { AgentStatus } from '@/lib/coordinator/taskNotification';
import { cn } from '@/lib/utils';
import { Circle, Loader2 } from 'lucide-react';

const STATUS_BADGE: Record<
  AgentStatus['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  running: 'default',
  ok: 'secondary',
  err: 'destructive',
  timeout: 'outline',
};

export function AgentCard({
  id,
  status,
  role,
  step,
  lastLine,
}: { id: string } & AgentStatus) {
  return (
    <Card
      data-agent-id={id}
      data-agent-status={status}
      className={cn(
        'min-h-32 gap-3 border bg-card py-3 shadow-none transition-colors',
        status === 'running' && 'border-primary/20',
        status === 'ok' && 'border-border',
        status === 'err' && 'border-destructive/25',
        status === 'timeout' && 'border-border',
      )}
    >
      <CardHeader className="gap-0 px-3 pb-0 pt-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {id}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold capitalize">{role}</span>
          <Badge
            variant={STATUS_BADGE[status]}
            className="shrink-0 gap-1 text-[10px] uppercase tracking-[0.16em]"
          >
            {status === 'running' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Circle
                className={cn(
                  'size-2.5 fill-current',
                  status === 'ok' && 'text-emerald-600',
                  status === 'err' && 'text-destructive',
                  status === 'timeout' && 'text-amber-600',
                )}
              />
            )}
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-0">
        {step ? (
          <p className="line-clamp-3 text-[12px] leading-5 text-muted-foreground">{step}</p>
        ) : null}
      </CardContent>
      {lastLine ? (
        <CardFooter className="px-3 pt-0">
          <span
            title={lastLine}
            className="block w-full cursor-default truncate rounded-md border bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground"
          >
            {lastLine}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
