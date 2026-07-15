# Technology Stack

**Project:** MLX — the personal coding dataset and model pipeline
**Research type:** Subsequent/brownfield stack research
**Researched:** 2026-07-15
**Overall confidence:** MEDIUM-HIGH

## Executive Recommendation

Build the target as two deliberately separate planes:

1. **Bun/TypeScript control plane** for the `mlx` CLI, configuration, repository selection, Git/GitHub orchestration, operational SQLite catalog, resumable jobs, fixed benchmark tools, loopback API, and Studio serving.
2. **Python data/model plane managed by uv** for explicit Hugging Face schemas, PyArrow/Parquet compilation, Polars transforms, DuckDB analytics, statistical reporting, MLX-LM training, and optional LightEval compatibility.

Parquet plus release manifests are the durable interface between the planes. SQLite is operational state, not the canonical evidence lake. JSONL is a derived MLX-LM export, not the canonical dataset. The canonical compiler owns schemas, provenance, task groups, deterministic splits, privacy results, and checksums before any trainer sees the data.

Use exact application pins in `bun.lock` and `uv.lock`. Version numbers below are the versions verified on 2026-07-15, not floating ranges to resolve on every install. Re-resolve intentionally and rerun the compatibility probes in this document before changing them.

## Recommended Stack

### Control Plane

| Technology | Target version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| Bun | 1.3.14 | Runtime, package manager, tests, subprocesses, local HTTP/SSE | Upgrade from installed 1.3.11 and pin the runtime. Bun already matches the brownfield code and provides direct TypeScript execution, `Bun.spawn`, `Bun.serve`, hashing, and `bun:sqlite`. | MEDIUM |
| TypeScript | 5.9.3 initially | Typed control plane | Keep the existing exact version through the architecture migration. TypeScript 7.0.2 is current on npm, but combining a language major upgrade with the storage/package migration is avoidable risk. Evaluate TS 7 only after the stable validation scripts pass. | HIGH |
| Node.js | 22.22.3 compatibility runtime | Vite/Playwright and ecosystem fallback | Bun remains the product runtime. Keep a Node 22 pin because Vite 8 requires Node 20.19+ or 22.12+ and some build/test tools publish Node-specific support statements. | MEDIUM |
| Ink | 5.2.1 during CLI migration; 7.1.0 target | Existing terminal UI | Preserve the working Ink 5 interface while establishing `mlx`, commands, and machine-readable output. Move to Ink 7/React 19 in a separate compatibility change; do not let terminal UI work block dataset foundations. | MEDIUM |
| Zod | 4.4.3 target | Runtime validation at TypeScript boundaries | Use Zod for config, API/event, job payload, and process-result validation. Migrate existing Zod 3 schemas behind tests, then remove `zod-to-json-schema` where Zod 4's JSON Schema support suffices. Published JSON Schemas remain versioned artifacts, not inferred ad hoc at runtime. | MEDIUM |
| Bun `fetch` and `Bun.serve` | Built in | GitHub requests where `gh` is insufficient; loopback API and SSE | Do not add Express or a network service framework initially. The API is local, small, and typed; SSE plus bounded JSON endpoints is enough. Bind explicitly to `127.0.0.1`. | HIGH |

### Operational State and Local Storage

| Technology | Target version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| SQLite via `bun:sqlite` | Runtime engine must be probed; target SQLite >=3.51.3 | Repositories, identities, snapshots, jobs, leases, runs, manifests, object metadata | Use prepared statements, transactions, `foreign_keys=ON`, `journal_mode=WAL`, a bounded `busy_timeout`, and persistent numbered SQL migrations with checksums. Keep one catalog owner/write connection and expose reads through the local API. See the mandatory WAL gate below. | MEDIUM |
| Numbered SQL migrations | Repository-owned | Database evolution | Prefer explicit `migrations/NNNN_name.sql` plus a migration ledger and checksum over an ORM-generated mutable schema. Test fresh install, every upgrade path, downgrade refusal, and interrupted migration recovery. | HIGH |
| SHA-256 content-addressed objects | Built in | Immutable source blobs, patches, traces, reports | Store bytes at `MLX_HOME/objects/sha256/<prefix>/<digest>`; write to a sibling temporary file, fsync, rename atomically, and verify digest on read. SQLite stores refs and metadata only. | HIGH |
| Parquet/Arrow | PyArrow 25.0.0 | Canonical analytical and dataset artifacts | Make immutable, versioned Parquet releases the cross-language boundary. Put evidence/examples/results in Parquet; keep exact schemas and checksums in release artifacts. | HIGH |
| DuckDB | 1.5.4 | Read-oriented analytics over Parquet | Query canonical Parquet directly for metrics, Studio aggregates, leakage reports, and result comparisons. Do not make DuckDB the job queue or source of operational truth. | HIGH |

