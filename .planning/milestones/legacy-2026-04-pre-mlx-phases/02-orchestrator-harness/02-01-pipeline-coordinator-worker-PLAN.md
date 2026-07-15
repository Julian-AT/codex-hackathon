---
phase: 02-orchestrator-harness
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/pipeline/route.ts
  - lib/coordinator/coordinator.ts
  - lib/coordinator/spawnWorker.ts
  - lib/coordinator/taskNotification.ts
  - lib/workers/roles.ts
  - lib/streams/mergeWriter.ts
  - lib/observability/agentSpans.ts
autonomous: true
requirements: [ORC-01, ORC-02, ORC-05]

must_haves:
  truths:
    - "`/api/pipeline` merges >=2 live parallel worker streams into one client SSE via `createUIMessageStream` + `writer.merge({sendStart:false, sendFinish:false})`."
    - "Coordinator agent never performs domain work; only emits `spawnWorker` tool calls."
    - "Each spawned worker returns a persistent `data-task-notification` part (transient:false) keyed by a unique worker id."
    - "Every worker invocation is wrapped in a `Sentry.startSpan({op:'ai.agent', name:'worker.${role}'})`."
    - "`/api/pipeline` route file declares `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`."
  artifacts:
    - path: "app/api/pipeline/route.ts"
      provides: "Coordinator SSE endpoint with merged worker streams"
      exports: ["POST", "runtime", "dynamic"]
      contains: "createUIMessageStream"
    - path: "lib/coordinator/coordinator.ts"
      provides: "Experimental_Agent coordinator constructor"
    - path: "lib/coordinator/spawnWorker.ts"
      provides: "zod-validated spawnWorker tool factory"
      contains: "z.enum"
    - path: "lib/coordinator/taskNotification.ts"
      provides: "Typed helpers for data-task-notification parts"
    - path: "lib/workers/roles.ts"
      provides: "Role stubs (discovery/tool-design/data-gen-qa/data-gen-traj/eval-gen)"
    - path: "lib/streams/mergeWriter.ts"
      provides: "writer.merge wrapper with framing suppression + span context"
      contains: "sendStart: false"
    - path: "lib/observability/agentSpans.ts"
      provides: "withAgentSpan helper"
      contains: "ai.agent"
  key_links:
    - from: "app/api/pipeline/route.ts"
      to: "lib/coordinator/coordinator.ts"
      via: "createCoordinator()"
      pattern: "createCoordinator\\("
    - from: "lib/coordinator/spawnWorker.ts"
      to: "lib/streams/mergeWriter.ts"
      via: "mergeWorkerStream"
      pattern: "writer\\.merge"
    - from: "lib/coordinator/spawnWorker.ts"
      to: "lib/observability/agentSpans.ts"
      via: "withAgentSpan"
      pattern: "withAgentSpan\\("
---

<objective>
Build the laptop-side coordinator/worker harness that fans N parallel worker sub-streams into a single client SSE via AI SDK v6 `createUIMessageStream` + `writer.merge`, and wrap every worker invocation in a Sentry `ai.agent` span.

Purpose: Unblocks Phases 3-5. Every downstream worker (discovery, tool-design, data-gen-QA, data-gen-traj, eval-gen) docks into this exact surface. Without this route, no worker can stream status to the grid.
Output: Working `/api/pipeline` POST endpoint + coordinator module + spawnWorker tool that launches >=2 parallel workers and emits merged SSE parts.
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

<interfaces>
<!-- Pinned from Phase 1 scaffold (01-01). Use these EXACT import paths and versions. -->
- `ai@^6.0.168` — `import { createUIMessageStream, Experimental_Agent as Agent, tool, stepCountIs } from 'ai'`
- `@ai-sdk/anthropic@^3.0.71` — `import { anthropic } from '@ai-sdk/anthropic'`
- `@ai-sdk/google@^3.0.64` — `import { google } from '@ai-sdk/google'` (fallback when Anthropic 429s per PITFALLS P22)
- `@sentry/nextjs@^10.49.0` — `import * as Sentry from '@sentry/nextjs'`
- `zod@^3.25.76` — `import { z } from 'zod'`
- `p-limit@^6` — `import pLimit from 'p-limit'` (install if absent: `pnpm add p-limit@^6`)

