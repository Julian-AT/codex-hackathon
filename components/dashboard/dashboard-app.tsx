'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { AgentGrid } from '@/app/(demo)/AgentGrid';
import { useDemoStream } from '@/app/(demo)/useDemoStream';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { EvalSummary } from '@/lib/eval/types';
import { buildPipelinePrompt } from '@/lib/pipeline-prompt';
import type { TrainPoint } from '@/lib/streams/trainParser';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  Rocket,
  Sparkles,
  Upload,
  WifiOff,
} from 'lucide-react';

const LossChart = dynamic(
  () => import('@/app/(demo)/LossChart').then((m) => m.LossChart),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> },
);

const PRODUCT_PRESETS = [
  { label: 'Supabase', url: 'https://supabase.com' },
  { label: 'Vercel AI SDK', url: 'https://ai-sdk.dev' },
  { label: 'Zod', url: 'https://zod.dev' },
  { label: 'Hono', url: 'https://hono.dev' },
] as const;

function latestTrainMetrics(points: TrainPoint[]) {
  const valid = points.filter((p) => p.iter >= 0);
  return valid[valid.length - 1] ?? null;
}

function evalRows(rows: EvalSummary[] | undefined) {
  if (rows?.length) return rows;
  return [
    {
      key: 'base',
      label: 'Base',
      available: false,
      score: null,
      passed: 0,
      total: 0,
      latencyMs: null,
      notes: 'Not run',
    },
    {
      key: 'tuned',
      label: 'Tuned',
      available: false,
      score: null,
      passed: 0,
      total: 0,
      latencyMs: null,
      notes: 'Not run',
    },
    {
      key: 'teacher',
      label: 'Teacher',
      available: false,
      score: null,
      passed: 0,
      total: 0,
      latencyMs: null,
      notes: 'Not run',
    },
  ];
}