#### Mandatory SQLite WAL Gate

This is a current upstream issue, not a theoretical concern:

- Bun 1.3.11 and the downloaded Bun 1.3.14 binary both reported embedded SQLite **3.51.0**.
- SQLite's official WAL documentation states that the WAL-reset corruption race affects versions through 3.51.2 and is fixed in 3.51.3.
- The race requires multiple connections in separate threads/processes and overlapping writes/checkpoints.

Therefore:

1. `mlx doctor` must execute `select sqlite_version()` and record the result.
2. Until Bun embeds SQLite >=3.51.3, MLX must enforce one catalog-owning process/connection, prevent a second writer with an atomic owner lock and stale-owner recovery, and route Studio/worker state access through that owner.
3. Do not run Python, Studio, or benchmark processes against the catalog directly.
4. Do not enable a multi-process writer topology merely because WAL normally permits concurrent readers.
5. Add a concurrency/recovery test and remove the restriction only after the runtime engine probe is fixed and the test passes.

`better-sqlite3` is not the fallback: a Bun 1.3.14 execution probe failed with Bun's explicit “not yet supported” native-addon error. A Homebrew SQLite dependency would also make the only user-facing `mlx` executable depend on an unpinned external binary. Stay on `bun:sqlite` with the ownership gate, then simplify when Bun upgrades its embedded engine.

### Python Data Compiler

Use a real package at `python/mlx_dataset/` with `pyproject.toml`, `.python-version`, and committed `uv.lock`.

| Technology | Exact version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| uv | 0.11.29 | Python acquisition, lock, sync, execution | Replace the pip fallback and loose `requirements.txt` path. Commit `uv.lock`; CI/local checks use `uv lock --check` and `uv sync --locked`. | HIGH |
| CPython | 3.13.14 | Compiler, validators, statistics, MLX-LM | Use the latest 3.13 maintenance release rather than legacy 3.12 or newly adopted 3.14. Current required packages support 3.13 and MLX publishes macOS arm64 cp313 wheels. | MEDIUM |
| `datasets` | 5.0.0 | HF configs, explicit Features, load/push validation | Owns `Features`, `Json()`, `List(Json())`, `Dataset.from_generator`, local `load_dataset`, and config-aware Hub layouts. It is the contract-level dataset API. | HIGH |
| `pyarrow` | 25.0.0 | Explicit schemas, Arrow tables, Parquet writing/inspection | Make PyArrow the schema-critical writer and validator. Write explicit types and timestamps; inspect every shard schema and metadata. | HIGH |
| `polars` | 1.42.1 | Lazy deterministic transforms and aggregations | Use `scan_parquet` and lazy expressions for evidence/metrics tables. Do not let Polars infer the canonical HF nested schema. | HIGH |
| `duckdb` | 1.5.4 | Analytical SQL and cross-artifact audits | Use read-only connections where possible and direct `read_parquet` queries. Record DuckDB version in reports. | HIGH |
| `huggingface-hub` | 1.23.0 | Authentication, private repository creation, explicit upload | Publication code must enumerate the exact release, run policy gates, show a preview, require confirmation, create private-by-default dataset repos, and only then upload. | HIGH |
| `jsonschema` | 4.26.0 | Validate versioned schemas and generated semantic outputs | Use Draft 2020-12 or one explicitly selected draft across package boundaries. Validation failures are hard failures, not warnings. | HIGH |
| `datasketch` | 2.0.0 | Token-shingle MinHash candidate generation | Fix shingle normalization, permutation count, seed, and thresholds in versioned config. Persist clusters and representative decisions. | MEDIUM |
| `mlcroissant` | 1.1.0 | Generate/validate Croissant metadata | Generate `croissant.json` from the same manifest and schema definitions as the dataset card; validate it during release. | MEDIUM |
| `numpy` | 2.5.1 | Bootstrap resampling and numerical summaries | Fix random seeds and persist sample-level results. Never derive scientific conclusions from only the presentation composite. | HIGH |
| `scipy` | 1.18.0 | Confidence intervals, paired tests, Bradley-Terry optimization support | Use for deterministic statistical routines and record function/method choices in the benchmark manifest. | HIGH |
| `statsmodels` | 0.14.6 | McNemar and supporting statistical tests | Use tested library implementations instead of ad hoc p-value code. Store contingency tables, task counts, effect sizes, and missing/error categories. | HIGH |
| `ruff` | 0.15.21 | Python lint/format | One fast Python quality tool, configured in `pyproject.toml`. | HIGH |
| `pytest` | 9.1.1 | Unit/integration tests for compiler and statistics | Include fixture repositories and golden manifests; use temporary directories, never live private repositories. | HIGH |

