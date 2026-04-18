---
phase: 05-train-model-a
plan: 03
type: execute
wave: 2
depends_on: [05-01]
files_modified:
  - lib/training/supervisor.ts
  - lib/training/supervisor.test.ts
  - lib/training/rollback.ts
  - lib/training/rollback.test.ts
  - lib/training/transformGrpoJsonl.ts
  - lib/training/transformGrpoJsonl.test.ts
  - scripts/build-grpo-jsonl.ts
autonomous: true
requirements: [TRN-02, TRN-04]

must_haves:
  truths:
    - "`lib/training/supervisor.ts` exports class `TrainSupervisor` with `ingest(pt, child)` returning `'continue' | 'rollback' | 'abort'`."
    - "Supervisor triggers rollback on ≥2 consecutive NaN/Infinity loss values OR on a loss spike >10× EMA after iter 20."
    - "Supervisor aborts after MAX_ROLLBACKS=2 rollbacks — emits a `training.aborted` signal the caller lifts into frontend pill text (TRN-04 kill-point)."
    - "Supervisor detects GRPO reward collapse: reward variance <0.01 over 10 consecutive reward samples → emit `grpo.collapsed` signal → caller SIGTERMs the GRPO child and flips pill to `SFT-only — Tier 2` (TRN-02 kill-point)."
    - "Supervisor recognizes `grpo.skipped` marker lines from plan 05-02 and emits the same `grpo.collapsed` outward signal without requiring any parsed TrainPoint."
    - "`lib/training/rollback.ts` exports `rollbackToLatestCheckpoint(adapterDir)` that finds the highest-numbered `\\d{7}_adapters\\.safetensors`, copies it over `adapters.safetensors`, returns the iteration number."
    - "`lib/training/transformGrpoJsonl.ts` exports `transformSftToGrpo(lines)` converting Phase 4's `{messages, tools}` JSONL lines to `{prompt, answer}` R1-format pairs."
    - "`scripts/build-grpo-jsonl.ts` is a node/tsx CLI that reads an SFT JSONL and writes `data/training/grpo/{train,valid}.jsonl`."
    - "All 3 modules ship with vitest-or-node-test unit tests (NaN heuristic, rollback file-picker, transform round-trip)."
  artifacts:
    - path: "lib/training/supervisor.ts"
      provides: "TrainSupervisor with NaN detect, spike detect, rollback budget, reward-variance collapse detect"
      exports: ["TrainSupervisor", "SupervisorSignal", "type TrainPoint"]
      contains: "MAX_ROLLBACKS"
    - path: "lib/training/rollback.ts"
      provides: "Pure fs util that finds and copies the latest numbered adapter checkpoint"
      exports: ["rollbackToLatestCheckpoint"]
      contains: "_adapters.safetensors"
    - path: "lib/training/transformGrpoJsonl.ts"
      provides: "SFT messages+tools → GRPO prompt/answer transform"
      exports: ["transformSftToGrpo"]
    - path: "scripts/build-grpo-jsonl.ts"
      provides: "CLI wrapper that emits data/training/grpo/{train,valid}.jsonl"
  key_links:
    - from: "lib/training/supervisor.ts"
      to: "lib/training/rollback.ts"
      via: "import { rollbackToLatestCheckpoint }"
      pattern: "rollbackToLatestCheckpoint"
    - from: "scripts/build-grpo-jsonl.ts"
      to: "lib/training/transformGrpoJsonl.ts"
      via: "import { transformSftToGrpo }"
      pattern: "transformSftToGrpo"
---

<objective>
Build the Node-side training supervisor, the numbered-checkpoint rollback utility, and the tiny SFT→GRPO data transform — all the intelligence that lives outside the bash scripts. The supervisor is a pure state machine over `TrainPoint` events: it detects NaN, loss spikes, reward-variance collapse, and rollback-budget exhaustion, and emits one of four signals the caller translates into process actions + frontend pill text. Every module ships with a unit test.

Purpose: Satisfy TRN-04 (grad-clip replacement = NaN detect + rollback; SFT-only fallback on unrecoverable) and TRN-02 kill-point (GRPO reward variance collapse → skip GRPO). Also owns the Phase 4-JSONL → GRPO-JSONL transform so Path A has real data to consume.
Output: Three `lib/training/*.ts` modules with tests + one tsx CLI. No production code paths touched yet — 05-04 wires this into `/api/train`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD_SPEC.md
@CLAUDE.md
@.planning/phases/05-train-model-a/05-RESEARCH.md
@.planning/phases/05-train-model-a/05-CONTEXT.md
@.planning/phases/05-train-model-a/05-01-smoke-notes.md
@.planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md

