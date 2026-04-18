---
phase: 05-train-model-a
plan: 04
type: execute
wave: 3
depends_on: [05-02, 05-03]
files_modified:
  - app/api/train/route.ts
  - lib/streams/trainParser.ts
  - .planning/phases/05-train-model-a/05-04-e2e-notes.md
autonomous: true
requirements: [TRN-01, TRN-02, TRN-03, TRN-04]

must_haves:
  truths:
    - "`/api/train` invokes `bash scripts/train.sh` (mode=sft) and `bash scripts/grpo.sh` (mode=grpo) — not `mlx_lm.lora`/`mlx_lm_lora.train` directly — so the Phase 5 wrappers own flag templating."
    - "`/api/train` instantiates a `TrainSupervisor` per request and calls `supervisor.ingest(pt)` on every parsed TrainPoint."
    - "On signal `rollback`: supervisor SIGTERMs the Python child, calls `supervisor.performRollback(adapterDir)`, then respawns `scripts/train.sh` with env `RESUME_ADAPTER=$adapterDir/adapters.safetensors`."
    - "On signal `abort` (TRN-04 kill-point): supervisor SIGTERMs the child, emits a `data-train` part `{iter:-1, loss: undefined, reward: undefined, aborted:'nan.unrecoverable'}` for the frontend pill, stops retrying."
    - "On signal `grpo.collapsed` (TRN-02 kill-point): supervisor SIGTERMs the child, emits a `data-train` part with `aborted:'grpo.collapsed'`, exits cleanly — SFT-only adapter ships."
    - "When mode===grpo, lines that do NOT parse as TrainPoint are passed to `supervisor.ingestRawLine(line)` so the `grpo.skipped` marker from scripts/grpo.sh surfaces as `grpo.collapsed` without needing a numeric reward."
    - "If 05-01-smoke-notes.md recorded `REWARD_SHAPE_MATCHES_PHASE2=NO`, `lib/streams/trainParser.ts`'s `REWARD_RE` is updated to the exact regex recorded in smoke-notes and Phase 2's parser test suite still passes."
    - "End-to-end SFT→GRPO dry run on either Phase 4 JSONL (if present) or Phase 1 bench JSONL completes with loss AND reward series visible on LossChart; kill-point paths exercised at least once in isolation."
  artifacts:
    - path: "app/api/train/route.ts"
      provides: "Phase 2 route upgraded to invoke Phase 5 bash wrappers + TrainSupervisor"
      contains: "TrainSupervisor"
    - path: "lib/streams/trainParser.ts"
      provides: "Parser with reward regex updated IFF smoke-notes required (no-op otherwise)"
      contains: "REWARD_RE"
    - path: ".planning/phases/05-train-model-a/05-04-e2e-notes.md"
      provides: "E2E dry-run evidence: SFT wall-clock, GRPO wall-clock, reward samples, any rollback/abort observed"
  key_links:
    - from: "app/api/train/route.ts"
      to: "lib/training/supervisor.ts"
      via: "new TrainSupervisor()"
      pattern: "new TrainSupervisor"
    - from: "app/api/train/route.ts"
      to: "scripts/train.sh"
      via: "spawn('bash', ['scripts/train.sh'], …)"
      pattern: "scripts/train\\.sh"
    - from: "app/api/train/route.ts"
      to: "scripts/grpo.sh"
      via: "spawn('bash', ['scripts/grpo.sh'], …)"
      pattern: "scripts/grpo\\.sh"
    - from: "app/api/train/route.ts"
      to: "supervisor.ingestRawLine"
      via: "non-TrainPoint line dispatch for grpo mode"
      pattern: "ingestRawLine"
---

<objective>
Wire plans 05-02 and 05-03 into Phase 2's `/api/train` so training actually runs end-to-end with live loss+reward streaming, NaN rollback, and kill-point narration — then prove it with one SFT→GRPO dry run. Also patch `lib/streams/trainParser.ts` if the 05-01 smoke revealed a reward-line shape Phase 2's default regex misses.

