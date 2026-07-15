# External Integrations

**Analysis Date:** 2026-07-15

This audit distinguishes current code integrations from product-contract integrations. Current runtime integrations live in `src/`, `lib/`, `scripts/`, and `ios/SpecialistApp/`; target integrations are specified in `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`, and `docs/MLX_RESEARCH_RATIONALE.md`.

## APIs & External Services

**Local Model Serving:**
- MLX-LM OpenAI-compatible server - primary model endpoint for CLI, worker, data generation, and evaluation calls.
  - SDK/Client: `@ai-sdk/openai-compatible` in `lib/model.ts`; AI SDK calls in `src/lib/conversation.ts`, `lib/discovery/worker.ts`, `lib/data/qa-worker.ts`, `lib/data/traj-worker.ts`, `lib/data/judge.ts`, `lib/data/eval-gen.ts`, `lib/eval/run.ts`, `lib/workers/roles.ts`, and `lib/coordinator/coordinator.ts`.
  - Server process: `python -m mlx_lm.server --model <model> --port <port>` in `src/lib/server-manager.ts`.
  - Auth: placeholder `apiKey: 'local'` in `lib/model.ts`; no real remote credential is required for the default local endpoint.
  - Config: `MLX_SERVER_URL`, `LOCAL_MODEL`, `serverPort`, and `serverUrl` in `src/lib/config.ts`.

**External Documentation Sources:**
- Supabase documentation text endpoints - current discovery corpus source for the existing specialist pipeline.
  - SDK/Client: global `fetch` in `lib/discovery/corpus.ts`.
  - Endpoints: `https://supabase.com/llms.txt`, `https://supabase.com/llms/cli.txt`, and `https://supabase.com/llms/guides.txt` in `lib/discovery/corpus.ts`.
  - Auth: none.
  - Cache: `data/corpus.json` in `lib/discovery/corpus.ts`.

**Hugging Face Model Access:**
- Hugging Face model downloads - used by local embedding and MLX model tooling.
  - SDK/Client: `@huggingface/transformers` in `lib/data/embed.ts`; MLX-LM Python tooling in `scripts/train.sh`, `scripts/grpo.sh`, `scripts/fuse.sh`, and `src/lib/server-manager.ts`.
  - Models: `Xenova/all-MiniLM-L6-v2` in `lib/data/embed.ts`; `unsloth/gemma-4-E4B-it-UD-MLX-4bit` and E2B fallback references in `src/lib/config.ts`, `src/lib/server-manager.ts`, `lib/training/run-training.ts`, `scripts/_lib.sh`, `scripts/fuse.sh`, and `scripts/micro-bench.sh`.
  - Auth: none in current code; private Hub access is not implemented in current source.

**Hugging Face Dataset and Hub Target:**
- Hugging Face Datasets / Hub - first-class required export target in the product contract.
  - SDK/Client: target Python `datasets`, `huggingface_hub`, `pyarrow`, and Parquet stack described in `docs/MLX_PROJECT_SPEC.md` and `docs/MLX_DATASET_CONTRACT.md`; not present in `requirements.txt` as current installed dependencies.
  - Auth: target Hub token is required only for explicit private push; no current env var or implementation detected.
  - Current implementation: JSONL output through `lib/data/emit-jsonl.ts`; no `datasets.load_dataset` compiler or `push_to_hub` code detected in `src/`, `lib/`, or `scripts/`.

**GitHub and Git Repository Access:**
- GitHub repository ingestion - required by `docs/MLX_PROJECT_SPEC.md` for selected repositories, metrics, PR/review metadata, mirrors, and holdouts.
  - SDK/Client: target `gh`, GraphQL, REST, and local Git mirrors in `docs/MLX_PROJECT_SPEC.md`; no current GitHub adapter package or `gh` integration detected in `package.json`, `requirements.txt`, `src/`, or `lib/`.
  - Auth: target authenticated GitHub CLI; no current token handling detected.
  - Existing Git use: `scripts/ios-bootstrap.sh` clones `https://github.com/ml-explore/mlx-swift-examples` into `ios/_upstream`.

