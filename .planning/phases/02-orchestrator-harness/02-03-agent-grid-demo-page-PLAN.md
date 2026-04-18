---
phase: 02-orchestrator-harness
plan: 03
type: execute
wave: 2
depends_on: [02-01, 02-02]
files_modified:
  - app/(demo)/page.tsx
  - app/(demo)/AgentGrid.tsx
  - app/(demo)/AgentCard.tsx
  - app/(demo)/useDemoStream.ts
autonomous: true
requirements: [ORC-03]

must_haves:
  truths:
    - "Demo page mounts `useChat({api:'/api/pipeline', onData})` and routes `data-agent-status` (transient) and `data-task-notification` (persistent) by type."
    - "`AgentGrid` renders a 5-column by 4-row CSS grid of `AgentCard`, keyed by worker id (capacity 20)."
    - "`AgentCard` displays id, role, status, step, and optional lastLine, with visual states for running/ok/err/timeout."
    - "`LossChart` (from Plan 02-02) is mounted on the same page, fed by `data-train` parts."
    - "A single `useChat` call subscribes to `/api/pipeline` and a separate `useChat` (or `fetch` stream) consumes `/api/train`, both routed through a shared `useDemoStream` hook."
  artifacts:
    - path: "app/(demo)/page.tsx"
      provides: "Demo page mounting AgentGrid + LossChart"
      contains: "AgentGrid"
    - path: "app/(demo)/AgentGrid.tsx"
      provides: "5x4 CSS grid of AgentCard"
      contains: "grid-cols-5"
    - path: "app/(demo)/AgentCard.tsx"
      provides: "Single worker card with status color + lastLine"
    - path: "app/(demo)/useDemoStream.ts"
      provides: "Shared stream-to-state hook (useChat onData router)"
      contains: "data-agent-status"
  key_links:
    - from: "app/(demo)/page.tsx"
      to: "app/(demo)/AgentGrid.tsx"
      via: "import"
      pattern: "import.*AgentGrid"
    - from: "app/(demo)/page.tsx"
      to: "app/(demo)/LossChart.tsx"
      via: "import"
      pattern: "import.*LossChart"
    - from: "app/(demo)/useDemoStream.ts"
      to: "/api/pipeline"
      via: "useChat({api:'/api/pipeline'})"
      pattern: "/api/pipeline"
    - from: "app/(demo)/useDemoStream.ts"
      to: "/api/train"
      via: "fetch POST + SSE reader"
      pattern: "/api/train"
---

<objective>
Build the client-side rendering of the orchestrator harness: a 5x4 AgentCard grid that populates live from `/api/pipeline` via `useChat({onData})`, plus a mounted `LossChart` fed from `/api/train` — both on a single demo page. This closes ORC-03 and gives Phase 5 onwards a stable UI to stream into.

Purpose: Without this page, ORC-03 is unsatisfied and no downstream phase has a screen to demo.
Output: `/` demo page renders an empty 5x4 grid on mount and populates slots as workers emit status/notification parts.
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
@.planning/phases/02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md
@.planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md
@.planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md

<interfaces>
<!-- Part shapes produced by Plans 02-01 and 02-02 (must match exactly) -->
type AgentStatus = { role: string; status: 'running'|'ok'|'err'|'timeout'; step?: string; lastLine?: string };
type TaskNotification = { taskId: string; status: 'ok'|'err'|'timeout'; summary: string; result?: string; usage?: unknown };
type TrainPoint = { iter: number; loss?: number; reward?: number };

<!-- Stream shapes -->
// /api/pipeline emits: { type: 'data-agent-status', id, data: AgentStatus, transient: true }
//                      { type: 'data-task-notification', id, data: TaskNotification, transient: false }
// /api/train    emits: { type: 'data-train', data: TrainPoint, transient: true }

<!-- AI SDK v6 client hook -->
// `import { useChat } from 'ai/react'` (v6 beta export surface). If Plan 02-01's v6 scaffold revealed a different
// import path (e.g. 'ai' root), prefer whatever Plan 02-01's SUMMARY recorded.

