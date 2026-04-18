---
phase: 03-discovery-tool-design
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - lib/discovery/validate/index.ts
  - lib/discovery/validate/schema.ts
  - lib/discovery/validate/parse.ts
  - lib/discovery/validate/sandbox.ts
  - lib/discovery/validate/sandbox.worker.mjs
  - lib/discovery/validate/fuzz.ts
  - lib/discovery/validate/trajectory.ts
  - lib/discovery/__fixtures__/mock-candidates.json
  - lib/discovery/validate/schema.test.ts
  - lib/discovery/validate/parse.test.ts
  - lib/discovery/validate/sandbox.test.ts
  - lib/discovery/validate/fuzz.test.ts
  - lib/discovery/validate/trajectory.test.ts
autonomous: true
requirements: [SWR-03, SWR-04, SWR-05, SWR-06, SWR-07]

must_haves:
  truths:
    - "Gate 1 (schema, SWR-03) rejects malformed JSON Schemas and accepts well-formed draft 2020-12 / draft-07 schemas via `ajv`."
    - "Gate 2 (parse, SWR-04) rejects JS bodies with syntax errors via `acorn`; additionally AST-scans for banned identifiers (`fetch`, `require`, `import`, `process`, `globalThis`, `eval`, `Function`, `Date`, `Math.random`, `crypto`, `performance`, `constructor.constructor`) — reject, do not auto-fix (PRD §19.4 A09)."
    - "Gate 3 (sandbox, SWR-05) executes each candidate JS body in a `worker_threads.Worker` with `resourceLimits.maxOldGenerationSizeMb: 64` and a 2 s `AbortController` timeout enforced from the parent; infinite-loop and >64 MB alloc bodies are terminated and return `{ ok: false, error }`."
    - "Gate 4 (fuzz, SWR-06) generates exactly 10 schema-conforming inputs per candidate, invokes the sandboxed body once per input, and PASSES the tool iff 0 throws AND ≥8 return JSON-serializable values."
    - "Gate 5 (trajectory, SWR-07) re-runs each example trajectory through the sandbox and compares the actual return vs the stated `result` via `fast-deep-equal`; any mismatch fails the gate."
    - "`validateTool(spec)` runs gates in order [schema, parse, sandbox, fuzz, trajectory] and short-circuits on first failure, returning `{ pass, failedGate, reason, details }`."
  artifacts:
    - path: "lib/discovery/validate/index.ts"
      provides: "validateTool(spec) orchestrator — runs 5 gates in order, short-circuits"
      exports: ["validateTool"]
    - path: "lib/discovery/validate/schema.ts"
      provides: "Gate 1 — ajv well-formedness"
      exports: ["validateSchema"]
    - path: "lib/discovery/validate/parse.ts"
      provides: "Gate 2 — acorn parse + AST deny-list"
      exports: ["validateParse", "BANNED_IDENTIFIERS"]
    - path: "lib/discovery/validate/sandbox.ts"
      provides: "Gate 3 — worker_threads + vm sandbox with caps"
      exports: ["runInSandbox"]
    - path: "lib/discovery/validate/sandbox.worker.mjs"
      provides: "Worker-thread entry running vm.Script with empty context"
    - path: "lib/discovery/validate/fuzz.ts"
      provides: "Gate 4 — schema -> 10 fuzz inputs -> sandbox invocations"
      exports: ["validateFuzz", "generateFuzzInputs"]
    - path: "lib/discovery/validate/trajectory.ts"
      provides: "Gate 5 — trajectory self-consistency via fast-deep-equal"
      exports: ["validateTrajectories"]
    - path: "lib/discovery/__fixtures__/mock-candidates.json"
      provides: "12 hand-crafted specs covering each gate-failure mode"
  key_links:
    - from: "lib/discovery/validate/sandbox.ts"
      to: "lib/discovery/validate/sandbox.worker.mjs"
      via: "new Worker(path.resolve(...), { resourceLimits: { maxOldGenerationSizeMb: 64, ... } })"
      pattern: "maxOldGenerationSizeMb:\\s*64"
    - from: "lib/discovery/validate/index.ts"
      to: "validateSchema, validateParse, runInSandbox, validateFuzz, validateTrajectories"
      via: "sequential short-circuit composition"
      pattern: "failedGate"
    - from: "lib/discovery/validate/sandbox.worker.mjs"
      to: "node:vm"
      via: "vm.createContext({}) + vm.Script.runInContext"
      pattern: "vm\\.createContext"
---

