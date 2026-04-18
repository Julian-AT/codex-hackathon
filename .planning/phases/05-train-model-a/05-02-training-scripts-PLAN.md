---
phase: 05-train-model-a
plan: 02
type: execute
wave: 2
depends_on: [05-01]
files_modified:
  - scripts/_lib.sh
  - scripts/train.sh
  - scripts/grpo.sh
  - data/training/model-a-adapter/adapter_config.json
autonomous: true
requirements: [TRN-01, TRN-02]

must_haves:
  truths:
    - "`scripts/_lib.sh` is a sourced helper: activates `.venv`, exports `WANDB_MODE=offline` and `PYTHONUNBUFFERED=1`, defines `ADAPTER_DIR` default."
    - "`scripts/train.sh` invokes `python -u -m mlx_lm lora --train` with the PRD §6.2 SFT flag set (400 iters, 16 layers, batch 2, seq 1024, LR 1e-5, save-every 100, steps-per-report 5)."
    - "Rank=16 is honored via RANK_STRATEGY from 05-01 (either CLI flag via `$RANK_FLAG_NAME` from smoke-notes, or pre-written `adapter_config.json`)."
    - "`scripts/grpo.sh` invokes `python -u -m mlx_lm_lora.train --train-mode grpo` with FINAL_GRPO_ITERS (from 05-01) iters, group-size 4, max-completion 512, LR 5e-6, save-every 50, `--resume-adapter-file` pointing at the SFT adapter."
    - "Both scripts `exec` the Python process (no bash wrapper between Node and Python) so `SIGTERM` from the supervisor reaches the subprocess directly."
    - "Both scripts accept env-var overrides (`MODEL`, `ITERS`, `ADAPTER_DIR`, `DATA_DIR`) via `: \"${VAR:=default}\"` pattern."
    - "`scripts/grpo.sh` short-circuits to exit 0 with a logged `grpo.skipped` line if `FINAL_GRPO_ITERS=0` (Path C kill-point from 05-01)."
  artifacts:
    - path: "scripts/_lib.sh"
      provides: "Shared env setup for train.sh and grpo.sh"
      contains: "WANDB_MODE=offline"
    - path: "scripts/train.sh"
      provides: "SFT wrapper for TRN-01"
      contains: "--iters"
    - path: "scripts/grpo.sh"
      provides: "GRPO wrapper for TRN-02 (Path A)"
      contains: "--train-mode grpo"
    - path: "data/training/model-a-adapter/adapter_config.json"
      provides: "Rank=16 config if RANK_STRATEGY=config (otherwise empty/absent)"
  key_links:
    - from: "scripts/train.sh"
      to: ".venv/bin/python -m mlx_lm lora"
      via: "exec"
      pattern: "exec .* mlx_lm"
    - from: "scripts/grpo.sh"
      to: ".venv/bin/python -m mlx_lm_lora.train"
      via: "exec (unless FINAL_GRPO_ITERS=0)"
      pattern: "mlx_lm_lora.train"
    - from: "scripts/grpo.sh"
      to: "scripts/train.sh output adapter"
      via: "--resume-adapter-file $ADAPTER_DIR/adapters.safetensors"
      pattern: "resume-adapter-file"
---

<objective>
Ship the two bash wrappers that `/api/train` invokes to run SFT then GRPO on Model A. The scripts are pure exec-style forwarders — no logic lives here except flag templating and env-var fallback. The Node supervisor (plan 05-03) owns the live policy (NaN detect, rollback, kill-points); these scripts are intentionally dumb.

Purpose: Satisfy TRN-01 (SFT 400-iter within 12 min) and TRN-02 (GRPO N-iter within 5 min, Path A R1 rewards).
Output: Three bash files + optional adapter_config.json; all invocations reproducible from the CLI manually for debugging.
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
@.planning/phases/01-foundation-smoke/01-02-SUMMARY.md

<interfaces>
<!-- From 05-01-smoke-notes.md — these are hard values by wave 2 -->
- RANK_STRATEGY=cli|config
- FINAL_GRPO_ITERS=<integer> (possibly 0 for Path C)
- REWARD_WEIGHTS (default `[2.0,0.0,0.5,0.0]` — accuracy + strict_format)

<!-- Phase 1 venv entrypoints -->
- SFT: `python -u -m mlx_lm lora ...`
- GRPO: `python -u -m mlx_lm_lora.train --train-mode grpo ...`