<!-- Components to import (already exist from Plan 02-02) -->
import { LossChart } from './LossChart';
import type { TrainPoint } from '@/lib/streams/trainParser';
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: useDemoStream hook + AgentCard + AgentGrid components</name>
  <files>app/(demo)/useDemoStream.ts, app/(demo)/AgentCard.tsx, app/(demo)/AgentGrid.tsx</files>
  <read_first>
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 3, Code example: AgentCard grid sizing)
    - .planning/phases/02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md (part shapes)
    - .planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md (TrainPoint type)
    - app/layout.tsx (from Phase 1 — confirm whether Tailwind is wired; if not, use inline styles)
  </read_first>
  <action>
1. **app/(demo)/useDemoStream.ts** — Client hook:
```typescript
'use client';
import { useChat } from 'ai/react';
import { useCallback, useEffect, useState } from 'react';
import type { TrainPoint } from '@/lib/streams/trainParser';

export type AgentStatus = { role: string; status: 'running'|'ok'|'err'|'timeout'; step?: string; lastLine?: string };
export type TaskNotification = { taskId: string; status: 'ok'|'err'|'timeout'; summary: string; result?: string; usage?: unknown };

export function useDemoStream() {
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});
  const [notifications, setNotifications] = useState<Record<string, TaskNotification>>({});
  const [train, setTrain] = useState<TrainPoint[]>([]);

  const { sendMessage, status: pipelineStatus } = useChat({
    api: '/api/pipeline',
    onData: (part: any) => {
      if (part.type === 'data-agent-status') {
        setAgents((p) => ({ ...p, [part.id]: part.data as AgentStatus }));
      } else if (part.type === 'data-task-notification') {
        const n = part.data as TaskNotification;
        setNotifications((p) => ({ ...p, [part.id]: n }));
        // Promote terminal status onto agents map so card turns green/red
        setAgents((p) => ({ ...p, [part.id]: { ...(p[part.id] ?? { role: 'unknown' }), status: n.status } }));
      }
    },
  });

  const startTrain = useCallback(async (mode: 'sft'|'grpo', iters: number) => {
    const res = await fetch('/api/train', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, iters }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.type === 'data-train' && obj.data) {
            setTrain((p) => [...p, obj.data as TrainPoint]);
          }
        } catch {}
      }
    }
  }, []);

  return { agents, notifications, train, sendMessage, pipelineStatus, startTrain };
}
```

2. **app/(demo)/AgentCard.tsx**:
```typescript
'use client';
import type { AgentStatus } from './useDemoStream';

const COLOR: Record<AgentStatus['status'], string> = {
  running: '#60a5fa',
  ok: '#22c55e',
  err: '#ef4444',
  timeout: '#f59e0b',
};

export function AgentCard({ id, status, role, step, lastLine }: { id: string } & AgentStatus) {
  return (
    <div style={{ border: `2px solid ${COLOR[status]}`, borderRadius: 8, padding: 8, minHeight: 96, fontFamily: 'monospace', fontSize: 11, background: '#0a0a0a', color: '#f5f5f5' }}>
      <div style={{ opacity: 0.7 }}>{id}</div>
      <div style={{ fontWeight: 600 }}>{role}</div>
      <div style={{ color: COLOR[status] }}>{status}{step ? ` · ${step}` : ''}</div>
      {lastLine ? <div style={{ opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastLine}</div> : null}
    </div>
  );
}
```

3. **app/(demo)/AgentGrid.tsx**:
```typescript
'use client';
import { AgentCard } from './AgentCard';
import type { AgentStatus } from './useDemoStream';

export function AgentGrid({ agents }: { agents: Record<string, AgentStatus> }) {
  const entries = Object.entries(agents).slice(0, 20);
  // Pad to 20 slots so the grid always shows 5x4
  const slots: ([string, AgentStatus] | null)[] = [...entries];
  while (slots.length < 20) slots.push(null);
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 8 }}
      data-rows="4"
      data-cols="5"
    >
      {slots.map((slot, i) =>
        slot ? <AgentCard key={slot[0]} id={slot[0]} {...slot[1]} /> : <div key={`empty-${i}`} style={{ border: '1px dashed #27272a', borderRadius: 8, minHeight: 96 }} />,
      )}
    </div>
  );
}
```

