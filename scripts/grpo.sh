#!/usr/bin/env bash
# scripts/grpo.sh — GRPO Path A (built-in R1 rewards) on top of SFT adapter (TRN-02).
# Path C kill-point: if ITERS=0, log the skip marker and exit 0. The supervisor
# interprets the marker as "grpo.skipped" and narrates Tier 2 — SFT-only ship.
set -euo pipefail
# shellcheck source=_lib.sh
. "$(dirname "$0")/_lib.sh"

: "${DATA_DIR:=data/training/grpo}"
: "${ITERS:=150}"
: "${GROUP:=4}"
: "${MAX_COMPLETION:=512}"
: "${LR:=5e-6}"
: "${SAVE_EVERY:=50}"
: "${STEPS_PER_REPORT:=5}"
# Order: [accuracy, int, strict_format, soft_format]  (mlx_lm_lora/train.py:598-644)
: "${REWARD_WEIGHTS:=[2.0,0.0,0.5,0.0]}"

if [ "$ITERS" -le 0 ]; then
  # Path C: emit a line the Node supervisor's parser recognizes as a kill-point marker.
  # MUST NOT match Phase 2's /Iter\s+\d+:\s+(Train loss|Reward)\s+/ regex.
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
