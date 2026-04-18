# Phase 3: Discovery + Tool Design — Research

**Researched:** 2026-04-18
**Domain:** Corpus ingestion + parallel agent swarm + multi-gate tool validation + manifest emission
**Confidence:** HIGH (scope is fully constrained by PRD §9 + §10.3 + §19.3; no open architectural questions)

## Summary

Phase 3 takes the coordinator/worker harness from Phase 2 and bolts on one specialized pipeline: fetch Supabase's `llms*.txt` bundle, chunk it into a `CORPUS` object, fan 4 parallel tool-design workers across corpus slices, run every candidate `DynamicToolSpec` through a **5-gate validator**, and emit a deduped `adapter-tools.json` with ≥8 tools (cap 12). SWR-08 is a hard kill-point: fewer than 4 surviving tools → fall back to the hand-written Supabase tool set and narrate.

The technical risks here are concentrated in three places: (1) the sandbox — `node:vm` + `worker_threads` must enforce 2 s / 64 MB caps without letting a runaway `while(true)` tool take out the orchestrator; (2) fuzz-input generation — we need schema-conforming inputs without pulling a heavy JSON Schema faker; (3) trajectory self-consistency — the worker's *stated* result must equal `jsBody(call.arguments)` under deterministic evaluation, which means no `Date.now()`, no `Math.random()`, no network.

