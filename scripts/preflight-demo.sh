#!/usr/bin/env bash
set -euo pipefail

mkdir -p data/state data/cassette

echo "======================================================="
echo " PHASE 8/9 - POLISH + PRE-FLIGHT CHECKLIST"
echo "======================================================="
echo
echo "[POL-01] iPhone lockdown"
echo "  - Airplane mode ON"
echo "  - Wi-Fi OFF"
echo "  - Bluetooth OFF"
echo "  - Cellular OFF"
echo "  - Guided Access armed"
echo
echo "[POL-02] Mirror pipeline"
echo "  - USB-C -> HDMI -> capture card connected"
echo "  - OBS sees the iPhone feed for >=10 minutes"
echo
echo "[Phase 9] Dry run"
echo "  - Run the 12-minute narration once from start to finish"
echo "  - Confirm the Tier-3 cassette path"
echo "  - Confirm adapter deploy path"
echo "  - Confirm eval/scoreboard assets are the ones you plan to show"
echo
read -r -p "Lockdown complete? (y/n): " LOCKDOWN
read -r -p "Mirror pipeline stable? (y/n): " MIRROR
read -r -p "Dry run completed? (y/n): " DRYRUN

if [ "$LOCKDOWN" != "y" ] || [ "$MIRROR" != "y" ] || [ "$DRYRUN" != "y" ]; then
  echo "Pre-flight incomplete. Fix the missing items before demo."
  exit 1
fi

cat > data/state/preflight-demo.json <<EOF
{
  "pol01": "PASS",
  "pol02": "PASS",
  "dry_run": "PASS",
  "checked_at": "$(date -u +%FT%TZ)"
}
EOF

echo "PASS: pre-flight checklist captured in data/state/preflight-demo.json"
