# Domain Pitfalls — Offline Specialist-LLM Pipeline

**Domain:** Live-training + on-device LoRA adapter hot-swap, agent-authored JS tools, offline iPhone inference.
**Researched:** 2026-04-18 (H<1, 6-hour coding window remaining)
**Supplementary to:** `PRD_SPEC.md` §14 kill-points, §16 Risk Register (R1–R17), §19.4 conventions.

**Researcher-honesty note:** Assistant knowledge cutoff is January 2025. PRD cites April 2026 releases (AI SDK v6, mlx-lm 0.31.2, mlx-lm-lora 0.1.0, mlx-swift-lm 3.x split, iOS 18.2+, iPhone 17/A19, Xcode 16, @sentry/nextjs 9.29.0, Gemma 4). I cannot verify current-state claims against primary 2026 sources in this run. Confidence levels below reflect this gap. Items flagged **HIGH** are derived from stable pre-2025 platform behavior (JavaScriptCore, `node:vm`, `xcrun devicectl`, USB-C mirroring, solo-operator demo patterns) that does not plausibly break across versions. Items flagged **LOW** are PRD-asserted package specifics that I would verify via Context7 / official release notes if given time.

Ordering: impact × likelihood, descending. PRD risks are referenced as R#, not repeated.

---

## CRITICAL — Address at H0–H2

### P1. Gemma 4 `<|tool_call|>` tokenizer-special-token leakage during fine-tune (extends R4)
**Confidence:** MEDIUM (Gemma 3 / Llama 3 / Qwen2.5 have all exhibited this class of bug; Gemma 4 special-token set is new so risk is inherited.)
**Warning signs during H6 SFT:** training loss on tool-call examples plateaus higher than Q&A loss; after ~200 iters the student emits the literal string `<|tool_call|>` as BPE pieces rather than the single special-token id; eval BFCL-AST match rate < 20% despite SFT loss converging.
**Root cause:** when a tokenizer's chat-template emits special tokens, `mlx_lm.lora` must see them pre-encoded as their atomic ids, not re-tokenized from text. If Unsloth's `UD-MLX-4bit` tokenizer.json has the Gemma 4 tool tokens marked `special=true` but `mlx-lm`'s template renderer re-stringifies them before encoding, they tokenize as 6–8 BPE pieces and the model never learns the atomic emission.
**Prevention (H2 smoke, not H6):**
  - In H2, tokenize one training example with `mlx_lm.tokenizer.encode(apply_chat_template(...))` and print ids. Confirm `<|tool_call|>` resolves to a single special token id, not a sequence. If it splits, fix the template-render path before running H6.
  - Add an assertion in the data-gen pipeline: every training JSONL line, after tokenization, must contain the atomic `tool_call` id exactly where the `<|tool_call|>` marker appears in the rendered string.
**Phase:** H2 (tool-token parser smoke must also verify training tokenization).
**Source:** PRD §5.4 (Jackrong caveat); general pattern — HF issue tracker for Qwen2.5, Llama 3 tokenizer special-token bugs, 2024.

### P2. `mlx-lm-lora` 0.1.0 GRPO reward-function signature mismatch
**Confidence:** LOW (0.1.0 is a pinned version I cannot introspect; semver 0.1.x signals unstable API.)
**Warning signs at H6:** `mlx_lm_lora.train --train-mode grpo` exits immediately with `TypeError: reward_fn() takes 2 positional arguments but 3 were given` or similar; reward curve never starts.
**Likely root causes:**
  - Reward function expected signature is `(prompt, completion, **kwargs) -> float` or `(prompts: list, completions: list) -> list[float]`, but the teacher-judge wrapper returns a single averaged float. Batch vs single ambiguity.
  - Reward must be a Python callable passed via `--reward-fn-path some_file.py:func`. The PRD forbids authored Python — so the reward has to come via a CLI `--reward-server-url` or a subprocess stdin/stdout bridge. Verify the 0.1.0 README for which of these (CLI spec may be the only one).
**Prevention (H0):**
  - Within H0 micro-bench, run a 5-iter GRPO smoke with a trivial length-based reward (no teacher call) just to confirm the API handshake. Do this BEFORE H6.
  - If 0.1.0 only supports a Python reward file, author a thin `scripts/reward_bridge.py` that stdin-reads completions and stdout-writes floats — this is a runtime bridge, not application code. Document as exception in a comment.
