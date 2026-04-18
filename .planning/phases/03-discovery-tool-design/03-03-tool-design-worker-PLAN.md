---
phase: 03-discovery-tool-design
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - lib/discovery/worker.ts
  - lib/discovery/prompts.ts
  - lib/discovery/worker.test.ts
autonomous: true
requirements: [SWR-02]

must_haves:
  truths:
    - "`toolDesignWorker(input)` takes `{ workerId, slice: Chunk[], model?, temperature? }` and returns `DynamicToolSpec[]` via a single AI SDK v6 `generateObject` call against Claude Opus 4.5 with a Zod-validated schema."
    - "Every returned spec has `type:'function'`, `function.name` in snake_case, `function.parameters` as a JSON Schema object, `meta.jsBody` as a `function <name>(args) { ... }` string, `meta.requiresNetwork: boolean`, and `meta.trajectories.length ≥ 3`."
    - "The prompt embeds slice chunks as `<chunk id=\"...\" source=\"...\">` blocks, names the 5 validation gates, lists banned identifiers, and instructs the model toward pure-compute offline-capable bodies."
    - "A mocked unit test (custom `LanguageModel` stub returning a hand-crafted object) proves `toolDesignWorker` returns a valid `DynamicToolSpec[]` without any live provider call."
    - "`sourceWorker` on every returned spec is set to the passed `workerId` (server-side enforcement, not trusting the model to do it)."
  artifacts:
    - path: "lib/discovery/worker.ts"
      provides: "toolDesignWorker + DYNAMIC_TOOL_SPEC_SCHEMA"
      exports: ["toolDesignWorker", "DYNAMIC_TOOL_SPEC_SCHEMA", "ToolDesignWorkerInput"]
    - path: "lib/discovery/prompts.ts"
      provides: "buildToolDesignPrompt + BANNED_LIST system-prompt constants"
      exports: ["buildToolDesignPrompt", "BANNED_LIST"]
    - path: "lib/discovery/worker.test.ts"
      provides: "Mocked worker test — no network"
  key_links:
    - from: "lib/discovery/worker.ts"
      to: "ai (generateObject) + @ai-sdk/anthropic"
      via: "generateObject({ model, schema, prompt, system })"
      pattern: "generateObject\\("
    - from: "lib/discovery/worker.ts"
      to: "lib/discovery/types.ts"
      via: "import type { DynamicToolSpec, Chunk }"
      pattern: "DynamicToolSpec"
---

<objective>
Deliver the single tool-design worker function that Wave 3's swarm invokes 4× in parallel. This plan ships ONLY the worker body + prompt + mocked test — not the swarm, not the pipeline, not the manifest.

Purpose: Isolating the worker lets its prompt and Zod schema iterate independently before Wave 3 wires 4 copies in parallel (SWR-02 requirement of ≥3 trajectories per spec). Mocked test means plan is validated without burning provider TPM.
Output: `toolDesignWorker(input) -> Promise<DynamicToolSpec[]>` + mocked unit test.
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
@.planning/phases/03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md

<interfaces>
Wave 1 dependency (03-01): `lib/discovery/types.ts` exports `DynamicToolSpec`, `Chunk`.

AI SDK v6 imports (same surface as Phase 1 + Phase 2):
```ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
```

Model alias: `anthropic('claude-opus-4-5')` primary, fallback chain `claude-opus-4-7` → `claude-opus-4-latest` → `google('gemini-2.5-pro')` on 429/404 (PITFALLS P22). The worker takes `model` as an optional parameter so Wave 3 can swap at runtime.

`ToolDesignWorkerInput` shape:
```ts
interface ToolDesignWorkerInput {
  workerId: string;                         // e.g. "tool-design-3"
  slice: Chunk[];                            // strided slice of CORPUS.chunks
  model?: LanguageModel;                     // override; default anthropic('claude-opus-4-5')
  temperature?: number;                      // default 0.4; retry uses 0.8
  maxCandidatesPerWorker?: number;           // default 6 (Zod schema caps at 8)
}
```

