---
phase: 04-data-eval-gen
plan: 05
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - lib/data/judge.ts
  - lib/data/eval-gen.ts
  - lib/data/emit-jsonl.ts
  - lib/data/pipeline.ts
  - app/api/data-gen/route.ts
  - lib/data/judge.test.ts
  - lib/data/emit-jsonl.test.ts
  - data/training.jsonl
  - data/eval.jsonl
autonomous: true
requirements: [DAT-04, DAT-05, DAT-06, DAT-07, DAT-08, DAT-09, DAT-10]

must_haves:
  truths:
    - "`judgeExample(example: TrainingExample, judgeModel: 'gpt-5'|'gemini-2.5-pro'): Promise<JudgeScore>` rates one example on 4 Likert dimensions (faithfulness, toolCorrectness, naturalness, grounding) using AI SDK `generateObject` with the specified judge model at temperature 0. Returns `JudgeScore` with the model name. Uses OpenAI provider for 'gpt-5' and Google provider for 'gemini-2.5-pro'."
    - "`judgeJury(examples: TrainingExample[], opts?: { geminiSampleRate?: 0.2 }): Promise<{ scores: Map<string, JudgeScore[]>, disagreements: Array<{ exampleId, dim, gpt5Score, geminiScore }>, accepted: TrainingExample[], rejected: TrainingExample[] }>` runs GPT-5 on ALL examples and Gemini on a 20% random sample under `p-limit(15)`. Jury score = GPT-5 score (Gemini is cross-check only). Examples with ANY dimension < 4 are rejected. Disagreements > 1 Likert point on any dimension are logged."
    - "`generateEvalSet(opts: { evalChunks, tools, counts? })` produces 70 held-out eval items via GPT-5 (cross-family from Opus training data — DAT-10 anti-leakage). Default `counts = { factual: 40, reasoning: 10, singleTurnTool: 15, multiTurnTool: 5 }`. Each `EvalItem` has `{ id, kind, prompt, expected?, expectedToolCalls?, sourceChunks }`. Uses AI SDK `generateObject` with `openai('gpt-5')`."
    - "`emitTrainingJsonl(examples: TrainingExample[], outPath: string)` writes one JSON object per line in mlx-lm `tools` format: each line is `JSON.stringify({ messages: [...], tools: [...] })`. The `messages` array uses `role`/`content`/`tool_calls`/`tool_call_id`/`name` fields. The `tools` array is the OpenAI function-calling schema (`[{type:'function', function:{name, description, parameters}}]`). This is the DAT-08 kill-point format."
    - "`emitEvalJsonl(items: EvalItem[], outPath: string)` writes one JSON object per line. Each line is `JSON.stringify(EvalItem)`."
    - "`runDataGenPipeline(opts)` orchestrates the full Phase 4 flow: (1) load corpus + split (Plan 01), (2) load tools from adapter-tools.json, (3) fan out QA + Traj workers in parallel (Plans 03+04), (4) merge all examples, (5) judge-jury filter (DAT-04 + DAT-05), (6) MinHash + embedding dedup (DAT-06), (7) stratification check (DAT-07), (8) emit `data/training.jsonl` (DAT-08), (9) generate eval set from eval chunks (DAT-10), (10) emit `data/eval.jsonl`, (11) verify no overlap between training doc IDs and eval doc IDs (DAT-09). Returns pipeline stats."
    - "`/api/data-gen` route uses `runtime='nodejs'`, streams progress via `createUIMessageStream`, emits `data-agent-status` per worker phase and `data-task-notification` on completion. Reports per-stage stats: generated N -> judged M -> deduped K -> stratified -> emitted."
    - "Hash-verified no-overlap (DAT-09): after emitting both JSONL files, the pipeline reads back `data/split.manifest.json`, collects all `sourceChunks` from training examples, and asserts NONE of them appear in the eval chunk list. Throws if overlap detected."
  artifacts:
    - path: "lib/data/judge.ts"
      provides: "GPT-5 + Gemini 2.5 Pro judge-jury with 4-dim Likert scoring"
      exports: ["judgeExample", "judgeJury", "JUDGE_SCHEMA"]
    - path: "lib/data/eval-gen.ts"
      provides: "GPT-5 cross-family eval set generator (70 items on 30% doc split)"
      exports: ["generateEvalSet"]
    - path: "lib/data/emit-jsonl.ts"
      provides: "JSONL emission in mlx-lm tools format + eval JSONL"
      exports: ["emitTrainingJsonl", "emitEvalJsonl", "verifyNoOverlap"]
    - path: "lib/data/pipeline.ts"
      provides: "Full Phase 4 pipeline orchestrator"
      exports: ["runDataGenPipeline"]
    - path: "app/api/data-gen/route.ts"
      provides: "POST endpoint streaming Phase 4 pipeline progress"
      exports: ["POST"]
    - path: "data/training.jsonl"
      provides: "THE deliverable: >=1200 judge-gated deduped stratified training examples in mlx-lm tools format"
    - path: "data/eval.jsonl"
      provides: "70 held-out eval items (40/10/15/5 composition)"
  key_links:
    - from: "lib/data/pipeline.ts"
      to: "lib/data/qa-worker.ts (generateQABatch)"
      via: "parallel fan-out alongside traj worker"
      pattern: "generateQABatch"
    - from: "lib/data/pipeline.ts"
      to: "lib/data/traj-worker.ts (generateTrajBatch)"
      via: "parallel fan-out alongside qa worker"
      pattern: "generateTrajBatch"
    - from: "lib/data/pipeline.ts"
      to: "lib/data/judge.ts (judgeJury)"
      via: "quality gate — rejects examples below 4 on any Likert dim"
      pattern: "judgeJury"
    - from: "lib/data/pipeline.ts"
      to: "lib/data/dedupe.ts (dedupeByMinHash, dedupeByEmbedding)"
      via: "two-stage dedup: MinHash 0.7 then cosine 0.92"
      pattern: "dedupeByMinHash|dedupeByEmbedding"
    - from: "lib/data/pipeline.ts"
      to: "lib/data/stratify.ts (checkStratification)"
      via: "enforces >=30 examples per tool name"
      pattern: "checkStratification"
    - from: "lib/data/emit-jsonl.ts"
      to: "data/training.jsonl"
      via: "writeFile one JSON object per line"
      pattern: "training\\.jsonl"
    - from: "lib/data/emit-jsonl.ts"
      to: "data/split.manifest.json"
      via: "hash-verified no-overlap check (DAT-09)"
      pattern: "split\\.manifest"
    - from: "app/api/data-gen/route.ts"
      to: "lib/data/pipeline.ts (runDataGenPipeline)"
      via: "createUIMessageStream + progress callbacks"
      pattern: "runDataGenPipeline"
