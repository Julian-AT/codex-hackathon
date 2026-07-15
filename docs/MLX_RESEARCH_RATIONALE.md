# MLX Research Rationale

This document records the reasoning behind the dataset-first architecture. Implementation agents must re-check installed versions and current official documentation before pinning dependencies or command-line flags.

## Hugging Face Datasets

- Hugging Face Datasets is Arrow-backed and designed for efficient processing and Hub integration.
- Parquet is the preferred canonical exchange format for typed, viewer-compatible text datasets.
- Multiple dataset configs are appropriate for task-specific views with different schemas.
- Explicit Features improve compatibility and make mixed JSON/tool fields predictable.
- `Dataset.from_generator` supports memory-efficient construction.
- Dataset cards, YAML metadata, and viewer validation are part of a usable release, not optional polish.

Decision: canonical release as Parquet/Arrow with multiple configs and explicit Features.

## TRL and tool data

- TRL supports conversational prompt-completion, preference, and tool-calling datasets.
- Tool datasets use a `tools` column containing JSON schemas.
- Current Datasets versions provide `Json()` for arbitrary tool-call arguments.

Decision: preserve a canonical conversational prompt-completion config plus tools and preference configs rather than flattening everything to one text column.

## MLX-LM

- MLX-LM accepts local JSONL and Hugging Face datasets.
- It supports chat, tools, completion, and text formats.
- Quantized-model fine-tuning uses QLoRA.
- Prompt masking focuses loss on completion output, but long agent trajectories need prefix-to-next-action transformation so intermediate tool calls are supervised.

Decision: compile a dedicated MLX-LM export from the canonical Hugging Face dataset.

## Gemma 4

- E2B/E4B are designed for local execution and have native system-role and function-calling support.
- E4B is the main target; E2B is a lower-cost experimental model.
- The model’s nominal context window is much larger than the practical fine-tuning sequence length on a 24 GB Mac, so data examples must remain selective and bounded.

Decision: E2B ablations, E4B final experiment, 18 GB operational memory budget.

## Code history as data

Research such as CommitPack/OctoPack shows that commits naturally pair instructions with meaningful code changes; CommitPack was built at multi-terabyte scale across hundreds of programming languages. SWE-Gym demonstrates that a few thousand executable repository tasks can materially improve software-engineering agents, while SWE-smith demonstrates automated generation at roughly 50k-task scale. Large code corpora also show that near-deduplication materially affects model quality. Repository-level benchmarks demonstrate that task execution requires navigation, context selection, patching, and tests—not only code completion.

Decision: Git diffs and repository trajectories are the primary supervision; raw current files are optional supporting data.

## Selective context

Repository retrieval research shows that indiscriminate context can be noisy or harmful.

Decision: train navigation/context selection and track retrieval metrics. Do not dump entire repositories into prompts.

## Benchmarking

Hugging Face LightEval supports custom tasks, metrics, and backends, but repository-level execution requires a native worktree harness.

Decision: use a native MLX PersonalBench runner for executable tasks and optionally expose compatible metrics/tasks through LightEval.

## Data processing

Hugging Face DataTrove provides reusable large-scale filtering, statistics, and deduplication blocks.

Decision: integrate it selectively when it simplifies high-volume stages, but retain MLX-owned canonical schemas, provenance, and split logic.

## Croissant metadata

MLCommons Croissant standardizes machine-readable dataset metadata, provenance, and usage restrictions.

Decision: generate `croissant.json` for each dataset release.

## GitHub metrics

GitHub aggregate statistics endpoints may be cached, asynchronous, exclude merge commits, or impose repository-history limits. Local Git history is more complete for selected repositories.

Decision: use local mirrors for commit/line/blame metrics and GitHub APIs for repository/PR/review metadata.

## Recommended size

A small personal corpus does not benefit from arbitrary scale. The initial target is 25k–50k high-quality rows, with data-scaling ablations at 1k/5k/10k/25k/50k. Expand toward 100k only if held-out results continue improving.

Decision: quality and target tokens are first-class metrics; row count is not a success criterion.

## Research sources reviewed on July 15, 2026

Primary documentation:

- Hugging Face Datasets documentation: https://huggingface.co/docs/datasets/en/index
- Hugging Face dataset upload decision guide: https://huggingface.co/docs/hub/en/datasets-upload-guide-llm
- Hugging Face dataset cards: https://huggingface.co/docs/hub/en/datasets-cards
- TRL dataset formats: https://huggingface.co/docs/trl/en/dataset_formats
- TRL SFT Trainer: https://huggingface.co/docs/trl/en/sft_trainer
- Hugging Face LightEval: https://huggingface.co/docs/lighteval/en/index
- Hugging Face DataTrove: https://github.com/huggingface/datatrove
- MLCommons Croissant: https://mlcommons.org/working-groups/data/croissant/
- MLX-LM LoRA documentation: https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md
- Gemma 4 model card: https://ai.google.dev/gemma/docs/core/model_card_4
- SWE-bench official repository: https://github.com/SWE-bench/SWE-bench
- scc source-code counter: https://github.com/boyter/scc
- GSD Core: https://github.com/open-gsd/gsd-core

Research papers and benchmark references:

- OctoPack / CommitPack: instruction tuning from Git commits.
- The Stack and StarCoder2 data work: deduplication and diversified code sources.
- Repoformer: selective repository retrieval.
- SWE-bench, SWE-PolyBench, SWE-Gym, and SWE-smith: executable repository-level evaluation and synthetic task generation.

Implementation agents must prefer current official docs and installed CLI `--help` output over flags or versions written in this document.
