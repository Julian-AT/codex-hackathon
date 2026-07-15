---
phase: 01-foundation-smoke
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - requirements.txt
  - scripts/setup-venv.sh
  - scripts/micro-bench.sh
  - scripts/grpo-smoke.sh
  - data/bench/bench.jsonl
  - data/bench/README.md
autonomous: false
requirements: [FND-01, FND-02]

must_haves:
  truths:
    - "A Python 3.12 venv exists and `mlx_lm.lora --help` responds with the 0.31.2 flag surface."
    - "A 50-iter LoRA micro-bench on `unsloth/gemma-4-E4B-it-UD-MLX-4bit` logs sec/iter and peak memory (GB) to stdout and to `data/bench/e4b.log`."
    - "If peak memory > 20 GB, the operator switches to E2B via a documented one-line env override and re-runs the bench."
    - "`mlx-lm-lora==0.1.0` is importable and a 5-iter GRPO dry-run either succeeds or fails with a captured, actionable error (reward-fn surface confirmed per PITFALLS P2)."
  artifacts:
    - path: "requirements.txt"
      provides: "Pinned mlx-lm + mlx-lm-lora + datasketch + jsonschema"
      contains: "mlx-lm[train]==0.31.2"
    - path: "scripts/setup-venv.sh"
      provides: "Idempotent Python 3.12 venv + pip install"
    - path: "scripts/micro-bench.sh"
      provides: "50-iter LoRA bench with FND-02 kill-point evaluation baked in"
    - path: "data/bench/bench.jsonl"
      provides: "20-line hand-written JSONL in mlx-lm `tools` format"
      min_lines: 20
  key_links:
    - from: "scripts/micro-bench.sh"
      to: ".venv/bin/mlx_lm.lora"
      via: "subprocess invocation"
      pattern: "mlx_lm\\.lora.*--train"
    - from: "scripts/micro-bench.sh"
      to: "data/bench/e4b.log"
      via: "tee + grep for peak mem and sec/iter"
      pattern: "Peak memory|it/s"
---

<objective>
Install the MLX training toolchain and execute the PRD §14 H0 **kill-point** micro-benchmark. This plan holds the single most important decision in Phase 1: if E4B peak memory > 20 GB on M4 Pro 24 GB, the entire pipeline switches base model to E2B immediately.

Purpose: Prevent committing to an OOM-bound base model. Resolve the `mlx-lm-lora==0.1.0` GRPO reward-fn surface (PITFALLS P2) before Phase 5.
Output: A working venv, `data/bench/e4b.log` with sec/iter + peak memory, and a documented go/no-go decision on the base model.
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
@.planning/research/SUMMARY.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md

<interfaces>
Exact pins per PRD §13 + SUMMARY §2:
- Python 3.12 (NOT 3.13, NOT 3.11)
- `mlx-lm[train]==0.31.2` — pulls torch ~700 MB (2–3 min install)
- `mlx-lm-lora==0.1.0` — GRPO/DPO extension; reward-fn surface is the H0 unknown (PITFALLS P2)
- `datasketch` (Phase 4 MinHash dedup)
- `jsonschema` (Phase 3/4 tool-call validation)

H0 micro-bench canonical flags (PRD §14 H0):
```
mlx_lm.lora \
  --model unsloth/gemma-4-E4B-it-UD-MLX-4bit \
  --train \
  --data ./data/bench \
  --iters 50 \
  --batch-size 2 \
  --num-layers 16 \
  --max-seq-length 1024 \
  --grad-checkpoint \
  --steps-per-report 5 \
  --learning-rate 1e-5 \
  --adapter-path ./data/bench/adapter-50iter
```

