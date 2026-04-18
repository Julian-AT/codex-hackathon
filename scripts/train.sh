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
: "${RESUME_ADAPTER:=}"

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

# Rank via CLI flag (default --lora-rank from speed_mode defaults).
# RANK_STRATEGY=config uses adapter_config.json instead (skip CLI flag).
if [ "${RANK_STRATEGY:-cli}" = "cli" ]; then
  RANK_FLAG="${RANK_FLAG:---lora-rank}"
  ARGS+=("$RANK_FLAG" 16)
fi

if [ -n "$RESUME_ADAPTER" ]; then
  ARGS+=(--resume-adapter-file "$RESUME_ADAPTER")
fi

exec python -u -m mlx_lm lora "${ARGS[@]}"