function formatStatusTone(status: string) {
  switch (status) {
    case 'Streaming':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'Submitted':
      return 'bg-muted text-muted-foreground border-border';
    case 'Error':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-2.5">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function DashboardApp() {
  const {
    agents,
    notifications,
    train,
    sendMessage,
    pipelineStatus,
    pipelineStatusDisplay,
    clearTrain,
    startTrain,
    evalResult,
    evalError,
    evalPending,
    startEval,
    adapterPending,
    adapterLog,
    adapterError,
    runAdapterAction,
    runDemoScenario,
  } = useDemoStream();

  const [productUrl, setProductUrl] = useState('https://supabase.com');

  const notificationRows = useMemo(
    () => Object.entries(notifications).reverse(),
    [notifications],
  );
  const metrics = useMemo(() => latestTrainMetrics(train), [train]);
  const scoreboardRows = useMemo(() => evalRows(evalResult?.models), [evalResult]);

  const busy =
    pipelineStatusDisplay === 'Streaming' || pipelineStatusDisplay === 'Submitted';
  const activeAgents = Object.keys(agents).length;
  const completedTasks = notificationRows.filter(([, item]) => item.status === 'ok').length;
  const failedTasks = notificationRows.filter(([, item]) => item.status === 'err').length;

  const runPipeline = () => {
    runDemoScenario(productUrl);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                Specialist Dashboard
              </h1>
              <Badge variant="secondary">Supabase</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Swarm first. Local training and device handoff underneath.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0', formatStatusTone(pipelineStatusDisplay))}
          >
            {pipelineStatusDisplay}
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Card className="shadow-sm">
          <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>Run the pipeline</CardTitle>
              <CardDescription>
                Start the swarm, then keep the rest of the surface quiet.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_PRESETS.map((preset) => (
                <Button
                  key={preset.url}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProductUrl(preset.url)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 lg:flex-row">
            <Input
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://supabase.com"
              className="font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={runPipeline} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run pipeline
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  sendMessage({
                    text: 'Launch 2 discovery workers named w1 and w2 in parallel.',
                  })
                }
                disabled={busy}
              >
                Smoke swarm
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pipeline"
            value={pipelineStatusDisplay}
            hint={busy ? 'Streaming worker output' : 'Ready for the next run'}
            icon={Activity}
          />
          <MetricCard
            label="Active agents"
            value={String(activeAgents)}
            hint={`${completedTasks} completed`}
            icon={Bot}
          />
          <MetricCard
            label="Failures"
            value={String(failedTasks)}
            hint={failedTasks ? 'Needs attention' : 'No task errors'}
            icon={AlertCircle}
          />
          <MetricCard
            label="Training"
            value={metrics ? `Iter ${metrics.iter}` : 'Idle'}
            hint={
              metrics?.loss != null ? `Loss ${metrics.loss.toFixed(4)}` : 'No telemetry yet'
            }
            icon={Sparkles}
          />
        </div>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Swarm</CardTitle>
              <CardDescription>Live coordinator and worker activity.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{activeAgents} active</Badge>
              <Badge variant="outline">{completedTasks} completed</Badge>
              {failedTasks > 0 ? <Badge variant="destructive">{failedTasks} failed</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            <AgentGrid agents={agents} />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>Training</CardTitle>
                <CardDescription>
                  Keep the curve visible, but keep the controls minimal.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => startTrain('sft', 20)}>
                  <Activity className="size-4" />
                  Smoke SFT
                </Button>
                <Button size="sm" variant="outline" onClick={() => startTrain('grpo', 20)}>
                  <Sparkles className="size-4" />
                  Probe GRPO
                </Button>
                <Button size="sm" variant="ghost" onClick={clearTrain}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <LossChart points={train} className="h-[340px]" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Iteration
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metrics?.iter ?? '—'}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Loss
                  </div>
                  <div className="mt-2 text-2xl font-semibold font-mono">
                    {metrics?.loss != null ? metrics.loss.toFixed(4) : '—'}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reward
                  </div>
                  <div className="mt-2 text-2xl font-semibold font-mono">
                    {metrics?.reward != null ? metrics.reward.toFixed(4) : '—'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Worker results</CardTitle>
                <CardDescription>Persistent task outcomes from the swarm.</CardDescription>
              </CardHeader>
              <CardContent>
                {notificationRows.length === 0 ? (
                  <EmptyState label="Run the pipeline to populate results." />
                ) : (
                  <ScrollArea className="h-[320px] pr-3">
                    <div className="space-y-3">
                      {notificationRows.slice(0, 12).map(([workerId, item]) => (
                        <div key={`${workerId}-${item.taskId}`} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{workerId}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.taskId}
                              </p>
                            </div>
                            <Badge
                              variant={
                                item.status === 'ok'
                                  ? 'secondary'
                                  : item.status === 'err'
                                    ? 'destructive'
                                    : 'outline'
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Validation and device</CardTitle>
                <CardDescription>Quick eval and adapter handoff.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {evalError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Eval error</AlertTitle>
                    <AlertDescription>{evalError}</AlertDescription>
                  </Alert>
                ) : null}
                {adapterError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Adapter error</AlertTitle>
                    <AlertDescription>{adapterError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Quick eval</p>
                      <p className="text-sm text-muted-foreground">
                        Small run for the scoreboard.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEval(4)} disabled={evalPending}>
                      {evalPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Run eval
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {scoreboardRows.map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">{row.notes}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {row.score != null ? row.score.toFixed(1) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.latencyMs != null ? `${row.latencyMs} ms` : 'No latency'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Device handoff</p>
                    <p className="text-sm text-muted-foreground">
                      Fuse, deploy, and verify from one place.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAdapterAction('fuse')}
                      disabled={adapterPending}
                    >
                      <Rocket className="size-4" />
                      Fuse
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAdapterAction('deploy')}
                      disabled={adapterPending}
                    >
                      <Upload className="size-4" />
                      Deploy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => runAdapterAction('fuse-and-deploy')}
                      disabled={adapterPending}
                      className="sm:col-span-2"
                    >
                      {adapterPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <WifiOff className="size-4" />
                      )}
                      Fuse and deploy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fuse and deploy stay visible, and the device log sits directly below.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Adapter log</p>
                    <p className="text-sm text-muted-foreground">
                      Recent fuse and deploy output.
                    </p>
                  </div>
                  {adapterLog.length === 0 ? (
                    <EmptyState label="Deploy actions will appear here." />
                  ) : (
                    <ScrollArea className="h-[180px] pr-3">
                      <div className="space-y-2">
                        {adapterLog.slice().reverse().map((line, index) => (
                          <div
                            key={`${index}-${line}`}
                            className="rounded-xl border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