#### Verified Compiler Matrix

An isolated Python 3.13.7 smoke environment successfully installed and ran:

```text
datasets==5.0.0
pyarrow==25.0.0
polars==1.42.1
duckdb==1.5.4
huggingface-hub==1.23.0
```

The smoke created a `Features` schema containing `Json()` and `List(Json())`, wrote Parquet, loaded it with `load_dataset("parquet", ...)`, queried it with DuckDB, collected it with Polars, and verified the current `Dataset.push_to_hub` parameters `config_name`, `private`, and `max_shard_size`.

Polars warned that the `arrow.json` extension was not registered and loaded its storage type. That reinforces the ownership boundary: use Datasets/PyArrow for nested HF feature fidelity; use Polars for tabular transformation or explicitly tested storage-level reads.

### Hugging Face Dataset and Training Compatibility

| Technology | Exact version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| TRL | 1.8.0 | Validate derived SFT/tool/preference views | Use TRL's documented conversational prompt-completion, `messages` + `tools`, and `prompt/chosen/rejected` formats as compatibility tests. Do not reduce the canonical MLX rows to TRL's minimum columns. | HIGH |
| MLX-LM | 0.31.3 | Apple Silicon inference and LoRA/QLoRA | Upgrade the existing 0.31.2 pin by one patch only after capturing help and passing the real E2B/E4B smoke. Use official `mlx_lm lora`, `generate`, and `server` modules. | MEDIUM |
| MLX | 0.31.2 with MLX-LM 0.31.3 | Apple tensor runtime | Pin the upstream-paired minimum instead of silently accepting MLX 0.32.0. Move the pair together only after memory, checkpoint/resume, adapter load, and generation acceptance. | MEDIUM |
| Transformers | Locked compatible 5.x (current 5.14.0) | Tokenizer/chat template/model metadata | Let uv lock an exact 5.x version compatible with MLX-LM; record tokenizer revision and serialized chat-template config. Never float a tokenizer independently from the model run. | MEDIUM |
| LightEval | 0.13.0, optional group | Static/generative benchmark adapter | Export compatible custom tasks and sample metrics to LightEval. Keep disposable worktrees, allowlisted checks, orphan cleanup, and patch execution in native MLX PersonalBench. | HIGH |
| Gemma 4 E2B/E4B | Pin model repo plus immutable revision | Smoke/ablation and principal model | Use instruction-tuned checkpoints for agent/tool comparisons, e.g. `google/gemma-4-E2B-it` and `google/gemma-4-E4B-it`, and define “base” as the unadapted checkpoint condition. Persist exact Hub SHA, tokenizer, processor, chat template, license, and quantization. | MEDIUM |

MLX-LM 0.31.2 installed help confirms the required interfaces: local/HF data, LoRA or QLoRA, prompt masking, gradient accumulation, gradient checkpointing, `resume-adapter-file`, periodic saves, and adapter loading. Re-run and store `python -m mlx_lm lora --help`, `generate --help`, and `server --help` after locking 0.31.3. Generate YAML from probed options; do not rely on remembered flags.

Compile MLX-LM `train.jsonl`, `valid.jsonl`, and `test.jsonl` only from a validated dataset release. For multi-step tool trajectories, produce prefix-to-next-assistant-action rows so completion masking supervises each assistant action. Record truncation, source row IDs, export configuration, and dataset fingerprint.

