---
phase: 03-discovery-tool-design
verified: 2026-04-18T14:40:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "Trigger live 4-worker swarm via /api/discover with valid ANTHROPIC_API_KEY"
    expected: "Swarm produces >=8 validated tools with source=swarm in adapter-tools.json; SSE events stream worker and gate progress to the agent grid"
    why_human: "No API key was available during execution; the committed manifest uses the fallback path. The swarm path is proven by integration test with mocks, but live provider interaction cannot be verified programmatically without keys."
  - test: "Start Next.js dev server and POST to /api/discover, observe SSE stream in browser"
    expected: "data-agent-status events appear per worker (running/ok/err), per gate (pass/fail); data-task-notification events appear for manifest completion; agent grid renders live updates"
    why_human: "Visual/interactive behavior of the SSE stream rendering in the Phase 2 agent grid UI cannot be verified without a running server and browser"
---

# Phase 3: Discovery + Tool Design Verification Report

**Phase Goal:** Crawl the Supabase corpus and produce a validated `adapter-tools.json` manifest via a 4-worker tool-design swarm with 5 validation gates.
**Verified:** 2026-04-18T14:40:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CORPUS object holds chunked Supabase llms*.txt (~4 MB, ~500-token windows) (SWR-01) | VERIFIED | `data/corpus.json` at HEAD has 2550 chunks, sourceBytes=4,636,627, 3 sources (llms:1, cli:24, guides:2525). Token mean=454, 99.4% under 520. |
| 2 | 4 tool-design workers complete in parallel with >= 3 trajectories per spec (SWR-02) | VERIFIED | `swarm.ts` uses `Promise.all` over `workerCount=4` strided slices. `worker.ts` uses Zod schema with `.min(3)` trajectory constraint. Mocked test confirms shape contract (3/3 tests pass). |
| 3 | Every candidate tool passes all 5 gates: schema, parse, sandbox, fuzz, trajectory (SWR-03..SWR-07) | VERIFIED | 5 independent gate modules + orchestrator in `validate/index.ts`. 49/49 tests pass including 12-fixture integration test matching all expected gate failures. |
| 4 | adapter-tools.json on disk contains >= 8 unique validated Supabase tools OR fallback set (SWR-08 kill-point) | VERIFIED | `data/adapter-tools.json` committed with source=fallback, count=8, 8 unique tool names. Kill-point fallback path proven by integration test. |
| 5 | lib/discovery/types.ts exports shared type vocabulary (DynamicToolSpec, Chunk, CORPUS, ValidationResult, GateName) | VERIFIED | File exists (54 lines), exports all 5 types. Imported by 10+ downstream files across discovery/, tools/, and the API route. |
| 6 | 5-gate validator is independently testable with validateTool orchestrator | VERIFIED | 6 test files (schema, parse, sandbox, fuzz, trajectory, index) with 35+ tests. All pass. Each gate tested in isolation and via orchestrator integration. |
| 7 | Hand-written 8 Supabase tools all pass the 5-gate validator, fallback manifest committed | VERIFIED | `hand-written-supabase.test.ts` runs `validateTool` on all 8 tools (857ms, all pass). `data/adapter-tools.fallback.json` committed with tools.length=8, all requiresNetwork=false, all with 3 trajectories. |
| 8 | /api/discover route streams progress via createUIMessageStream | VERIFIED | `app/api/discover/route.ts` exists (141 lines), uses `runtime='nodejs'`, `dynamic='force-dynamic'`, `createUIMessageStream`, `buildStatusPart`/`buildNotificationPart` from Phase 2, handles `KillPointError` fallback path. |
| 9 | Integration test verifies both swarm-path and kill-point fallback path | VERIFIED | `pipeline.test.ts` has 2 tests using `vi.doMock` -- swarm path (survivors -> manifest) and fallback path (empty swarm -> KillPointError -> fallback copy). Both pass (2039ms). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/discovery/types.ts` | Shared types: DynamicToolSpec, Chunk, CORPUS, ValidationResult, GateName | VERIFIED | 54 lines, all 5 types exported, imported by 10+ files |
| `lib/discovery/corpus.ts` | fetchCorpus() + chunkCorpus() + loadCached() | VERIFIED | 128 lines, all 3 functions exported, fetches 3 Supabase URLs, 500-token chunking with overlap |
| `lib/discovery/__fixtures__/llms-mini.txt` | 2 KB offline fixture for chunk tests | VERIFIED | 2825 bytes, used by corpus.test.ts |
| `data/corpus.json` | Cached fetched+chunked corpus | VERIFIED | 2550 chunks, 4.6 MB, committed for offline reruns |
| `vitest.config.ts` | Vitest config including lib/**/*.test.ts | VERIFIED | Pre-existing from Phase 1, includes lib pattern |
| `lib/discovery/validate/index.ts` | validateTool(spec) orchestrator | VERIFIED | 37 lines, imports all 5 gates, short-circuits on first failure |
| `lib/discovery/validate/schema.ts` | Gate 1 -- ajv well-formedness | VERIFIED | 17 lines, Ajv2020 with strict:false |
| `lib/discovery/validate/parse.ts` | Gate 2 -- acorn parse + AST deny-list | VERIFIED | 57 lines, 9 banned identifiers + 3 banned member accesses |
| `lib/discovery/validate/sandbox.ts` | Gate 3 -- worker_threads + vm sandbox | VERIFIED | 60 lines, maxOldGenerationSizeMb:64, 2s timeout |
| `lib/discovery/validate/sandbox.worker.mjs` | Worker-thread entry running vm.Script | VERIFIED | 26 lines, vm.createContext({}), 1.5s inner timeout |
| `lib/discovery/validate/fuzz.ts` | Gate 4 -- 10 fuzz inputs -> sandbox | VERIFIED | 43 lines, generateFuzzInputs returns exactly 10, 0-throws + >=8 serializable check |
| `lib/discovery/validate/trajectory.ts` | Gate 5 -- fast-deep-equal trajectory replay | VERIFIED | 42 lines, >=3 trajectories required, replays via sandbox |
| `lib/discovery/__fixtures__/mock-candidates.json` | 12 hand-crafted specs | VERIFIED | 12 entries, each with expectedFailedGate matching actual behavior |
| `lib/discovery/worker.ts` | toolDesignWorker + DYNAMIC_TOOL_SPEC_SCHEMA | VERIFIED | 55 lines, generateObject with Zod schema, server-side sourceWorker stamp |
| `lib/discovery/prompts.ts` | buildToolDesignPrompt + BANNED_LIST | VERIFIED | 29 lines, system prompt names all 5 gates, BANNED_LIST of 12 identifiers |
| `lib/discovery/worker.test.ts` | Mocked worker test -- no network | VERIFIED | 3 tests, MockLanguageModelV3 from ai/test, no API keys needed |
| `lib/discovery/swarm.ts` | designToolsSwarm(corpus) with 4 parallel workers | VERIFIED | 49 lines, Promise.all, strided slicing, Sentry.startSpan, 90s abort |
| `lib/discovery/dedupe.ts` | dedupeByNormalizedName | VERIFIED | 17 lines, normalize + Set-based dedup |
| `lib/discovery/manifest.ts` | writeManifest + copyFallback | VERIFIED | 44 lines, per-tool Zod validation at write time, atomic write |
| `lib/discovery/pipeline.ts` | runDiscoveryPipeline + KillPointError | VERIFIED | 113 lines, full decision tree: swarm -> dedupe -> validate -> retry arm -> kill-point |
| `app/api/discover/route.ts` | POST endpoint streaming swarm progress | VERIFIED | 141 lines, runtime='nodejs', createUIMessageStream, KillPointError handler |
| `lib/discovery/pipeline.test.ts` | Integration test with mock candidates | VERIFIED | 2 tests (swarm-path + fallback-path), both pass |
| `data/adapter-tools.json` | THE deliverable: >= 8 validated tools or fallback | VERIFIED | source=fallback, count=8, 8 valid DynamicToolSpec entries |
| `lib/tools/hand-written-supabase.ts` | Hand-written Supabase tool set | VERIFIED | 466 lines, 8 tools, requiresNetwork=false, 3 trajectories each |
| `lib/tools/hand-written-supabase.test.ts` | Validator green for all 8 | VERIFIED | 5 tests, all pass including validateTool on each of the 8 tools |
| `data/adapter-tools.fallback.json` | Pre-built fallback manifest | VERIFIED | source=fallback, count=8, all tools match TS export |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `corpus.ts` | `global fetch` | `await fetch('https://supabase.com/llms...')` | WIRED | 3 Supabase URLs present in SOURCES array (lines 6-9) |
| `corpus.ts` | `gpt-tokenizer` | `import('gpt-tokenizer')` | WIRED | Lazy-loaded with fallback heuristic (line 17) |
| `validate/sandbox.ts` | `sandbox.worker.mjs` | `new Worker(WORKER_PATH, { resourceLimits: { maxOldGenerationSizeMb: 64 } })` | WIRED | import.meta.url-based path resolution, 64MB/16MB/16MB limits |
| `validate/index.ts` | `all 5 gates` | Sequential short-circuit composition | WIRED | Imports validateSchema, validateParse, runInSandbox, validateFuzz, validateTrajectories; short-circuits on `failedGate` |
| `sandbox.worker.mjs` | `node:vm` | `vm.createContext({}) + vm.Script.runInContext` | WIRED | Empty context, 1.5s inner timeout |
| `worker.ts` | `ai (generateObject)` | `generateObject({ model, schema, prompt, system })` | WIRED | Zod DYNAMIC_TOOL_SPEC_SCHEMA, anthropic('claude-opus-4-5') default |
| `worker.ts` | `types.ts` | `import type { DynamicToolSpec, Chunk }` | WIRED | Types used for return type and input slice |
| `swarm.ts` | `worker.ts (toolDesignWorker)` | `Promise.all over 4 strided slices` | WIRED | `toolDesignWorker` imported line 2, called line 35 |
| `pipeline.ts` | `validate/index.ts (validateTool)` | `Promise.all(candidates.map(validateTool))` | WIRED | validateTool imported line 4, used at line 54-60 |
| `pipeline.ts` | `adapter-tools.fallback.json` | `copyFallback() on KillPointError` | WIRED | copyFallback imported from manifest.ts, called at line 104 |
| `route.ts` | `pipeline.ts` | `createUIMessageStream + runDiscoveryPipeline + KillPointError` | WIRED | All imports verified, onEvent callbacks stream progress |
| `hand-written-supabase.ts` | `validate/index.ts` | `validateTool(tool) green for all 8` | WIRED | Test confirms all 8 pass (hand-written-supabase.test.ts line 27) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `data/corpus.json` | CORPUS.chunks | Live Supabase fetch (3 URLs) | Yes -- 2550 chunks from 4.6 MB | FLOWING |
| `data/adapter-tools.json` | tools array | copyFallback (fallback path used) | Yes -- 8 hand-written tools | FLOWING |
| `data/adapter-tools.fallback.json` | tools array | Serialized from TS export | Yes -- 8 validated tools | FLOWING |
| `pipeline.ts` | survivors | swarm -> dedupe -> validate | N/A (mocked in test, live needs API key) | STATIC (test-only) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 3 tests pass | `npx vitest run lib/discovery lib/tools` | 10 files, 49/49 tests pass (2.36s) | PASS |
| corpus.json has >0 chunks | `node -e "const c=require('./data/corpus.json'); process.exit(c.chunks.length>0?0:1)"` | 2550 chunks | PASS |
| adapter-tools.json has valid structure | `node -e "const j=require('./data/adapter-tools.json'); process.exit((j.tools.length>=8 && ['swarm','fallback'].includes(j.source))?0:1)"` | source=fallback, count=8 | PASS |
| fallback.json has 8 tools, no network | `node -e "const j=require('./data/adapter-tools.fallback.json'); process.exit(j.tools.length===8 && j.tools.every(t=>!t.meta.requiresNetwork)?0:1)"` | 8 tools, all offline | PASS |
| mock-candidates.json has 12 entries | `node -e "process.exit(require('./lib/discovery/__fixtures__/mock-candidates.json').length===12?0:1)"` | 12 entries | PASS |
| All commits verified in git history | `git log --oneline | grep -c '03-0[1-5]'` | All 10 commits found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SWR-01 | 03-01 | Supabase llms*.txt chunked into CORPUS (~500-token windows) | SATISFIED | corpus.ts fetches 3 URLs, chunks at 500-token target, cached to data/corpus.json (2550 chunks, 4.6 MB) |
| SWR-02 | 03-03, 03-04 | 4 parallel workers emit DynamicToolSpec with >= 3 trajectories each | SATISFIED | swarm.ts fans 4 workers via Promise.all; Zod schema enforces min(3) trajectories; mocked test and integration test verify |
| SWR-03 | 03-02 | Schema well-formedness gate passes | SATISFIED | validate/schema.ts uses Ajv2020; tested with fixture (schemaBad fails, addNumbers passes) |
| SWR-04 | 03-02 | acorn parse gate passes (no auto-fix) | SATISFIED | validate/parse.ts uses acorn; AST deny-list rejects fetch/require/import/etc + Date.now/Math.random/constructor.constructor |
| SWR-05 | 03-02 | node:vm + worker_threads sandbox exec with 2s / 64MB caps | SATISFIED | sandbox.ts + sandbox.worker.mjs; maxOldGenerationSizeMb:64, 2s parent timeout, 1.5s vm.Script timeout; infinite-loop and memory-bomb tests pass |
| SWR-06 | 03-02 | 10-input fuzz: none throw, >= 8 JSON-serializable | SATISFIED | fuzz.ts generates exactly 10 schema-conforming inputs; validates 0-throw + >=8 serializable; tested |
| SWR-07 | 03-02 | Trajectory self-consistency check passes | SATISFIED | trajectory.ts uses fast-deep-equal; requires >= 3 trajectories; tested with match and mismatch cases |
| SWR-08 | 03-04, 03-05 | adapter-tools.json >= 8 validated tools (cap 12), kill-point fallback | SATISFIED | Pipeline: cap=12, floor=8, kill<4 -> fallback. Manifest on disk: source=fallback, count=8. Integration test proves both paths. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/discovery/corpus.test.ts` | 34 | Test calls `fetchCorpus({refresh:true})` which writes to the real `data/corpus.json` on disk | WARNING | Running `npm test` silently overwrites the committed 4.6 MB corpus with a 10 KB fixture version. Does not block the goal but degrades offline-rerun guarantee until corpus.json is restored via `git checkout`. |
| `data/corpus.json` | N/A | 15 of 2550 chunks (0.6%) exceed 520 tokens, max is 933 | INFO | Character-based token estimation in the oversize-paragraph splitter produces occasional oversized chunks. Does not affect downstream processing -- the gates handle any chunk size. |
| `data/adapter-tools.json` | N/A | Manifest source is 'fallback' not 'swarm' | INFO | No ANTHROPIC_API_KEY was available during execution. The swarm path is proven by integration test with mocks. Demo-time execution will re-run the swarm with real keys and overwrite with source='swarm'. |

