# Architecture Patterns

**Domain:** Offline specialist-LLM pipeline (agent-orchestrated fine-tuning + on-device inference)
**Researched:** 2026-04-18
**Source-of-truth:** `PRD_SPEC.md` §4, §6, §8, §9, §10, §11, §12, §19.1

> This document does not re-architect. It flattens the PRD's already-pinned topology into component boundaries, contracts, and dependency ordering that the roadmapper can slice directly into phases H0–H9.

---

## 1. Runtime Topology (PRD §4.1)

Three hard boundaries. Never blurred.

| Runtime | Host | Responsibility |
|---------|------|----------------|
| **Laptop / Next.js 15 (Node ≥ 20)** | MacBook Pro M4 Pro 24 GB | Coordinator, worker swarms, data-gen, judging, eval harness, UI, Sentry, subprocess management for Python CLIs |
| **Laptop / Python CLI subprocesses** | Same machine, `child_process.spawn` | `mlx_lm.lora` (SFT), `mlx_lm_lora.train` (GRPO), `mlx_lm.fuse`, `mlx_lm.generate` (sanity). Zero application-level Python code authored. |
| **iPhone 17 / Swift 5.9 app** | Airplane-mode device | MLX Swift inference, tool-token stream parse, `JSContext` dynamic tool dispatch, `NWPathMonitor` offline gate |
| **Frontier APIs (crossing cloud → laptop only)** | Anthropic / OpenAI / Google | Teacher (Opus 4.7), Generator (GPT-5), Judges (Opus + Gemini 2.5 Pro). Laptop-only. iPhone never crosses this boundary. |

**Single data channel between laptop and iPhone:** USB-C via `xcrun devicectl`. No network, no AirDrop in hot path (AirDrop is only an R6 last-resort).

---

## 2. Component-by-Component Contract

### 2.1 Laptop / Next.js App

#### `app/api/pipeline/route.ts` — Coordinator entry (H3)
- **Owns:** end-to-end orchestration for a single product-URL run.
- **Runtime:** `export const runtime = 'nodejs'` (required — touches `child_process` downstream).
- **In:** `{ productUrl: string, productName: string }` POST body.
- **Out:** `createUIMessageStream` SSE response.
- **Emits:**
  - `data-agent-status` (transient) — `{lane, role, status, step, lastLine}` for each worker's heartbeat.
  - `data-task-notification` (persisted) — Claude-Code XML envelope `{taskId, status, summary, result, usage}` on worker termination.
- **Merges:** N parallel worker streams via `writer.merge({ sendStart: false, sendFinish: false })`.
- **Deps:** `lib/coordinator`, `lib/workers/*`, `lib/streams`.
- **Build order:** H3.

#### `app/api/train/route.ts` — SFT / GRPO subprocess manager (H3 skeleton, H6 live)
- **Owns:** lifecycle of `scripts/train.sh` and `scripts/grpo.sh`.
- **In:** `{ datasetPath, adapterOutPath, stage: 'sft'|'grpo', iters, batchSize }`.
- **Out:** SSE stream of `data-train` parts.
- **Emits:** `data-train` — `{ iter: number, loss?: number, reward?: number, stage: 'sft'|'grpo' }` at `steps-per-report=5` cadence.
- **Mechanism:** `child_process.spawn(..., { env: { PYTHONUNBUFFERED: '1' } })`, `readline` over stdout, regex against `Iter N: Train loss X` and GRPO reward line format.
- **Runtime:** `nodejs`.
- **Deps:** mlx-lm / mlx-lm-lora installed in venv, training JSONL produced by `/api/pipeline`.
- **Build order:** H3 skeleton (loss stream wired), H6 full run.

#### `app/api/eval/route.ts` — Three-way parallel eval (H8)
- **Owns:** running 70 held-out items × {base, tuned, teacher} × 2-judge jury.
- **In:** `{ evalSetPath, adapterPath, deviceHost }`.
- **Out:** JSON `{ baseScore, tunedScore, teacherScore, latencies: { onDeviceMs, cloudMs }, perItem: [...] }`.
- **Mechanism:** base + tuned queried via the iPhone app's local HTTP shim over USB-C; teacher via AI SDK; judges in parallel via `p-limit`.
- **Deps:** deployed adapter on device (H7), eval JSONL (H5), judge module `lib/judge`.
- **Build order:** H8.

