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
