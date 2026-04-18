---
phase: 02-orchestrator-harness
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/train/route.ts
  - lib/streams/trainParser.ts
  - lib/observability/trainingSpans.ts
  - app/(demo)/LossChart.tsx
autonomous: true
requirements: [ORC-04, ORC-05]

must_haves:
  truths:
    - "`/api/train` spawns `mlx_lm.lora` via `child_process.spawn` with `PYTHONUNBUFFERED=1` and pipes stdout via `readline`."
    - "Lines matching `Iter N: Train loss X` are parsed and emitted as `data-train` parts (transient:true) with shape `{iter, loss}`."
    - "Lines matching `Iter N: Reward X` are emitted as `data-train` parts with shape `{iter, reward}` (GRPO scaffolding)."
    - "Every training run is wrapped in `Sentry.startSpan({op:'training.sft'|'training.grpo', name:...})` with per-iter attributes."
    - "Route declares `export const runtime = 'nodejs'` AND `export const dynamic = 'force-dynamic'`; child PID is SIGTERM'd on `req.signal` abort (PITFALLS P16)."
    - "`LossChart.tsx` renders Recharts `<LineChart>` with loss line and optional reward overlay."
  artifacts:
    - path: "app/api/train/route.ts"
      provides: "SSE train endpoint spawning mlx_lm.lora subprocess"
      exports: ["POST", "runtime", "dynamic"]
      contains: "PYTHONUNBUFFERED"
    - path: "lib/streams/trainParser.ts"
      provides: "Pure line-to-TrainPoint parser (unit-testable)"
      contains: "Train loss"
    - path: "lib/observability/trainingSpans.ts"
      provides: "withTrainingSpan helper"
      contains: "training.sft"
    - path: "app/(demo)/LossChart.tsx"
      provides: "Recharts LineChart for training telemetry"
      contains: "recharts"
  key_links:
    - from: "app/api/train/route.ts"
      to: "child_process"
      via: "spawn('mlx_lm.lora', ...)"
      pattern: "spawn\\("
    - from: "app/api/train/route.ts"
      to: "lib/streams/trainParser.ts"
      via: "parseTrainLine"
      pattern: "parseTrainLine\\("
    - from: "app/api/train/route.ts"
      to: "lib/observability/trainingSpans.ts"
      via: "withTrainingSpan"
      pattern: "withTrainingSpan\\("
---

<objective>
Build the laptop-side training-subprocess surface: `/api/train` spawns `mlx_lm.lora` (SFT) and scaffolds `mlx_lm_lora.train` (GRPO), pipes stdout line-by-line through a regex parser, and emits typed `data-train` parts to the shared SSE stream. Wrap every run in a Sentry `training.sft` / `training.grpo` span. Ship the Recharts `<LossChart>` component the client will mount in Plan 03.

Purpose: Unblocks Phase 5 (TRN-01..TRN-04 live loss stream). Without this route + chart, training is invisible on stage.
Output: Working `/api/train` POST endpoint + unit-testable `trainParser` + `LossChart.tsx` component.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD_SPEC.md
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-orchestrator-harness/02-RESEARCH.md
@.planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md
@.planning/phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md

<interfaces>
<!-- Pinned deps (from Phase 1 01-01) -->
- `ai@^6.0.168` — `createUIMessageStream` (stream framing)
- `@sentry/nextjs@^10.49.0`
- `recharts` (latest; install if absent: `pnpm add recharts`)
- Node built-ins: `node:child_process`, `node:readline`

<!-- mlx_lm.lora CLI (PRD §6.2; Phase 1 FND-02 verified install) -->
- Binary path: resolve via the Python 3.12 venv activated in Phase 1 (typically `.venv/bin/mlx_lm.lora` or `python -m mlx_lm lora`). Use `process.env.MLX_LM_BIN` if set, else default `mlx_lm.lora`.
- stdout format (PRD §10.5): `Iter N: Train loss X` (SFT) and `Iter N: Reward X` (GRPO). Regex: `/Iter\s+(\d+):\s+Train loss\s+([\d.]+)/` and `/Iter\s+(\d+):\s+Reward\s+([\d.]+)/`. Fallback (A5 in RESEARCH): `/loss[:\s]+([\d.]+)/i`.