Exact strings required in acceptance (grep targets): `repeat(5, 1fr)`, `repeat(4, 1fr)`, `data-cols="5"`, `data-rows="4"`, `data-agent-status`, `data-task-notification`, `data-train`, `/api/pipeline`, `/api/train`.
  </action>
  <verify>
    <automated>grep -n "repeat(5, 1fr)" 'app/(demo)/AgentGrid.tsx' && grep -n "repeat(4, 1fr)" 'app/(demo)/AgentGrid.tsx' && grep -n 'data-cols="5"' 'app/(demo)/AgentGrid.tsx' && grep -n 'data-rows="4"' 'app/(demo)/AgentGrid.tsx' && grep -n "data-agent-status" 'app/(demo)/useDemoStream.ts' && grep -n "data-task-notification" 'app/(demo)/useDemoStream.ts' && grep -n "/api/pipeline" 'app/(demo)/useDemoStream.ts' && grep -n "/api/train" 'app/(demo)/useDemoStream.ts' && pnpm next build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - app/(demo)/useDemoStream.ts contains `data-agent-status`, `data-task-notification`, `data-train`, `/api/pipeline`, `/api/train`, `useChat`, `onData`
    - app/(demo)/AgentCard.tsx has `'use client'` directive and renders status color per status enum
    - app/(demo)/AgentGrid.tsx contains `repeat(5, 1fr)` AND `repeat(4, 1fr)` AND `data-cols="5"` AND `data-rows="4"`
    - `pnpm next build` succeeds
  </acceptance_criteria>
  <done>All three client files exist, build passes, exact grid dims verified via grep.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Demo page mounting AgentGrid + LossChart + pipeline trigger</name>
  <files>app/(demo)/page.tsx</files>
  <read_first>
    - app/(demo)/useDemoStream.ts (just created)
    - app/(demo)/AgentGrid.tsx (just created)
    - app/(demo)/LossChart.tsx (from Plan 02-02)
    - app/page.tsx (from Phase 1; may need to remove or redirect to /(demo))
    - .planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md (layout conventions)
  </read_first>
  <action>
Create `app/(demo)/page.tsx`:
```typescript
'use client';
import { useDemoStream } from './useDemoStream';
import { AgentGrid } from './AgentGrid';
import { LossChart } from './LossChart';

export default function DemoPage() {
  const { agents, notifications, train, sendMessage, pipelineStatus, startTrain } = useDemoStream();
  const notificationCount = Object.keys(notifications).length;

  return (
    <main style={{ padding: 24, background: '#050505', color: '#f5f5f5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Orchestrator Harness</h1>
        <span style={{ opacity: 0.6, fontSize: 12 }}>
          pipeline: {pipelineStatus} · workers: {Object.keys(agents).length}/20 · notifications: {notificationCount}
        </span>
        <button
          onClick={() => sendMessage({ text: 'Launch 2 discovery workers named w1 and w2 in parallel.' })}
          style={{ padding: '6px 12px', background: '#1e293b', color: '#f5f5f5', border: '1px solid #334155', borderRadius: 6 }}
        >
          Smoke: 2 workers
        </button>
        <button
          onClick={() => startTrain('sft', 20)}
          style={{ padding: '6px 12px', background: '#1e293b', color: '#f5f5f5', border: '1px solid #334155', borderRadius: 6 }}
        >
          Smoke: SFT 20 iter
        </button>
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, opacity: 0.7, margin: '0 0 8px' }}>Agents (5 × 4)</h2>
        <AgentGrid agents={agents} />
      </section>

      <section>
        <h2 style={{ fontSize: 14, opacity: 0.7, margin: '0 0 8px' }}>Training loss / reward</h2>
        <LossChart points={train} />
      </section>
    </main>
  );
}
```

If `app/page.tsx` (from Phase 1) still exists and claims `/`, either delete it or replace its body with a `redirect('/(demo)')` or inline the demo content. Simplest: the `(demo)` route group doesn't add a path segment, so `app/(demo)/page.tsx` IS `/`. Delete `app/page.tsx` if it lives at `/` too, or merge.