KILL-POINT (FND-02): peak memory > 20 GB → switch base model to `unsloth/gemma-4-E2B-it-UD-MLX-4bit` EVERYWHERE. Decision command:
```
echo "BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit" > .env.base
./scripts/micro-bench.sh   # re-run with E2B
```
Downstream plans (03, 04) read `.env.base` if present; default is E4B.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Python 3.12 venv + pinned deps + 20-example bench JSONL</name>
  <files>
    requirements.txt, scripts/setup-venv.sh, data/bench/bench.jsonl, data/bench/README.md
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §13, §7.3 (mlx-lm `tools` JSONL format)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/STACK.md (install order, torch download caveat)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (hard constraint A05 — no authored `.py` files)
  </read_first>
  <action>
    1. Write `requirements.txt` with EXACT pins:
       ```
       mlx-lm[train]==0.31.2
       mlx-lm-lora==0.1.0
       datasketch
       jsonschema
       ```
    2. Write `scripts/setup-venv.sh` (chmod +x, `set -euo pipefail`):
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       PY=${PYTHON:-python3.12}
       if [ ! -d .venv ]; then "$PY" -m venv .venv; fi
       source .venv/bin/activate
       pip install --upgrade pip
       pip install -r requirements.txt
       mlx_lm.lora --help | head -20
       python -c "import mlx_lm_lora; print('mlx_lm_lora OK')"
       ```
    3. Write `data/bench/bench.jsonl` — exactly 20 JSON lines, each in mlx-lm `tools` format:
       ```json
       {"messages":[{"role":"user","content":"What is 2+2?"},{"role":"assistant","content":"2+2 equals 4."}],"tools":[]}
       ```
       Use 20 distinct short Q&A pairs. Throw-away data — only tokenizer/loader must accept it.
    4. Write `data/bench/README.md` noting this is throw-away bench data (real training data → `data/training/` in Phase 4).
    5. Run `./scripts/setup-venv.sh` end-to-end. Confirm `mlx_lm.lora --help` prints flags `--iters`, `--batch-size`, `--num-layers`, `--grad-checkpoint`, `--adapter-path`, `--max-seq-length`.
    6. HARD CONSTRAINT: Do NOT author any `.py` file. Python is CLI subprocess only (CLAUDE.md A05, PRD §19.4).
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && bash scripts/setup-venv.sh 2>&1 | tail -30 && source .venv/bin/activate && mlx_lm.lora --help 2>&1 | grep -E "(--iters|--num-layers|--grad-checkpoint)" | head -5 && wc -l data/bench/bench.jsonl && python -c "import json; [json.loads(l) for l in open('data/bench/bench.jsonl')]; print('JSONL valid')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "mlx-lm\[train\]==0.31.2" requirements.txt` succeeds.
    - `grep -E "mlx-lm-lora==0.1.0" requirements.txt` succeeds.
    - `wc -l data/bench/bench.jsonl` reports exactly 20.
    - `source .venv/bin/activate && mlx_lm.lora --help` exits 0 and mentions `--iters`, `--num-layers`, `--grad-checkpoint`.
    - `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns zero results (A05 hard constraint).
  </acceptance_criteria>
  <done>FND-01 satisfied: venv up, `mlx_lm.lora --help` responds, no authored `.py` files exist.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run 50-iter E4B micro-bench + FND-02 kill-point decision</name>
  <files>
    scripts/micro-bench.sh, scripts/grpo-smoke.sh, data/bench/e4b.log, .env.base (conditional)
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §6.3 (memory math), §14 H0 (kill-point)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P2 GRPO surface, P19 NaN-on-step-1)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/ROADMAP.md Phase 1 (kill-point gate FND-02)
  </read_first>
  <action>
    First, write the two bench scripts; then run them; then present the kill-point decision to the operator.

    1. `scripts/micro-bench.sh`:
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       source .venv/bin/activate
       # Allow E2B override via .env.base
       if [ -f .env.base ]; then source .env.base; fi
       BASE_MODEL=${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}
       TAG=$(basename "$BASE_MODEL" | sed 's/.*\(E[0-9]B\).*/\1/' | tr 'A-Z' 'a-z')
       LOG="data/bench/${TAG}.log"
       mkdir -p data/bench/adapter-50iter
       echo "=== Micro-bench: $BASE_MODEL ===" | tee "$LOG"
       START=$(date +%s)
       PYTHONUNBUFFERED=1 mlx_lm.lora \
         --model "$BASE_MODEL" \
         --train \
         --data ./data/bench \
         --iters 50 \
         --batch-size 2 \
         --num-layers 16 \
         --max-seq-length 1024 \
         --grad-checkpoint \
         --steps-per-report 5 \
         --learning-rate 1e-5 \
         --adapter-path ./data/bench/adapter-50iter 2>&1 | tee -a "$LOG"
       END=$(date +%s)
       echo "=== Elapsed: $((END-START)) s ===" | tee -a "$LOG"
       echo ""
       echo "=== KILL-POINT CHECK (FND-02) ==="
       PEAK=$(grep -iE "peak (memory|mem)" "$LOG" | tail -1 || echo "")
       echo "PEAK line: $PEAK"
       echo "If peak > 20 GB → switch to E2B via: echo 'BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit' > .env.base && ./scripts/micro-bench.sh"
       ```
    2. `scripts/grpo-smoke.sh` — 5-iter GRPO smoke on the 50-iter adapter to resolve PITFALLS P2 (reward-fn surface):
       ```bash
       #!/usr/bin/env bash
       set -euo pipefail
       source .venv/bin/activate
       if [ -f .env.base ]; then source .env.base; fi
       BASE_MODEL=${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}
       echo "=== GRPO smoke: $BASE_MODEL ==="
       # Attempt 1: CLI flag surface (mlx-lm-lora 0.1.0 canonical)
       mlx_lm_lora.train --help 2>&1 | tee data/bench/grpo-help.log | head -60
       echo ""
       echo "=== Attempting 5-iter GRPO dry-run ==="
       set +e
       mlx_lm_lora.train \
         --train-mode grpo \
         --model "$BASE_MODEL" \
         --data ./data/bench \
         --iters 5 \
         --group-size 4 \
         --max-completion-length 128 \
         --learning-rate 5e-6 \
         --adapter-path ./data/bench/adapter-50iter 2>&1 | tee data/bench/grpo-smoke.log
       RC=$?
       set -e
       echo "=== GRPO smoke exit: $RC ==="
       if [ $RC -ne 0 ]; then
         echo "PITFALLS P2 TRIGGERED — capture reward-fn flag surface; Phase 5 decides between shell-only bridge and escalation to PRD owners for a sanctioned .py carve-out."
       fi
       ```
       Note: if `mlx_lm_lora.train` does not expose a reward function via CLI flag, Phase 5 will bridge it. The smoke script's job here is ONLY to capture the flag surface — success is optional, actionable failure output is mandatory.
    3. Run `./scripts/micro-bench.sh` end-to-end. Confirm `data/bench/e4b.log` contains a peak memory line.
    4. Run `./scripts/grpo-smoke.sh` and archive `data/bench/grpo-help.log` + `data/bench/grpo-smoke.log`.
    5. Extract peak memory from `e4b.log`. Write the decision to the plan SUMMARY.
  </action>
  <what-built>
    50-iter LoRA micro-bench on E4B (or E2B if override set), producing `data/bench/e4b.log` (or `e2b.log`) with sec/iter and peak memory, plus a GRPO 5-iter smoke run with its flag surface captured.
  </what-built>
  <how-to-verify>
    1. Inspect `data/bench/e4b.log`. Extract peak memory (GB) and total elapsed seconds.
    2. Compare peak memory to 20 GB:
       - **peak ≤ 20 GB:** E4B stays as base model. Report the measured sec/iter — this feeds the 400-iter SFT projection in Phase 5.
       - **peak > 20 GB:** Run `echo 'BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit' > .env.base && ./scripts/micro-bench.sh`. Confirm E2B peak is well under 20 GB. Notify plans 01-03, 01-04 to read `.env.base`.
    3. Inspect `data/bench/grpo-help.log` — confirm whether `mlx_lm_lora.train` exposes a CLI reward-fn flag (look for `--reward-fn`, `--reward-function`, `--reward-path`). If none present, note "reward bridge needed in Phase 5" in SUMMARY.
    4. Confirm `data/bench/adapter-50iter/adapter.safetensors` (or `adapter_weights.safetensors`) exists — plan 01-04 will fuse this for the hot-swap smoke.
  </how-to-verify>
  <resume-signal>Type `approved` with decision line: `base_model={e4b|e2b} peak_gb={X} sec_per_iter={Y} grpo_reward_fn={cli|bridge}`.</resume-signal>
  <acceptance_criteria>
    - `data/bench/e4b.log` exists and contains the literal string `Peak memory` (mlx-lm output) OR the script's wrapping `=== Elapsed` line.
    - `grep -iE "peak (memory|mem)" data/bench/e4b.log` returns at least one line with a GB value.
    - If peak > 20 GB: `.env.base` exists with `BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit`, AND `data/bench/e2b.log` exists.
    - `data/bench/adapter-50iter/` contains a `.safetensors` file (needed by plan 01-04).
    - `data/bench/grpo-help.log` exists and is non-empty (mlx_lm_lora.train help captured).
    - Operator decision logged to plan SUMMARY per resume-signal format.
  </acceptance_criteria>
  <done>FND-02 kill-point resolved: base model pinned (E4B or E2B) with measured peak memory. GRPO reward-fn surface documented for Phase 5.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local shell → HF Hub | `mlx_lm.lora` downloads model weights on first call; network trust boundary crossed. |