Purpose: Final Phase 5 integration + E2E verification of TRN-01..TRN-04. After this plan, Phase 6 can fuse the adapter and deploy.
Output: Upgraded `/api/train` route + optional parser patch + E2E evidence file.
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
@.planning/phases/05-train-model-a/05-01-SUMMARY.md
@.planning/phases/05-train-model-a/05-02-SUMMARY.md
@.planning/phases/05-train-model-a/05-03-SUMMARY.md
@.planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md
@app/api/train/route.ts
@lib/streams/trainParser.ts

<interfaces>
<!-- From Phase 2 02-02 (already live) -->
import { parseTrainLine, type TrainPoint } from '@/lib/streams/trainParser';
import { withTrainingSpan } from '@/lib/observability/trainingSpans';
// app/api/train/route.ts currently spawns `mlx_lm.lora` or `mlx_lm_lora.train` directly.

<!-- Wave 2 deliverables (05-02, 05-03) — available now -->
- scripts/train.sh, scripts/grpo.sh (both exec-style forwarders)
- lib/training/supervisor.ts → `TrainSupervisor`, `SupervisorSignal`
- lib/training/rollback.ts → `rollbackToLatestCheckpoint`
- lib/training/transformGrpoJsonl.ts → `transformSftToGrpo`
- scripts/build-grpo-jsonl.ts (CLI for building GRPO data)

<!-- From 05-01-smoke-notes.md -->
- REWARD_SHAPE_MATCHES_PHASE2 = YES|NO
- REWARD_RE = <exact regex to use>  (only relevant when NO)
- FINAL_GRPO_ITERS = <integer>, possibly 0

<!-- CONTEXT.md locked decisions -->
- D: Streaming contract = single merged SSE via Phase 2's /api/train (CONTEXT §"Streaming Contract").
- D: NaN recovery = supervisor emits `training.aborted` → pill "Tier 2 — prior-checkpoint adapter" (CONTEXT §"NaN Recovery").
- D: GRPO collapse → pill "SFT-only adapter — Tier 2" (CONTEXT §"NaN Recovery").
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Patch lib/streams/trainParser.ts IFF smoke said shape diverged (no-op otherwise)</name>
  <files>lib/streams/trainParser.ts, lib/streams/trainParser.test.ts</files>
  <read_first>
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md (REWARD_SHAPE_MATCHES_PHASE2 + REWARD_RE values)
    - data/bench/grpo-5iter.log (verbatim observed shape)
    - lib/streams/trainParser.ts (Phase 2 current version)
    - lib/streams/trainParser.test.ts (6 existing tests — all must still pass)
  </read_first>
  <action>
1. Open `.planning/phases/05-train-model-a/05-01-smoke-notes.md`.
2. If `REWARD_SHAPE_MATCHES_PHASE2=YES` → **STOP**, this task is a no-op. Skip to Task 2.
3. If `REWARD_SHAPE_MATCHES_PHASE2=NO`:
   a. Copy the exact `REWARD_RE = /…/` value from smoke-notes into `lib/streams/trainParser.ts`, replacing the current `REWARD_RE` constant.
   b. Keep `TRAIN_LOSS_RE` untouched (SFT shape is unchanged).
   c. In `lib/streams/trainParser.test.ts`, ADD (do not replace) new test cases using 2-3 verbatim sample lines from `data/bench/grpo-5iter.log`. Each new test asserts `parseTrainLine(exactLine)` returns the expected `{iter, reward}` TrainPoint.
   d. Run the full parser test suite — all Phase 2 cases (Train loss variants, null cases, fallback) MUST still pass.
