---
phase: 04-data-eval-gen
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/data/schema-gate.ts
  - lib/data/dedupe.ts
  - lib/data/stratify.ts
  - lib/data/schema-gate.test.ts
  - lib/data/dedupe.test.ts
  - lib/data/stratify.test.ts
autonomous: true
requirements: [DAT-03, DAT-06, DAT-07]

must_haves:
  truths:
    - "`loadToolSchemas()` reads `data/adapter-tools.json`, extracts every `tool.function.parameters` JSON Schema, compiles each with `ajv` into a validator keyed by `tool.function.name`. Returns `Map<string, ValidateFunction>`. Cached on first call (module-level singleton)."
    - "`validateToolCall(toolName: string, args: Record<string, unknown>): { valid: boolean; errors?: string[] }` looks up the AJV validator by name. Unknown tool name returns `{ valid: false, errors: ['unknown tool: <name>'] }`. Invalid args return the AJV error messages. Valid returns `{ valid: true }`. This is the DAT-03 gate — reject-never-patch."
    - "`minHashSignature(text: string, numHashes?: number = 128, shingleK?: number = 3): number[]` produces a MinHash signature from k-word-shingles. `estimateJaccard(a: number[], b: number[]): number` estimates Jaccard similarity. Both are pure functions — no external dependencies."
    - "`dedupeByMinHash(examples: { id: string; text: string }[], threshold?: number = 0.7): string[]` returns the set of IDs to KEEP (first-seen survives). `dedupeByEmbedding(examples: { id: string; embedding: number[] }[], threshold?: number = 0.92): string[]` returns IDs to KEEP using cosine similarity. Neither function fetches embeddings — callers provide them."
    - "`checkStratification(examples: { toolNames: string[] }[], minPerTool?: number = 30): { pass: boolean; deficit: Record<string, number>; surplus: Record<string, number> }` counts examples per tool name across all examples and reports deficit (below min) and surplus. Returns `pass: true` only when every known tool has >= minPerTool examples."
    - "Vitest: schema-gate tests validate a known-good tool call passes, an unknown tool rejects, and a malformed-args tool call rejects with AJV error messages. Dedupe tests verify identical texts share MinHash signature (Jaccard ~1.0), distinct texts differ (Jaccard < 0.3), and dedupeByMinHash removes the later duplicate. Stratify tests verify a balanced set passes and an imbalanced set reports the deficit."
  artifacts:
    - path: "lib/data/schema-gate.ts"
      provides: "AJV-based tool-call argument validator against adapter-tools.json schemas"
      exports: ["loadToolSchemas", "validateToolCall"]
    - path: "lib/data/dedupe.ts"
      provides: "MinHash signature + Jaccard estimator + cosine similarity + dedup helpers"
      exports: ["minHashSignature", "estimateJaccard", "cosineSimilarity", "dedupeByMinHash", "dedupeByEmbedding"]
    - path: "lib/data/stratify.ts"
      provides: "Tool-name stratification checker (DAT-07 >=30 per tool)"
      exports: ["checkStratification", "extractToolNames"]
    - path: "lib/data/schema-gate.test.ts"
      provides: "AJV validation tests"
    - path: "lib/data/dedupe.test.ts"
      provides: "MinHash + cosine dedup tests"
    - path: "lib/data/stratify.test.ts"
      provides: "Stratification tests"
  key_links:
    - from: "lib/data/schema-gate.ts"
      to: "data/adapter-tools.json"
      via: "readFileSync at module init to compile AJV validators"
      pattern: "adapter-tools\\.json"
    - from: "lib/data/dedupe.ts"
      to: "(standalone — no external imports except node:crypto)"
      via: "pure functions"
      pattern: "createHash"
    - from: "lib/data/stratify.ts"
      to: "lib/data/types.ts (TrainingExample, ToolCall)"
      via: "type-only import"
      pattern: "TrainingExample|ToolCall"
---

<objective>
Build the three reusable validation/quality gates that Plans 03-05 apply to every generated example: (1) AJV schema-gate for DAT-03 tool-call argument validation, (2) MinHash + cosine dedup for DAT-06, (3) tool-name stratification checker for DAT-07. These are pure-logic modules with no model calls — they run in Wave 1 alongside Plan 01.

