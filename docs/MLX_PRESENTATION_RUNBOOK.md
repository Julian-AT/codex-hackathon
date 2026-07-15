# MLX Presentation Runbook

## Stage narrative

### Act 1 — My GitHub DNA

Show:

- selected repository count,
- public/private/internal mix without private names,
- authored commits,
- additions/deletions/churn,
- current SLOC,
- surviving attributed lines,
- languages over time,
- active days.

Explain that each metric has a definition and local Git is the source of truth.

### Act 2 — From history to evidence

Show the evidence funnel:

```text
repositories
→ commits/PRs/reviews
→ filtered semantic changes
→ reconstructed tasks
→ executable verification
→ deduplication
→ leakage-safe splits
→ Hugging Face configs
```

### Act 3 — What does “my style” mean?

Show preferences with:

- scope,
- confidence,
- support across repositories,
- counter-evidence,
- local exceptions.

Emphasize that formatting is usually repository-local; engineering choices are the stronger signal.

### Act 4 — The dataset

Open the Dataset Explorer and show:

- config names,
- explicit Features,
- Parquet shards,
- quality tiers,
- task mix,
- holdouts,
- one sanitized example,
- dataset card and fingerprint.

### Act 5 — Does it work?

Show the benchmark arena:

```text
E4B base
E4B base + developer profile
E2B/E4B tuned if available
```

Open one paired task and show tool trace, patch, tests, changed lines, latency, and outcome.

### Act 6 — Local and private

Disable network if rehearsed and demonstrate local Dataset loading/model inference. Explain which artifacts never leave the Mac.

## Visual rules

- 16:9, high contrast, large labels.
- No tiny source-code walls.
- One claim per view.
- `LIVE`, `REPLAY`, or `FIXTURE` badge always visible.
- Private repository names are pseudonymized.
- Present paired deltas and confidence intervals, not only a single score.

## Preflight checklist

```text
power connected
notifications off
network fallback known
Studio prebuilt
replay file checksummed
model already downloaded
selected repositories mirrored
private names redacted
benchmark worktrees clean
one live task rehearsed
offline fallback tested
```

## Demo commands

The final implementation should make these stable:

```bash
mlx metrics show --presentation
mlx dataset inspect --profile presentation
mlx benchmark compare --latest
mlx studio --presentation --replay <run-id>
mlx agent run --task <task-id>
```