<!-- Sentry init comes from Phase 1's app/instrumentation.ts + sentry.server.config.ts. Do NOT re-init; just call Sentry.startSpan. -->

<!-- Typed part shapes (PRD §10.4) — mirror these exactly in taskNotification.ts -->
type AgentStatus = { role: string; status: 'running'|'ok'|'err'|'timeout'; step?: string; lastLine?: string };
type TaskNotification = { taskId: string; status: 'ok'|'err'|'timeout'; summary: string; result?: string; usage?: unknown };
type TrainPoint = { iter: number; loss?: number; reward?: number };
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Scaffold lib modules (coordinator, spawnWorker, taskNotification, roles, mergeWriter, agentSpans)</name>
  <files>lib/coordinator/coordinator.ts, lib/coordinator/spawnWorker.ts, lib/coordinator/taskNotification.ts, lib/workers/roles.ts, lib/streams/mergeWriter.ts, lib/observability/agentSpans.ts</files>
  <read_first>
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 1, Pattern 3, Pitfall 1, 2, 3)
    - .planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md (pinned deps, runtime='nodejs' pattern)
    - PRD_SPEC.md sections 10.1, 10.2, 10.3, 10.4, 12.2
    - package.json (confirm ai@^6.0.168, @sentry/nextjs, zod present; add p-limit if missing)
  </read_first>
  <action>
Verify AI SDK v6 exports before writing any import line:
```bash
node -e "const ai = require('ai'); console.log(Object.keys(ai).filter(k => /Agent|Stream|writer|Tool|step/i.test(k)));"
```
Record output at the top of coordinator.ts as a comment. If `Experimental_Agent` is absent but `ToolLoopAgent` is present, use `ToolLoopAgent` instead (aliased `as Agent`).

1. **lib/observability/agentSpans.ts** — Export `withAgentSpan<T>(role: string, id: string, fn: (span: Sentry.Span) => Promise<T>): Promise<T>` that calls `Sentry.startSpan({ op: 'ai.agent', name: \`worker.${role}\` }, async (span) => { span.setAttribute('worker.role', role); span.setAttribute('worker.id', id); return fn(span); })`. Also export `setToolCallAttributes(name: string, args: unknown)` that does `Sentry.getActiveSpan()?.setAttribute('gen_ai.tool.name', name)` + `.setAttribute('gen_ai.tool.arguments', JSON.stringify(args).slice(0, 2000))` (defensive vs PITFALLS P11).

2. **lib/coordinator/taskNotification.ts** — Export types `AgentStatus`, `TaskNotification` (shapes from interfaces block above) and helpers:
   - `buildStatusPart(id: string, data: AgentStatus)` -> `{ type: 'data-agent-status', id, data, transient: true }`
   - `buildNotificationPart(id: string, data: TaskNotification)` -> `{ type: 'data-task-notification', id, data, transient: false }`

3. **lib/streams/mergeWriter.ts** — Export `mergeWorkerStream(parent: UIMessageStreamWriter, sub: UIMessageStream): void` that calls `parent.merge(sub, { sendStart: false, sendFinish: false })`. Do NOT omit the options object — phantom `start`/`finish` parts break `useChat` state (PITFALLS P9).

4. **lib/workers/roles.ts** — Export `const WORKER_ROLES = ['discovery','tool-design','data-gen-qa','data-gen-traj','eval-gen'] as const;` and `type WorkerRole = typeof WORKER_ROLES[number];`. Each role stub is a function `runRole(role: WorkerRole, prompt: string): Promise<{ text: string; usage?: unknown }>` that for Phase 2 just calls `generateText` with `anthropic('claude-opus-4-5')` and returns text + usage. Bodies for Phases 3/4/5 land later; this is the contract.