4. If the observed shape emits per-function rewards (e.g. `reward_accuracy 0.5, reward_strict_format 0.25`), choose ONE canonical signal — sum or use `reward_accuracy` only. Document the choice in 05-04-e2e-notes.md §"Parser patch".
  </action>
  <verify>
    <automated>SMOKE_STATUS=$(grep -E "^REWARD_SHAPE_MATCHES_PHASE2=(YES|NO)" .planning/phases/05-train-model-a/05-01-smoke-notes.md | tail -1); if echo "$SMOKE_STATUS" | grep -q YES; then echo "no-op task"; else grep -n "REWARD_RE" lib/streams/trainParser.ts; fi && (pnpm vitest run lib/streams/trainParser.test.ts 2>&1 || node --test lib/streams/trainParser.test.ts 2>&1) | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - If smoke-notes said YES: `lib/streams/trainParser.ts` is unchanged (git diff empty for that file)
    - If smoke-notes said NO: `REWARD_RE` in the file exactly matches the value recorded in smoke-notes
    - All parser tests pass (new + existing 6)
    - `TRAIN_LOSS_RE` is NEVER modified by this task (SFT path untouched)
  </acceptance_criteria>
  <done>Parser reliably captures the real GRPO reward shape for whatever mlx-lm-lora 0.1.9 emits.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rewire /api/train to bash wrappers + integrate TrainSupervisor</name>
  <files>app/api/train/route.ts</files>
  <read_first>
    - app/api/train/route.ts (Phase 2 current version — CHILDREN map, runtime='nodejs', dynamic='force-dynamic', PYTHONUNBUFFERED, readline seam)
    - lib/training/supervisor.ts (TrainSupervisor + SupervisorSignal)
    - lib/training/rollback.ts (for comment context)
    - scripts/train.sh, scripts/grpo.sh (understand exec-style forwarding + ITERS/RESUME_ADAPTER env surface)
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md (FINAL_GRPO_ITERS)
    - .planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md (DO NOT regress ASVS V12 argv hygiene, CHILDREN map, SIGTERM-on-abort, dynamic='force-dynamic')
  </read_first>
  <action>
Edit `app/api/train/route.ts`. Keep all Phase 2 invariants intact (runtime, dynamic, CHILDREN map, SIGTERM on req.signal abort, withTrainingSpan, `data-train` part shape). Modifications:

1. **Import supervisor**:
```typescript
import { TrainSupervisor, type SupervisorSignal } from '@/lib/training/supervisor';
```

2. **Replace direct Python spawn with bash wrapper spawn**. Inside the stream `execute`, swap:
```typescript
// BEFORE (Phase 2 02-02):
const bin = process.env.MLX_LM_BIN || (mode === 'sft' ? 'mlx_lm.lora' : 'mlx_lm_lora.train');
const args = mode === 'sft' ? [/* ... */] : [/* ... */];
const child = spawn(bin, args, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });
```
with:
```typescript
// AFTER (Phase 5 05-04):
const scriptPath = mode === 'sft' ? 'scripts/train.sh' : 'scripts/grpo.sh';
const adapterDir = process.env.ADAPTER_DIR || 'data/training/model-a-adapter';
const spawnEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PYTHONUNBUFFERED: '1',
  ADAPTER_DIR: adapterDir,
  MODEL: model,   // pre-validated by Phase 2 regex — safe to pass through
  ITERS: String(iters),
};
// Rollback respawns set RESUME_ADAPTER via a helper below.
const child = spawn('bash', [scriptPath], { env: spawnEnv });
```

3. **Instantiate supervisor per request** (before the readline loop):
```typescript
const supervisor = new TrainSupervisor();
```

4. **Dispatch parsed + raw lines to supervisor** — replace the existing `for await (const line of rl)` body with:
```typescript
for await (const line of rl) {
  const pt = parseTrainLine(line);
  let signal: SupervisorSignal;
  if (pt) {
    if (pt.loss !== undefined) span.setAttribute(`loss.iter.${pt.iter}`, pt.loss);
    if (pt.reward !== undefined) span.setAttribute(`reward.iter.${pt.iter}`, pt.reward);
    writer.write({ type: 'data-train', data: pt, transient: true });
    signal = supervisor.ingest(pt);
  } else if (mode === 'grpo') {
    // Only in GRPO mode does grpo.skipped appear (from scripts/grpo.sh Path C short-circuit).
    signal = supervisor.ingestRawLine(line);
  } else {
    signal = { kind: 'continue' };
  }

  if (signal.kind === 'continue') continue;

  if (signal.kind === 'rollback') {
    try { child.kill('SIGTERM'); } catch {}
    const revertedIter = await supervisor.performRollback(adapterDir);
    span.setAttribute('training.rollback', revertedIter);
    writer.write({ type: 'data-train', data: { iter: revertedIter, loss: undefined, reward: undefined }, transient: true });
    // Respawn SFT only — rollback during GRPO is covered by grpo.collapsed, not here.
    const respawn = spawn('bash', ['scripts/train.sh'], {
      env: { ...spawnEnv, RESUME_ADAPTER: `${adapterDir}/adapters.safetensors` },
    });
    CHILDREN.delete(childId);
    const newId = `${mode}-${Date.now()}-r${revertedIter}`;
    CHILDREN.set(newId, respawn);
    // Hand readline off to the new child via a small helper (see Pattern A below).
    break;  // break out of for-await; outer while-loop re-enters with `respawn`
  }

  if (signal.kind === 'abort') {
    try { child.kill('SIGTERM'); } catch {}
    span.setAttribute('training.aborted', signal.reason);
    writer.write({ type: 'data-train', data: { iter: -1, loss: undefined, reward: undefined }, transient: true });
    // Frontend pill reads `aborted` via Sentry span OR via a dedicated marker the client interprets.
    return;
  }

  if (signal.kind === 'grpo.collapsed') {
    try { child.kill('SIGTERM'); } catch {}
    span.setAttribute('training.grpo_collapsed', signal.reason);
    writer.write({ type: 'data-train', data: { iter: -1, loss: undefined, reward: undefined }, transient: true });
    return;  // SFT-only adapter ships; Tier 2 narration.
  }
}
```

