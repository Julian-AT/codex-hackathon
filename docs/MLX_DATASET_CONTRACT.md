# MLX Hugging Face Dataset Contract

**Purpose:** Define the canonical schemas, configs, quality gates, split rules, and release artifacts for the MLX personal coding dataset.

---

## 1. Design goals

The dataset must be:

- useful through Hugging Face `datasets` without custom loading code,
- queryable as Parquet/Arrow,
- compatible with Dataset Viewer where privacy permits,
- directly compilable for TRL and MLX-LM,
- provenance-rich enough for scientific audit,
- split safely at repository/task/time boundaries,
- private by default,
- and extensible without breaking existing versions.

The canonical data is richer than any one training format. Training exports are derived views.

---

## 2. Versioning

Use two versions:

- `schema_version`: semantic schema version, e.g. `1.0.0`.
- `dataset_version`: immutable build version, e.g. `2026.07.16+<fingerprint>`.

A dataset fingerprint hashes:

- selected repository snapshots,
- identity mapping,
- extraction implementation revision,
- filters,
- prompts and model IDs,
- quality thresholds,
- dedup parameters,
- split manifest,
- feature schemas.

Never mutate a published dataset version in place.

---

## 3. Hugging Face repository layout

```text
README.md
croissant.json
manifest.json
schemas/
  profile.schema.json
  evidence.schema.json
  sft.schema.json
  preference.schema.json
  benchmark.schema.json
profile/
  train-00000-of-00001.parquet
evidence/
  train-*.parquet
sft/
  train-*.parquet
  validation-*.parquet
  test-*.parquet
messages/
  train-*.parquet
  validation-*.parquet
  test-*.parquet
preference/
  train-*.parquet
  validation-*.parquet
  test-*.parquet
tools/
  train-*.parquet
  validation-*.parquet
  test-*.parquet
benchmark/
  repo_holdout-*.parquet
  temporal-*.parquet
  future-*.parquet
public_demo/
  train-*.parquet
```

Use reasonable Parquet shard sizes, normally 256 MB–2 GB for this project. Avoid thousands of tiny files.

---

## 4. Required configs

### 4.1 `profile`

One or a small number of profile snapshots.

Required fields:

```text
profile_id: string
schema_version: string
generated_at: timestamp
snapshot_id: string
dataset_fingerprint: string
metrics: Json
language_timeline: List(Json)
repository_summary: List(Json)
preferences: List(Json)
data_quality: Json
privacy: Json
```

### 4.2 `evidence`

Canonical evidence metadata. Raw code and patches may be omitted from a Hub export or stored as redacted fields depending on visibility policy.

Required fields:

```text
evidence_id: string
task_group_id: string
snapshot_id: string
repository_id: string
repository_visibility: class label
source_kind: class label
source_ref: string
base_sha: string | null
head_sha: string | null
timestamp: timestamp
paths: List(string)
languages: List(string)
intent: string | null
before_refs: List(string)
after_refs: List(string)
patch_ref: string | null
acceptance: Json
survival: Json
verification: Json
quality: Json
privacy: Json
provenance: Json
```

### 4.3 `sft`

TRL-friendly conversational prompt-completion examples.

Required fields:

```text
id: string
task_group_id: string
task_type: string
prompt: Json
completion: Json
tools: List(Json)
repository_id: string
language: string
quality_tier: string
quality_score: float32
metadata: Json
```

`prompt` and `completion` must be conversational message lists. This enables completion-only loss in TRL and deterministic conversion to model-specific chat templates.

### 4.4 `messages`

MLX-LM/chat-template-friendly examples.

```text
id: string
task_group_id: string
messages: Json
tools: List(Json)
metadata: Json
```

### 4.5 `tools`

Observable tool trajectories.

```text
id: string
task_group_id: string
messages: Json
tools: List(Json)
trajectory_summary: Json
verification: Json
metadata: Json
```

Tool arguments and schemas use the Hugging Face `Json()` feature where supported.

### 4.6 `preference`

```text
id: string
task_group_id: string
prompt: Json
chosen: Json
rejected: Json
preference_source: string
chosen_verification: Json
rejected_verification: Json
metadata: Json
```

### 4.7 `benchmark`

