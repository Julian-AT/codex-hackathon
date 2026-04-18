---
phase: 6
plan: 1
type: execute
wave: 1
depends_on: ["05-02"]
files_modified:
  - scripts/fuse.sh
  - scripts/deploy-adapter.sh
autonomous: true
requirements: [TRN-05, TRN-06]
---

<objective>
Production fuse + deploy scripts. `fuse.sh` merges the Phase 5 SFT+GRPO adapter into fused weights. `deploy-adapter.sh` is updated to deploy both `adapter.safetensors` and `adapter-tools.json` to the iPhone.
</objective>

<tasks>

<task id="1" type="execute">
<title>Create scripts/fuse.sh</title>
<read_first>
- scripts/fuse-bench.sh
- scripts/deploy-adapter.sh
</read_first>
<files>scripts/fuse.sh</files>
<action>
Create `scripts/fuse.sh` based on `fuse-bench.sh` pattern:

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE_MODEL="${BASE_MODEL:-unsloth/gemma-4-E4B-it-UD-MLX-4bit}"
ADAPTER_DIR="${ADAPTER_DIR:-data/adapters/model-a}"
OUT_DIR="${OUT_DIR:-data/fused/model-a}"
TOOLS_JSON="${TOOLS_JSON:-data/adapter-tools.json}"
```

Key differences from fuse-bench.sh:
- Default ADAPTER_DIR points to `data/adapters/model-a` (Phase 5 output)
- Default OUT_DIR is `data/fused/model-a`
- After fuse, copy `adapter-tools.json` into the fused output dir: `cp "$TOOLS_JSON" "$OUT_DIR/adapter-tools.json"`
- Add no-fuse fallback check: if `--no-fuse` flag, skip fuse and copy adapter dir + tools directly to OUT_DIR
- Print size of output: `du -sh "$OUT_DIR"`
- Activate .venv if present
- Validate adapter exists before fusing
</action>
<acceptance_criteria>
- `scripts/fuse.sh` exists and is executable
- Running `bash -n scripts/fuse.sh` exits 0 (valid syntax)
- Script contains `mlx_lm.fuse` invocation
- Script contains `adapter-tools.json` copy step
- Script contains `--no-fuse` fallback path
</acceptance_criteria>
</task>

<task id="2" type="execute">
<title>Update deploy-adapter.sh for production deploy</title>
<read_first>
- scripts/deploy-adapter.sh
</read_first>
<files>scripts/deploy-adapter.sh</files>
<action>
Update `scripts/deploy-adapter.sh` to support Phase 6 production deploy:

1. Change default ADAPTER_DIR from `data/bench/adapter-50iter` to `data/fused/model-a`
2. Add TOOLS_JSON variable: `TOOLS_JSON="${TOOLS_JSON:-$ADAPTER_DIR/adapter-tools.json}"`
3. After adapter files copy loop, add `adapter-tools.json` copy:
```bash
if [ -f "$TOOLS_JSON" ]; then
  xcrun devicectl device copy to \
    --device "$UDID" --domain-type appDataContainer \
    --domain-identifier "$BUNDLE" \
    --source "$TOOLS_JSON" --destination "$DST_REL/adapter-tools.json"
fi
```
4. Update DST_REL default to `Documents/adapters/model-a`
5. Verify adapter-tools.json appears on device in the post-copy check
6. Keep backward compat: all existing env vars still work
</action>
<acceptance_criteria>
- `scripts/deploy-adapter.sh` contains `adapter-tools.json` copy step
- `bash -n scripts/deploy-adapter.sh` exits 0
- Default ADAPTER_DIR is `data/fused/model-a`
- Post-copy verification checks for adapter-tools.json on device
</acceptance_criteria>
</task>

</tasks>

<verification>
- `bash -n scripts/fuse.sh` passes
- `bash -n scripts/deploy-adapter.sh` passes
- `grep -q "adapter-tools.json" scripts/fuse.sh` succeeds
- `grep -q "adapter-tools.json" scripts/deploy-adapter.sh` succeeds
</verification>

<success_criteria>
- scripts/fuse.sh creates fused adapter + copies adapter-tools.json
- scripts/deploy-adapter.sh deploys adapter + tools to iPhone via devicectl
- No-fuse fallback path exists in fuse.sh
</success_criteria>

<must_haves>
- TRN-05: fuse.sh produces adapter.safetensors + no-fuse fallback verified
- TRN-06: deploy-adapter.sh copies adapter + adapter-tools.json to iPhone in <5s
</must_haves>