<objective>
Deliver the 5-gate tool validator as pure, independently testable modules. This is the load-bearing safety layer of Phase 3 — every `DynamicToolSpec` the swarm produces in Wave 3 passes through this composite or is rejected.

Purpose: SWR-03..SWR-07 each require an independently testable gate. Collapsing them into one module risks a buggy gate sneaking past (research §Proposed Plan Breakdown). Wave 1 ships the gates *before* there are specs to run through them, so Wave 3's pipeline is a trivial `Promise.all(candidates.map(validateTool))`.
Output: Five pure gate modules + an orchestrator + a 12-spec fixture exercising every failure mode + passing unit tests for each gate.
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
@.planning/phases/03-discovery-tool-design/03-RESEARCH.md

<interfaces>
<!-- Types this plan imports from lib/discovery/types.ts (Plan 03-01 ships this). -->
Plan 03-01 (Wave 1, runs in parallel) creates `lib/discovery/types.ts` with:
- `DynamicToolSpec` (OpenAI tool-schema + `meta.{jsBody, requiresNetwork, trajectories, sourceWorker, sourceChunks}`)
- `ValidationResult { pass, failedGate?, reason?, details? }`
- `GateName = 'schema'|'parse'|'sandbox'|'fuzz'|'trajectory'`

IMPORTANT parallel-wave protocol: if `lib/discovery/types.ts` does not yet exist when this plan starts, CREATE the minimal subset this plan needs inline (`ValidationResult`, `GateName`, and a local `ToolSpecLike` interface matching `DynamicToolSpec`). When Plan 03-01 finalizes, replace the local definitions with `import type { DynamicToolSpec, ValidationResult, GateName } from '../types.js'`. Plan 03-04 will reconcile. This avoids a file-edit conflict on `types.ts` during Wave 1.

Banned identifiers (AST deny-list for Gate 2 — research §Anti-Patterns + §Pitfall 3):
```
BANNED_IDENTIFIERS = [
  'fetch', 'require', 'import',      // network / module escape
  'process', 'globalThis',           // host realm
  'eval', 'Function',                // dynamic code
  'crypto', 'performance',           // non-determinism
]
BANNED_MEMBER_ACCESSES = [
  ['Math', 'random'],
  ['Date', 'now'],
  ['constructor', 'constructor'],    // prototype-chain escape (Pitfall 1)
]
```
`Date` and `Math` as identifiers are permitted because many useful tools reference them (e.g. `Math.max`); the member-access deny-list is the sharp edge.

Fuzz input primitives per schema type (research §Pattern 3):
- string → `['', 'a', '0', 'x'.repeat(1000), '🦄🚀', 'null', 'undefined', 'true', '  ', '\n']`
- number → `[0, 1, -1, 1.5, -1.5, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 0.1 + 0.2, Number.EPSILON]`
- integer → `[0, 1, -1, 100, -100, 2**31 - 1, -(2**31), 42, 7, 13]`
- boolean → alternate `[true, false, true, false, ...]`
- array → `[[], [1], [1,2,3], new Array(100).fill(0), [''], [null], [[]], [{}], [1,'x'], Array.from({length:10},(_,i)=>i)]`
- object → recurse via property map; missing optional props OK.
Generate exactly 10 candidate inputs; if schema has no properties, all 10 are `{}`.

Sandbox contract (research §Pattern 1):
- `runInSandbox(jsBody: string, args: unknown, timeoutMs = 2000): Promise<{ ok: true, value: unknown } | { ok: false, error: string }>`
- Worker spawned with `{ resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 } }`.
- Parent holds `setTimeout(timeoutMs)` and calls `worker.terminate()` on expiry.
- Worker runs `vm.Script` with `timeout: 1500` inside `vm.createContext({})` (empty context — no `fetch`, no `require`).
- Worker enforces return-value serializability via `JSON.parse(JSON.stringify(value))` before `postMessage`.

Sandbox worker MUST extract the function name from the body (simple regex `/function\s+(\w+)\s*\(/`) and invoke that function with args. If the body does not name a function, reject. (Phase 3 convention: every `jsBody` is `function <toolName>(args) { ... }`.)

