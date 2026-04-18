---
phase: 05-train-model-a
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - requirements.txt
  - CLAUDE.md
  - PRD_SPEC.md
  - scripts/grpo-smoke.sh
  - data/training/grpo/smoke-train.jsonl
  - data/training/grpo/smoke-valid.jsonl
  - data/bench/rank-help.log
  - data/bench/grpo-5iter.log
  - .planning/phases/05-train-model-a/05-01-smoke-notes.md
autonomous: true
requirements: [TRN-01, TRN-02, TRN-03]

must_haves:
  truths:
    - "`requirements.txt` pins `mlx-lm-lora==0.1.9` (not 0.1.0)."
    - "CLAUDE.md §Tech Stack Locks reflects the 0.1.9 pin."
    - "PRD §13 reflects the 0.1.9 pin (or carries an explicit deviation note)."
    - "`mlx_lm.lora --help` is captured on disk; rank-flag presence is answered (YES/NO)."
    - "A 5-iter GRPO run on R1-format JSONL completes and its stdout is captured verbatim."
    - "Observed GRPO stdout line format (e.g. `Iter N: Reward X` vs per-fn breakdown) is written to 05-01-smoke-notes.md with an explicit regex recommendation for `lib/streams/trainParser.ts`."
    - "Final GRPO iter count for plan 05-02 is chosen based on measured sec/iter (target ≤ 4 min wall-clock)."
  artifacts:
    - path: "requirements.txt"
      provides: "Corrected 0.1.9 pin"
      contains: "mlx-lm-lora==0.1.9"
    - path: "data/bench/rank-help.log"
      provides: "Evidence of whether `--rank` exists in `mlx_lm.lora --help`"
    - path: "data/bench/grpo-5iter.log"
      provides: "Verbatim 5-iter GRPO stdout for format verification"
    - path: "data/training/grpo/smoke-train.jsonl"
      provides: "Minimal R1-format prompt/answer seed (≥5 lines)"
    - path: ".planning/phases/05-train-model-a/05-01-smoke-notes.md"
      provides: "Locked decisions for 05-02/05-03/05-04: rank-flag shape, reward regex, final GRPO iter count"
      contains: "FINAL_GRPO_ITERS"
  key_links:
    - from: "scripts/grpo-smoke.sh"
      to: ".venv/bin/python -m mlx_lm_lora.train"
      via: "exec"
      pattern: "mlx_lm_lora.train"
    - from: "data/training/grpo/smoke-train.jsonl"
      to: "GRPODataset"
      via: "{prompt,answer} shape required by mlx-lm-lora 0.1.9"
      pattern: "\"prompt\""
---

<objective>
Close every Phase 5 precondition before we author real training scripts: bump the `mlx-lm-lora` pin to 0.1.9 everywhere it is asserted, prove the CLI surface we need actually exists (`--rank`, `--reward-weights`, `--group-size`, `--max-completion-length`), and run the smallest possible GRPO invocation that emits a real `Iter N: …` reward line so we know the exact regex Phase 2's `trainParser.ts` must match. Output a single `05-01-smoke-notes.md` that is the canonical input to the next two plans — rank-flag shape, reward regex, and final GRPO iter count are all decided here.

Purpose: Research RESEARCH.md Assumptions A1 (reward stdout shape), A2 (rank flag), A3 (GRPO sec/iter) are all `ASSUMED`. 05-02 and 05-03 must not start until they are `MEASURED`.
Output: Canonical smoke-notes file + captured logs + corrected version pin.
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
@.planning/phases/05-train-model-a/05-RESEARCH.md
@.planning/phases/05-train-model-a/05-CONTEXT.md
@.planning/phases/01-foundation-smoke/01-02-SUMMARY.md

<interfaces>
<!-- Installed Python deps (Phase 1) -->
- `.venv/bin/python -m mlx_lm lora` (SFT entrypoint, mlx-lm 0.31.2)
- `.venv/bin/python -m mlx_lm_lora.train` (GRPO entrypoint, mlx-lm-lora 0.1.9)
- GRPO data shape (RESEARCH.md P5, datasets.py:9-43): `{"prompt": "...", "answer": "...", "type"?: "xml"}`
- Hardcoded R1 reward order (mlx_lm_lora/train.py:598-644): [accuracy, int, strict_format, soft_format]
- Checkpoint file pattern (mlx_lm/tuner/trainer.py:371-380): `{iter:07d}_adapters.safetensors` + `adapters.safetensors`
- `WANDB_MODE=offline` required (RESEARCH.md P2)