#### Isolate DataTrove

DataTrove 0.9.0 is useful only when the corpus volume justifies its statistics/dedup blocks. It cannot share the current training environment:

- DataTrove 0.9.0 declares `huggingface-hub>=0.34,<1.0`.
- Current Transformers 5.14.0, required through MLX-LM's Transformers 5 line, declares `huggingface-hub>=1.5,<2.0`.

If adopted, place DataTrove in a separate uv project/process under `python/datatrove_worker/`. Its only interfaces are versioned Parquet inputs, Parquet/report outputs, and a checksummed manifest. Never let DataTrove own canonical schemas, provenance, split assignment, or representative selection. Do not weaken the main environment to an old Hub client merely to co-install it.

### GitHub, Git, Metrics, and Fixed Tools

| Technology | Target version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| GitHub CLI `gh` | 2.96.0 current; minimum verified 2.92.0 | Authentication and paginated REST/GraphQL metadata | Use `gh auth status` and `gh api --paginate`; GraphQL queries must expose cursor/pageInfo. Store API version, query hash, rate-limit metadata, and snapshot time. Inventory does not imply inclusion. | HIGH |
| Git | System 2.50.1 verified; capability probe required | Bare mirrors, history, worktrees, blame, diffs | Invoke with argument arrays and controlled environment. Use `clone --mirror`, incremental update/prune, and disposable detached worktrees. Version-gate commands used by the harness. | HIGH |
| scc | 3.7.0 | Current code/language metrics | Invoke as a fixed host tool with explicit excludes and machine-readable output. Record its version, file population, and exclusions. | HIGH |
| ripgrep | 15.2.0 | Fixed `search_code` implementation | Use bounded JSON output, path containment, result limits, and binary/hidden/generated policies. | HIGH |
| Gitleaks | 8.30.1 | Secret scan before dataset inclusion/export | Pin rules/config and scanner version; preserve finding class and redacted location. Never log matched secret values. | HIGH |
| Presidio Analyzer | 2.2.363, optional | Local PII candidate detection | Combine with deterministic email/path/account rules and operator review. Treat it as a candidate detector, not proof that a release is clean. | MEDIUM |

Use `gh`/GitHub APIs for repository/PR/review metadata and local mirrors for authoritative commit, diff, tree, blame, and line metrics. Do not use GitHub aggregate statistics as the sole source for Git history. Do not call a shell with concatenated model input; every fixed tool uses validated arguments and `Bun.spawn([...])` with `shell: false`.

### Studio

| Technology | Exact version | Purpose | Recommendation and rationale | Confidence |
|---|---:|---|---|---|
| React | 19.2.7 | Studio UI | Use a client-side local application; no SSR framework is needed. Keep data loading behind typed API clients and render source labels from the payload, not hardcoded view assumptions. | HIGH |
| Vite | 8.1.4 | Studio build/dev tooling | Build static assets and serve production assets through the loopback Bun service. Explicitly set dev and preview host to `127.0.0.1`; use strict ports and origin checks. | HIGH |
| Recharts | 3.9.2 | Dense analytical charts | Suitable for timelines, funnels, distributions, and paired comparisons. Keep raw sample tables and accessible textual summaries alongside charts. | MEDIUM |
| Playwright | 1.61.1 | Studio and local API acceptance | Test loopback binding, all required views, keyboard navigation, privacy redaction, source badges, replay integrity, and responsive layouts. Pin matching browser binaries. | HIGH |
| Testing Library React | 16.3.2 | Component behavior/accessibility | Use for view logic and accessible queries; reserve Playwright for complete workflows. | HIGH |

Production `mlx studio` must serve only on `127.0.0.1` unless an operator explicitly selects another interface. Do not use Vite preview as the production server. Studio reads typed local API views or immutable signed replay manifests; it does not read SQLite, `MLX_HOME`, or private Parquet directly in the browser.

### Verification Tooling