**Phase:** H0 (5-iter smoke bolt-on to micro-bench), H6 (full run).
**Source:** PRD §13.2 (pins 0.1.0), general pattern from `trl.GRPOTrainer` reward API churn 2024-2025.

### P3. GRPO convergence failure at group size 4, seq 512, seed-dependent mode collapse
**Confidence:** MEDIUM (well-documented GRPO failure mode in DeepSeek / trl literature.)
**Warning signs:** reward curve flat or oscillating within ±0.02 of its starting value for the first 50 iters; all 4 group completions for a given prompt become identical (KL collapse); SFT→GRPO actually *regresses* BFCL-AST score.
**Root causes:**
  - Group size 4 is the minimum viable — variance in the reward is too low to produce a strong advantage signal. Exacerbated by a 0–1 float reward with judge quantization to ~5 distinct values.
  - Learning rate 5e-6 is conservative for SFT but can be too high for GRPO with a tight KL penalty; leads to policy drift then collapse.
**Prevention:**
  - Use 0–5 Likert × 4 dimensions averaged to get ≥20 distinct reward values (PRD §11.4 already does this for eval — reuse the rubric for GRPO reward).
  - Set explicit KL coefficient (usually `--beta 0.04` or 0.1 in GRPO configs) — do not rely on defaults.
  - Monitor reward variance per step in the UI alongside the reward mean; if variance < 0.01 for 10 steps, kill GRPO and ship SFT-only.
**Phase:** H6 (with telemetry), H8 if GRPO regressed, roll back to SFT checkpoint.
**Source:** DeepSeek-R1 paper on GRPO hyperparameters, 2025; trl GRPOTrainer documentation patterns.

### P4. mlx-swift-lm 3.x import-path breakage after April 2026 split
**Confidence:** LOW (PRD asserts the split happened; I cannot verify actual new module structure.)
**Warning signs:** Xcode 16 build errors `No such module 'MLXLLM'` / `'MLXLMCommon'`; `LoRATrain.loadLoRAWeights` not found on symbol lookup; Package.resolved reverts to pre-3.x version on every build.
**Prevention:**
  - At H1 start, `git clone --depth 1 https://github.com/ml-explore/mlx-swift-lm.git` and confirm the module name (historically it has been `MLXLLM` with `MLXLMCommon` sub-module). The 3.x split likely moves `LoRATrain` into its own target (e.g. `MLXLMTraining`) — grep `LoraCommands.swift` in the 3.x source to confirm.
  - Pin exact version in `Package.swift`: `.upToNextMinor(from: "3.0.0")` — do NOT use `.upToNextMajor`. API can break in 3.x→3.y during a young split.
  - If `loadLoRAWeights` was renamed (e.g. `applyLoRA`), diff `LoraCommands.swift` between last 2.x tag and HEAD to map the new API.
**Phase:** H1 (before any Swift code is written on top of it).
**Source:** PRD §13.3 (asserts 3.x split), general Swift Package Manager fragility patterns.

### P5. iPhone adapter-copy silent failure via `xcrun devicectl` on Xcode 16
**Confidence:** MEDIUM (devicectl has a known history of silent failures when app is backgrounded or when domain-identifier bundle-id is wrong.)
**Warning signs:** `xcrun devicectl device copy to` exits 0, but the file never appears in `/Documents/`; `chokidar` watcher never fires; adapter-loader UI shows empty list.
**Root causes (Xcode 15+ devicectl):**
  - `--domain-identifier` must exactly match the app's Info.plist `CFBundleIdentifier`, including team prefix in some iOS versions. Typos exit 0 but write nowhere visible.
  - If the app is not launched at least once since install, `appDataContainer` does not exist yet. devicectl creates an empty one and copies into it — but the real container used at runtime is different (this is an iOS 17+ regression reported on Apple DTS forums pre-2025).
  - USB-C cable with data-lines-not-present (common with MagSafe-style accessories) — devicectl falls back to… nothing. Fails.
**Prevention:**
  - In H1 smoke, after the first copy, `xcrun devicectl device info files --device <UDID> --domain-type appDataContainer --domain-identifier <bundle-id> /Documents` and assert the file is listed with correct byte size.
  - Require app to be foregrounded during copy (AppDelegate scene-active check). PRD §8 already has adapter-loader UI; keep it on-screen during H7 deploy.
  - Use the same verified USB-C data cable throughout H0–H11. Tape a label on it. Do not swap.