5. **lib/coordinator/spawnWorker.ts** — Export `createSpawnWorkerTool(writer: UIMessageStreamWriter, limiter: pLimit.Limit)` that returns `tool({...})` with:
   - zod parameter schema: `z.object({ id: z.string().min(1), role: z.enum(WORKER_ROLES), prompt: z.string().min(1) })`
   - `execute: async ({ id, role, prompt }) => limiter(() => withAgentSpan(role, id, async (span) => { ... }))`
   - Inside: emit `buildStatusPart(id, { role, status: 'running', step: 'boot' })` via `writer.write`, build a sub-stream via `createUIMessageStream` whose execute calls `runRole(role, prompt)` then writes `buildNotificationPart(id, { taskId: id, status: 'ok', summary: result.text.slice(0,200), result: result.text, usage: result.usage })`. Wrap runRole in `AbortSignal.timeout(90_000)` (PITFALLS P10). On timeout/error, emit `buildNotificationPart(id, { taskId: id, status: 'timeout' | 'err', summary: e.message })`. Then `mergeWorkerStream(writer, subStream)`. Return `{ taskId: id, status: 'spawned' }`.
   - Call `setToolCallAttributes('spawnWorker', { id, role })` inside the span for PITFALLS P11 defense.

6. **lib/coordinator/coordinator.ts** — Export `createCoordinator(writer: UIMessageStreamWriter)` that returns `new Agent({ model: anthropic('claude-opus-4-5'), stopWhen: stepCountIs(8), tools: { spawnWorker: createSpawnWorkerTool(writer, pLimit(15)) }, system: 'You are a coordinator. You NEVER do work yourself. You only call spawnWorker to delegate. Always launch at least 2 workers in parallel when asked.' })`. Coordinator MUST NOT include any other tool; the no-domain-work rule (PRD §10.2 #1) is enforced by tool allowlist.
  </action>
  <verify>
    <automated>node -e "require('./lib/observability/agentSpans.ts')" 2>&1 | head -5; grep -n "sendStart: false" lib/streams/mergeWriter.ts && grep -n "sendFinish: false" lib/streams/mergeWriter.ts && grep -n "stepCountIs(8)" lib/coordinator/coordinator.ts && grep -n "z.enum(WORKER_ROLES)" lib/coordinator/spawnWorker.ts && grep -n "ai.agent" lib/observability/agentSpans.ts && grep -n "90_000\\|90000" lib/coordinator/spawnWorker.ts</automated>
  </verify>
  <acceptance_criteria>
    - lib/streams/mergeWriter.ts contains exact string `sendStart: false` AND `sendFinish: false`
    - lib/observability/agentSpans.ts contains exact string `'ai.agent'` AND `worker.role` AND `worker.id`
    - lib/observability/agentSpans.ts contains `gen_ai.tool.name` AND `gen_ai.tool.arguments` (defense per PITFALLS P11)
    - lib/coordinator/coordinator.ts contains `stepCountIs(8)` (step cap per PITFALLS P10)
    - lib/coordinator/spawnWorker.ts contains `z.enum(WORKER_ROLES)` AND `90_000` (or `90000`) AND `AbortSignal.timeout`
    - lib/coordinator/taskNotification.ts contains `transient: true` (status) AND `transient: false` (notification)
    - lib/workers/roles.ts exports `WORKER_ROLES` array with exact entries `discovery`, `tool-design`, `data-gen-qa`, `data-gen-traj`, `eval-gen`
    - `pnpm tsc --noEmit` exits 0 (if tsc is wired in Phase 1) OR `node --check` on compiled output exits 0
  </acceptance_criteria>
  <done>All 6 module files exist with the exact strings listed; module exports resolve; no TypeScript errors in the lib/ tree.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build /api/pipeline route with createUIMessageStream + merged workers</name>
  <files>app/api/pipeline/route.ts</files>
  <read_first>
    - app/api/smoke/route.ts (from Phase 1 01-01 — use as reference for runtime='nodejs' declaration, provider import pattern, error truncation)
    - lib/coordinator/coordinator.ts (just created in Task 1)
    - lib/coordinator/spawnWorker.ts (just created in Task 1)
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pattern 1 full code example)
    - PRD_SPEC.md section 10.4
  </read_first>
  <action>
