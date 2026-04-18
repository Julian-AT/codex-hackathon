#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source /Users/julianschmidt/Documents/GitHub/codex-hackathon/.venv/bin/activate
export WANDB_MODE=offline
export PYTHONUNBUFFERED=1

MODEL="unsloth/gemma-4-E4B-it-UD-MLX-4bit"
DATA="data/training/grpo"
OUT="data/bench/adapter-grpo-smoke"
mkdir -p "$OUT"

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
