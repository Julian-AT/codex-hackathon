#!/usr/bin/env bash
# Phase 1 H0 kill-point micro-bench (FND-02).
#
# Runs a 50-iter LoRA training pass on the pinned base model and logs
# sec/iter + peak memory to data/bench/{e4b|e2b}.log. If peak > 20 GB
# on E4B, operator must override:
#   echo 'BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit' > .env.base
#   ./scripts/micro-bench.sh
# and Phase 1 continues with E2B everywhere downstream.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source .venv/bin/activate

# .env.base lets downstream plans 01-03 / 01-04 read the pinned base model.
if [ -f .env.base ]; then
  # shellcheck disable=SC1091
  source .env.base
fi
BASE_MODEL=${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}

TAG=$(basename "$BASE_MODEL" | sed -E 's/.*(E[0-9]B).*/\1/' | tr 'A-Z' 'a-z')
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
echo ""
echo "If peak > 20 GB → switch to E2B:"
echo "  echo 'BASE_MODEL=unsloth/gemma-4-E2B-it-UD-MLX-4bit' > .env.base"
echo "  ./scripts/micro-bench.sh"