**Pattern A — restart loop for rollback respawn:** Wrap the readline processing in an outer `while (true)` that breaks only on clean child close OR abort/collapsed. On rollback, replace `child` and continue. Concrete shape:
```typescript
let activeChild = child;
let activeRl = readline.createInterface({ input: activeChild.stdout });
outer: while (true) {
  for await (const line of activeRl) { /* ...dispatch above... */
    if (signal.kind === 'rollback') {
      try { activeChild.kill('SIGTERM'); } catch {}
      const revertedIter = await supervisor.performRollback(adapterDir);
      writer.write({ type: 'data-train', data: { iter: revertedIter, loss: undefined, reward: undefined }, transient: true });
      activeChild = spawn('bash', ['scripts/train.sh'], { env: { ...spawnEnv, RESUME_ADAPTER: `${adapterDir}/adapters.safetensors` } });
      activeRl = readline.createInterface({ input: activeChild.stdout });
      continue outer;
    }
    if (signal.kind === 'abort' || signal.kind === 'grpo.collapsed') {
      /* span attrs + writer.write marker */
      return;
    }
  }
  // readline ended normally → child closed → exit outer loop
  await new Promise<void>((resolve) => activeChild.on('close', () => resolve()));
  break;
}
```

5. **Keep invariants**:
   - `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` unchanged.
   - `req.signal.addEventListener('abort', …)` still SIGTERMs `activeChild` — update the closure so abort targets whichever child is active.
   - Body validation (`model` regex, `iters` cap, `mode` enum) unchanged.
   - `withTrainingSpan(mode, iters, async (span) => { … })` still wraps the whole thing.
   - CHILDREN map tracks both original and respawned child IDs.
   - `try { child.kill('SIGTERM'); } catch {}` still runs in the `beforeExit` handler.

6. **Body body.iters default** — if `body.mode==='grpo'` and `body.iters` is undefined, default from an env var `MLX_GRPO_ITERS` (which a caller sets based on 05-01 FINAL_GRPO_ITERS), else fall back to 75. DO NOT hardcode 150 — RESEARCH A3 says 150 likely overshoots the 5-min budget.