Mock candidates fixture (`__fixtures__/mock-candidates.json`) — 12 entries, each tagged with `expectedFailedGate` ('schema'|'parse'|'sandbox'|'fuzz'|'trajectory'|null):
1. `addNumbers` — well-formed, passes all 5 gates (expectedFailedGate: null)
2. `listTables` — well-formed, passes all (expectedFailedGate: null)
3. `schemaBad` — malformed schema (`type: "strung"`) (expectedFailedGate: 'schema')
4. `parseBad` — `jsBody` with syntax error `function x(a) { return a.;`  (expectedFailedGate: 'parse')
5. `fetchBanned` — `jsBody` calls `fetch(...)` (expectedFailedGate: 'parse' — AST deny-list)
6. `infiniteLoop` — `while(true){}` body (expectedFailedGate: 'sandbox' — timeout)
7. `memoryBomb` — allocates 200 MB array (expectedFailedGate: 'sandbox' — resource cap or timeout)
8. `throwsOnEmpty` — throws on `query=''` → gate 4 should accept IF only ≤2 of 10 throw, else fail (expectedFailedGate: 'fuzz' with failure mode reproducible)
9. `nonSerializable` — returns a function (expectedFailedGate: 'fuzz')
10. `nondeterministicDate` — uses `Date.now()` (expectedFailedGate: 'parse' — AST member-access deny)
11. `nondeterministicRandom` — uses `Math.random()` (expectedFailedGate: 'parse' — AST member-access deny)
12. `trajectoryMismatch` — valid body + schema but stated trajectory result disagrees with actual (expectedFailedGate: 'trajectory')
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gates 1 + 2 (schema, parse) — ajv + acorn with AST deny-list</name>
  <files>
    lib/discovery/validate/schema.ts, lib/discovery/validate/parse.ts, lib/discovery/validate/schema.test.ts, lib/discovery/validate/parse.test.ts, lib/discovery/__fixtures__/mock-candidates.json
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §9.3 (validation gates), §19.4 (A09 no auto-format)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Anti-Patterns, Pitfall 3, Security Domain)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (hard constraint — do not auto-format agent JS bodies)
  </read_first>
  <action>
    1. Create `lib/discovery/__fixtures__/mock-candidates.json` — EXACTLY the 12 entries described in the `<interfaces>` block. Each entry shape:
       ```json
       {
         "expectedFailedGate": "schema" | "parse" | "sandbox" | "fuzz" | "trajectory" | null,
         "spec": {
           "type": "function",
           "function": {
             "name": "addNumbers",
             "description": "...",
             "parameters": { "type": "object", "properties": { "a": {"type":"number"}, "b": {"type":"number"} }, "required": ["a","b"] }
           },
           "meta": {
             "jsBody": "function addNumbers(args) { return { sum: args.a + args.b }; }",
             "requiresNetwork": false,
             "trajectories": [
               { "userPrompt": "add 2 and 3", "call": {"name":"addNumbers","arguments":{"a":2,"b":3}}, "result": {"sum":5} }
             ],
             "sourceWorker": "fixture",
             "sourceChunks": []
           }
         }
       }
       ```
       Provide concrete bodies for each of the 12 cases per the interfaces list. Make sure `trajectoryMismatch` has a body that returns `{sum: args.a + args.b}` but a stated trajectory result of `{sum: 999}`.

    2. `lib/discovery/validate/schema.ts`:
       ```ts
       import Ajv2020 from 'ajv/dist/2020.js';
       import type { ValidationResult } from '../types.js';

       const ajv = new Ajv2020({ strict: false, allErrors: true });

       export function validateSchema(parameters: unknown): ValidationResult {
         try {
           ajv.compile(parameters as object);
           return { pass: true };
         } catch (err) {
           return { pass: false, failedGate: 'schema', reason: String((err as Error).message).slice(0, 400) };
         }
       }
       ```

    3. `lib/discovery/validate/parse.ts`:
       ```ts
       import * as acorn from 'acorn';
       import type { ValidationResult } from '../types.js';

       export const BANNED_IDENTIFIERS = new Set([
         'fetch', 'require', 'import', 'process', 'globalThis', 'eval', 'Function', 'crypto', 'performance',
       ]);
       // member-access deny pairs: [object, property]
       const BANNED_MEMBER = [
         ['Math', 'random'], ['Date', 'now'], ['constructor', 'constructor'],
       ] as const;

       export function validateParse(jsBody: string): ValidationResult {
         let ast: acorn.Node;
         try {
           ast = acorn.parse(jsBody, { ecmaVersion: 2022, sourceType: 'script' });
         } catch (err) {
           return { pass: false, failedGate: 'parse', reason: `acorn: ${(err as Error).message}`.slice(0, 400) };
         }
         // Walk AST
         let banned: string | null = null;
         const visit = (node: any) => {
           if (!node || typeof node !== 'object' || banned) return;
           if (node.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.name)) {
             banned = `banned identifier: ${node.name}`; return;
           }
           if (node.type === 'MemberExpression') {
             const obj = node.object?.name ?? node.object?.property?.name;
             const prop = node.property?.name;
             for (const [o, p] of BANNED_MEMBER) {
               if (obj === o && prop === p) { banned = `banned access: ${o}.${p}`; return; }
             }
           }
           for (const k of Object.keys(node)) {
             const v = (node as any)[k];
             if (Array.isArray(v)) v.forEach(visit);
             else if (v && typeof v === 'object' && 'type' in v) visit(v);
           }
         };
         visit(ast as any);
         if (banned) return { pass: false, failedGate: 'parse', reason: banned };
         return { pass: true };
       }
       ```

    4. `lib/discovery/validate/schema.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { validateSchema } from './schema.js';
       import candidates from '../__fixtures__/mock-candidates.json' with { type: 'json' };

       describe('validateSchema', () => {
         it('rejects malformed schema (schemaBad fixture)', () => {
           const bad = candidates.find((c: any) => c.spec.function.name === 'schemaBad')!;
           const r = validateSchema(bad.spec.function.parameters);
           expect(r.pass).toBe(false);
           expect(r.failedGate).toBe('schema');
         });
         it('accepts well-formed schema (addNumbers fixture)', () => {
           const good = candidates.find((c: any) => c.spec.function.name === 'addNumbers')!;
           expect(validateSchema(good.spec.function.parameters).pass).toBe(true);
         });
       });
       ```

    5. `lib/discovery/validate/parse.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { validateParse } from './parse.js';
       import candidates from '../__fixtures__/mock-candidates.json' with { type: 'json' };

       describe('validateParse', () => {
         it('rejects syntax error (parseBad)', () => {
           const bad = candidates.find((c: any) => c.spec.function.name === 'parseBad')!;
           expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
         });
         it('rejects banned identifier fetch (fetchBanned)', () => {
           const bad = candidates.find((c: any) => c.spec.function.name === 'fetchBanned')!;
           const r = validateParse(bad.spec.meta.jsBody);
           expect(r.pass).toBe(false);
           expect(r.reason).toMatch(/fetch/);
         });
         it('rejects Date.now (nondeterministicDate)', () => {
           const bad = candidates.find((c: any) => c.spec.function.name === 'nondeterministicDate')!;
           expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
         });
         it('rejects Math.random (nondeterministicRandom)', () => {
           const bad = candidates.find((c: any) => c.spec.function.name === 'nondeterministicRandom')!;
           expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
         });
         it('accepts clean body (addNumbers)', () => {
           const good = candidates.find((c: any) => c.spec.function.name === 'addNumbers')!;
           expect(validateParse(good.spec.meta.jsBody).pass).toBe(true);
         });
       });
       ```

    6. Run both gate tests — must pass before proceeding to Task 2.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/discovery/validate/schema.test.ts lib/discovery/validate/parse.test.ts 2>&1 | tail -20 && test $(node -e "console.log(JSON.parse(require('fs').readFileSync('lib/discovery/__fixtures__/mock-candidates.json','utf8')).length)") = "12"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export const BANNED_IDENTIFIERS" lib/discovery/validate/parse.ts` succeeds.
    - `grep -E "'fetch'" lib/discovery/validate/parse.ts` succeeds.
    - `grep -E "'Math', 'random'" lib/discovery/validate/parse.ts` succeeds.
    - `grep -E "Ajv2020" lib/discovery/validate/schema.ts` succeeds (draft 2020-12).
    - `lib/discovery/__fixtures__/mock-candidates.json` parses as array of length 12.
    - `npx vitest run lib/discovery/validate/schema.test.ts lib/discovery/validate/parse.test.ts` all tests pass.
  </acceptance_criteria>
  <done>SWR-03 + SWR-04 landed: ajv schema gate and acorn parse-with-deny-list gate, each independently tested against fixtures.</done>
