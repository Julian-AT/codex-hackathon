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