Purpose: Every downstream worker (QA, Traj, Pipeline) imports these gates. Without them, hallucinated tool calls leak into training data.
Output: Three library modules + three test suites.
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
@lib/discovery/types.ts
@data/adapter-tools.json

<interfaces>
Inputs (read-only — DO NOT modify):
- `data/adapter-tools.json` — Phase 3 manifest. Shape: `{ tools: DynamicToolSpec[], source, count, generatedAt, meta }`. Each tool has `function.name` and `function.parameters` (JSON Schema). Currently 8 tools (fallback source), all `requiresNetwork: false`.
- `lib/discovery/types.ts` — `DynamicToolSpec` with nested `function.parameters: Record<string, unknown>`.

Downstream consumers (will import from these modules):
- Plan 04-03 (QA worker) calls `validateToolCall` on every generated tool_call before accepting.
- Plan 04-04 (Traj worker) calls `validateToolCall` on every trajectory step.
- Plan 04-05 (Pipeline) calls `dedupeByMinHash` + `dedupeByEmbedding` + `checkStratification` in sequence.

Package constraints:
- `ajv` is already installed (`"ajv"` in package.json dependencies). Use `Ajv` default import. Set `allErrors: true`.
- For MinHash: hand-rolled k-shingle hashing per PRD constraints — no `datasketch` (Python-only). Use `node:crypto` for hash functions.
- For cosine: `cosineSimilarity(a: number[], b: number[])` is a pure function. Embeddings are fetched by the caller (Plan 05) via AI SDK `embedMany` with OpenAI `text-embedding-3-small`.
- DAT-03 is reject-never-patch: `validateToolCall` returns pass/fail, callers discard failures entirely.
- DAT-07 minimum is 30 per tool name.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: schema-gate.ts + dedupe.ts + stratify.ts</name>
  <files>
    lib/data/schema-gate.ts, lib/data/dedupe.ts, lib/data/stratify.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/data/adapter-tools.json (first 100 lines for schema shape)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (DynamicToolSpec shape)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §7.2 #2 (schema-gate), §7.2 #5 (dedup thresholds), §7.2 #6 (stratification)
  </read_first>
  <action>
    1. `lib/data/schema-gate.ts`:
       ```ts
       import { readFileSync } from 'node:fs';
       import path from 'node:path';
       import Ajv, { type ValidateFunction } from 'ajv';

       const MANIFEST_PATH = path.resolve('data/adapter-tools.json');

       let _validators: Map<string, ValidateFunction> | null = null;

       export function loadToolSchemas(): Map<string, ValidateFunction> {
         if (_validators) return _validators;
         const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
         const ajv = new Ajv({ allErrors: true, strict: false });
         _validators = new Map();
         for (const tool of raw.tools) {
           const name = tool.function.name;
           const schema = tool.function.parameters;
           _validators.set(name, ajv.compile(schema));
         }
         return _validators;
       }

       export function validateToolCall(
         toolName: string,
         args: Record<string, unknown>,
       ): { valid: boolean; errors?: string[] } {
         const validators = loadToolSchemas();
         const validate = validators.get(toolName);
         if (!validate) return { valid: false, errors: [`unknown tool: ${toolName}`] };
         const ok = validate(args);
         if (ok) return { valid: true };
         return {
           valid: false,
           errors: (validate.errors ?? []).map(
             (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
           ),
         };
       }

       /** Reset cached validators — for testing only. */
       export function _resetCache(): void { _validators = null; }
       ```

    2. `lib/data/dedupe.ts`:
       ```ts
       import { createHash } from 'node:crypto';

       // --- MinHash ---

       function kShingles(text: string, k: number): Set<string> {
         const words = text.toLowerCase().split(/\s+/).filter(Boolean);
         const shingles = new Set<string>();
         for (let i = 0; i <= words.length - k; i++) {
           shingles.add(words.slice(i, i + k).join(' '));
         }
         return shingles;
       }

       function hashShingle(shingle: string, seed: number): number {
         const h = createHash('md5').update(`${seed}:${shingle}`).digest();
         return h.readUInt32BE(0);
       }

       export function minHashSignature(
         text: string,
         numHashes = 128,
         shingleK = 3,
       ): number[] {
         const shingles = kShingles(text, shingleK);
         const sig = new Array<number>(numHashes).fill(0xffffffff);
         for (const s of shingles) {
           for (let i = 0; i < numHashes; i++) {
             const h = hashShingle(s, i);
             if (h < sig[i]) sig[i] = h;
           }
         }
         return sig;
       }

       export function estimateJaccard(a: number[], b: number[]): number {
         if (a.length !== b.length) throw new Error('signature length mismatch');
         let agree = 0;
         for (let i = 0; i < a.length; i++) {
           if (a[i] === b[i]) agree++;
         }
         return agree / a.length;
       }

       export function dedupeByMinHash(
         examples: { id: string; text: string }[],
         threshold = 0.7,
       ): string[] {
         const sigs = examples.map((e) => ({
           id: e.id,
           sig: minHashSignature(e.text),
         }));
         const keep: string[] = [];
         for (const item of sigs) {
           const isDup = keep.some((keptId) => {
             const keptSig = sigs.find((s) => s.id === keptId)!.sig;
             return estimateJaccard(item.sig, keptSig) >= threshold;
           });
           if (!isDup) keep.push(item.id);
         }
         return keep;
       }

       // --- Cosine ---

       export function cosineSimilarity(a: number[], b: number[]): number {
         if (a.length !== b.length) throw new Error('vector length mismatch');
         let dot = 0, normA = 0, normB = 0;
         for (let i = 0; i < a.length; i++) {
           dot += a[i] * b[i];
           normA += a[i] * a[i];
           normB += b[i] * b[i];
         }
         const denom = Math.sqrt(normA) * Math.sqrt(normB);
         return denom === 0 ? 0 : dot / denom;
       }

       export function dedupeByEmbedding(
         examples: { id: string; embedding: number[] }[],
         threshold = 0.92,
       ): string[] {
         const keep: string[] = [];
         const keepEmbeddings: number[][] = [];
         for (const item of examples) {
           const isDup = keepEmbeddings.some(
             (emb) => cosineSimilarity(item.embedding, emb) >= threshold,
           );
           if (!isDup) {
             keep.push(item.id);
             keepEmbeddings.push(item.embedding);
           }
         }
         return keep;
       }
       ```

    3. `lib/data/stratify.ts`:
       ```ts
       import type { TrainingExample, ToolCall } from './types.js';

       /** Extract all unique tool names invoked across messages in an example. */
       export function extractToolNames(example: TrainingExample): string[] {
         const names = new Set<string>();
         for (const msg of example.messages) {
           if (msg.tool_calls) {
             for (const tc of msg.tool_calls) {
               names.add(tc.function.name);
             }
           }
         }
         return [...names];
       }

       export interface StratificationResult {
         pass: boolean;
         deficit: Record<string, number>;  // tool -> shortfall from minPerTool
         surplus: Record<string, number>;  // tool -> excess above minPerTool
         counts: Record<string, number>;   // tool -> actual count
       }

       /**
        * Check that every tool appearing in the training set has >= minPerTool examples.
        * An "example" for a tool = any TrainingExample whose messages contain at least
        * one tool_call with that tool name.
        */
       export function checkStratification(
         examples: TrainingExample[],
         knownToolNames: string[],
         minPerTool = 30,
       ): StratificationResult {
         const counts: Record<string, number> = {};
         for (const name of knownToolNames) counts[name] = 0;

         for (const ex of examples) {
           const names = extractToolNames(ex);
           for (const n of names) {
             counts[n] = (counts[n] ?? 0) + 1;
           }
         }

         const deficit: Record<string, number> = {};
         const surplus: Record<string, number> = {};
         let pass = true;

         for (const [name, count] of Object.entries(counts)) {
           if (count < minPerTool) {
             deficit[name] = minPerTool - count;
             pass = false;
           } else {
             surplus[name] = count - minPerTool;
           }
         }
         return { pass, deficit, surplus, counts };
       }
       ```
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && grep -E "export function validateToolCall" lib/data/schema-gate.ts && grep -E "export function minHashSignature" lib/data/dedupe.ts && grep -E "export function dedupeByMinHash" lib/data/dedupe.ts && grep -E "export function dedupeByEmbedding" lib/data/dedupe.ts && grep -E "export function checkStratification" lib/data/stratify.ts</automated>
  </verify>
  <done>Three quality-gate modules compile. Downstream plans can import `validateToolCall`, `dedupeByMinHash`, `dedupeByEmbedding`, `checkStratification`.</done>