#### `app/api/adapter/route.ts` — Fuse + deploy trigger (H7)
- **Owns:** `mlx_lm.fuse` invocation and `xcrun devicectl` copy.
- **In:** `{ adapterPath, deviceUDID, bundleId }`.
- **Out:** `{ fusedPath, deployedPath, elapsedMs }`.
- **Mechanism:** sequential `spawn(fuse)` → `spawn(devicectl)`. No concurrency (single-writer rule, §10.2 rule 5).
- **Deps:** adapter produced by `/api/train`, `adapter-tools.json` produced by Tool-Design Swarm.
- **Build order:** H7.

#### `lib/coordinator/` (H3)
- **Modules:** `coordinatorMode.ts` (fan-out planner), `taskNotification.ts` (XML envelope), `pLimit.ts` wrappers.
- **Contract:** public `runPipeline(productUrl, writer)` generator. Calls `spawnWorker()` tool in parallel for read-only stages, sequentially for write stages.
- **Pattern:** Claude-Code lift — coordinator never does work, only synthesizes.
- **Deps:** `lib/workers/*`, `lib/streams`.

#### `lib/workers/` — 5 ToolLoopAgent roles (H3 scaffold, H4–H5 real)
Each is an AI SDK v6 `ToolLoopAgent` with a tight allowlist (PRD §10.3).

| Worker | File | Tools allowed | Produces | H |
|--------|------|---------------|----------|---|
| Discovery | `discovery.ts` | `fetchLlmsTxt`, `fetchGithubTree`, `webSearch`, `scrapeSitemap`, `chunkAndIndex` | `data/corpus/*.json` + 70/30 doc-hash split | H4 |
| Tool-Design | `toolDesign.ts` | `validateJsBody`, `testFuzzExecute`, `generateZodSchema`, `writeToolSpec` | `DynamicToolSpec[]` → `adapter-tools.json` | H4 |
| Data-Gen-QA | `dataGenQa.ts` | `personaSample`, `genstructPrompt`, `judgeFaithfulness`, `embedDedup` | 500 QA + 100 Evol JSONL rows | H5 |
| Data-Gen-Traj | `dataGenTraj.ts` | `chainToolBlueprint`, `roleplayTrajectory`, `validateAgainstSchema`, `embedDedup` | 800 single + 200 multi + 100 parallel + 50 refusal | H5 |
| Eval-Gen | `evalGen.ts` | `splitDocsTrainEval`, `bflcASTMatch`, `generateHeldOut`, `judgeJury` | 70-item held-out set (uses 30% split only) | H5 |

Each worker emits `data-agent-status` on state change, `data-task-notification` on terminal.

#### `lib/tools/` (H3 shared, H4 domain-specific)
Shared primitives consumed by workers. **None of these are agent-authored JS tools for the iPhone** — those live in `adapter-tools.json` at runtime. These are orchestrator-side tools only.

`fetchLlmsTxt.ts`, `chunkAndIndex.ts`, `embedDedup.ts` (MinHash @ 0.7 + cosine @ 0.92), `jsonschemaValidate.ts`, `generateZodSchema.ts` (+ `zod-to-json-schema`), `validateJsBody.ts` (acorn parse), `testFuzzExecute.ts` (delegates to `lib/sandbox`), `bflcASTMatch.ts`.

#### `lib/sandbox/` — `node:vm` Worker harness (H4)
- **Owns:** secure execution of agent-authored JS tool bodies before they become training data.
- **Boundary:** `worker_threads` + `node:vm.Script`. 2s `AbortController` timeout. 64 MB RSS cap.
- **Explicit non-use:** no E2B, no WebContainers, no CodeSandbox (PRD §9.3 + §19.4).
- **In:** `{ jsBody: string, schema: JSONSchema }`.
- **Out:** `{ syntaxOk, fuzzResults: [{input, output, threw}], verdict: 'pass'|'fail', reason? }`.
- **Deps:** none (pure Node).
- **Build order:** H4 (block on Tool-Design Swarm).

