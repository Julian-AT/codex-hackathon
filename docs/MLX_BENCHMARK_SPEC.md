# MLX PersonalBench Specification

## 1. Purpose

MLX PersonalBench measures whether a model has learned transferable engineering behavior from the MLX dataset rather than memorizing source files.

The benchmark compares models on the same tasks, tools, context budget, step budget, checks, and hardware policy.

---

## 2. Benchmark suites

### 2.1 RepoTaskBench

Repository-level implementation and repair tasks executed in disposable worktrees.

Task sources:

- whole-repository holdouts,
- temporal holdouts,
- future real tasks,
- verified synthetic regressions.

Primary metric: `resolved@1`.

### 2.2 NavBench

Given a task and repository interface, identify relevant files, symbols, checks, and configuration.

Metrics:

- file Recall@1/3/5,
- symbol Recall@k,
- MRR,
- irrelevant-read rate,
- context tokens consumed.

### 2.3 StyleBench

Pairwise choice between two valid or partially valid patches, where one better matches accepted repository patterns.

Metrics:

- pairwise accuracy,
- calibration,
- Bradley–Terry score,
- human agreement on a sampled subset.

### 2.4 GeneralizationBench

Tasks from repositories completely absent from dataset training and preference extraction.

### 2.5 TemporalBench

Later tasks from repositories whose older history was available during training.

### 2.6 FutureBench

Tasks created after the source snapshot. Maintain this as a growing, never-trained-on suite.

---

## 3. Compared variants

Minimum experiment matrix:

```text
E2B base
E4B base
E4B base + developer profile card
E2B tuned
E4B tuned
E4B tuned + developer profile card
```

Optional:

- another local coding model of comparable memory,
- a stronger local model if hardware permits,
- API models only on public/redacted tasks and with explicit approval.

This matrix separates:

- base model ability,
- prompt/profile conditioning,
- fine-tuning gain,
- combined gain.

---

## 4. Native execution harness

Each RepoTaskBench task runs in a fresh disposable worktree at `base_sha`.

The model receives:

- task prompt,
- fixed tool schemas,
- bounded step/token budgets,
- repository-approved checks.

It does not receive:

- reference patch,
- future commit contents,
- hidden test source unless intentionally part of the environment,
- sibling solutions.

After completion, the harness records:

- generated patch,
- files changed,
- tool trace,
- check results,
- process outputs,
- timing,
- token usage,
- peak memory,
- cleanup status.

The harness must clean orphan processes and worktrees after success, failure, cancellation, or crash.

---

## 5. Scoring

### 5.1 Execution metrics

- patch applies,
- syntax/parse pass,
- build pass,
- typecheck pass,
- lint pass,
- fail-to-pass tests,
- pass-to-pass regressions,
- resolved@1.

### 5.2 Quality metrics

- unnecessary changed lines,
- changed-file precision,
- dependency additions,
- formatter conformity,
- repository preference score,
- security/policy violations.

### 5.3 Efficiency metrics

- wall-clock time,
- tokens in/out,
- tool calls,
- file reads,
- average and p95 latency,
- peak memory,
- generated tokens per second.

### 5.4 Presentation composite

A presentation-only `MLX Score` may be shown, but component metrics remain visible.

Suggested initial formula:

```text
50% execution success
20% preference alignment
15% localization
10% efficiency
 5% safety and policy compliance
```

Do not use the composite as the sole scientific conclusion.

---

## 6. Statistical reporting

For paired tasks:

- bootstrap 95% confidence intervals for means and success rates,
- paired task-level deltas,
- McNemar’s test for pass/fail model comparisons,
- Bradley–Terry estimates for pairwise patch preferences,
- effect sizes and task counts,
- missing/error categories reported separately.

Do not report tiny benchmark differences as meaningful without uncertainty.

---

## 7. Benchmark integrity

Each result stores:

- benchmark version,
- task fingerprint,
- repository/base snapshot,
- model/adapter/tokenizer/chat-template IDs,
- developer profile version,
- tool and prompt versions,
- hardware/software versions,
- seed and sampling parameters,
- check registry,
- full observable trace,
- score breakdown.

Run a contamination/leakage audit before publishing results.

---

## 8. Hugging Face and LightEval integration

- Store benchmark tasks in the dataset `benchmark` config.
- Store sample-level results as Parquet.
- Implement a LightEval custom task/model adapter for metrics that fit its interface.
- Keep repository worktree execution in the native MLX harness.
- Generate Hugging Face model-card `eval_results` metadata from signed result manifests.

---

## 9. Public sanity benchmarks

MLX PersonalBench is primary. Add a small public coding sanity suite to detect catastrophic general degradation.

Candidates must be selected after current license and runner compatibility research. Full SWE-bench is not required for the event and is too operationally heavy as a first local acceptance suite.

Report personal and public benchmarks separately.

---

## 10. Event benchmark floor

For July 16, 2026:

- 20–50 held-out tasks,
- at least two repositories or one whole-repository holdout plus temporal tasks,
- E4B base vs E4B base+profile,
- tuned E2B or E4B only if a real adapter is available,
- paired sample-level results,
- visible checks and confidence intervals,
- one live task execution and a replay fallback.
