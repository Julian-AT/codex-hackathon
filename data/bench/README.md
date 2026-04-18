# data/bench/

Throw-away micro-bench data for Phase 1 H0 kill-point (FND-02).

- `bench.jsonl` — 20 hand-written math Q&A pairs in mlx-lm `tools` format.
  Purpose: exercise the tokenizer + training loader with the *minimum*
  well-formed input so the 50-iter LoRA run measures memory/throughput
  without being starved.
- **NOT training data.** Phase 4 produces the real corpus in `data/training/`.
- **Not committed adapters.** `adapter-50iter/` is git-ignored (`*.safetensors`).

Note: if `mlx_lm.lora --data ./data/bench` complains about missing
`train.jsonl` / `valid.jsonl`, the bench script will surface that at T2
and we'll split `bench.jsonl` accordingly — cheaper to discover via the
real CLI than to guess here.