**Primary recommendation:** Write a single `lib/discovery/` module that exposes `fetchCorpus()`, `chunkCorpus()`, `designToolsSwarm(corpus)`, and `validateTool(spec)` (which runs all 5 gates). The coordinator tool `spawnToolDesignWorker(sliceIndex)` returns candidates; the coordinator itself runs the validator (gates are pure — no need to fan them out) and appends survivors to an in-memory list that's JSON-stringified to `data/adapter-tools.json` at the end. All 5 gates run serially per tool — they're fast (<3 s combined) and gate-3/4 must follow gate-1/2. Parallelism is at the tool level (Promise.all across candidates), not at the gate level.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Supabase `llms*.txt` fetch | Next.js API route (Node runtime) | — | `fetch` lives server-side; no browser CORS issues; cache to `data/corpus.json` |
| Corpus chunking (~500 tokens) | Node lib (`lib/discovery/chunk.ts`) | — | Pure string transform; deterministic; no I/O beyond local cache |
| Tool-design worker (LLM call) | AI SDK v6 `generateObject` in Node | Coordinator via `spawnWorker` | Pattern established in Phase 2; workers return `DynamicToolSpec[]` |
| JSON Schema gate (SWR-03) | Node lib (`ajv`) | — | Pure validation |
| `acorn` parse gate (SWR-04) | Node lib (`acorn`) | — | Pure AST parse |
| Sandbox exec gate (SWR-05) | `node:vm` + `worker_threads` | — | PRD §19.4 forbids E2B/WebContainers; MUST use `worker_threads` for true isolation + 64 MB cap |
| Fuzz gate (SWR-06) | Node (schema → inputs) | — | 10 inputs generated from schema properties; feeds into sandbox |
| Trajectory self-consistency (SWR-07) | Sandbox exec + deep-equal | — | Reuses gate-5 sandbox; one extra invocation per example trajectory |
| Manifest emission | Coordinator → `fs.writeFile` | — | Single atomic write at end of phase |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AI SDK v6 | `^6.x` (locked Phase 1) | `generateObject` for tool-design workers with Zod schema | Project-locked; already wired in Phase 2 |
| `ajv` | `^8.17.x` | JSON Schema well-formedness (SWR-03) + fuzz-input validation | De-facto Node JSON Schema validator; draft-07 + 2020-12 support |
| `acorn` | `^8.14.x` | JS body parse gate (SWR-04) | PRD explicitly names `acorn`; reject-don't-fix policy aligns with its strict parser |
| `node:vm` | stdlib | Sandbox `Script` + `Context` for gate-5 | PRD §19.4 hard-lock |
| `worker_threads` | stdlib | Thread isolation + memory cap via `resourceLimits.maxOldGenerationSizeMb` | PRD §19.4 hard-lock; the only way to actually enforce 64 MB in Node |
| Zod | `^3.23.x` | `DynamicToolSpec` schema for `generateObject` | AI SDK v6 default; used across project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gpt-tokenizer` | `^2.x` | Approximate token counting for ~500-token chunks | Chunking step; BPE count is adequate, we're not training on it |
| `@dqbd/tiktoken` | alt | Same as above | Use only if `gpt-tokenizer` fails at load time |
| Node `fetch` (undici) | stdlib ≥ Node 20 | Pull `llms*.txt` | Stdlib — no `node-fetch` dependency |
| `fast-deep-equal` | `^3.1.x` | Trajectory self-consistency comparison (SWR-07) | Order-insensitive object equality |

**Installation:**
```bash
npm install ajv acorn gpt-tokenizer zod fast-deep-equal
# (AI SDK v6 + Next already present from Phase 1/2)
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:vm` + `worker_threads` | E2B / WebContainers / isolated-vm | **FORBIDDEN by PRD §19.4 hard constraints.** Do not introduce. |
| `ajv` | `@hyperjump/json-schema` | Ajv is faster, more widely adopted, already handles fuzz-validation roundtrip |
| `gpt-tokenizer` | Character heuristic (`text.length / 4`) | Acceptable fallback — 500 tokens ≈ 2000 chars — if tokenizer load is flaky |

## Architecture Patterns

### System Architecture Diagram

```
                          Phase 2 Coordinator (/api/pipeline)
                                      │
                                      ▼
                    ┌─────────  spawnDiscoveryPipeline  ─────────┐
                    │                                            │
                    ▼                                            ▼
         fetchCorpus()                                    (emits UI grid tiles)
         ├─ GET supabase.com/llms.txt
         ├─ GET supabase.com/llms/cli.txt
         └─ GET supabase.com/llms/guides.txt
                    │
                    ▼
         chunkCorpus(text) → Chunk[]   (~500 tok windows, overlap 50)
                    │
                    ▼
         CORPUS = { chunks: [...], byTopic: {...} }  → cached to data/corpus.json
                    │
         ┌──────────┼──────────┬──────────┐   (swarm fan-out, Promise.all)
         ▼          ▼          ▼          ▼
      Worker 1   Worker 2   Worker 3   Worker 4          (generateObject; slice = chunks[i::4])
      DynamicToolSpec[]   …         …         …          (each ≥3 example trajectories)
         │          │          │          │
         └──────────┴────┬─────┴──────────┘
                         ▼
              flatten → candidates[]   (15–40 raw candidates expected)
                         │
                         ▼
              for each candidate (Promise.all):
                ┌──────────────────────────────────────────┐
                │ Gate 1 — SWR-03: ajv.compile(schema)     │
                │ Gate 2 — SWR-04: acorn.parse(jsBody)     │
                │ Gate 3 — SWR-05: vm+worker exec, 2s/64MB │
                │ Gate 4 — SWR-06: 10 fuzz inputs, ≥8 OK   │
                │ Gate 5 — SWR-07: trajectory self-consist │
                └──────────────────────────────────────────┘
                         │
                         ▼
              survivors → dedupe-by-name → cap 12 → ≥8 required
                         │
                         ▼
              data/adapter-tools.json  (written atomically)
                         │
                         ▼
                   Phase 4 consumes
```

### Recommended Project Structure
```
lib/discovery/
├── corpus.ts            # fetchCorpus() + chunkCorpus()
├── swarm.ts             # designToolsSwarm(corpus) — orchestrates 4 workers
├── worker.ts            # toolDesignWorker(slice) — single generateObject call
├── validate/
│   ├── index.ts         # validateTool(spec) — runs gates 1–5 in order, returns {pass, failedGate?}
│   ├── schema.ts        # gate 1 (SWR-03)
│   ├── parse.ts         # gate 2 (SWR-04)
│   ├── sandbox.ts       # gate 3 (SWR-05) — the load-bearing file
│   ├── fuzz.ts          # gate 4 (SWR-06) — schema → inputs → sandbox
│   └── trajectory.ts    # gate 5 (SWR-07)
├── manifest.ts          # writeManifest(tools) → data/adapter-tools.json
└── types.ts             # DynamicToolSpec, Chunk, CORPUS