<!-- Data part contract (shared with Plan 01's taskNotification types) -->
type TrainPoint = { iter: number; loss?: number; reward?: number };
// Written as: writer.write({ type: 'data-train', data: TrainPoint, transient: true })
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: trainParser + trainingSpans modules (TDD — pure logic)</name>
  <files>lib/streams/trainParser.ts, lib/streams/trainParser.test.ts, lib/observability/trainingSpans.ts</files>
  <read_first>
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 2, Code Example: withTrainingSpan)
    - PRD_SPEC.md sections 10.5, 12.2, 6.2
    - package.json (confirm vitest or jest present; if absent, use `node --test`)
  </read_first>
  <behavior>
    - Test 1: `parseTrainLine('Iter 5: Train loss 1.234')` returns `{ iter: 5, loss: 1.234 }`
    - Test 2: `parseTrainLine('Iter 120: Reward 0.87')` returns `{ iter: 120, reward: 0.87 }`
    - Test 3: `parseTrainLine('some unrelated stdout chatter')` returns `null`
    - Test 4: `parseTrainLine('Iter 10: Train loss 0.5 extra garbage')` still returns `{ iter: 10, loss: 0.5 }` (lax suffix)
    - Test 5: Empty string returns `null`
    - Test 6: `parseTrainLine('loss: 1.5')` returns `{ iter: -1, loss: 1.5 }` using fallback regex (A5 safety net)
  </behavior>
  <action>
1. **lib/streams/trainParser.ts** — Export:
```typescript
export type TrainPoint = { iter: number; loss?: number; reward?: number };

const TRAIN_LOSS_RE = /Iter\s+(\d+):\s+Train loss\s+([\d.]+)/;
const REWARD_RE = /Iter\s+(\d+):\s+Reward\s+([\d.]+)/;
const LOSS_FALLBACK_RE = /loss[:\s]+([\d.]+)/i;

export function parseTrainLine(line: string): TrainPoint | null {
  if (!line) return null;
  const t = line.match(TRAIN_LOSS_RE);
  if (t) return { iter: Number(t[1]), loss: Number(t[2]) };
  const r = line.match(REWARD_RE);
  if (r) return { iter: Number(r[1]), reward: Number(r[2]) };
  const f = line.match(LOSS_FALLBACK_RE);
  if (f) return { iter: -1, loss: Number(f[1]) };
  return null;
}
```

2. **lib/streams/trainParser.test.ts** — Implement all 6 behaviors above using whatever test runner Phase 1 scaffolded. If none, use `node --test` with `node:assert`.

3. **lib/observability/trainingSpans.ts** — Export:
```typescript
import * as Sentry from '@sentry/nextjs';

export function withTrainingSpan<T>(
  kind: 'sft' | 'grpo',
  iters: number,
  fn: (span: Sentry.Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    { op: `training.${kind}`, name: `${kind}.${iters}iter` },
    async (span) => {
      span.setAttribute('training.kind', kind);
      span.setAttribute('training.iters', iters);
      return fn(span);
    },
  );
}
```

RED first (write test file, run, confirm fail). GREEN (implement parser). REFACTOR if needed.
  </action>
  <verify>
    <automated>grep -n "Train loss" lib/streams/trainParser.ts && grep -n "Reward" lib/streams/trainParser.ts && grep -n "training.sft" lib/observability/trainingSpans.ts && grep -n "training.grpo" lib/observability/trainingSpans.ts && (pnpm vitest run lib/streams/trainParser.test.ts 2>&1 || node --test lib/streams/trainParser.test.ts 2>&1) | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - lib/streams/trainParser.ts contains exact strings `Train loss` AND `Reward`
    - lib/streams/trainParser.ts exports `parseTrainLine` and `TrainPoint` type
    - lib/observability/trainingSpans.ts contains exact strings `training.sft` and `training.grpo` (via template literal with kind)
    - All 6 test cases pass (test runner exit 0)
  </acceptance_criteria>
  <done>Parser is unit-tested with 6 passing cases; withTrainingSpan helper exists.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build /api/train route with spawn + readline + writer.write('data-train')</name>
  <files>app/api/train/route.ts</files>
  <read_first>
    - lib/streams/trainParser.ts (just created)
    - lib/observability/trainingSpans.ts (just created)
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 2, Pitfall 4)
    - PRD_SPEC.md sections 10.5, 19.4
    - .planning/phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md (confirm mlx_lm binary path)
  </read_first>
  <action>
Create `app/api/train/route.ts`:

