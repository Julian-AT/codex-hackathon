#!/usr/bin/env bash
set -euo pipefail

echo "======================================================="
echo " PHASE 6 - ON-DEVICE VERIFICATION BATTERY (DEV-06)"
echo "======================================================="
echo
echo "Ensure: adapter loaded, airplane mode ON, app running."
echo
echo "PROMPT 1 (RLS policy - factual):"
echo "  Write an RLS policy for a users table."
echo "  PASS: mentions ENABLE ROW LEVEL SECURITY, CREATE POLICY, auth.uid()."
echo
echo "PROMPT 2 (Schema tool call - tool invocation):"
echo "  Show me the schema for the profiles table."
echo "  PASS: model emits a tool call and the JS tool result returns in app UI."
echo
echo "PROMPT 3 (Offline refusal - requiresNetwork:true):"
echo "  What is the current Supabase service status?"
echo "  PASS: tool returns the offline JSON error and the answer stays graceful."
echo
read -r -p "Did all 3 prompts pass? (y/n): " RESULT
if [ "$RESULT" = "y" ]; then
  mkdir -p data/state
  cat > data/state/verify-device.json <<EOF
{"dev06":"PASS","verified_at":"$(date -u +%FT%TZ)"}
EOF
  echo "PASS: DEV-06 verified."
else
  echo "FAIL: DEV-06 kill-point failed. Demote to Tier 2."
  exit 1
fi