<!-- Phase 2 /api/train contract -->
- `/api/train` spawns (bin, args) with `PYTHONUNBUFFERED=1`. Phase 5 bin becomes `bash` with `args = ['scripts/train.sh']` or `['scripts/grpo.sh']`.
- stdout passes through Phase 2's `parseTrainLine` unchanged — scripts MUST NOT inject their own log lines that pattern-match `Iter N: Train loss X` or `Iter N: Reward X`.

<!-- CONTEXT.md locked decisions -->
- D: bash only, zero `.py` authored (CONTEXT §"Script Authoring").
- D: Path A R1 built-ins via `--reward-weights` (CONTEXT §"GRPO Reward Function").
- D: Checkpoint cadence `--save-every 100` for SFT (CONTEXT §"Grad Clipping").
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: scripts/_lib.sh — shared env helper</name>
  <files>scripts/_lib.sh</files>
  <read_first>
    - scripts/grpo-smoke.sh (from 05-01 — reuse the venv-activate + WANDB pattern)
    - scripts/micro-bench.sh (Phase 1 — existing bash style to mirror)
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Common Pitfalls P2" (wandb hard-import)
  </read_first>
  <action>
Create `scripts/_lib.sh`. This file is SOURCED (not executed) by train.sh and grpo.sh. Body:
```bash
#!/usr/bin/env bash
# scripts/_lib.sh — shared env setup for Phase 5 training scripts.
# Sourced by scripts/train.sh and scripts/grpo.sh. Do NOT `exec` from here.

set -euo pipefail

# Always cd to repo root (one level up from scripts/)
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Activate the Phase 1 venv
if [ -z "${VIRTUAL_ENV:-}" ]; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
fi

# wandb is a hard-import of mlx-lm-lora; keep it offline (RESEARCH.md P2)
export WANDB_MODE="${WANDB_MODE:-offline}"

# Unbuffered stdout so /api/train readline sees lines immediately
export PYTHONUNBUFFERED=1

# Default adapter output dir — a separate path from Phase 1's bench adapter
: "${ADAPTER_DIR:=data/training/model-a-adapter}"
: "${MODEL:=unsloth/gemma-4-E4B-it-UD-MLX-4bit}"

mkdir -p "$ADAPTER_DIR"
```

No shebang-based execution — the file is `source`d by callers. Mark it executable anyway (`chmod +x`) so a developer running `./scripts/_lib.sh` for a sanity check at least prints the echo (if any) without an ENOEXEC error.
  </action>
  <verify>
    <automated>test -f scripts/_lib.sh && grep -n "WANDB_MODE" scripts/_lib.sh && grep -n "PYTHONUNBUFFERED=1" scripts/_lib.sh && grep -n "ADAPTER_DIR" scripts/_lib.sh && bash -n scripts/_lib.sh</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/_lib.sh` exists and `bash -n scripts/_lib.sh` exits 0 (syntax-clean)
    - Contains exact strings `WANDB_MODE`, `PYTHONUNBUFFERED=1`, `ADAPTER_DIR`, `VIRTUAL_ENV`
    - Does NOT contain `exec ` (must not be a forwarder)
    - Contains `set -euo pipefail`
  </acceptance_criteria>
  <done>Sourceable helper ready; train.sh and grpo.sh can rely on `.venv`, WANDB_MODE, PYTHONUNBUFFERED, ADAPTER_DIR, MODEL.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: scripts/train.sh — SFT wrapper (TRN-01) + optional adapter_config.json</name>
  <files>scripts/train.sh, data/training/model-a-adapter/adapter_config.json</files>
  <read_first>
    - scripts/_lib.sh (just created)
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md (RANK_STRATEGY, RANK_FLAG_NAME if cli strategy, exact adapter_config.json shape if config strategy)
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Pattern 1: SFT scripts/train.sh" and §Pitfall P8
    - PRD_SPEC.md §6.2 (SFT hyperparams)
    - data/bench/rank-help.log (exact flag names available)
  </read_first>
  <action>
1. If RANK_STRATEGY=config (from 05-01-smoke-notes.md), create `data/training/model-a-adapter/adapter_config.json` with the exact JSON schema recorded in the smoke-notes. Minimum viable shape (verify against smoke-notes first — if it differs, USE THE SMOKE-NOTES VERSION):
```json
{
  "fine_tune_type": "lora",
  "num_layers": 16,
  "lora_parameters": {
    "rank": 16,
    "scale": 20.0,
    "dropout": 0.0,
    "keys": null
  }
}
```
If RANK_STRATEGY=cli, skip this file.

2. Create `scripts/train.sh` (chmod +x). Body:
```bash
#!/usr/bin/env bash
# scripts/train.sh — SFT LoRA on Gemma 4 E4B for Model A (TRN-01).
# Invoked by /api/train subprocess when mode==='sft'. Exec-style forwarder
# so SIGTERM from the Node supervisor reaches the Python child directly.
set -euo pipefail
# shellcheck source=_lib.sh
. "$(dirname "$0")/_lib.sh"

