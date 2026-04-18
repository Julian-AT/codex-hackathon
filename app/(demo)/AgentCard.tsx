'use client';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { AgentStatus } from './useDemoStream';

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
        'min-h-32 gap-3 border bg-card py-3 transition-colors shadow-sm',
        status === 'running' && 'border-primary/25 bg-primary/5',
        status === 'ok' && 'border-emerald-200 bg-emerald-50/60',
        status === 'err' && 'border-destructive/20 bg-destructive/5',
        status === 'timeout' && 'border-amber-200 bg-amber-50/70',
      )}
    >
      <CardHeader className="gap-0 px-3 pb-0 pt-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {id}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{role}</span>
          <Badge variant={STATUS_BADGE[status]} className="shrink-0 text-[10px] uppercase tracking-[0.16em]">
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
            className="block w-full cursor-default truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground"
          >
            {lastLine}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