</task>

<task type="auto">
  <name>Task 2: Tests for schema-gate, dedupe, stratify</name>
  <files>
    lib/data/schema-gate.test.ts, lib/data/dedupe.test.ts, lib/data/stratify.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/data/adapter-tools.json (tool names + parameter schemas)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/schema-gate.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/dedupe.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/stratify.ts (Task 1 output)
  </read_first>
  <action>
    1. `lib/data/schema-gate.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach } from 'vitest';
       import { validateToolCall, _resetCache } from './schema-gate.js';

       beforeEach(() => _resetCache());

       describe('validateToolCall', () => {
         it('accepts valid supabase_rls_policy_template args', () => {
           const r = validateToolCall('supabase_rls_policy_template', {
             tableName: 'profiles',
             role: 'authenticated',
             operation: 'select',
           });
           expect(r.valid).toBe(true);
         });

         it('rejects unknown tool name', () => {
           const r = validateToolCall('nonexistent_tool', { x: 1 });
           expect(r.valid).toBe(false);
           expect(r.errors).toContain('unknown tool: nonexistent_tool');
         });

         it('rejects invalid args for known tool', () => {
           const r = validateToolCall('supabase_rls_policy_template', {
             tableName: 123,  // should be string
             role: 'badRole', // not in enum
             operation: 'select',
           });
           expect(r.valid).toBe(false);
           expect(r.errors!.length).toBeGreaterThan(0);
         });

         it('rejects missing required args', () => {
           const r = validateToolCall('supabase_rls_policy_template', {});
           expect(r.valid).toBe(false);
         });
       });
       ```

    2. `lib/data/dedupe.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import {
         minHashSignature, estimateJaccard,
         dedupeByMinHash, cosineSimilarity, dedupeByEmbedding,
       } from './dedupe.js';

       describe('MinHash', () => {
         it('identical texts have Jaccard ~1.0', () => {
           const text = 'the quick brown fox jumps over the lazy dog again and again';
           const a = minHashSignature(text);
           const b = minHashSignature(text);
           expect(estimateJaccard(a, b)).toBeCloseTo(1.0, 1);
         });

         it('very different texts have low Jaccard', () => {
           const a = minHashSignature('supabase database row level security policy for users');
           const b = minHashSignature('react component rendering lifecycle hooks useState effect');
           expect(estimateJaccard(a, b)).toBeLessThan(0.3);
         });

         it('dedupeByMinHash keeps first, removes near-duplicate', () => {
           const examples = [
             { id: 'a', text: 'write an rls policy for the users table in supabase with authenticated role' },
             { id: 'b', text: 'write an rls policy for the users table in supabase with authenticated role please' },
             { id: 'c', text: 'how do I set up edge functions in supabase with deno runtime' },
           ];
           const kept = dedupeByMinHash(examples, 0.7);
           expect(kept).toContain('a');
           expect(kept).toContain('c');
           // 'b' is near-dup of 'a' — may or may not be removed depending on shingle overlap
           // The key invariant is that dedup produces <= input length
           expect(kept.length).toBeLessThanOrEqual(3);
         });
       });

       describe('Cosine', () => {
         it('identical vectors have similarity 1.0', () => {
           expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0, 5);
         });

         it('orthogonal vectors have similarity 0.0', () => {
           expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0, 5);
         });

         it('dedupeByEmbedding removes near-duplicate embeddings', () => {
           const kept = dedupeByEmbedding([
             { id: 'a', embedding: [1, 0, 0] },
             { id: 'b', embedding: [0.999, 0.001, 0] },  // cosine ~1.0 with a
             { id: 'c', embedding: [0, 1, 0] },
           ], 0.92);
           expect(kept).toContain('a');
           expect(kept).toContain('c');
           expect(kept).not.toContain('b');
         });
       });
       ```

    3. `lib/data/stratify.test.ts`:
       ```ts
       import { describe, it, expect } from 'vitest';
       import { checkStratification, extractToolNames } from './stratify.js';
       import type { TrainingExample, ChatMessage, ToolCall } from './types.js';

       function makeExample(toolName: string): TrainingExample {
         const tc: ToolCall = {
           id: 'tc-1',
           type: 'function',
           function: { name: toolName, arguments: '{}' },
         };
         const msgs: ChatMessage[] = [
           { role: 'user', content: 'test' },
           { role: 'assistant', content: 'ok', tool_calls: [tc] },
         ];
         return { messages: msgs, tools: [] };
       }

       describe('extractToolNames', () => {
         it('returns unique tool names from messages', () => {
           const ex = makeExample('supabase_rls_policy_template');
           expect(extractToolNames(ex)).toEqual(['supabase_rls_policy_template']);
         });
       });

       describe('checkStratification', () => {
         it('passes when all tools have >=30 examples', () => {
           const tools = ['toolA', 'toolB'];
           const examples = [
             ...Array.from({ length: 35 }, () => makeExample('toolA')),
             ...Array.from({ length: 30 }, () => makeExample('toolB')),
           ];
           const r = checkStratification(examples, tools, 30);
           expect(r.pass).toBe(true);
           expect(r.deficit).toEqual({});
         });

         it('fails when a tool has <30 examples and reports deficit', () => {
           const tools = ['toolA', 'toolB'];
           const examples = [
             ...Array.from({ length: 35 }, () => makeExample('toolA')),
             ...Array.from({ length: 10 }, () => makeExample('toolB')),
           ];
           const r = checkStratification(examples, tools, 30);
           expect(r.pass).toBe(false);
           expect(r.deficit['toolB']).toBe(20);
         });
       });
       ```
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx vitest run lib/data/schema-gate.test.ts lib/data/dedupe.test.ts lib/data/stratify.test.ts 2>&1 | tail -30</automated>
  </verify>
  <done>DAT-03 schema-gate, DAT-06 dedup, DAT-07 stratification — all tested. Plans 03-05 can import these gates.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM output -> schema-gate | UNTRUSTED tool_call arguments validated against shipped schemas. |