<!-- RESEARCH-tagged assumptions to close -->
- A1: GRPO stdout literal is `"Iter N: Reward X"` — UNVERIFIED until grpo-5iter.log captured
- A2: `mlx_lm.lora` CLI may have no `--rank` flag — UNVERIFIED until rank-help.log captured
- A3: GRPO sec/iter at group=4,max_completion=512 — UNVERIFIED until 5-iter timing measured

<!-- Decisions from 05-CONTEXT.md this plan implements -->
- D: Version pin locked to 0.1.9 (CONTEXT §"Version Pin — LOCKED").
- D: GRPO iter count locked by smoke measurement (CONTEXT §"GRPO Iter Count — LOCKED").
- D: Path A R1 built-ins (CONTEXT §"GRPO Reward Function — LOCKED: Path A").
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Bump mlx-lm-lora pin 0.1.0 → 0.1.9 in requirements.txt, CLAUDE.md, PRD §13</name>
  <files>requirements.txt, CLAUDE.md, PRD_SPEC.md</files>
  <read_first>
    - requirements.txt (current pin state)
    - CLAUDE.md §"Tech Stack Locks"
    - PRD_SPEC.md §13 (tech stack)
    - .planning/phases/05-train-model-a/05-CONTEXT.md §"Version Pin — LOCKED: mlx-lm-lora==0.1.9"
    - .planning/phases/01-foundation-smoke/01-02-SUMMARY.md §Deviations (explains why 0.1.0 never existed on PyPI)
  </read_first>
  <action>