<interfaces>
<!-- From Phase 2 02-02 (already shipped by the time wave 2 runs) -->
type TrainPoint = { iter: number; loss?: number; reward?: number };
export function parseTrainLine(line: string): TrainPoint | null;

<!-- mlx-lm checkpoint file-naming (VERIFIED mlx_lm/tuner/trainer.py:371-380) -->
- Numbered: `{iter:07d}_adapters.safetensors`  (e.g. `0000100_adapters.safetensors`)
- Latest (overwritten): `adapters.safetensors`
- Both live in the same `--adapter-path` directory.

<!-- Phase 4 training.jsonl shape (PRD §6.1, DAT-08) -->
{ "messages": [ {"role":"user","content":"..."}, {"role":"assistant","content":"... <|tool_call|>{...}<|tool_response|>{...}..."} ], "tools": [ { /* OpenAI schema */ } ] }

<!-- GRPO consumption shape (VERIFIED .venv/.../mlx_lm_lora/trainer/datasets.py:9-43) -->
{ "prompt": "<user content>", "answer": "<canonical expected output — tool name or assistant-final-text>" }

<!-- CONTEXT.md locked decisions this plan implements -->
- D: Grad-clip replacement = Node-side NaN detect + numbered-ckpt rollback (CONTEXT §"Grad Clipping").
- D: NaN recovery narration behavior (CONTEXT §"NaN Recovery").
- D: Phase 5 owns the SFT→GRPO transform util (CONTEXT §"Phase 4 Contract").
- D: MAX_ROLLBACKS=2 budget (RESEARCH §Pitfall P10 + §Pattern 3).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: rollback.ts + tests — find latest numbered checkpoint and copy it</name>
  <files>lib/training/rollback.ts, lib/training/rollback.test.ts</files>
  <read_first>
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Pattern 4: Rollback Utility" and §Pitfalls P6, P7
    - .venv/lib/python3.12/site-packages/mlx_lm/tuner/trainer.py lines 371-380 (checkpoint naming)
    - package.json (confirm vitest OR fall back to `node --test`)
  </read_first>
  <behavior>
    - Test 1: `rollbackToLatestCheckpoint(dir)` on a directory with `0000100_adapters.safetensors` + `0000200_adapters.safetensors` + `adapters.safetensors` returns `200` and copies the 200-file over `adapters.safetensors`.
    - Test 2: Numbered files out of alpha-order (e.g. `0000100`, `0000050`) still returns highest iter (`100`).
    - Test 3: Directory with ONLY `adapters.safetensors` (no numbered) throws `Error` with message containing `no numbered checkpoint`.
    - Test 4: Empty directory throws same error.
    - Test 5: Files that don't match the regex (`random.safetensors`, `foo.bin`, `0000100_config.json`) are ignored.
  </behavior>
  <action>
1. **lib/training/rollback.ts** — exact body:
```typescript
import { readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const CKPT_RE = /^(\d{7})_adapters\.safetensors$/;

/**
 * Find the highest-numbered adapter checkpoint in `adapterDir` and copy it
 * over `adapters.safetensors`. Returns the iteration number rolled back to.
 *
 * Throws if no numbered checkpoint exists (the caller must then abort
 * training — TRN-04 kill-point: ship previous-phase adapter and narrate Tier 2).
 *
 * VERIFIED against .venv/.../mlx_lm/tuner/trainer.py:371-380 file naming.
 */
export async function rollbackToLatestCheckpoint(adapterDir: string): Promise<number> {
  const entries = await readdir(adapterDir);
  const numbered = entries
    .map((n) => CKPT_RE.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (numbered.length === 0) {
    throw new Error(`no numbered checkpoint to revert to in ${adapterDir}`);
  }
  const latest = numbered[0];
  await copyFile(join(adapterDir, latest[0]), join(adapterDir, 'adapters.safetensors'));
  return Number(latest[1]);
}
```