Zod schema (single source of truth for the `generateObject` call):
```ts
const Z_TRAJECTORY = z.object({
  userPrompt: z.string(),
  call: z.object({ name: z.string(), arguments: z.record(z.string(), z.any()) }),
  result: z.any(),
});
const Z_DYNAMIC_TOOL_SPEC = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(10).max(400),
    parameters: z.record(z.string(), z.any()),
  }),
  meta: z.object({
    jsBody: z.string().min(20).max(4000),
    requiresNetwork: z.boolean(),
    trajectories: z.array(Z_TRAJECTORY).min(3).max(6),
    sourceWorker: z.string(),
    sourceChunks: z.array(z.string()),
  }),
});
export const DYNAMIC_TOOL_SPEC_SCHEMA = z.object({
  tools: z.array(Z_DYNAMIC_TOOL_SPEC).min(1).max(8),
});
```

Banned identifier list (re-cited in the system prompt so the model pre-clears Gate 2):
`fetch, require, import, process, globalThis, eval, Function, crypto, performance, Math.random, Date.now, constructor.constructor`.

Prompt design (research §Pattern 2, §Pitfall 4):
- System prompt names the 5 gates explicitly; says "rejected tools are discarded without retry — design defensively."
- User message embeds chunks as `<chunk id="..." source="...">...</chunk>` blocks.
- Temperature 0.4 default; 0.8 on retry (Wave 3 decides).

HARD CONSTRAINTS (CLAUDE.md): no auto-formatting of model output; prefer `requiresNetwork: false` for airplane-mode demo.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: prompts.ts + worker.ts with generateObject + Zod schema</name>
  <files>
    lib/discovery/prompts.ts, lib/discovery/worker.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §9.2 (tool-design swarm), §10.3 (discovery pattern)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Pattern 2, Pitfall 4)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (Plan 03-01 output — DynamicToolSpec + Chunk)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md (AI SDK v6 import + experimental_telemetry pattern)
  </read_first>
  <action>
    1. Write `lib/discovery/prompts.ts`:
       ```ts
       import type { Chunk } from './types.js';

       export const BANNED_LIST = [
         'fetch','require','import','process','globalThis','eval','Function',
         'crypto','performance','Math.random','Date.now','constructor.constructor',
       ];

       const SYSTEM = `You are a tool-design worker in a parallel swarm of 4. Read the Supabase documentation chunks below and propose 3–6 JavaScript tools the downstream Gemma 4 adapter can call.