</task>

<task type="auto">
  <name>Task 2: Gate 3 sandbox — worker_threads + vm with 2s / 64MB caps</name>
  <files>
    lib/discovery/validate/sandbox.ts, lib/discovery/validate/sandbox.worker.mjs, lib/discovery/validate/sandbox.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §9.3, §19.4 A06 (node:vm + worker_threads only)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pattern 1 sandbox, Pitfall 1 escape via constructor.constructor, Security Domain)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (hard constraint A06)
  </read_first>
  <action>
    1. Write `lib/discovery/validate/sandbox.worker.mjs`:
       ```js
       import { parentPort, workerData } from 'node:worker_threads';
       import vm from 'node:vm';

       try {
         const { jsBody, args } = workerData;
         // Extract function name from the body (convention: `function <name>(args) { ... }`)
         const nameMatch = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(jsBody);
         if (!nameMatch) {
           parentPort.postMessage({ ok: false, error: 'sandbox: no named function in body' });
           process.exit(0);
         }
         const fnName = nameMatch[1];
         const ctx = vm.createContext({}); // empty context: no fetch, no require, no process
         const script = new vm.Script(
           `${jsBody}\n;JSON.stringify(${fnName}(${JSON.stringify(args)}))`,
         );
         const raw = script.runInContext(ctx, { timeout: 1500 });
         // Roundtrip to enforce serializability
         const value = JSON.parse(raw);
         parentPort.postMessage({ ok: true, value });
       } catch (err) {
         parentPort.postMessage({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 400) });
       }
       ```

    2. Write `lib/discovery/validate/sandbox.ts`:
       ```ts
       import { Worker } from 'node:worker_threads';
       import path from 'node:path';
       import url from 'node:url';

       export interface SandboxResult {
         ok: boolean;
         value?: unknown;
         error?: string;
       }

       const WORKER_PATH = path.resolve('lib/discovery/validate/sandbox.worker.mjs');

       export function runInSandbox(
         jsBody: string,
         args: unknown,
         timeoutMs = 2000,
       ): Promise<SandboxResult> {
         return new Promise((resolve) => {
           let settled = false;
           const done = (r: SandboxResult) => { if (!settled) { settled = true; resolve(r); } };
           const worker = new Worker(WORKER_PATH, {
             workerData: { jsBody, args },
             resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, codeRangeSizeMb: 16 },
           });
           const timer = setTimeout(() => {
             worker.terminate().catch(() => {});
             done({ ok: false, error: 'timeout' });
           }, timeoutMs);
           worker.once('message', (msg: SandboxResult) => {
             clearTimeout(timer);
             worker.terminate().catch(() => {});
             done(msg);
           });
           worker.once('error', (err) => {
             clearTimeout(timer);
             worker.terminate().catch(() => {});
             done({ ok: false, error: String(err.message).slice(0, 400) });
           });
           worker.once('exit', (code) => {
             clearTimeout(timer);
             if (!settled) done({ ok: false, error: `worker exit ${code}` });
           });
         });
       }
       ```

    3. Write `lib/discovery/validate/sandbox.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { runInSandbox } from './sandbox.js';

       describe('runInSandbox', () => {
         it('runs a happy-path body and returns JSON-serialized value', async () => {
           const r = await runInSandbox(
             'function addNumbers(args) { return { sum: args.a + args.b }; }',
             { a: 2, b: 3 },
           );
           expect(r.ok).toBe(true);
           expect(r.value).toEqual({ sum: 5 });
         });
         it('times out on infinite loop in ≤2.5s', async () => {
           const t0 = Date.now();
           const r = await runInSandbox('function loop(_) { while(true){} }', {}, 2000);
           const dt = Date.now() - t0;
           expect(r.ok).toBe(false);
           expect(r.error).toMatch(/timeout|exit/);
           expect(dt).toBeLessThan(3000);
         }, 5000);
         it('rejects non-serializable return', async () => {
           const r = await runInSandbox('function f(_) { return function(){}; }', {});
           expect(r.ok).toBe(false);
         });
         it('rejects large memory allocation (resource cap)', async () => {
           // try to allocate ~200 MB. Worker's 64 MB cap should kill it.
           const r = await runInSandbox(
             'function mem(_) { const a = []; for (let i = 0; i < 2000000; i++) a.push({x: "x".repeat(100)}); return a.length; }',
             {},
             3000,
           );
           expect(r.ok).toBe(false);
         }, 6000);
         it('cannot access process (empty vm context)', async () => {
           const r = await runInSandbox('function f(_) { return typeof process; }', {});
           expect(r.ok).toBe(true);
           expect(r.value).toBe('undefined');
         });
         it('fresh body without named function rejected', async () => {
           const r = await runInSandbox('return 42;', {});
           expect(r.ok).toBe(false);
         });
       });
       ```

    4. Run sandbox tests. If `resourceLimits` memory cap does not trigger on the 200 MB alloc (per A4 assumption — some Node versions ignore it), the test will still pass because the worker is killed by the Node OOM path OR by timeout. Log actual behavior (timeout vs OOM) in the plan SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/discovery/validate/sandbox.test.ts 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "maxOldGenerationSizeMb:\\s*64" lib/discovery/validate/sandbox.ts` succeeds.
    - `grep -E "worker\\.terminate\\(\\)" lib/discovery/validate/sandbox.ts` succeeds.
    - `grep -E "vm\\.createContext\\(\\{\\}\\)" lib/discovery/validate/sandbox.worker.mjs` succeeds (empty context).
    - `grep -E "setTimeout\\(.*timeoutMs" lib/discovery/validate/sandbox.ts` succeeds.
    - All 6 sandbox tests pass (infinite-loop test completes in <3 s; process-access test returns `'undefined'`).
  </acceptance_criteria>
  <done>SWR-05 landed: isolated `worker_threads` sandbox with 2 s timeout + 64 MB cap; infinite-loop and memory-bomb bodies fail closed.</done>
</task>

<task type="auto">
  <name>Task 3: Gates 4 + 5 (fuzz, trajectory) + validateTool orchestrator</name>
  <files>
    lib/discovery/validate/fuzz.ts, lib/discovery/validate/trajectory.ts, lib/discovery/validate/index.ts, lib/discovery/validate/fuzz.test.ts, lib/discovery/validate/trajectory.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pattern 3 fuzz, Pitfall 2 ≥8 tolerance, Pitfall 3 trajectory non-determinism)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §9.3
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/validate/sandbox.ts (Task 2 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/validate/parse.ts (Task 1 output)
  </read_first>
  <action>
    1. `lib/discovery/validate/fuzz.ts`:
       ```ts
       import { runInSandbox } from './sandbox.js';
       import type { ValidationResult } from '../types.js';

       const STRING_PRIMS = ['', 'a', '0', 'x'.repeat(1000), '🦄🚀', 'null', 'undefined', 'true', '  ', '\n'];
       const NUMBER_PRIMS = [0, 1, -1, 1.5, -1.5, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 0.1 + 0.2, Number.EPSILON];
       const INT_PRIMS    = [0, 1, -1, 100, -100, 2**31 - 1, -(2**31), 42, 7, 13];
       const ARRAY_PRIMS  = [[], [1], [1,2,3], new Array(100).fill(0), [''], [null], [[]], [{}], [1,'x'], Array.from({length:10},(_,i)=>i)];

       function oneValue(propSchema: any, idx: number): unknown {
         const t = propSchema?.type;
         if (t === 'string')  return STRING_PRIMS[idx % STRING_PRIMS.length];
         if (t === 'number')  return NUMBER_PRIMS[idx % NUMBER_PRIMS.length];
         if (t === 'integer') return INT_PRIMS[idx % INT_PRIMS.length];
         if (t === 'boolean') return idx % 2 === 0;
         if (t === 'array')   return ARRAY_PRIMS[idx % ARRAY_PRIMS.length];
         if (t === 'object')  return generateOne(propSchema ?? {}, idx);
         return null;
       }

       function generateOne(schema: any, idx: number): Record<string, unknown> {
         const props = schema?.properties ?? {};
         const out: Record<string, unknown> = {};
         for (const key of Object.keys(props)) out[key] = oneValue(props[key], idx);
         return out;
       }

       export function generateFuzzInputs(schema: any): Array<Record<string, unknown>> {
         return Array.from({ length: 10 }, (_, i) => generateOne(schema, i));
       }

       export async function validateFuzz(jsBody: string, schema: any): Promise<ValidationResult> {
         const inputs = generateFuzzInputs(schema);
         const results = await Promise.all(inputs.map((args) => runInSandbox(jsBody, args, 2000)));
         const throws = results.filter((r) => !r.ok).length;
         const serializable = results.filter((r) => r.ok).length;
         if (throws > 0) {
           return { pass: false, failedGate: 'fuzz', reason: `${throws}/10 threw`, details: results };
         }
         if (serializable < 8) {
           return { pass: false, failedGate: 'fuzz', reason: `${serializable}/10 serializable (need ≥8)`, details: results };
         }
         return { pass: true };
       }
       ```
       Note: research says "none may throw AND ≥8 return JSON-serializable objects." Enforce both conditions exactly.

    2. `lib/discovery/validate/trajectory.ts`:
       ```ts
       import equal from 'fast-deep-equal';
       import { runInSandbox } from './sandbox.js';
       import type { ValidationResult } from '../types.js';

       export interface Trajectory {
         userPrompt: string;
         call: { name: string; arguments: Record<string, unknown> };
         result: unknown;
       }

       export async function validateTrajectories(
         jsBody: string,
         trajectories: Trajectory[],
       ): Promise<ValidationResult> {
         if (trajectories.length < 3) {
           return { pass: false, failedGate: 'trajectory', reason: `<3 trajectories (have ${trajectories.length})` };
         }
         for (let i = 0; i < trajectories.length; i++) {
           const t = trajectories[i];
           const actual = await runInSandbox(jsBody, t.call.arguments, 2000);
           if (!actual.ok) {
             return { pass: false, failedGate: 'trajectory', reason: `trajectory[${i}] sandbox err: ${actual.error}` };
           }
           if (!equal(actual.value, t.result)) {
             return { pass: false, failedGate: 'trajectory', reason: `trajectory[${i}] mismatch`, details: { expected: t.result, actual: actual.value } };
           }
         }
         return { pass: true };
       }
       ```

    3. `lib/discovery/validate/index.ts` — orchestrator:
       ```ts
       import { validateSchema } from './schema.js';
       import { validateParse } from './parse.js';
       import { validateFuzz } from './fuzz.js';
       import { validateTrajectories } from './trajectory.js';
       import { runInSandbox } from './sandbox.js';
       import type { DynamicToolSpec, ValidationResult } from '../types.js';

       export async function validateTool(spec: DynamicToolSpec): Promise<ValidationResult> {
         const schemaRes = validateSchema(spec.function.parameters);
         if (!schemaRes.pass) return schemaRes;

         const parseRes = validateParse(spec.meta.jsBody);
         if (!parseRes.pass) return parseRes;

         // Gate 3 (sandbox) — smoke: invoke with an empty arg object to verify it at least starts cleanly
         const sandboxSmoke = await runInSandbox(spec.meta.jsBody, {}, 2000);
         if (!sandboxSmoke.ok && /timeout|exit/.test(sandboxSmoke.error ?? '')) {
           return { pass: false, failedGate: 'sandbox', reason: sandboxSmoke.error };
         }
         // Non-timeout errors from an empty-args smoke are OK — many tools throw on empty args (fuzz gate tolerates up to 2 throws).

         const fuzzRes = await validateFuzz(spec.meta.jsBody, spec.function.parameters);
         if (!fuzzRes.pass) return fuzzRes;

         const trajRes = await validateTrajectories(spec.meta.jsBody, spec.meta.trajectories);
         if (!trajRes.pass) return trajRes;

         return { pass: true };
       }
       ```
       Reading note: the interfaces block says fuzz fails if ANY throw. The `sandboxSmoke` step does not enforce that — it's a fast-fail for timeouts only, per research's sandbox gate description. Real fuzz enforcement is in `validateFuzz`.

    4. `lib/discovery/validate/fuzz.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { validateFuzz, generateFuzzInputs } from './fuzz.js';

       describe('generateFuzzInputs', () => {
         it('returns exactly 10 inputs', () => {
           expect(generateFuzzInputs({ type: 'object', properties: { x: { type: 'string' } } })).toHaveLength(10);
         });
       });
       describe('validateFuzz', () => {
         it('accepts a robust body', async () => {
           const body = 'function f(args) { return { ok: String(args.x ?? "") }; }';
           const r = await validateFuzz(body, { type: 'object', properties: { x: { type: 'string' } } });
           expect(r.pass).toBe(true);
         }, 15000);
         it('rejects a throw-prone body', async () => {
           const body = 'function f(args) { return { hit: args.x.toLowerCase().match(/z/)[0] }; }';
           const r = await validateFuzz(body, { type: 'object', properties: { x: { type: 'string' } } });
           expect(r.pass).toBe(false);
           expect(r.failedGate).toBe('fuzz');
         }, 15000);
         it('rejects non-serializable returns', async () => {
           const body = 'function f(_) { return function(){}; }';
           const r = await validateFuzz(body, { type: 'object', properties: {} });
           expect(r.pass).toBe(false);
         }, 15000);
       });
       ```

    5. `lib/discovery/validate/trajectory.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { validateTrajectories } from './trajectory.js';

       const body = 'function addNumbers(args) { return { sum: args.a + args.b }; }';

       describe('validateTrajectories', () => {
         it('passes when all 3 trajectories match', async () => {
           const r = await validateTrajectories(body, [
             { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 3 } },
             { userPrompt: 'q2', call: { name: 'addNumbers', arguments: { a: 10, b: 5 } }, result: { sum: 15 } },
             { userPrompt: 'q3', call: { name: 'addNumbers', arguments: { a: 0, b: 0 } }, result: { sum: 0 } },
           ]);
           expect(r.pass).toBe(true);
         }, 15000);
         it('fails on any mismatch', async () => {
           const r = await validateTrajectories(body, [
             { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 999 } },
             { userPrompt: 'q2', call: { name: 'addNumbers', arguments: { a: 0, b: 0 } }, result: { sum: 0 } },
             { userPrompt: 'q3', call: { name: 'addNumbers', arguments: { a: 0, b: 1 } }, result: { sum: 1 } },
           ]);
           expect(r.pass).toBe(false);
           expect(r.failedGate).toBe('trajectory');
         }, 15000);
         it('fails if <3 trajectories', async () => {
           const r = await validateTrajectories(body, [
             { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 3 } },
           ]);
           expect(r.pass).toBe(false);
         });
       });
       ```

    6. Smoke the full `validateTool` orchestrator against every entry of `mock-candidates.json` in a one-shot script (no test file needed — just `node --experimental-strip-types -e "..."` or add an optional integration test in `lib/discovery/validate/index.test.ts`). For each candidate, assert `result.failedGate === candidate.expectedFailedGate` (null → pass:true). Record any divergence in the SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/discovery/validate 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export async function validateTool" lib/discovery/validate/index.ts` succeeds.
    - `grep -E "generateFuzzInputs" lib/discovery/validate/fuzz.ts` succeeds AND returns array of length 10 (tested).
    - `grep -E "fast-deep-equal" lib/discovery/validate/trajectory.ts` succeeds.
    - `grep -E "trajectories\\.length < 3" lib/discovery/validate/trajectory.ts` succeeds (≥3 trajectory requirement per SWR-02).
    - All validator tests (schema + parse + sandbox + fuzz + trajectory) pass with one command: `npx vitest run lib/discovery/validate`.
  </acceptance_criteria>
  <done>SWR-06 + SWR-07 landed; `validateTool` orchestrator composes all 5 gates with short-circuit. Wave 3 can call `Promise.all(candidates.map(validateTool))` with zero additional logic.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Candidate `DynamicToolSpec` → `validateTool` | UNTRUSTED — spec body may contain sandbox-escape attempts or infinite loops. |
