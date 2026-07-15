# Phase 05-04 E2E Notes

## What Was Wired

- `/api/train` now invokes `bash scripts/train.sh` for SFT and `bash scripts/grpo.sh` for GRPO/skip-path instead of calling Python entrypoints directly.
- `TrainSupervisor` is active per request and can emit:
  - `rollback` on repeated NaN or large post-warmup spikes
  - `abort` after rollback budget exhaustion
  - `grpo.collapsed` on `grpo.skipped` markers or low-variance reward windows
- `lib/streams/trainParser.ts` now matches the measured GRPO output shape from `05-01-smoke-notes.md` by reading `Val total_rewards_mean`.

## Verified Locally

- `pnpm vitest run lib/streams/trainParser.test.ts lib/training/rollback.test.ts lib/training/supervisor.test.ts lib/training/transformGrpoJsonl.test.ts`
  - PASS
- `pnpm typecheck`
  - PASS
- `pnpm test`
  - PASS (114 tests / 22 files)
- `bash -n scripts/fuse.sh scripts/deploy-adapter.sh scripts/verify-device.sh scripts/train.sh scripts/grpo.sh scripts/_lib.sh`
  - PASS

## Phase 5 Reality Check

- `FINAL_GRPO_ITERS=0` remains the live decision from `05-01-smoke-notes.md`.
- Practical consequence: the GRPO button/path is a supervised skip that lands on the SFT-only Tier 2 fallback instead of attempting an OOM-prone live GRPO run on the M4 Pro 24 GB machine.
- `scripts/_lib.sh` now defaults to `RANK_STRATEGY=config` and writes `adapter_config.json` automatically when the adapter dir is created.

## Manual Next Steps

1. Produce `data/training.jsonl` and `data/eval.jsonl` if they are not already on disk.
2. Run SFT through `/api/train` or `bash scripts/train.sh`.
3. Use `bash scripts/fuse.sh --no-fuse` if you want the currently wired Swift LoRA directory path, or `bash scripts/fuse.sh` if you want a fused artifact staged as well.
4. Deploy with `bash scripts/deploy-adapter.sh`.
5. Verify on device with `bash scripts/verify-device.sh`.