#### `lib/judge/` — Cross-family jury (H5 for data-gen, H8 for eval)
- Two judges: `@ai-sdk/anthropic` (Opus 4.7) + `@ai-sdk/google` (Gemini 2.5 Pro).
- 0–4 Likert × 4 dimensions → normalized 0–1 float.
- Positional bias neutralized by shuffled column order, temperature 0.
- **Non-negotiable:** no per-dimension multi-judge (§19.4).

#### `lib/streams/` — SSE merge utilities (H3)
- Thin wrappers over `createUIMessageStream` and `writer.merge`. Encapsulates the `{sendStart: false, sendFinish: false}` pattern so individual routes don't rediscover it.

#### `instrumentation.ts` — Sentry init (H0)
- `Sentry.init({ integrations: [Sentry.vercelAIIntegration()] })`.
- Must exist before the first `generateText` call or gen_ai spans are lost.
- **Build order:** H0 (same step as first Opus smoke test).

#### `(demo)/page.tsx` — The audience-facing UI (H3 skeleton, H7/H8/H9 polish)
React client using `useChat({ onData })`. Routes events by worker `id` into:
- **5×4 `AgentCard` grid** — one card per worker lane × role.
- **Loss/reward Recharts overlay** — consumes `data-train`.
- **Three-way scoreboard** — populated from `/api/eval` output.
- **Latency stopwatch** — on-device ms vs cloud round-trip ms.
- **NWPathMonitor pill** — mirrors the iPhone pill, updated from a lightweight polled endpoint on the device.
- **`ToolCallBubble`** inline — message bubble specialization (H9).

### 2.2 iPhone / Swift (ios/)

All Swift, ~400 LOC total. Fork of `mlx-swift-examples/LLMEval`.

#### `SpecialistApp/` (H1 shell, H9 polish)
SwiftUI shell: `SpecialistApp.swift` (entrypoint), `ContentView.swift` (tab host), `AdapterLoaderView.swift` (enumerates `/Documents/*.safetensors`, triggers swap), `ChatView.swift` (streaming chat list), `ToolCallBubble.swift` (H9, renders intercepted tool call + arguments + response), `ModelState.swift` (thin façade over `SpecialistCore.ModelState`).

#### `SpecialistCore/ModelState` actor (H1)
- **Owns:** loaded `ModelContainer` (MLX Swift).
- **Lifecycle:**
  1. At app launch: load base `gemma-4-E4B-it-UD-MLX-4bit` from app sandbox (one-time, off-demo-clock).
  2. On adapter swap: call `LoRATrain.loadLoRAWeights(model:, url:)`. <2 s.
  3. Serve `generate(prompt:tools:) -> AsyncStream<Token>`.
- **Deps:** `mlx-swift-lm` 3.x, `swift-tokenizers-mlx`, `SpecialistCore/GemmaToolParser`.

#### `SpecialistCore/GemmaToolParser` (H2)
- **Owns:** regex over streaming decoder output.
- **Buffer:** accumulate until complete `<|tool_call|>…<|tool_response|>` pair captured.
- **Contract:** async iterator `parse(tokens: AsyncStream<Token>) -> AsyncStream<ParsedEvent>` where `ParsedEvent = .text(String) | .toolCall(name, argsJSON) | .toolResponse(resultJSON)`.
- **Failure mode:** malformed JSON → retry once, else emit `.toolError`. The model has been trained on failure trajectories and degrades gracefully.

#### `SpecialistCore/ToolRegistry` actor (H2)
- **Owns:** a single `JSContext`.
- **Native bridges registered at init:** `console.log`, `nativeFetch` (via `URLSession`), `Date`, bundled `CORPUS` accessor.
- **Dynamic tool load:** at adapter-swap time reads `adapter-tools.json`, `evaluateScript(jsBody)` per tool, stashes `JSValue` handle.
- **Dispatch:** `invoke(name, argsJSON) -> String` — looks up, checks `requiresNetwork` vs `OnlineMonitor.status`, calls `JSValue.call(withArguments:)`, stringifies result.
- **Offline short-circuit:** if `requiresNetwork == true && !online`, return `{"error":"This tool requires network. Device is offline."}` without entering JS.