7. **Error hygiene**: any `catch` truncates error strings to 400 chars, never logs `process.env` (preserves Phase 2 T-02-10).
  </action>
  <verify>
    <automated>grep -n "TrainSupervisor" app/api/train/route.ts && grep -n "scripts/train.sh" app/api/train/route.ts && grep -n "scripts/grpo.sh" app/api/train/route.ts && grep -n "ingestRawLine" app/api/train/route.ts && grep -n "performRollback" app/api/train/route.ts && grep -n "RESUME_ADAPTER" app/api/train/route.ts && grep -n "training.aborted\|training.grpo_collapsed" app/api/train/route.ts && grep -n "runtime = 'nodejs'" app/api/train/route.ts && grep -n "dynamic = 'force-dynamic'" app/api/train/route.ts && grep -n "PYTHONUNBUFFERED" app/api/train/route.ts && pnpm next build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `app/api/train/route.ts` contains exact strings: `TrainSupervisor`, `scripts/train.sh`, `scripts/grpo.sh`, `ingestRawLine`, `performRollback`, `RESUME_ADAPTER`, `training.aborted`, `training.grpo_collapsed`
    - Phase 2 invariants preserved: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `PYTHONUNBUFFERED` all present
    - `pnpm next build` exits 0 with no TS errors
    - Route never spawns `mlx_lm.lora` or `mlx_lm_lora.train` directly — only via `bash scripts/{train,grpo}.sh`
    - `body.iters` for GRPO mode falls back to `MLX_GRPO_ITERS` env, then to 75 (NOT 150)
  </acceptance_criteria>
  <done>Live loss + reward + kill-point signals all route through a single supervised pipeline into the Phase 2 chart.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: E2E SFT→GRPO dry-run + kill-point exercise</name>
  <files>.planning/phases/05-train-model-a/05-04-e2e-notes.md</files>
  <read_first>
    - app/api/train/route.ts (just modified)
    - scripts/train.sh, scripts/grpo.sh (Phase 5 wrappers)
    - lib/training/supervisor.ts (kill-point signal shapes)
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md (FINAL_GRPO_ITERS)
    - Whatever training JSONL is available: prefer Phase 4 `data/training/training.jsonl`; if absent, fall back to Phase 1 `data/bench/train.jsonl` + `data/bench/valid.jsonl`.
  </read_first>
  <action>
1. **Prepare GRPO JSONL**. If Phase 4 JSONL exists:
```bash
pnpm tsx scripts/build-grpo-jsonl.ts data/training/training.jsonl data/training/grpo 0.9
```
Otherwise, reuse the 05-01 smoke JSONL — copy `data/training/grpo/smoke-train.jsonl` → `data/training/grpo/train.jsonl` and `smoke-valid.jsonl` → `valid.jsonl`. Document the fallback in the e2e-notes file.

2. **Start Next dev server** in one terminal: `pnpm next dev`.

3. **Exercise SFT happy path** (reduced iters for time):
```bash
curl -N -X POST http://localhost:3000/api/train \
  -H 'content-type: application/json' \
  -d '{"mode":"sft","iters":50}' | tee data/bench/e2e-sft.log
```
Expected: stream of `data-train` events with `{iter, loss}`; no rollback; closes cleanly after ~25 s.

4. **Exercise GRPO happy path** (iters from 05-01 FINAL_GRPO_ITERS):
```bash
FINAL=$(grep -E "^FINAL_GRPO_ITERS=" .planning/phases/05-train-model-a/05-01-smoke-notes.md | cut -d= -f2)
curl -N -X POST http://localhost:3000/api/train \
  -H 'content-type: application/json' \
  -d "{\"mode\":\"grpo\",\"iters\":${FINAL}}" | tee data/bench/e2e-grpo.log
```
Expected: stream of `data-train` events with `{iter, reward}`. If FINAL=0, instead expect `aborted:'grpo.collapsed'` marker.

5. **Exercise Path C kill-point** (explicit ITERS=0):
```bash
curl -N -X POST http://localhost:3000/api/train -H 'content-type: application/json' -d '{"mode":"grpo","iters":0}' | tee data/bench/e2e-grpo-skipped.log
```
Expected: supervisor receives `grpo.skipped` line → emits `training.grpo_collapsed` span attr → stream ends cleanly.

6. **Exercise NaN rollback** (MANDATORY — synthetic stdout feed, not skippable). Spawn a fake bash subprocess that emits real `Iter N: Train loss X, …` lines INCLUDING a `NaN` loss spike through the ACTUAL `TrainingSupervisor.ingest()` path (not a unit-test mock). Concrete procedure:

