# Phase 2: Orchestrator Harness - Research

**Researched:** 2026-04-18 (H3 window)
**Domain:** AI SDK v6 merged SSE streams, coordinator/worker agent pattern, Node `child_process` → SSE pipe, Sentry `gen_ai` spans
**Confidence:** MEDIUM (Phase 1 pins are HIGH; AI SDK v6 beta API surface is LOW-MEDIUM — resolve import paths empirically when scaffold boots)

## Summary

Phase 2 builds the laptop-side orchestrator surface that Phases 3–5 all dock into. Two routes (`/api/pipeline`, `/api/train`), one `useChat`-driven 5×4 agent grid, one live Recharts chart, and Sentry spans around every worker and training leg. Every dependency is already pinned by the Phase 1 scaffold (`01-01-next-scaffold-sentry-providers-PLAN.md`): `ai@^6.0.168`, `@sentry/nextjs@^10.49.0`, `next@~15.5.15`, `recharts`, `eventsource-parser`. No new packages should be added.

The only genuine research risks are (a) the exact v6 import surface (`Experimental_Agent` vs `ToolLoopAgent`; PRD §10 uses `ToolLoopAgent`, phase 1 interfaces file uses `Experimental_Agent as Agent`), (b) whether `writer.merge({sendStart:false, sendFinish:false})` faithfully suppresses phantom start/finish parts in the current beta, and (c) whether `Sentry.vercelAIIntegration()` v10 already captures `ai.agent` spans or needs a manual `Sentry.startSpan` wrapper (PRD §12.2 prescribes both — do both defensively).

**Primary recommendation:** Treat PRD §10.4 + §10.5 as executable spec verbatim. Use `createUIMessageStream` as the single client-bound stream; each spawned worker writes into a shared `writer` via `writer.merge(workerStream, { sendStart: false, sendFinish: false })`. Persistent terminal events are `data-task-notification` (`transient: false`); status pings are `data-agent-status` (`transient: true`). `/api/train` is a second route of the same shape that spawns `mlx_lm.lora` via `child_process.spawn` and pipes parsed `Iter N: Train loss X` lines as `data-train` parts. Wrap every worker and every training run in `Sentry.startSpan({op:'ai.agent'})` / `{op:'training.sft'}` / `{op:'training.grpo'}` with per-iter attributes set on the active span — even if `vercelAIIntegration()` captures it automatically.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coordinator-Worker spawning, `spawnWorker` tool, task-notification aggregation | API / Backend (Next.js route, Node runtime) | — | Coordinator mutates shared UI stream writer; must be server-side. |
| `createUIMessageStream` + `writer.merge` fan-in | API / Backend | — | SSE emission requires server; `writer.merge` is server-only. |
| `useChat({onData})` routing; 5×4 AgentCard grid; Recharts live chart | Browser / Client | — | Purely display; transient vs persistent routing is a client state machine. |
| `child_process.spawn(mlx_lm.lora)` + readline regex → `data-train` | API / Backend (Node runtime) | — | `child_process` is Node-only; route MUST declare `runtime = 'nodejs'`. |
| Sentry `ai.agent` / `training.sft` / `training.grpo` spans | API / Backend | Browser (Sentry browser SDK can capture UI interactions, nice-to-have) | `gen_ai` + training telemetry belongs on the server; iOS stays uninstrumented (PRD §12.3, A15). |
| Provider token accounting (Anthropic org-TPM guard) | API / Backend | — | Coordinator needs a global counter; only server has this view. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK v6) | `^6.0.168` | `createUIMessageStream`, `writer.merge`, `Experimental_Agent`/`ToolLoopAgent`, `tool`, `generateText` | [CITED: PRD §13.2, phase 1 scaffold interfaces] v6 is the only SDK with `createUIMessageStream` + `writer.merge` as a first-class API; v5 used `createDataStreamResponse` with different ergonomics. |
| `@ai-sdk/anthropic` | `^3.0.71` | Claude Opus 4.5/4.7 provider for workers | [CITED: Phase 1 plan 01-01] |
| `@ai-sdk/openai` | `^3.0.53` | GPT-5 provider (judge, fallback worker model) | [CITED: Phase 1 plan 01-01] |
| `@ai-sdk/google` | `^3.0.64` | Gemini 2.5 Pro — workhorse when Anthropic TPM saturates (PITFALLS P22) | [CITED: Phase 1 plan 01-01] |
| `@sentry/nextjs` | `^10.49.0` | `vercelAIIntegration()` auto-captures `gen_ai.*` + `Sentry.startSpan` for custom ops | [CITED: PRD §12, phase 1 sentry.server.config.ts] |
| `next` | `~15.5.15` | App Router, `runtime='nodejs'` route handlers | [CITED: Phase 1 interfaces; PRD §13] |
| `recharts` | `latest` | Live training-loss / reward line chart | [CITED: PRD §10.5, §13.2] |
| `eventsource-parser` | `latest` | Tail subprocess stdout if we ever need raw SSE framing | [CITED: PRD §13.2] |
| `zod` | `^3.25.76` | `tool()` parameter schemas for `spawnWorker` | [CITED: Phase 1 interfaces] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `readline` (Node built-in) | Node ≥20 | Line-by-line parsing of `mlx_lm.lora` stdout for the `Iter N: Train loss X` regex | Always for `/api/train` stdout pipe — do NOT buffer full stdout in memory. |
| `child_process.spawn` (Node built-in) | Node ≥20 | Spawn `mlx_lm.lora` / `mlx_lm_lora.train` with `PYTHONUNBUFFERED=1` env | The only approved path per PRD §10.5. |
| `AbortController` (Web standard) | — | Per-worker 90s wall-clock budget (PITFALLS P10) + coordinator-wide cancellation on stream close | Every worker invocation, every subprocess. |
| `p-limit` | `^6` | Throttle concurrent worker spawns so we don't pop the 5×4 grid UI or exceed provider TPM | Inside the coordinator `spawnWorker` wrapper. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createUIMessageStream` + `writer.merge` | Raw SSE via `new Response(new ReadableStream(...))` | Loses `useChat({onData})` typed parts and transient/persistent distinction; requires hand-rolling the client parser. Reject — PRD §10.4 specifically requires the typed-part plumbing. [ASSUMED: v6 still exposes this API under this name; verify at scaffold boot.] |
| `ToolLoopAgent` | Build tool-loop manually with `generateText` in a while-loop | More code, worse Sentry integration, no stop-condition helpers. The PRD names `ToolLoopAgent`; the Phase 1 interfaces file names `Experimental_Agent as Agent`. [ASSUMED: they are the same export under two names during v6 beta — confirm by opening `node_modules/ai/dist/index.d.ts` at plan execution time.] |
| Python (e.g. FastAPI) subprocess bridge | — | Forbidden by PRD §19.4 / CLAUDE.md (no authored Python). |