: "${DATA_DIR:=data/training}"
: "${ITERS:=400}"
: "${NUM_LAYERS:=16}"
: "${BATCH:=2}"
: "${SEQ_LEN:=1024}"
: "${LR:=1e-5}"
: "${SAVE_EVERY:=100}"
: "${STEPS_PER_REPORT:=5}"
: "${RESUME_ADAPTER:=}"    # optional; set on rollback respawn

ARGS=(
  --model            "$MODEL"
  --train
  --data             "$DATA_DIR"
  --iters            "$ITERS"
  --num-layers       "$NUM_LAYERS"
  --batch-size       "$BATCH"
  --max-seq-length   "$SEQ_LEN"
  --learning-rate    "$LR"
  --grad-checkpoint
  --save-every       "$SAVE_EVERY"
  --steps-per-report "$STEPS_PER_REPORT"
  --adapter-path     "$ADAPTER_DIR"
)

# RANK_STRATEGY=cli → append `$RANK_FLAG` 16 where RANK_FLAG comes from
# 05-01-smoke-notes.md's RANK_FLAG_NAME (one of --rank | --lora-rank, observed
# from `mlx_lm.lora --help`). The caller (/api/train or the operator) MUST
# export RANK_FLAG=$RANK_FLAG_NAME before invoking this script when
# RANK_STRATEGY=cli. The default below is a safe fallback matching the most
# common spelling; the smoke-notes value wins via env override.
# If 05-01 chose RANK_STRATEGY=config, adapter_config.json already carries
# rank=16 and we add nothing here.
if [ "${RANK_STRATEGY:-config}" = "cli" ]; then
  RANK_FLAG="${RANK_FLAG:---rank}"
  ARGS+=("$RANK_FLAG" 16)
fi

if [ -n "$RESUME_ADAPTER" ]; then
  ARGS+=(--resume-adapter-file "$RESUME_ADAPTER")
fi

exec python -u -m mlx_lm lora "${ARGS[@]}"
```

Notes:
- `exec` (not `python ...`) so the Python PID == the bash PID's successor → SIGTERM from `/api/train`'s supervisor kills mlx_lm directly.
- `--grad-clip` is intentionally ABSENT (RESEARCH §Pitfall P3 — flag does not exist).
- `RESUME_ADAPTER` is how plan 05-03's rollback util respawns: it sets the env var, spawn happens again.
- DATA_DIR defaults to `data/training` — Phase 4 ships `training.jsonl` (+ optional valid.jsonl) into that directory. For E2E dry-run without Phase 4, operator sets `DATA_DIR=data/bench` and reuses the 16/4 split.
  </action>
  <verify>
    <automated>test -x scripts/train.sh && bash -n scripts/train.sh && grep -n "mlx_lm lora" scripts/train.sh && grep -n "exec python" scripts/train.sh && grep -n -- "--save-every" scripts/train.sh && grep -n "400" scripts/train.sh && grep -n "adapter-path" scripts/train.sh && ! grep -n -- "--grad-clip" scripts/train.sh && { if grep -qE '^RANK_STRATEGY=cli' .planning/phases/05-train-model-a/05-01-smoke-notes.md; then grep -n 'RANK_FLAG="\${RANK_FLAG:---rank}"' scripts/train.sh && grep -n 'ARGS+=("\$RANK_FLAG" 16)' scripts/train.sh; else test -f data/training/model-a-adapter/adapter_config.json && grep -n '"rank"' data/training/model-a-adapter/adapter_config.json; fi; }</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/train.sh` is executable and `bash -n` exits 0
    - Contains exact strings `exec python`, `mlx_lm lora`, `--save-every`, `--adapter-path`, `--iters`, `400`
    - Contains `--grad-checkpoint` (memory opt) but NOT `--grad-clip` (nonexistent)
    - Sources `scripts/_lib.sh`
    - Handles `$RESUME_ADAPTER` env var (grep finds `--resume-adapter-file` under the `if` branch)
    - If smoke-notes RANK_STRATEGY=config: `data/training/model-a-adapter/adapter_config.json` exists and contains `"rank": 16`
    - If smoke-notes RANK_STRATEGY=cli: `scripts/train.sh` contains the data-driven pattern `RANK_FLAG="${RANK_FLAG:---rank}"` and `ARGS+=("$RANK_FLAG" 16)` — NOT a hand-edited `--rank 16` / `--lora-rank 16` literal with a "replace me" comment. Caller passes `RANK_FLAG=$RANK_FLAG_NAME` (from 05-01-smoke-notes.md) via env.
  </acceptance_criteria>
  <done>SFT wrapper is reproducible from the CLI (`bash scripts/train.sh` with MODEL/DATA_DIR set) and SIGTERM-safe.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: scripts/grpo.sh — GRPO Path A wrapper (TRN-02) with Path C short-circuit</name>
  <files>scripts/grpo.sh</files>
  <read_first>
    - scripts/_lib.sh (just created)
    - scripts/train.sh (just created — flag-style mirror)
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md (FINAL_GRPO_ITERS, REWARD_WEIGHTS)
    - .planning/phases/05-train-model-a/05-RESEARCH.md §"Pattern 2: GRPO scripts/grpo.sh — Path A" and §"GRPO Decision Matrix Path C"
    - PRD_SPEC.md §6.2 (GRPO hyperparams)
  </read_first>
  <action>
