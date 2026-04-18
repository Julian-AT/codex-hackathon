---
phase: 6
plan: 3
type: execute
wave: 2
depends_on: ["06-01", "06-02"]
files_modified:
  - scripts/verify-device.sh
autonomous: false
requirements: [DEV-06, DEV-07]
---

<objective>
Run the on-device verification battery (kill-point DEV-06) and record the 90-second Tier-3 cassette (NEVER CUT DEV-07). This plan requires physical iPhone interaction.
</objective>

<tasks>

<task id="1" type="execute">
<title>Create verification battery script</title>
<read_first>
- scripts/deploy-adapter.sh
- PRD_SPEC.md (§14 H7 section, lines 534-542)
</read_first>
<files>scripts/verify-device.sh</files>
<action>
Create `scripts/verify-device.sh` — a checklist script that prints the 3 verification prompts to run on-device and collects pass/fail from the operator:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo " PHASE 6 — ON-DEVICE VERIFICATION BATTERY (DEV-06)"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Ensure: adapter loaded, airplane mode ON, app running"
echo ""
echo "PROMPT 1 (RLS policy — factual):"
echo "  'Write an RLS policy for a users table.'"
echo "  PASS: response mentions enable_rls, CREATE POLICY, auth.uid()"
echo ""
echo "PROMPT 2 (Schema tool call — tool invocation):"
echo "  'Show me the schema for the profiles table.'"
echo "  PASS: model emits <|tool_call|> with correct tool name, JSContext executes"
echo ""
echo "PROMPT 3 (Offline refusal — requiresNetwork:true):"
echo "  'What is the current Supabase service status?'"
echo "  PASS: tool returns offline error, model responds gracefully"
echo ""
read -p "All 3 prompts passed? (y/n): " RESULT
if [ "$RESULT" = "y" ]; then
  echo "✓ DEV-06 VERIFIED — kill-point passed"
  mkdir -p data/state
  echo '{"dev06":"PASS","verified_at":"'$(date -u +%FT%TZ)'"}' > data/state/verify-device.json
else
  echo "✗ DEV-06 FAILED — kill-point"
  echo "  If <3/5 prompts correct → demote to Tier 2"
  exit 1
fi
```
</action>
<acceptance_criteria>
- `scripts/verify-device.sh` exists and is executable
- Contains all 3 verification prompts from PRD §14 H7
- Writes `data/state/verify-device.json` on pass
- Exits non-zero on failure
</acceptance_criteria>
</task>

<task id="2" type="human_gate">
<title>Run verification battery on iPhone</title>
<action>
Operator runs the 3 verification prompts on the physical iPhone with adapter loaded and airplane mode ON:
1. RLS policy question → expect Supabase-specific answer
2. Schema tool call → expect tool_call token + JSContext execution
3. Offline refusal → expect graceful error message

Run `scripts/verify-device.sh` to record result.

Kill-point: if <3/5 correct, demote to Tier 2.
</action>
<acceptance_criteria>
- data/state/verify-device.json exists with dev06=PASS
</acceptance_criteria>
</task>

<task id="3" type="human_gate">
<title>Record Tier-3 cassette (NEVER CUT)</title>
<action>
Record 90-second screen capture of the verified demo:

1. Start QuickTime Player → New Screen Recording (or iOS Screen Recording)
2. Demo flow: show airplane mode → ask RLS question → show tool call → show offline refusal
3. Stop recording at ~90 seconds
4. Save to 3 locations:
   - Laptop: `data/cassette/tier3-cassette.mov`
   - USB stick: copy file
   - iPhone Photos: AirDrop before airplane mode (or record directly on iPhone)

This is DEV-07 — NEVER CUT. Must complete before any Phase 7 work begins.
</action>
<acceptance_criteria>
- `data/cassette/tier3-cassette.mov` exists on laptop
- File is >=10 seconds long (not empty/corrupt)
- At least 2 backup copies confirmed
</acceptance_criteria>
</task>

</tasks>

<verification>
- scripts/verify-device.sh passes bash -n syntax check
- data/state/verify-device.json contains dev06=PASS after battery
- data/cassette/tier3-cassette.mov exists and is non-empty
</verification>

<success_criteria>
- All 3 verification prompts pass on-device (DEV-06 kill-point)
- Tier-3 cassette recorded and triple-backed (DEV-07 NEVER CUT)
- Tier 2 guarantee established: verified working demo on device
</success_criteria>

<must_haves>
- DEV-06: Verification battery passes on device (RLS answer + tool call + offline refusal)
- DEV-07: 90-second cassette recorded + triple-backed before H8
</must_haves>
