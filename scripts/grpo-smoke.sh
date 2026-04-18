#!/usr/bin/env bash
# Phase 1 GRPO flag-surface smoke (PITFALLS P2).
#
# Purpose is capture-only: mlx_lm_lora.train --help and a 5-iter dry-run
# so Phase 5 knows whether there is a CLI reward-fn flag or we need to
# bridge via shell. Non-zero exit is EXPECTED and actionable; we do not
# `set -e` around the training call.
set -uo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source .venv/bin/activate

if [ -f .env.base ]; then
  # shellcheck disable=SC1091
  source .env.base
fi
BASE_MODEL=${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}

echo "=== GRPO smoke: $BASE_MODEL ==="
mlx_lm_lora.train --help 2>&1 | tee data/bench/grpo-help.log | head -80

echo ""
echo "=== Attempting 5-iter GRPO dry-run ==="
mlx_lm_lora.train \
  --train-mode grpo \
  --model "$BASE_MODEL" \
  --data ./data/bench \
  --iters 5 \
  --group-size 4 \
  --max-completion-length 128 \
  --learning-rate 5e-6 \
  --adapter-path ./data/bench/adapter-50iter 2>&1 | tee data/bench/grpo-smoke.log
RC=${PIPESTATUS[0]}
echo "=== GRPO smoke exit: $RC ==="
if [ "$RC" -ne 0 ]; then
  echo "PITFALLS P2 TRIGGERED — capture reward-fn flag surface above."
  echo "Phase 5 chooses between CLI flag, shell bridge, or sanctioned .py carve-out."
fi
exit 0