Create `scripts/grpo.sh` (chmod +x). Body:
```bash
#!/usr/bin/env bash
# scripts/grpo.sh — GRPO Path A (built-in R1 rewards) on top of SFT adapter (TRN-02).
# Path C kill-point: if ITERS=0, log the skip marker and exit 0. The supervisor
# interprets the marker as "grpo.skipped" and narrates Tier 2 — SFT-only ship.
set -euo pipefail
# shellcheck source=_lib.sh
. "$(dirname "$0")/_lib.sh"

: "${DATA_DIR:=data/training/grpo}"
: "${ITERS:=75}"                      # ← overwritten by caller or env with FINAL_GRPO_ITERS from 05-01
: "${GROUP:=4}"
: "${MAX_COMPLETION:=512}"
: "${LR:=5e-6}"
: "${SAVE_EVERY:=50}"
: "${STEPS_PER_REPORT:=5}"
# Order: [accuracy, int, strict_format, soft_format]  (mlx_lm_lora/train.py:598-644)
: "${REWARD_WEIGHTS:=[2.0,0.0,0.5,0.0]}"

if [ "$ITERS" -le 0 ]; then
  # Path C: emit a line the Node supervisor's parser recognizes as a kill-point marker.
  # MUST NOT match Phase 2's /Iter\s+\d+:\s+(Train loss|Reward)\s+/ regex — keep the marker ASCII-distinct.
  echo "grpo.skipped reason=zero-iters (Path C kill-point from 05-01-smoke-notes.md)"
  exit 0
fi

RESUME="$ADAPTER_DIR/adapters.safetensors"
if [ ! -f "$RESUME" ]; then
  echo "grpo.skipped reason=no-sft-adapter path=$RESUME"
  exit 0
fi

ARGS=(
  --train-mode              grpo
  --model                   "$MODEL"
  --train
  --data                    "$DATA_DIR"
  --iters                   "$ITERS"
  --group-size              "$GROUP"
  --max-completion-length   "$MAX_COMPLETION"
  --learning-rate           "$LR"
  --grad-checkpoint
  --save-every              "$SAVE_EVERY"
  --steps-per-report        "$STEPS_PER_REPORT"
  --reward-weights          "$REWARD_WEIGHTS"
  --resume-adapter-file     "$RESUME"
  --adapter-path            "$ADAPTER_DIR"
)

exec python -u -m mlx_lm_lora.train "${ARGS[@]}"
```

