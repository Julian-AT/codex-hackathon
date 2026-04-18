'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { AgentGrid } from '@/app/(demo)/AgentGrid';
import { useDemoStream } from '@/app/(demo)/useDemoStream';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { buildPipelinePrompt } from '@/lib/pipeline-prompt';
import type { TrainPoint } from '@/lib/streams/trainParser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  Play,
  Trash2,
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

/** Placeholder scores (PRD §11.6 shape) until /api/eval exists. */
const STUB_SCORES = { base: 35.2, tuned: 78.4, teacher: 94.1 };

const TIER_COPY: Record<'1' | '2' | '3', { title: string; body: string }> = {
  '1': {
    title: 'Tier 1 — Full live',
    body: 'Model A warmup, live Model B training, hot-swap, full scoreboard.',
  },
  '2': {
    title: 'Tier 2 — Partial live',
    body: 'Training visible; deploy or scoreboard may use pre-run artifacts; narration pivots honestly.',
  },
  '3': {
    title: 'Tier 3 — Cassette',
    body: 'Pre-recorded video + live narration; offline phone still in room.',
  },
};

function latestTrainMetrics(points: TrainPoint[]) {
  const valid = points.filter((p) => p.iter >= 0);
  const last = valid[valid.length - 1];
  if (!last) return null;
  return {
    iter: last.iter,
    loss: last.loss,
    reward: last.reward,
  };
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
  } = useDemoStream();

  const [productUrl, setProductUrl] = useState('https://supabase.com');
  const [demoTier, setDemoTier] = useState<'1' | '2' | '3'>('1');
  const [sankeyOpen, setSankeyOpen] = useState(false);

  const notificationRows = useMemo(
    () => Object.entries(notifications),
    [notifications],
  );

  const metrics = useMemo(() => latestTrainMetrics(train), [train]);

  const sentryHref = process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL;

  const runPipeline = () => {
    sendMessage({ text: buildPipelinePrompt(productUrl) });
  };

  const busy = pipelineStatus === 'streaming' || pipelineStatus === 'submitted';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Offline Specialist–LLM pipeline
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Coordinator / workers · training telemetry · eval & observability
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {pipelineStatusDisplay}
          </Badge>
        </header>

        <div className="flex flex-1 flex-col gap-10 p-4 md:p-6">
          {/* Run */}
          <section id="section-run" className="scroll-mt-20 space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Run pipeline</h2>
              <p className="text-sm text-muted-foreground">
                Product URL feeds the coordinator prompt (PRD product input).
              </p>
            </div>
            <Card>
              <CardHeader className="gap-1">
                <CardTitle className="text-base">Product</CardTitle>
                <CardDescription>
                  Presets match PRD audience options (Supabase primary; Vercel / Zod / Hono).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://…"
                    className="font-mono text-sm"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button onClick={runPipeline} disabled={busy}>
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      Run pipeline
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      title="Phase harness: parallel discovery smoke"
                      onClick={() =>
                        sendMessage({
                          text: 'Launch 2 discovery workers named w1 and w2 in parallel.',
                        })
                      }
                      disabled={busy}
                    >
                      Smoke: 2 workers
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_PRESETS.map((p) => (
                    <Button
                      key={p.url}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setProductUrl(p.url)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Tier */}
          <section id="section-tier" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Demo tier (fallback ladder)</h2>
            <div className="flex flex-wrap gap-2">
              {(['1', '2', '3'] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={demoTier === t ? 'default' : 'outline'}
                  onClick={() => setDemoTier(t)}
                >
                  Tier {t}
                </Button>
              ))}
            </div>
            <Alert>
              <Info className="size-4" />
              <AlertTitle>{TIER_COPY[demoTier].title}</AlertTitle>
              <AlertDescription>{TIER_COPY[demoTier].body}</AlertDescription>
            </Alert>
          </section>

          <Separator />

          {/* Orchestration */}
          <section id="section-orchestration" className="scroll-mt-20 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Orchestration</h2>
                <p className="text-sm text-muted-foreground">
                  Up to 20 workers · live{' '}
                  <code className="rounded bg-muted px-1 text-xs">data-agent-status</code>{' '}
                  stream
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Active: {Object.keys(agents).length} / 20
              </span>
            </div>
            <AgentGrid agents={agents} />
          </section>

          <Separator />

          {/* Tasks */}
          <section id="section-tasks" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Task notifications</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Worker completions</CardTitle>
                <CardDescription>
                  Terminal{' '}
                  <code className="rounded bg-muted px-1 text-xs">data-task-notification</code>{' '}
                  parts (PRD §10.2).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {notificationRows.length === 0 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <p className="text-sm text-muted-foreground">No completions yet.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[min(360px,50vh)] rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Worker</TableHead>
                          <TableHead className="w-[100px]">Task ID</TableHead>
                          <TableHead className="w-[90px]">Status</TableHead>
                          <TableHead>Summary</TableHead>
                          <TableHead className="w-[100px]">Usage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificationRows.map(([workerId, n]) => (
                          <TableRow key={workerId}>
                            <TableCell className="font-mono text-xs">{workerId}</TableCell>
                            <TableCell className="font-mono text-xs">{n.taskId}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  n.status === 'ok'
                                    ? 'secondary'
                                    : n.status === 'err'
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {n.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate text-sm">
                              {n.summary}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {n.usage != null ? JSON.stringify(n.usage) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Training */}
          <section id="section-training" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Training (SFT / GRPO)</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loss & reward</CardTitle>
                <CardDescription>
                  Streams from <code className="rounded bg-muted px-1 text-xs">/api/train</code>{' '}
                  · PRD §6.2 · 5-step report cadence
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="sft">
                  <TabsList>
                    <TabsTrigger value="sft">SFT (loss)</TabsTrigger>
                    <TabsTrigger value="grpo">GRPO (reward)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sft" className="pt-4">
                    <p className="mb-2 text-xs text-muted-foreground">
                      mlx_lm.lora — Train loss vs iteration
                    </p>
                    <LossChart points={train} />
                  </TabsContent>
                  <TabsContent value="grpo" className="pt-4">
                    <p className="mb-2 text-xs text-muted-foreground">
                      mlx_lm_lora.train — Reward vs iteration (overlays when present)
                    </p>
                    <LossChart points={train} />
                  </TabsContent>
                </Tabs>
                {metrics ? (
                  <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Last iter</div>
                      <div className="font-mono font-semibold">{metrics.iter}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Loss</div>
                      <div className="font-mono font-semibold">
                        {metrics.loss != null ? metrics.loss.toFixed(4) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Reward</div>
                      <div className="font-mono font-semibold">
                        {metrics.reward != null ? metrics.reward.toFixed(4) : '—'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => startTrain('sft', 20)}
                >
                  Smoke: SFT 20 iter
                </Button>
                <Button type="button" variant="secondary" onClick={() => startTrain('grpo', 20)}>
                  Smoke: GRPO 20 iter
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearTrain}>
                  <Trash2 className="size-4" />
                  Clear chart
                </Button>
              </CardFooter>
            </Card>
          </section>

          <Separator />

          {/* Eval */}
          <section id="section-eval" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Three-way evaluation</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Base vs tuned vs teacher</CardTitle>
                <CardDescription>
                  PRD §11.6 — placeholder until{' '}
                  <code className="rounded bg-muted px-1 text-xs">/api/eval</code> ships (H8).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(
                  [
                    { key: 'base', label: 'Base Gemma 4 E4B', v: STUB_SCORES.base },
                    { key: 'tuned', label: 'Tuned (LoRA)', v: STUB_SCORES.tuned },
                    { key: 'teacher', label: 'Teacher (Opus 4.7)', v: STUB_SCORES.teacher },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="font-mono tabular-nums">{row.v.toFixed(1)}%</span>
                    </div>
                    <Progress value={row.v} className="h-2" />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Expected ordering for demo: Base &lt; Tuned &lt; Teacher. Scores are illustrative
                  stubs.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled
                  title="Wire POST /api/eval (H8)"
                >
                  Run 3-way eval (70 items)
                </Button>
              </CardFooter>
            </Card>
          </section>

          <Separator />

          {/* Latency */}
          <section id="section-latency" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Latency stopwatch</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">On-device vs cloud</CardTitle>
                <CardDescription>PRD §11.7 — compute-only vs round-trip (asymmetry is intentional)</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">On-device (TTLT)</div>
                  <div className="font-mono text-2xl font-semibold">—</div>
                  <p className="mt-1 text-xs text-muted-foreground">ms · iPhone via USB-C shim</p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Cloud (round-trip)</div>
                  <div className="font-mono text-2xl font-semibold">—</div>
                  <p className="mt-1 text-xs text-muted-foreground">ms · AI SDK · same prompt</p>
                </div>
              </CardContent>
              <CardFooter>
                <Alert className="w-full border-dashed">
                  <Info className="size-4" />
                  <AlertTitle className="text-sm">Harness not connected</AlertTitle>
                  <AlertDescription className="text-xs">
                    Populated when the eval route measures TTLT vs cloud RTT for a fixed prompt.
                  </AlertDescription>
                </Alert>
              </CardFooter>
            </Card>
          </section>

          <Separator />

          {/* Sankey */}
          <section id="section-sankey" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Distillation flow</h2>
            <Collapsible open={sankeyOpen} onOpenChange={setSankeyOpen}>
              <Card className="gap-0 py-0">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                  <div>
                    <CardTitle className="text-base">Sankey (stretch)</CardTitle>
                    <CardDescription>
                      PRD §2.2 — generated → filtered → trained → lifted
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-expanded={sankeyOpen}
                    onClick={() => setSankeyOpen((o) => !o)}
                  >
                    <ChevronDown
                      className={cn('size-4 transition-transform', sankeyOpen && 'rotate-180')}
                    />
                  </Button>
                </CardHeader>
              </Card>
              <CollapsibleContent>
                <Card className="mt-2 border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                      Not generated — optional Tier 1 nice-to-have
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <Separator />

          {/* Deploy */}
          <section id="section-deploy" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Fuse &amp; deploy</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Adapter to device</CardTitle>
                <CardDescription>
                  mlx_lm.fuse + <code className="rounded bg-muted px-1 text-xs">xcrun devicectl</code>{' '}
                  (PRD §8.3, §19.1)
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Device UDID</label>
                  <Input disabled placeholder="XXXXXXXX-…" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Bundle ID</label>
                  <Input disabled placeholder="com.example.SpecialistApp" className="font-mono" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="button" disabled title="H7 — implement POST /api/adapter">
                  Fuse + deploy to iPhone
                </Button>
              </CardFooter>
            </Card>
          </section>

          <Separator />

          {/* Sentry */}
          <section id="section-observability" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Observability</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sentry (gen_ai)</CardTitle>
                <CardDescription>
                  PRD §12 — secondary screen during demo; spans for workers and training
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    <code className="rounded bg-muted px-1 text-xs">Sentry.vercelAIIntegration()</code>{' '}
                    captures AI SDK calls
                  </li>
                  <li>Custom spans: worker roles, training (SFT/GRPO), tool-validation sandbox</li>
                  <li>Exceptions from workers / subprocesses become issues</li>
                </ul>
                {sentryHref ? (
                  <a
                    href={sentryHref}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'inline-flex items-center gap-2',
                    )}
                  >
                    Open Sentry project
                    <ExternalLink className="size-4" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Set{' '}
                    <code className="rounded bg-muted px-1 text-xs">
                      NEXT_PUBLIC_SENTRY_DASHBOARD_URL
                    </code>{' '}
                    in <code className="rounded bg-muted px-1 text-xs">.env.local</code> for a quick
                    link.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
