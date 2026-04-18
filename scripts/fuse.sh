#!/usr/bin/env bash
set -euo pipefail

BASE_MODEL="${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}"
ADAPTER_DIR="${ADAPTER_DIR:-data/training/model-a-adapter}"
OUT_DIR="${OUT_DIR:-data/fused/model-a}"
TOOLS_JSON="${TOOLS_JSON:-data/adapter-tools.json}"
NO_FUSE="${1:-}"

if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

mkdir -p "$OUT_DIR"

if [ "$NO_FUSE" = "--no-fuse" ]; then
  echo "[fuse] no-fuse fallback -> copying adapter payload"
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  cp "$ADAPTER_DIR"/adapter_config.json "$OUT_DIR"/
  cp "$ADAPTER_DIR"/adapters.safetensors "$OUT_DIR"/
else
  if [ ! -f "$ADAPTER_DIR/adapters.safetensors" ]; then
    echo "ERROR: adapter not found at $ADAPTER_DIR/adapters.safetensors"
    exit 1
  fi

  echo "[fuse] base=$BASE_MODEL adapter=$ADAPTER_DIR out=$OUT_DIR"
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"

  python -m mlx_lm.fuse \
    --model "$BASE_MODEL" \
    --adapter-path "$ADAPTER_DIR" \
    --save-path "$OUT_DIR"
fi

if [ -f "$TOOLS_JSON" ]; then
  cp "$TOOLS_JSON" "$OUT_DIR/adapter-tools.json"
fi

echo "[fuse] output contents:"
ls -lh "$OUT_DIR"
du -sh "$OUT_DIR"