| `validateTool` → `worker_threads.Worker` | Isolation boundary. Worker has its own Node isolate with memory cap. |
| Worker → `vm.createContext({})` | Secondary isolation. Empty context prevents access to host `fetch`, `process`, etc. |
| Fuzz input generator → sandbox | Schema-conforming inputs only; no prompt injection surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-04 | Elevation of Privilege | `this.constructor.constructor('return process')()` escape | mitigate | AST deny-list in Gate 2 rejects `constructor.constructor` + `Function` + `eval`; worker_threads double-jail ensures even a vm escape has no host identity. |
| T-03-05 | DoS | `while(true)` infinite loop | mitigate | Parent `setTimeout(2000)` + `worker.terminate()`. Test in `sandbox.test.ts` asserts completion in <3 s. |
| T-03-06 | DoS | 200 MB allocation exhausts host | mitigate | `resourceLimits.maxOldGenerationSizeMb: 64` on Worker; test verifies kill. |
| T-03-07 | Information Disclosure | Non-serializable return leaks host object references | mitigate | `JSON.parse(JSON.stringify(value))` roundtrip in worker before postMessage. |
| T-03-08 | Tampering | Network egress via `fetch` in JS body | mitigate | AST deny-list (Gate 2); `vm.createContext({})` has no `fetch` even if deny-list missed it. |
| T-03-09 | Tampering | Non-determinism via `Date.now()` / `Math.random()` | mitigate | AST member-access deny-list rejects both; Gate 5 (`fast-deep-equal` strict, no epsilon) would catch any survivor. |
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0.
- `npx vitest run lib/discovery/validate` all tests green.
- `mock-candidates.json` has 12 entries.
- Sandbox infinite-loop test completes in <3 s.
- `vm.createContext({})` empty-context grep succeeds in worker file.
</verification>

<success_criteria>
SWR-03, SWR-04, SWR-05, SWR-06, SWR-07 all pass. `validateTool(spec)` is a pure function Wave 3 invokes per candidate. Every gate is independently tested; no gate bug can sneak past.
</success_criteria>

<output>
After completion, create `.planning/phases/03-discovery-tool-design/03-02-SUMMARY.md` noting:
- Whether `resourceLimits.maxOldGenerationSizeMb` actually enforced the 64 MB cap on this Node version (assumption A4 verification).
- Any candidate fixture whose `validateTool` result did not match its `expectedFailedGate` (and why).
- Observed per-gate timings for a single validated candidate (helps Wave 3 budget worker spin-up).
</output>