2. **lib/training/rollback.test.ts** — create 4 temp-dir test cases using `node:fs/promises` + `node:os`'s `mkdtemp`. Each test:
   - Creates an isolated tmp dir under `os.tmpdir()`.
   - Seeds fake files (write zero bytes).
   - Calls `rollbackToLatestCheckpoint`.
   - Asserts return value AND asserts `adapters.safetensors` contents equal the expected numbered file's contents (create numbered files with distinguishable bytes so copy can be verified).
   - Cleans up with `rm -rf tmpdir`.

Use whichever runner Phase 1/2 scaffolded (prefer vitest if `package.json` contains `"vitest"`, else `node --test` + `node:assert`).
  </action>
  <verify>
    <automated>test -f lib/training/rollback.ts && grep -n "rollbackToLatestCheckpoint" lib/training/rollback.ts && grep -n "_adapters\\\\.safetensors" lib/training/rollback.ts && (pnpm vitest run lib/training/rollback.test.ts 2>&1 || node --test lib/training/rollback.test.ts 2>&1) | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `lib/training/rollback.ts` exports `rollbackToLatestCheckpoint` (async, returns number)
    - Regex `CKPT_RE` matches pattern `^(\d{7})_adapters\.safetensors$`
    - All 5 behavior tests pass (exit 0)
    - Zero usages of `execSync`/`exec` for file ops (pure `fs/promises`)
  </acceptance_criteria>
  <done>Rollback util is fully tested, never depends on mlx-lm state, reusable by 05-04.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: supervisor.ts + tests — NaN/spike/variance-collapse state machine</name>
  <files>lib/training/supervisor.ts, lib/training/supervisor.test.ts</files>
  <read_first>
    - lib/training/rollback.ts (just created — supervisor consumes this on rollback)
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Pattern 3: NaN-Detect Supervisor" and §"Assumption A6" (heuristic tuning note)
    - .planning/phases/05-train-model-a/05-CONTEXT.md §"NaN Recovery — LOCKED"
    - .planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md (TrainPoint shape — do NOT redeclare, import from `@/lib/streams/trainParser`)
  </read_first>
  <behavior>
    - Test 1: Ingesting a clean stream of 50 decreasing losses → every call returns `'continue'`.
    - Test 2: Ingesting 2 consecutive NaN losses → second call returns `'rollback'`.
    - Test 3: After 2 rollbacks, a 3rd consecutive-NaN event returns `'abort'` with signal `'nan.unrecoverable'`.
    - Test 4: Loss at iter 21 of 50× the EMA returns `'rollback'`; same 50× spike at iter 5 returns `'continue'` (warmup).
    - Test 5: A reward stream of 10 consecutive samples with variance <0.01 returns `'grpo.collapsed'` on the 10th.
    - Test 6: A reward stream of 10 samples with variance >=0.01 returns `'continue'`.
    - Test 7: Single `TrainPoint` with `iter: -1` + no loss + no reward returns `'continue'` (idle).
    - Test 8: Ingesting the raw marker string via `ingestRawLine('grpo.skipped reason=zero-iters …')` (second method) immediately returns `'grpo.collapsed'` with reason `'skipped'`.
  </behavior>
  <action>
