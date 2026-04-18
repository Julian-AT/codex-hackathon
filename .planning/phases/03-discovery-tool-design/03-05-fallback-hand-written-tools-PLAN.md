---
phase: 03-discovery-tool-design
plan: 05
type: execute
wave: 2
depends_on: [02]
files_modified:
  - lib/tools/hand-written-supabase.ts
  - lib/tools/hand-written-supabase.test.ts
  - data/adapter-tools.fallback.json
autonomous: true
requirements: [SWR-08]

must_haves:
  truths:
    - "`lib/tools/hand-written-supabase.ts` exports `HAND_WRITTEN_SUPABASE_TOOLS: DynamicToolSpec[]` with EXACTLY 8 hand-authored Supabase-domain tools, each conforming to the Phase 3 `DynamicToolSpec` shape (OpenAI tool-schema + `meta.{jsBody, requiresNetwork, trajectories, sourceWorker, sourceChunks}`)."
    - "Every hand-written tool has ≥3 example trajectories and passes the same 5-gate validator (SWR-03..SWR-07) — proven by a unit test that invokes `validateTool` on each."
    - "`data/adapter-tools.fallback.json` is a committed copy of the 8 tools in the exact manifest shape Wave 3 writes to `data/adapter-tools.json`, so that if SWR-08 trips (swarm produces <4 valid tools) the coordinator can `cp data/adapter-tools.fallback.json data/adapter-tools.json` and narrate."
    - "No tool in this set has `requiresNetwork: true` — fallback set must run in airplane mode (A07 hard constraint)."
  artifacts:
    - path: "lib/tools/hand-written-supabase.ts"
      provides: "Hand-written Supabase tool set for SWR-08 kill-point fallback"
      exports: ["HAND_WRITTEN_SUPABASE_TOOLS"]
      contains: "DynamicToolSpec"
    - path: "data/adapter-tools.fallback.json"
      provides: "Pre-built fallback manifest matching the real manifest's shape"
      contains: "trajectories"
  key_links:
    - from: "lib/tools/hand-written-supabase.ts"
      to: "lib/discovery/validate/index.ts"
      via: "validateTool(tool) green for all 8 entries"
      pattern: "HAND_WRITTEN_SUPABASE_TOOLS"
    - from: "data/adapter-tools.fallback.json"
      to: "lib/tools/hand-written-supabase.ts"
      via: "JSON-serialized snapshot of the TS export"
      pattern: "\"function\""
---

<objective>
Build the SWR-08 kill-point safety net BEFORE it's needed. If the Wave 3 swarm produces fewer than 4 validated tools, the coordinator swaps in this hand-written Supabase set so Phase 4 can still consume a manifest and the demo continues narrated with "we fell back to the pre-built tools."

Purpose: SWR-08 is kill-point #4 of the demo. Research §Pitfall 4 plus roadmap Phase 3 kill-point gate both call for this safety net. Shipping it in Wave 1 (parallel with 03-01 and 03-02) means the fallback exists before we ever know whether we need it.
Output: 8-tool hand-written Supabase module + unit tests proving each passes the validator + a pre-serialized `data/adapter-tools.fallback.json`.
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
<!-- Reads Plan 03-01's types and Plan 03-02's validator. Both ship in Wave 1 parallel. -->
This plan runs in Wave 1 alongside 03-01 (types) and 03-02 (validator). If a dependency file is not yet present when this plan executes, either:
(a) wait for it (orchestrator-level wave barrier handles this), OR
(b) author a minimal local copy and reconcile in Wave 3 (Plan 03-04 integration step).

Expected imports:
- `import type { DynamicToolSpec } from '../discovery/types.js'` — shape ships in 03-01.
- `import { validateTool } from '../discovery/validate/index.js'` — ships in 03-02; test depends on this.

Hand-written tool slate (exactly 8, all `requiresNetwork: false`, pure-compute Supabase-domain helpers). These are DETERMINISTIC helpers — they must return the same output for the same input, with no `Date.now()`, no `Math.random()`. They intentionally model "things Supabase developers ask about" in a pure-compute way (no live DB calls) so they survive the validator and the airplane-mode constraint.