```text
task_id: string
task_group_id: string
suite: string
repository_id: string
base_sha: string
prompt: Json
tools: List(Json)
allowed_checks: List(Json)
expected: Json
reference_patch_ref: string | null
privacy: Json
metadata: Json
```

### 4.8 `public_demo`

Pseudonymized aggregate profile and explicitly approved sample examples only. No private repository names, source text, patches, emails, file paths that reveal organization details, or commit URLs.

### 4.9 Concrete Hugging Face feature direction

Use explicit `datasets.Features`. Arbitrary nested message/tool data should use the current `Json()` feature rather than unstable fixed dictionaries. A representative compiler shape is:

```python
from datasets import Features, Json, List, Value

sft_features = Features(
    {
        "id": Value("string"),
        "task_group_id": Value("string"),
        "task_type": Value("string"),
        "prompt": Json(),
        "completion": Json(),
        "tools": List(Json()),
        "repository_id": Value("string"),
        "language": Value("string"),
        "quality_tier": Value("string"),
        "quality_score": Value("float32"),
        "metadata": Json(),
    }
)
```

The exact schema implementation must be version-tested against the pinned `datasets` release.

### 4.10 Load and push acceptance

A release is not valid until these patterns work without custom loading code:

```python
from datasets import load_dataset

profile = load_dataset("parquet", data_files={"train": "profile/*.parquet"})
sft = load_dataset("parquet", data_files={"train": "sft/train-*.parquet"})
```

For a Hub release, the generated repository layout and metadata must support:

```python
profile = load_dataset("<owner>/<dataset>", "profile")
sft = load_dataset("<owner>/<dataset>", "sft")
```

Upload is private by default and explicit:

```python
dataset.push_to_hub(
    "<owner>/<dataset>",
    config_name="sft",
    private=True,
    max_shard_size="1GB",
)
```

The implementation must inspect current `hf --help` and library signatures rather than assuming these snippets are exact for every future version.

### 4.11 Dataset card metadata

Generate `README.md` with YAML metadata covering at least:

```yaml
pretty_name: MLX Personal Coding Dataset
task_categories:
  - text-generation
language:
  - en
tags:
  - code
  - software-engineering
  - tool-calling
  - preference-data
  - repository-level
configs:
  - config_name: profile
  - config_name: evidence
  - config_name: sft
  - config_name: messages
  - config_name: tools
  - config_name: preference
  - config_name: benchmark
  - config_name: public_demo
```

Do not declare a public redistribution license for private repository code. Use a documented custom/private usage policy and publish only content the operator is entitled to share.

---

## 5. Training task mix

Initial `core` sampling target:

```text
35% historical edit reconstruction
25% tool-use trajectories
15% navigation/context selection
10% test/debug tasks
10% review/preference pairs
 5% architecture/explanation tasks
```

This is a tunable baseline. Store the mix in the dataset manifest and run ablations.

Balance constraints:

- no single repository >15% of core examples by default,
- no single task group repeated across configs as independent examples without linkage,
- cap near-identical scaffolds,
- preserve meaningful language/framework coverage,
- upweight verified rare behaviors rather than simply common boilerplate.

---

## 6. Example creation rules

### 6.1 Historical edit

Input must contain only pre-change state and grounded task information.

Target may be:

- accepted patch,
- final assistant response,
- or a verified alternative patch.

Reject when:

- target diff appears in prompt,
- task cannot be inferred without future information,
- change is generated/vendor/format-only,
- patch is incoherently large,
- reference state cannot be reconstructed.

### 6.2 Navigation

Create positives and hard negatives. Measure whether the correct file/symbol/check is selected before code generation.

### 6.3 Tool trajectories

Store only observable turns and tool results. Convert a multi-step trajectory into prefix→next-assistant-action samples for SFT.

### 6.4 Test/debug

Prefer fail-before/pass-after checks. If only syntax or static checks are possible, preserve the lower verification tier.

### 6.5 Preference pairs

Strong sources:

- review-requested revision → accepted revision,
- failing candidate → passing candidate,
- reverted implementation → replacement,
- old implementation → deliberate refactor,
- generated candidate → human/agent corrected candidate.

Do not fabricate a rejected answer merely to fill the format unless it is generated and independently verified as meaningfully worse.

---

## 7. Context construction