EVERY tool MUST:
1. Have a snake_case name matching /^[a-z][a-z0-9_]*$/.
2. Have a JSON Schema (draft 2020-12) \`parameters\` object with \`type:"object"\` and at least one required property.
3. Have a \`jsBody\` that is EXACTLY one top-level \`function <name>(args) { ... }\` declaration returning a JSON-serializable object.
4. NEVER reference any of these (AST deny-list; rejection is automatic): ${BANNED_LIST.join(', ')}.
5. Include EXACTLY 3 example \`trajectories\` where \`result\` is what \`function(call.arguments)\` actually returns (deterministic). If you would write \`Date.now()\`, rewrite the tool to take \`timestampMs\` as an argument.
6. Prefer \`requiresNetwork: false\` — the target device is in airplane mode. Only set true if the tool fundamentally cannot work offline.
7. Populate \`sourceChunks\` with the chunk ids you grounded this tool in.

Your output passes 5 validation gates: schema well-formedness, AST parse + deny-list, sandbox execution (2s / 64MB caps), 10-input fuzz (≥8 serializable), trajectory self-consistency. Tools failing ANY gate are discarded with no retry. Design defensively.

Output shape: { tools: DynamicToolSpec[] } with 3–6 entries. Stop when you have enough; do not pad.`;

       export function buildToolDesignPrompt(workerId: string, slice: Chunk[]): { system: string; user: string } {
         const body = slice
           .map((c) => `<chunk id="${c.id}" source="${c.source}">\n${c.text}\n</chunk>`)
           .join('\n\n');
         const user = `Worker id: ${workerId}. Slice of ${slice.length} chunks below. Design 3–6 tools that could answer Supabase developer questions grounded in these chunks.\n\n${body}`;
         return { system: SYSTEM, user };
       }
       ```

    2. Write `lib/discovery/worker.ts`:
       ```ts
       import { generateObject, type LanguageModel } from 'ai';
       import { anthropic } from '@ai-sdk/anthropic';
       import { z } from 'zod';
       import type { Chunk, DynamicToolSpec } from './types.js';
       import { buildToolDesignPrompt } from './prompts.js';

       const Z_TRAJECTORY = z.object({
         userPrompt: z.string(),
         call: z.object({ name: z.string(), arguments: z.record(z.string(), z.any()) }),
         result: z.any(),
       });
       const Z_DYNAMIC_TOOL_SPEC = z.object({
         type: z.literal('function'),
         function: z.object({
           name: z.string().regex(/^[a-z][a-z0-9_]*$/),
           description: z.string().min(10).max(400),
           parameters: z.record(z.string(), z.any()),
         }),
         meta: z.object({
           jsBody: z.string().min(20).max(4000),
           requiresNetwork: z.boolean(),
           trajectories: z.array(Z_TRAJECTORY).min(3).max(6),
           sourceWorker: z.string(),
           sourceChunks: z.array(z.string()),
         }),
       });
       export const DYNAMIC_TOOL_SPEC_SCHEMA = z.object({
         tools: z.array(Z_DYNAMIC_TOOL_SPEC).min(1).max(8),
       });

       export interface ToolDesignWorkerInput {
         workerId: string;
         slice: Chunk[];
         model?: LanguageModel;
         temperature?: number;
         maxCandidatesPerWorker?: number;
       }

       export async function toolDesignWorker(input: ToolDesignWorkerInput): Promise<DynamicToolSpec[]> {
         const { workerId, slice, model, temperature = 0.4 } = input;
         const { system, user } = buildToolDesignPrompt(workerId, slice);
         const { object } = await generateObject({
           model: model ?? anthropic('claude-opus-4-5'),
           schema: DYNAMIC_TOOL_SPEC_SCHEMA,
           system,
           prompt: user,
           temperature,
           experimental_telemetry: { isEnabled: true, functionId: `tool-design.${workerId}` },
         });
         // Server-side stamp sourceWorker — do not trust the model.
         return object.tools.map((t) => ({
           ...t,
           meta: { ...t.meta, sourceWorker: workerId },
         })) as DynamicToolSpec[];
       }
       ```
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && grep -E "export async function toolDesignWorker" lib/discovery/worker.ts && grep -E "generateObject\\(" lib/discovery/worker.ts && grep -E "DYNAMIC_TOOL_SPEC_SCHEMA" lib/discovery/worker.ts && grep -E "\\[a-z\\]\\[a-z0-9_\\]\\*" lib/discovery/worker.ts && grep -E "BANNED_LIST" lib/discovery/prompts.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export async function toolDesignWorker" lib/discovery/worker.ts` succeeds.
    - `grep -E "DYNAMIC_TOOL_SPEC_SCHEMA" lib/discovery/worker.ts` succeeds.
    - `grep -E "anthropic\\('claude-opus-4-5'\\)" lib/discovery/worker.ts` succeeds.
    - `grep -E "experimental_telemetry" lib/discovery/worker.ts` succeeds (Sentry ai.agent span attribute will pick this up).
    - `grep -E "sourceWorker: workerId" lib/discovery/worker.ts` succeeds (server-side stamping).
    - `grep -E "BANNED_LIST" lib/discovery/prompts.ts` succeeds and list is embedded in SYSTEM prompt.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>`toolDesignWorker` and its prompt exist and typecheck. The Zod schema enforces the shape every downstream consumer depends on.</done>