#### `SpecialistCore/DynamicTool` (H2)
Pure data model:
```swift
struct DynamicTool: Codable {
  let name: String
  let description: String
  let schema: JSONSchema        // JSON Schema
  let jsBody: String            // raw function body source
  let requiresNetwork: Bool
  let exampleTrajectories: [Trajectory]
}
```
Matches 1:1 with the orchestrator's `DynamicToolSpec` TypeScript type.

#### `SpecialistCore/OnlineMonitor` (H2)
Wraps `NWPathMonitor` on `Network` framework. Publishes `@Published var status: OnlineStatus` (`.online`/`.offline`). Consumed by `ToolRegistry` and the UI pill.

### 2.3 CLI / Scripts (H0 → H7)

| Script | Invoked from | Stage |
|--------|--------------|-------|
| `scripts/micro-bench.sh` | manual | H0 — 50-iter smoke to measure sec/iter and peak memory. Kill-point gate for E4B vs E2B. |
| `scripts/train.sh` | `/api/train` (stage=sft) | H6 — `mlx_lm.lora` with §6.2 SFT config. |
| `scripts/grpo.sh` | `/api/train` (stage=grpo) | H6 — `mlx_lm_lora.train --train-mode grpo` on SFT output. |
| `scripts/fuse.sh` | `/api/adapter` | H7 — `mlx_lm.fuse` produces `adapter.safetensors`. |
| `scripts/deploy-adapter.sh` | `/api/adapter` | H7 — `xcrun devicectl device copy to --device <UDID> --domain-type appDataContainer --domain-identifier <bundle-id> …` |

All invoked through `child_process.spawn` — never `exec` (streaming stdout needed for progress).

---

## 3. End-to-End Data Flow (Prose Diagram)

```
┌─────────────────────────── LAPTOP (Next.js) ────────────────────────────┐
│                                                                          │
│  [UI button: "Run for Supabase"]                                         │
│       │ POST /api/pipeline                                               │
│       ▼                                                                  │
│  [Coordinator.runPipeline()]                                             │
│       │                                                                  │
│       ├──fan-out (p-limit 15, parallel, read-only)──────┐                │
│       │   │                                             │                │
│       │   ├─ Discovery×N  ──► data/corpus/*.json       │                │
│       │   │     (fetchLlmsTxt, chunkAndIndex, 70/30     │  data-agent-   │
│       │   │      hash split)                            │    status +    │
│       │   │                                             │  task-notif    │
│       │   ├─ Tool-Design×4 ─► DynamicToolSpec[]         │                │
│       │   │     (→ sandbox/fuzzExec gate)               │                │
│       │   │     (→ adapter-tools.json)                  │                │
│       │   │                                             │                │
│       │   ├─ Data-Gen-QA   ─► qa.jsonl                  │                │
│       │   ├─ Data-Gen-Traj ─► traj.jsonl                │                │
│       │   └─ Eval-Gen      ─► eval.jsonl (30% split)    │                │
│       │                                                 ▼                │
│       │                                         [UI AgentCard grid]      │
│       │                                                                  │
│       ├──merge → training.jsonl (dedup, stratify ≥30/tool)──────┐        │
│       │                                                         │        │
│       ▼                                                         │        │
│  POST /api/train?stage=sft                                      │        │
│       │ spawn mlx_lm.lora → readline → data-train{iter,loss}────┼──► Recharts
│       │                                                         │        │
│  POST /api/train?stage=grpo                                     │        │
│       │ spawn mlx_lm_lora.train → data-train{iter,reward}───────┘        │
│       │                                                                  │
│       ▼                                                                  │
│  POST /api/adapter                                                       │
│       │ spawn mlx_lm.fuse → adapter.safetensors (~60MB)                  │
│       │ spawn xcrun devicectl copy adapter.safetensors + adapter-tools.json
│       ▼                                                                  │
└──────────────────────────────────┬───────────────────────────────────────┘
                      USB-C        │
┌─────────────────────────── iPHONE ▼ (airplane mode) ─────────────────────┐
│  /Documents/adapter.safetensors  +  /Documents/adapter-tools.json        │
│       │                                                                  │
│       ▼ (AdapterLoaderView detects via file enumeration)                 │
│  ModelState.loadLoRAWeights(url)        (<2s)                            │
│  ToolRegistry.registerAll(adapterTools) (evaluateScript each jsBody)     │
│       │                                                                  │
│       ▼  user prompt                                                     │
│  Gemma4-E4B + LoRA  → token stream                                       │
│       │                                                                  │
│       ▼                                                                  │
│  GemmaToolParser  ──(.toolCall)──► ToolRegistry.invoke(name, argsJSON)   │
│       │                                    │                             │
│       │                                    ├─ requiresNetwork? + offline │
│       │                                    │    → structured error JSON  │
│       │                                    └─ else JSContext.call → JSON │
│       │                                                                  │
│       ▼ inject <|tool_response|> → continue decode → final answer        │
│  ChatView render + ToolCallBubble inline                                 │
└──────────────────────────────────────────────────────────────────────────┘

        ┌──────── LAPTOP (eval) ────────┐
        │ POST /api/eval                │
        │   base  → via device HTTP shim│
        │   tuned → via device HTTP shim│
        │   teacher → AI SDK             │
        │   judges (Opus + Gemini) avg  │
        │ → scoreboard + latency         │
        └────────────────────────────────┘
```

