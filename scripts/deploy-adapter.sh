#!/usr/bin/env bash
set -euo pipefail

# Copies the 01-02 bench LoRA adapter directory (adapter_config.json + adapters.safetensors)
# into the installed app's Documents/adapters/bench-50iter/ on-device so Swift
# LoRAContainer.from(directory:) can load it.
#
# mlx-swift-lm 3.x adapter API (verified in DerivedData):
#   LoRAContainer.from(directory: URL)  // requires BOTH files in the dir
#   try model.load(adapter: loRAContainer)
#
# Prereqs:
#   - 01-03 smoke passed (app installed, base model cached on-device)
#   - IPHONE_UDID + BUNDLE in env OR data/state/ios-device.json present

STATE=data/state/ios-device.json
UDID="${IPHONE_UDID:-}"
BUNDLE="${BUNDLE:-}"

if [ -f "$STATE" ]; then
  UDID="${UDID:-$(/usr/bin/python3 -c 'import json;print(json.load(open("'"$STATE"'"))["udid"])')}"
  BUNDLE="${BUNDLE:-$(/usr/bin/python3 -c 'import json;print(json.load(open("'"$STATE"'"))["bundle_id"])')}"
fi

if [ -z "$UDID" ] || [ -z "$BUNDLE" ]; then
  echo "ERROR: need IPHONE_UDID + BUNDLE (run 01-03 deploy first, or set env)"
  exit 1
fi

ADAPTER_DIR="${ADAPTER_DIR:-data/training/model-a-adapter}"
TOOLS_JSON="${TOOLS_JSON:-data/adapter-tools.json}"
HAS_LORA_DIR=1
for f in adapter_config.json adapters.safetensors; do
  if [ ! -f "$ADAPTER_DIR/$f" ]; then
    HAS_LORA_DIR=0
  fi
done

HAS_FUSED=0
if [ -f "$ADAPTER_DIR/adapter.safetensors" ]; then
  HAS_FUSED=1
fi

if [ "$HAS_LORA_DIR" -ne 1 ] && [ "$HAS_FUSED" -ne 1 ]; then
  echo "ERROR: $ADAPTER_DIR must contain either adapter_config.json + adapters.safetensors or adapter.safetensors"
  exit 1
fi

DST_REL="${DST_REL:-Documents/adapters/model-a}"

echo "[deploy-adapter] udid=$UDID bundle=$BUNDLE"
echo "[deploy-adapter] src_dir=$ADAPTER_DIR dst=$DST_REL"

START=$(/usr/bin/python3 -c 'import time;print(time.time())')
if [ "$HAS_LORA_DIR" -eq 1 ]; then
  for f in adapter_config.json adapters.safetensors; do
    xcrun devicectl device copy to \
      --device "$UDID" \
      --domain-type appDataContainer \
      --domain-identifier "$BUNDLE" \
      --source "$ADAPTER_DIR/$f" \
      --destination "$DST_REL/$f"
  done
fi
if [ "$HAS_FUSED" -eq 1 ]; then
  xcrun devicectl device copy to \
    --device "$UDID" \
    --domain-type appDataContainer \
    --domain-identifier "$BUNDLE" \
    --source "$ADAPTER_DIR/adapter.safetensors" \
    --destination "$DST_REL/adapter.safetensors"
fi
if [ -f "$TOOLS_JSON" ]; then
  xcrun devicectl device copy to \
    --device "$UDID" \
    --domain-type appDataContainer \
    --domain-identifier "$BUNDLE" \
    --source "$TOOLS_JSON" \
    --destination "$DST_REL/adapter-tools.json"
fi
END=$(/usr/bin/python3 -c 'import time;print(time.time())')
ELAPSED=$(/usr/bin/python3 -c "print(round($END-$START,2))")
echo "[deploy-adapter] copy elapsed=${ELAPSED}s"

# MANDATORY post-copy verification (PLAN PITFALLS P5: devicectl can silent-fail)
echo "[deploy-adapter] verifying on-device"
xcrun devicectl device info files \
  --device "$UDID" \
  --domain-type appDataContainer \
  --domain-identifier "$BUNDLE" \
  --domain-subpath "$DST_REL" \
  | tee /tmp/adapter-verify.txt

if [ "$HAS_LORA_DIR" -eq 1 ] && ! grep -q "adapters.safetensors" /tmp/adapter-verify.txt; then
  echo "ERROR: silent copy fail — adapters.safetensors not visible on-device"
  exit 2
fi
if [ "$HAS_LORA_DIR" -eq 1 ] && ! grep -q "adapter_config.json" /tmp/adapter-verify.txt; then
  echo "ERROR: silent copy fail — adapter_config.json not visible on-device"
  exit 2
fi
if [ "$HAS_FUSED" -eq 1 ] && ! grep -q "adapter.safetensors" /tmp/adapter-verify.txt; then
  echo "ERROR: silent copy fail — adapter.safetensors not visible on-device"
  exit 2
fi
if [ -f "$TOOLS_JSON" ] && ! grep -q "adapter-tools.json" /tmp/adapter-verify.txt; then
  echo "ERROR: silent copy fail — adapter-tools.json not visible on-device"
  exit 2
fi

# Kill-point check (FND-08 Tier 2 demote if copy > 3s)
if /usr/bin/python3 -c "import sys;sys.exit(0 if $ELAPSED>3.0 else 1)"; then
  echo "WARN: copy took ${ELAPSED}s > 3s kill-point — consider Tier 2 demote"
fi

mkdir -p data/state
cat > data/state/adapter-deploy.json <<EOF
{
  "udid": "$UDID",
  "bundle_id": "$BUNDLE",
  "adapter_src_dir": "$ADAPTER_DIR",
  "adapter_dst_dir": "$DST_REL",
  "tools_json": "$TOOLS_JSON",
  "copy_seconds": $ELAPSED,
  "deployed_at": "$(date -u +%FT%TZ)"
}
EOF
echo "[deploy-adapter] wrote data/state/adapter-deploy.json"