| Tool | Exact version | Scope | Confidence |
|---|---:|---|---|
| Biome | 2.5.4 target | TypeScript/React lint and format; migrate from 1.9.4 with a dedicated config update | MEDIUM |
| Vitest | 4.1.10 target | Portable TypeScript unit/integration tests; migrate from 3.2.4 separately | MEDIUM |
| fast-check | 4.9.0 | Path, schema, pagination, parser, split, and job-state properties | HIGH |
| Ruff | 0.15.21 | Python lint/format | HIGH |
| pytest | 9.1.1 | Python unit/integration and dataset contract tests | HIGH |
| Playwright | 1.61.1 | Studio/API/browser acceptance | HIGH |
| Gitleaks | 8.30.1 | Local secret policy gate | HIGH |

Keep the repository's required stable scripts as orchestration entry points:

```bash
bun run check
bun run typecheck
bun run test
bun run test:integration
bun run studio:build
bun run dataset:validate
bun run benchmark:smoke
bun run local:check
```

Portable checks must fail when required tools are absent. Apple Silicon checks must capability-gate and report `SKIPPED` with the missing capability; a skip is not a pass.

## Version Verification Commands

Run these before pinning and record their output in `mlx doctor`/run manifests:

```bash
# Control plane
bun --version
node --version
bunx tsc --version
gh --version
git --version
scc --version
rg --version
gitleaks version

# Embedded SQLite: hard gate described above
bun -e 'import { Database } from "bun:sqlite"; const db = new Database(":memory:"); console.log(db.query("select sqlite_version() as version").get())'

# Locked installs
bun install --frozen-lockfile
uv --version
uv python find 3.13
uv lock --check
uv sync --locked

# Python package matrix
uv run python -c 'import importlib.metadata as m; print({p:m.version(p) for p in ["datasets","pyarrow","polars","duckdb","huggingface-hub","jsonschema"]})'

# Installed interfaces, not remembered flags
uv run python -m mlx_lm lora --help
uv run python -m mlx_lm generate --help
uv run python -m mlx_lm server --help
uv run lighteval --help
uv run hf --version
```

Dataset acceptance must be executable, not metadata-only:

```bash
uv run mlx-dataset build --profile smoke
uv run mlx-dataset validate --all-configs
uv run python -c 'from datasets import load_dataset; print(load_dataset("parquet", data_files={"train":"<release>/parquet/sft/train-*.parquet"}))'
bun run dataset:validate
```

Publication validation remains local until the explicit publish command:

```bash
mlx dataset push --private --dry-run
# Show exact paths, sizes, checksums, visibility, secret/PII/license results.
mlx dataset push --private
# Second command still requires explicit confirmation.
```

`--dry-run` is an MLX-owned preview; the current `hf upload` command is not a substitute for it.

## Version and Lock Policy

1. Pin Bun, Python, direct npm, and direct Python dependencies exactly for acceptance.
2. Commit `bun.lock`, `uv.lock`, `.python-version`, tool configuration, and model/dataset revision SHAs.
3. Keep broad compatibility intent in documentation, but execute only from resolved locks.
4. Record `bun --version`, embedded SQLite version, Python, uv, package versions, Git, gh, scc, model/tokenizer revisions, macOS, chip, and memory in every material run.
5. Upgrade one compatibility cluster at a time: control plane, compiler, Studio, or MLX runtime.
6. A dependency update is incomplete until the real Parquet/load test, leakage audit, benchmark smoke, and relevant capability-gated MLX smoke rerun.

## Alternatives Considered