---

## 4. Data Contracts (Hot Paths)

### 4.1 `data-agent-status` (transient SSE part)
```ts
{
  type: 'data-agent-status',
  id: string,                    // worker id, stable per lane
  data: {
    lane: number,                // 0..4, row in UI grid
    role: 'discovery'|'toolDesign'|'dataGenQa'|'dataGenTraj'|'evalGen',
    status: 'starting'|'running'|'awaitingJudge'|'done'|'error',
    step: number,                // monotonic step counter
    lastLine?: string            // short log tail
  },
  transient: true
}
```

### 4.2 `data-task-notification` (persisted)
```ts
{
  type: 'data-task-notification',
  data: {
    taskId: string,
    role: string,
    status: 'success'|'failure'|'partial',
    summary: string,             // 1-line human summary for the card
    result: unknown,             // role-typed payload
    usage: { inputTokens, outputTokens, costUsd }
  },
  transient: false
}
```

### 4.3 `data-train` (transient)
```ts
{
  type: 'data-train',
  data: {
    stage: 'sft'|'grpo',
    iter: number,
    loss?: number,               // present during SFT
    reward?: number,             // present during GRPO
    tokensPerSec?: number,
    peakMemGb?: number
  },
  transient: true
}
```

### 4.4 `adapter-tools.json` schema
```ts
type AdapterToolsManifest = {
  version: 1,
  productName: string,
  generatedAt: string,           // ISO-8601
  tools: Array<{
    name: string,                // camelCase, unique
    description: string,
    schema: JSONSchema,          // from zodToJsonSchema
    jsBody: string,              // literal function body source
    requiresNetwork: boolean,
    exampleTrajectories: Array<{
      user: string,
      call: { name: string, arguments: Record<string, unknown> },
      result: unknown
    }>
  }>
}
```

### 4.5 Training JSONL (mlx-lm `tools` format)
One JSON object per line:
```ts
{
  messages: Array<
    | { role: 'system'|'user'|'assistant', content: string }
    | { role: 'assistant', tool_calls: [{ id, type: 'function', function: { name, arguments } }] }
    | { role: 'tool', tool_call_id: string, content: string }
  >,
  tools: Array<{ type: 'function', function: { name, description, parameters: JSONSchema } }>
}
```
mlx-lm applies the Gemma 4 chat template automatically, which emits `<|tool_call|>…<|tool_response|>` tokens at the right positions. Do not pre-tokenize.

---