---

<objective>
Wire the complete Phase 4 pipeline: judge-jury quality gate, dedup, stratification enforcement, JSONL emission in mlx-lm `tools` format (DAT-08 kill-point), eval-gen via GPT-5 cross-family, and the `/api/data-gen` route that orchestrates everything. This is Phase 4's terminal plan — it consumes all Wave 1+2 outputs and produces the two JSONL files Phase 5 reads.

Purpose: This plan closes the loop: generated examples -> judged -> deduped -> stratified -> emitted as `data/training.jsonl` + `data/eval.jsonl`. Without it, Phase 5 has no training data.
Output: `data/training.jsonl` (>=1,200 examples), `data/eval.jsonl` (70 items), `/api/data-gen` endpoint.
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
@lib/discovery/corpus.ts
@data/adapter-tools.json
@lib/data/types.ts (Plan 01)
@lib/data/split.ts (Plan 01)
@lib/data/personas.ts (Plan 01)
@lib/data/schema-gate.ts (Plan 02)
@lib/data/dedupe.ts (Plan 02)
@lib/data/stratify.ts (Plan 02)
@lib/data/qa-worker.ts (Plan 03)
@lib/data/traj-worker.ts (Plan 04)
@lib/coordinator/taskNotification.ts
@app/api/discover/route.ts (reference for SSE route pattern)

<interfaces>
All Plan 01-04 outputs (see their respective interfaces sections).