**Installation:** No new installs. Phase 1's `package.json` already pins every dependency. If `ToolLoopAgent` is missing from the `ai` export surface after `npm install`, the fix is a grep in `node_modules/ai` — not a version bump.

**Version verification (do at the top of Plan 01 of this phase):**
```bash
node -e "const ai = require('ai'); console.log(Object.keys(ai).filter(k => /Agent|Stream|writer|Tool/i.test(k)));"
```
This enumerates the actual v6 exports (`Experimental_Agent`, `ToolLoopAgent`, `createUIMessageStream`, `tool`, `stepCountIs`, etc.) so you don't guess. Record the output in the plan's "Tech Stack" block.

## Architecture Patterns

### System Architecture Diagram

```
Client (browser)
  useChat({onData})
      |
      | SSE (one stream)
      |
  /api/pipeline  (runtime = 'nodejs')
      |
      +-- createUIMessageStream(writer => {
      |     const agent = new Experimental_Agent({
      |       model: anthropic('claude-opus-4-5'),
      |       tools: { spawnWorker: tool({ parameters: zod, execute: async ({role, prompt, id}) => {
      |         return Sentry.startSpan({ op:'ai.agent', name:`worker.${role}` }, async () => {
      |           writer.write({ type:'data-agent-status', id, data:{status:'running', role, step:'boot'}, transient:true });
      |           const sub = createUIMessageStream(async subWriter => {
      |             /* run sub-agent with its own tool allowlist */
      |             /* each step: subWriter.write({type:'data-agent-status', id, ..., transient:true}) */
      |             /* terminal: subWriter.write({type:'data-task-notification', id, data:{taskId,status,summary,result,usage}, transient:false}) */
      |           });
      |           writer.merge(sub, { sendStart:false, sendFinish:false });
      |         });
      |       }}) },
      |       stopWhen: stepCountIs(8),
      |     });
      |     await agent.generate({ prompt: coordinatorSystemPrompt });
      |   })
      |
      +-- p-limit(15) gate on spawns (PITFALLS P22)

  /api/train   (runtime = 'nodejs', dynamic = 'force-dynamic')
      |
      +-- createUIMessageStream(writer => {
      |     const child = spawn('mlx_lm.lora', [...args], { env: { ...process.env, PYTHONUNBUFFERED:'1' } });
      |     Sentry.startSpan({ op:'training.sft', name:'sft.400iter' }, async span => {
      |       const rl = readline.createInterface({ input: child.stdout });
      |       for await (const line of rl) {
      |         const m = line.match(/Iter (\d+): Train loss ([\d.]+)/);
      |         if (m) {
      |           const iter = Number(m[1]), loss = Number(m[2]);
      |           span.setAttribute(`iter.${iter}.loss`, loss);
      |           writer.write({ type:'data-train', data:{iter, loss}, transient:true });
      |         }
      |         const r = line.match(/Iter (\d+): Reward ([\d.]+)/);   // GRPO phase
      |         if (r) writer.write({ type:'data-train', data:{iter:+r[1], reward:+r[2]}, transient:true });
      |       }
      |     });
      |   })
```