| Category | Recommended | Alternative | Why not |
|---|---|---|---|
| Canonical dataset | PyArrow/Parquet + HF Datasets configs | JSONL as source of truth | JSONL loses explicit Arrow types/config structure and encourages trainer-first design. Keep it only as a derived MLX-LM export. |
| Operational database | SQLite with migrations and ownership gate | DuckDB | DuckDB is excellent for analytics, not leased jobs, heartbeats, retries, and transactional operational state. |
| Analytical engine | DuckDB over Parquet | SQLite analytical tables | Large scans and nested analytical artifacts belong in Parquet/DuckDB, not the job catalog. |
| Python transforms | Polars lazy API | pandas-first pipeline | Polars and Arrow make streaming/lazy columnar work explicit. pandas may appear transitively but should not become the canonical implementation style. |
| Dataset schema owner | Datasets/PyArrow | Polars inference | HF `Json()` and explicit Features need schema fidelity; the verified Polars read produced an Arrow JSON-extension warning. |
| SQLite driver | `bun:sqlite` with version/owner gate | `better-sqlite3` | Current better-sqlite3 does not load under Bun 1.3.14. A Node-only catalog would violate the selected control-plane runtime and add deployment complexity. |
| Migrations | Ordered checked-in SQL | ORM-generated schema mutation | Explicit SQL is auditable, stable, and easy to replay against fixtures; ad hoc sync/push workflows obscure production changes. |
| Local API | `Bun.serve` + typed endpoints/SSE | Express/Hono/Next.js | The product needs a loopback API, not a public application platform. Add a framework only if routing complexity becomes real. |
| Studio | React + Vite | Next.js/Electron | No SSR, cloud deployment, or desktop packaging requirement justifies the extra runtime. Browser plus loopback service is smaller and easier to audit. |
| Repository metadata | `gh api` GraphQL/REST | Enumerate and clone everything | Explicit selection and pagination are privacy requirements. Metadata inventory must not become implicit ingestion. |
| Dedup at initial scale | MLX exact hashes + datasketch MinHash | DataTrove in core env | MLX must own provenance/splits, and current DataTrove conflicts with the current Hub/Transformers stack. Isolate it only when volume warrants. |
| Benchmark | Native worktree harness + optional LightEval adapter | LightEval-only runner | Static generation evaluators do not replace safe repository mutation, allowlisted checks, cleanup, and patch scoring. |
| Experiment logging | Local Parquet/JSON manifests | Online W&B by default | Private traces, metrics, adapters, and identifiers must not egress implicitly. Add an explicit publish adapter later if required. |
| Training | Official MLX-LM LoRA/QLoRA | `mlx-lm-lora` GRPO fork | The product acceptance path is supervised adaptation and paired evaluation. A third-party GRPO path increases compatibility risk without satisfying the dataset contract. |
| Metrics | Local Git + scc; GitHub APIs for collaboration | GitHub aggregate statistics alone | Aggregate endpoints can be delayed/cached/limited and cannot reconstruct selected repository history with the required provenance. |

## What Not to Use

- Do not carry Supabase-specific discovery or generated JavaScript tools into the target architecture.
- Do not let the model submit arbitrary shell, command strings, paths, or environment variables.
- Do not use random row splitting, `train_test_split`, or post-expansion splitting for the primary benchmark.
- Do not flatten every config into one text column or one giant nested schema.
- Do not use a custom Hugging Face loading script; the release must load through standard Parquet/config support.
- Do not let SQLite, DuckDB, or a mutable cache become the only copy of canonical evidence.
- Do not co-install DataTrove 0.9.0 with the current Transformers/MLX-LM environment.
- Do not bind Studio, MLX-LM server, or the local API to `0.0.0.0` by default.
- Do not use `hf upload --every`, background publication, or direct `push_to_hub` without MLX's preview, gates, and confirmation.
- Do not treat a fixture/replay result as live; the data-source label is part of the API contract.
- Do not retain hidden reasoning or raw unsanitized agent session logs in the dataset.
- Do not make the iOS/Swift runtime part of the required milestone path.

## Brownfield Migration Implications

| Existing area | Decision | Migration implication |
|---|---|---|
| Bun/TypeScript runtime | Keep | Rename/repackage the sole user-facing executable as `mlx`; add collision detection, `MLX_HOME`, machine-readable output, and stable scripts before deeper migration. |
| Ink CLI/REPL | Keep then narrow | Reuse working interaction patterns, but make command services non-UI and testable. Upgrade Ink/React separately. |
| Vercel AI SDK/local OpenAI-compatible provider | Keep selectively | Restrict it to semantic workers and model adapters. Deterministic Git, schema, hash, split, metrics, and check logic must not go through the model abstraction. |
| `requirements.txt` and pip fallback | Replace | Create `python/mlx_dataset/pyproject.toml`, pin Python 3.13.14, commit `uv.lock`, and make uv mandatory for Python tasks. Keep training in an optional dependency group/project. |
| Existing JSONL generation | Treat as migration input/fixture | Build canonical Parquet configs first; derive JSONL with row IDs and release fingerprint. Do not relabel old demo JSONL as the real dataset. |
| Existing chunk/random-like splits | Replace | Assign deterministic task groups, repository holdouts, temporal cutoffs, future split, and split manifest before expanding variants. |
| Dynamic generated tool discovery | Replace | Implement the fixed host tools from the contract and an allowlisted check registry. Preserve useful schema validation/fuzz patterns. |
| Existing `data/` runtime paths | Replace | Move state under `MLX_HOME`; add CAS, manifests, retention, and tests proving no writes escape configured roots. |
| Training shell scripts | Migrate | Generate version-compatible MLX-LM YAML/commands from typed config and probed help. Preserve checkpoint/resume supervision only after it references immutable dataset/model revisions. |
| Legacy eval runner | Replace | Build PersonalBench around disposable worktrees, sample-level Parquet results, paired statistics, and explicit error categories. |
| iOS Swift runtime | Defer/out of path | Leave untouched unless removal is independently approved. It cannot consume roadmap capacity needed by the dataset, benchmark, or Studio. |
| Existing Vitest/Biome pins | Keep for baseline, then upgrade | First establish green baseline scripts; upgrade to Vitest 4/Biome 2 in focused changes with config migrations. |
| No Studio | Add | Build React/Vite against typed loopback API/replay manifests after data and benchmark contracts are stable enough to display honestly. |

