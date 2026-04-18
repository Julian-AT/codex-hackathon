---
phase: 01-foundation-smoke
plan: 02
status: complete
requirements: [FND-01, FND-02]
completed: 2026-04-18
---

# 01-02 SUMMARY — Python venv + 50-iter LoRA micro-bench

## Decision line (resume-signal)

`base_model=e4b peak_gb=6.311 sec_per_iter=0.434 grpo_reward_fn=bridge`

## FND-02 kill-point result

| Measure | Value | Kill-point | Verdict |
|---|---|---|---|
| Peak memory (E4B, 50 iters, LoRA, batch 2, 16 layers, max-seq 1024, grad-ckpt) | **6.311 GB** | 20 GB | **PASS — E4B stays** |
| Wall-clock | 32 s | — | |
| It/sec | 2.303 | — | |
| Tokens/sec | ~165 | — | |
| Sec/iter | **0.434 s** | — | 400-iter SFT projection ≈ 3 min |
| Trainable params | 7.725M / 7.518B = 0.103 % | — | |
| Final train loss | 0.102 | — | converging on trivia toy set |
| Final val loss | 0.412 | — | |

Artifact: `data/bench/adapter-50iter/adapters.safetensors` (31 MB).
Plan 01-04 will fuse this for hot-swap smoke.

**`.env.base` is NOT written.** Default E4B holds. Downstream plans read
this as the implicit default.

## GRPO reward-fn surface (PITFALLS P2 resolution)

`mlx_lm_lora.train --help` exposes GRPO-adjacent flags:
`--beta`, `--reward-scaling`, `--group-size`, `--max-completion-length`,
`--reward-weights`. **No `--reward-fn` / `--reward-function` / `--reward-path`.**

Interpretation: mlx-lm-lora 0.1.9 GRPO uses built-in reward functions
selected (or weighted) via `--reward-weights`, not a custom reward hook
via CLI. Phase 5 path:

1. **Preferred:** `--reward-weights` over the built-in rewards IF a built-in
   matches our schema-validity + tool-grounding need. Inspect
   `mlx_lm_lora.trainer.grpo_trainer` source to enumerate built-ins.
2. **Fallback (bridge):** author a shell wrapper that pre-generates
   completions, scores them with Node-side tool validator, then feeds
   the scored set back as a SFT-style preference file.
3. **Escalation:** if neither lands before the 20-minute training budget,
   request a sanctioned `.py` carve-out for a reward function module
   (PRD §19.4 allows this only with explicit PRD-owner sign-off).

The 5-iter GRPO dry-run failed with `ValueError: Unsupported data format
for GRPO training.` — expected: bench.jsonl is SFT `messages` format,
not GRPO prompt-only. Phase 5 will format a GRPO-shaped seed set.

## Deviations (4)

1. **`requirements.txt`: `mlx-lm-lora==0.1.9`** (plan + PRD §13 said `0.1.0`).
   The `0.1.0` release is not on PyPI; `0.1.6` explicitly excludes Python
   3.12. `0.1.9` is the earliest 0.1.x with py3.12 support. Documented
   here so PRD §13 can be patched to match reality.
2. **`requirements.txt`: added `wandb`.** `mlx-lm-lora==0.1.9` hard-imports
   `wandb` at module load even when `--wandb` is not passed; without it,
   `mlx_lm_lora.train --help` itself raises `ModuleNotFoundError`. wandb
   has an offline mode (`WANDB_MODE=offline`) so this does not compromise
   the airplane-mode story. Not pinned — wandb is incidental.
3. **`scripts/setup-venv.sh` uses `uv venv --python 3.12`** instead of
   the plan's literal `python3.12 -m venv`. `python3.12` is absent from
   this operator's PATH (miniconda 3.13 + shell-inherited env only); `uv`
   acquires 3.12 on demand. Plan allowed `PYTHON=/path` override; uv
   fallback is additive to that. Falls back to `python3.12` then to
   ensurepip if neither uv nor python3.12 is present.
