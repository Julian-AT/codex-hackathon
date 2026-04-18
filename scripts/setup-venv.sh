#!/usr/bin/env bash
# Idempotent Python 3.12 venv bootstrap for the MLX training toolchain.
#
# Deviation from plan: plan calls for `python3.12 -m venv .venv`, but
# python3.12 is not on this operator's PATH (only 3.13 via miniconda).
# `uv` is available, so we delegate the interpreter acquisition to uv.
# Override by exporting PYTHON=/path/to/python3.12 before running.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  if [ -n "${PYTHON:-}" ]; then
    "$PYTHON" -m venv .venv
  elif command -v uv >/dev/null 2>&1; then
    uv venv --python 3.12 .venv
  elif command -v python3.12 >/dev/null 2>&1; then
    python3.12 -m venv .venv
  else
    echo "ERROR: need python3.12 or uv on PATH (or set PYTHON env var)" >&2
    exit 1
  fi
fi

# shellcheck disable=SC1091
source .venv/bin/activate

PYVER=$(python -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [ "$PYVER" != "3.12" ]; then
  echo "ERROR: venv python is $PYVER, expected 3.12" >&2
  exit 1
fi

# `uv venv` does not install pip into the venv; use `uv pip` which installs
# into the active VIRTUAL_ENV directly. Fall back to ensurepip + pip if no uv.
if command -v uv >/dev/null 2>&1; then
  uv pip install -r requirements.txt
else
  python -m ensurepip --upgrade
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
fi

echo ""
echo "=== mlx_lm.lora --help (first 20 lines) ==="
mlx_lm.lora --help | head -20

echo ""
echo "=== mlx_lm_lora import check ==="
python -c "import mlx_lm_lora; print('mlx_lm_lora OK')"

echo ""
echo "Setup OK. Activate with: source .venv/bin/activate"