### Human Verification Required

### 1. Live Swarm Execution with Provider API Keys

**Test:** Set `ANTHROPIC_API_KEY` in the environment, start Next.js, and POST to `/api/discover`. Observe the SSE stream and check that `data/adapter-tools.json` is overwritten with `source: 'swarm'` and `count >= 8`.
**Expected:** 4 workers complete in parallel, each producing 3-6 DynamicToolSpec candidates. After dedup and 5-gate validation, >= 8 survivors land in the manifest. If < 4 survive, the kill-point fallback engages and the manifest shows `source: 'fallback'`.
**Why human:** No API key was available during execution. The mock-based integration test proves the pipeline logic, but actual provider interaction (token usage, response quality, timeout behavior) can only be verified with live keys.

### 2. SSE Stream Rendering in Agent Grid UI

**Test:** Open the demo page in a browser while `/api/discover` is running. Observe the 5x4 AgentGrid.
**Expected:** Agent cards appear for each `tool-design-{0..3}` worker showing running/ok/err states. Gate validation results stream as `gate:{toolName}` entries. A `manifest` notification appears when complete.
**Why human:** Visual rendering of real-time SSE events in the Phase 2 agent grid cannot be verified without a browser and running server.

### Gaps Summary

No code gaps found. All 9 observable truths verified with full evidence across all 4 verification levels (existence, substance, wiring, data-flow). All 8 SWR requirements are satisfied.

Two items require human verification:
1. **Live swarm execution** -- the committed manifest uses the fallback path because no API key was available. The swarm pipeline logic is fully proven by the integration test, but live provider interaction needs human confirmation during demo setup.
2. **SSE stream rendering** -- the route is fully wired to stream progress events, but visual rendering in the agent grid UI needs manual observation.

One test isolation warning is noted: `corpus.test.ts` has a destructive side effect that overwrites `data/corpus.json` with fixture data when tests run. This should be addressed by mocking the file path or writing to a temp location, but it does not block phase goal achievement since `git checkout` restores the file.

---

_Verified: 2026-04-18T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