Create `lib/training/supervisor.ts` — exact structure:
```typescript
import type { TrainPoint } from '@/lib/streams/trainParser';
import { rollbackToLatestCheckpoint } from '@/lib/training/rollback';

export type SupervisorSignal =
  | { kind: 'continue' }
  | { kind: 'rollback'; reason: 'nan' | 'spike'; nextRollbackIndex: number }
  | { kind: 'abort'; reason: 'nan.unrecoverable' | 'spike.unrecoverable' }
  | { kind: 'grpo.collapsed'; reason: 'variance' | 'skipped' };

const NAN_THRESHOLD = 2;       // consecutive NaN/Infinity loss before rollback
const SPIKE_MULTIPLIER = 10;   // loss > emaLoss * this → rollback
const WARMUP_ITERS = 20;       // EMA not trusted before this iter
const MAX_ROLLBACKS = 2;
const VARIANCE_WINDOW = 10;
const VARIANCE_FLOOR = 0.01;

export class TrainSupervisor {
  private nanCount = 0;
  private emaLoss: number | null = null;
  private rollbacks = 0;
  private rewards: number[] = [];

  ingest(pt: TrainPoint): SupervisorSignal {
    // Reward branch — GRPO variance-collapse detection (TRN-02 kill-point)
    if (pt.reward !== undefined && Number.isFinite(pt.reward)) {
      this.rewards.push(pt.reward);
      if (this.rewards.length > VARIANCE_WINDOW) this.rewards.shift();
      if (this.rewards.length === VARIANCE_WINDOW) {
        const mean = this.rewards.reduce((a, b) => a + b, 0) / VARIANCE_WINDOW;
        const variance = this.rewards.reduce((a, b) => a + (b - mean) ** 2, 0) / VARIANCE_WINDOW;
        if (variance < VARIANCE_FLOOR) {
          return { kind: 'grpo.collapsed', reason: 'variance' };
        }
      }
    }

    // Loss branch — NaN + spike detection (TRN-04)
    if (pt.loss === undefined) return { kind: 'continue' };
    const bad = Number.isNaN(pt.loss) || !Number.isFinite(pt.loss);
    if (bad) {
      this.nanCount += 1;
      if (this.nanCount >= NAN_THRESHOLD) {
        return this.escalate('nan');
      }
      return { kind: 'continue' };
    }
    this.nanCount = 0;

    if (this.emaLoss !== null && pt.iter > WARMUP_ITERS && pt.loss > this.emaLoss * SPIKE_MULTIPLIER) {
      return this.escalate('spike');
    }
    this.emaLoss = this.emaLoss === null ? pt.loss : 0.9 * this.emaLoss + 0.1 * pt.loss;
    return { kind: 'continue' };
  }

  /**
   * Non-TrainPoint marker line handler. Phase 5 plan 05-02's grpo.sh prints
   * `grpo.skipped reason=…` on the Path C path; caller feeds that line here.
   */
  ingestRawLine(line: string): SupervisorSignal {
    if (line.startsWith('grpo.skipped')) {
      return { kind: 'grpo.collapsed', reason: 'skipped' };
    }
    return { kind: 'continue' };
  }

  async performRollback(adapterDir: string): Promise<number> {
    const iter = await rollbackToLatestCheckpoint(adapterDir);
    this.rollbacks += 1;
    this.nanCount = 0;
    this.emaLoss = null;
    return iter;
  }

  private escalate(cause: 'nan' | 'spike'): SupervisorSignal {
    if (this.rollbacks >= MAX_ROLLBACKS) {
      return { kind: 'abort', reason: cause === 'nan' ? 'nan.unrecoverable' : 'spike.unrecoverable' };
    }
    return { kind: 'rollback', reason: cause, nextRollbackIndex: this.rollbacks + 1 };
  }
}
```

Create `lib/training/supervisor.test.ts` — 8 behavior cases above. Use the same runner as rollback.test.ts. DO NOT stub out `rollbackToLatestCheckpoint` unless testing `performRollback` — for `ingest`/`ingestRawLine` tests, a `TrainSupervisor` instance works standalone without touching disk.

Critical constants exposed as module-local consts (not exported) for easy tuning without callers depending on them. Callers depend only on `TrainSupervisor` + `SupervisorSignal`.
  </action>
  <verify>
    <automated>test -f lib/training/supervisor.ts && grep -n "class TrainSupervisor" lib/training/supervisor.ts && grep -n "MAX_ROLLBACKS" lib/training/supervisor.ts && grep -n "variance" lib/training/supervisor.ts && grep -n "ingestRawLine" lib/training/supervisor.ts && grep -n "grpo.skipped" lib/training/supervisor.ts && grep -n "rollbackToLatestCheckpoint" lib/training/supervisor.ts && (pnpm vitest run lib/training/supervisor.test.ts 2>&1 || node --test lib/training/supervisor.test.ts 2>&1) | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `lib/training/supervisor.ts` exports class `TrainSupervisor` and type `SupervisorSignal`
    - File contains exact strings `MAX_ROLLBACKS`, `VARIANCE_WINDOW`, `VARIANCE_FLOOR`, `ingestRawLine`, `grpo.skipped`, `rollbackToLatestCheckpoint`
    - All 8 behavior tests pass
    - `ingest({ iter: 0, loss: NaN })` twice returns `{ kind: 'rollback', reason: 'nan', nextRollbackIndex: 1 }` on the second call
  </acceptance_criteria>
  <done>Supervisor is a pure, fully-tested state machine. 05-04 wires its signals into /api/train process actions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: transformGrpoJsonl.ts + scripts/build-grpo-jsonl.ts — SFT → GRPO data transform</name>
  <files>lib/training/transformGrpoJsonl.ts, lib/training/transformGrpoJsonl.test.ts, scripts/build-grpo-jsonl.ts</files>
  <read_first>
    - .planning/phases/05-train-model-a/05-RESEARCH.md §Pitfall P5 (GRPO data shape) and §"Don't Hand-Roll" closing paragraph
    - .venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/datasets.py lines 9-43
    - PRD_SPEC.md §6.1 + §7.3 (Phase 4 training.jsonl OpenAI tools format)
    - data/training/grpo/smoke-train.jsonl (05-01 output — example of the target shape)
    - package.json (confirm `tsx` or fallback to `node --experimental-strip-types`)
  </read_first>
  <behavior>
    - Test 1: Input line `{"messages":[{"role":"user","content":"List tables"},{"role":"assistant","content":"<|tool_call|>{\"name\":\"list_tables\",\"arguments\":{}}<|tool_response|>[\"users\",\"posts\"]"}],"tools":[...]}` produces `{"prompt":"List tables","answer":"list_tables"}` (canonical answer = tool name).
    - Test 2: Input with plain assistant text (no tool_call) produces `{"prompt":<user>,"answer":<assistant text up to 200 chars, trimmed>}`.
    - Test 3: Input with multiple user turns uses the LAST user turn as prompt.
    - Test 4: Malformed JSON line is skipped and logged to stderr; `transformSftToGrpo` returns only the successful conversions.
    - Test 5: Input with empty messages array is skipped.
    - Test 6: Output lines are valid JSON and contain ONLY keys `prompt` and `answer` (no extra fields leak from tools/metadata).
  </behavior>
  <action>