## 5. Component Dependency Matrix

Rows block columns. "X" = must exist before column component can be built or exercised end-to-end.

| ↓ blocks → | Sentry | Micro-bench | iOS base launch | ToolRegistry/Parser | Coordinator | Workers (data-gen) | SFT/GRPO | Fuse+Deploy | Eval | Scoreboard UI |
|------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Env (Node, venv, keys) | X | X | — | — | X | X | X | X | X | — |
| Sentry init | — | — | — | — | X | X | X | X | X | — |
| Micro-bench passed | — | — | — | — | — | — | X | — | — | — |
| Base model downloaded | — | X | X | — | — | — | X | — | — | — |
| iOS base launch | — | — | — | X | — | — | — | — | — | — |
| ToolRegistry + Parser | — | — | — | — | — | — | — | X | X | — |
| Coordinator harness | — | — | — | — | — | X | — | — | — | X |
| Discovery output (corpus + split) | — | — | — | — | — | X | — | — | X | — |
| Tool-Design (adapter-tools.json) | — | — | — | — | — | X | X | X | — | — |
| Data-Gen outputs | — | — | — | — | — | — | X | — | — | — |
| Eval-Gen output | — | — | — | — | — | — | — | — | X | — |
| SFT+GRPO adapter | — | — | — | — | — | — | — | X | X | — |
| Fused + deployed adapter | — | — | — | — | — | — | — | — | X | X |
| Eval numbers | — | — | — | — | — | — | — | — | — | X |

**Critical path (longest chain):** Env → base download → iOS launch → ToolRegistry/Parser → (Coordinator + Discovery + Tool-Design + Data-Gen + Eval-Gen) → SFT+GRPO → Fuse+Deploy → Eval → Scoreboard. Nine serialized gates.

**Parallelizable branches:**
- H0: Sentry + venv install + iOS fork + base download + micro-bench all parallel.
- H2: ToolRegistry and Parser can progress while H3 orchestrator skeleton is scaffolded.
- H4–H5: Discovery blocks Tool-Design and Data-Gen content, but once corpus lands, Tool-Design + Data-Gen-QA + Data-Gen-Traj + Eval-Gen all fan out.
- H8 eval harness can be scaffolded during H7 while H7 verifies device.

---

## 6. Phase Boundary Recommendations (for Roadmapper)

The PRD's §14 hour-map aligns cleanly with component dependencies. Suggested phase grouping:

1. **Phase 1 — Foundation & Smoke (H0–H2).** Env, Sentry, micro-bench kill-point, iPhone base-model smoke, adapter hot-swap toy, JSContext tool round-trip. Ends with the three hardest-to-verify claims empirically settled.
2. **Phase 2 — Orchestration Harness (H3).** Coordinator/Worker skeleton, `/api/pipeline`, `/api/train` skeleton, UI grid + Recharts, end-to-end SSE with mock workers. Eliminates the streaming/merge risk before real work begins.
3. **Phase 3 — Discovery + Tool-Design for Supabase (H4).** Discovery worker real, Tool-Design Swarm real, `lib/sandbox` fuzz harness, `adapter-tools.json` written. Kill-point: ≥ 4 validated tools.
4. **Phase 4 — Data + Eval Generation (H5).** Data-Gen-QA, Data-Gen-Traj, Eval-Gen in parallel. Judge-gated. Dedup. Kill-point: ≥ 1,200 examples.
5. **Phase 5 — Train Model A (H6).** SFT + GRPO live. Loss/reward stream. Kill-point: NaN → SFT-only.
6. **Phase 6 — Fuse, Deploy, Verify (H7).** `/api/adapter` end-to-end, device verification battery, Tier 3 cassette recorded. Kill-point gate for Tier 2 guarantee.
7. **Phase 7 — Evaluation Harness (H8).** `/api/eval`, three-way scoreboard, latency stopwatch.
8. **Phase 8 — Polish & Pre-Cache (H9).** `ToolCallBubble`, Sentry dashboard scene, audience-pick pre-cache (Vercel AI SDK at minimum).
9. **Phase 9 — Dry-Run + Pre-Flight (H10–H11).** Timed rehearsal, cassette #2, checklist.

