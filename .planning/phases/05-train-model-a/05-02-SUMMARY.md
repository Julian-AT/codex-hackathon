---
phase: 05-train-model-a
plan: 02
subsystem: training-scripts
tags: [bash, mlx-lm, sft, grpo, training]
dependency_graph:
  requires: [05-01-smoke]
  provides: [scripts/train.sh, scripts/grpo.sh, scripts/_lib.sh]
  affects: [05-03-supervisor, 05-04-integration]
tech_stack:
  added: []
  patterns: [exec-style-forwarder, env-var-override, path-c-kill-point]
key_files:
  created:
    - scripts/_lib.sh
    - scripts/train.sh
    - scripts/grpo.sh
  modified: []
decisions:
  - "RANK_STRATEGY=cli with --lora-rank flag (no smoke-notes; used speed_mode default)"
  - "FINAL_GRPO_ITERS=150 default (no smoke-notes override)"
  - "Path C short-circuit baked into grpo.sh itself"
metrics:
  duration: 94s
  completed: 2026-04-18T13:47:18Z
---

# Phase 05 Plan 02: Training Scripts Summary

SFT + GRPO bash wrappers with exec-style forwarders, env-var overrides, and Path C kill-point for grpo.sh.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | scripts/_lib.sh shared env helper | 0462161 | scripts/_lib.sh |
| 2 | scripts/train.sh SFT wrapper (TRN-01) | 90a192e | scripts/train.sh |
| 3 | scripts/grpo.sh GRPO Path A + Path C (TRN-02) | b767f5e | scripts/grpo.sh |

## Key Implementation Details

### scripts/_lib.sh
- Sources .venv, exports WANDB_MODE=offline, PYTHONUNBUFFERED=1
- Defaults ADAPTER_DIR=data/training/model-a-adapter, MODEL=unsloth/gemma-4-E4B-it-UD-MLX-4bit

### scripts/train.sh (TRN-01)
- Flags: --iters 400, --num-layers 16, --batch-size 2, --max-seq-length 1024, --learning-rate 1e-5
- --save-every 100, --steps-per-report 5, --grad-checkpoint
- Rank 16 via CLI flag --lora-rank (RANK_STRATEGY=cli default, no smoke-notes)
- RESUME_ADAPTER env var for rollback respawn (--resume-adapter-file)
- No --grad-clip (nonexistent in mlx-lm 0.31.2)

### scripts/grpo.sh (TRN-02)
- Flags: --train-mode grpo, --iters 150, --group-size 4, --max-completion-length 512, --learning-rate 5e-6
- --reward-weights [2.0,0.0,0.5,0.0] (R1 accuracy + strict_format)
- --resume-adapter-file points at SFT adapter output
- Path C: ITERS<=0 emits "grpo.skipped" marker and exits 0
- Defensive: missing SFT adapter also emits "grpo.skipped" and exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No smoke-notes.md from 05-01**
- **Found during:** Pre-execution
- **Issue:** 05-01-smoke-notes.md does not exist; plan depends on RANK_STRATEGY and FINAL_GRPO_ITERS from it
- **Fix:** Used speed_mode defaults: RANK_STRATEGY=cli with --lora-rank flag, FINAL_GRPO_ITERS=150
- **Files modified:** scripts/train.sh, scripts/grpo.sh

**2. [Rule 3 - Blocking] adapter_config.json not created**
- **Found during:** Task 2
- **Issue:** Plan says create adapter_config.json only if RANK_STRATEGY=config. Since defaulting to cli, skipped.
- **Fix:** No adapter_config.json needed; rank handled via --lora-rank CLI flag.

## Verification

- `bash -n scripts/_lib.sh scripts/train.sh scripts/grpo.sh` -- all exit 0
- Path C test: `ITERS=0` logic emits "grpo.skipped" and exits 0
- No .py files authored (CLAUDE.md constraint satisfied)
- No --grad-clip, --reward-fn, --reward-function, --reward-path (all nonexistent flags excluded)

## Self-Check: PASSED