**iOS Device Tooling:**
- Xcode `xcrun devicectl` - copies adapters and verifies app container files on a physical device.
  - SDK/Client: shell commands in `scripts/deploy-adapter.sh` and `scripts/ios-deploy-device.sh`.
  - Auth: local Apple developer/Xcode device trust; selected by `IPHONE_UDID` and bundle ID.
  - State: `data/state/ios-device.json` and `data/state/adapter-deploy.json` in `scripts/deploy-adapter.sh`.

**Weights & Biases:**
- W&B Python package - installed because `mlx-lm-lora` imports it.
  - SDK/Client: `wandb` from `requirements.txt`.
  - Auth: intentionally not used; `scripts/_lib.sh` exports `WANDB_MODE=offline`.
  - Network behavior: keep offline unless explicitly changed.

**Optional Evaluation Endpoints:**
- Base and tuned model HTTP endpoints - optional comparison endpoints for the evaluation harness.
  - SDK/Client: global `fetch` in `lib/eval/run.ts`.
  - Auth: not implemented.
  - Config: `EVAL_BASE_URL` and `EVAL_TUNED_URL` in `lib/eval/run.ts`.

## Data Storage

**Databases:**
- Current implementation: no database package detected in `package.json`, `requirements.txt`, `src/`, or `lib/`.
  - Connection: Not detected.
  - Client: Not detected.
- Target architecture: SQLite catalog under `~/.mlx/catalog/mlx.sqlite` with WAL mode, foreign keys, migrations, leased jobs, heartbeats, retries, and recovery in `docs/MLX_PROJECT_SPEC.md`.
  - Connection: target `MLX_HOME` or `~/.mlx`; no current implementation detected.
  - Client: Not detected in current dependencies.

**Analytical Data:**
- Current implementation: JSON and JSONL files in `data/`, including `data/corpus.json`, `data/adapter-tools.json`, `data/training.jsonl`, and `data/eval.jsonl` generated by `lib/discovery/manifest.ts`, `lib/discovery/corpus.ts`, and `lib/data/emit-jsonl.ts`.
- Target architecture: Parquet/Arrow files under `MLX_HOME` and Hugging Face dataset release layouts described in `docs/MLX_PROJECT_SPEC.md` and `docs/MLX_DATASET_CONTRACT.md`.
- DuckDB, Polars, PyArrow, and Hugging Face `datasets` are target technology in docs but not installed in `requirements.txt`.

**File Storage:**
- Local filesystem only in current code.
- Main paths: `data/` for generated corpus, manifests, training/eval JSONL, adapter checkpoints, fused outputs, and deployment state; `.venv/` for Python toolchain; `ios/_upstream/` for cloned MLX Swift examples.
- Product target: content-addressed SHA-256 object store under `MLX_HOME/objects/` in `docs/MLX_PROJECT_SPEC.md`; no current implementation detected.

**Caching:**
- Current corpus cache: `data/corpus.json` in `lib/discovery/corpus.ts`.
- Current embedding/model caches: handled by `@huggingface/transformers` and MLX-LM default caches; no repo-specific cache configuration detected.
- Target cache paths: `~/.mlx/cache/huggingface/` and `~/.mlx/cache/embeddings/` in `docs/MLX_PROJECT_SPEC.md`.

## Authentication & Identity

**Auth Provider:**
- Current application auth: none; local CLI and local model server operate without user authentication.
  - Implementation: `lib/model.ts` uses local placeholder API key for the OpenAI-compatible client.
- GitHub identity target: authenticated GitHub CLI plus `.mailmap`, noreply address, and manual alias handling are required by `docs/MLX_PROJECT_SPEC.md`.
  - Implementation: not detected in current code.
- Hugging Face Hub target: private dataset push requires explicit operator action in `docs/MLX_DATASET_CONTRACT.md`.
  - Implementation: not detected in current code.

**Local Configuration Identity:**
- Current config reads user and project JSON settings from legacy agent config paths in `src/lib/config.ts`.
- Product target state should use `~/.mlx` or `MLX_HOME` per `docs/MLX_PROJECT_SPEC.md` and AGENTS.md instructions.

