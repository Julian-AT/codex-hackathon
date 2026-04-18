# SPEC — Product → Offline Specialist-LLM Pipeline

**Status:** Active baseline for build. Do not edit without coordinator approval.
**Date:** Saturday, April 18, 2026.
**Budget:** 12 hours (Friday prep time is lost — see §14 for compressed execution plan).
**Audience:** IDE coding agents (Claude Code) building this out.
**Author:** Research synthesis. Grounded in primary sources cited in §20.

---

## 1. Executive Summary

Build an agentic pipeline that takes a product (e.g. Supabase, Vercel AI SDK, Zod, Hono) as input and produces a specialized 4-billion-parameter language model that runs fully offline on an iPhone 17, outperforming its own base model on domain-specific Q&A for that product and approaching a frontier model's ceiling on the same narrow slice.

The final on-device model is not just a Q&A bot. It ships with **domain-specific callable tools that were designed, implemented in JavaScript, and bundled by the pre-training agent swarm itself**. Tools are truly dynamic — each tool has a JavaScript function body the agents wrote, shipped alongside the fine-tuned weights, and executed on-device inside Apple's `JSContext`.

The pipeline is composed of visible agent swarms that run live during the demo. A frontier teacher model (Claude Opus 4.7) synthesizes the training data; a cross-family judge (GPT-5 + Gemini 2.5 Pro) grades it. QLoRA fine-tuning runs locally on an M4 Pro 24 GB MacBook in ≤ 17 minutes wall-clock. The resulting adapter is fused, streamed to the iPhone over USB-C, and hot-swapped into a pre-baked native Swift app. The phone is in airplane mode before the demo begins.

**One-sentence thesis:** _Cloud AI asks you to trust it. This one doesn't have to — because it literally cannot phone home._

---

## 2. Project Goals

### 2.1 Must-haves (Tier 1 demo)

1. A native iOS app running on iPhone 17 in airplane mode, served a 4B-parameter fine-tuned Gemma 4 E4B model with no network connection available.
2. Fine-tuning completes live on stage in under 17 minutes on the laptop, with training loss and a secondary reward curve streaming to a visible UI.
3. The tuned model correctly invokes a domain-specific callable tool — the tool's JavaScript body was written by an agent during the pipeline run and bundled with the model.
4. A three-way evaluation scoreboard (base vs. tuned vs. teacher) with numeric scores and a latency comparison.
5. Visible agent orchestration — the user sees 4+ swarms running in parallel with live status updates.

### 2.2 Nice-to-haves (Tier 1 stretch)

6. A second pre-cached audience-selected product (Vercel AI SDK, Zod, or Hono) that runs at demo time.
7. A distillation Sankey visualization (generated N → filtered M → trained → lifted X points).
8. Sentry `gen_ai` telemetry dashboard visible on a secondary screen.
9. On-device tool-call message bubble showing the invocation inline.

### 2.3 Non-goals (do not pursue)

- A PWA path. It is confirmed broken for 3 B+ models on iOS 26 Safari (see §4.1).
- Voice I/O. Web Speech in WKWebView is flaky; Apple's `SpeechTranscriber` is out of scope for 12 hours.
- A second-product live speedrun in the demo. A 60-second run is dishonest at this model size.
- Full dynamic model architecture discovery. We pin one base model and one fallback.
- Core ML or ExecuTorch conversion. MLX Swift is the only path hitting 45+ tok/s on iPhone 17.
- Python application code. Python is used only as a CLI subprocess; zero Python files are authored.

---

## 3. Design Principles

1. **Pre-bake the base, stream the adapter.** The iOS app bundle contains Gemma 4 E4B base weights (~3 GB) shipped once. Only the ~60 MB fine-tuned LoRA adapter is produced at training time and hot-swapped into the running process via `LoRATrain.loadLoRAWeights(model:, url:)`. No base-model download at demo time.
2. **Airplane mode is not a stunt. It is the product.** Any affordance (RAG, cloud fallback, hybrid inference) that weakens the offline story is rejected.
3. **Agents own the tools.** The tool-design swarm produces JSON Schema, JavaScript function body, and `requiresNetwork` flag for each tool. The orchestrator validates, bundles, and ships. Training data teaches the student model to invoke these specific tools with correct arguments. On-device runtime dispatches to the agents' JS via `JSContext`.
4. **Cross-family teacher and judge.** Generation uses Claude Opus 4.7. Judging uses GPT-5 and Gemini 2.5 Pro as a jury. Prevents preference leakage (arXiv 2502.01534).
5. **Coordinator/Worker orchestration.** Pattern cribbed directly from Claude Code's source (`coordinator/coordinatorMode.ts`, `tools/AgentTool/*`). Coordinator synthesizes; workers execute; results flow via typed `task-notification` messages.
6. **TypeScript-first, Swift-thin, zero Python code.** All orchestration, data-gen, eval, UI, streaming: Next.js + AI SDK v6. Fine-tuning: `mlx_lm.lora` CLI as Node subprocess. iOS: a ~400 LOC fork of `mlx-swift-examples/LLMEval`.
7. **Fail-closed fallback ladder.** Three tiers always prepared. Tier 1 is the live build. Tier 2 is Friday-trained + live training visible but not deployed. Tier 3 is a pre-recorded cassette with live narration.
8. **No silent cloud fallback.** If on-device inference fails during demo, the narration is honest: we announce the fallback and explain why.

---

## 4. System Architecture

### 4.1 Runtime topology

Three machines, strict boundaries:

- **Laptop (MacBook Pro M4 Pro, 24 GB unified memory).** Runs Next.js with the AI SDK v6 orchestrator, agent swarms (Coordinator/Worker), `mlx_lm.lora` subprocess for SFT and `mlx_lm_lora.train` subprocess for GRPO, synthetic data generation, evaluation harness, and the live demo UI (agent grid, loss curves, eval scoreboard, latency stopwatch, Sentry dashboard).
- **iPhone 17 (A19 chip).** Runs the native Swift app forked from `mlx-swift-examples/LLMEval`. Hosts the pre-baked Gemma 4 E4B base weights in its app sandbox. Loads fused LoRA adapters at runtime. Executes agent-written JavaScript tools via `JSContext`. Airplane mode enabled for the entire demo window.
- **Frontier APIs.** Claude Opus 4.7 (teacher / generator). GPT-5 + Gemini 2.5 Pro (judge jury). Gemini 2.5 Pro doubles as the high-TPM workhorse fallback when Anthropic rate-limits.

### 4.2 Why native iOS, not a PWA

