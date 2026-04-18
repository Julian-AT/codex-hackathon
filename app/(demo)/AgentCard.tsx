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
        'min-h-24 gap-1 py-3 transition-colors',
        status === 'running' && 'border-primary/50',
        status === 'ok' && 'border-emerald-500/40',
        status === 'err' && 'border-destructive/60',
        status === 'timeout' && 'border-amber-500/50',
      )}
    >
      <CardHeader className="gap-0 px-3 pb-0 pt-0">
        <div className="font-mono text-[10px] text-muted-foreground">{id}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">{role}</span>
          <Badge variant={STATUS_BADGE[status]} className="shrink-0 text-[10px]">
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-0">
        {step ? (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">{step}</p>
        ) : null}
      </CardContent>
      {lastLine ? (
        <CardFooter className="px-3 pt-0">
          <span
            title={lastLine}
            className="block w-full cursor-default truncate font-mono text-[10px] text-muted-foreground"
          >
            {lastLine}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