## Installation Shape

These commands illustrate the target lock shape; roadmap execution should add packages only in the phase that owns them.

```bash
# Control plane / Studio exact direct pins
bun add zod@4.4.3
bun add react@19.2.7 react-dom@19.2.7 recharts@3.9.2
bun add -d typescript@5.9.3 vite@8.1.4 vitest@4.1.10 \
  @biomejs/biome@2.5.4 @playwright/test@1.61.1 \
  @testing-library/react@16.3.2 fast-check@4.9.0

# Python package
uv python pin 3.13.14
uv add datasets==5.0.0 pyarrow==25.0.0 polars==1.42.1 duckdb==1.5.4 \
  huggingface-hub==1.23.0 jsonschema==4.26.0 datasketch==2.0.0 \
  mlcroissant==1.1.0 numpy==2.5.1 scipy==1.18.0 statsmodels==0.14.6
uv add --dev ruff==0.15.21 pytest==9.1.1
uv add --optional training 'mlx==0.31.2' 'mlx-lm[train]==0.31.3' trl==1.8.0
uv add --optional evaluation lighteval==0.13.0

# Lock and verify
uv lock
uv sync --locked
bun install --frozen-lockfile
```

Before using uv optional groups for mutually incompatible tools, confirm the whole lock can resolve. DataTrove is a separate uv project, not another group in this project.

## Confidence Assessment

| Area | Confidence | Evidence and remaining condition |
|---|---|---|
| Bun/TypeScript control plane | HIGH for architecture; MEDIUM for target upgrades | Brownfield implementation exists. Bun 1.3.14 and current npm metadata were checked; TS/Ink/Biome/Vitest upgrades still need repo tests. |
| SQLite operational catalog | MEDIUM | SQLite semantics are authoritative, but Bun's current embedded 3.51.0 requires the explicit single-owner mitigation and acceptance test. |
| HF/PyArrow/Polars/DuckDB compiler | HIGH | Current exact versions were installed together and passed an executable nested-Features/Parquet/load/query smoke. |
| HF publication | HIGH for APIs; MEDIUM for end-to-end Hub | Current signatures/help were checked. No upload was attempted because publication is explicitly out of scope for research. |
| MLX-LM training | MEDIUM | Official 0.31.3 docs/release and installed 0.31.2 help support the design. E2B/E4B memory and checkpoint acceptance must run on the target M4 Pro. |
| Benchmark/statistics | HIGH | Native harness boundary follows the contract; NumPy/SciPy/statsmodels are current. Task validity and statistical power remain dataset-dependent. |
| Studio | HIGH | Current React/Vite/Playwright lines and loopback controls are well documented. Visual acceptance awaits implementation. |
| DataTrove | HIGH on isolation decision | Current package metadata proves the Hub-client conflict. Value at personal-corpus scale remains unproven, so defer. |
| PII scanning | MEDIUM | Gitleaks is strong for secrets; general PII detection needs policy-specific deterministic rules, optional Presidio, and operator review. |

## Roadmap Consequences

The stack implies this order:

1. Pin identity/toolchains and build the migration inventory.
2. Implement safe paths, SQL migrations, the catalog ownership gate, CAS, runs, and jobs.
3. Add explicit GitHub inventory and local Git evidence using fixed versioned tools.
4. Build canonical evidence/preferences before adding any trainer integration.
5. Establish the Python package and executable HF/Parquet release validation.
6. Build native PersonalBench/worktree tools; add LightEval only as an adapter.
7. Lock and run the actual MLX-LM E2B/E4B Apple Silicon acceptance.
8. Build Studio over typed APIs and signed manifests, then run privacy and end-to-end acceptance.

Do not schedule React polish, DataTrove, GRPO, or iOS work ahead of the compiler and leakage gates.

## Primary Sources

### Runtime, storage, and tools

- [Bun v1.3.14 release](https://github.com/oven-sh/bun/releases/tag/bun-v1.3.14)
- [Bun SQLite documentation](https://bun.sh/docs/runtime/sqlite)
- [SQLite WAL documentation and WAL-reset fix boundary](https://www.sqlite.org/wal.html)
- [SQLite foreign key documentation](https://www.sqlite.org/foreignkeys.html)
- [SQLite PRAGMA reference](https://www.sqlite.org/pragma.html)
- [uv project/lock layout](https://docs.astral.sh/uv/concepts/projects/layout/)
- [uv 0.11.29 release](https://github.com/astral-sh/uv/releases/tag/0.11.29)
- [Python 3.13.14 release](https://www.python.org/downloads/release/python-31314/)
- [GitHub CLI `gh api` manual](https://cli.github.com/manual/gh_api)
- [GitHub REST versus GraphQL guidance](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api)
- [scc v3.7.0](https://github.com/boyter/scc/releases/tag/v3.7.0)
- [ripgrep v15.2.0](https://github.com/BurntSushi/ripgrep/releases/tag/15.2.0)
- [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)

### Dataset and analytics

- [Hugging Face Datasets 5.0.0 package metadata](https://pypi.org/project/datasets/5.0.0/)
- [Hugging Face Datasets repository structure/configs](https://huggingface.co/docs/datasets/en/repository_structure)
- [Hugging Face Datasets main classes and Hub APIs](https://huggingface.co/docs/datasets/en/package_reference/main_classes)
- [PyArrow 25.0.0 package metadata](https://pypi.org/project/pyarrow/25.0.0/)
- [Apache Arrow Python dataset documentation](https://arrow.apache.org/docs/python/dataset.html)
- [Polars lazy sources and sinks](https://docs.pola.rs/user-guide/lazy/sources_sinks/)
- [DuckDB querying Parquet](https://duckdb.org/docs/stable/guides/file_formats/query_parquet)
- [DuckDB Python result conversion](https://duckdb.org/docs/stable/clients/python/overview)
- [huggingface_hub 1.23.0 package metadata](https://pypi.org/project/huggingface-hub/1.23.0/)
- [Hugging Face Hub CLI reference](https://huggingface.co/docs/huggingface_hub/en/package_reference/cli)
- [TRL dataset formats](https://huggingface.co/docs/trl/en/dataset_formats)
- [MLCommons Croissant](https://mlcommons.org/working-groups/data/croissant/)
- [DataTrove 0.9.0 package metadata](https://pypi.org/project/datatrove/0.9.0/)
- [Transformers current package metadata](https://pypi.org/project/transformers/)

### Training, benchmark, and Studio

- [MLX-LM v0.31.3 release](https://github.com/ml-explore/mlx-lm/releases/tag/v0.31.3)
- [MLX-LM LoRA/QLoRA documentation](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Gemma 4 E2B model repository](https://huggingface.co/google/gemma-4-E2B)
- [Gemma 4 E4B instruction-tuned repository](https://huggingface.co/google/gemma-4-E4B-it)
- [LightEval custom task documentation](https://huggingface.co/docs/lighteval/en/adding-a-custom-task)
- [Vite 8 announcement and Node requirements](https://vite.dev/blog/announcing-vite8)
- [Vite server options](https://vite.dev/config/server-options)
- [React 19.2.7 release tag](https://github.com/facebook/react/releases/tag/v19.2.7)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [Playwright best practices/version verification](https://playwright.dev/docs/best-practices)

---

*Version claims were checked on 2026-07-15 against official documentation, release metadata, package indexes, installed CLI help, and an isolated compiler smoke. No private repository was enumerated or read, and no artifact was uploaded.*