Judge contracts (PRD §7.2 #3, #4, §11.4):
- GPT-5 judges EVERY example on 4 dimensions: faithfulness (1-5), toolCorrectness (1-5), naturalness (1-5), grounding (1-5). Min 4 on ALL dimensions to pass.
- Gemini 2.5 Pro judges a 20% random sample. Jury score = GPT-5 primary (Gemini is cross-check). If GPT-5 and Gemini disagree by > 1 point on any dimension, log the disagreement.
- Anti-leakage: judge (GPT-5 + Gemini) != generator (Opus 4.7). CORRECT per PRD §7.2 #4.
- Temperature 0 for all judge calls.

Eval-Gen contracts (PRD §11.3, §11.4):
- Generator: GPT-5 (NOT Opus 4.7 — cross-family for anti-leakage).
- Composition: 40 factual + 10 reasoning + 15 single-turn tool + 5 multi-turn tool = 70 items.
- Uses ONLY eval chunks from the 30% split (DAT-09 hash-verified).
- Tool-call eval items include `expectedToolCalls` for BFCL-AST matching in Phase 7.

mlx-lm `tools` JSONL format (PRD §7.3, DAT-08 kill-point):
```json
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"...","tool_calls":[{"id":"call_0","type":"function","function":{"name":"supabase_rls_policy_template","arguments":"{\"tableName\":\"profiles\",\"role\":\"authenticated\",\"operation\":\"select\"}"}}]},{"role":"tool","content":"{\"policy\":\"...\"}","tool_call_id":"call_0","name":"supabase_rls_policy_template"},{"role":"assistant","content":"Here is your RLS policy..."}],"tools":[{"type":"function","function":{"name":"supabase_rls_policy_template","description":"...","parameters":{...}}}]}
```
One JSON object per line. The `tools` array uses the OpenAI function-calling schema shape (NOT the `DynamicToolSpec` with `meta` — strip `meta` before emission).

Embedding for cosine dedup (DAT-06):
- Use AI SDK `embedMany` with OpenAI `text-embedding-3-small`.
- `import { embedMany } from 'ai'; import { openai } from '@ai-sdk/openai';`
- `const { embeddings } = await embedMany({ model: openai.embedding('text-embedding-3-small'), values: texts });`
- Batch embeddings (up to 2048 per call). Apply after MinHash pass (MinHash is fast/free, cosine is API-call-heavy).

Route pattern (from app/api/discover/route.ts):
- `export const runtime = 'nodejs';`
- `export const dynamic = 'force-dynamic';`
- `createUIMessageStream` + `createUIMessageStreamResponse` from `'ai'`.
- `buildStatusPart`, `buildNotificationPart` from `'@/lib/coordinator/taskNotification'`.
- Sentry wraps entire pipeline.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: judge.ts + eval-gen.ts + emit-jsonl.ts</name>
  <files>
    lib/data/judge.ts, lib/data/eval-gen.ts, lib/data/emit-jsonl.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §7.2 #3-4 (judge-jury), §11.3-11.4 (eval design + anti-leakage), §7.3 (mlx-lm tools format)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/types.ts (JudgeScore, EvalItem, TrainingExample, ChatMessage, ToolCall)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/split.ts (loadSplitManifest, SPLIT_MANIFEST_PATH)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/dedupe.ts (dedupeByMinHash, dedupeByEmbedding)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/stratify.ts (checkStratification)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/types.ts (DynamicToolSpec — strip meta for JSONL)
  </read_first>
  <action>
    1. **`lib/data/judge.ts`:**
       ```ts
       import { generateObject } from 'ai';
       import { openai } from '@ai-sdk/openai';
       import { google } from '@ai-sdk/google';
       import * as Sentry from '@sentry/nextjs';
       import pLimit from 'p-limit';
       import { z } from 'zod';
       import type { TrainingExample, JudgeScore } from './types.js';
       import { makeRng } from './personas.js';

       export const JUDGE_SCHEMA = z.object({
         faithfulness: z.number().int().min(1).max(5),
         toolCorrectness: z.number().int().min(1).max(5),
         naturalness: z.number().int().min(1).max(5),
         grounding: z.number().int().min(1).max(5),
       });

       function formatExampleForJudge(ex: TrainingExample): string {
         return ex.messages.map(m => {
           let line = `[${m.role}]: ${m.content}`;
           if (m.tool_calls) line += `\n  tool_calls: ${JSON.stringify(m.tool_calls)}`;
           return line;
         }).join('\n');
       }

       const JUDGE_SYSTEM = `You are evaluating training data quality for a specialist LLM. Rate the following conversation on four dimensions (1=terrible, 5=excellent):
       - faithfulness: Are all claims factually correct and grounded in documentation?
       - toolCorrectness: Are tool calls invoked with correct names and valid arguments? (5 if no tool calls and none needed)
       - naturalness: Does the conversation flow naturally? Would a real user ask this?
       - grounding: Is the answer supported by the provided context, not hallucinated?
       Rate each dimension as an integer 1-5. Be strict — only rate 4 or 5 if the example is genuinely good.`;

       export async function judgeExample(
         example: TrainingExample,
         judgeModel: 'gpt-5' | 'gemini-2.5-pro',
       ): Promise<JudgeScore> {
         const model = judgeModel === 'gpt-5'
           ? openai('gpt-5')
           : google('gemini-2.5-pro');
         const formatted = formatExampleForJudge(example);

         const { object } = await Sentry.startSpan(
           { op: 'ai.agent', name: `judge.${judgeModel}` },
           () => generateObject({
             model,
             schema: JUDGE_SCHEMA,
             system: JUDGE_SYSTEM,
             prompt: formatted,
             temperature: 0,
             experimental_telemetry: { isEnabled: true, functionId: `judge.${judgeModel}` },
           }),
         );

         return { ...object, judge: judgeModel } as JudgeScore;
       }

       export interface JuryResult {
         scores: Map<number, JudgeScore[]>;  // index -> scores array
         disagreements: Array<{
           exampleIndex: number;
           dimension: string;
           gpt5Score: number;
           geminiScore: number;
         }>;
         accepted: TrainingExample[];
         rejected: TrainingExample[];
       }

       export async function judgeJury(
         examples: TrainingExample[],
         opts: { concurrency?: number; geminiSampleRate?: number; seed?: string } = {},
       ): Promise<JuryResult> {
         const { concurrency = 15, geminiSampleRate = 0.2, seed = 'jury-v1' } = opts;
         const limit = pLimit(concurrency);
         const rng = makeRng(seed);
         const scores = new Map<number, JudgeScore[]>();
         const disagreements: JuryResult['disagreements'] = [];

         // GPT-5 judges ALL examples
         const gpt5Scores = await Promise.all(
           examples.map((ex, i) => limit(async () => {
             const score = await judgeExample(ex, 'gpt-5');
             scores.set(i, [score]);
             return { index: i, score };
           })),
         );

         // Gemini judges 20% sample
         const geminiIndices = examples
           .map((_, i) => i)
           .filter(() => rng() < geminiSampleRate);

         if (geminiIndices.length > 0) {
           await Promise.all(
             geminiIndices.map((i) => limit(async () => {
               const geminiScore = await judgeExample(examples[i], 'gemini-2.5-pro');
               scores.get(i)!.push(geminiScore);
               // Check for disagreements
               const gpt5Score = gpt5Scores.find(s => s.index === i)!.score;
               for (const dim of ['faithfulness', 'toolCorrectness', 'naturalness', 'grounding'] as const) {
                 const diff = Math.abs(gpt5Score[dim] - geminiScore[dim]);
                 if (diff > 1) {
                   disagreements.push({
                     exampleIndex: i,
                     dimension: dim,
                     gpt5Score: gpt5Score[dim],
                     geminiScore: geminiScore[dim],
                   });
                 }
               }
             })),
           );
         }

         // Accept/reject based on GPT-5 scores (primary judge)
         const accepted: TrainingExample[] = [];
         const rejected: TrainingExample[] = [];
         for (const { index, score } of gpt5Scores) {
           const pass = score.faithfulness >= 4
             && score.toolCorrectness >= 4
             && score.naturalness >= 4
             && score.grounding >= 4;
           if (pass) {
             accepted.push(examples[index]);
           } else {
             rejected.push(examples[index]);
           }
         }

         return { scores, disagreements, accepted, rejected };
       }
       ```

    2. **`lib/data/eval-gen.ts`:**
       ```ts
       import { generateObject } from 'ai';
       import { openai } from '@ai-sdk/openai';
       import * as Sentry from '@sentry/nextjs';
       import pLimit from 'p-limit';
       import { z } from 'zod';
       import { createHash } from 'node:crypto';
       import type { Chunk, DynamicToolSpec } from '../discovery/types.js';
       import type { EvalItem, ToolCall } from './types.js';

       const EVAL_QA_SCHEMA = z.object({
         prompt: z.string().min(10),
         expected: z.string().min(10),
       });

       const EVAL_TOOL_SCHEMA = z.object({
         prompt: z.string().min(10),
         expectedToolCalls: z.array(z.object({
           name: z.string(),
           arguments: z.record(z.string(), z.any()),
         })).min(1),
         expectedAnswer: z.string().optional(),
       });

       export interface EvalGenOptions {
         evalChunks: Chunk[];
         tools: DynamicToolSpec[];
         counts?: { factual?: number; reasoning?: number; singleTurnTool?: number; multiTurnTool?: number };
         concurrency?: number;
       }

       export async function generateEvalSet(opts: EvalGenOptions): Promise<EvalItem[]> {
         const {
           evalChunks, tools, concurrency = 15,
           counts = { factual: 40, reasoning: 10, singleTurnTool: 15, multiTurnTool: 5 },
         } = opts;
         const limit = pLimit(concurrency);
         const model = openai('gpt-5'); // Cross-family from Opus training data (DAT-10)
         const items: EvalItem[] = [];

         const generateQAItem = async (
           kind: 'factual' | 'reasoning',
           chunks: Chunk[],
           idx: number,
         ): Promise<EvalItem> => {
           const { object } = await Sentry.startSpan(
             { op: 'ai.agent', name: `eval-gen.${kind}` },
             () => generateObject({
               model,
               schema: EVAL_QA_SCHEMA,
               system: kind === 'factual'
                 ? 'Generate a factual question answerable from the documentation below. Include the expected answer.'
                 : 'Generate a multi-hop reasoning question requiring synthesis across the documentation below. Include the expected answer.',
               prompt: chunks.map(c => c.text).join('\n---\n'),
               temperature: 0.5,
               experimental_telemetry: { isEnabled: true, functionId: `eval-gen.${kind}` },
             }),
           );
           return {
             id: `eval-${kind}-${idx}`,
             kind,
             prompt: object.prompt,
             expected: object.expected,
             sourceChunks: chunks.map(c => c.id),
           };
         };

         const generateToolItem = async (
           kind: 'single-turn-tool' | 'multi-turn-tool',
           chunks: Chunk[],
           selectedTools: DynamicToolSpec[],
           idx: number,
         ): Promise<EvalItem> => {
           const toolDescs = selectedTools
             .map(t => `- ${t.function.name}: ${t.function.description} (params: ${JSON.stringify(t.function.parameters)})`)
             .join('\n');
           const { object } = await Sentry.startSpan(
             { op: 'ai.agent', name: `eval-gen.${kind}` },
             () => generateObject({
               model,
               schema: EVAL_TOOL_SCHEMA,
               system: kind === 'single-turn-tool'
                 ? `Generate a user query that requires calling exactly one of these tools with correct arguments:\n${toolDescs}\nInclude the expected tool call.`
                 : `Generate a multi-turn user scenario (2-4 turns) that requires calling 2+ of these tools:\n${toolDescs}\nInclude all expected tool calls in order.`,
               prompt: chunks.map(c => c.text).join('\n---\n'),
               temperature: 0.5,
               experimental_telemetry: { isEnabled: true, functionId: `eval-gen.${kind}` },
             }),
           );
           const expectedToolCalls: ToolCall[] = object.expectedToolCalls.map((tc, i) => ({
             id: `eval_call_${idx}_${i}`,
             type: 'function' as const,
             function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
           }));
           return {
             id: `eval-${kind}-${idx}`,
             kind,
             prompt: object.prompt,
             expected: object.expectedAnswer,
             expectedToolCalls,
             sourceChunks: chunks.map(c => c.id),
           };
         };

         // Generate all items with p-limit concurrency
         const tasks: Promise<void>[] = [];
         let idx = 0;

         // Factual Q&A
         for (let i = 0; i < (counts.factual ?? 40); i++) {
           const chunkIdx = i % evalChunks.length;
           const chunks = [evalChunks[chunkIdx]];
           const currentIdx = idx++;
           tasks.push(limit(async () => {
             items.push(await generateQAItem('factual', chunks, currentIdx));
           }));
         }

         // Reasoning Q&A
         for (let i = 0; i < (counts.reasoning ?? 10); i++) {
           const startIdx = (i * 3) % evalChunks.length;
           const chunks = [
             evalChunks[startIdx % evalChunks.length],
             evalChunks[(startIdx + 1) % evalChunks.length],
             evalChunks[(startIdx + 2) % evalChunks.length],
           ];
           const currentIdx = idx++;
           tasks.push(limit(async () => {
             items.push(await generateQAItem('reasoning', chunks, currentIdx));
           }));
         }

         // Single-turn tool
         for (let i = 0; i < (counts.singleTurnTool ?? 15); i++) {
           const chunkIdx = i % evalChunks.length;
           const toolIdx = i % tools.length;
           const currentIdx = idx++;
           tasks.push(limit(async () => {
             items.push(await generateToolItem(
               'single-turn-tool',
               [evalChunks[chunkIdx]],
               [tools[toolIdx]],
               currentIdx,
             ));
           }));
         }

         // Multi-turn tool
         for (let i = 0; i < (counts.multiTurnTool ?? 5); i++) {
           const chunkIdx = i % evalChunks.length;
           const tool1 = tools[i % tools.length];
           const tool2 = tools[(i + 1) % tools.length];
           const currentIdx = idx++;
           tasks.push(limit(async () => {
             items.push(await generateToolItem(
               'multi-turn-tool',
               [evalChunks[chunkIdx], evalChunks[(chunkIdx + 1) % evalChunks.length]],
               [tool1, tool2],
               currentIdx,
             ));
           }));
         }

         await Promise.all(tasks);
         return items;
       }
       ```

    3. **`lib/data/emit-jsonl.ts`:**
       ```ts
       import { writeFile, readFile } from 'node:fs/promises';
       import path from 'node:path';
       import type { TrainingExample, EvalItem } from './types.js';
       import type { DynamicToolSpec } from '../discovery/types.js';

       export const TRAINING_JSONL_PATH = path.resolve('data/training.jsonl');
       export const EVAL_JSONL_PATH = path.resolve('data/eval.jsonl');

       /**
        * Strip `meta` from DynamicToolSpec to produce the OpenAI function-calling
        * schema shape that mlx-lm expects in the `tools` field.
        */
       function stripMeta(tools: DynamicToolSpec[]): Array<{
         type: 'function';
         function: { name: string; description: string; parameters: Record<string, unknown> };
       }> {
         return tools.map(t => ({
           type: 'function',
           function: {
             name: t.function.name,
             description: t.function.description,
             parameters: t.function.parameters,
           },
         }));
       }

       /** Emit training.jsonl in mlx-lm `tools` format — DAT-08 kill-point. */
       export async function emitTrainingJsonl(
         examples: TrainingExample[],
         outPath = TRAINING_JSONL_PATH,
       ): Promise<void> {
         const lines = examples.map(ex => {
           // Strip meta from tools for mlx-lm compatibility
           const cleanTools = stripMeta(ex.tools);
           // Strip undefined fields from messages for clean JSON
           const cleanMessages = ex.messages.map(m => {
             const msg: Record<string, unknown> = { role: m.role, content: m.content };
             if (m.tool_calls && m.tool_calls.length > 0) msg.tool_calls = m.tool_calls;
             if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
             if (m.name) msg.name = m.name;
             return msg;
           });
           return JSON.stringify({ messages: cleanMessages, tools: cleanTools });
         });
         await writeFile(outPath, lines.join('\n') + '\n', 'utf8');
       }

       /** Emit eval.jsonl — one EvalItem per line. */
       export async function emitEvalJsonl(
         items: EvalItem[],
         outPath = EVAL_JSONL_PATH,
       ): Promise<void> {
         const lines = items.map(item => JSON.stringify(item));
         await writeFile(outPath, lines.join('\n') + '\n', 'utf8');
       }

       /**
        * DAT-09: verify no training example references an eval-split chunk.
        * Reads split.manifest.json, collects all sourceChunks from training meta,
        * asserts none appear in the eval set.
        */
       export async function verifyNoOverlap(
         trainingSourceChunks: string[][],
         evalChunkIds: string[],
       ): Promise<{ overlap: string[]; pass: boolean }> {
         const evalSet = new Set(evalChunkIds);
         const overlap: string[] = [];
         for (const chunks of trainingSourceChunks) {
           for (const id of chunks) {
             if (evalSet.has(id)) overlap.push(id);
           }
         }
         return { overlap: [...new Set(overlap)], pass: overlap.length === 0 };
       }
       ```
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && grep -E "export async function judgeJury" lib/data/judge.ts && grep -E "export async function generateEvalSet" lib/data/eval-gen.ts && grep -E "export async function emitTrainingJsonl" lib/data/emit-jsonl.ts && grep -E "export async function verifyNoOverlap" lib/data/emit-jsonl.ts && grep -E "stripMeta" lib/data/emit-jsonl.ts</automated>
  </verify>
  <done>Judge-jury, eval-gen, and JSONL emission modules compile. Ready for pipeline wiring.</done>
</task>

<task type="auto">
  <name>Task 2: pipeline.ts + /api/data-gen route + tests</name>
  <files>
    lib/data/pipeline.ts, app/api/data-gen/route.ts, lib/data/judge.test.ts, lib/data/emit-jsonl.test.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/app/api/discover/route.ts (reference for SSE route pattern with buildStatusPart/buildNotificationPart)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/coordinator/taskNotification.ts (buildStatusPart, buildNotificationPart)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/judge.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/eval-gen.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/emit-jsonl.ts (Task 1 output)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/qa-worker.ts (Plan 03)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/traj-worker.ts (Plan 04)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/split.ts (Plan 01)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/dedupe.ts (Plan 02)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/data/stratify.ts (Plan 02)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/lib/discovery/corpus.ts (fetchCorpus)
  </read_first>
  <action>
    1. **`lib/data/pipeline.ts`:**
       ```ts
       import * as Sentry from '@sentry/nextjs';
       import { embedMany } from 'ai';
       import { openai } from '@ai-sdk/openai';
       import { readFileSync } from 'node:fs';
       import path from 'node:path';
       import type { DynamicToolSpec } from '../discovery/types.js';
       import type { TrainingExample, DataGenMeta, EvalItem } from './types.js';
       import { fetchCorpus } from '../discovery/corpus.js';
       import { splitDocs } from './split.js';
       import { generateQABatch } from './qa-worker.js';
       import { generateTrajBatch } from './traj-worker.js';
       import { judgeJury } from './judge.js';
       import { dedupeByMinHash, dedupeByEmbedding } from './dedupe.js';
       import { checkStratification } from './stratify.js';
       import { generateEvalSet } from './eval-gen.js';
       import { emitTrainingJsonl, emitEvalJsonl, verifyNoOverlap } from './emit-jsonl.js';

       export interface PipelineEvent {
         stage: string;
         status: 'start' | 'ok' | 'err';
         detail?: string;
       }

       export interface PipelineOptions {
         onEvent?: (ev: PipelineEvent) => void;
         qaCounts?: number;
         trajCounts?: { singleTurn?: number; multiTurn?: number; parallelDep?: number; refusal?: number };
         concurrency?: number;
       }

       export interface PipelineResult {
         generated: number;
         judged: { accepted: number; rejected: number; disagreements: number };
         deduped: { afterMinHash: number; afterCosine: number };
         stratification: { pass: boolean; deficit: Record<string, number> };
         training: { count: number; path: string };
         eval: { count: number; path: string };
         overlapCheck: { pass: boolean; overlap: string[] };
       }

       export async function runDataGenPipeline(
         opts: PipelineOptions = {},
       ): Promise<PipelineResult> {
         const { onEvent, concurrency = 15 } = opts;
         const emit = (stage: string, status: PipelineEvent['status'], detail?: string) =>
           onEvent?.({ stage, status, detail });

         // 1. Load corpus + split
         emit('corpus', 'start');
         const corpus = await fetchCorpus();
         const { trainChunks, evalChunks } = splitDocs(corpus, { persist: true });
         emit('corpus', 'ok', `train=${trainChunks.length} eval=${evalChunks.length}`);

         // 2. Load tools
         const manifest = JSON.parse(readFileSync(path.resolve('data/adapter-tools.json'), 'utf8'));
         const tools: DynamicToolSpec[] = manifest.tools;
         const toolNames = tools.map(t => t.function.name);

         // 3. Fan out QA + Traj workers in PARALLEL
         emit('generation', 'start');
         const [qaResult, trajResult] = await Promise.all([
           Sentry.startSpan({ op: 'ai.agent', name: 'data-gen-qa-batch' }, () =>
             generateQABatch({
               trainChunks, tools,
               count: opts.qaCounts ?? 500,
               concurrency,
               onProgress: (done, total) => emit('qa-gen', 'start', `${done}/${total}`),
             }),
           ),
           Sentry.startSpan({ op: 'ai.agent', name: 'data-gen-traj-batch' }, () =>
             generateTrajBatch({
               trainChunks, tools,
               counts: opts.trajCounts,
               concurrency,
               onProgress: (done, total, type) => emit(`traj-gen-${type}`, 'start', `${done}/${total}`),
             }),
           ),
         ]);
         const allExamples = [...qaResult.examples, ...trajResult.examples];
         const allMeta = [...qaResult.meta, ...trajResult.meta];
         emit('generation', 'ok', `total=${allExamples.length} (qa=${qaResult.examples.length}, traj=${trajResult.examples.length}, rejected=${qaResult.rejected + trajResult.rejected})`);

         // 4. Judge-jury filter
         emit('judging', 'start');
         const juryResult = await Sentry.startSpan(
           { op: 'ai.agent', name: 'judge-jury' },
           () => judgeJury(allExamples, { concurrency }),
         );
         emit('judging', 'ok', `accepted=${juryResult.accepted.length} rejected=${juryResult.rejected.length} disagreements=${juryResult.disagreements.length}`);

         // 5. MinHash dedup (DAT-06 — threshold 0.7)
         emit('dedup-minhash', 'start');
         const textForDedup = juryResult.accepted.map((ex, i) => ({
           id: String(i),
           text: ex.messages.map(m => m.content).join(' '),
         }));
         const minHashKeepIds = dedupeByMinHash(textForDedup, 0.7);
         const afterMinHash = juryResult.accepted.filter((_, i) => minHashKeepIds.includes(String(i)));
         emit('dedup-minhash', 'ok', `kept=${afterMinHash.length}/${juryResult.accepted.length}`);

         // 6. Cosine dedup (DAT-06 — threshold 0.92)
         emit('dedup-cosine', 'start');
         const textsToEmbed = afterMinHash.map((ex, i) => ({
           id: String(i),
           text: ex.messages.map(m => m.content).join(' ').slice(0, 8000), // truncate for embedding
         }));
         // Batch embeddings (max 2048 per call)
         const batchSize = 2048;
         const allEmbeddings: number[][] = [];
         for (let i = 0; i < textsToEmbed.length; i += batchSize) {
           const batch = textsToEmbed.slice(i, i + batchSize);
           const { embeddings } = await embedMany({
             model: openai.embedding('text-embedding-3-small'),
             values: batch.map(t => t.text),
           });
           allEmbeddings.push(...embeddings);
         }
         const embeddingItems = textsToEmbed.map((t, i) => ({ id: t.id, embedding: allEmbeddings[i] }));
         const cosineKeepIds = dedupeByEmbedding(embeddingItems, 0.92);
         const afterCosine = afterMinHash.filter((_, i) => cosineKeepIds.includes(String(i)));
         emit('dedup-cosine', 'ok', `kept=${afterCosine.length}/${afterMinHash.length}`);

         // 7. Stratification check (DAT-07 — >=30 per tool)
         emit('stratification', 'start');
         const stratResult = checkStratification(afterCosine, toolNames, 30);
         emit('stratification', stratResult.pass ? 'ok' : 'err',
           stratResult.pass ? 'all tools >= 30 examples' : `deficit: ${JSON.stringify(stratResult.deficit)}`);

         // 8. Emit training.jsonl (DAT-08 kill-point)
         emit('emit-training', 'start');
         await emitTrainingJsonl(afterCosine);
         emit('emit-training', 'ok', `${afterCosine.length} examples`);

         // 9. Generate eval set (DAT-10)
         emit('eval-gen', 'start');
         const evalItems = await Sentry.startSpan(
           { op: 'ai.agent', name: 'eval-gen' },
           () => generateEvalSet({ evalChunks, tools, concurrency }),
         );
         emit('eval-gen', 'ok', `${evalItems.length} items`);

         // 10. Emit eval.jsonl
         emit('emit-eval', 'start');
         await emitEvalJsonl(evalItems);
         emit('emit-eval', 'ok', `${evalItems.length} items`);

         // 11. Hash-verified no-overlap (DAT-09)
         emit('overlap-check', 'start');
         const trainingSourceChunks = allMeta
           .filter((_, i) => {
             const idx = String(i);
             return minHashKeepIds.includes(idx) && cosineKeepIds.includes(idx);
           })
           .map(m => m.sourceChunks);
         const evalChunkIds = evalChunks.map(c => c.id);
         const overlapResult = await verifyNoOverlap(trainingSourceChunks, evalChunkIds);
         if (!overlapResult.pass) {
           emit('overlap-check', 'err', `OVERLAP DETECTED: ${overlapResult.overlap.join(', ')}`);
         } else {
           emit('overlap-check', 'ok', 'no overlap');
         }

         return {
           generated: allExamples.length,
           judged: {
             accepted: juryResult.accepted.length,
             rejected: juryResult.rejected.length,
             disagreements: juryResult.disagreements.length,
           },
           deduped: { afterMinHash: afterMinHash.length, afterCosine: afterCosine.length },
           stratification: { pass: stratResult.pass, deficit: stratResult.deficit },
           training: { count: afterCosine.length, path: 'data/training.jsonl' },
           eval: { count: evalItems.length, path: 'data/eval.jsonl' },
           overlapCheck: overlapResult,
         };
       }
       ```

    2. **`app/api/data-gen/route.ts`:**
       ```ts
       import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
       import * as Sentry from '@sentry/nextjs';
       import { runDataGenPipeline } from '@/lib/data/pipeline';
       import { buildStatusPart, buildNotificationPart } from '@/lib/coordinator/taskNotification';

       export const runtime = 'nodejs';
       export const dynamic = 'force-dynamic';

       export async function POST(_req: Request) {
         const stream = createUIMessageStream({
           execute: async ({ writer }) => {
             await Sentry.startSpan(
               { op: 'ai.agent', name: 'data-gen.pipeline' },
               async () => {
                 try {
                   const result = await runDataGenPipeline({
                     onEvent: (ev) => {
                       writer.write(
                         buildStatusPart(`data-gen:${ev.stage}`, {
                           role: 'data-gen',
                           status: ev.status === 'start' ? 'running' : ev.status,
                           step: `${ev.stage}: ${ev.detail ?? ''}`,
                         }),
                       );
                     },
                   });
                   writer.write(
                     buildNotificationPart('data-gen', {
                       taskId: 'data-gen',
                       status: 'ok',
                       summary: `Pipeline complete: ${result.training.count} training + ${result.eval.count} eval`,
                       result: JSON.stringify(result),
                     }),
                   );
                 } catch (err) {
                   const msg = (err as Error).message ?? String(err);
                   writer.write(
                     buildNotificationPart('data-gen', {
                       taskId: 'data-gen',
                       status: 'err',
                       summary: msg.slice(0, 400),
                     }),
                   );
                 }
               },
             );
           },
           onError: (error) => {
             const msg = error instanceof Error ? error.message : String(error);
             return msg.slice(0, 400);
           },
         });
         return createUIMessageStreamResponse({ stream });
       }
       ```

    3. **`lib/data/judge.test.ts`:**
       - Mock `generateObject` to return valid Likert scores.
       - Test: `judgeExample` returns `JudgeScore` with all fields.
       - Test: `judgeJury` with 5 mock examples accepts those scoring >=4, rejects those <4.
       - Test: disagreement detection when GPT-5 = 5 and Gemini = 3.

    4. **`lib/data/emit-jsonl.test.ts`:**
       - Test: `emitTrainingJsonl` writes one JSON object per line.
       - Test: each line parses as `{ messages: [...], tools: [...] }`.
       - Test: `tools` array does NOT contain `meta` field (stripped).
       - Test: `verifyNoOverlap` returns `pass: true` for disjoint sets, `pass: false` for overlapping.
       - Test: `emitEvalJsonl` writes 70 items (given 70 EvalItem inputs).

    5. After running tests, execute a REAL end-to-end pipeline via the route to populate `data/training.jsonl` and `data/eval.jsonl`:
       - If provider keys are available: `curl -X POST http://localhost:3000/api/data-gen` and let it run.
       - If keys are NOT available in execution environment: note in SUMMARY that the route is wired and tested with mocks; actual generation will happen during demo.
       - Commit `data/training.jsonl` and `data/eval.jsonl` if populated.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && npx vitest run lib/data/judge.test.ts lib/data/emit-jsonl.test.ts 2>&1 | tail -30 && grep -E "export const runtime = 'nodejs'" app/api/data-gen/route.ts && grep -E "export async function runDataGenPipeline" lib/data/pipeline.ts && grep -E "createUIMessageStream" app/api/data-gen/route.ts && grep -E "buildStatusPart|buildNotificationPart" app/api/data-gen/route.ts</automated>
  </verify>
  <done>Full Phase 4 pipeline wired end-to-end: generate -> judge -> dedup -> stratify -> emit. DAT-04 through DAT-10 implemented. `/api/data-gen` route streams progress. `data/training.jsonl` and `data/eval.jsonl` are the Phase 5 input.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Opus 4.7 QA/Traj output -> judge-jury | UNTRUSTED training data quality-gated by GPT-5 + Gemini. |
| GPT-5 eval output -> eval JSONL | GPT-5 generates eval items; cross-family from Opus training data. |
| Training JSONL -> Phase 5 mlx-lm | Trusted after pipeline; must be exact mlx-lm tools format. |
| `/api/data-gen` -> pipeline | Local-only trigger endpoint; no user input to models. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-12 | Tampering | Judge gives inflated scores (preference leakage) | mitigate | Cross-family: GPT-5 judges Opus output; Gemini cross-checks 20% (PRD §7.2 #4). |
| T-04-13 | Info Disclosure | eval.jsonl items leak into training via overlapping docs | mitigate | `verifyNoOverlap` checks all training sourceChunks against eval chunk IDs; pipeline throws on overlap (DAT-09). |
| T-04-14 | DoS | Embedding API calls for cosine dedup are expensive | accept | Applied AFTER MinHash (cheap) removes bulk duplicates; remaining set is smaller. Batched at 2048. |
| T-04-15 | Repudiation | Training JSONL format wrong for mlx-lm | mitigate | `stripMeta` removes `meta` field; emit-jsonl.test.ts verifies each line parses as `{messages, tools}`. |
| T-04-16 | DoS | SSE stream leaks raw LLM errors | mitigate | Route truncates errors to 400 chars (same pattern as discover route). |
</threat_model>

<verification>
- `npx tsc --noEmit` green.
- `npx vitest run lib/data/judge.test.ts lib/data/emit-jsonl.test.ts` all pass.
- `app/api/data-gen/route.ts` has `runtime='nodejs'` + `dynamic='force-dynamic'`.
- Pipeline stages: corpus -> split -> QA + Traj (parallel) -> judge -> MinHash dedup -> cosine dedup -> stratify -> emit training.jsonl -> eval-gen -> emit eval.jsonl -> overlap check.
- `data/training.jsonl` lines parse as `{ messages: ChatMessage[], tools: [...] }` with NO `meta` field.
- `data/eval.jsonl` has 70 items (40/10/15/5 composition).
- No training sourceChunk appears in eval chunk set.
</verification>

<success_criteria>
DAT-04 (GPT-5 4-dim judge gate), DAT-05 (Gemini 20% cross-check + disagreement log), DAT-06 (MinHash 0.7 + cosine 0.92 dedup), DAT-07 (>=30 per tool stratification), DAT-08 (training.jsonl in mlx-lm tools format — KILL POINT), DAT-09 (hash-verified 70/30 split no-overlap), DAT-10 (70-item eval.jsonl via GPT-5 cross-family). Phase 5 has everything it needs.
</success_criteria>

<output>
Create `.planning/phases/04-data-eval-gen/04-05-SUMMARY.md` noting:
- Final training example count (target >=1200).
- Judge acceptance/rejection rate.
- Disagreement count + most common dimension.
- Dedup removal rates (MinHash pass, cosine pass).
- Stratification pass/fail + any deficit.
- Eval set composition (40/10/15/5).
- Overlap check result.
- Wall-clock time for full pipeline.
</output>