Create `app/api/pipeline/route.ts` with:

```typescript
// app/api/pipeline/route.ts
import { createUIMessageStream } from 'ai';
import { createCoordinator } from '@/lib/coordinator/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({ prompt: 'Launch 2 discovery workers in parallel for smoke test.' }));
  const prompt = typeof body.prompt === 'string' ? body.prompt : 'Launch 2 discovery workers in parallel.';

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const coordinator = createCoordinator(writer);
      req.signal.addEventListener('abort', () => {
        // AbortSignal propagates into agent.generate via its own signal option
      });
      try {
        await coordinator.generate({ prompt, abortSignal: req.signal });
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 400) : 'coordinator error';
        writer.write({ type: 'data-agent-status', id: 'coordinator', data: { role: 'coordinator', status: 'err', step: msg }, transient: true });
      }
    },
  });

  return stream.toResponse();
}
```

Notes:
- `runtime='nodejs'` is mandatory (child_process is used in /api/train; consistency + AI SDK Node APIs).
- `dynamic='force-dynamic'` avoids static optimization of this POST route.
- Truncate error messages to 400 chars (ASVS V7, matches Phase 1 pattern) — never echo raw provider headers.
- `@/lib/*` alias should already be configured by Phase 1's tsconfig.json `paths`. If not, use relative import `../../../lib/coordinator/coordinator`.
  </action>
  <verify>
    <automated>grep -n "runtime = 'nodejs'" app/api/pipeline/route.ts && grep -n "dynamic = 'force-dynamic'" app/api/pipeline/route.ts && grep -n "createUIMessageStream" app/api/pipeline/route.ts && grep -n "createCoordinator" app/api/pipeline/route.ts && grep -n "stream.toResponse" app/api/pipeline/route.ts && pnpm next build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - app/api/pipeline/route.ts contains exact string `runtime = 'nodejs'`
    - app/api/pipeline/route.ts contains exact string `dynamic = 'force-dynamic'`
    - app/api/pipeline/route.ts contains exact string `createUIMessageStream`
    - app/api/pipeline/route.ts contains exact string `createCoordinator`
    - app/api/pipeline/route.ts exports async function `POST`
    - `pnpm next build` (or `npm run build`) completes without TypeScript errors for this route
  </acceptance_criteria>
  <done>Route file exists with all required exports; production build succeeds.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Integration smoke — 2-worker parallel merge with phantom-framing assertion</name>
  <files>scripts/smoke-pipeline.ts, app/api/pipeline/route.ts</files>
  <read_first>
    - app/api/pipeline/route.ts (just created)
    - .planning/phases/02-orchestrator-harness/02-RESEARCH.md (Pitfall 1: phantom start/finish)
  </read_first>
  <action>
Create `scripts/smoke-pipeline.ts` (invoke via `pnpm tsx scripts/smoke-pipeline.ts` against a running `pnpm next start` on port 3000):

```typescript
// scripts/smoke-pipeline.ts
// Smoke: POST /api/pipeline, count start parts and task-notifications.
// MUST observe exactly 1 top-level 'start' and >=2 distinct task-notification ids.
const res = await fetch('http://localhost:3000/api/pipeline', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'Launch exactly 2 discovery workers named w1 and w2 in parallel. Do nothing else.' }),
});
if (!res.ok) throw new Error(`status ${res.status}`);
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = '';
let startCount = 0;
const notificationIds = new Set<string>();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  for (const line of buf.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.type === 'start') startCount++;
        if (obj.type === 'data-task-notification') notificationIds.add(obj.id);
      } catch {}
    }
  }
}
if (startCount !== 1) { console.error(`FAIL: expected 1 start, got ${startCount}`); process.exit(1); }
if (notificationIds.size < 2) { console.error(`FAIL: expected >=2 distinct notification ids, got ${notificationIds.size}`); process.exit(1); }
console.log(`OK: 1 start, ${notificationIds.size} task-notifications`);
process.exit(0);
```