```typescript
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import { createUIMessageStream } from 'ai';
import { parseTrainLine } from '@/lib/streams/trainParser';
import { withTrainingSpan } from '@/lib/observability/trainingSpans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Module-scoped child registry so hot-reload can SIGTERM orphans (PITFALLS P16 defense)
const CHILDREN = new Map<string, ChildProcessWithoutNullStreams>();

type TrainRequest = {
  mode: 'sft' | 'grpo';
  iters?: number;
  model?: string;
  // NEVER accept arbitrary argv from body — only a closed enum of (mode, iters, model).
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<TrainRequest>;
  const mode: 'sft' | 'grpo' = body.mode === 'grpo' ? 'grpo' : 'sft';
  const iters = typeof body.iters === 'number' && body.iters > 0 && body.iters <= 2000 ? body.iters : (mode === 'sft' ? 400 : 150);
  const model = body.model && /^[\w\-./]+$/.test(body.model) ? body.model : 'unsloth/gemma-4-E4B-it-UD-MLX-4bit';

  const bin = process.env.MLX_LM_BIN || (mode === 'sft' ? 'mlx_lm.lora' : 'mlx_lm_lora.train');
  // Args are literal constants; no user input interpolated into argv (ASVS V12, T-02-09 below)
  const args = mode === 'sft'
    ? ['--model', model, '--train', '--iters', String(iters), '--steps-per-report', '5']
    : ['--train-mode', 'grpo', '--model', model, '--iters', String(iters), '--group-size', '4'];

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await withTrainingSpan(mode, iters, async (span) => {
        const child = spawn(bin, args, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });
        const childId = `${mode}-${Date.now()}`;
        CHILDREN.set(childId, child);

        const onAbort = () => { try { child.kill('SIGTERM'); } catch {} };
        req.signal.addEventListener('abort', onAbort);

        const rl = readline.createInterface({ input: child.stdout });
        try {
          for await (const line of rl) {
            const pt = parseTrainLine(line);
            if (!pt) continue;
            if (pt.loss !== undefined) span.setAttribute(`loss.iter.${pt.iter}`, pt.loss);
            if (pt.reward !== undefined) span.setAttribute(`reward.iter.${pt.iter}`, pt.reward);
            writer.write({ type: 'data-train', data: pt, transient: true });
          }
          await new Promise<void>((resolve) => child.on('close', () => resolve()));
        } catch (e) {
          const msg = e instanceof Error ? e.message.slice(0, 400) : 'train error';
          writer.write({ type: 'data-train', data: { iter: -1, loss: undefined }, transient: true });
          span.setAttribute('training.error', msg);
        } finally {
          req.signal.removeEventListener('abort', onAbort);
          CHILDREN.delete(childId);
        }
      });
    },
  });

  return stream.toResponse();
}

// SIGTERM all children on server exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => { for (const c of CHILDREN.values()) { try { c.kill('SIGTERM'); } catch {} } });
}
```

Hard rules:
- `model` must pass the closed regex `/^[\w\-./]+$/` — blocks arg injection (T-02-09).
- `iters` capped at 2000 — blocks training-runs-over-20-min hard constraint (CLAUDE.md).
- No user-supplied path ever reaches `spawn(bin, args)` except through the validated `model` string.
- Never interpolate the body into a shell — `spawn` is exec-style, no shell=true.
  </action>
  <verify>
    <automated>grep -n "runtime = 'nodejs'" app/api/train/route.ts && grep -n "dynamic = 'force-dynamic'" app/api/train/route.ts && grep -n "PYTHONUNBUFFERED" app/api/train/route.ts && grep -n "readline.createInterface" app/api/train/route.ts && grep -n "data-train" app/api/train/route.ts && grep -n "SIGTERM" app/api/train/route.ts && grep -n "withTrainingSpan" app/api/train/route.ts && pnpm next build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - app/api/train/route.ts contains exact string `runtime = 'nodejs'`
    - app/api/train/route.ts contains exact string `dynamic = 'force-dynamic'`
    - app/api/train/route.ts contains exact string `PYTHONUNBUFFERED`
    - app/api/train/route.ts contains exact string `readline.createInterface`
    - app/api/train/route.ts contains exact string `data-train`
    - app/api/train/route.ts contains exact string `SIGTERM`
    - app/api/train/route.ts contains exact string `withTrainingSpan`
    - `pnpm next build` completes 0 TS errors
    - Manual: `curl -N -X POST http://localhost:3000/api/train -H 'content-type: application/json' -d '{"mode":"sft","iters":10}'` streams `data-train` events (requires Phase 1 venv + mlx_lm.lora available)
  </acceptance_criteria>
  <done>Route file exists with all required strings; build succeeds; manual curl streams data-train events.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: LossChart.tsx client component (Recharts LineChart)</name>
  <files>app/(demo)/LossChart.tsx</files>
  <read_first>
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 3, Pitfall 5)
    - PRD_SPEC.md section 10.5
    - lib/streams/trainParser.ts (for `TrainPoint` type)
  </read_first>
  <action>