**Verified blocker.** GitHub issue [mlc-ai/web-llm #753](https://github.com/mlc-ai/web-llm/issues/753), filed December 10, 2025 and still open as of April 17, 2026, reports reproducible iOS 26 Safari tab termination on download completion for `Qwen2.5-3B-Instruct-q4f16_1`. Transformers.js v4 guidance explicitly caps mobile targets at < 2 B parameters. Every WebGPU path for ≥ 3 B on iPhone is currently broken. The native Swift + MLX path is the only confirmed route that hits 45–60 tok/s on iPhone 17 Pro Max at 4 B (source: Jackrong/Gemopus benchmarks, April 14, 2026).

### 4.3 Component diagram (prose)

```
[Product URL input]
        |
        v
[Coordinator Agent] ---------------------------+
        |                                      |
        +-- [Discovery Workers (parallel)] --+ |
        |        (llms.txt, GitHub, RSS)     | |
        |                                    | |
        +-- [Tool-Design Workers (parallel)]-+ |  <-- emit <task-notification>
        |        (JSON Schema + JS body      | |       via writer.merge()
        |         + requiresNetwork flag)    | |
        |                                    | |
        +-- [Data-Gen Workers (parallel)] ---+ |       UI (Next.js +
        |        (500 QA + 1000 trajectory   | |       AI SDK v6 useChat)
        |         + 200 multi-turn trace)    | |
        |                                    | |
        +-- [Eval-Gen Worker] ---------------+ |
                 (50 QA + 20 BFCL-AST,         |
                  30% held-out doc split)      |
                                               |
        Aggregated outputs                     |
        |                                      |
        v                                      |
[SFT subprocess: mlx_lm.lora] --- loss ------->|
        |
        v
[GRPO subprocess: mlx_lm_lora.train] --- reward -->|
        |
        v
[Fuse: mlx_lm.fuse] -> adapter.safetensors (~60MB)
        |
        v
[xcrun devicectl copy] ---USB-C---> iPhone /Documents/
                                           |
                                           v
                                    [LoRATrain.loadLoRAWeights]
                                           |
                                           v
                          [Gemma 4 E4B + LoRA in MLX Swift]
                                           |
                   on-device tool-call stream parse
                                           |
                                           v
                          [ToolRegistry actor / JSContext]
                                  |             |
                                  v             v
                          [offline tools]  [online tools — blocked in airplane]
```

---

## 5. Base Model Selection

### 5.1 Chosen model

**`unsloth/gemma-4-E4B-it-UD-MLX-4bit`.** Google DeepMind Gemma 4 Effective-4B, Apache 2.0, released April 2–3, 2026. Quantized to 4-bit via Unsloth's Dynamic Unsloth quant, packaged for MLX.

### 5.2 Rationale

- **License.** Apache 2.0 removes commercial ambiguity.
- **On-device throughput.** Jackrong's Gemopus benchmarks measure 45–60 tok/s on iPhone 17 Pro Max via MLX. Independent Hacker News confirmation of real-time voice pipelines on M3 Pro with E2B suggests further headroom.
- **Native tool tokens.** Gemma 4 ships `<|tool>`, `<|tool_call>`, `<|tool_response>` as dedicated tokens in its tokenizer config. No Hermes template surgery, no ChatML hacking.
- **Day-one MLX support.** Verified `mlx_lm.generate` and `mlx_lm.lora` work with the Gemma 4 family. The Unsloth MLX quants are the community standard (`unsloth/gemma-4-E4B-it-UD-MLX-4bit`, `unsloth/gemma-4-E4B-it-MLX-8bit`).
- **Training memory.** deadbydawn101 trained an E4B LoRA in 6 minutes over 1,000 iterations at ~190 tok/s, peak memory 7.876 GB on an M4 Max. This extrapolates comfortably to M4 Pro 24 GB with 4-bit base + rank-16 adapters + grad checkpointing.
- **Function calling quality.** MindStudio and HF blog both confirm E4B recommended over E2B for complex agentic workflows where multiple tools are available and schemas are detailed.

### 5.3 Fallback model

**`unsloth/gemma-4-E2B-it-UD-MLX-4bit`.** Same family, ~1.5 GB instead of ~3 GB. Swap to this if the M4 Pro 24 GB micro-bench (§14 Hour 1) shows peak training memory above 20 GB on E4B. E2B is the Unsloth-recommended candidate when memory is constrained.

### 5.4 Known caveat to track

Jackrong's April 2026 Gemopus release notes state: _"Tool calling remains unreliable across the Gemma 4 series in llama.cpp and LM Studio, with failures, format mismatches and looping reported."_ Our defense has three layers:

1. MLX renders the chat template differently from llama.cpp and has not been reported to exhibit this bug.
2. Fine-tuning on well-formed `<|tool_call|>…<|tool_response|>` trajectories bakes the format into the adapter.
3. The on-device stream parser strictly validates JSON inside tool-call tokens and retries on malformed output.
4. Evaluation (§11) uses BFCL-style AST match on tool name and argument schema — format slop cannot grade as correct.

---

## 6. Fine-Tuning Strategy

### 6.1 Two-stage pipeline: SFT then GRPO

**Stage 1 — Supervised Fine-Tuning (SFT).** Package: `mlx-lm==0.31.2`. Applies LoRA adapters to a quantized base (automatically QLoRA since base is 4-bit). Training data is ChatML-style `messages` JSONL with `tools` field for tool-call trajectories.

**Stage 2 — Group Relative Policy Optimization (GRPO).** Package: `mlx-lm-lora==0.1.0` (Gökdeniz Gülmez's RL extension, used by Apple, IBM, Mercedes per package metadata). Runs after SFT converges. Uses the frontier teacher as the reward function — each candidate response is scored by the judge jury, preferences are derived, GRPO updates the same adapter. Demonstrably converges in under 5 minutes for our group size.

### 6.2 Configuration

| Parameter              | SFT value                            | GRPO value                | Rationale                               |
| ---------------------- | ------------------------------------ | ------------------------- | --------------------------------------- |
| Base model             | `unsloth/gemma-4-E4B-it-UD-MLX-4bit` | Same adapter carried over | Consistent quantization                 |
| Adapter rank           | 16                                   | 16                        | Standard for narrow domain              |
| Adapter layers         | 16 (last)                            | same                      | Default `--num-layers`                  |
| Batch size             | 2                                    | 2                         | Fits 24 GB with grad-ckpt               |
| Sequence length        | 1024                                 | 512 (completions)         | Trajectories fit; GRPO rollouts shorter |
| Gradient checkpointing | on                                   | on                        | Memory safety                           |
| Learning rate          | 1e-5                                 | 5e-6                      | Conservative for RL                     |
| Iterations             | 400                                  | 150                       | Bench-driven; see §14                   |
| Group size             | —                                    | 4                         | Responses per prompt for GRPO           |
| Reward function        | —                                    | Judge-jury float 0–1      | Cross-family judge avg                  |
| Steps per report       | 5                                    | 5                         | UI update cadence                       |

### 6.3 Memory math (expected peak, E4B on M4 Pro 24 GB)

- Quantized weights (4-bit): ~3.0 GB
- LoRA parameters (rank 16, 16 layers): ~0.02 GB
- Gradients for LoRA only: ~0.02 GB
- Optimizer state (Adam, fp16): ~0.04 GB
- Activations at seq 1024, batch 2 with grad-ckpt: ~6–9 GB
- KV cache during rollouts (GRPO, group 4, completion 512): ~1–2 GB
- **Projected peak: ~13–15 GB.** Leaves comfortable headroom on 24 GB.

**If Friday micro-bench shows peak > 20 GB:** switch immediately to E2B. Do not attempt batch size 1 workarounds — training wall-clock becomes uncompetitive.

### 6.4 Training wall-clock target

Total pipeline budget for the "live training" portion of the demo: **17 minutes maximum**. Breakdown: 12 minutes SFT (400 iters × ~1.8 s/iter) + 5 minutes GRPO (150 iters × ~2 s/iter). The loss curve streams to the UI at 5-step intervals; the reward curve overlays once GRPO begins.

---

## 7. Data Recipe

### 7.1 Target volume

**~1,750 examples total, budget under 3 hours wall-clock with unlimited teacher tokens.**

| Bucket                              | Count | Generator approach                                                            |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------- |
| Grounded Q&A                        | 500   | Genstruct-style on 70% doc split, persona × difficulty × chunk stratification |
| Evol-Instruct expansions            | 100   | Difficulty-ladder expansion of the Q&A bucket                                 |
| Single-turn tool-call               | 800   | APIGen-style, persona-seeded, pinned to shipped tool schemas                  |
| Multi-turn trajectories (2–6 turns) | 200   | APIGen-MT blueprint → roleplay with mocked tool responses                     |
| Parallel/dependent tool calls       | 100   | Tool-pair random-walk over the dependency graph                               |
| Refusal / clarify / no-tool         | 50    | When2Call pattern                                                             |

### 7.2 Generation and filtering pipeline

1. **Generate.** Claude Opus 4.7 via AI SDK v6 `generateText` with structured output constraints. Fan-out controlled by `p-limit(15)` to respect rate limits.
2. **Schema-gate.** Every `<|tool_call|>` arguments JSON validated via `jsonschema.validate` against the exact tool schemas we will ship. Any hallucinated signature is rejected — never patched. Rejections re-enter the generation queue with negative-feedback prompt addendum.
3. **Quality-gate.** GPT-5 judge rates each example on four dimensions (faithfulness, tool correctness, naturalness, grounding) on a 1–5 Likert. Rejections below 4 on any dimension are regenerated.
4. **Cross-family anti-leakage.** Judge and generator are different families. Gemini 2.5 Pro is a second judge on a 20% sample for jury averaging; disagreements over one Likert point trigger human spot-check log.
5. **Dedup.** MinHash signature at 0.7 threshold, then embedding cosine at 0.92.
6. **Stratification.** Final dataset enforces minimum 30 examples per unique tool name. Prevents mode collapse on the 2–3 most-used tools.

### 7.3 Training-data format (mlx-lm `tools` JSONL)

Each line is a JSON object with `messages` (list of role/content/tool_calls entries) and `tools` (list of tool definitions in OpenAI function-calling schema). mlx-lm auto-applies the Gemma 4 chat template, which emits the `<|tool_call|>…<|tool_response|>` tokens at the right positions during training. No manual tokenization required.

---

## 8. On-Device Runtime

### 8.1 App shell

Fork of `mlx-swift-examples` target `LLMEval`. Xcode 16. iOS deployment target 18. Required entitlement: `com.apple.developer.kernel.increased-memory-limit` (raises the 3 GB per-process RAM cap that would otherwise throttle a 4 B model on iPhone).

### 8.2 Components to build (Swift, ~400 LOC total)

1. **Adapter loader UI.** Simple view that enumerates `/Documents/*.safetensors` and calls `LoRATrain.loadLoRAWeights(model:, url:)` on selection. Shows current adapter in a status pill.
2. **Model state actor.** Owns the loaded `ModelContainer`. Handles base-model initialization (once, from app bundle), adapter swap (runtime, <2 s), and inference invocations.
3. **Gemma 4 tool-token stream parser.** Reads the streaming decoder output, buffers until a complete `<|tool_call|>…<|tool_response|>` pair is captured via regex, JSON-decodes the call, dispatches to the `ToolRegistry` actor, injects the response back into the decoder, continues generation.
4. **ToolRegistry actor.** Wraps a single `JSContext`. Registers the native bridges at init (console.log, nativeFetch, device time, storage). Loads agent-provided JS tool bodies via `evaluateScript`. Enforces the `requiresNetwork` flag against `NWPathMonitor` state. Invokes tools via `JSValue.call(withArguments:)` and returns stringified JSON.
5. **Chat view + tool-call message bubble.** SwiftUI list renders assistant messages, user messages, and a distinct "tool-call" message type that shows tool name, arguments (collapsed), and result.
6. **Adapter-tools bundle loader.** At adapter-swap time, reads `adapter-tools.json` (shipped next to `adapter.safetensors`), registers each `DynamicTool` into the `ToolRegistry`.

### 8.3 Adapter hot-swap mechanism

Critical path. The canonical reference is `mlx-swift-examples/Tools/llm-tool/LoraCommands.swift`. The app ships with the base weights already resident in the bundle; model initialization is a one-time cost that happens at app launch (off the demo clock). At demo time:

- Training completes on the laptop → `mlx_lm.fuse` writes `adapter.safetensors` to local disk (total ~60 MB).
- Laptop executes `xcrun devicectl device copy to --device <UDID> --domain-type appDataContainer --domain-identifier <bundle-id> ./adapter.safetensors /Documents/adapter.safetensors` over USB-C. This completes in under 3 seconds for a 60 MB file.
- The Swift app's adapter loader UI detects the new file, calls `LoRATrain.loadLoRAWeights`, and the next inference uses the new weights. Total hot-swap latency: ~2 seconds.
- If the fuse step fails for any reason, the adapter-only path (no fuse, load the adapter directly over the quantized base) also works — verify this code path during the smoke test in §14 Hour 2.

### 8.4 Offline enforcement

The `ToolRegistry` actor observes `NWPathMonitor`. When the path status is not `.satisfied` (airplane mode enabled), any tool invocation with `requiresNetwork: true` returns a structured error payload `{"error":"This tool requires network. Device is offline."}` instead of dispatching to `JSContext`. The student model, at training time, has seen examples where such errors are the tool_response and has learned to interpret them and respond gracefully ("I'd need to check the live price, which isn't available offline — but I can tell you the logic for how this calculation works").

### 8.5 Proving offline on stage

1. iPhone is in airplane mode before walking on stage.
2. Guided Access is enabled (triple-click home to lock the app). Prevents accidental Control Center swipes.
3. The Control Center is shown to the audience once at the start: orange airplane-mode icon, Wi-Fi off, Bluetooth off, held for 2 full seconds.
4. Mirror is **wired** USB-C → HDMI → capture card → OBS. AirPlay will not work in airplane mode; this is the only option.
5. A `NWPathMonitor` status pill is visible in the app UI at all times: green "ONLINE" or red "OFFLINE — AIRPLANE MODE".

---

## 9. Dynamic Tool System

### 9.1 What a tool is

A tool, from the agent swarm's perspective, is an object with:

- **`name`** — camelCase identifier, unique per session.
- **`description`** — prose usable by the student model to decide when to invoke.
- **`schema`** — JSON Schema (derived from Zod on the orchestrator) describing arguments.
- **`jsBody`** — a literal JavaScript function body as a string. Named function, arguments object, returns JSON-serializable object. Written by the tool-design agents, validated and test-executed on the orchestrator side.
- **`requiresNetwork`** — boolean. `true` if the tool needs internet (price lookup, API fetch). `false` if it is pure or uses only shipped corpora (search over bundled docs, date math, formatting).
- **`exampleTrajectories`** — array of 3–5 short trajectories showing correct usage. Becomes training data.

### 9.2 How agents produce tools

The Tool-Design Swarm (4 workers, parallel) receives the Discovery output as context. Each worker's prompt includes:

- The product's documentation summary.
- The list of tool templates already committed (prevents duplicates).
- Explicit constraints on what the JS body can assume is in scope: `CORPUS` (a pre-shipped object of bundled content), `fetch` (native-bridged, only usable if `requiresNetwork: true`), `console`, `Date`, standard JS built-ins.
- A contract that every tool must have 3+ example trajectories.

Workers produce Zod schemas on the orchestrator side (validated at runtime via `zodToJsonSchema`), write the JS body as a string, and declare `requiresNetwork`. The coordinator aggregates, deduplicates by name, caps the tool set at 12 tools, and proceeds.

### 9.3 Tool validation before shipping

Before any tool becomes part of the training data:

1. **Schema well-formedness.** `jsonschema.validate` the schema itself.
2. **JS body syntax.** Parse the string with `acorn` or similar; reject on syntax error.
3. **Sandboxed execution.** Load the JS body into a Node.js `node:vm` `Worker` thread with a 2-second `AbortController` timeout and a 64 MB memory cap. Do not use `eval`. Do not use E2B or WebContainers — they add latency and external dependency for no gain on trusted internal output.
4. **Fuzz test.** Generate 10 random inputs that conform to the JSON Schema. Invoke the tool function. None may throw. At least 8 must return a well-formed JSON-serializable object.
5. **Trajectory self-consistency.** For each example trajectory, run the JS body with the stated `call.arguments` and confirm the return value matches the stated `result`. Reject trajectories where they disagree.

Any tool failing any gate is rejected outright — the worker is re-prompted with the specific failure. No auto-fix.

### 9.4 Shipping

At the end of the data-gen stage, the orchestrator writes `adapter-tools.json`: a manifest listing every tool's name, description, schema, `jsBody`, and `requiresNetwork`. This file is copied to the iPhone alongside `adapter.safetensors` via `devicectl`. The Swift app loads it on adapter-swap, registers each tool into the `ToolRegistry`.

### 9.5 Offline vs. online tool routing

At tool-call time on device:

- The `ToolRegistry` looks up the tool by name.
- If the tool has `requiresNetwork: false`, it is dispatched immediately into `JSContext`.
- If the tool has `requiresNetwork: true`, the registry checks the current `NWPathMonitor` status. If offline, it returns the structured error payload. If online, it dispatches normally — `JSContext` has `fetch` natively bridged via `URLSession`, so the JS body's `await fetch(...)` works transparently.
- The student model, at training time, has been trained on both success cases (`requiresNetwork: true` tool + online) and failure cases (`requiresNetwork: true` tool + offline), so it handles both gracefully at inference.

### 9.6 Demo narrative

This gives us the story: _"The agents decided this tool needed network. You're in airplane mode. Watch it refuse gracefully — and then invoke the offline tool correctly."_ Rehearsed as a 10-second beat.

---

## 10. Orchestration Pattern (Coordinator/Worker)

### 10.1 Why this pattern

Lifted from Claude Code's source via the `claude-code-explorer` MCP server. Read `coordinator/coordinatorMode.ts`, `tools/AgentTool/runAgent.ts`, `tools/shared/spawnMultiAgent.ts`, and `Tool.ts`. Proven pattern in a production agent system.

### 10.2 Key rules

1. The **coordinator** only orchestrates and synthesizes. It does not do work itself. Every substantive task is delegated to a worker.
2. **Workers** are single-purpose, given a tightly-scoped prompt and a narrow tool allowlist. They run to completion and return via an async notification — not via tool-result return values.
3. Parallel launching is explicit: the coordinator issues multiple spawn-worker tool calls in a single assistant message. Each spawn kicks off a worker that runs concurrently.
4. **Read-only tasks run parallel freely.** Discovery, data-gen, eval-gen are all read-only — no limit on concurrency except API rate limits (managed via `p-limit(15)`).
5. **Write-heavy tasks serialize.** Training is a single subprocess. Fuse is a single subprocess. Device copy is a single subprocess. The coordinator runs these sequentially.
6. Worker results arrive as `<task-notification>` messages — a Claude-Code-style XML envelope with `taskId`, `status`, `summary`, `result`, and `usage`. These render in the UI as individual completion cards with token counts and duration.
7. Workers cannot see each other's conversation. Every worker prompt is self-contained with the full context it needs. The coordinator reads worker outputs and synthesizes — never delegates that synthesis to another worker.
8. Workers can be continued (same worker, loaded context preserved) via a separate `sendMessage` tool. Cheaper than spawning fresh.

### 10.3 Worker roles and tool allowlists

| Role          | Allowed tools                                                                     | Purpose                                           |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Discovery     | `fetchLlmsTxt`, `fetchGithubTree`, `webSearch`, `scrapeSitemap`, `chunkAndIndex`  | Map the product's surface and populate the corpus |
| Tool-Design   | `validateJsBody`, `testFuzzExecute`, `generateZodSchema`, `writeToolSpec`         | Produce DynamicToolSpec objects                   |
| Data-Gen-QA   | `personaSample`, `genstructPrompt`, `judgeFaithfulness`, `embedDedup`             | Synthesize grounded Q&A pairs                     |
| Data-Gen-Traj | `chainToolBlueprint`, `roleplayTrajectory`, `validateAgainstSchema`, `embedDedup` | Synthesize tool-call trajectories                 |
| Eval-Gen      | `splitDocsTrainEval`, `bflcASTMatch`, `generateHeldOut`, `judgeJury`              | Build the held-out evaluation set                 |

### 10.4 UI contract

The orchestrator writes a single `createUIMessageStream` with N parallel workers merged via `writer.merge({ sendStart: false, sendFinish: false })`. Every worker writes `{type:'data-agent-status', id, data:{lane, role, status, step, lastLine}, transient: true}` on each meaningful state change. Terminal results flow as `{type:'data-task-notification', data:{...}, transient: false}` — these persist; status messages do not. The React client uses `useChat({onData})` and routes by worker `id` into a 5×4 grid of `AgentCard` components.

### 10.5 Training-loss streaming

The SFT and GRPO subprocesses are spawned via Node `child_process.spawn` with `PYTHONUNBUFFERED=1`. A `readline` wrapper reads stdout, matches the `Iter N: Train loss X` pattern with regex, and writes `{type:'data-train', data:{iter, loss}, transient: true}` to the same message stream. Recharts on the client plots the curve live. GRPO emits a `reward` field instead; the same chart overlays both.

---

## 11. Evaluation Design

### 11.1 Goals

Produce three numbers — base model score, tuned model score, teacher model score — that the audience can glance at and understand in under 5 seconds. Back them with enough rigor that a skeptical reviewer cannot dismiss them.

### 11.2 Document split

Deterministic split at the document level, not the Q&A level. 70% of source documents are "train-eligible" and feed the data-gen swarm. 30% are "held-out" and are only seen by the Eval-Gen Worker. Hash-based splitter so the same corpus produces the same split across runs. This prevents the obvious leakage where the same doc appears in both training and eval.

### 11.3 Eval set composition

| Bucket                | Count | Format                                                                                        |
| --------------------- | ----- | --------------------------------------------------------------------------------------------- |
| Factual Q&A           | 40    | Short-answer, grounded in held-out docs                                                       |
| Reasoning Q&A         | 10    | Multi-hop over held-out docs                                                                  |
| Single-turn tool-call | 15    | BFCL-style: given a user query and tool list, assert correct tool name and argument AST match |
| Multi-turn tool-call  | 5     | 2–4 turns, assert correct trajectory                                                          |

Total: 70 items. Small enough that the three-way run completes in under 3 minutes with parallel judge calls; large enough to give non-trivial statistical power.

### 11.4 Generator/judge split (anti-leakage)

- **Generator:** GPT-5 (not Claude Opus 4.7, which did the training data). Cross-family.
- **Judges:** Claude Opus 4.7 + Gemini 2.5 Pro. Two-judge jury, scores averaged. Disagreements over one Likert point are logged.
- **Grading rubric:** 0–4 Likert × 4 dimensions (correctness, groundedness, completeness, tool-validity). Rendered to a single 0–1 float per item via normalized average.
- **Prompt discipline:** judges are randomly shown the answers in shuffled column order so positional bias is neutralized. Temperature = 0.

### 11.5 Tool-call AST match

For tool-call eval items, the rubric is strict:

- Tool name must exactly match.
- Arguments must pass `jsonschema.validate` against the ground-truth schema.
- For arguments that have a canonical "correct" value (e.g., `{table: "users"}`), exact match is required.
- For arguments that have degrees of freedom (e.g., `{limit: 10}` vs `{limit: 20}`), only schema conformance is required, and the judge assigns partial credit.

### 11.6 Three-way visualization

The scoreboard shows three horizontal bar charts stacked: Base Gemma 4 E4B (expected ~30–40%), Tuned (expected ~75–90%), Teacher Opus 4.7 (expected ~92–96%). Below each bar: the exact numeric score to 1 decimal. Below the set: a latency comparison (on-device compute-only ms vs. frontier round-trip ms). A small asterisk clarifies that on-device is compute-only and cloud is compute + network — the asymmetry is the point, not a bug.

### 11.7 Latency stopwatch

On-device: measure time-to-last-token for a fixed prompt via the app's own stopwatch. Display in ms. Cloud: measure the same prompt's round-trip via AI SDK from the laptop. Running these two numbers side by side during the scoreboard reveal makes the offline story concrete.

---

## 12. Observability (Sentry Integration)

### 12.1 Why Sentry

`@sentry/nextjs` ≥ 9.29.0 auto-enables `Sentry.vercelAIIntegration()`, which captures every AI SDK v5/v6 call as a `gen_ai` span with model, token counts, tool calls, and duration. This turns a hidden 20-minute pipeline into a visible audit trail. As a secondary screen during the demo, the Sentry dashboard is a second scoreboard.

### 12.2 Instrumentation points

- **Root init.** `Sentry.init({ integrations: [Sentry.vercelAIIntegration()] })` in `instrumentation.ts`. Auto-captures every teacher call, every worker agent inference.
- **Custom per-worker span.** Wrap each worker's `agent.generate` in `Sentry.startSpan({ name: 'worker.${role}', op: 'ai.agent' })`. Attach the worker's lane and prompt hash as span attributes.
- **Custom training spans.** `Sentry.startSpan({ name: 'training.sft' })` and `training.grpo`. Stream per-iteration loss and reward as span attributes — queryable post-hoc.
- **Custom tool-validation spans.** Each `node:vm` sandbox execution becomes a span. Failures are captured as breadcrumbs.
- **Error capture.** Any uncaught exception in any worker or subprocess goes to Sentry. Seer provides stack-trace analysis on the next reload.

### 12.3 Not worth doing (given 12-hour budget)

- Swift Sentry SDK integration on iOS. No `gen_ai` equivalent exists for mlx-swift; general crash capture is nice-to-have but not demo-critical.
- Session Replay. Overkill for a single-operator demo.
- Sentry MCP server. Adds complexity without showcase value.

---

## 13. Technology Stack

### 13.1 Languages and runtimes

- **Node.js ≥ 20** for the Next.js app and orchestrator.
- **Python 3.12** for mlx-lm CLI environment (no Python code is authored by the user; it is a pinned interpreter for the subprocesses).
- **Swift 5.9 / Xcode 16** for the iOS app.
- **iOS 18 minimum deployment target.**

### 13.2 Key packages

| Package                     | Version                | Role                                                                       |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `mlx-lm`                    | 0.31.2 (April 7, 2026) | SFT training, generation, fuse                                             |
| `mlx-lm-lora`               | 0.1.0                  | GRPO / DPO / RL extensions                                                 |
| `ai` (Vercel AI SDK)        | v6.x                   | `ToolLoopAgent`, `createUIMessageStream`, `writer.merge()`                 |
| `@ai-sdk/anthropic`         | latest                 | Claude Opus 4.7 provider                                                   |
| `@ai-sdk/openai`            | latest                 | GPT-5 provider                                                             |
| `@ai-sdk/google`            | latest                 | Gemini 2.5 Pro provider                                                    |
| `next`                      | 15.x                   | App Router, Route Handlers (`runtime='nodejs'` required for child_process) |
| `@sentry/nextjs`            | ≥ 9.29.0               | Auto gen_ai spans                                                          |
| `zod`, `zod-to-json-schema` | latest                 | Tool schema validation                                                     |
| `p-limit`                   | 6.x                    | Concurrency ceiling                                                        |
| `recharts`                  | latest                 | Loss curve, eval bars                                                      |
| `eventsource-parser`        | latest                 | For tailing Python CLI stdout                                              |
| `chokidar`                  | latest                 | Watch adapter output dir                                                   |
| `jsonschema`                | latest                 | Tool JSON Schema validation                                                |
| `datasketch`                | latest (Python)        | MinHash dedup in data-gen                                                  |

### 13.3 Swift side

- `mlx-swift-lm` 3.x — core LM library (decoupled from examples in April 2026 split).
- `swift-tokenizers-mlx` ≥ 0.1.0 — tokenizer adapter.
- `swift-hf-api-mlx` ≥ 0.1.0 — model download adapter.
- `JavaScriptCore` — Apple built-in framework; no SPM dependency.
- `Network` — Apple built-in for `NWPathMonitor`.

### 13.4 CLI tools

- `mlx_lm.generate`, `mlx_lm.lora`, `mlx_lm.fuse`, `mlx_lm.server` — all from `mlx-lm[train]`.
- `mlx_lm_lora.train` — from `mlx-lm-lora`.
- `xcrun devicectl` — Xcode 16 command-line for on-device file copy.

---

## 14. Execution Plan — Saturday, 12 Hours

**Friday pre-staging time has been lost. All critical validation work moves into Saturday. This is aggressive.** The plan below assumes a hard start at H0 and hard demo time at H12. Every hour has a kill-point.

### H0 (Hour 0) — Environment + Critical Benchmark

- Set up Python 3.12 venv, install `mlx-lm[train]==0.31.2` and `mlx-lm-lora==0.1.0`.
- Set up Next.js 15 app, install AI SDK v6, Sentry, providers. Single smoke hit to Claude Opus 4.7 via `generateText`.
- Clone `mlx-swift-examples`. Open `LLMEval` in Xcode. Change `modelConfiguration` to `unsloth/gemma-4-E4B-it-UD-MLX-4bit`. Build to iPhone 17 simulator.
- **Critical micro-benchmark (runs during the above):** `mlx_lm.lora --model unsloth/gemma-4-E4B-it-UD-MLX-4bit --train --iters 50 --batch-size 2 --num-layers 16 --max-seq-length 1024 --grad-checkpoint --steps-per-report 5 --learning-rate 1e-5 --adapter-path ./bench` on a hand-written 20-example JSONL. Record sec/iter and peak memory.
- **Kill-point (end of H0):** If micro-bench shows peak memory > 20 GB → switch entire spec to **Gemma 4 E2B** immediately. Do not proceed with E4B. Ping the orchestrator config, re-download weights, re-run the bench.

### H1 — iPhone Deploy + Adapter Hot-Swap Smoke

- USB-C deploy LLMEval to physical iPhone 17. First launch downloads ~3 GB base weights into app sandbox. Confirm download completes, app launches, one prompt generates.
- Enable airplane mode on iPhone. Re-prompt. Confirm generation still works from sandbox cache.
- Take the 50-iter adapter from H0 bench, run `mlx_lm.fuse`. Copy `adapter.safetensors` to iPhone `/Documents/` via `xcrun devicectl`. Add a basic "Load adapter" button to the app. Call `LoRATrain.loadLoRAWeights`. Confirm behavior changes vs. base model.
- **Kill-point (end of H1):** If adapter hot-swap does not work end-to-end on device, fall back to adapter-only code path (no fuse). If that also fails, entire live-training story is dead — Tier 3 cassette becomes the plan.

### H2 — JSContext + Gemma Tool-Token Parser

- Build the `ToolRegistry` actor in Swift. Register `nativeFetch` and `console.log` bridges. Test a trivial inline JS tool (hand-written, not agent-generated) round-trips correctly: Swift → JS → return → Swift.
- Build the `GemmaToolParser`. Force the unmodified E4B to emit a `<|tool_call|>` token by constructing a prompt with a tool definition in context. Verify the regex captures and JSON decodes.
- Wire parser + registry: model emits `<|tool_call|>`, parser catches, registry dispatches JS, result injected back as `<|tool_response|>`, generation continues.
- **Kill-point (end of H2):** If tool round-trip does not work on device, the dynamic-tool story collapses. Fall back to static pre-baked tools (hand-written Swift functions matching a fixed schema) — still demonstrable, less impressive.

### H3 — Orchestrator UI Skeleton + Coordinator/Worker Harness

- Build `/api/pipeline` route in Next.js with `createUIMessageStream` and `writer.merge`.
- Implement the `spawnWorker` tool (AI SDK v6 `ToolLoopAgent`-based). Emit `data-agent-status` and `data-task-notification` parts. Wire Sentry `startSpan` around it.
- Build the client `useChat({onData})` that routes status events by worker `id` into a 5×4 `AgentCard` grid.
- Wire a second route `/api/train` that spawns `mlx_lm.lora` subprocess and streams loss to `data-train` parts. Render with Recharts.
- **Kill-point (end of H3):** No functional streaming UI → demo polish is degraded but not dead. Continue with a minimal UI.

### H4 — Real Supabase Discovery + Tool Design

- Discovery Worker fetches `supabase.com/llms.txt`, `supabase.com/llms/cli.txt`, `supabase.com/llms/guides.txt` (~4 MB, chunk into ~500-token windows). Index into a `CORPUS` object.
- Tool-Design Swarm (4 parallel workers) produces 8–12 tool specs. Each spec goes through full validation (schema well-formedness, JS syntax parse, `node:vm` fuzz-test, trajectory self-consistency).
- Write `adapter-tools.json`.
- **Kill-point (end of H4):** < 4 validated tools → hand-write 4 known-good Supabase tool specs as backstop. Common tools for any domain: `searchKnowledge`, `lookupRecord`, `filterList`, `formatResponse`.

### H5 — Data Generation (parallel fan-out begins at H5:00)

- Data-Gen-QA Worker produces 500 grounded Q&A via Genstruct × PersonaHub. Runs with `p-limit(15)` on Opus 4.7. Judge-gated with GPT-5.
- Data-Gen-Traj Worker produces 1,000 single-turn trajectories + 200 multi-turn. Runs in parallel with QA. Every trajectory's tool call must pass `jsonschema.validate` against shipped schemas.
- Eval-Gen Worker produces 70 held-out items on the 30% doc split. Uses GPT-5 as generator (cross-family).
- Dedup pass: MinHash + embedding cosine.
- **Kill-point (end of H5):** < 1,200 valid training examples → proceed anyway with what we have. Smaller dataset, smaller quality gain, but pipeline still runs.

### H6 — SFT Training Run (Model A — Supabase)

- Write training JSONL from data-gen outputs.
- Kick off `mlx_lm.lora` with §6.2 config, 400 iters. Loss streams to UI. Expected wall-clock: ~12 minutes.
- At minute ~12, SFT completes. Kick off `mlx_lm_lora.train --train-mode grpo` on the SFT output. Expected wall-clock: ~5 minutes.
- **Kill-point (end of H6):** Loss NaN or divergence → revert to last 100-iter checkpoint and continue. If unrecoverable, skip GRPO and ship SFT-only Model A.

### H7 — Fuse, Deploy, Verify on Device

- `mlx_lm.fuse` merges the final adapter. `xcrun devicectl` copies `adapter.safetensors` + `adapter-tools.json` to iPhone.
- On device: load the adapter, register tools, run a battery of test prompts. Verify:
  - Correct Supabase-specific answer to "Write an RLS policy for a users table."
  - Correct tool invocation for "Show me the schema for the profiles table."
  - Graceful refusal for `requiresNetwork: true` tool with airplane mode on.
- Record a 90-second screen capture of the working demo as **Tier 3 cassette backup**. Triple-back this up (laptop, USB stick, iPhone Photos).
- **Kill-point (end of H7):** Verified working demo on device — this is the Tier 2 guarantee. From here, everything is polish.

### H8 — Evaluation Harness (3-way) + Scoreboard

- Run base model, tuned model, and teacher in parallel across all 70 eval items. Cloud calls via AI SDK; on-device via the app's inference API (exposed as a simple HTTP server for the eval harness to hit over USB-C).
- Judge jury (Opus 4.7 + Gemini 2.5 Pro) scores each response. Aggregate into per-model numeric scores.
- Wire the three-way bar chart to Recharts. Add latency stopwatch.
- **Kill-point (end of H8):** Scoreboard numbers don't show the expected gap (base < tuned < teacher) → investigate before proceeding. Likely culprit is judge prompt disagreement; fix rubric.

### H9 — Polish: Tool-Call Bubble, Sentry Dashboard, Pre-Cache

- SwiftUI `ToolCallBubble` view rendering intercepted tool calls inline in the chat.
- Sentry dashboard pre-loaded and visible as a secondary screen.
- **Pre-cache audience options.** Run the discovery + tool-design stages for Vercel AI SDK, Zod, and Hono (no training, no data-gen — just prep the first two phases so the audience-pick flow has something cached). If time is tight, cache only Vercel AI SDK.
- **Kill-point (end of H9):** No audience-option cache → constrain audience to "Vercel AI SDK only" in the demo script.

### H10 — Dry-Run #1 (Timed, Recorded)

- Full end-to-end dry run. Time it. Record it as a backup cassette (separate from H7 cassette — this one includes the live-training leg).
- Identify every jank: UI transitions that flash, delays that look unexplained, text that's hard to read from a projector.
- **Kill-point (end of H10):** Total runtime > 5:30 → cut stretch content (Sankey, dashboard). Target 4:30 hard.

### H11 — Fixes + Pre-Flight

- Apply fixes from H10 observations.
- Pre-flight checklist:
  - iPhone battery 100%, MagSafe cable connected to podium.
  - Guided Access enabled. Triple-click-to-exit passcode set.
  - Airplane mode on, Wi-Fi off, Bluetooth off, Cellular off. Double-check.
  - Two USB-C → HDMI dongles on hand. Test both with the projector.
  - Capture card + OBS scene tested.
  - Laptop on charger, `caffeinate -dims` running.
  - Second phone hotspot ready (for the laptop only, never the demo phone).
- **Kill-point (end of H11):** Any pre-flight item fails → Tier 3 cassette.

### H12 — Demo

---

## 15. Fallback Tiers

### 15.1 Tier 1 — Full Live (target probability ~40%)

- Model A (Supabase, trained during H6) runs as the warmup demo.
- Audience-picked Model B is live-trained during the demo narration in 17 minutes.
- Hot-swap to Model B at the 3:15 beat. Finale succeeds.
- Full scoreboard with real numbers.

### 15.2 Tier 2 — Partial Live (target probability ~50%)

- Model A runs as the warmup demo.
- Live training starts during narration but does not complete or does not deploy in time.
- Narration at 3:15 pivots: _"The live run is still fusing. Let me show you another side of Model A."_ Second Supabase prompt demonstrates breadth (a harder query, a multi-turn trajectory, a refusal on a `requiresNetwork` tool).
- Scoreboard shows the pre-run evaluation from H8.
- Still a winning demo — the live-training loss curve was visible on screen, the phone is offline, the tool call still fired.

### 15.3 Tier 3 — Cassette (target probability ~10%)

- Pre-recorded 90-second video from H7 plays on the laptop.
- Operator narrates over the cassette live. Emphasizes the airplane-mode iPhone which is still physically in the room.
- Q&A handles normally.
- Mic-drop close still lands: the thesis doesn't depend on the live run succeeding.

### 15.4 Decision tree during demo

- **T-5 min:** iPhone in airplane mode + mirrored via USB-C? If no → Tier 3.
- **01:35 during demo:** First agent worker lit up on UI? If no → silently shift to Tier 2 language, drop "live run" promises.
- **02:10 during demo:** Tool-call token emitted and parsed on device? If no → re-prompt once. If still no by 02:20 → Tier 3 immediately.
- **03:30 during demo:** New adapter loaded on phone for Model B? If no → Tier 2 (second Model A prompt).
- **04:00 during demo:** Close. Always live. Cassette or not, the operator's mouth is moving.

---

## 16. Risk Register

Likelihood × Impact (1–5). Ranked by score.

| #   | Risk                                                                                        | L   | I   | Score | Mitigation                                                                                                                    | Kill-switch                                                                  |
| --- | ------------------------------------------------------------------------------------------- | --- | --- | ----- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R1  | Gemma 4 E4B QLoRA OOMs on M4 Pro 24 GB (no public benchmark on this exact hardware)         | 3   | 5   | 15    | H0 micro-bench drives the decision                                                                                            | > 20 GB peak → switch to E2B immediately                                     |
| R2  | Total SFT + GRPO > 17 min                                                                   | 4   | 5   | 20    | H0 bench drives iter count. 400 SFT + 150 GRPO is the aggressive target                                                       | 02:00 into demo and < 30% progress → auto-fall-back to Model A second prompt |
| R3  | Venue Wi-Fi flakes, teacher API stalls pipeline                                             | 4   | 4   | 16    | Hotspot from 2nd phone; ethernet dongle tertiary. All three audience options pre-cached at H9                                 | > 30s stall on any stage → cached outputs                                    |
| R4  | Gemma 4 tool-call format drift (Jackrong caveat)                                            | 4   | 4   | 16    | Fine-tune explicitly on well-formed trajectories. Strict stream parser. BFCL-AST eval enforces exactness                      | Model A uses same format, fall back if Saturday Model B drifts               |
| R5  | Solo operator cognitive overload (narrate + watch + click)                                  | 4   | 4   | 16    | 8 memorized guidepost phrases. Auto-advancing scoreboard transitions                                                          | If lost → "while that runs, here's the punchline" → close                    |
| R6  | iPhone adapter hot-swap fails mid-demo                                                      | 3   | 5   | 15    | USB-C primary, AirDrop secondary (briefly un-airplaning 2nd phone), Model A resident tertiary                                 | 03:30 no swap → second Model A prompt, honest narration                      |
| R7  | USB-C → HDMI dongle fails                                                                   | 3   | 5   | 15    | Two dongles on hand, pre-tested. OBS scene with "placeholder phone still" ready                                               | Hold phone toward front row, narrate                                         |
| R8  | JSContext OOM crash on iPhone (Apple-documented `pas_panic_on_out_of_memory_error` pattern) | 2   | 5   | 10    | One JSContext per request, release after. Pre-warm full tool suite in H2                                                      | Tool call fails → model answers without tool, move on                        |
| R9  | Teacher 429 rate-limits sustained                                                           | 3   | 4   | 12    | Dual keys Anthropic + OpenAI + Gemini. `p-limit(15)` + exp backoff. Gemini 2.5 Pro 4M TPM as safety valve                     | Scoreboard "cached stage" badge, continue                                    |
| R10 | Airplane mode toggled off accidentally                                                      | 2   | 5   | 10    | Guided Access triple-click. Case covers Control Center edge                                                                   | Wi-Fi symbol appears → "re-arming" + triple-click. Twice → Tier 3            |
| R11 | Gemma 4 E4B OOMs on iPhone 17 inference                                                     | 2   | 5   | 10    | `increased-memory-limit` entitlement. Pre-warm in H1. KV cache q4_0                                                           | Force relaunch (8s) → Model A prompt                                         |
| R12 | Laptop thermal throttle or sleep during training                                            | 2   | 5   | 10    | `caffeinate -dims`. External fan. Plugged in.                                                                                 | "Thermal pause" on scoreboard → pivot narration                              |
| R13 | Training loss NaN or divergence                                                             | 2   | 5   | 10    | Grad clip on. Checkpoint every 100 iters. Revert on divergence                                                                | Spike visible → "that's why we have Friday" → Model A                        |
| R14 | Audience picks unexpected option                                                            | 3   | 3   | 9     | Constrain to 3 pre-cached (or 1 if H9 ran short). Don't offer open choice                                                     | Only show what's cached                                                      |
| R15 | Pre-recorded cassette file won't play                                                       | 1   | 5   | 5     | Triple-backup (laptop, USB, iPhone Photos)                                                                                    | Narrate from memory over a screenshot                                        |
| R16 | iPhone battery dies                                                                         | 1   | 5   | 5     | 100% charged, MagSafe wired, spare iPhone with same build                                                                     | Silent swap                                                                  |
| R17 | Friday work cut forces a broken smoke path into demo                                        | 4   | 4   | 16    | H0–H2 are explicitly smoke-test gates; kill-points mandate demotion to lower tier rather than continuing on broken foundation | Honest narrator discipline                                                   |

---

## 17. Pre-Staged Target Product

### 17.1 Primary: Supabase

Chosen for Saturday Model A training because:

- Rich documentation corpus published at `supabase.com/llms.txt`, `supabase.com/llms/cli.txt`, `supabase.com/llms/guides.txt`. Zero authentication required.
- `llms/guides.txt` alone is ~4 MB — more than enough for 500 grounded Q&A with diversity.
- Clean tool surface: database queries, RLS policies, auth, storage, realtime, edge functions — five distinct tool families yield 10+ meaningful agent-designed tools.
- Known developer vocabulary: the audience will recognize "RLS policy" as meaningful and challenging.
- GitHub repo at `github.com/supabase/supabase` — MDX docs, changelogs, issues all public.

### 17.2 Audience-pick options (pre-cached at H9)

In priority order:

1. **Vercel AI SDK** — `ai-sdk.dev/llms.txt`, `ai-sdk.dev/llms-full.txt`. Clean, single-fetch, CDN-fast. Natural tool surface (`streamText`, `generateObject`, tool loops).
2. **Zod** — `zod.dev/llms.txt`. Smaller corpus but very well-bounded. Tools around schema construction and inference.
3. **Hono** — `hono.dev/llms.txt`. Medium corpus. Tools around routing, middleware, typed handlers.

### 17.3 Explicitly excluded

- **willhaben** (Austrian classifieds) — auth-walled, scraping-hostile, risk of live failure.
- **bitpanda trading** — OAuth-walled API. Could demo the price-ticker public subset but not enough tool surface to be interesting.

---

## 18. De-Risk Checklist — Next 60 Minutes (Before H0)

Do these right now, before the hard start of H0. Each bought minute here saves ten during the build.

1. **Verify Claude Opus 4.7, GPT-5, and Gemini 2.5 Pro API keys.** Make one `generateText` call against each from the repo's environment. Confirm tier sufficient (Anthropic is the tightest at ~1M TPM; Gemini 2.5 Pro the loosest at 4M TPM).
2. **Check `mlc-ai/web-llm` issue #753 status.** If it closed in the last 48 hours with a confirmed fix, the E2B PWA path reopens as a wildcard option. Expected: still open.
3. **Download Gemma 4 E4B weights now.** `mlx_lm.generate --model unsloth/gemma-4-E4B-it-UD-MLX-4bit --prompt "hi" --max-tokens 2`. Starts the ~3 GB download in the background while you keep working.
4. **Confirm iPhone 17 is available, charged to 100%, and running iOS 18.2+.** If not, fix now.
5. **Test USB-C → HDMI → capture card pipeline with iPhone in airplane mode.** AirPlay fails in airplane mode; this is the only mirror path. Verify the exact hardware you will use on stage.
6. **Verify Xcode 16 is installed and signing works.** Attempt a trivial Swift app deploy to iPhone. If signing breaks today, fix now — Apple Developer account issues have killed more hackathon demos than bad code.
7. **Create the Sentry project.** Add DSN to `.env`. One manual `Sentry.captureException` test from local Next.js.
8. **Claim the presentation slot time.** Check demo schedule. Know exactly when H12 lands.
9. **Hotspot on second phone.** Not the demo phone. Test it. Keep it in the bag.
10. **Git repo initialized, first commit, pushed to remote.** Any work lost after this point is recoverable.

---

## 19. Deliverables for Claude Code Agents

### 19.1 Repository structure

```
/
├── app/                          (Next.js 15 App Router)
│   ├── api/
│   │   ├── pipeline/route.ts     (Coordinator/Worker SSE stream)
│   │   ├── train/route.ts        (SFT/GRPO subprocess management)
│   │   ├── eval/route.ts         (3-way eval runner)
│   │   └── adapter/route.ts      (fuse + devicectl trigger)
│   ├── (demo)/page.tsx           (agent grid + loss curve + scoreboard)
│   ├── layout.tsx
│   └── instrumentation.ts        (Sentry init)
├── lib/
│   ├── coordinator/              (worker roles, task-notification, p-limit)
│   ├── workers/                  (discovery, tool-design, data-gen, eval-gen)
│   ├── tools/                    (shared tool primitives)
│   ├── sandbox/                  (node:vm fuzz harness)
│   ├── judge/                    (cross-family jury)
│   └── streams/                  (SSE merge utilities)
├── ios/                          (Swift app — forked from mlx-swift-examples/LLMEval)
│   ├── SpecialistApp/
│   │   ├── SpecialistApp.swift
│   │   ├── ContentView.swift
│   │   ├── AdapterLoaderView.swift
│   │   ├── ChatView.swift
│   │   ├── ToolCallBubble.swift
│   │   └── ModelState.swift
│   ├── SpecialistCore/           (reusable library code)
│   │   ├── ToolRegistry.swift
│   │   ├── GemmaToolParser.swift
│   │   ├── DynamicTool.swift
│   │   └── OnlineMonitor.swift
│   └── SpecialistApp.xcodeproj
├── scripts/
│   ├── micro-bench.sh            (H0 benchmark command)
│   ├── train.sh                  (mlx_lm.lora with canonical config)
│   ├── grpo.sh                   (mlx_lm_lora.train GRPO config)
│   ├── fuse.sh                   (mlx_lm.fuse)
│   └── deploy-adapter.sh         (xcrun devicectl copy)
├── data/
│   ├── corpus/                   (Discovery outputs)
│   ├── tools/                    (generated adapter-tools.json candidates)
│   ├── training/                 (final JSONL)
│   └── eval/                     (held-out 30% split)
├── SPEC.md                       (this document)
├── .env.example                  (Anthropic/OpenAI/Google/Sentry keys)
├── package.json
├── requirements.txt              (mlx-lm, mlx-lm-lora, datasketch, jsonschema)
└── README.md
```

### 19.2 What to build in order (mirrors §14)

1. Next.js scaffold + Sentry + single Opus smoke test.
2. Python venv + mlx-lm install + micro-bench.
3. Fork `mlx-swift-examples`. Point at Gemma 4 E4B. Build to iPhone. Confirm airplane-mode inference.
4. `ToolRegistry` + `GemmaToolParser` in Swift. Hand-written JS tool round-trip.
5. Toy QLoRA → fuse → devicectl copy → `LoRATrain.loadLoRAWeights` on device.
6. Coordinator/Worker pattern in Next.js with `createUIMessageStream`.
7. Discovery Worker + Tool-Design Swarm for Supabase.
8. Data-Gen Workers with judge-gated filtering.
9. Eval-Gen Worker with cross-family generator.
10. Full SFT + GRPO subprocess, streaming loss/reward to UI.
11. Fuse + deploy pipeline end-to-end for Model A.
12. Three-way eval harness + scoreboard UI.
13. Tool-call bubble SwiftUI view.
14. Audience-option pre-cache (discovery + tool-design only).
15. Dry-run, polish, pre-flight.

### 19.3 Acceptance criteria for each major component

**Coordinator/Worker harness.** Launches 4 parallel Discovery workers, each emits `data-agent-status` then `data-task-notification`. UI shows all 4 completing independently. Sentry dashboard shows 4 `worker.discovery` spans.

**Tool-Design Swarm.** Produces ≥ 8 validated `DynamicToolSpec` objects for Supabase. Every spec passes all four validation gates. `adapter-tools.json` written to disk.

**Data-Gen.** Produces ≥ 1,500 examples with ≥ 30 per tool. `jsonschema.validate` passes on every tool-call. MinHash + embedding dedup removes < 10% as duplicates.

**Eval-Gen.** 70 held-out items generated by GPT-5 from 30% doc split. No overlap with training docs verified by hash.

**SFT + GRPO.** Loss drops monotonically with expected variance. Final reward (GRPO) > initial reward. Adapter file written to `adapter.safetensors`.

**Fuse + Deploy.** Adapter copied to iPhone in < 5 seconds. App detects new file. Load completes in < 2 seconds. Subsequent inference behaves differently from base.

**On-device inference.** Gemma 4 E4B generates at ≥ 40 tok/s on iPhone 17 in airplane mode. Tool-call token is parsed and dispatched to `JSContext`. Result is injected back, generation continues, coherent final answer emitted.

**Three-way eval.** Base score < Tuned score < Teacher score. All three numbers render on the scoreboard with sub-second refresh. Latency stopwatch shows on-device < cloud.

### 19.4 Must-follow conventions

- **Do not add any PWA, WebLLM, transformers.js, or llama.cpp paths.** They are confirmed to not work at the required model size on the target device. Every hour spent on them is an hour lost.
- **Do not replace mlx-lm with anything else.** No HuggingFace Transformers + MPS, no Axolotl, no LLaMA-Factory. Their M4 Pro support is not what mlx-lm's is.
- **Do not store anything sensitive in training data.** The student model will leak verbatim from its training set; any API keys, customer data, or secrets in the corpus will surface at inference.
- **Do not auto-format agent-generated JS tool bodies.** Validation means reject-don't-fix. A patched body is a body the training data did not see.
- **Do not cache-break the base model download on iPhone.** The 3 GB base download is a one-time cost. Keep it identical across builds so the bundle-resident weights remain valid.
- **Do not use E2B, WebContainers, or CodeSandbox for tool sandboxing.** `node:vm` with `worker_threads` is sufficient for 12 hours and has zero external dependency.
- **Do not introduce a separate judge model per dimension.** Two judges (Opus + Gemini) × four dimensions is eight calls per eval item × 70 items × 3 models = 1,680 judge calls. Already expensive. Per-dimension multi-judge is out of budget.
- **Do not attempt to train Gemma 4 E4B audio or vision modalities.** Text-only. Vision encoder adds memory pressure; audio requires additional preprocessing. The demo is text.
- **Do not fine-tune for longer than 20 minutes wall-clock.** If training runs long, iterate on the iter count, not the time budget.

---

## 20. References

All primary sources, verified April 17, 2026.

### Model and Training

- Gemma 4 launch blog — https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/
- Hugging Face Gemma 4 integration blog — https://huggingface.co/blog/gemma4
- `unsloth/gemma-4-E4B-it-UD-MLX-4bit` — https://huggingface.co/unsloth/gemma-4-E4B-it-UD-MLX-4bit
- `unsloth/gemma-4-E2B-it-UD-MLX-4bit` — https://huggingface.co/unsloth/gemma-4-E2B-it-UD-MLX-4bit
- Jackrong Gemopus benchmarks (iPhone 17 Pro Max 45–60 tok/s) — https://www.gncrypto.news/news/jackrong-gemma4-gemopus-local-edge-models/
- deadbydawn101 M4 Max LoRA (6 min / 1000 iter / 7.9 GB peak) — https://huggingface.co/deadbydawn101/gemma-4-E4B-mlx-4bit
- Unsloth Gemma 4 training guide — https://unsloth.ai/docs/models/gemma-4/train
- `mlx-lm` — https://pypi.org/project/mlx-lm/ · https://github.com/ml-explore/mlx-lm
- `mlx-lm-lora` (GRPO/DPO/DAPO extensions) — https://github.com/Goekdeniz-Guelmez/mlx-lm-lora · https://pypi.org/project/mlx-lm-lora/
- mlx-lm `tools` format documentation — https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md

### On-Device Runtime

- `mlx-swift-examples` — https://github.com/ml-explore/mlx-swift-examples
- `mlx-swift-lm` 3.x (new extracted library) — https://github.com/ml-explore/mlx-swift-lm
- `LoRATrain.loadLoRAWeights` reference — https://github.com/ml-explore/mlx-swift-examples/blob/main/Tools/llm-tool/LoraCommands.swift
- `web-llm` iOS 26 crash issue (evidence for PWA exclusion) — https://github.com/mlc-ai/web-llm/issues/753
- Apple JavaScriptCore (NSHipster) — https://nshipster.com/javascriptcore/
- Apple Developer docs — JavaScriptCore framework (built-in)
- `NWPathMonitor` — Apple Network framework built-in

### Orchestration and Observability

- Vercel AI SDK v6 beta announcement — https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta
- Sentry Vercel AI integration — https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/vercelai/
- Claude Code coordinator/worker pattern — read directly via `claude-code-explorer` MCP (`coordinator/coordinatorMode.ts`, `tools/AgentTool/runAgent.ts`, `tools/shared/spawnMultiAgent.ts`, `Tool.ts`)

### Data Source Targets

- Supabase docs index — https://supabase.com/llms.txt
- Supabase CLI docs — https://supabase.com/llms/cli.txt
- Supabase guides — https://supabase.com/llms/guides.txt
- Vercel AI SDK llms file — https://ai-sdk.dev/llms-full.txt
- Zod llms file — https://zod.dev/llms.txt
- Hono llms file — https://hono.dev/llms.txt

### Evaluation Methodology

- Cross-family judge preference leakage — arXiv 2502.01534
- BFCL (Berkeley Function Calling Leaderboard) — https://gorilla.cs.berkeley.edu/leaderboard.html

---

**End of SPEC. Begin build at H0.**