## Monitoring & Observability

**Error Tracking:**
- External error tracking service: Not detected.
- Current strategy: local thrown errors, CLI logs, process stderr, and test assertions.

**Logs:**
- Ink CLI log surfaces are implemented in `src/app-oneshot.tsx`, `src/repl.tsx`, `src/components/log-view.tsx`, `src/components/pipeline-view.tsx`, and `src/components/train-view.tsx`.
- Training process stdout/stderr is streamed and parsed by `lib/training/run-training.ts` and `lib/streams/trainParser.ts`.
- Device deployment logs and verification output come from `scripts/deploy-adapter.sh`.
- W&B is present but forced offline by `scripts/_lib.sh`; do not treat W&B cloud dashboards as part of the current observability path.

## CI/CD & Deployment

**Hosting:**
- Current product hosting: none; CLI and model server run locally.
- Local model API: loopback `http://localhost:8080/v1` by default in `lib/model.ts` and `src/lib/server-manager.ts`.
- iOS deployment: physical device install/copy path through `xcrun devicectl` in `scripts/ios-deploy-device.sh` and `scripts/deploy-adapter.sh`.
- Studio/web hosting target from `docs/MLX_PROJECT_SPEC.md`: local loopback Studio is required, but no Vite/React web app or local API package is detected in current dependencies.

**CI Pipeline:**
- CI service: Not detected.
- Stable local commands: `bun run check`, `bun run typecheck`, `bun run test`, and `bun run pipeline` in `package.json`.
- Required future commands from `docs/MLX_PROJECT_SPEC.md` include `bun run test:integration`, `bun run studio:build`, `bun run dataset:validate`, `bun run benchmark:smoke`, and `bun run local:check`; these scripts are not present in current `package.json`.

## Environment Configuration

**Required env vars:**
- Required for default CLI/model work: none if using defaults; `LOCAL_MODEL` and `MLX_SERVER_URL` can override model and endpoint.
- Required for iOS adapter deployment: `IPHONE_UDID` and `BUNDLE`, unless `data/state/ios-device.json` provides them in `scripts/deploy-adapter.sh`.
- Required for optional endpoint eval: `EVAL_BASE_URL` and `EVAL_TUNED_URL` in `lib/eval/run.ts`.
- Required for custom training/fusion: `ADAPTER_DIR`, `MODEL`, `BASE_MODEL`, `DATA_DIR`, `OUT_DIR`, `TOOLS_JSON`, and training hyperparameter env vars consumed by `scripts/*.sh`.

**Secrets location:**
- `.env.example` and `.env.local` exist and were not read.
- No secret manager, keychain, or vault integration detected in current code.
- Product target requires private-by-default local storage under `MLX_HOME`, explicit push/publish actions, and secret/PII scans before export per `docs/MLX_PROJECT_SPEC.md` and `docs/MLX_DATASET_CONTRACT.md`.

## Webhooks & Callbacks

**Incoming:**
- Not detected in current product code.
- `scripts/smoke-pipeline.ts` references `http://localhost:3000/api/pipeline`, but no server implementation for that route is detected in `src/` or `lib/`.

**Outgoing:**
- `lib/discovery/corpus.ts` fetches Supabase documentation endpoints.
- `lib/model.ts` and `src/lib/server-manager.ts` call the local OpenAI-compatible MLX-LM endpoint.
- `lib/eval/run.ts` optionally calls `EVAL_BASE_URL` and `EVAL_TUNED_URL`.
- `lib/data/embed.ts` may download or cache the Hugging Face embedding model through `@huggingface/transformers`.
- MLX-LM scripts may download Hugging Face model weights for configured `unsloth/gemma-*` models.
- `scripts/ios-bootstrap.sh` clones `https://github.com/ml-explore/mlx-swift-examples`.
- `scripts/deploy-adapter.sh` and `scripts/ios-deploy-device.sh` communicate with local Xcode device tooling, not remote webhooks.

---

*Integration audit: 2026-07-15*