1. **lib/training/transformGrpoJsonl.ts** — export:
```typescript
type SftMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string };
type SftLine = { messages: SftMessage[]; tools?: unknown[] };
export type GrpoLine = { prompt: string; answer: string };

const TOOL_CALL_RE = /<\|tool_call\|>\s*(\{[\s\S]*?\})\s*<\|tool_response\|>/;

export function transformSftToGrpo(lines: string[]): GrpoLine[] {
  const out: GrpoLine[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let obj: SftLine;
    try { obj = JSON.parse(trimmed) as SftLine; } catch { process.stderr.write(`skip: bad json\n`); continue; }
    if (!obj.messages || obj.messages.length === 0) { process.stderr.write(`skip: no messages\n`); continue; }
    const userTurns = obj.messages.filter((m) => m.role === 'user');
    const assistantTurns = obj.messages.filter((m) => m.role === 'assistant');
    if (userTurns.length === 0 || assistantTurns.length === 0) { process.stderr.write(`skip: missing turn\n`); continue; }
    const prompt = userTurns[userTurns.length - 1].content;
    const lastAssistant = assistantTurns[assistantTurns.length - 1].content;
    let answer: string;
    const m = TOOL_CALL_RE.exec(lastAssistant);
    if (m) {
      try {
        const call = JSON.parse(m[1]) as { name?: string };
        answer = call.name ?? lastAssistant.slice(0, 200);
      } catch { answer = lastAssistant.slice(0, 200); }
    } else {
      answer = lastAssistant.slice(0, 200).trim();
    }
    out.push({ prompt, answer });
  }
  return out;
}
```

2. **lib/training/transformGrpoJsonl.test.ts** — 6 behavior cases (vitest or node --test). Inline the fixtures as string literals.

3. **scripts/build-grpo-jsonl.ts** — exact body:
```typescript
#!/usr/bin/env tsx
// scripts/build-grpo-jsonl.ts — Phase 4 SFT JSONL → Phase 5 GRPO JSONL.
// Usage: tsx scripts/build-grpo-jsonl.ts <input.jsonl> [out-dir=data/training/grpo] [split=0.9]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSftToGrpo } from '../lib/training/transformGrpoJsonl';

const [inputPath, outDir = 'data/training/grpo', splitRaw = '0.9'] = process.argv.slice(2);
if (!inputPath) {
  process.stderr.write('usage: tsx scripts/build-grpo-jsonl.ts <input.jsonl> [outDir] [splitFraction]\n');
  process.exit(2);
}
const split = Number(splitRaw);
const lines = readFileSync(inputPath, 'utf8').split('\n');
const grpo = transformSftToGrpo(lines);
if (grpo.length === 0) { process.stderr.write('no grpo lines produced\n'); process.exit(1); }

mkdirSync(outDir, { recursive: true });
const cut = Math.max(1, Math.floor(grpo.length * split));
const trainJsonl = grpo.slice(0, cut).map((l) => JSON.stringify(l)).join('\n') + '\n';
const validJsonl = grpo.slice(cut).map((l) => JSON.stringify(l)).join('\n') + '\n';
writeFileSync(join(outDir, 'train.jsonl'), trainJsonl);
writeFileSync(join(outDir, 'valid.jsonl'), validJsonl.length > 1 ? validJsonl : trainJsonl);
process.stdout.write(`wrote ${cut} train / ${grpo.length - cut} valid lines to ${outDir}\n`);
```