### Recommended Project Structure

```
app/
├── api/
│   ├── pipeline/route.ts        # Coordinator SSE — createUIMessageStream + writer.merge + spawnWorker tool
│   └── train/route.ts           # mlx_lm.lora / mlx_lm_lora.train subprocess → data-train parts
├── (demo)/
│   ├── page.tsx                 # mounts AgentGrid + LossChart
│   ├── AgentGrid.tsx            # 5×4 grid of AgentCard, keyed by worker id
│   ├── AgentCard.tsx            # single worker's status/lane/role/lastLine
│   └── LossChart.tsx            # Recharts <LineChart> with loss + reward overlay
lib/
├── coordinator/
│   ├── coordinator.ts           # Experimental_Agent with spawnWorker tool
│   ├── spawnWorker.ts           # zod schema + execute() that runs a sub-agent and writes parts
│   └── taskNotification.ts      # typed helpers for building data-task-notification parts
├── workers/
│   └── roles.ts                 # stubs for discovery/tool-design/data-gen-qa/data-gen-traj/eval-gen (bodies land in Phases 3/4)
├── streams/
│   ├── mergeWriter.ts           # thin wrapper over writer.merge that injects Sentry span context into nested streams
│   └── trainParser.ts           # readline + regex helper, testable in isolation
└── observability/
    └── spans.ts                 # wrappers: withAgentSpan(role, fn), withTrainingSpan(kind, fn)
```

