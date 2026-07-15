# MLX Event Fast Track — July 16, 2026

This is an honest presentation slice, not a replacement for the full project roadmap.

## Goal

Demonstrate that MLX can turn real GitHub history into:

1. accurate engineering metrics,
2. an evidence-backed coding preference profile,
3. a Hugging Face-native dataset,
4. and a held-out model comparison.

## Scope

Select 3–5 repositories explicitly:

- one substantial TypeScript project,
- one smaller TypeScript project,
- one project with strong tests,
- one different-language project if useful,
- one repository or recent period as holdout.

Do not scan every private repository for the event build.

## Required artifacts

- real repository/commit/LOC/language metrics,
- 500–2,000 high-confidence examples,
- `profile`, `sft`, `messages`, and `benchmark` configs,
- local or private-Hub load test through Hugging Face `datasets`,
- a generated dataset card,
- a preference profile with evidence and counter-evidence,
- 20–50 held-out benchmark tasks,
- E4B base vs E4B base+profile comparison,
- optional tuned E2B smoke adapter,
- Studio presentation mode.

## Recommended sequence

```text
1. Rebrand and make current code honest.
2. Build deterministic metrics on selected repositories.
3. Extract commit/evidence records.
4. Build a small verified dataset.
5. Validate it with Hugging Face Datasets.
6. Generate the developer profile.
7. Build held-out benchmark tasks.
8. Run base vs base+profile.
9. Train only if time remains after data/eval are credible.
10. Record a replay and rehearse a live task.
```

## Presentation story

> “I did not fine-tune a model on a pile of files. I converted accepted engineering decisions into provenance-rich, executable, Hugging Face-native data—and then tested whether a small local model generalized to code it never saw.”

## Do not claim

- a final 50k dataset if only 1k rows were validated,
- tuned-model superiority without paired held-out results,
- live processing when replaying,
- private repository coverage that was not scanned,
- real MLX training if only the mock backend ran.

## Fallback ladder

1. Live metrics + live benchmark + recorded training.
2. Live metrics + replay benchmark + real result artifacts.
3. Fully replayed pipeline with one live Dataset load and one live model query.

Every replay is visibly labeled.