```bash
# Stage a numbered checkpoint the rollback can target
mkdir -p data/training/model-a-adapter
printf 'stub' > data/training/model-a-adapter/0000100_adapters.safetensors
printf 'stub' > data/training/model-a-adapter/adapters.safetensors

# Write a fake trainer stub that writes to stdout in the exact shape parseTrainLine expects
cat > /tmp/fake-nan-trainer.sh <<'BASH'
#!/usr/bin/env bash
set -u
echo "Iter 1: Train loss 2.50, Learning Rate 1.000e-05, It/sec 0.4, Tokens/sec 800, Trained Tokens 1024, Peak mem 14.0 GB"
echo "Iter 2: Train loss 2.48, Learning Rate 1.000e-05, It/sec 0.4, Tokens/sec 800, Trained Tokens 2048, Peak mem 14.0 GB"
echo "Iter 3: Train loss 2.46, Learning Rate 1.000e-05, It/sec 0.4, Tokens/sec 800, Trained Tokens 3072, Peak mem 14.0 GB"
echo "Iter 4: Train loss 2.45, Learning Rate 1.000e-05, It/sec 0.4, Tokens/sec 800, Trained Tokens 4096, Peak mem 14.0 GB"
echo "Iter 5: Train loss NaN, Learning Rate 1.000e-05, It/sec 0.4, Tokens/sec 800, Trained Tokens 5120, Peak mem 14.0 GB"
sleep 30  # Let the supervisor SIGTERM us
BASH
chmod +x /tmp/fake-nan-trainer.sh

# Run it by temporarily pointing scripts/train.sh at the fake, OR — preferred — write a
# small Node harness at scripts/nan-rollback-harness.ts that:
#   1. spawn('bash', ['/tmp/fake-nan-trainer.sh'])
#   2. pipes stdout through readline into a real `new TrainSupervisor()` + `parseTrainLine`
#   3. on signal.kind === 'rollback': call the real `performRollback('data/training/model-a-adapter')`
#   4. asserts `adapters.safetensors` now has the bytes of `0000100_adapters.safetensors`
#   5. writes the observation to data/bench/e2e-nan-rollback.log
pnpm tsx scripts/nan-rollback-harness.ts 2>&1 | tee data/bench/e2e-nan-rollback.log
```

The harness MUST exercise the production `TrainSupervisor` and `performRollback` — not a stub. This is the ONLY live end-to-end verification of TRN-04 outside 05-03's unit tests; it is not skippable.

7. **Write** `.planning/phases/05-train-model-a/05-04-e2e-notes.md` with all of:
   - SFT wall-clock for the 50-iter run (extrapolated to 400-iter).
   - GRPO wall-clock for the real FINAL_GRPO_ITERS run (or confirmation of Path C).
   - First 10 `data-train` JSON samples from each of the 3 curls.
   - Evidence that `LossChart` (rendered on the Phase 2 demo page) shows both loss and reward lines (screenshot path OR hand-described observation).
   - Any deviations observed vs the plan (e.g. reward-variance false positive, unexpected regex drift).
   - A `PHASE_5_RESULT=PASS|PARTIAL|TIER2` line that downstream Phase 6 reads to decide adapter source:
     - PASS — SFT + GRPO both succeeded; fuse the final adapter.
     - PARTIAL — SFT succeeded, GRPO skipped/collapsed; fuse the SFT-only adapter.
     - TIER2 — SFT aborted (unrecoverable NaN); ship Phase 1's 50-iter bench adapter as Tier 2 per CONTEXT §"NaN Recovery".
  </action>
  <verify>
    <automated>test -f .planning/phases/05-train-model-a/05-04-e2e-notes.md && grep -E "^PHASE_5_RESULT=(PASS|PARTIAL|TIER2)" .planning/phases/05-train-model-a/05-04-e2e-notes.md && test -f data/bench/e2e-sft.log && test -f data/bench/e2e-grpo-skipped.log && test -f data/bench/e2e-nan-rollback.log && grep -E "data-train|iter|loss" data/bench/e2e-sft.log | head -5 && grep -E "grpo.collapsed|grpo_collapsed|aborted" data/bench/e2e-grpo-skipped.log && grep -Ei "rollback|nan" data/bench/e2e-nan-rollback.log</automated>
  </verify>
  <acceptance_criteria>
    - `data/bench/e2e-sft.log` exists and contains at least 5 `data-train` events with `loss` values
    - `data/bench/e2e-grpo-skipped.log` exists and contains the Path C collapse marker
    - `data/bench/e2e-grpo.log` exists (either shows reward events OR documents the FINAL_GRPO_ITERS=0 path)
    - 05-04-e2e-notes.md contains exactly one `PHASE_5_RESULT=PASS|PARTIAL|TIER2` line
    - 05-04-e2e-notes.md contains the first 10 `data-train` samples from the SFT run
    - Training wall-clock (SFT 400-iter extrapolated) is explicitly recorded and is ≤ 12 min (TRN-01 budget check)
    - `data/bench/e2e-nan-rollback.log` exists and documents: (a) synthetic `Iter 5: Train loss NaN, …` line was fed through the REAL `TrainSupervisor.ingest()` path, (b) supervisor emitted `signal.kind === 'rollback'`, (c) `performRollback` overwrote `adapters.safetensors` with the contents of `0000100_adapters.safetensors`, (d) child was SIGTERM'd. No "skipped — covered by unit tests" escape hatch is acceptable.
  </acceptance_criteria>
  <done>Phase 5 output is proven live: loss + reward stream on the chart, kill-points fire cleanly, Phase 6 has a deterministic input signal.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → /api/train | Untrusted body (mode, iters, model); all three validated inline |