app/api/discover/
└── route.ts             # POST → runs pipeline, streams UI events via writer.merge

data/
├── corpus.json          # cached fetched+chunked (optional; skip network on re-run)
└── adapter-tools.json   # THE deliverable
```

### Pattern 1: Worker `worker_threads` sandbox with hard caps
**What:** Each candidate tool's JS body executes inside a Worker thread spun up with `resourceLimits`, with a 2 s `AbortController` timeout enforced from the parent.
**When to use:** Gate 3 (SWR-05) and reused by gates 4 (fuzz invocations) and 5 (trajectory check).
**Example:**
```typescript
// lib/discovery/validate/sandbox.ts
// Pattern: parent spawns Worker with memory cap; parent holds timeout; worker
// runs vm.Script inside its own isolate. Kills are hard (worker.terminate()).
import { Worker } from 'node:worker_threads';
import path from 'node:path';

export async function runInSandbox(
  jsBody: string,
  args: unknown,
  timeoutMs = 2000
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const worker = new Worker(path.resolve('lib/discovery/validate/sandbox.worker.mjs'), {
      workerData: { jsBody, args },
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 },
    });
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);
    worker.once('message', (msg) => { clearTimeout(timer); worker.terminate(); resolve(msg); });
    worker.once('error', (err) => { clearTimeout(timer); resolve({ ok: false, error: err.message }); });
  });
}
```
```javascript
// lib/discovery/validate/sandbox.worker.mjs
import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';
try {
  const ctx = vm.createContext({});  // no globals, no fetch, no require
  const script = new vm.Script(`(${workerData.jsBody})(${JSON.stringify(workerData.args)})`);
  const value = script.runInContext(ctx, { timeout: 1500 });
  // Enforce JSON-serializable return
  const serialized = JSON.parse(JSON.stringify(value));
  parentPort.postMessage({ ok: true, value: serialized });
} catch (err) {
  parentPort.postMessage({ ok: false, error: String(err?.message ?? err) });
}
```

### Pattern 2: Tool-design worker via `generateObject`
**What:** Each of 4 workers gets a distinct corpus slice (strided: `chunks[i::4]`), a persona prompt, and a Zod schema describing `DynamicToolSpec`. They return `{ tools: DynamicToolSpec[] }`.
**When to use:** The swarm step (SWR-02).
**Why strided, not contiguous:** Contiguous slices would concentrate a worker on one topic (e.g. all CLI) and risk duplicate tool names across workers; striding yields broader coverage.

### Pattern 3: Fuzz input generation from JSON Schema
**What:** Walk `schema.properties`, emit 10 inputs per property by primitive type (`string` → `'a'`, `''`, 1000-char, unicode; `number` → `0`, `-1`, `1.5`, `1e308`, `NaN`; `array` → `[]`, `[single]`, 100-element; `object` → recurse). Combine into 10 full objects; validate each with `ajv` to guarantee schema-conformance; pass to sandbox.
**When to use:** Gate 4 (SWR-06).
**Why hand-rolled vs `json-schema-faker`:** faker pulls ~2 MB of deps for a 30-LOC task; we only need primitive coverage. Keep it tight.

### Anti-Patterns to Avoid
- **Running gates in parallel inside a single tool:** Gates are cheap (<100 ms each except sandbox). Sequential short-circuits on first failure and saves sandbox spins. Parallelize *across* candidates, not *within* one.
- **Catching and "fixing" `acorn` errors:** PRD §19.4 forbids auto-formatting agent-generated JS. Reject the tool. Period.
- **Using `vm.runInNewContext` *without* `worker_threads`:** `vm` alone does not give you a memory cap, and an infinite-loop tool freezes the event loop for the whole coordinator. Both `vm` AND `worker_threads` are required — this is a common misread of PRD §19.4.
- **Letting the LLM invent tool names that collide:** Enforce `new Set(name)` dedup *before* validation to avoid wasting sandbox spins on clones.
- **Shipping a tool whose `jsBody` calls `fetch`, `require`, or `process`:** The sandbox won't have those, but gate 4 might accidentally pass if the body uses them inside an unused branch. Static-check the AST from gate 2 for forbidden identifiers: `fetch`, `require`, `import`, `process`, `globalThis`, `eval`, `Function`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom walker | `ajv` | Draft 2020-12 edge cases, `$ref`, format assertions |
| JS AST parsing | Regex | `acorn` | PRD-mandated; handles ES2022 + async/await |
| Worker sandboxing | `child_process` with a script file | `worker_threads` + `vm` | `child_process` can't enforce memory caps; `worker_threads.resourceLimits` can |
| Deep equality for trajectories | `JSON.stringify(a) === JSON.stringify(b)` | `fast-deep-equal` | Key-order bites you; trajectories often have reordered object keys |
| Token counting for chunking | `text.split(' ').length` | `gpt-tokenizer` | Word count ≠ token count; chunks will be wildly uneven |

**Key insight:** The *only* novel code in this phase is the 5-gate orchestrator. Everything else is a thin wrapper over off-the-shelf libs. Resist the temptation to write a custom sandbox or schema walker — they're the places bugs hide and time disappears.

## Common Pitfalls

### Pitfall 1: Sandbox escapes via `this`, `constructor.constructor`
**What goes wrong:** A tool body does `this.constructor.constructor('return process')()` and breaks out of the `vm` context to touch `process.env`.
**Why it happens:** `vm.createContext({})` does not block prototype-chain walks to the host Realm in older Node versions.
**How to avoid:** Run inside `worker_threads` — even if the `vm` leaks, the worker thread is a separate Node instance with no filesystem-writable identity. Also AST-scan from gate 2 for `constructor.constructor`, `Function`, `eval`.
**Warning signs:** A gate-3 tool returns data that couldn't have come from the input (e.g. a filesystem path).

### Pitfall 2: Schema-conforming fuzz input still throws
**What goes wrong:** The schema says `{ query: string }`, 10 fuzz inputs all pass the schema, but 5 of them throw because the tool does `query.toLowerCase().match(/.../)[0]` and assumes a match.
**Why it happens:** Schema validates shape, not semantics. Tool authors write happy-path code.
**How to avoid:** SWR-06 allows up to 2 throws (≥8 of 10 serializable). Don't tighten this — it's the PRD-specified tolerance. If <8 pass, reject the tool.
**Warning signs:** Gate 4 rejection rate > 40% means the LLM is producing fragile bodies; prompt the worker to "handle empty, null, and no-match cases gracefully."

### Pitfall 3: Trajectory self-consistency fails on floats / time
**What goes wrong:** A tool body uses `Math.random()` or `Date.now()`; the stated trajectory result doesn't match `jsBody(args)` on re-execution.
**Why it happens:** Non-determinism in tool implementations.
**How to avoid:** AST-scan gate 2 for `Date.`, `Math.random`, `crypto`, `performance`. Reject outright. Additionally: numeric comparison in SWR-07 should use `fast-deep-equal` which is strict — no epsilon tolerance. This is correct behavior — reject drift.
**Warning signs:** Gate 5 fails for tools that pass gates 1–4.

### Pitfall 4: Worker `generateObject` returns 0 tools
**What goes wrong:** A worker's LLM refuses or returns `{ tools: [] }` for its slice (often happens if slice has only changelog/noise chunks).
**Why it happens:** Striding helps but doesn't guarantee every slice has tool-worthy content.
**How to avoid:** If total candidates < 8 *before* validation, re-run the swarm with a relaxed prompt and warmer temperature. If total survivors after gates < 4, trip SWR-08 kill-point and fall back to the hand-written Supabase tools in `lib/tools/hand-written-supabase.ts`.
**Warning signs:** Worker finishes in <5 s with empty output.

### Pitfall 5: Fetching `llms.txt` during a hackathon network blip
**What goes wrong:** `supabase.com` is briefly 503, entire phase blocks.
**Why it happens:** Hackathon-demo network is not production-grade.
**How to avoid:** Cache `data/corpus.json` after first successful fetch. Always check cache first; only hit network if cache is missing or `--refresh` flag. Commit the cached corpus to the repo so offline reruns work.
**Warning signs:** Phase hangs on initial fetch.

### Pitfall 6: `adapter-tools.json` shape drift vs Phase 4 consumer
**What goes wrong:** Phase 4 data-gen expects tools in mlx-lm `tools` (OpenAI) format; Phase 3 writes them in its own internal shape.
**Why it happens:** Two phases, two authors, no shared type.
**How to avoid:** `DynamicToolSpec.toOpenAIToolSchema()` method OR write the manifest in OpenAI tool-schema format from the start (`{ type: 'function', function: { name, description, parameters } }`) and keep the `jsBody` + `requiresNetwork` as siblings under `meta`. Phase 4 reads `manifest.tools[i].function` directly.
**Warning signs:** Phase 4 writes ad-hoc re-shape code.

### Pitfall 7: Duplicate tool names survive dedup because of casing
**What goes wrong:** `listTables` and `list_tables` both ship.
**How to avoid:** Dedup key = `name.toLowerCase().replace(/[_-]/g, '')`. Keep the first occurrence (worker ordering is stable via `Promise.all` preserving input order).

## Runtime State Inventory

Not applicable. Phase 3 is a greenfield discovery pipeline — there are no prior adapters, stored corpora, or on-device state that survives a rerun. The only persistent artifacts are `data/corpus.json` (cache) and `data/adapter-tools.json` (deliverable), both written fresh each run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 20 | `worker_threads.resourceLimits`, native fetch | ✓ (Phase 1 locked) | 20.x / 22.x | — |
| Next.js 15 App Router | `/api/discover` route | ✓ (Phase 1 locked) | 15.x | — |
| AI SDK v6 + provider keys | `generateObject` in workers | ✓ (Phase 1–2 smoke) | 6.x | Narrate with pre-generated fixture if keys fail |
| `supabase.com/llms*.txt` | Corpus source (SWR-01) | Check live at phase start | — | Commit `data/corpus.json` ahead of time |
| `ajv`, `acorn`, `gpt-tokenizer`, `fast-deep-equal` | Validation gates | ✗ (install in wave 1) | latest | — |

**Missing dependencies with no fallback:** None blocking — all deps are npm-installable from the hackathon machine's existing Node setup.

**Missing dependencies with fallback:** Supabase `llms*.txt` — mitigate with pre-committed cache before demo window.

## Phase 2 Integration

Phase 2 delivered:
- `/api/pipeline` — coordinator route streaming merged worker SSE via `createUIMessageStream` + `writer.merge`.
- `spawnWorker` tool on the coordinator that invokes workers returning via `task-notification`.
- `AgentGrid` UI reading `useChat().data` to render tiles per worker.
- Sentry `ai.agent` spans already wrapping worker calls.

Phase 3 plugs in at these exact seams:

| Phase 2 surface | Phase 3 usage |
|------------------|---------------|
| `spawnWorker({ kind, input })` tool | Add `kind: 'tool-design'` and `kind: 'corpus-fetch'` handlers |
| `task-notification` part writer | Each gate pass/fail emits one notification so AgentGrid shows gate progress |
| `createUIMessageStream` writer | Phase 3 controller streams `data-tool-candidate` and `data-gate-result` parts |
| `ai.agent` Sentry span | Wrap each tool-design worker; add a child span per gate with `gate.name` + `tool.name` attributes |
| `AgentGrid` 5×4 tiles | 4 tool-design workers take 4 tiles; the other row is reused for gate rollup visualization |

No Phase 2 code should change. Phase 3 is an additive `/api/discover` route (or equivalently, a new `kind` in the existing `/api/pipeline`). The simpler path — given hackathon pressure — is a **new `/api/discover` route that re-imports the coordinator factory from Phase 2**, so the harness is identical but the orchestration flow is isolated and doesn't interfere with the Phase 2 demo surface.

Recommended: **new route, shared harness.** Phase 2's `/api/pipeline` stays a clean demo surface; Phase 3's `/api/discover` is a pipeline in its own right that Phase 4 will call internally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (assumed from Phase 1 Next.js scaffold — **confirm in wave 0**) |
| Config file | `vitest.config.ts` (create if absent) |
| Quick run command | `npx vitest run lib/discovery -t` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SWR-01 | `chunkCorpus` returns ≥N chunks of ≤500 tokens from fixture `llms.txt` | unit | `npx vitest run lib/discovery/corpus.test.ts` | Wave 0 |
| SWR-02 | `toolDesignWorker(slice)` returns `DynamicToolSpec[]` with ≥3 trajectories each (mocked LLM) | unit | `npx vitest run lib/discovery/worker.test.ts` | Wave 0 |
| SWR-03 | `validateSchema(badSchema)` returns `{pass:false}`; good schema returns `{pass:true}` | unit | `npx vitest run lib/discovery/validate/schema.test.ts` | Wave 0 |
| SWR-04 | `validateParse(syntaxError)` rejects; valid body passes | unit | `npx vitest run lib/discovery/validate/parse.test.ts` | Wave 0 |
| SWR-05 | Infinite-loop body times out in ≤2 s; 128 MB allocation rejected | integration | `npx vitest run lib/discovery/validate/sandbox.test.ts` | Wave 0 |
| SWR-06 | 10 fuzz inputs: throw-prone body fails; robust body passes | unit | `npx vitest run lib/discovery/validate/fuzz.test.ts` | Wave 0 |
| SWR-07 | Mismatched stated-vs-actual result rejects; matching passes | unit | `npx vitest run lib/discovery/validate/trajectory.test.ts` | Wave 0 |
| SWR-08 | End-to-end pipeline with 12 mock candidates → `adapter-tools.json` with ≥8 survivors; <4 survivors throws `KillPointError` | integration | `npx vitest run lib/discovery/pipeline.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/discovery -t "<task-under-test>"`
- **Per wave merge:** `npx vitest run lib/discovery`
- **Phase gate:** `npx vitest run lib/discovery` green + one real end-to-end run against live Supabase corpus producing ≥8 tools.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — confirm or create (Phase 1 may have scaffolded it)
- [ ] `lib/discovery/__fixtures__/llms-mini.txt` — 2 KB fixture for offline chunk/worker tests
- [ ] `lib/discovery/__fixtures__/mock-candidates.json` — 12 hand-crafted tool specs covering each gate-failure mode
- [ ] `lib/discovery/types.ts` — shared `DynamicToolSpec`, `Chunk`, `ValidationResult` types

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `ajv` on all incoming tool specs before any execution |
| V6 Cryptography | no | No secrets generated/handled in this phase |
| V10 Malicious Code | **yes (critical)** | AST-scan + `worker_threads` + `vm` isolation; reject-don't-fix policy |
| V11 Business Logic | yes | 5-gate sequence is the business logic; tests cover fail-closed behavior |
| V14 Config | yes | `resourceLimits` must be set; failure to set them silently leaks memory |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sandbox escape via `constructor.constructor` | Elevation of Privilege | `worker_threads` isolation + AST deny-list in gate 2 |
| Resource exhaustion via infinite loop | Denial of Service | 2 s `AbortController` + `worker.terminate()` |
| Memory exhaustion via large allocation | Denial of Service | `resourceLimits.maxOldGenerationSizeMb: 64` |
| Prompt injection in `llms.txt` steering worker to emit `fetch('evil.com')` body | Tampering | Gate 2 AST deny-list blocks `fetch`, `require`, `import`, `process`, `globalThis`, `eval`, `Function` |
| Tool-name collision overwriting legitimate tool | Tampering | Normalized-name dedup pre-validation |
| Non-serializable return leaking host objects | Information Disclosure | `JSON.parse(JSON.stringify(value))` roundtrip in worker before postMessage |

## Proposed Plan Breakdown

Suggested decomposition for the planner (3 waves, 5 plans). Parallelism is tight — gates are dependency-fan-in, so the validator plan must land before the pipeline plan.

| # | Plan | Reqs | Wave | Rationale |
|---|------|------|------|-----------|
| 03-01 | `corpus-fetch-chunk-PLAN.md` — `lib/discovery/corpus.ts` + test fixture + `data/corpus.json` cache | SWR-01 | 1 | Zero deps; cacheable; pulls in `gpt-tokenizer` |
| 03-02 | `validator-gates-PLAN.md` — all 5 gates as pure functions + sandbox worker file + tests | SWR-03, SWR-04, SWR-05, SWR-06, SWR-07 | 1 | Pure libs, no LLM; parallelizable with 03-01; highest test coverage |
| 03-03 | `tool-design-worker-PLAN.md` — `generateObject`-based worker + Zod `DynamicToolSpec` + mocked test | SWR-02 | 2 | Depends on 03-01 (consumes corpus) but not on 03-02 |
| 03-04 | `swarm-pipeline-manifest-PLAN.md` — `designToolsSwarm` + dedup + manifest write + `/api/discover` route + Phase 2 harness wiring + Sentry spans | SWR-02, SWR-08 | 3 | Depends on 03-02 and 03-03; contains the kill-point gate |
| 03-05 | `fallback-hand-written-tools-PLAN.md` — `lib/tools/hand-written-supabase.ts` with 8 hand-crafted tools, loaded when SWR-08 trips | SWR-08 (fallback arm) | 3 | Parallel with 03-04; ensures kill-point demotion path exists *before* we find out we need it |

Why 5 plans and not the 3–4 common for earlier phases: this phase has **one hard gate (SWR-08)** plus **seven validation sub-requirements that must each be independently testable**. Collapsing 03-02 into 03-04 risks a buggy gate sneaking past because nobody wrote the unit test for it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 1 scaffolded Vitest | Validation Architecture | Wave 0 must add test framework — adds ~15 min |
| A2 | `supabase.com/llms.txt`, `llms/cli.txt`, `llms/guides.txt` are all live and return plain text | Corpus | Must pre-cache before demo (already the recommended mitigation) |
| A3 | AI SDK v6 `generateObject` with Zod schema is stable for 4-way parallel calls under project provider keys | Swarm | Worker fallback to `generateText` + manual JSON parse if `generateObject` flakes |
| A4 | `worker_threads.resourceLimits.maxOldGenerationSizeMb` is honored on Node 20/22 on M4 Pro macOS | Sandbox | Doc-verified on Node 20 LTS; if not honored, demotion path: skip gate 5 hard cap, rely on `AbortController` timeout only — note in PLAN |
| A5 | Phase 4 can consume `adapter-tools.json` in OpenAI tool-schema shape with `meta.jsBody` sibling | Phase 2 Integration / Pitfall 6 | Phase 4 must write re-shape code — adds ~10 min |
| A6 | ≥8 unique tools is achievable from the Supabase corpus with 4 workers | SWR-08 | Kill-point trips → hand-written fallback (already planned in 03-05) |
| A7 | `gpt-tokenizer` is a reasonable proxy for mlx tokenizer for chunking purposes | Corpus | Chunks slightly uneven; no functional impact, we're not training on chunk boundaries |

All A-items are tagged `[ASSUMED]` against training knowledge or reasonable Phase-1 inheritance. The planner / discuss-phase should confirm A1 and A5 explicitly as they cross phase boundaries.

## Open Questions (RESOLVED)

1. **Does the Phase 2 harness expose a hook for child spans under `ai.agent`, or is Sentry tracing flat?**
   - What we know: Phase 2 ships `ai.agent` spans via `Sentry.vercelAIIntegration()`.
   - What's unclear: Whether gate-level spans will nest cleanly or need manual `Sentry.startSpan`.
   - Recommendation: Try implicit nesting first; fall back to manual spans if the flame-graph is ugly.
   - RESOLVED: try implicit nest first; if it doesn't parent correctly, wrap with `Sentry.startSpan({op:'ai.agent'})` explicitly in 03-04 Task 1.

2. **Should `/api/discover` stream to the existing demo page or a dedicated discovery page?**
   - What we know: Phase 2 has `/app/pipeline/page.tsx` with the 5×4 grid.
   - What's unclear: Whether the demo narrative benefits from a separate "Swarm is designing tools" panel.
   - Recommendation: Reuse the grid with a route param `?pipeline=discovery`. Keep surface area small.
   - RESOLVED: new `/app/discover` page consumes `/api/discover`; Phase 2 page untouched.

3. **Can we commit `data/corpus.json` (4 MB) to git without pre-commit hook complaint?**
   - What we know: Repo is on main with clean status.
   - What's unclear: Size thresholds / LFS config.
   - Recommendation: Commit as plain JSON; gzip if push is slow.
   - RESOLVED: commit as plain JSON under `data/corpus.json`; if pre-commit complains, gzip and load via `fs.createReadStream` + `zlib`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `eval()` / `Function()` for dynamic tool bodies | `node:vm` + `worker_threads` with `resourceLimits` | Node 14 → 18 stabilized `resourceLimits`; PRD §19.4 hard-locks this in 2026 | Only safe in-process sandbox option once E2B/WebContainers are excluded |
| Hand-written JSON Schema validators | `ajv` with draft 2020-12 | ~2022 | De-facto; nothing else keeps pace with spec revisions |
| `esprima` for JS parsing | `acorn` | ~2020 | Maintained, faster; esprima effectively dead |
| `json-schema-faker` for fuzz inputs | Hand-rolled per-type primitives | this phase's recommendation | Avoids 2 MB dep for 30 LOC of work |

**Deprecated/outdated:**
- `isolated-vm` — good tool but forbidden here (native deps, fails airplane-mode story).
- `vm2` — deprecated upstream; CVEs open; never use.

## Sources

### Primary (HIGH confidence)
- `PRD_SPEC.md` §9 (Tool Design Pipeline), §10.3 (Corpus), §14 H4 (Phase 3 hour-band), §19.3 (manifest shape), §19.4 (hard constraints) — authoritative
- `.planning/REQUIREMENTS.md` SWR-01..SWR-08 — requirement IDs and kill-point status
- `.planning/ROADMAP.md` Phase 3 section — success criteria and plan-count guidance
- Node.js docs: `worker_threads.resourceLimits`, `vm.Script`, `vm.createContext` — behavior of memory/timeout caps

### Secondary (MEDIUM confidence)
- `ajv` docs — draft 2020-12 support status
- `acorn` README — ES2022 coverage
- AI SDK v6 `generateObject` — verified via Phase 2 usage; project-internal

### Tertiary (LOW confidence)
- Assumed Vitest framework inheritance from Phase 1 (see A1)
- Assumed Supabase `llms*.txt` URL structure (see A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every lib is PRD-named or stdlib.
- Architecture: HIGH — seams to Phase 2 are well-defined; no novel coordination patterns.
- Pitfalls: HIGH on sandbox/AST (well-known), MEDIUM on fuzz-tolerance tuning (will calibrate during execution).
- Plan breakdown: HIGH — mirrors the 7-requirement-with-one-kill-point structure of SWR.

**Research date:** 2026-04-18
**Valid until:** Demo completion 2026-04-18 H12 (6 h horizon — no drift risk)