Use selective retrieval, not indiscriminate full-repository dumps.

For each task record:

- candidate universe,
- selection method,
- selected paths/symbols,
- token counts,
- omitted relevant context if discovered later,
- retrieval rank of reference files.

Context levels:

```text
L0 instruction only
L1 local file window
L2 related symbols/files
L3 repository conventions/config
L4 tool-based open-repository task
```

Most SFT examples should be L1–L3; agent trajectories may use L4.

---

## 8. Size and token limits

Default caps, configurable by task type:

- instruction: 1,500 tokens,
- selected static context: 8,000 tokens for core compilation,
- target patch/answer: 4,000 tokens,
- changed lines per atomic task: target ≤400, hard review threshold 1,000,
- HF viewer row: keep well below infrastructure row-size limits,
- trajectory steps: default max 24,
- tool result: bounded and paginated.

Large coherent tasks may remain in the evidence config but be excluded from E4B SFT views.

---

## 9. Quality scoring

Keep individual components and thresholds. Suggested initial calibrated score:

```text
0.20 accepted_state
0.15 survival
0.25 verification
0.12 semantic_value
0.10 instruction_quality
0.08 context_sufficiency
0.07 uniqueness
0.03 recency_relevance
```

Privacy, schema integrity, and leakage are hard gates, not weighted components.

Default views:

```text
presentation: score ≥0.65, Q2+, small and inspectable
core:         score ≥0.72, Q2+, target majority Q3/Q4
full:         score ≥0.60 with explicit curriculum weights
benchmark:    Q3/Q4 preferred, no training overlap
```

Run sensitivity analyses before treating these thresholds as scientifically final.

---

## 10. Deduplication contract

Apply in this order:

1. exact object and normalized patch hash,
2. normalized task/instruction hash,
3. token-shingle MinHash,
4. AST/syntax fingerprint where supported,
5. embedding similarity only as a secondary candidate generator,
6. source-task and split-aware review.

Never remove a row solely because an embedding score is high without preserving the dedup decision and representative selection rationale.

Produce:

```text
dedup_report.json
dedup_clusters.parquet
cross_split_similarity_report.json
```

---

## 11. Split contract

Splits must be determined before synthetic variants are expanded.

Recommended top-level allocation:

- whole-repository holdout: 10–15% of selected training-eligible repositories,
- temporal holdout within remaining repos: latest 10–20% of meaningful task groups,
- validation: older task groups selected deterministically and stratified,
- training: remaining task groups,
- future: appended after snapshot.

Exact percentages may adapt to repository count, but holdouts may not be silently removed because the corpus is small.

Produce a `split_manifest.parquet` with reason and deterministic hash for every task group.

---

## 12. Privacy and licensing

Each repository has an export policy:

```text
local-only
private-hub
metadata-only
public-samples-approved
excluded
```

The dataset card must describe source rights and limitations. Do not imply that private source code is redistributable.

Before upload:

- secret scan,
- PII scan,
- source visibility check,
- license/policy check,
- exact upload preview,
- explicit confirmation.

Raw Codex/agent session traces may contain private code and credentials. They are local-only until sanitized. No hidden reasoning traces are included.

---

## 13. Validation suite

`mlx dataset validate` must check:

- schema and feature compatibility,
- Parquet readability,
- `load_dataset` for every config/split,
- row-size and shard sanity,
- no missing object references,
- no duplicated IDs,
- task-group split integrity,
- repository holdout isolation,
- temporal cutoff isolation,
- leakage and near-duplicate audit,
- secret/PII policy,
- tool-call schema validity,
- train/valid/test MLX-LM JSONL parsing,
- dataset card and Croissant metadata,
- manifest checksums.

Validation produces a signed/checksummed report and fails closed.

---

## 14. Release artifacts

Every release directory contains:

```text
README.md
manifest.json
quality_report.json
statistics.json
dedup_report.json
leakage_report.json
split_manifest.parquet
croissant.json
schemas/
parquet/
exports/
examples/
```

The README/dataset card includes:

- motivation,
- source scope,
- collection process,
- field definitions,
- configurations,
- filtering and quality tiers,
- split methodology,
- privacy and licensing,
- known limitations,
- intended and out-of-scope uses,
- reproducibility instructions,
- benchmark relationship,
- citation metadata.