1. **requirements.txt** — confirm `mlx-lm-lora==0.1.9` is already pinned (Phase 1 Deviation #1 already wrote this). If not, update to exactly `mlx-lm-lora==0.1.9`. Leave `mlx-lm[train]==0.31.2` untouched. Leave `wandb` line untouched.

2. **CLAUDE.md §Tech Stack Locks** — replace the existing line `- \`mlx-lm==0.31.2\`, \`mlx-lm-lora==0.1.0\`.` with `- \`mlx-lm==0.31.2\`, \`mlx-lm-lora==0.1.9\`.` (exact string). Do not touch other bullet points.

3. **PRD_SPEC.md §13** — find the row asserting `mlx-lm-lora==0.1.0` and change the version to `0.1.9`. Directly above or below the changed row, add an italicized deviation note: `*Deviation: 0.1.0 was never published to PyPI; 0.1.9 is the earliest 0.1.x compatible with Python 3.12. Verified Phase 1 01-02-SUMMARY.md.*`

No other PRD text is touched. The §6.2 "judge-jury float reward" row is explicitly NOT modified in this plan — CONTEXT.md §"GRPO Reward Function" defers PRD §6.2 reconciliation downstream.
  </action>
  <verify>
    <automated>grep -n "mlx-lm-lora==0.1.9" requirements.txt && grep -n "mlx-lm-lora==0.1.9" CLAUDE.md && grep -n "mlx-lm-lora==0.1.9" PRD_SPEC.md && ! grep -n "mlx-lm-lora==0.1.0" requirements.txt CLAUDE.md PRD_SPEC.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "mlx-lm-lora==0.1.9" requirements.txt` returns ≥1
    - `grep -c "mlx-lm-lora==0.1.9" CLAUDE.md` returns ≥1
    - `grep -c "mlx-lm-lora==0.1.9" PRD_SPEC.md` returns ≥1
    - `grep -c "mlx-lm-lora==0.1.0" requirements.txt CLAUDE.md PRD_SPEC.md` returns 0 across all three
    - PRD_SPEC.md contains the string `0.1.0 was never published to PyPI` near the changed pin
  </acceptance_criteria>
  <done>Version pin is consistent across the three authoritative files; 0.1.0 is gone.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Capture `mlx_lm.lora --help` — verify or deny `--rank` flag</name>
  <files>data/bench/rank-help.log, .planning/phases/05-train-model-a/05-01-smoke-notes.md</files>
  <read_first>
    - .planning/phases/05-train-model-a/05-RESEARCH.md §Pitfall P8 and §Pattern 1 trailing note about `--rank`
    - data/bench/e4b.log (Phase 1 help-capture baseline)
    - scripts/_lib.sh (if it already exists from Phase 1 — source venv if so; otherwise activate manually)
  </read_first>
  <action>
1. Activate the Phase 1 venv:
```bash
. .venv/bin/activate
```

2. Capture full help output and grep for rank:
```bash
python -m mlx_lm lora --help > data/bench/rank-help.log 2>&1
grep -Ei 'rank|--lora|--num-layers|adapter-path|save-every|steps-per-report|max-seq-length|learning-rate|grad-checkpoint|resume-adapter-file' data/bench/rank-help.log | tee -a data/bench/rank-help.log
```

3. Decide rank strategy. Create `.planning/phases/05-train-model-a/05-01-smoke-notes.md` with the header and the **Rank** section. Template:

```markdown
# 05-01 Smoke Notes (canonical input for 05-02/05-03/05-04)

## Rank flag decision

Observed in `mlx_lm.lora --help` (captured at data/bench/rank-help.log):
- `--rank` flag present: YES|NO  ← fill in
- If NO: rank is set via `adapter_config.json` inside `--adapter-path` before training starts.

### Locked decision for scripts/train.sh (plan 05-02)
RANK_STRATEGY=cli       # if --rank was present, pass `--rank 16` on argv
RANK_STRATEGY=config    # otherwise, write adapter_config.json with {"rank":16,"scale":20.0,"dropout":0.0,"keys":null} before invoking mlx_lm.lora
```

Fill in `YES` or `NO` based on the grep result and choose `RANK_STRATEGY=cli` or `RANK_STRATEGY=config`.

4. If `RANK_STRATEGY=config`, also record the exact JSON shape mlx-lm 0.31.2 expects in `adapter_config.json` — inspect `.venv/lib/python3.12/site-packages/mlx_lm/tuner/utils.py` (or the LoRA tuner file) for the schema and paste a minimal valid config into the smoke-notes file. If `RANK_STRATEGY=cli`, record the exact flag name (`--rank` or `--lora-rank` — whichever the help text shows).
  </action>
  <verify>
    <automated>test -s data/bench/rank-help.log && grep -E "^(--|\s+--)" data/bench/rank-help.log | head -5 && grep -E "RANK_STRATEGY=(cli|config)" .planning/phases/05-train-model-a/05-01-smoke-notes.md</automated>
  </verify>
  <acceptance_criteria>
    - `data/bench/rank-help.log` exists and is non-empty
    - `.planning/phases/05-train-model-a/05-01-smoke-notes.md` contains exactly one of `RANK_STRATEGY=cli` or `RANK_STRATEGY=config`
    - If `RANK_STRATEGY=config`, the smoke-notes file also contains a JSON block labeled `adapter_config.json` with a `rank` key
  </acceptance_criteria>
  <done>05-02 knows exactly how to set rank=16 without blind-flag risk.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: 5-iter GRPO smoke on R1-format JSONL → lock reward regex + final iter count</name>
  <files>scripts/grpo-smoke.sh, data/training/grpo/smoke-train.jsonl, data/training/grpo/smoke-valid.jsonl, data/bench/grpo-5iter.log, .planning/phases/05-train-model-a/05-01-smoke-notes.md</files>
  <read_first>
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Reward Stream Integration (TRN-03)", §"Wall-Clock Math (TRN-02)", §Pitfall P5 (data shape)
    - .planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md (Phase 2 trainParser regex — TRAIN_LOSS_RE, REWARD_RE)
    - .venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/datasets.py lines 9-43 (GRPODataset prompt/answer shape)
    - .venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/grpo_trainer.py around line 724 (per-fn reward stdout shape)
  </read_first>
  <action>
1. Create `data/training/grpo/smoke-train.jsonl` with **6 lines** of R1-format prompt/answer pairs (Supabase-flavored but intentionally trivial so the 5-iter run terminates predictably). Each line MUST be valid JSON with exactly the keys `prompt` and `answer`. Example lines (use these verbatim):
```
{"prompt":"What is Supabase RLS short for?","answer":"Row Level Security"}
{"prompt":"Name the SQL command Supabase uses to enable RLS on a table.","answer":"ALTER TABLE tablename ENABLE ROW LEVEL SECURITY"}
{"prompt":"Which Supabase client library is used in Next.js server components?","answer":"@supabase/ssr"}
{"prompt":"What does the Supabase Auth JWT claim 'role' typically contain for signed-in users?","answer":"authenticated"}
{"prompt":"Which Supabase function returns the current user's id inside SQL?","answer":"auth.uid()"}
{"prompt":"What HTTP method does Supabase PostgREST use for creating rows?","answer":"POST"}
```

Also create `data/training/grpo/smoke-valid.jsonl` with 2 lines (duplicate any 2 of the above; GRPODataset tolerates overlap for smoke).

2. Create `scripts/grpo-smoke.sh` (chmod +x after writing). Body:
```bash
#!/usr/bin/env bash
# scripts/grpo-smoke.sh — 5-iter GRPO smoke on R1-format JSONL.
# Captures real stdout to data/bench/grpo-5iter.log and times the run.
set -euo pipefail

cd "$(dirname "$0")/.."
. .venv/bin/activate
export WANDB_MODE=offline
export PYTHONUNBUFFERED=1

MODEL="unsloth/gemma-4-E4B-it-UD-MLX-4bit"
DATA="data/training/grpo"
OUT="data/bench/adapter-grpo-smoke"
mkdir -p "$OUT"

# Reward weights: order is [accuracy, int, strict_format, soft_format]
# (verified in mlx_lm_lora/train.py:598-644). Lean on accuracy + strict_format.
REWARD_WEIGHTS='[2.0,0.0,0.5,0.0]'

START=$(date +%s)
python -m mlx_lm_lora.train \
  --train-mode grpo \
  --model "$MODEL" \
  --train \
  --data "$DATA" \
  --iters 5 \
  --group-size 4 \
  --max-completion-length 256 \
  --learning-rate 5e-6 \
  --grad-checkpoint \
  --save-every 5 \
  --steps-per-report 1 \
  --reward-weights "$REWARD_WEIGHTS" \
  --adapter-path "$OUT" 2>&1 | tee data/bench/grpo-5iter.log
END=$(date +%s)
echo "elapsed_seconds=$((END-START))" | tee -a data/bench/grpo-5iter.log
```

Run it:
```bash
bash scripts/grpo-smoke.sh
```

If it crashes (e.g. data shape still wrong, reward-weights format rejected, OOM), iterate on the smallest change — NEVER author `.py`. If it crashes after 3 attempts, record the failure mode in 05-01-smoke-notes.md §"GRPO smoke blocked" and proceed to Task 4 — 05-04 will invoke the TRN-02 kill-point fallback instead.

3. Extract the observed reward stdout shape from `data/bench/grpo-5iter.log`:
```bash
grep -E "^(Iter|iter|Step|step).*[Rr]eward" data/bench/grpo-5iter.log | head -10
```

4. Append a "Reward regex" section to `.planning/phases/05-train-model-a/05-01-smoke-notes.md`:
```markdown
## Reward regex decision

Observed line(s) from data/bench/grpo-5iter.log:
  <paste first 3 matching lines verbatim>

### Locked regex for lib/streams/trainParser.ts (plan 05-04 patch)
REWARD_RE = /<paste the exact regex that matches the observed shape, capturing iter and reward as $1 and $2>/
REWARD_SHAPE_MATCHES_PHASE2 = YES|NO
# YES → Phase 2 /Iter\s+(\d+):\s+Reward\s+([\d.]+)/ already works, no patch needed.
# NO  → 05-04 includes a task to update lib/streams/trainParser.ts REWARD_RE and re-run parser tests.
```

## Final GRPO iter count

5. Compute sec/iter and project wall-clock:
```bash
# elapsed_seconds is in the log; 5 iters
awk -F= '/elapsed_seconds/{print $2/5 " sec_per_iter"}' data/bench/grpo-5iter.log
```

6. Append a "GRPO iter count" section to 05-01-smoke-notes.md:
```markdown
## GRPO iter count decision

sec_per_iter (measured, 5-iter, group=4, max_completion=256) = <X>
Budget: 5 min = 300 s. Safety margin: 20% → usable = 240 s.
FINAL_GRPO_ITERS = floor(240 / X), rounded down to nearest 25. Floor at 25, ceiling at 150.
```

Pick the literal number (e.g. `FINAL_GRPO_ITERS=75`) and hard-code it in the file — 05-02 reads this value, not the formula.

If the smoke crashed before emitting any `Iter N:` line, set `FINAL_GRPO_ITERS=0` and note "GRPO disabled — Path C kill-point primed at plan entry". 05-04 handles this case.
  </action>
  <verify>
    <automated>test -s data/training/grpo/smoke-train.jsonl && [ "$(wc -l < data/training/grpo/smoke-train.jsonl)" -ge 5 ] && head -1 data/training/grpo/smoke-train.jsonl | grep -E '"prompt".*"answer"' && test -x scripts/grpo-smoke.sh && test -f data/bench/grpo-5iter.log && grep -E "FINAL_GRPO_ITERS=[0-9]+" .planning/phases/05-train-model-a/05-01-smoke-notes.md && grep -E "REWARD_SHAPE_MATCHES_PHASE2=(YES|NO)" .planning/phases/05-train-model-a/05-01-smoke-notes.md</automated>
  </verify>
  <acceptance_criteria>
    - `data/training/grpo/smoke-train.jsonl` has ≥5 lines and each line has both `"prompt"` and `"answer"` keys
    - `scripts/grpo-smoke.sh` is executable (chmod +x)
    - `data/bench/grpo-5iter.log` exists and is non-empty
    - 05-01-smoke-notes.md contains exactly one `FINAL_GRPO_ITERS=<integer>` line
    - 05-01-smoke-notes.md contains exactly one `REWARD_SHAPE_MATCHES_PHASE2=YES` or `=NO`
    - If `FINAL_GRPO_ITERS=0`, the file explicitly states "Path C kill-point primed"
  </acceptance_criteria>
  <done>05-02 and 05-04 have hard values for GRPO iter count and reward regex. No assumptions remain in Phase 5.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HF Hub → local HF cache | Model weights already cached at Phase 1 — no network this plan |
| Shell → Python subprocess | Only argv, no user-supplied strings |
| wandb daemon → network | `WANDB_MODE=offline` mandatory to preserve airplane-mode story |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Information Disclosure | wandb phones home during smoke | mitigate | `export WANDB_MODE=offline` at top of grpo-smoke.sh |
| T-05-02 | Tampering | Shell injection via env vars | mitigate | All values are literal constants inside the script; no caller variables |
| T-05-03 | DoS | 5-iter smoke runs >5 min due to generation length | mitigate | `--max-completion-length 256` (half of PRD's 512) for smoke only; production value locked in 05-02 |
</threat_model>

<verification>
- `grep "mlx-lm-lora==0.1.9" requirements.txt CLAUDE.md PRD_SPEC.md` returns matches in all 3 files; `grep "mlx-lm-lora==0.1.0" …` returns nothing.
- `data/bench/rank-help.log` and `data/bench/grpo-5iter.log` exist on disk.
- `.planning/phases/05-train-model-a/05-01-smoke-notes.md` contains `RANK_STRATEGY=`, `REWARD_SHAPE_MATCHES_PHASE2=`, and `FINAL_GRPO_ITERS=` — each a single locked value.
- No `.py` files authored anywhere (CLAUDE.md A05): `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns empty.
</verification>

<success_criteria>
- TRN-01 precondition: rank-flag shape decided before 05-02 writes train.sh.
- TRN-02 precondition: GRPO iter count measured, not assumed; Path A data shape validated.
- TRN-03 precondition: reward-stdout regex matches or a patch list is documented for 05-04.
- Version pin drift eliminated across the three SoT files.
</success_criteria>

<output>
After completion, create `.planning/phases/05-train-model-a/05-01-SUMMARY.md` with: (1) RANK_STRATEGY, (2) REWARD_SHAPE_MATCHES_PHASE2 + the exact regex, (3) FINAL_GRPO_ITERS, (4) any crash modes encountered during the smoke, (5) elapsed seconds for the 5-iter smoke.
</output>