1. `supabase_rls_policy_template` — given `{ tableName: string, role: 'authenticated'|'anon'|'service_role', operation: 'select'|'insert'|'update'|'delete' }` → `{ policy: string }` — emits the SQL `CREATE POLICY` DDL template.
2. `supabase_select_query_builder` — given `{ table: string, columns: string[], filters: Array<{column:string, op:'eq'|'neq'|'gt'|'lt', value: string|number}> }` → `{ sql: string }` — emits a parameterized SELECT.
3. `supabase_storage_path_builder` — given `{ bucket: string, userId: string, filename: string }` → `{ path: string }` — returns `${bucket}/${userId}/${filename}` with path validation.
4. `supabase_edge_function_name_validator` — given `{ name: string }` → `{ valid: boolean, reason?: string }` — Deno-compat name rules.
5. `supabase_column_type_mapper` — given `{ postgresType: string }` → `{ tsType: string }` — PG→TS type map (text→string, int4→number, uuid→string, etc.).
6. `supabase_connection_string_parser` — given `{ url: string }` → `{ host: string, port: number, database: string, user: string }` — pure regex parse; NO network.
7. `supabase_jwt_claims_extractor` — given `{ jwt: string }` → `{ sub: string|null, role: string|null, exp: number|null }` — base64url-decode middle segment; NO signature check (pure compute).
8. `supabase_migration_filename` — given `{ timestampMs: number, description: string }` → `{ filename: string }` — canonical `YYYYMMDDHHMMSS_snake_case.sql`. NOTE: takes `timestampMs` as input (not `Date.now()`) to remain deterministic.