4. **`data/bench/train.jsonl` + `valid.jsonl` created, not `bench.jsonl`.**
   mlx-lm's `load_dataset` requires `train.jsonl` (+ optional
   `valid.jsonl` / `test.jsonl`) in the data directory. The plan
   specified `bench.jsonl` as the single artifact; to satisfy both the
   plan (20-line bench committed) and the CLI, `bench.jsonl` is kept as
   the provenance file and split 16/4 into `train.jsonl` / `valid.jsonl`
   for mlx-lm to consume. All three are tracked with `-f` because
   `data/` is otherwise `.gitignore`d.

## Static verification

| Check | Result |
|-------|--------|
| `grep "mlx-lm\[train\]==0.31.2" requirements.txt` | ✅ |
| `grep "mlx-lm-lora==" requirements.txt` | ✅ (0.1.9, deviation doc'd) |
| `wc -l data/bench/bench.jsonl` → 20 | ✅ |
| `mlx_lm.lora --help` surfaces `--iters/--num-layers/--grad-checkpoint/--adapter-path/--max-seq-length` | ✅ |
| `python -c "import mlx_lm_lora"` | ✅ |
| `find . -name "*.py" -not -path "./.venv/*" -not -path "./node_modules/*"` | ✅ empty (A05 held) |
| `data/bench/adapter-50iter/adapters.safetensors` exists | ✅ 31 MB |
| `data/bench/e4b.log` contains `Peak mem` | ✅ |
| `data/bench/grpo-help.log` captured | ✅ |

## Weight download note

First HF fetch took 3:16 (9 files). Subsequent runs are cache hits (~0s).
No HF_TOKEN was needed for `unsloth/gemma-4-E4B-it-UD-MLX-4bit`. For the
demo H12 run, the model is already in `~/.cache/huggingface/` so airplane
mode is safe.

## Key files created

- `requirements.txt` (4 pins + wandb)
- `scripts/setup-venv.sh` (chmod +x, uv-first)
- `scripts/micro-bench.sh` (chmod +x, FND-02 kill-point baked in)
- `scripts/grpo-smoke.sh` (chmod +x, capture-only)
- `data/bench/bench.jsonl` (20 lines)
- `data/bench/train.jsonl` (16 lines, split from bench.jsonl)
- `data/bench/valid.jsonl` (4 lines)
- `data/bench/README.md`
- `data/bench/e4b.log`, `grpo-help.log`, `grpo-smoke.log`
- `data/bench/adapter-50iter/{adapter_config.json,adapters.safetensors}` (not committed; gitignored)

## Commits

- `3b2ab6d` feat(01-02/t1): python 3.12 venv + mlx-lm/mlx-lm-lora deps + 20-line bench jsonl (FND-01)
- (pending after this SUMMARY) feat(01-02/t2): 50-iter E4B LoRA bench + GRPO surface capture (FND-02)

## Self-Check: PASSED

- FND-01: venv + `mlx_lm.lora --help` + no authored `.py` ✅
- FND-02: peak memory measured (6.311 GB) and **well under** 20 GB kill-point ✅
- Adapter saved for plan 01-04 hot-swap ✅
- GRPO reward-fn surface captured — Phase 5 has an actionable path ✅
- Deviations documented (4) ✅

## For plan 01-04 (Adapter Hotswap)

- Base model: `unsloth/gemma-4-E4B-it-UD-MLX-4bit`
- Adapter: `data/bench/adapter-50iter/adapters.safetensors` (31 MB)
- Adapter config: `data/bench/adapter-50iter/adapter_config.json`
- Fuse via: `mlx_lm.fuse --model unsloth/gemma-4-E4B-it-UD-MLX-4bit --adapter-path data/bench/adapter-50iter --save-path data/fused-e4b-50iter`
- iOS deploys the fused weights, not the adapter; hot-swap test is two fused variants.

## For phase verification

- 400-iter projection: ~174 s (< 20 min training budget, huge margin).
- E4B held with >3× memory margin → no mid-phase base-model churn expected.
- Phase 5 entry cost: write the GRPO-format seed set + pick a built-in
  reward (or stand up the bridge) — no blockers from 01-02.