| /api/train → bash → Python | Exec-style chain; argv is literal constants + validated model string |
| Python stdout → parseTrainLine + supervisor | Regex-match whitelist; non-matching lines ignored or routed to ingestRawLine |
| Rollback file operations → adapter dir | Node-side copyFile of trusted numbered files (pattern-matched) over latest |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-12 | Tampering | Adversarial `grpo.skipped` line in SFT mode | mitigate | `ingestRawLine` dispatch gated on `mode === 'grpo'` — SFT never consults it |
| T-05-13 | DoS | Respawn loop from persistent-NaN adapter — infinite rollback | mitigate | `MAX_ROLLBACKS=2` inside supervisor; 3rd NaN escalates to `abort` |
| T-05-14 | Integrity | Rollback copies a corrupted numbered ckpt (e.g. mid-write) | mitigate | mlx-lm writes numbered files atomically via safetensors save; rollback picks most recent fully-written file |
| T-05-15 | Information Disclosure | Sentry span attributes leak training content | mitigate | Only iter/loss/reward/aborted-reason recorded as attributes — no user/assistant content ever |
| T-05-16 | EoP | `--resume-adapter-file` could be argv-injected via an attacker-controlled env | mitigate | RESUME_ADAPTER is set only by the route code, never by request body; bash script template uses quoted `"$RESUME_ADAPTER"` |
</threat_model>

<verification>
- `pnpm next build` exits 0.
- All parser tests + supervisor tests + rollback tests + transform tests still pass.
- `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns empty (CLAUDE.md A05).
- 05-04-e2e-notes.md contains `PHASE_5_RESULT=PASS|PARTIAL|TIER2` — unambiguous handoff signal to Phase 6.
- `grep -c "mlx_lm.lora\b\|mlx_lm_lora.train\b" app/api/train/route.ts` = 0 (route never invokes Python directly; only bash wrappers).
- Live curl against `/api/train` streams `data-train` events matching Phase 2's existing client `useChat({onData})` router.
</verification>

<success_criteria>
- TRN-01 met: SFT runs through bash wrapper, live loss streams, 400-iter wall-clock inside 12 min.
- TRN-02 met: GRPO runs through bash wrapper with FINAL_GRPO_ITERS (or cleanly short-circuits via Path C), reward streams overlay loss.
- TRN-03 met: single Recharts chart shows loss AND reward at 5-step cadence; reward overlay appears when GRPO begins.
- TRN-04 met: supervisor NaN detect + numbered-ckpt rollback work end-to-end (unit-tested + live-exercised); MAX_ROLLBACKS=2 → abort → `data-train` marker for frontend Tier-2 pill.
- Phase 5 emits a deterministic `PHASE_5_RESULT` signal that Phase 6 reads to pick which adapter to fuse.
</success_criteria>

<output>
After completion, create `.planning/phases/05-train-model-a/05-04-SUMMARY.md`. Include: PHASE_5_RESULT, SFT wall-clock, GRPO wall-clock, number of rollbacks observed (ideally 0), any parser patches applied, and a 5-line cheatsheet for Phase 6 ("which adapter to fuse", "where it lives on disk", "whether GRPO was applied").
</output>