</task>

<task type="auto">
  <name>Task 2: Mocked unit test — no network</name>
  <files>
    lib/discovery/worker.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/worker.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/03-discovery-tool-design/03-RESEARCH.md (Validation Architecture — worker.test.ts is named as a Wave 0 gap)
  </read_first>
  <action>
    1. Write `lib/discovery/worker.test.ts` using a custom `LanguageModel` stub (AI SDK v6 exposes `MockLanguageModelV2` in test utilities; if not, hand-roll a minimal `LanguageModel`-conforming stub that returns a hardcoded object for `doGenerate`):

       ```ts
       import { describe, it, expect } from 'vitest';
       import { toolDesignWorker, DYNAMIC_TOOL_SPEC_SCHEMA } from './worker.js';
       import type { Chunk } from './types.js';
       import type { LanguageModel } from 'ai';

       const fakeCorpus: Chunk[] = [
         { id: 'llms.txt#0001', source: 'llms', text: 'Supabase Row Level Security uses Postgres policies...', tokenCount: 40, ordinal: 1 },
         { id: 'llms.txt#0002', source: 'llms', text: 'Storage buckets are namespaced by project...', tokenCount: 30, ordinal: 2 },
       ];

       const fakeSpec = {
         tools: [
           {
             type: 'function' as const,
             function: {
               name: 'rls_policy_template',
               description: 'Emit a Supabase RLS policy template for a table/role/op.',
               parameters: {
                 type: 'object',
                 properties: {
                   tableName: { type: 'string' },
                   role: { type: 'string' },
                   operation: { type: 'string' },
                 },
                 required: ['tableName','role','operation'],
               },
             },
             meta: {
               jsBody: 'function rls_policy_template(args) { return { policy: "CREATE POLICY " + args.tableName }; }',
               requiresNetwork: false,
               trajectories: [
                 { userPrompt: 'policy for profiles', call: { name:'rls_policy_template', arguments:{tableName:'profiles',role:'authenticated',operation:'select'} }, result: { policy: 'CREATE POLICY profiles' } },
                 { userPrompt: 'policy for posts',    call: { name:'rls_policy_template', arguments:{tableName:'posts',role:'authenticated',operation:'insert'} },    result: { policy: 'CREATE POLICY posts' } },
                 { userPrompt: 'policy for comments', call: { name:'rls_policy_template', arguments:{tableName:'comments',role:'service_role',operation:'delete'} }, result: { policy: 'CREATE POLICY comments' } },
               ],
               sourceWorker: 'WILL-BE-OVERWRITTEN',  // worker.ts enforces workerId
               sourceChunks: ['llms.txt#0001'],
             },
           },
         ],
       };

       // Hand-rolled minimal LanguageModelV2 stub. If AI SDK v6 ships MockLanguageModelV2,
       // prefer `import { MockLanguageModelV2 } from 'ai/test'` and use that instead.
       function makeMockModel(): LanguageModel {
         return {
           specificationVersion: 'v2',
           provider: 'mock',
           modelId: 'mock-tool-design',
           supportedUrls: {},
           async doGenerate() {
             return {
               content: [{ type: 'text', text: JSON.stringify(fakeSpec) }],
               finishReason: 'stop',
               usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
               warnings: [],
             } as any;
           },
           async doStream() { throw new Error('not implemented in test'); },
         } as unknown as LanguageModel;
       }

       describe('toolDesignWorker (mocked)', () => {
         it('returns DynamicToolSpec[] with ≥1 valid entry', async () => {
           const out = await toolDesignWorker({
             workerId: 'tool-design-0',
             slice: fakeCorpus,
             model: makeMockModel(),
           });
           expect(out.length).toBeGreaterThanOrEqual(1);
           expect(out[0].type).toBe('function');
           expect(out[0].function.name).toMatch(/^[a-z][a-z0-9_]*$/);
           expect(out[0].meta.trajectories.length).toBeGreaterThanOrEqual(3);
         });
         it('overwrites sourceWorker with the passed workerId', async () => {
           const out = await toolDesignWorker({
             workerId: 'tool-design-7',
             slice: fakeCorpus,
             model: makeMockModel(),
           });
           for (const t of out) expect(t.meta.sourceWorker).toBe('tool-design-7');
         });
         it('DYNAMIC_TOOL_SPEC_SCHEMA accepts the fake spec (Zod parse)', () => {
           expect(() => DYNAMIC_TOOL_SPEC_SCHEMA.parse(fakeSpec)).not.toThrow();
         });
       });
       ```

    2. Run the test. If the AI SDK v6 `LanguageModel` interface does not match the stub (version drift), inspect `node_modules/ai/dist/index.d.ts` for the actual required methods and adjust the stub. Specifically look for `LanguageModelV2` / `LanguageModelV1` interface and required fields (`specificationVersion`, `provider`, `modelId`, `doGenerate`).

    3. If `generateObject` in AI SDK v6 refuses the stub because it validates the model spec version, a simpler alternative is to mock at the module level using Vitest's `vi.mock('ai', ...)`:
       ```ts
       import { vi } from 'vitest';
       vi.mock('ai', async (importOriginal) => {
         const actual = await importOriginal<typeof import('ai')>();
         return { ...actual, generateObject: async () => ({ object: fakeSpec }) };
       });
       ```
       Use whichever approach compiles + passes; document the choice in the SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/discovery/worker.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `lib/discovery/worker.test.ts` exists and references no live API keys.
    - `grep -E "fakeSpec|vi\\.mock\\(['\"]ai['\"]" lib/discovery/worker.test.ts` succeeds (mock is in-file).
    - `npx vitest run lib/discovery/worker.test.ts` all 3 tests pass.
    - Test does NOT hit the network (no `ANTHROPIC_API_KEY` required).
  </acceptance_criteria>
  <done>SWR-02 worker unit-tested. Wave 3 can confidently spawn 4 parallel `toolDesignWorker` calls knowing the shape contract holds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Corpus chunks → prompt | Public Supabase docs embedded in user message. Prompt-injection potential (Pitfall) — AST deny-list catches malicious `fetch` bodies. |