**Phase:** H1 adapter hot-swap smoke (PRD's H1 kill-point already covers detection; this pitfall is about the diagnosis).
**Source:** Apple DTS forum threads on devicectl `copy to` pre-2025; PRD §8.3.

### P6. `JSContext` retain-cycle + OOM on second adapter load (extends R8)
**Confidence:** HIGH (documented JavaScriptCore behavior since iOS 7; PRD §16 R8 cites `pas_panic_on_out_of_memory_error`.)
**Warning signs:** First adapter's tool calls work perfectly; after a hot-swap, tool calls either return stale results from the prior adapter's tools OR the app crashes on the 2nd or 3rd tool invocation with `pas_panic_on_out_of_memory_error` / `bmalloc::IsoHeap`.
**Root causes:**
  - Single `JSContext` reused across adapter swaps, with `evaluateScript` re-defining tool functions — old closures retain references to prior `CORPUS` JSValue, which retains the prior context's heap. RAM leaks per swap.
  - `JSValue.call(withArguments:)` captures the caller into the JS heap if the Swift caller retains the JSValue across a suspension point (actor re-entrancy).
**Prevention (re-affirms PRD R8 mitigation with specifics):**
  - On adapter hot-swap, dispose the existing `JSContext` entirely (`self.context = nil`) and construct a fresh one. Re-register all bridges. Re-evaluate the new `adapter-tools.json` bodies. ~50ms cost, well under the 2s swap budget.
  - Never hold a `JSValue` across `await`. Resolve to a Swift-native `Any` (JSON-serialize inside JS, return a string) before any suspension.
  - Cap `JSContext.virtualMachine` to a single instance per app lifetime (sharing VMs across contexts is cheaper than sharing contexts).
**Phase:** H2 tool round-trip smoke MUST include a simulated adapter swap (load tools, dispose, reload). Do not defer to H7.
**Source:** Apple JavaScriptCore framework docs (NSHipster); WebKit bug tracker `pas_panic_on_out_of_memory_error` class.

### P7. USB-C → HDMI → capture-card pipeline fails when iPhone 17 is in airplane mode (extends R7)
**Confidence:** MEDIUM (airplane mode does not disable wired display output, but lightning/USB-C adapter variance is real.)
**Warning signs:** Audience sees black screen or "No Signal"; iPhone itself shows correctly on its own display. Toggling airplane mode off fixes it (unacceptable — breaks thesis).
**Root cause:** Some USB-C→HDMI adapters route video over DisplayPort Alt-Mode which the A19/iPhone 17 may gate behind a "Trust This Computer" dialog that dismisses on airplane-mode entry. Also: HDCP handshake with the capture card can time-race with iOS's display-sleep on airplane mode.
**Prevention:**
  - Use a powered HDMI capture card (not a bus-powered dongle). OBS as the display receiver (not TV or projector directly).
  - "Trust This Computer" — tap YES on the iPhone while it is still online, THEN flip airplane mode on. Trust persists across airplane toggles.
  - In the pre-flight (H11), run the exact sequence: airplane-mode-on → connect USB-C → HDMI → capture → OBS. Verify signal holds for 10 minutes straight (no auto-sleep).
  - Disable iPhone Auto-Lock for the demo duration (Settings → Display → Auto-Lock → Never). Screen dims during narration = dead demo.
**Phase:** 60-min pre-H0 checklist (PRD §18.5) + H11 pre-flight.
**Source:** PRD §18.5; general hackathon post-mortem patterns.

### P8. `increased-memory-limit` entitlement requires App Group AND provisioning profile refresh
**Confidence:** MEDIUM (entitlement mechanics have churned across iOS 17→18.)
**Warning signs:** App builds and launches fine; memory reading from `os_proc_available_memory()` reports ~3 GB cap; Gemma 4 E4B load OOMs within 5 seconds of first prompt with `EXC_RESOURCE (RESOURCE_TYPE_MEMORY)`.
**Root cause:** `com.apple.developer.kernel.increased-memory-limit` is a restricted entitlement — it must be (a) explicitly added to the entitlements file, (b) included in the provisioning profile from App Store Connect, (c) the app must be NOT in background on launch. On iOS 18.2+, the entitlement additionally requires a declaration in `Info.plist` for the expected memory class. A plain `.entitlements` edit without refreshing the profile silently does nothing.
**Prevention:**
  - Verify the entitlement appears in the codesigning embedded.mobileprovision: `security cms -D -i embedded.mobileprovision | plutil -p - | grep increased-memory-limit`. Must resolve to `1`.
  - `Info.plist`: confirm `UIApplicationSupportsIncreaseMemoryLimit` or equivalent key per current iOS 18.x docs (verify exact key — PRD does not name it; check `developer.apple.com/documentation` at H1).
  - Test availability: in the app at startup, log `os_proc_available_memory() / 1024 / 1024`. Must report >= 5000 MB on iPhone 17 for the 4B model to fit with KV cache.
**Phase:** H1 iPhone deploy smoke — check memory report in first logline.
**Source:** Apple Developer provisioning profile docs; general entitlement rigor patterns.

---

## HIGH — Address at H3–H8

### P9. AI SDK v6 beta — `writer.merge` + `transient: true` ordering bug
**Confidence:** LOW (v6 is beta per PRD; I cannot verify current bug list.)
**Warning signs:** Worker `data-agent-status` events with `transient: true` appear in the persisted message log (should be ephemeral); OR status events arrive out of order with respect to `data-task-notification` terminal events; OR `writer.merge({ sendStart: false })` still emits a phantom `start` part that breaks the client state machine.
**Prevention:**
  - In H3 skeleton, explicitly assert the ordering contract in an integration test: launch 2 workers, verify on the client that `onData` receives status before notification and that transient events are NOT in the final `messages` array.
  - Pin AI SDK v6 to an exact beta version (e.g. `"ai": "6.0.0-beta.23"` — look up the actual latest). Do NOT use `^6.0.0-beta.x` — point releases during a beta can break on any day.
  - Keep a mental model: `writer.merge` merges the *stream*, not *state*. Two workers writing the same `data-*` `id` will step on each other. Use unique worker ids.
**Phase:** H3 UI skeleton.
**Source:** PRD §10.4, §13.2; general beta-version discipline.

### P10. `ToolLoopAgent` infinite-loop on worker hallucinated tool call
**Confidence:** MEDIUM (AI SDK tool loops have historically lacked hard iteration caps in beta versions.)
**Warning signs:** A single worker consumes >50K tokens before returning; Sentry shows one span duration >3 min; UI agent card stays in "running" state forever; API bills balloon.
**Prevention:**
  - Explicitly pass `maxSteps: 8` (or whatever v6 calls it — `stopWhen: stepCountIs(8)` is the v5 pattern that may have moved) on every `ToolLoopAgent` construction. Never default.
  - Add a per-worker wall-clock budget (e.g. 90s) via `AbortController.timeout`. Abort is observable — report as a failed task-notification with `status: "timeout"`, keep the UI honest.
  - Enforce per-worker total-token budget at the Sentry span level; log a warning when a worker exceeds 30K tokens.
**Phase:** H3 orchestrator harness.
**Source:** AI SDK v5 tool-loop issues GitHub (early 2025); general defensive pattern.

### P11. Sentry `vercelAIIntegration` span attributes miss tool-call args in AI SDK v6 beta
**Confidence:** LOW (integration compat with v6 beta is unverified.)
**Warning signs:** Sentry dashboard shows `gen_ai.request.model` and `gen_ai.usage.*` but `gen_ai.tool.*` attributes are empty; tool-call traces are not visible.
**Prevention:**
  - Manually set `span.setAttribute("gen_ai.tool.name", ...)` and `gen_ai.tool.arguments` inside worker wrappers. Redundant with the integration but defensive — costs nothing.
  - In `@sentry/nextjs` init, enable `tracesSampleRate: 1.0` for the demo (not production). Full trace for every worker call.
  - Verify one end-to-end `gen_ai` span appears before H8 — do not discover the telemetry is hollow during the dry run.
**Phase:** H3 (at worker wrapper wiring time).
**Source:** PRD §12.1; Sentry Vercel AI integration docs.

### P12. `node:vm` + `worker_threads` — 64 MB cap not actually enforced at allocation time
**Confidence:** HIGH (`worker_threads` `resourceLimits.maxOldGenerationSizeMb` is a soft cap checked at GC, not at allocation.)
**Warning signs:** A fuzz-test tool body allocates 200 MB of ArrayBuffers in a tight loop; the worker does not abort immediately; the orchestrator process itself hits OOM and exits.
**Root cause:** Node's `resourceLimits` works via V8's heap-limit callback which only fires when V8 decides to GC. ArrayBuffers allocate off-heap and bypass this entirely. Strings and objects that trigger major GC are capped correctly; Buffers/TypedArrays are not.
**Prevention:**
  - In `lib/sandbox`, wrap every fuzz-test worker spawn with an RSS monitor: `setInterval(() => { if (worker.resourceUsage().processTotalResident > 128_000_000) worker.terminate(); }, 100)`. External hard cap.
  - Reject JS bodies that reference `ArrayBuffer`, `Buffer`, `SharedArrayBuffer`, `WebAssembly`, `Atomics` via AST scan (`acorn` walker). These are never needed for agent-designed tools on a Supabase/Zod/Hono surface.
  - 2-second AbortController timeout: confirm it actually terminates the worker (not just signals intent). AbortSignal semantics in `worker_threads` vs main-thread differ; test once.
**Phase:** H4 tool-validation pipeline.
**Source:** Node.js `worker_threads` documentation; V8 heap-limit semantics.

### P13. `acorn` JS body parser accepts ES2024 syntax but `JSContext` rejects it
**Confidence:** HIGH (JavaScriptCore version on iOS 18 tracks Safari's JS engine and can lag node by a year.)
**Warning signs:** Tool body validates on the orchestrator, fuzz-test passes, trajectory self-consistency passes. On device at runtime, `evaluateScript` returns `undefined` with `JSContext.exception` set to `SyntaxError`. Tool is invoked at inference, nothing happens, model confuses itself.
**Prevention:**
  - Force `acorn` to `ecmaVersion: 2022` — matches iOS 18 JavaScriptCore realistically. Reject newer syntax (Pipeline, Record/Tuple, decorators-v3).
  - Also reject top-level `await`, private class fields if unsure, `using`/`await using`.
  - Smoke in H4 validation: round-trip every agent-written body through a real `JSContext` (via `ios/tools/preview-jsc` binary run on macOS — same JS engine). If the macOS `JSContext` evaluates it, the iPhone `JSContext` will too.
**Phase:** H4 tool validation.
**Source:** Apple JavaScriptCore release notes; general ES-version mismatch pattern.

### P14. `chokidar` watcher fires on partial-write during `devicectl` copy
**Confidence:** MEDIUM (chokidar has known partial-write races on macOS APFS.)
**Warning signs:** Watcher fires the moment copy begins (0 bytes visible on disk from some vantage); app tries to load, gets partial safetensors, panics with `invalid header`.
**Prevention:**
  - Watch the Mac-side `data/adapters/` dir, NOT the iPhone `/Documents/`. The copy-to-device is an atomic `devicectl` operation from the app's perspective; the Mac-side write is where the race happens.
  - `chokidar` option `awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }`. Fires only after the file size stops changing.
  - On iPhone side, in `AdapterLoaderView`, read the file header first; if magic bytes don't match safetensors, show "still copying" and poll for 1s more before retrying.
**Phase:** H7 fuse-and-deploy.
**Source:** chokidar docs; safetensors header format.

### P15. Cross-family judge still leaks when judges and generator share RLHF heritage
**Confidence:** MEDIUM (arXiv 2502.01534 is PRD-cited; practical mitigations vary in effectiveness.)
**Warning signs:** Tuned model and teacher model score identically on the 3-way (~95% each); base stays low. Looks like success but means the judges rewarded teacher-style output regardless of factual correctness.
**Prevention beyond "shuffle columns":**
  - **Blind the judge to which response came from which model.** Shuffle IS the main defense; also *strip style markers* (opening formulas like "Certainly!", "Let's think step by step", "Here's how…") before grading. These are family-signature and bias judges.
  - **Rubric anchored on held-out ground truth**, not preference. For factual Q&A, each eval item has a canonical answer derived from the held-out doc; judges grade against the doc, not the model.
  - **Two-judge disagreement log** is already in PRD §11.4. ADD: any item where judges disagree by ≥1 Likert is **excluded from the scoreboard number** but displayed separately. Do not average away disagreement.
  - **Calibration set:** 5 items where the "correct" answer is intentionally in the base model's voice. If judges grade base ≥ tuned on these, rubric is broken — recheck before demo.
**Phase:** H8 eval harness.
**Source:** arXiv 2502.01534; BFCL methodology.

### P16. Next.js 15 App Router route handlers lose `child_process` output on hot-reload
**Confidence:** HIGH (dev-server hot-reload kills long-lived subprocesses.)
**Warning signs:** During H3–H6 development, `mlx_lm.lora` subprocess spawned from `/api/train` gets orphaned when you save an unrelated file; UI shows "training running" but stdout has dried up.
**Prevention:**
  - Set `export const runtime = 'nodejs'` AND `export const dynamic = 'force-dynamic'` on all child-process routes (PRD §13 mentions nodejs runtime; add dynamic).
  - During H6 demo-mode, use `NEXT_DISABLE_HOT_RELOAD=1` / `next build && next start` (production mode). Dev mode is for H3–H5 only. Build once at H5:55.
  - Subprocess lifecycle: track PIDs in a module-scoped map; on process-exit hook, SIGTERM all children. Do not rely on the parent process living.
**Phase:** H3 training harness, H10 dry-run (must be in production mode).
**Source:** Next.js App Router docs; general Next.js subprocess gotchas.

### P17. `NWPathMonitor` lag on airplane-mode toggle — first inference after toggle sees stale `.satisfied`
**Confidence:** HIGH (`NWPathMonitor` path updates are asynchronous, lag 0.5–2s on airplane-mode transitions.)
**Warning signs:** Stage sequence: toggle airplane mode ON → immediately prompt a `requiresNetwork: true` tool. Tool dispatches instead of returning the structured error. Audience sees a tool try to fetch and spin.
**Prevention:**
  - On first app launch, initialize `NWPathMonitor` and hold a 2s delay before allowing any inference. Path is unknown initially; default to `.offline` until first `pathUpdateHandler` fires.
  - Demo script: toggle airplane mode OFFSTAGE before walking on. Path already settled. Do not toggle during the demo itself.
  - Add a 1s debounce on path changes within the `ToolRegistry` — a flicker to `.satisfied` during airplane-on transition should not count.
**Phase:** H1 offline smoke test; H5.4 offline-tool enforcement path.
**Source:** Apple Network framework docs; PRD §8.4.

---

## MEDIUM — Polish-phase pitfalls

### P18. `mlx_lm.fuse` produces fused weights with wrong head/quantization if `--de-quantize` omitted
**Confidence:** MEDIUM (mlx_lm.fuse has had flags shift across 0.2x→0.3x releases.)
**Warning signs:** Fused model is 12 GB instead of 3 GB; device refuses to load; OR fused model loads but outputs gibberish.
**Prevention:**
  - Verify `mlx_lm.fuse --help` at H0. Confirm the correct flag for "keep the 4-bit quantization" — likely a default but versions have differed.
  - For the adapter-only path (PRD §8.3 fallback): ship `adapter.safetensors` raw and let the Swift side apply LoRA over the quantized base in memory. This is the safer primary — fuse is an optimization, not required.
**Phase:** H0 (verify flags), H7 (use).
**Source:** PRD §8.3; mlx-lm fuse CLI.

### P19. `mlx-lm` gradient-checkpointing + 4-bit base: NaN on step 1 if `--grad-checkpoint` and `--grad-accum` interact wrongly
**Confidence:** MEDIUM.
**Warning signs:** Loss is NaN on iteration 1, before any meaningful update. Disabling grad-checkpoint fixes it but OOMs.
**Prevention:**
  - At H0, run `--iters 10 --grad-checkpoint --batch-size 2` and inspect the first 5 loss values. If NaN, this pitfall fired.
  - Gemma 4 RoPE + 4-bit weights sometimes needs `--max-grad-norm 1.0` explicitly set. Add to `scripts/train.sh` canonical config.
  - Fallback: reduce seq_length from 1024 to 768 (fits without grad-ckpt for rank-16/16-layer).
**Phase:** H0 micro-bench.
**Source:** PRD §6.2; general QLoRA NaN patterns.

### P20. Checkpoint-resume on `mlx_lm.lora` loses optimizer state across `--resume-adapter-file`
**Confidence:** LOW.
**Warning signs:** After checkpoint revert (PRD H6 kill-point), loss spikes then converges slowly; final model is worse than an uninterrupted short run.
**Prevention:**
  - Save optimizer state explicitly with `--save-every 100` to include optimizer. Verify the checkpoint dir contains `optimizer.safetensors` or equivalent, not just adapter weights.
  - If resume is broken in 0.31.2: on NaN spike, **do not resume** — restart from iter 0 with a lower LR (e.g. 5e-6). Sunk cost; accept it.
**Phase:** H6 (if needed).
**Source:** PRD §14 H6 kill-point.

### P21. `zod-to-json-schema` output not accepted by mlx-lm's `tools` parser
**Confidence:** MEDIUM (OpenAI function-calling schema variants differ subtly.)
**Warning signs:** Training starts but with `KeyError: 'parameters'` or `KeyError: 'function'` from mlx-lm's chat-template renderer.
**Prevention:**
  - mlx-lm expects OpenAI-function-calling format: `{ "type": "function", "function": { "name": "...", "description": "...", "parameters": { ... } } }`. `zod-to-json-schema` defaults to a raw schema. Wrap: `{ type: 'function', function: { name, description, parameters: zodToJsonSchema(zodSchema) } }`.
  - Validate one sample JSONL line with `mlx_lm.chat_template --tokenizer unsloth/gemma-4-E4B-it --messages ... --tools ...` before committing the full data-gen run.
**Phase:** H4 data-gen schema wrapping.
**Source:** mlx-lm LORA.md; zod-to-json-schema docs.

### P22. `p-limit(15)` is cosmetic if Anthropic tier enforces 1M TPM at the *organization* level
**Confidence:** HIGH (Anthropic rate-limit semantics; true pre-2025, unlikely to have loosened.)
**Warning signs:** 429s despite `p-limit(15)`; data-gen stage stalls mid-H5.
**Prevention:**
  - p-limit caps in-flight requests but says nothing about tokens/minute. Add an explicit token-budget tracker: running sum of input+output tokens over sliding 60s window; gate below 900K TPM.
  - Workhorse fallback: Gemini 2.5 Pro (PRD §4.1 calls out 4M TPM). Wire `@ai-sdk/google` as the secondary; fall over on 429.
**Phase:** H5 data-gen.
**Source:** Anthropic rate-limit docs.

### P23. Acorn walks allow `Function` constructor strings to slip through
**Confidence:** HIGH.
**Warning signs:** Agent-written tool body includes `new Function('return ' + userArg)()` — a nested eval. Acorn sees a valid `NewExpression`. Fuzz-test might even pass. In production an attacker-controlled arg RCEs inside JSContext (harmless on device, but indicates the tool is not deterministic).
**Prevention:**
  - AST walk: reject `new Function`, `eval`, `Function.prototype.constructor`, dynamic `import()`, `Function.bind.apply`. Literal denylist via `acorn-walker`.
  - PRD §9.3 already says reject-don't-fix. This is the specific denylist.
**Phase:** H4 tool validation.
**Source:** PRD §9.3, §19.4.

### P24. Solo-operator cognitive overload — specific failure modes ≥4 panels (extends R5)
**Confidence:** HIGH (live-demo post-mortem patterns, stable.)
**Warning signs during H10 dry-run:**
  - Operator narrates what panel A is doing while pointing at panel B. Audience sees the disconnect.
  - Dead air > 3s while operator reads from a panel. The show stops.
  - Operator attempts to fix a flickering UI element mid-narration. Focus gone.
  - Transition beats arrive "in silence" — e.g. training completes but narration is mid-sentence about eval.
**Prevention (supplementing PRD §16 R5 "8 guidepost phrases"):**
  - **One-panel focus rule.** Whichever panel the operator is pointing at is the only panel on-screen. Auto-hide others or dim them via CSS class. "What the audience sees" = "what operator is saying."
  - **Transition auto-trigger.** Training completion emits a sound cue (discrete chime) AND auto-scrolls the scoreboard into view. Operator does not click to advance.
  - **Scripted failure recovery phrases.** Memorize verbatim 3 one-liners: "While that runs, here's the punchline." / "That's exactly the behavior we trained against." / "The phone is still in airplane mode — watch." Each buys 10s.
  - **Practice the MUTE moment.** At H8 score reveal, STOP talking for 3 full seconds. Let the audience read the number. Fight the instinct to fill.
  - **No debugging on stage.** If a panel breaks, do not look at it. Move on. Tier 2 narration assumes partial failure — rehearse it at H10.
**Phase:** H10 dry-run, H11 fixes.
**Source:** Hackathon live-demo post-mortems; stagecraft general principles; PRD §16 R5.

---

## LOW — Minor / Known-good mitigations

### P25. `xcrun devicectl` UDID resolution fails after sleep
**Warning signs:** Copy command errors "Device not found" after Mac lid close.
**Prevention:** `caffeinate -dims` (already in PRD §14 H11) plus re-discover UDID at start of every copy: `xcrun devicectl list devices --quiet | grep -i iphone`. Cache in a shell var for the session.
**Phase:** H7 deploy script.

### P26. Xcode 16 signing: App Group entitlement vs iCloud Drive flaky on brand-new apple developer accounts
**Warning signs:** Xcode "Failed to register bundle identifier"; signing fails in H1.
**Prevention:** Pre-H0 60-min checklist §18.6 already covers. If first-run, use an existing bundle-id (forked from mlx-swift-examples retains its id if you don't change it). Rename later if needed.

### P27. Recharts flickers under 10Hz data-point additions
**Warning signs:** Loss chart stutters; visual effect looks broken.
**Prevention:** Batch loss updates at 5-step report interval (already PRD default). React key stable; throttle `setState` to 500ms.

### P28. USB-C power draw from iPhone drains MacBook during long sessions
**Warning signs:** MacBook drops below 50% battery despite being on charger.
**Prevention:** 100W+ USB-C charger; data-only USB-C cable between Mac↔iPhone (separate power path to iPhone via MagSafe).

### P29. OBS dropped-frames on a Retina-resolution capture card
**Warning signs:** Audience sees choppy display; not the phone's fault.
**Prevention:** OBS output at 1080p30, not 4K. Encoder: hardware (VideoToolbox), not x264.

### P30. mlc-ai/web-llm issue #753 reopens as fixed (removes PWA exclusion)
**Confidence:** LOW — PRD §18.2 says verify; likelihood of change in <48h negligible.
**Relevance:** This is an **anti-pitfall** — if #753 is closed with a confirmed fix, the PWA path becomes viable. But PRD §19.4 locks the decision; don't reconsider during the 6-hour window regardless. Note for post-demo retro only.
**Source:** https://github.com/mlc-ai/web-llm/issues/753 (check at H0 per PRD §18.2, do not act on).

---

## Phase-Specific Warnings Summary

| Phase / Hour | Top pitfall to watch | Related |
|--------------|----------------------|---------|
| Pre-H0 60-min | P7 (USB-C→HDMI airplane mirroring), P8 (entitlement provisioning) | PRD §18 |
| H0 | P2 (GRPO reward-fn API), P19 (NaN on step 1), P18 (fuse flags) | PRD §14 H0 |
| H1 | P4 (mlx-swift-lm 3.x imports), P5 (devicectl silent fail), P8 (memory entitlement), P17 (NWPathMonitor lag) | PRD §14 H1 |
| H2 | P1 (tokenizer special-token), P6 (JSContext swap OOM), P13 (ES2024 vs JSC) | PRD §14 H2 |
| H3 | P9 (writer.merge), P10 (ToolLoopAgent infinite loop), P11 (Sentry gen_ai attrs), P16 (Next.js hot-reload) | PRD §14 H3 |
| H4 | P12 (node:vm 64MB), P13 (acorn ES-version), P21 (zod schema wrap), P23 (Function denylist) | PRD §14 H4 |
| H5 | P22 (Anthropic TPM gate) | PRD §14 H5 |
| H6 | P2 (GRPO reward), P3 (GRPO collapse), P19 (NaN), P20 (checkpoint resume) | PRD §14 H6 |
| H7 | P5 (devicectl), P14 (chokidar partial-write), P18 (fuse) | PRD §14 H7 |
| H8 | P15 (judge style bias) | PRD §14 H8 |
| H10 | P24 (cognitive load patterns during dry-run) | PRD §14 H10 |
| H11 | P7 (pre-flight mirror re-verify), P8 (memory check re-verify) | PRD §14 H11 |

---

## Sources Summary

| Class | Examples | Confidence inheritance |
|-------|----------|------------------------|
| Apple platform docs (JavaScriptCore, Network, devicectl) | P5, P6, P8, P17 | HIGH — stable |
| Node.js runtime docs (worker_threads, vm, Next.js) | P12, P16, P23 | HIGH — stable |
| PRD-cited sources (arXiv 2502.01534, web-llm #753, Jackrong) | P15, P30, P1 | MEDIUM — PRD has verified |
| Package-specific (mlx-lm-lora 0.1.0, mlx-swift-lm 3.x, AI SDK v6 beta) | P2, P4, P9, P10, P11 | LOW — cannot verify 2026 state from knowledge cutoff |
| Pattern inference (GRPO collapse, tokenizer leak, solo-operator) | P3, P1, P24 | MEDIUM — class of bug well-known pre-2025 |

**To upgrade LOW→MEDIUM in the 6-hour window:** spend 10 min at H0 reading the `mlx-lm-lora` 0.1.0 README and the `mlx-swift-lm` 3.x package manifest. Spend 10 min at H3 reading AI SDK v6 beta changelog. Do not spend more than 30 min on verification total — build time matters more than pitfall certainty.

---

*End of PITFALLS.md. ~470 lines. Pitfalls here supplement PRD §16 R1–R17 and §14 kill-points; they do not replace them.*
