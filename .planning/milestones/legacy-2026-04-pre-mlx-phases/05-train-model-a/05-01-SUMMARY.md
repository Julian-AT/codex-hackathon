---
phase: "05-train-model-a"
plan: "01"
subsystem: "training-smoke"
tags: [mlx-lm-lora, grpo, smoke-test, version-pin]
dependency_graph:
  requires: ["01-02"]
  provides: ["RANK_STRATEGY", "FINAL_GRPO_ITERS", "REWARD_RE"]
  affects: ["05-02", "05-03", "05-04"]
tech_stack:
  added: []
  patterns: ["GRPO Path C kill-point"]
key_files:
  created:
    - data/bench/rank-help.log
    - data/bench/grpo-5iter.log
    - data/training/grpo/smoke-train.jsonl
    - data/training/grpo/smoke-valid.jsonl
    - .planning/phases/05-train-model-a/05-01-smoke-notes.md
  modified:
    - CLAUDE.md
    - PRD_SPEC.md
    - scripts/grpo-smoke.sh
decisions:
  - "RANK_STRATEGY=config (no --rank CLI flag; use adapter_config.json)"
  - "FINAL_GRPO_ITERS=0 (OOM kill + 128s/iter makes GRPO infeasible on E4B)"
  - "REWARD_SHAPE_MATCHES_PHASE2=NO (actual format differs from Phase 2 assumption)"
  - "Path C kill-point primed: SFT-only adapter, Tier 2 narration"
metrics:
  duration: "535s"
  completed: "2026-04-18"
---

# Phase 05 Plan 01: Smoke and Version Bump Summary

GRPO OOM-killed after 1 iter at 128s; E4B dual-model exceeds 24GB -- Path C (SFT-only) locked, RANK_STRATEGY=config via adapter_config.json.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Bump mlx-lm-lora pin 0.1.0 to 0.1.9 | 37d0458 | Done |
| 2 | Capture rank-help.log, decide rank strategy | e3c51e2 | Done |
| 3 | 5-iter GRPO smoke, lock reward regex + iter count | 78ee134 | Done |

## Decisions Made

1. **RANK_STRATEGY=config**: `mlx_lm.lora --help` has no `--rank` flag. Rank must be set via `adapter_config.json` with `{"rank": 16, "scale": 20.0, "dropout": 0.0}`.

2. **FINAL_GRPO_ITERS=0**: GRPO loads both training and reference models. On E4B (4.2GB per model), dual-model + optimizer + generation buffers exceed 24GB M4 Pro RAM. Process OOM-killed (signal 9) after a single 128.874s iteration. Even without OOM, 128s/iter far exceeds the 5-min TRN-02 budget.

3. **REWARD_SHAPE_MATCHES_PHASE2=NO**: Actual GRPO stdout is `Iter N: Val loss X, Val total_rewards_mean Y, ...` with per-reward-function breakdown. Phase 2 assumed `Iter N: Reward X`. 05-04 must patch `trainParser.ts`.

4. **Path C kill-point primed**: SFT-only adapter ships as Tier 2. Scripts `grpo.sh` in 05-02 will be a no-op skip gate.

## Research Assumptions Resolved

| Assumption | Status | Finding |
|-----------|--------|---------|
| A1: GRPO stdout is "Iter N: Reward X" | MEASURED: FALSE | Actual: "Iter N: Val loss X, Val total_rewards_mean Y, ..." |
| A2: mlx_lm.lora has no --rank flag | MEASURED: TRUE | Rank via adapter_config.json |
| A3: GRPO sec/iter ~4-8s | MEASURED: FALSE | Actual: 128.874s/iter (16-32x higher than assumed) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Validation set too small for GRPO batch_size**
- Found during: Task 3
- Issue: `GRPODataset` requires `batch_size=4` minimum examples; initial valid set had 2
- Fix: Expanded smoke-valid.jsonl to 4 examples
- Files modified: data/training/grpo/smoke-valid.jsonl

**2. [Rule 3 - Blocking] Dataset filenames must be train.jsonl/valid.jsonl**
- Found during: Task 3
- Issue: `load_local_dataset` expects `train.jsonl` and `valid.jsonl`, not `smoke-train.jsonl`
- Fix: Created copies with standard names alongside smoke-prefixed originals
- Files modified: data/training/grpo/train.jsonl, data/training/grpo/valid.jsonl

## Self-Check: PASSED