Each tool MUST ship with exactly 3 example trajectories whose stated `result` exactly equals `jsBody(call.arguments)` — this is how the validator's Gate 5 verifies self-consistency.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the 8 hand-written Supabase tools + fallback manifest</name>
  <files>
    lib/tools/hand-written-supabase.ts, data/adapter-tools.fallback.json
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §9.1 (tool shape), §9.4 (manifest), §14 H4 kill-point, §19.3 (adapter-tools.json)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pitfall 4 fallback, Proposed Plan Breakdown 03-05)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (A07 no cloud fallback, A09 no auto-format)
  </read_first>
  <action>
    1. Write `lib/tools/hand-written-supabase.ts` exporting a single `HAND_WRITTEN_SUPABASE_TOOLS: DynamicToolSpec[]` array of exactly 8 entries. Each entry follows the interfaces list above. Example entry shape (for tool 1):

       ```ts
       import type { DynamicToolSpec } from '../discovery/types.js';

       export const HAND_WRITTEN_SUPABASE_TOOLS: DynamicToolSpec[] = [
         {
           type: 'function',
           function: {
             name: 'supabase_rls_policy_template',
             description: 'Emit a Supabase RLS policy DDL template for a given table/role/operation.',
             parameters: {
               type: 'object',
               properties: {
                 tableName: { type: 'string' },
                 role: { type: 'string', enum: ['authenticated','anon','service_role'] },
                 operation: { type: 'string', enum: ['select','insert','update','delete'] },
               },
               required: ['tableName','role','operation'],
               additionalProperties: false,
             },
           },
           meta: {
             jsBody: "function supabase_rls_policy_template(args) { const op = String(args.operation || '').toUpperCase(); const role = String(args.role || 'authenticated'); const table = String(args.tableName || ''); const policy = 'CREATE POLICY \"' + table + '_' + op.toLowerCase() + '_' + role + '\" ON public.' + table + ' FOR ' + op + ' TO ' + role + ' USING (auth.uid() = user_id);'; return { policy: policy }; }",
             requiresNetwork: false,
             trajectories: [
               {
                 userPrompt: 'Write an RLS policy for select on profiles for authenticated users.',
                 call: { name: 'supabase_rls_policy_template', arguments: { tableName: 'profiles', role: 'authenticated', operation: 'select' } },
                 result: { policy: 'CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);' },
               },
               {
                 userPrompt: 'RLS insert policy for posts table, authenticated.',
                 call: { name: 'supabase_rls_policy_template', arguments: { tableName: 'posts', role: 'authenticated', operation: 'insert' } },
                 result: { policy: 'CREATE POLICY "posts_insert_authenticated" ON public.posts FOR INSERT TO authenticated USING (auth.uid() = user_id);' },
               },
               {
                 userPrompt: 'RLS delete for comments, service role.',
                 call: { name: 'supabase_rls_policy_template', arguments: { tableName: 'comments', role: 'service_role', operation: 'delete' } },
                 result: { policy: 'CREATE POLICY "comments_delete_service_role" ON public.comments FOR DELETE TO service_role USING (auth.uid() = user_id);' },
               },
             ],
             sourceWorker: 'hand-written',
             sourceChunks: [],
           },
         },
         // ... 7 more entries ...
       ];
       ```

       HARD REQUIREMENTS for each of the 8 entries:
       - `jsBody` is a SINGLE `function <toolName>(args) { ... }` with NO dependencies on `Date`, `Math.random`, `crypto`, `performance`, `fetch`, `require`, `import`, `process`, `globalThis`, `eval`, `Function`, `constructor.constructor`. (These are the banned identifiers — Gate 2 will reject them.)
       - `requiresNetwork: false`.
       - `trajectories.length === 3`; each trajectory's `result` must EQUAL `eval(jsBody)(call.arguments)` under `fast-deep-equal`. If you're not sure, compute each `result` by running the body in a REPL and copy-paste; do not hand-compute.
       - `function.parameters` is a well-formed JSON Schema 2020-12 object (`ajv` 2020 must compile it).
       - `sourceWorker: 'hand-written'`, `sourceChunks: []`.

       For the other 7 tools (2–8), implement the bodies strictly per their interfaces description. Keep each body short (<30 lines), pure compute, and deterministic.

       For `supabase_jwt_claims_extractor`: decode the MIDDLE segment (between the two dots) as base64url → JSON. DO NOT use `crypto` (banned); write a manual base64url decoder using `Buffer.from(seg.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString()`. Note: `Buffer` is a Node global available inside `vm.createContext({})`? No — empty context has no `Buffer`. Instead, use `globalThis.atob` or hand-roll a base64 decoder inline. Simplest: hand-roll a 20-line base64url→string decoder at the top of `jsBody`. (Use `'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'` alphabet.)

       Similarly for `supabase_migration_filename`: implement snake_case conversion and zero-padded date formatting manually from `args.timestampMs`; do NOT call `Date`. Use raw integer arithmetic: `year = Math.floor(ms / 31557600000) + 1970` (approximate) — actually because `Date` is NOT banned as an identifier (only `Date.now` member access is banned), you MAY use `new Date(args.timestampMs).getUTCFullYear()` etc. Verify with Gate 2 — if rejected, hand-roll the formatter.

    2. After authoring the TS file, serialize to `data/adapter-tools.fallback.json` in the SAME shape the swarm path writes (03-04 `writeManifest`), differing only in `source` and meta values. This keeps Phase 4 consumer logic uniform across both provenance paths:
       ```ts
       // scripts/dump-fallback-tools.ts (or inline in package.json script)
       import { writeFile } from 'node:fs/promises';
       import { HAND_WRITTEN_SUPABASE_TOOLS } from '../lib/tools/hand-written-supabase.js';
       const body = {
         tools: HAND_WRITTEN_SUPABASE_TOOLS,
         source: 'fallback' as const,
         count: HAND_WRITTEN_SUPABASE_TOOLS.length,
         generatedAt: new Date(0).toISOString(), // epoch marker distinguishes fallback provenance
         meta: {
           rawCandidates: 0,
           dedupedCandidates: 0,
           gateFailures: { schema: 0, parse: 0, sandbox: 0, fuzz: 0, trajectory: 0 },
         },
       };
       await writeFile('data/adapter-tools.fallback.json', JSON.stringify(body, null, 2), 'utf8');
       ```
       Or run `node --experimental-strip-types -e "..."` once; commit the resulting JSON. Canonical `source` value is `'fallback'` (matches 03-04 `ManifestMeta` union `'swarm' | 'fallback'`); integration test in 03-04 asserts `written.source === 'fallback'`.

    3. Commit both files.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && test $(node --experimental-strip-types -e "import('./lib/tools/hand-written-supabase.ts').then(m => console.log(m.HAND_WRITTEN_SUPABASE_TOOLS.length))" 2>/dev/null | tail -1) = "8" && test -f data/adapter-tools.fallback.json && node -e "const j = require('./data/adapter-tools.fallback.json'); if (j.tools.length !== 8) process.exit(1); for (const t of j.tools) if (t.meta.requiresNetwork) process.exit(2); for (const t of j.tools) if (t.meta.trajectories.length !== 3) process.exit(3);"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/tools/hand-written-supabase.ts` exports `HAND_WRITTEN_SUPABASE_TOOLS` with exactly 8 entries.
    - Every entry has `requiresNetwork: false`.
    - Every entry has exactly 3 trajectories.
    - `grep -E "supabase_rls_policy_template" lib/tools/hand-written-supabase.ts` succeeds.
    - `data/adapter-tools.fallback.json` parses as JSON with `tools.length === 8`.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>8 hand-written Supabase tools and the pre-built fallback manifest exist on disk. If SWR-08 trips in Wave 3, the coordinator has a guaranteed Tier-3 path.</done>
</task>

<task type="auto">
  <name>Task 2: Unit-test every hand-written tool against the full 5-gate validator</name>
  <files>
    lib/tools/hand-written-supabase.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/tools/hand-written-supabase.ts (Task 1 output — re-read to confirm the 8 entries + their trajectory results)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/validate/index.ts (Plan 03-02 output — validateTool orchestrator)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pitfall 3 non-determinism)
  </read_first>
  <action>
    1. Write `lib/tools/hand-written-supabase.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { HAND_WRITTEN_SUPABASE_TOOLS } from './hand-written-supabase.js';
       import { validateTool } from '../discovery/validate/index.js';

       describe('hand-written Supabase fallback set', () => {
         it('has exactly 8 entries', () => {
           expect(HAND_WRITTEN_SUPABASE_TOOLS).toHaveLength(8);
         });
         it('no tool requires network', () => {
           for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
             expect(t.meta.requiresNetwork).toBe(false);
           }
         });
         it('every tool has ≥3 trajectories', () => {
           for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
             expect(t.meta.trajectories.length).toBeGreaterThanOrEqual(3);
           }
         });
         it('every tool passes the 5-gate validator', async () => {
           for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
             const result = await validateTool(t);
             if (!result.pass) {
               console.error('FAILED TOOL:', t.function.name, result);
             }
             expect(result.pass, `tool ${t.function.name}: ${result.reason ?? 'ok'}`).toBe(true);
           }
         }, 60_000); // generous timeout — 8 tools × 5 gates each; each gate includes sandbox spins
         it('tool names are unique and snake_case (dedup-safe)', () => {
           const names = HAND_WRITTEN_SUPABASE_TOOLS.map((t) => t.function.name);
           expect(new Set(names).size).toBe(names.length);
           for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
         });
       });
       ```

    2. Run the test. For any tool that fails `validateTool`, inspect the failure reason and fix the tool body or trajectory. COMMON failure modes:
       - Gate 2 `parse` rejected `Date.now` or `Math.random` → rewrite body to accept timestamp as an argument.
       - Gate 5 `trajectory` mismatch → the stated `result` in the trajectory does not equal the body's actual return; re-run the body in a REPL and paste the exact return.
       - Gate 4 `fuzz` rejected because body throws on empty/weird inputs → add guards (`args.x ?? ''`, etc.).
       Iterate until all 8 tools pass.

    3. If any tool CANNOT be made to pass (e.g. `supabase_jwt_claims_extractor` breaks under empty-string fuzz), either (a) rewrite the body to tolerate bad inputs, or (b) replace that tool with a simpler Supabase-domain helper of your choice (e.g. `supabase_order_by_clause_builder`). The set must remain 8 tools and all must pass validation.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx vitest run lib/tools/hand-written-supabase.test.ts 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - All 5 tests in `lib/tools/hand-written-supabase.test.ts` pass.
    - `validateTool` returns `{ pass: true }` for every one of the 8 entries (verified by the 4th test).
    - Tool names match `^[a-z][a-z0-9_]*$` (snake_case).
  </acceptance_criteria>
  <done>SWR-08 fallback arm is ready. If the swarm produces <4 tools, Plan 03-04 can `fs.copyFile('data/adapter-tools.fallback.json', 'data/adapter-tools.json')` with complete confidence the result is a valid, validator-green manifest.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Hand-authored `jsBody` → validator sandbox | TRUSTED-ish (we wrote it) but still passes through the same 5-gate validator as swarm output. No special-casing. |
| `data/adapter-tools.fallback.json` → repo | Committed artifact. Public content only (no secrets, no PII). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-10 | Tampering | Hand-written body accidentally ships `Math.random` and passes because we skipped validation | mitigate | Test #4 (`validateTool` over every entry) makes this impossible — CI test is the gate. |
| T-03-11 | Repudiation | Fallback manifest goes stale relative to TS source | mitigate | Task 1 step 2 serializes TS → JSON; rerunning the script regenerates. SUMMARY notes "regenerate on source change". |
| T-03-12 | DoS (demo-time) | Swarm fails AND fallback also missing → Phase 3 has no output | accept | Fallback is committed in this plan. Double-failure requires two independent outages in same session; outside plan's scope. |
</threat_model>

<verification>
- 8 tools in TS export.
- Fallback JSON committed with `tools.length === 8`.
- Every tool validator-green.
- Snake_case names, unique, no network.
</verification>

<success_criteria>
The SWR-08 kill-point's demotion arm is pre-built. Plan 03-04 can trigger this fallback without additional work — just a filesystem copy — guaranteeing Phase 3 always emits a valid `adapter-tools.json` for Phase 4 to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/03-discovery-tool-design/03-05-SUMMARY.md` noting:
- Names of the 8 tools (so narration has a script if we end up on Tier-3).
- Any tool that required rewriting during Task 2 to pass validation, and why.
- Approximate wall-time for the 5-gate validator to run across all 8 (budget input for Plan 03-04's parallelism calibration).
</output>