### Pattern 1: `createUIMessageStream` + `writer.merge` fan-in
**What:** A single client SSE stream into which the coordinator, every spawned worker, and the training loop all write typed `data-*` parts.
**When to use:** Any time more than one logical producer needs to stream to the same `useChat`. Always, in this phase.
**Key rules:**
- Call `writer.merge(subStream, { sendStart: false, sendFinish: false })` — otherwise each sub-stream emits its own `start`/`finish` parts and the client's message state machine sees N conversations instead of one.
- Every `data-*` part MUST carry a stable `id` (the worker's unique identifier). Two workers with the same `id` will step on each other (PITFALLS P9).
- `transient: true` = status pings that do NOT survive into the persisted message; `transient: false` = terminal events that DO.

**Example (shape — confirm exact API names at scaffold-boot):**
```typescript
// Source: PRD §10.4; AI SDK v6 docs referenced by phase 1 SUMMARY §2
import { createUIMessageStream, Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const coordinator = new Agent({
        model: anthropic('claude-opus-4-5'),
        stopWhen: stepCountIs(8),
        tools: {
          spawnWorker: tool({
            description: 'Delegate a scoped subtask. The coordinator never does work itself.',
            parameters: z.object({
              id: z.string(),
              role: z.enum(['discovery','tool-design','data-gen-qa','data-gen-traj','eval-gen']),
              prompt: z.string(),
            }),
            execute: async ({ id, role, prompt }) =>
              Sentry.startSpan({ op: 'ai.agent', name: `worker.${role}` }, async (span) => {
                span.setAttribute('worker.id', id);
                writer.write({ type: 'data-agent-status', id, data: { role, status: 'running', step: 'boot' }, transient: true });

                const subStream = createUIMessageStream({
                  execute: async ({ writer: sub }) => {
                    const worker = new Agent({ model: anthropic('claude-opus-4-5'), stopWhen: stepCountIs(6), /* narrow allowlist */ });
                    const result = await worker.generate({ prompt });
                    sub.write({
                      type: 'data-task-notification',
                      id,
                      data: { taskId: id, status: 'ok', summary: result.text.slice(0, 200), result: result.text, usage: result.usage },
                      transient: false,
                    });
                  },
                });
                writer.merge(subStream, { sendStart: false, sendFinish: false });
                return { taskId: id, status: 'spawned' };
              }),
          }),
        },
      });
      await coordinator.generate({ prompt: 'Launch 2 discovery workers in parallel.' });
    },
  });
  return stream.toResponse();
}
```

### Pattern 2: `child_process.spawn` → `readline` → `data-train` part
**What:** Python CLI stdout is piped line-by-line through a regex into SSE parts.
**When to use:** `/api/train` only. No other phase 2 component spawns subprocesses.
**Key rules:**
- `env: { ...process.env, PYTHONUNBUFFERED: '1' }` — without this, Python buffers stdout and the UI looks frozen.
- Use `readline.createInterface({ input: child.stdout })` — do NOT collect `stdout.on('data')` chunks by hand (half-line races).
- Track the child PID in a module-scoped map and SIGTERM on route abort (`req.signal.addEventListener('abort', ...)`).
- **Development mode caveat (PITFALLS P16):** Next.js dev-server hot-reload orphans subprocesses. For any multi-minute training run, use `next build && next start` — not `next dev`.

**Example:**
```typescript
// Source: PRD §10.5; Node readline docs
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream } from 'ai';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await Sentry.startSpan({ op: 'training.sft', name: 'sft.400iter' }, async (span) => {
        const child = spawn(
          'mlx_lm.lora',
          ['--model', 'unsloth/gemma-4-E4B-it-UD-MLX-4bit', '--train', '--iters', '400', /* ... */],
          { env: { ...process.env, PYTHONUNBUFFERED: '1' } },
        );
        req.signal.addEventListener('abort', () => child.kill('SIGTERM'));

        const rl = readline.createInterface({ input: child.stdout });
        for await (const line of rl) {
          const m = line.match(/Iter\s+(\d+):\s+Train loss\s+([\d.]+)/);
          if (m) {
            const iter = Number(m[1]);
            const loss = Number(m[2]);
            span.setAttribute(`loss.iter.${iter}`, loss);
            writer.write({ type: 'data-train', data: { iter, loss }, transient: true });
          }
        }
        await new Promise<void>((r) => child.on('close', () => r()));
      });
    },
  });
  return stream.toResponse();
}
```

### Pattern 3: `useChat({onData})` routing to grid + chart
**What:** A single client hook receives every typed part and routes by `type` + `id`.
**When to use:** The demo page component.

```typescript
// Source: PRD §10.4; AI SDK v6 useChat onData
'use client';
import { useChat } from 'ai/react';
import { useState } from 'react';

type AgentStatus = { role: string; status: 'running'|'ok'|'err'|'timeout'; step?: string; lastLine?: string };
type TrainPoint = { iter: number; loss?: number; reward?: number };

export default function DemoPage() {
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});
  const [notifications, setNotifications] = useState<Record<string, unknown>>({});
  const [train, setTrain] = useState<TrainPoint[]>([]);

  useChat({
    api: '/api/pipeline',
    onData: (part) => {
      if (part.type === 'data-agent-status') {
        setAgents((p) => ({ ...p, [part.id as string]: part.data as AgentStatus }));
      } else if (part.type === 'data-task-notification') {
        setNotifications((p) => ({ ...p, [part.id as string]: part.data }));
      } else if (part.type === 'data-train') {
        setTrain((p) => [...p, part.data as TrainPoint]);
      }
    },
  });

  // AgentGrid renders 5 cols × 4 rows keyed by Object.keys(agents); LossChart renders `train`.
}
```

### Anti-Patterns to Avoid
- **Shared ID across workers.** Two workers writing `id: 'worker-1'` step on each other in both the grid and `writer.merge`. Use `crypto.randomUUID()` or `${role}-${index}`.
- **Buffering subprocess stdout.** Collecting `child.stdout.on('data')` into a string loses real-time feel and breaks the loss chart animation. Always `readline`.
- **Coordinator doing domain work.** PRD §10.2 rule #1: coordinator ONLY orchestrates. If the coordinator itself produces tool schemas / QA items / trajectories, delete that code — spawn a worker.
- **Trusting `vercelAIIntegration()` alone for tool-call attributes (PITFALLS P11).** Manually `span.setAttribute('gen_ai.tool.name', ...)` inside worker wrappers. Redundant but cheap.
- **Un-capped `ToolLoopAgent` (PITFALLS P10).** Always `stopWhen: stepCountIs(8)` AND a 90s `AbortController.timeout` per worker.
- **Running training in `next dev` (PITFALLS P16).** Switch to `next build && next start` before H5:55 / before any >2 min subprocess.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fan N worker streams into one SSE | Custom `TransformStream` + manual SSE framing | `ai` v6 `createUIMessageStream` + `writer.merge` | [CITED: PRD §10.4] Typed parts + transient/persistent semantics + client `onData` routing — all already wired. |
| Tool-call loop with step cap + abort | `while (!done) { generateText(...); if (toolCall) ... }` | `Experimental_Agent`/`ToolLoopAgent` + `stopWhen: stepCountIs(n)` | Built-in step-count stop, built-in tool execution, built-in Sentry span capture. |
| Coordinator/Worker message envelopes | Custom XML/JSON wire format | `data-task-notification` part + typed `useChat` | PRD §10.2 #6 names the envelope; SDK handles it. |
| Parse subprocess stdout line-by-line | `child.stdout.on('data', chunk => ...)` with manual `\n` split | `readline.createInterface({ input: child.stdout })` | Node built-in; handles partial lines, encoding, backpressure. |
| `gen_ai` span instrumentation for AI SDK | Manual OTel span creation around every `generateText` | `Sentry.vercelAIIntegration()` + `Sentry.startSpan` only for custom ops (`ai.agent`, `training.sft`, `training.grpo`) | [CITED: PRD §12.1] Integration captures model, tokens, tool calls automatically. |
| Concurrency ceiling on workers | `Promise.all([...])` with no guard | `p-limit(15)` + token-budget tracker | [CITED: PITFALLS P22] `p-limit` caps in-flight; TPM tracker caps tokens/min. |
| Chart lib | Hand-rolled SVG | `recharts` (`LineChart`) | Already pinned; 5-step update cadence works under default React throttling. |

**Key insight:** This phase is almost entirely glue. If a task description says "build X from scratch," check the table above — it's likely a wrapper-over-library job.

## Runtime State Inventory

Not applicable — Phase 2 is greenfield (no rename/migration). Phase 1 scaffolded fresh files; this phase adds new ones. **None — verified by file inventory against `files_modified` in Phase 1 plans.**

## Common Pitfalls

(Supplements `.planning/research/PITFALLS.md` — below are the subset directly relevant to Phase 2.)

### Pitfall 1: `writer.merge` phantom `start`/`finish` parts (P9)
**What goes wrong:** Nested `createUIMessageStream` emits its own framing; the client receives multiple `start` events and the `useChat` state machine either resets or mis-attributes parts.
**Why it happens:** AI SDK v6 beta defaults emit framing per-stream.
**How to avoid:** Always pass `{ sendStart: false, sendFinish: false }` to `writer.merge`. Write an integration test in plan 01 that launches 2 workers and asserts exactly one `start` is observed.
**Warning signs:** Client `messages` array contains empty placeholder messages between worker outputs; `useChat`'s `status` flickers back to `'submitted'` mid-stream.

### Pitfall 2: `ToolLoopAgent` infinite loop (P10)
**What goes wrong:** A hallucinated tool call that doesn't match any tool name is re-issued forever; worker burns 50K+ tokens, Sentry span exceeds 3 minutes, UI stays in "running".
**How to avoid:** `stopWhen: stepCountIs(8)` on EVERY agent construction + `AbortSignal.timeout(90_000)` wired into the agent call. On timeout, emit `data-task-notification` with `status: 'timeout'` so the grid reflects reality.
**Warning signs:** Same tool name invoked >3 times with near-identical args; worker's `usage.outputTokens` climbs past 20K with no notification emitted.

### Pitfall 3: `vercelAIIntegration()` misses tool-call attributes (P11)
**What goes wrong:** Sentry shows `gen_ai.request.model` and `gen_ai.usage.*` but `gen_ai.tool.name` / `.arguments` are empty.
**How to avoid:** Inside every `tool()` `execute` body, `Sentry.getActiveSpan()?.setAttribute('gen_ai.tool.name', name)` + `.setAttribute('gen_ai.tool.arguments', JSON.stringify(args).slice(0, 2000))`. Defensive — costs nothing if the integration already sets them.
**Warning signs:** Sentry dashboard search `gen_ai.tool.name:*` returns zero spans after a known-good worker run.

### Pitfall 4: Next.js dev-server hot-reload kills long subprocesses (P16)
**What goes wrong:** Edit any file → Next.js hot-reloads → `/api/train` subprocess orphans → UI shows "training running" but stdout is dry.
**How to avoid:** Set `export const dynamic = 'force-dynamic'` on `/api/train` AND switch to `next build && next start` before running anything multi-minute. Track child PIDs in a module-scoped `Map<string, ChildProcess>` and `SIGTERM` on both `req.signal.abort` and `process.on('beforeExit')`.
**Warning signs:** `ps aux | grep mlx_lm` shows orphaned processes after editing unrelated files.

### Pitfall 5: Recharts stutter at >10 Hz update rate (P27)
**What goes wrong:** At default `--steps-per-report 5` the data rate is fine (~1 point/1.8s = 0.5 Hz). But if someone bumps `steps-per-report` to 1 for debugging, the chart flickers.
**How to avoid:** Batch `setState` updates to 500ms windows when iter delta <1s. Keep `steps-per-report: 5` as the contract (PRD §6.2).
**Warning signs:** Loss chart visually stutters; React DevTools shows LossChart re-rendering >10×/s.

### Pitfall 6: Anthropic TPM is org-level, `p-limit` is cosmetic (P22)
**What goes wrong:** `p-limit(15)` holds 15 in-flight requests, but at Opus 4.5 large-context pricing, 15 × 20K tokens = 300K tokens in one burst. Org hits 1M TPM. 429s cascade.
**How to avoid:** Add a token-budget tracker module: running sum of `usage.totalTokens` over sliding 60s window; gate below 900K TPM. When saturated, fall back to Gemini 2.5 Pro (4M TPM).
**Warning signs:** First worker completes fine; 3rd-onwards get `429 rate_limit_error` with `retry-after` headers.

## Code Examples

(See Pattern 1, 2, 3 above. Additional snippets follow.)

### Sentry span wrappers (deduplicated helper)
```typescript
// lib/observability/spans.ts
// Source: PRD §12.2; @sentry/nextjs v10 docs (CITED via phase 1 scaffold)
import * as Sentry from '@sentry/nextjs';

export function withAgentSpan<T>(role: string, id: string, fn: (span: Sentry.Span) => Promise<T>): Promise<T> {
  return Sentry.startSpan({ op: 'ai.agent', name: `worker.${role}` }, async (span) => {
    span.setAttribute('worker.role', role);
    span.setAttribute('worker.id', id);
    return fn(span);
  });
}

export function withTrainingSpan<T>(kind: 'sft' | 'grpo', iters: number, fn: (span: Sentry.Span) => Promise<T>): Promise<T> {
  return Sentry.startSpan({ op: `training.${kind}`, name: `${kind}.${iters}iter` }, async (span) => {
    span.setAttribute('training.kind', kind);
    span.setAttribute('training.iters', iters);
    return fn(span);
  });
}
```

### AgentCard grid sizing
```typescript
// app/(demo)/AgentGrid.tsx — 5 cols × 4 rows = 20 slots
// Source: PRD §10.4 (5×4 grid); generic CSS grid pattern
<div className="grid grid-cols-5 grid-rows-4 gap-2">
  {Object.entries(agents).slice(0, 20).map(([id, s]) => (
    <AgentCard key={id} id={id} {...s} />
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v5 `createDataStreamResponse` | AI SDK v6 `createUIMessageStream` + typed `data-*` parts | AI SDK v6 beta, late 2025 / early 2026 | [ASSUMED] Typed parts with `transient` flag is v6-specific. v5 had no clean transient-vs-persistent distinction. |
| `Agent` from `experimental_Agent` path | `Experimental_Agent as Agent` from `ai` (possibly aliased to `ToolLoopAgent`) | v6 API consolidation | [ASSUMED — verify at scaffold boot] |
| Manual `startSpan` for every AI SDK call | `Sentry.vercelAIIntegration()` auto-captures | `@sentry/nextjs ≥9.29.0` (PRD floor) | [CITED: PRD §12.1] |

**Deprecated/outdated:**
- Do NOT use `createDataStreamResponse` — v5 API, not typed-parts compatible with v6 `useChat({onData})`.
- Do NOT use `experimental_*` imports from pre-v6 — they were stabilized/renamed.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORC-01 | `/api/pipeline` merges N parallel workers into one SSE via `createUIMessageStream` + `writer.merge` | Pattern 1 above; `{sendStart:false, sendFinish:false}` is the key flag. |
| ORC-02 | Coordinator/Worker harness; `spawnWorker` tool; coordinator never works; workers return via `task-notification` | PRD §10.1–10.3 rules; Pattern 1 demonstrates the `spawnWorker` tool with zod schema + sub-stream merge. |
| ORC-03 | Client `useChat({onData})` routes `data-agent-status` (transient) vs `data-task-notification` (persistent) into 5×4 grid keyed by worker id | Pattern 3 above; transient flag in part body distinguishes routing. |
| ORC-04 | `/api/train` spawns `mlx_lm.lora` / `mlx_lm_lora.train` via `child_process.spawn`, `PYTHONUNBUFFERED=1`, readline regex → `data-train` → Recharts | Pattern 2 above; note `runtime='nodejs'` + `dynamic='force-dynamic'`. |
| ORC-05 | Sentry spans: `ai.agent` for each worker; `training.sft` / `training.grpo` with per-iter loss/reward attrs | `withAgentSpan` / `withTrainingSpan` helpers; attribute naming under `loss.iter.${N}` or span-level `setAttribute` per line. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Experimental_Agent` and `ToolLoopAgent` are the same export (or the former supersedes the latter) in `ai@^6.0.168` | Standard Stack / Pattern 1 | LOW — plan-time `Object.keys(require('ai'))` reveals truth in 30 seconds; code imports need a one-line change. |
| A2 | `writer.merge(sub, { sendStart: false, sendFinish: false })` is the exact v6 API for framing-suppression | Pattern 1 / Pitfall 1 | MEDIUM — if option names changed, phantom framing breaks client state. Integration test (2 workers, assert one `start`) catches this on first run. |
| A3 | `useChat({onData})` receives typed `data-*` parts with the `transient` flag honored in v6 | Pattern 3 | MEDIUM — if v6 dropped transient routing, persistent message log will fill with status pings. Fallback: filter by `type` on the client and drop `data-agent-status` from persisted state manually. |
| A4 | `Sentry.vercelAIIntegration()` in v10.49 captures AI SDK v6 calls (not just v5) | Sentry wrappers | LOW — defensive manual `startSpan` wrappers already cover the gap. |
| A5 | `mlx_lm.lora` stdout format is literally `Iter N: Train loss X` | Pattern 2 | MEDIUM — if Gemma 4 / mlx-lm 0.31.2 changed the format, regex misses. Fallback: also match `/loss[:\s]+([\d.]+)/i` as a laxer secondary. Verify against H0 micro-bench stdout capture (Phase 1 should have this in `.planning/phases/01-foundation-smoke/01-02-*`). |
| A6 | `mlx_lm_lora.train` GRPO emits a line matching `Iter N: Reward X` alongside loss | Pattern 2 | MEDIUM — PITFALLS P2 flags the GRPO surface as LOW-confidence. If format differs, grep `mlx-lm-lora` 0.1.0 README at Phase 5 planning time (not here). For Phase 2 skeleton, ship both regexes; wire the GRPO-specific one behind a feature flag to enable in Phase 5. |
| A7 | `recharts` default `<LineChart>` handles <10 Hz additions without custom throttling | Pattern / Pitfall 5 | LOW — 5-step cadence is ~0.5 Hz, well below the stutter threshold. |

## Open Questions

1. **Which `Agent` export name is live in `ai@^6.0.168`?**
   - What we know: PRD §13.2 writes "`ToolLoopAgent`"; Phase 1's interfaces file writes "`Experimental_Agent as Agent`".
   - What's unclear: Which is actually exported in 6.0.168 (or both, one deprecated-aliased to the other)?
   - Recommendation: First plan task runs `node -e "console.log(Object.keys(require('ai')))"` and records the result before writing any import line. Both names should work; prefer whichever is listed first in the v6 changelog.

2. **Does `writer.merge` preserve outer-stream span context?**
   - What we know: PRD asserts `writer.merge({sendStart:false, sendFinish:false})`.
   - What's unclear: Is the Sentry active span inherited into the merged sub-stream's tool executions, or do we need explicit `Sentry.withActiveSpan(parent, () => ...)` inside the sub?
   - Recommendation: Wrap the worker body with an explicit `Sentry.startSpan` (Pattern 1 already does). Don't rely on context propagation.

3. **GRPO reward-fn integration (deferred to Phase 5).**
   - What we know: PITFALLS P2 — mlx-lm-lora 0.1.0 may require a Python-file reward function or a CLI reward-server URL.
   - What's unclear: Whether Phase 2's `/api/train` needs to host a reward-server endpoint today or can remain SFT-only.
   - Recommendation: Phase 2 scaffolds `/api/train` for SFT only. A TODO comment points at Phase 5 to wire GRPO reward callback. Do NOT author Python in this phase.

4. **Should there be one `/api/train` route or two (SFT vs GRPO)?**
   - What we know: PRD §14 H3 says "a second route `/api/train` that spawns `mlx_lm.lora`".
   - What's unclear: Phase 5 runs SFT then GRPO sequentially — one route with a mode param, or two routes?
   - Recommendation: One route with a `mode: 'sft' | 'grpo'` request body param. Simpler; matches `training.sft` / `training.grpo` span naming.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥20 | Next.js runtime | ✓ (assumed — Phase 1 scaffold required it) | [CITED: Phase 1 interfaces] | — |
| `mlx_lm.lora` CLI | `/api/train` subprocess | ✓ (Phase 1 FND-01/FND-02 installed and bench-ran it) | `mlx-lm==0.31.2` | Skip `/api/train` smoke, mock stdout with a pre-recorded log for UI-only work. |
| `mlx_lm_lora.train` CLI | `/api/train` GRPO mode (Phase 5; scaffolded here) | ✓ (Phase 1 FND-01) | `mlx-lm-lora==0.1.0` | Flag GRPO mode behind `--experimental-grpo` env var; defer to Phase 5. |
| Anthropic / OpenAI / Google API keys | Coordinator and worker agents | ✓ (Phase 1 FND-04 verified) | — | If Anthropic 429s, fall over to `google('gemini-2.5-pro')` (PITFALLS P22). |
| Sentry DSN | `Sentry.init` + span dashboard | ✓ (Phase 1 scaffold `.env.example`) | — | If DSN unset, Sentry init is a no-op; spans are built but not sent. Acceptable for local dev. |

**Missing dependencies with no fallback:** none — every Phase-2 dep is a Phase-1 deliverable.

**Missing dependencies with fallback:** Anthropic TPM saturation → Gemini fallback (noted P22).

## Project Constraints (from CLAUDE.md)

These directives from `./CLAUDE.md` + PRD §19.4 govern Phase 2 and MUST be honored by the plan:

- **Node ≥20 / Next.js 15 App Router only.** No Next.js 16.x. No Edge runtime for `child_process` callers. Every route that spawns subprocesses: `export const runtime = 'nodejs'`.
- **AI SDK v6 only** (`ai@^6.0.168` — NOT `ai-v6` tag which resolves to 6.0.132, NOT `beta` which resolves to 7.x).
- **`@sentry/nextjs` ≥ 9.29.0** with `Sentry.vercelAIIntegration()`. v10.49.0 recommended.
- **Zero `.py` files authored.** Python is a pinned CLI subprocess. Any reward-function bridge for GRPO (Phase 5) is a runtime shim, not application code — document as an exception.
- **Do NOT introduce:** PWA, WebLLM, transformers.js, llama.cpp, HF Transformers+MPS, Core ML, ExecuTorch, E2B, WebContainers, CodeSandbox, RAG, cloud fallback on inference, auto-formatting of agent JS bodies, Gemma vision/audio modalities, per-dimension multi-judge eval, training runs >20 min wall-clock.
- **Do NOT auto-format agent-generated JS tool bodies** (Phase 3 concern, but worth re-asserting — reject-don't-fix is the universal rule).
- **Commit convention:** `docs:` for planning docs, GSD phase/plan conventions for code commits. Never commit secrets or training data with credentials.
- **Tier floor:** Tier-3 cassette at H7. Phase 2 failing = degraded polish, NOT demo-dead — continue with minimal UI per roadmap kill-point.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-operator demo on localhost, no auth surface. |
| V3 Session Management | no | Same. |
| V4 Access Control | no | Same. |
| V5 Input Validation | yes | `zod` schema on every `tool()` parameter set; `spawnWorker` tool's `role` enum is closed. |
| V6 Cryptography | no | No crypto in this phase. |
| V7 Errors/Logging | yes | Truncate provider error bodies to 400 chars in responses (phase 1 pattern, re-apply); do not echo raw 401/403/429 headers — may contain tokens. |
| V12 Files/Resources | yes | `/api/train` subprocess args must be literal constants (no user-supplied paths to `spawn`) — prevents arg injection. |
| V13 API | partial | `/api/pipeline` is a public route during local dev. Remove before any deploy (Phase 1 T-01-03 disposition carried forward). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Subprocess argument injection via request body | Tampering / EoP | Use fixed arg arrays; never interpolate user input into `spawn(cmd, args)`. |
| SSE stream leak of provider API errors | Information Disclosure | Truncate + redact error payloads (phase 1 precedent). |
| Long-lived subprocess survives after route abort → DoS / resource leak | DoS | Wire `req.signal.addEventListener('abort', () => child.kill('SIGTERM'))` on every spawn. |
| Worker tool-loop unbounded token spend | DoS / cost | `stopWhen: stepCountIs(8)` + `AbortSignal.timeout(90_000)` + per-worker Sentry token-budget alert. |
| Hallucinated tool call crashes orchestrator | Tampering | `tool()` `execute` returns `{error}` on unrecognized role; coordinator never throws to the stream writer. |

## Sources

### Primary (HIGH confidence)
- `PRD_SPEC.md` §10.1–10.5 (coordinator/worker contract, UI contract, training-loss streaming) — authoritative.
- `PRD_SPEC.md` §12.1–12.2 (Sentry instrumentation points).
- `PRD_SPEC.md` §13.2, §19.1, §19.4 (stack pins, repo layout, conventions).
- `.planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md` (pinned versions, `runtime='nodejs'`, `dynamic='force-dynamic'` pattern).
- `.planning/research/SUMMARY.md` §2 (pinned deps with H0 verify flags).
- `.planning/research/PITFALLS.md` P9, P10, P11, P16, P22, P27 (directly applicable to Phase 2).

### Secondary (MEDIUM confidence)
- `CLAUDE.md` hard constraints block.
- `.planning/ROADMAP.md` Phase 2 success criteria.
- `.planning/REQUIREMENTS.md` ORC-01..ORC-05 verbatim.

### Tertiary (LOW confidence — verify at plan time)
- AI SDK v6 exact export names (`Experimental_Agent` vs `ToolLoopAgent`; `createUIMessageStream` signature; `writer.merge` option names). [ASSUMED based on PRD + phase 1 interfaces; must be confirmed by `Object.keys(require('ai'))` at scaffold boot.]
- `Sentry.vercelAIIntegration()` v10.49 AI SDK v6 compatibility. [ASSUMED — defensive manual `startSpan` wrappers cover any gap.]
- `mlx_lm.lora` stdout regex (`Iter N: Train loss X`). [CITED: PRD §10.5 names this pattern verbatim.] Sec-fallback regex `/loss[:\s]+([\d.]+)/i` ships as a safety net.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version is pinned by Phase 1.
- Architecture (patterns 1/2/3): MEDIUM — PRD §10 is explicit; AI SDK v6 beta details verified at scaffold boot, not here.
- Pitfalls: HIGH (Node/Next.js side), MEDIUM (AI SDK v6 beta surface). PITFALLS.md confidence inherited.
- Sentry integration: MEDIUM — vercelAIIntegration is stable; manual wrappers are defensive insurance.

**Research date:** 2026-04-18 (H3 window).
**Valid until:** End of demo day (2026-04-18 H12). Do not re-research mid-execution.