---

## 7. Patterns to Follow

### Pattern 1 — Coordinator never does substantive work
All work delegated to workers with tight tool allowlists (§10.2 rule 1). Coordinator only aggregates/synthesizes and sequences write-heavy subprocess calls.

### Pattern 2 — Read-only parallel, write-heavy serial
Discovery/data-gen/eval-gen fan out freely (bounded by `p-limit(15)` for API rate). Training, fuse, device-copy are strictly sequential — single-writer to disk and to device.

### Pattern 3 — Transient vs persisted SSE parts
Frequent events (`data-agent-status`, `data-train`) use `transient: true`. Terminal results (`data-task-notification`) persist. Keeps client-side message history lean.

### Pattern 4 — Reject-don't-fix for agent-authored JS
If fuzz-test fails, re-prompt the agent; never auto-patch. The training data must reflect the literal body shipped.

### Pattern 5 — Hash-based deterministic doc split
Split at document level, 70/30, hashed so re-runs produce identical partitions. Enforced before Discovery emits into corpus.

### Pattern 6 — Adapter-only fallback path
If `mlx_lm.fuse` misbehaves, load the adapter directly over the quantized base. Verify this code path in H1 smoke so it's live-ready.

---

## 8. Anti-Patterns to Avoid

- **Worker-to-worker communication.** Workers can't read each other's conversation (§10.2 rule 7). Coordinator is the only synthesis point.
- **Blocking tool-result returns from workers.** Workers terminate via `task-notification`, not return value. Don't await worker handles synchronously in the coordinator.
- **Pre-tokenizing training JSONL.** mlx-lm applies the Gemma 4 chat template; hand-rolled tokenization breaks tool-token placement.
- **Running the eval adapter on the laptop to "skip" device.** The latency asymmetry is the point; on-device numbers must come from the phone.
- **Refreshing `JSContext` per call and keeping global state.** Tool bodies must be idempotent — do not rely on cross-call JS globals. (One context per session is OK; global state across calls is not.)
- **Letting workers hit Anthropic without `p-limit` wrapping.** Rate-limit stalls cascade into a stuck coordinator.
- **Putting `runtime='nodejs'` on only some child_process routes.** All of `/api/pipeline`, `/api/train`, `/api/eval`, `/api/adapter` must pin Node runtime. Edge runtime silently breaks `child_process`.

---

## 9. Scalability Note (single demo, but still relevant)

| Concern | One run (Saturday) | If rerun for a 2nd product mid-demo | 10 runs (post-hackathon benchmark) |
|---------|--------------------|-------------------------------------|------------------------------------|
| Teacher tokens | ~3 h wall-clock @ p-limit 15 | Pre-cached H9 (no re-run) | Batch, cache corpus + tools per product |
| Training wall-clock | ≤ 17 min | Same — live training is the show | Queue, not parallel (single-GPU laptop) |
| Adapter fuse + deploy | < 8 s | Hot-swap on same device | Same |
| iPhone memory | 3 GB base + ~60 MB adapter + KV cache | Adapter swap is free | Entitlement `com.apple.developer.kernel.increased-memory-limit` required |

---

## 10. Sources

- `PRD_SPEC.md` §4 (topology + component diagram), §6 (training config), §8 (on-device), §9 (dynamic tools), §10 (Coordinator/Worker), §11 (eval), §12 (Sentry), §13 (stack), §14 (hour plan), §19.1 (repo layout), §19.3 (acceptance criteria), §19.4 (conventions).
- `CLAUDE.md` — hard constraints + tech locks (consistent with PRD).
- `mlx-swift-examples/Tools/llm-tool/LoraCommands.swift` — canonical `LoRATrain.loadLoRAWeights` reference.
- `coordinator/coordinatorMode.ts`, `tools/AgentTool/runAgent.ts`, `tools/shared/spawnMultiAgent.ts` — Claude Code pattern lift.

Confidence: **HIGH** — all architecture is already pinned in PRD_SPEC.md; this doc is projection, not invention.