| Shell → Python venv | venv is trusted; only maintainer-installed packages. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-05 | Tampering | Unpinned mlx-lm version drift | mitigate | `==` pins in requirements.txt; no `~=` or `>=`. |
| T-01-06 | Denial of Service | HF download stall blocks H0 | mitigate | PRD §18 de-risk #3 pre-fetches base weights before H0; if not pre-fetched, bench still runs but elapsed time includes download (not in sec/iter). |
| T-01-07 | Information Disclosure | bench.jsonl committing real data | accept | bench.jsonl is hand-written throw-away math trivia; no PII or credentials. |
</threat_model>

<verification>
- `./scripts/setup-venv.sh` exits 0.
- `./scripts/micro-bench.sh` produces `data/bench/e4b.log` with peak memory line.
- Operator-confirmed base model decision recorded in SUMMARY.
- Zero `.py` files authored outside `.venv/`.
</verification>

<success_criteria>
FND-01 (venv + `mlx_lm.lora --help` responds) and FND-02 (bench run + E2B switch rule honored) both pass. Downstream plans know the pinned base model and the measured sec/iter.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-smoke/01-02-SUMMARY.md` recording:
- Final `BASE_MODEL` (E4B or E2B).
- Peak memory (GB) and sec/iter from the bench.
- GRPO reward-fn surface (CLI flag or bridge-needed).
- The 50-iter adapter path (for plan 01-04).
</output>