| Model output → `generateObject` Zod parse | UNTRUSTED. Zod schema enforces shape before anything else touches the object. |
| `workerId` stamping | Server-side; model cannot forge. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-13 | Tampering | Prompt injection in `llms.txt` steers worker to emit `fetch('evil.com')` body | mitigate | Worker output flows to Plan 03-02's Gate 2 AST deny-list before any execution. |
| T-03-14 | Information Disclosure | Provider error leaks API key via error body | mitigate | No custom error surfacing here; AI SDK v6 errors are already redacted. |
| T-03-15 | DoS | Worker infinite-loops on huge slice | mitigate | `generateObject` default timeout; Wave 3 wraps call in `AbortSignal.timeout(90_000)` per PITFALLS P10. |
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0.
- `npx vitest run lib/discovery/worker.test.ts` all tests pass.
- No API key required in test env.
- `sourceWorker` stamping verified by test.
</verification>

<success_criteria>
SWR-02 worker ready for parallel wiring. `DYNAMIC_TOOL_SPEC_SCHEMA` is the single source of truth for the shape Wave 3 + Plan 03-02 validator both consume.
</success_criteria>

<output>
After completion, create `.planning/phases/03-discovery-tool-design/03-03-SUMMARY.md` noting:
- Whether mocking was done via model stub or `vi.mock('ai', ...)`.
- Exact AI SDK v6 `LanguageModel` interface version observed (v1 vs v2 spec) — Wave 3 needs this for real-call wiring.
- Any Zod parse errors observed during model-stub iteration.
</output>