Pre-flight: `pnpm next build && pnpm next start &` then run the smoke script. If `tsx` not installed, add it: `pnpm add -D tsx`.

Document in a comment block that this script is run manually (not in CI) because it requires live provider keys.
  </action>
  <verify>
    <automated>test -f scripts/smoke-pipeline.ts && grep -n "startCount !== 1" scripts/smoke-pipeline.ts && grep -n "notificationIds.size < 2" scripts/smoke-pipeline.ts && grep -n "/api/pipeline" scripts/smoke-pipeline.ts</automated>
  </verify>
  <acceptance_criteria>
    - scripts/smoke-pipeline.ts exists and contains `startCount !== 1` assertion
    - scripts/smoke-pipeline.ts contains `notificationIds.size < 2` assertion (proves 2 merged workers)
    - Manual run (after `pnpm next build && pnpm next start`) prints `OK: 1 start, 2 task-notifications` and exits 0 (PITFALLS P9 verified — single start means `writer.merge` framing suppression works)
    - Sentry dashboard shows >=2 spans with `op=ai.agent` and distinct `worker.id` attributes during/after the smoke run (manual verification — paste span URL into plan SUMMARY)
  </acceptance_criteria>
  <done>Smoke script exists and exits 0 against live dev server; Sentry shows ai.agent spans.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client browser -> /api/pipeline | Public route during local dev; untrusted request bodies cross here |
| coordinator agent -> spawnWorker tool | LLM-generated tool arguments cross into backend code |
| spawnWorker tool -> provider APIs | Our backend calls paid frontier APIs |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering/EoP | spawnWorker tool parameters | mitigate | zod `z.enum(WORKER_ROLES)` closes role set; `z.string().min(1)` on id+prompt; rejected args never reach `runRole` |
| T-02-02 | DoS | ToolLoopAgent unbounded | mitigate | `stepCountIs(8)` + `AbortSignal.timeout(90_000)` per worker (PITFALLS P10) |
| T-02-03 | DoS/Cost | Concurrent worker spawn burst | mitigate | `p-limit(15)` on every spawn; 429 from Anthropic falls over to Gemini (PITFALLS P22) |
| T-02-04 | Information Disclosure | Provider error bodies leak tokens | mitigate | Truncate error strings to 400 chars; never echo headers |
| T-02-05 | Tampering | Hallucinated tool call crashes route | mitigate | spawnWorker `execute` catches all throws, emits `status:'err'` notification; coordinator never writes to stream directly on error |
| T-02-06 | EoP/DoS | Public dev route exposed to LAN | accept | Single-operator local-dev demo per PRD §19.4; pre-deploy removal tracked in Phase 1 T-01-03 |
</threat_model>

<verification>
- `pnpm next build` succeeds with 0 TypeScript errors.
- `app/api/pipeline/route.ts` contains `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` + `createUIMessageStream`.
- Smoke script exits 0 with exactly 1 `start` event + >=2 distinct task-notification ids.
- Sentry dashboard shows `op=ai.agent` spans with `worker.role` + `worker.id` attributes.
- Grep `gen_ai.tool.name:spawnWorker` in Sentry returns at least one span (defense vs PITFALLS P11 verified).
</verification>

<success_criteria>
- ORC-01 satisfied: merged SSE with single start event across >=2 parallel workers.
- ORC-02 satisfied: coordinator tools allowlist = [spawnWorker] only; workers return via `data-task-notification`.
- ORC-05 (worker half) satisfied: every worker invocation emits an `ai.agent` span with role/id attrs.
- Downstream Plans (02-02 grid, 02-03 train) have a stable `/api/pipeline` contract to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/02-orchestrator-harness/02-01-SUMMARY.md` per the SUMMARY template, including: final `Object.keys(require('ai'))` output, the Sentry span URL from the smoke run, and any deviation from the research doc's Pattern 1 shape.
</output>