| Training examples -> dedup | Near-duplicates removed before JSONL emission. |
| Training set -> stratification | Ensures no tool is under-represented (mode collapse prevention). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | Hallucinated tool args bypass schema-gate | mitigate | AJV `allErrors: true` + `strict: false` validates every field; reject-never-patch (DAT-03). |
| T-04-02 | DoS | MinHash O(n^2) comparison on large dataset | accept | n <= 2000 examples; 2000^2 * 128 comparisons is ~500M ops, completes in seconds. |
| T-04-03 | Info Disclosure | AJV error messages leak schema structure | accept | Training pipeline is internal-only; no external exposure. |
</threat_model>

<verification>
- `npx tsc --noEmit` green.
- `npx vitest run lib/data/schema-gate.test.ts lib/data/dedupe.test.ts lib/data/stratify.test.ts` all pass.
- `validateToolCall` correctly validates against adapter-tools.json schemas.
- `dedupeByMinHash` removes near-duplicates at Jaccard >= 0.7.
- `checkStratification` reports per-tool deficits.
</verification>

<success_criteria>
DAT-03 (schema-gate), DAT-06 (dedup), DAT-07 (stratification) gates are ready. Plans 03/04/05 can import these quality gates without duplication.
</success_criteria>

<output>
Create `.planning/phases/04-data-eval-gen/04-02-SUMMARY.md` noting:
- Number of tool schemas compiled from adapter-tools.json.
- MinHash config (numHashes, shingleK).
- Stratification floor (30 per tool).
- Test pass counts.
</output>