Notes:
- Path C is baked into the script itself, so 05-04 does not need a separate code path: /api/train can always invoke `grpo.sh`; the skipped marker tells the supervisor to flip frontend pill to "SFT-only — Tier 2".
- `--resume-adapter-file` points at `adapters.safetensors` (the LATEST post-SFT adapter), not a numbered snapshot — per RESEARCH §Pitfall P7.
- No `--reward-fn` / `--reward-function` / `--reward-path` (RESEARCH §Pitfall P4 — does not exist).
- `MAX_COMPLETION=512` is the PRD default; a caller may override to 256 for stricter budget per 05-01 measurement.
- `ITERS` defaults to 75 as a conservative fallback; caller MUST set ITERS=`FINAL_GRPO_ITERS` from 05-01-smoke-notes.md in production.
  </action>
  <verify>
    <automated>test -x scripts/grpo.sh && bash -n scripts/grpo.sh && grep -n -- "--train-mode grpo\|--train-mode\s*grpo" scripts/grpo.sh && grep -n "exec python" scripts/grpo.sh && grep -n -- "--reward-weights" scripts/grpo.sh && grep -n -- "--resume-adapter-file" scripts/grpo.sh && grep -n "grpo.skipped" scripts/grpo.sh && ! grep -nE -- "--reward-fn|--reward-function|--reward-path" scripts/grpo.sh && ITERS=0 bash scripts/grpo.sh | grep -E "^grpo.skipped"</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/grpo.sh` is executable and `bash -n` exits 0
    - Contains exact strings `--train-mode`, `grpo`, `--reward-weights`, `--resume-adapter-file`, `grpo.skipped`, `exec python`
    - Does NOT contain any of `--reward-fn`, `--reward-function`, `--reward-path` (RESEARCH P4)
    - `ITERS=0 bash scripts/grpo.sh` exits 0 and prints a line starting with `grpo.skipped` (Path C)
    - When the SFT adapter is absent, also prints `grpo.skipped` and exits 0 (defensive)
  </acceptance_criteria>
  <done>GRPO wrapper supports Path A happy path AND Path C kill-point without any branch logic in /api/train.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| /api/train Node → bash script | Literal argv; no untrusted strings in flag values |
| bash script → Python subprocess | Exec-style forwarder; no shell interpolation of user input |
| Python subprocess → HF cache (read) | Cache already warm from Phase 1; no network during training |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-04 | Tampering | Env-var override injecting shell metacharacters into argv | mitigate | All env vars appear inside `"$ARR[@]"` quoted expansion; no `eval`; no command substitution from untrusted source |
| T-05-05 | DoS | grpo.sh spawns without a prior SFT adapter → writes fresh LoRA → training overshoots budget | mitigate | Explicit `[ ! -f "$RESUME" ]` guard → emit `grpo.skipped` and exit 0 |
| T-05-06 | Integrity | Rollback respawn without RESUME_ADAPTER → re-train from scratch silently | mitigate | 05-03 supervisor ALWAYS sets RESUME_ADAPTER to the rolled-back adapters.safetensors before respawn |
| T-05-07 | Information Disclosure | wandb sends training curves to cloud | mitigate | `WANDB_MODE=offline` exported in _lib.sh |
</threat_model>

<verification>
- `bash -n scripts/_lib.sh scripts/train.sh scripts/grpo.sh` all exit 0.
- `ITERS=0 bash scripts/grpo.sh` prints `grpo.skipped` and exits 0.
- `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` returns empty (CLAUDE.md A05).
- Manual (requires Phase 4 JSONL OR falls back to Phase 1 bench): `DATA_DIR=data/bench ITERS=20 bash scripts/train.sh 2>&1 | head -30` — produces `Iter N: Train loss X` lines that match Phase 2's `TRAIN_LOSS_RE`.
</verification>

<success_criteria>
- TRN-01 met: `scripts/train.sh` runs SFT per PRD §6.2 hyperparams (400 iters, 16 layers, rank 16, batch 2, seq 1024, LR 1e-5, save-every 100, steps-per-report 5). Phase 1 bench projects 2:54 — ≤12 min budget is safe.
- TRN-02 met: `scripts/grpo.sh` runs GRPO Path A with FINAL_GRPO_ITERS iters OR short-circuits to Path C; either outcome keeps wall-clock inside the 5-min TRN-02 budget.
</success_criteria>

<output>
After completion, create `.planning/phases/05-train-model-a/05-02-SUMMARY.md`. Include: exact flags chosen for train.sh (post RANK_STRATEGY resolution), FINAL_GRPO_ITERS imported from 05-01, and the Path C short-circuit tested output.
</output>
