# 05-01 Smoke Notes (canonical input for 05-02/05-03/05-04)

## Rank flag decision

Observed in `mlx_lm.lora --help` (captured at data/bench/rank-help.log):
- `--rank` flag present: NO
- Rank is set via `adapter_config.json` inside `--adapter-path` before training starts.

### Locked decision for scripts/train.sh (plan 05-02)
RANK_STRATEGY=config
RANK_FLAG_NAME=

### adapter_config.json schema (from mlx_lm/tuner/utils.py)
```json
{
  "rank": 16,
  "scale": 20.0,
  "dropout": 0.0
}
```

## Reward regex decision

Observed line(s) from data/bench/grpo-5iter.log:
```
Iter 1: Val loss 0.000, Val total_rewards_mean 0.000, Val total_rewards_std 0.000, Val grouped_rewards_mean 0.000, Val grouped_rewards_std 0.000, Val Average Generated Tokens 1.0, Val kl 0.000, Val r1_accuracy_reward_func_mean 0.000, Val r1_accuracy_reward_func_std 0.000, Val r1_int_reward_func_mean 0.000, Val r1_int_reward_func_std 0.000, Val r1_strict_format_reward_func_mean 0.000, Val r1_strict_format_reward_func_std 0.000, Val r1_soft_format_reward_func_mean 0.000, Val r1_soft_format_reward_func_std 0.000, Val r1_count_xml_mean 0.000, Val r1_count_xml_std 0.000, Val took 128.874s
```

### Locked regex for lib/streams/trainParser.ts (plan 05-04 patch)
REWARD_RE = /^Iter\s+(\d+):\s+Val loss\s+([\d.]+),\s+Val total_rewards_mean\s+([\d.]+)/
REWARD_SHAPE_MATCHES_PHASE2=NO

Phase 2 expected: `Iter N: Reward X` (simple single-reward line).
Actual: `Iter N: Val loss X, Val total_rewards_mean Y, ...` with per-function breakdown.
05-04 MUST patch `lib/streams/trainParser.ts` REWARD_RE to capture `total_rewards_mean` as the reward value.

## GRPO iter count decision

sec_per_iter (measured, 1 iter completed before OOM kill, group=4, max_completion=256) = 128.874
Process was OOM-killed (signal 9) after iter 1 -- GRPO loads BOTH training model AND reference model (~8GB total).

Budget: 5 min = 300 s. At 128.874 s/iter, only 2.3 iters would fit -- FAR under useful threshold.

FINAL_GRPO_ITERS=0

GRPO disabled -- Path C kill-point primed at plan entry.
GRPO is infeasible on M4 Pro 24 GB with the E4B model due to dual-model memory requirement causing OOM.
05-04 handles this: supervisor emits `grpo.collapsed`, frontend shows "SFT-only adapter -- Tier 2".

## Failure analysis

1. GRPO requires loading a reference model in addition to the training model (KL divergence computation).
2. E4B quantized model alone is ~4.2GB. Two copies + optimizer state + generation buffers exceed 24GB.
3. Even if memory were available, 128s/iter makes GRPO infeasible within the 5-min TRN-02 budget.
4. Path C (SFT-only adapter, Tier 2 narration) is the correct fallback per roadmap kill-point gates.