If `tsx` is not in the repo (check package.json), fall back to a pure-JS `.mjs` version. Preferred is tsx — already pulled by AI SDK. DO NOT author a `.py` version (CLAUDE.md A05).
  </action>
  <verify>
    <automated>test -f lib/training/transformGrpoJsonl.ts && grep -n "transformSftToGrpo" lib/training/transformGrpoJsonl.ts && grep -n "tool_call" lib/training/transformGrpoJsonl.ts && test -f scripts/build-grpo-jsonl.ts && grep -n "transformSftToGrpo" scripts/build-grpo-jsonl.ts && (pnpm vitest run lib/training/transformGrpoJsonl.test.ts 2>&1 || node --test lib/training/transformGrpoJsonl.test.ts 2>&1) | tail -20 && find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*" | wc -l | grep -E "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/training/transformGrpoJsonl.ts` exports `transformSftToGrpo` and `GrpoLine` type
    - Contains regex matching `<\|tool_call\|>`
    - All 6 behavior tests pass
    - `scripts/build-grpo-jsonl.ts` is a tsx CLI that imports `transformSftToGrpo`
    - `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns ZERO lines (A05 preserved)
    - Keys of each output line are EXACTLY `prompt`, `answer` (Test 6 enforces)
  </acceptance_criteria>
  <done>Phase 4's JSONL can be transformed into GRPO-ready shape with one CLI invocation; supervisor/rollback/transform all tested.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Phase 4 JSONL → transform | Input may be malformed; transform must not crash the train pipeline |
| supervisor.ts → rollback.ts | Pure in-process; no external surface |
| Python stdout → supervisor | Untrusted lines from subprocess; only regex-matched points + whitelisted markers are acted on |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-08 | DoS | Malformed JSONL line crashes transform mid-stream | mitigate | `try/catch` per line, stderr log, skip; test case 4 enforces |
| T-05-09 | Tampering | Adversarial stdout line like `grpo.skipped` injected mid-SFT | mitigate | `ingestRawLine` only fires when supervisor is in GRPO mode — caller gates the call by child process identity (05-04 enforces) |
| T-05-10 | DoS | Infinite rollback loop exhausts checkpoints | mitigate | `MAX_ROLLBACKS=2` hard cap; supervisor emits `abort` signal |
| T-05-11 | Information Disclosure | Training JSONL content leaked in error messages | mitigate | stderr skip message says `bad json` / `no messages` — no content echoed |
</threat_model>

<verification>
- All three unit test files pass under vitest OR `node --test`.
- `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns empty (A05).
- TypeScript compile clean: `pnpm tsc --noEmit` exits 0 (or `pnpm next build` if no standalone tsc script).
- Sample e2e smoke (optional, if Phase 1 bench JSONL present): `tsx scripts/build-grpo-jsonl.ts data/bench/train.jsonl data/training/grpo 0.8` writes non-empty `train.jsonl` + `valid.jsonl`.
</verification>

<success_criteria>
- TRN-04 core logic (NaN detect + rollback + MAX_ROLLBACKS budget + abort signal) shipped and tested.
- TRN-02 kill-point (reward-variance collapse + `grpo.skipped` marker) detected by supervisor.
- Phase 4 JSONL → GRPO JSONL transform exists without any `.py` file.
</success_criteria>

<output>
After completion, create `.planning/phases/05-train-model-a/05-03-SUMMARY.md`. Include: unit-test pass counts, supervisor signal table (mapping TRN requirements to signal kinds), a pasted example of a transformed line, and the exact heuristic constants (NAN_THRESHOLD, SPIKE_MULTIPLIER, VARIANCE_WINDOW, VARIANCE_FLOOR, MAX_ROLLBACKS) so 05-04 can tune if needed.
</output>