Confirm with `pnpm next build` — two `page.tsx` files claiming `/` will fail the build.
  </action>
  <verify>
    <automated>grep -n "AgentGrid" 'app/(demo)/page.tsx' && grep -n "LossChart" 'app/(demo)/page.tsx' && grep -n "useDemoStream" 'app/(demo)/page.tsx' && grep -n "'use client'" 'app/(demo)/page.tsx' && pnpm next build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - app/(demo)/page.tsx contains exact strings `AgentGrid`, `LossChart`, `useDemoStream`, `'use client'`
    - `pnpm next build` succeeds (no duplicate-route errors)
    - Manual: `pnpm next start` then visit http://localhost:3000 — page renders an empty 5×4 grid and empty chart; click "Smoke: 2 workers" populates >=2 cards; click "Smoke: SFT 20 iter" renders a loss line
  </acceptance_criteria>
  <done>Demo page renders, build succeeds, manual smoke populates grid and chart.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification of merged orchestrator surface</name>
  <what-built>
A complete Phase 2 orchestrator harness:
- `/api/pipeline` streaming merged worker SSE (Plan 02-01)
- `/api/train` streaming mlx_lm subprocess output (Plan 02-02)
- `/` demo page with 5x4 agent grid + Recharts loss chart (this plan)
  </what-built>
  <how-to-verify>
1. `pnpm next build && pnpm next start` (do NOT use `pnpm next dev` per PITFALLS P16 — hot-reload orphans the mlx_lm subprocess).
2. Visit http://localhost:3000. Confirm the 5×4 grid has 20 dashed empty slots.
3. Click "Smoke: 2 workers". Expected within ~15 s:
   - At least 2 grid slots populate with role + status `running` (blue border).
   - Both slots terminate on `ok` (green) or `err`/`timeout` (red/amber).
4. Open Sentry dashboard. Filter by `op:ai.agent`. Confirm at least 2 spans with distinct `worker.id` attributes from the last 2 minutes.
5. Click "Smoke: SFT 20 iter". Expected within ~60 s:
   - Loss line appears in the chart, climbing across x-axis (iter).
   - Sentry dashboard shows a `training.sft` span with `loss.iter.0..19` attributes.
6. Confirm `OnlineMonitor`-like network-sensitivity is NOT required in this phase (that's Phase 6).
  </how-to-verify>
  <resume-signal>Type "approved" if all 6 verifications pass. Otherwise, describe which step failed and paste the Sentry span URL or the browser console error.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> /api/pipeline, /api/train | Client-initiated requests (same boundaries as Plans 02-01 and 02-02) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-13 | Information Disclosure | `notifications` state displays `result` text that may include provider-returned content | accept | Single-operator localhost demo; no multi-user surface. Strings rendered as text (React auto-escapes), no `dangerouslySetInnerHTML`. |
| T-02-14 | DoS | Unbounded `train` state array fills memory at >20k iter | mitigate | PRD caps iters at 400 (SFT) + 150 (GRPO); cap hard-coded to 2000 in Plan 02-02. Memory ceiling ~2000 objects * ~40 bytes = <100KB, safe. |
| T-02-15 | Tampering | `onData` handler treats arbitrary server `part.data` as typed | accept | Server is our own `/api/pipeline`; not a trust boundary beyond what Plan 02-01 already validated via zod. |
</threat_model>

<verification>
- `pnpm next build` succeeds.
- All grep acceptance checks pass (AgentGrid grid dims, useDemoStream hook routing).
- Human checkpoint confirms: empty grid on load, populated grid after smoke click, chart renders loss line after SFT smoke.
- Sentry dashboard confirms `ai.agent` + `training.sft` spans in the same session.
</verification>

<success_criteria>
- ORC-03 satisfied: `useChat({onData})` routes transient status vs persistent notification into the 5×4 grid keyed by worker id.
- Downstream Phases 3/4/5/7 have a stable page surface to stream into — no client-side refactor needed.
</success_criteria>

<output>
After completion, create `.planning/phases/02-orchestrator-harness/02-03-SUMMARY.md`. Include: a 5-second screen capture of the populated grid (save as a GIF in `.planning/phases/02-orchestrator-harness/` if practical), plus the Sentry dashboard URL filtered by the session.
</output>