Install recharts if not yet present: `pnpm add recharts` (no-op if already installed by Phase 1).

Create `app/(demo)/LossChart.tsx`:

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TrainPoint } from '@/lib/streams/trainParser';

export function LossChart({ points }: { points: TrainPoint[] }) {
  // Filter sentinel iter=-1 fallback points out of the visual (they carry loss but no real iter)
  const data = points.filter((p) => p.iter >= 0);
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="iter" type="number" domain={['auto', 'auto']} />
          <YAxis yAxisId="loss" orientation="left" domain={['auto', 'auto']} />
          <YAxis yAxisId="reward" orientation="right" domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          <Line yAxisId="loss" type="monotone" dataKey="loss" stroke="#e11d48" dot={false} isAnimationActive={false} />
          <Line yAxisId="reward" type="monotone" dataKey="reward" stroke="#0ea5e9" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Notes:
- `isAnimationActive={false}` — Recharts tweening at live data rates causes stutter (PITFALLS P27 defense at the component level).
- Dual Y axis — loss on left, reward on right — so SFT and GRPO coexist cleanly (TRN-03).
- Imported `TrainPoint` type keeps Plan 03's `useChat onData` handler type-safe.
  </action>
  <verify>
    <automated>grep -n "'use client'" 'app/(demo)/LossChart.tsx' && grep -n "recharts" 'app/(demo)/LossChart.tsx' && grep -n "LineChart" 'app/(demo)/LossChart.tsx' && grep -n "TrainPoint" 'app/(demo)/LossChart.tsx' && grep -n "isAnimationActive={false}" 'app/(demo)/LossChart.tsx' && pnpm next build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - app/(demo)/LossChart.tsx contains exact strings `'use client'`, `recharts`, `LineChart`, `TrainPoint`, `isAnimationActive={false}`
    - Exports named `LossChart` receiving `{ points: TrainPoint[] }`
    - `pnpm next build` succeeds
  </acceptance_criteria>
  <done>LossChart component compiles and is ready for Plan 03 to mount.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> /api/train | Untrusted JSON body controls mode/iters/model |
| /api/train -> mlx_lm subprocess | Node spawns an OS process; arg injection is high-impact |
| mlx_lm stdout -> SSE stream | Subprocess output is piped to the client |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-07 | Tampering/EoP | spawn argv injection via `model` field | mitigate | Closed regex `/^[\w\-./]+$/` on model; argv is a literal array with no shell interpolation (ASVS V12); `shell: false` is the spawn default |
| T-02-08 | DoS | Orphan subprocess on hot-reload | mitigate | Module-scoped `CHILDREN` Map + `req.signal abort` + `process.on('beforeExit')` SIGTERM; `dynamic='force-dynamic'` prevents static optimization (PITFALLS P16) |
| T-02-09 | DoS/Cost | Request claims `iters: 1_000_000` | mitigate | Cap `iters <= 2000` (CLAUDE.md hard constraint: no runs >20 min) |
| T-02-10 | Information Disclosure | Provider/subprocess error leaks env | mitigate | Truncate error strings to 400 chars; never echo `process.env` contents |
| T-02-11 | Tampering | Unknown `mode` triggers undefined binary | mitigate | Ternary narrows to `'sft'|'grpo'`; any other value falls to `'sft'` default |
| T-02-12 | EoP | Public dev route exposed to LAN | accept | Same disposition as T-02-06 in Plan 01; single-operator demo |
</threat_model>

<verification>
- `pnpm next build` completes with 0 TS errors.
- `app/api/train/route.ts` contains: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `PYTHONUNBUFFERED`, `readline.createInterface`, `data-train`, `SIGTERM`.
- `pnpm vitest run lib/streams/trainParser.test.ts` (or `node --test`) passes all 6 cases.
- Manual: `curl -N -X POST http://localhost:3000/api/train -d '{"mode":"sft","iters":10}'` streams `data-train` lines; Sentry dashboard shows a `training.sft` span with `loss.iter.0..9` attributes.
</verification>

<success_criteria>
- ORC-04 satisfied: `/api/train` spawns `mlx_lm.lora` and emits live `data-train` parts.
- ORC-05 (training half) satisfied: `training.sft` / `training.grpo` spans with per-iter attrs land in Sentry.
- `LossChart.tsx` ships and is importable by Plan 03's demo page.
</success_criteria>

<output>
After completion, create `.planning/phases/02-orchestrator-harness/02-02-SUMMARY.md`. Include: curl output sample (first 5 `data-train` lines), Sentry span URL, and the exact mlx_lm binary path used (for Phase 5 to pin).
</output>
