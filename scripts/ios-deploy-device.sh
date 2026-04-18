#!/usr/bin/env bash
set -euo pipefail

# Deploys SpecialistApp (forked from mlx-swift-examples LLMEval) to a connected iPhone.
# Prereqs:
#   - Xcode 16 with the SpecialistApp scheme configured inside ios/_upstream/mlx-swift-examples.xcodeproj
#     (operator duplicates LLMEval target → SpecialistApp; see ios/SpecialistApp/OPERATOR.md)
#   - iPhone connected via USB-C with "Trust This Computer" granted
#   - Apple Developer signing configured for the SpecialistApp target
#   - IPHONE_UDID env var OR first device from `xcrun devicectl list devices` will be used
#   - BUNDLE_ID env var (default: com.hackathon.SpecialistApp)

BUNDLE_ID="${BUNDLE_ID:-com.hackathon.SpecialistApp}"
SCHEME="${SCHEME:-SpecialistApp}"
XCPROJ="${XCPROJ:-ios/_upstream/mlx-swift-examples.xcodeproj}"

echo "[deploy] listing devices"
xcrun devicectl list devices

UDID="${IPHONE_UDID:-}"
if [ -z "$UDID" ]; then
  UDID=$(xcrun devicectl list devices --json-output - 2>/dev/null \
    | /usr/bin/python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["devices"][0]["hardwareProperties"]["udid"])' \
    2>/dev/null || echo "")
fi
if [ -z "$UDID" ]; then
  echo "ERROR: set IPHONE_UDID from 'xcrun devicectl list devices' above"
  exit 1
fi
echo "[deploy] target UDID: $UDID"

echo "[deploy] building $SCHEME"
xcodebuild \
  -project "$XCPROJ" \
  -scheme "$SCHEME" \
  -destination "id=$UDID" \
  -configuration Debug \
  -derivedDataPath build/ios \
  build

APP_PATH=$(find build/ios/Build/Products/Debug-iphoneos -name "${SCHEME}.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then echo "ERROR: no .app built"; exit 1; fi
echo "[deploy] installing: $APP_PATH"

xcrun devicectl device install app --device "$UDID" "$APP_PATH"
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" || true

mkdir -p data/state
cat > data/state/ios-device.json <<EOF
{
  "udid": "$UDID",
  "bundle_id": "$BUNDLE_ID",
  "scheme": "$SCHEME",
  "deployed_at": "$(date -u +%FT%TZ)"
}
EOF
echo "[deploy] wrote data/state/ios-device.json"
