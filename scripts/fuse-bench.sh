#!/usr/bin/env bash
set -euo pipefail

# Fuses the 01-02 bench LoRA adapter into the base Gemma-4-E4B-4bit.
# Produces data/fused-e4b-50iter/ ready for on-device deploy.
#
# Base pin matches PRD §13 + 01-02 training base:
#   unsloth/gemma-4-E4B-it-UD-MLX-4bit
#
# Prereqs: .venv active with mlx-lm==0.31.2, adapter at data/bench/adapter-50iter/

BASE_MODEL="${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}"
ADAPTER_DIR="${ADAPTER_DIR:-data/bench/adapter-50iter}"
OUT_DIR="${OUT_DIR:-data/fused-e4b-50iter}"

if [ ! -f "$ADAPTER_DIR/adapters.safetensors" ]; then
  echo "ERROR: adapter not found at $ADAPTER_DIR/adapters.safetensors"
  exit 1
fi

# Activate venv if present
if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "[fuse] base=$BASE_MODEL adapter=$ADAPTER_DIR out=$OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

python -m mlx_lm.fuse \
  --model "$BASE_MODEL" \
  --adapter-path "$ADAPTER_DIR" \
  --save-path "$OUT_DIR"

echo "[fuse] output contents:"
ls -lh "$OUT_DIR"
du -sh "$OUT_DIR"
