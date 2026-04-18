# Phase 1: Foundation & Smoke Tests — Research

**Researched:** 2026-04-18
**Domain:** MLX QLoRA training CLI + MLX Swift on-device inference + JSContext tool bridge
**Confidence:** MEDIUM (PRD is authoritative; flags cross-checked with mlx-lm 0.31.2 LORA.md semantics. Models released post-training-cutoff so all version-specific claims are `[CITED: PRD §13.2, §6.2]` or `[ASSUMED]` where explicit.)
**Valid until:** H2 (2026-04-18 ~11:00)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (from PRD §5, §6.2, §8, §9, §14, §18)

- **Base model:** `unsloth/gemma-4-E4B-it-UD-MLX-4bit`. Fallback `unsloth/gemma-4-E2B-it-UD-MLX-4bit` only if H0 bench peak > 20 GB.
- **CLI pins:** `mlx-lm==0.31.2`, `mlx-lm-lora==0.1.0`. Subprocess only; zero `.py` files authored.
- **Bench:** 50 iters, 20-example JSONL in `data/smoke/`, rank 16, 16 layers, batch 2, seq 1024, lr 1e-5, grad-ckpt on, steps-per-report 5.
- **iOS app:** fork `mlx-swift-examples/LLMEval`, Swift 5.9 / Xcode 16 / iOS 18 min. Entitlement `com.apple.developer.kernel.increased-memory-limit` set.
- **Deps (Swift):** `mlx-swift-lm` 3.x, `swift-tokenizers-mlx ≥ 0.1.0`, `JavaScriptCore` (built-in), `Network` (built-in).
- **Adapter delivery:** `mlx_lm.fuse` → `adapter.safetensors` → `xcrun devicectl device copy to ... /Documents/` → `LoRATrain.loadLoRAWeights(model:, url:)`. Hot-swap <2 s.
- **Tool bridge:** `ToolRegistry` actor wraps single `JSContext`. Bridges: `console.log`, `nativeFetch` (URLSession). Parser: `GemmaToolParser` catches `<|tool_call|>…<|tool_response|>` in streaming decoder, JSON-decodes, dispatches `JSValue.call(withArguments:)`, injects response.
- **Offline enforcement:** `NWPathMonitor`; tools with `requiresNetwork:true` return structured error offline. Status pill visible always.
- **Throughput target:** ≥ 40 tok/s on iPhone 17 airplane mode (PRD §19.3).
- **Reference:** `mlx-swift-examples/Tools/llm-tool/LoraCommands.swift` is canonical for loadLoRAWeights usage (PRD §8.3).

### Claude's Discretion

- Content of 20-example JSONL (Supabase-flavored; lexically divergent from base to make delta visible).
- Content of hand-written JS tool body (`echoArgs` minimum; `searchKnowledge` nicer).
- Shell vs npm scripts; exact subpaths under `scripts/` and `data/smoke/` (follow §19.1).

### Deferred Ideas (OUT OF SCOPE)

- Coordinator/Worker UI — Phase 2.
- Training-data gen, judge-gating — Phase 3.
- `node:vm` + `worker_threads` tool-body sandbox — Phase 3.
- Full SFT 400 + GRPO 150 — Phase 4.
- Scoreboard — Phase 5.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAIN-05 | H0 micro-bench (50 iters, 20-ex JSONL) records sec/iter + peak mem; > 20 GB → E2B auto-switch | §Bench Command, §JSONL Format |
| PLAT-01 | Fork LLMEval, E4B base weights resident, increased-memory-limit entitlement | §Xcode Setup, §LLMEval Fork |
| PLAT-02 | Adapter hot-swap via `LoRATrain.loadLoRAWeights`, <2 s after arrival | §Hot-Swap API |
| PLAT-03 | `ToolRegistry` actor + single `JSContext` + native bridges + `JSValue.call` | §JSContext Bridge |
| PLAT-04 | `GemmaToolParser` catches `<|tool_call|>…<|tool_response|>`, JSON-decodes, dispatches, injects, resumes | §Stream Parser |
| PLAT-05 | `NWPathMonitor` offline enforcement + status pill | §NWPathMonitor |
| PLAT-06 | `adapter-tools.json` loader registers every `DynamicTool` at swap | §Adapter-Tools Loader |
| PLAT-07 | ≥ 40 tok/s on iPhone 17 airplane mode | §Throughput |
| OPS-05 | Pre-H0 de-risk checklist | §De-Risk |
</phase_requirements>

---

## Summary

Phase 1 is three orthogonal smoke tests plus a pre-kickoff checklist. Every critical API signature, CLI flag, and command shape is already pinned in PRD §6, §8, §13, §14, §18. Planner work is scheduling and wiring, not discovery. The only real research questions are (1) exact `mlx_lm.lora` flag surface for the 50-iter bench, (2) `xcrun devicectl` domain flags for app sandbox copy, (3) how to wire the LLMEval fork to Gemma 4 model spec, (4) where to hook the streaming decoder for tool-token interception. All answered below.

**Primary recommendation:** Execute H0/H1/H2 in strict serial (bench → device → tool round-trip). Do not parallelize across the three because each gates a kill-point. The laptop bench runs unattended in the background while you switch to iPhone work, but the *decisions* gate sequentially.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| QLoRA training | Laptop (Python CLI subprocess) | — | mlx-lm is macOS-only; iPhone cannot train |
| Adapter fuse | Laptop (Python CLI subprocess) | — | `mlx_lm.fuse` produces safetensors artifact |
| Adapter transport | Laptop shell (`xcrun devicectl`) | USB-C | Only offline path to iPhone file system |
| Base weight hosting | iPhone app bundle (or sandbox after first launch) | — | Offline story requires resident weights |
| Inference | iPhone (MLX Swift) | — | §19.4 Core ML/ExecuTorch banned |
| Tool dispatch | iPhone `JSContext` (JS body) ↔ Swift native bridges | — | `URLSession` only reachable from native side |
| Tool-token parsing | iPhone Swift streaming decoder | — | Has to sit between token generation and UI |
| Offline-gate | iPhone Swift (`NWPathMonitor`) | `ToolRegistry` actor | Checked per tool-call, not per-session |

## Standard Stack

### Laptop Side (training)

| Package | Version | Purpose | Source |
|---|---|---|---|
| `mlx-lm` | 0.31.2 | `mlx_lm.lora`, `mlx_lm.fuse`, `mlx_lm.generate` | [CITED: PRD §13.2] |
| `mlx-lm-lora` | 0.1.0 | not used in Phase 1 (GRPO is Phase 4) | [CITED: PRD §13.2] |
| Python | 3.12 | subprocess runtime only | [CITED: PRD §13.1] |

Install: `pip install 'mlx-lm[train]==0.31.2' mlx-lm-lora==0.1.0` into a 3.12 venv.

### iOS Side (device)

| Package | Version | Purpose |
|---|---|---|
| `mlx-swift-lm` | 3.x | LM runtime (extracted from `mlx-swift-examples` April 2026) |
| `swift-tokenizers-mlx` | ≥ 0.1.0 | Gemma 4 tokenizer + chat template |
| `swift-hf-api-mlx` | ≥ 0.1.0 | first-launch model download into app sandbox |
| `JavaScriptCore` | Apple built-in | no SPM dep; `import JavaScriptCore` |
| `Network` | Apple built-in | `NWPathMonitor` |

[CITED: PRD §13.3]

### Alternatives Considered

PRD §19.4 bans: HF Transformers+MPS, Axolotl, LLaMA-Factory, Core ML, ExecuTorch, llama.cpp, PWA/WebLLM/transformers.js, E2B/WebContainers. Do not evaluate any alternative — research time is zero.

## Bench Command (TRAIN-05)

Canonical invocation for the H0 50-iter bench, derived from PRD §14 H0 + §6.2:

```bash
mlx_lm.lora \
  --model unsloth/gemma-4-E4B-it-UD-MLX-4bit \
  --train \
  --data ./data/smoke \
  --iters 50 \
  --batch-size 2 \
  --num-layers 16 \
  --max-seq-length 1024 \
  --grad-checkpoint \
  --steps-per-report 5 \
  --learning-rate 1e-5 \
  --adapter-path ./bench
```

[CITED: PRD §14 H0 verbatim]

**Peak-memory capture:** `mlx_lm.lora` prints `Trainable parameters: ...` + per-report loss lines. Peak GPU memory is surfaced by MLX as `mx.metal.get_peak_memory()` but NOT printed by default by the CLI. Wrap the process and poll `/usr/bin/memory_pressure` OR run with `/usr/bin/time -l` (macOS) — `maximum resident set size` reported at exit. [ASSUMED — verify in first 2 min of H0; fallback: `mx.metal.get_peak_memory()` via a 3-line Python one-liner invoked separately.]

**`--data` dir layout:** mlx-lm expects a directory containing `train.jsonl`, `valid.jsonl`, optional `test.jsonl`. For a 50-iter bench: create both `train.jsonl` (20 lines) and `valid.jsonl` (2–3 lines). [CITED: mlx-lm LORA.md convention per PRD §13.2 reference.]

**Rank flag:** rank 16 is **default** for `mlx_lm.lora`; `--lora-parameters '{"rank":16,...}'` is the explicit form if needed. Default is fine — do not pass unless the bench disagrees. [ASSUMED]

## JSONL Format

mlx-lm `tools` format (canonical, per PRD §7.3 and mlx-lm LORA.md). Each line:

```json
{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
```

For Phase 1 bench, plain `messages`-only (no `tools` field) is sufficient — tool-call trajectories are Phase 3. Chat template is auto-applied by mlx-lm from the tokenizer config. [CITED: PRD §7.3]

Phase 1 content guidance: hand-write 20 Supabase-flavored Q/A pairs with vocabulary the base model is unlikely to produce verbatim (e.g., `create_rls_policy`, `auth.users()`, `profiles_read_own`) so the adapter delta is visible at H1 verification time.

## Fuse Command (PLAT-02 adapter build)

```bash
mlx_lm.fuse \
  --model unsloth/gemma-4-E4B-it-UD-MLX-4bit \
  --adapter-path ./bench \
  --save-path ./fused \
  --export-gguf false
```

[CITED: mlx-lm LORA.md semantics per PRD §6 + §14 H1]

Output: `./fused/adapter.safetensors` (~60 MB expected per PRD §19.3). For the Phase 1 smoke, also test the "no-fuse" path: skip fuse, ship `./bench/adapters.safetensors` directly (PRD §8.3 fallback).

## Device Copy (PLAT-02 transport)

```bash
# 1. Discover device id (one-time)
xcrun devicectl list devices

# 2. Copy
xcrun devicectl device copy to \
  --device <UDID-or-ECID> \
  --domain-type appDataContainer \
  --domain-identifier <bundle-id> \
  --source ./fused/adapter.safetensors \
  --destination /Documents/adapter.safetensors
```

[CITED: PRD §8.3 verbatim]

**Auth:** requires device be paired + "Trust this Computer" accepted + developer mode on (iOS 18 setting: Privacy & Security → Developer Mode → On, requires restart). This is part of the H0 de-risk checklist (OPS-05).

**Bundle id:** the forked LLMEval app's bundle id — configure in Xcode project (e.g., `com.hackathon.specialist`). Record it now so `deploy-adapter.sh` can hard-code.

**Timing:** < 5 s for 60 MB over USB-C per PRD §19.3. If slower, verify USB-C (not USB-2 fallback cable).

## LLMEval Fork — Swap Llama → Gemma 4 (PLAT-01)

`mlx-swift-examples/LLMEval` ships with a `modelConfiguration` typically pointing at a Llama or Mistral variant. Patch points:

1. **Model registry entry.** In `mlx-swift-lm` 3.x the model spec is a `ModelConfiguration` struct — locate the `defaultModel` or `modelConfiguration` binding in `ContentView.swift` or `ModelContainer.swift`. Replace `id` with `unsloth/gemma-4-E4B-it-UD-MLX-4bit`. [ASSUMED — exact struct name may differ in 3.x; grep for `modelConfiguration` in the fork.]
2. **Architecture plumbing.** `mlx-swift-lm` 3.x is expected to include Gemma 4 in its registered architectures per PRD §5.2 ("day-one MLX support"). If `Models/Gemma4.swift` is absent, **this is a phase kill-point** — fall back to the E2B variant or halt.
3. **Tokenizer.** `swift-tokenizers-mlx ≥ 0.1.0` handles Gemma 4 chat template; if the tokenizer rejects the template, Gemma 4 config file needs to be fetched to `~/Library/Caches/...`. First-launch download via `swift-hf-api-mlx` should handle this.

**Entitlements:** in Xcode 16 → target → Signing & Capabilities → `+ Capability` → search "Increased Memory Limit". Adds `com.apple.developer.kernel.increased-memory-limit = true` to `SpecialistApp.entitlements`. Requires paid Apple Developer account + matching provisioning profile. [CITED: PRD §8.1]

## Hot-Swap API (PLAT-02 Swift side)

```swift
// Canonical reference: mlx-swift-examples/Tools/llm-tool/LoraCommands.swift
// PRD §8.3 pin.
try LoRATrain.loadLoRAWeights(model: modelContainer.model, url: adapterURL)
```

[CITED: PRD §8.3]

Signature confirmation required — read `LoraCommands.swift` in the vendored source at H1:00 before coding. If the 3.x extraction changed the API shape (module renamed to `MLXLMCommon.LoRATrain` or similar), the call site moves but the semantics don't.

**Adapter URL source:** `FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!.appendingPathComponent("adapter.safetensors")`.

**Hot-swap flow (3 steps):** (1) unload existing adapter (or re-init `ModelContainer` if API requires), (2) call `loadLoRAWeights`, (3) resume generation with same `ModelContext`. Target < 2 s (PRD §19.3).

**No-fuse fallback:** if `mlx_lm.fuse` fails, ship the raw `adapters.safetensors` from `./bench/` — `loadLoRAWeights` handles both (per §8.3 "adapter-only path also works").

## JSContext Bridge (PLAT-03)

```swift
import JavaScriptCore

actor ToolRegistry {
    let ctx = JSContext()!

    init() {
        // console.log bridge
        let consoleLog: @convention(block) (String) -> Void = { msg in
            NSLog("[JS] \(msg)")
        }
        ctx.objectForKeyedSubscript("console")?
           .setObject(consoleLog, forKeyedSubscript: "log" as NSString)

        // nativeFetch bridge via URLSession (async → JS Promise shim)
        let nativeFetch: @convention(block) (String, JSValue) -> JSValue = { urlString, resolver in
            // implementer: wrap URLSession.shared.data(from:) in a Task, resolve JS callback
            // ... omitted for brevity
            return JSValue(undefinedIn: /* current ctx */ nil)!
        }
        ctx.setObject(nativeFetch, forKeyedSubscript: "nativeFetch" as NSString)
    }

    func registerTool(name: String, jsBody: String) {
        // jsBody is a function body; wrap as a named global
        ctx.evaluateScript("globalThis[\"\(name)\"] = function(args) { \(jsBody) };")
    }

    func invoke(name: String, argsJSON: String) -> String {
        let fn = ctx.objectForKeyedSubscript(name)!
        let args = ctx.evaluateScript("(\(argsJSON))")!
        let result = fn.call(withArguments: [args as Any])
        return ctx.evaluateScript("JSON.stringify(\(result?.toObject() ?? [:]))")?.toString() ?? "{}"
    }
}
```

[ASSUMED — sketch derived from PRD §8.2, §9.5 and NSHipster JavaScriptCore article cited in PRD §20. Exact signature of `@convention(block)` for async bridges and `JSValue` lifecycle on the actor boundary needs implementer verification.]

**Key gotchas:**

- `JSContext` is not `Sendable`. The `actor` wrapper pins it to a single concurrency domain. Do not pass `JSContext` or `JSValue` across the actor boundary — only primitive strings in, primitive strings out.
- One `JSContext` per `ToolRegistry`. PRD §16 R8 flags OOM risk; keep context alive for app lifetime, not per-request.
- `JSValue.call(withArguments:)` takes `[Any]`. JS Promise support exists via `JSValue` but bridging async URLSession is hand-wired (no built-in `await`).
- JSON boundary: always stringify in/out. Don't pass `[String:Any]` into `JSValue.call` directly — use `JSValue(object:in:)` or evaluate a JSON literal string.

## Stream Parser (PLAT-04)

Gemma 4 tokenizer reserves **dedicated tokens** for `<|tool>`, `<|tool_call|>`, `<|tool_response|>` (PRD §5.2). That means the parser has TWO viable hook points:

1. **Token-id-level** (preferred): inspect each decoded token-id for the tool-token ids. No regex, deterministic. Requires knowing the tokenizer's reserved id for `<|tool_call|>` — check `tokenizer_config.json` special_tokens_map in the Gemma 4 E4B model repo.
2. **Text-level regex** (PRD §8.2 explicit): buffer decoded text, match `<\|tool_call\|>(.*?)<\|tool_response\|>` lazily. PRD chose this path — follow it.

**Hook point in mlx-swift-lm 3.x:** the text stream emitter is typically a `AsyncStream<String>` or `AsyncThrowingStream` returned from `generate(...)`. Wrap the stream with an `AsyncStream` transformer that:

1. Buffers incoming text chunks.
2. Scans for `<|tool_call|>` opener.
3. On match, consumes until `<|tool_response|>` closer (Gemma 4 emits the closer itself? or does the parser inject it? — see below).
4. Extracts the inner JSON (`{"name":"...","arguments":{...}}`), dispatches via `ToolRegistry.invoke`, formats result as `<|tool_response|>{...}<|/tool_response|>`, **injects back into the token stream before the next inference step**.

**Critical question:** does Gemma 4 emit `<|tool_response|>` as part of the call (delimiting args), or does the runtime emit it as an injected reply? Per tool-calling chat template convention, the model emits `<|tool_call|>{json}<|end_of_turn|>` and the runtime injects `<|tool_response|>{json}<|end_of_turn|>`. [ASSUMED — verify by prompting unmodified E4B at H2:00 with a tool definition and logging raw token stream. PRD §14 H2 explicitly calls this out as the H2 verification step.]

**Injection mechanism:** re-tokenize the response string and append to the `KVCache`-backed generation state, then continue sampling. `mlx-swift-lm` 3.x likely exposes a `continue(with: additionalTokens)` or similar on its generation iterator. If not exposed, the fallback is to treat the full transcript as a new prompt and re-prime — slower but works.

## NWPathMonitor (PLAT-05)

```swift
import Network

final class OnlineMonitor: ObservableObject {
    @Published var isOnline: Bool = false
    private let monitor = NWPathMonitor()
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOnline = (path.status == .satisfied)
            }
        }
        monitor.start(queue: .global(qos: .utility))
    }
}
```

[CITED: Apple Network framework; pattern per PRD §8.4]

**Airplane-mode behavior:** `path.status != .satisfied` when airplane mode is on (cellular + wi-fi both off). Binding this to a SwiftUI `@StateObject` drives the status pill reactively. Tool gate: `ToolRegistry.invoke` checks `onlineMonitor.isOnline` before dispatching any `requiresNetwork:true` tool; returns `{"error":"This tool requires network. Device is offline."}` otherwise.

## Adapter-Tools Loader (PLAT-06)

Schema (PRD §9.1, §9.4): `adapter-tools.json` contains an array of:

```json
{
  "name": "echoArgs",
  "description": "Echoes back its arguments.",
  "schema": {"type":"object","properties":{"text":{"type":"string"}}},
  "jsBody": "return {echoed: args.text};",
  "requiresNetwork": false,
  "exampleTrajectories": []
}
```

Phase 1 loader reads this file alongside `adapter.safetensors` at swap time, iterates, calls `ToolRegistry.registerTool(name:jsBody:)` for each. Single hand-written entry is sufficient (per CONTEXT.md discretion); Phase 3 produces the real 8–12 tool manifest.

## Throughput (PLAT-07)

Target ≥ 40 tok/s on iPhone 17 in airplane mode, E4B 4-bit via MLX. Jackrong/Gemopus reference benches measured 45–60 tok/s on iPhone 17 Pro Max (PRD §5.2). Measurement: wrap one `generate(prompt: "Why is the sky blue?", maxTokens: 200)` call with `CFAbsoluteTimeGetCurrent()` at start/end, divide token count by elapsed. Display in the UI status area during verification.

**If below 40 tok/s:** likely causes (a) memory pressure from non-increased-memory-limit → check entitlement signed, (b) wrong quantization (8-bit instead of 4-bit) → re-check model id, (c) KV cache not q4 → verify MLX defaults. Not in Phase 1 budget to optimize beyond this — note and move on if ≥ 40 hit.

## Xcode Setup (PLAT-01)

At H0:45 (before H1 iPhone deploy):

1. `git clone https://github.com/ml-explore/mlx-swift-examples` into `ios/`.
2. `open ios/mlx-swift-examples/Applications/LLMEval.xcodeproj` (path may differ in April 2026 split — check README).
3. Rename target to `SpecialistApp`, bundle id to `com.hackathon.specialist` (or similar).
4. Signing & Capabilities → Team → your paid dev account → Automatic signing.
5. `+ Capability` → "Increased Memory Limit".
6. Patch `modelConfiguration` → `unsloth/gemma-4-E4B-it-UD-MLX-4bit`.
7. First build **to iPhone simulator** to catch compilation errors off the critical path.
8. Then build to physical iPhone — first launch triggers 3 GB download (PRD §14 H1).

## Runtime State Inventory

Phase 1 is greenfield (no prior runtime state to migrate). Skip — no rename/refactor in scope.

## Common Pitfalls

### P1: `xcrun devicectl` permission denied
**What goes wrong:** copy fails with "Developer Mode not enabled" or "Device not trusted".
**How to avoid:** part of OPS-05 de-risk — enable Developer Mode on iPhone (Settings → Privacy → Developer Mode), restart, trust computer on first USB-C attach. Verify with `xcrun devicectl list devices` showing the iPhone.
**Warning signs:** list-devices returns empty; `--domain-type appDataContainer` complains about bundle id.

### P2: Increased-memory-limit entitlement silently not signed
**What goes wrong:** app launches fine but hits 3 GB jetsam cap during model load; crashes without obvious error.
**How to avoid:** after build, inspect `.ipa` or `codesign -d --entitlements - /path/to/app` to confirm `com.apple.developer.kernel.increased-memory-limit = true` is actually present. Provisioning profile must include the entitlement.
**Warning signs:** inference crashes at ~2.8 GB memory footprint; Xcode organizer shows jetsam crashes.

### P3: Chat template double-applied in JSONL
**What goes wrong:** mlx-lm auto-applies Gemma 4 chat template during training. If the JSONL already contains `<|start_of_turn|>user\n...` etc, training sees double-wrapped content and learns garbage.
**How to avoid:** JSONL must be plain `{"messages":[{"role":"user","content":"..."}...]}` — let mlx-lm template it.
**Warning signs:** training loss drops suspiciously fast or suspiciously slow; bench generated output emits literal `<|start_of_turn|>` strings.

### P4: JSContext retained across airplane toggle
**What goes wrong:** `NWPathMonitor` reports status change, but `nativeFetch` closure in the JSContext has captured a stale network reference. Tool call hangs.
**How to avoid:** closures read current monitor state at call time, not init time. Pass the monitor into the bridge closure by reference (`[weak self]`).
**Warning signs:** a tool that worked online, after airplane toggle, hangs instead of returning the structured error.

### P5: Gemma 4 tool-token mismatch between tokenizer and template
**What goes wrong:** tokenizer registers `<|tool_call|>` as a single id but the chat template wraps with `<|tool>` instead — parser's regex misses.
**How to avoid:** at H2:00, log raw token-id sequence from an unmodified E4B inference with a tool-context prompt. Verify which literal delimiter strings appear in the decoded text. Adjust regex to match reality, not the PRD literal.
**Warning signs:** model produces coherent tool-looking output, parser regex never fires.

### P6: Adapter swap does not take effect
**What goes wrong:** `loadLoRAWeights` returns success but next inference produces base-model output.
**How to avoid:** after load, force a fresh generation (no KV-cache reuse from before swap). In mlx-swift-lm 3.x this may require re-initializing the `ModelContext` or clearing the cache explicitly.
**Warning signs:** visible delta between base and tuned model is zero on the H1 smoke prompt.

### P7: Peak memory off by a factor during bench
**What goes wrong:** `/usr/bin/time -l` reports `maximum resident set size` in bytes on macOS 14+ (was KB on older). Number ~10× expected makes "20 GB trigger" either too lax or too strict.
**How to avoid:** cross-check by running `mx.metal.get_peak_memory()` from a tiny Python snippet right after training finishes — it returns bytes unambiguously.

## Environment Availability

| Dependency | Required By | Must verify at H0 | Fallback |
|---|---|---|---|
| Python 3.12 | mlx-lm subprocess | `python3.12 --version` | Python 3.11 acceptable per mlx-lm; 3.13 may break |
| `mlx-lm==0.31.2` | Bench | `pip show mlx-lm` | — (PRD pin) |
| `mlx-lm-lora==0.1.0` | Phase 4 (pre-install) | `pip show mlx-lm-lora` | — |
| Node ≥ 20 | Orchestrator (Phase 2+) | `node --version` | — |
| Xcode 16 | iOS build | `xcodebuild -version` | — |
| `xcrun devicectl` | Device copy | `xcrun devicectl list devices` | — |
| iPhone 17 iOS 18.2+ | Runtime | Settings → General → About | spare iPhone (R16) |
| Developer Mode enabled on iPhone | devicectl copy | Settings → Privacy → Developer Mode | — |
| Apple Developer account signed in Xcode | Entitlements | Xcode → Settings → Accounts | — |
| Paid team w/ increased-memory-limit entitlement eligibility | PLAT-01 | Xcode capability lookup | — |
| USB-C cable (data, not power-only) | Transport | physical test | spare cable |
| HuggingFace network access (OR pre-downloaded weights) | H0 model fetch | `mlx_lm.generate` smoke test | hotspot for laptop |
| Sentry DSN | OPS-05 | `.env` check | — |
| Anthropic/OpenAI/Gemini keys | OPS-05 | smoke `generateText` | — |

**Blocking if absent:** Xcode 16, Developer Mode on device, mlx-lm 0.31.2, increased-memory-limit entitlement, USB-C data cable. All must be green before H0 kickoff.

## Validation Architecture

Nyquist validation: not configured in `.planning/config.json` — treating as absent. For Phase 1 smoke work, verification is operator-observed (visible output, stopwatch, measured memory). No unit tests in Phase 1 scope. Skip formal framework setup until Phase 2 Wave 0.

## Security Domain

Not applicable in Phase 1 smoke scope — no user input surface, no persisted user data, no authentication. PRD §19.4 carries the relevant security hard constraints (no secrets in training data, no cache-break the base model download). Defer formal STRIDE to Phase 4 (device-resident model + tool dispatch).

## Sources

### Primary (HIGH confidence — pinned in PRD)
- `PRD_SPEC.md` §5 (base model), §6.2 (training config), §7.3 (JSONL format), §8 (on-device runtime), §9 (tool system), §13 (stack), §14 H0/H1/H2 (execution), §18 (de-risk), §19.1 (repo layout), §19.3 (acceptance), §19.4 (hard constraints).
- `CLAUDE.md` (project instructions — dead-end list, stack locks).

### Secondary (MEDIUM confidence — cited in PRD §20, not re-verified this session)
- mlx-lm LORA.md — https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md (flag surface, JSONL format)
- `LoraCommands.swift` — https://github.com/ml-explore/mlx-swift-examples/blob/main/Tools/llm-tool/LoraCommands.swift (loadLoRAWeights signature reference)
- Apple JavaScriptCore docs + NSHipster article (PRD §20) — JSContext bridge pattern
- Apple Network framework docs — NWPathMonitor

### Tertiary (LOW — training-knowledge-only)
- Exact Xcode 16 UI labels for "Increased Memory Limit" capability (assumed — verify in-UI at H0:45).
- `mx.metal.get_peak_memory()` as fallback mem measurement (assumed API name).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `/usr/bin/time -l` surfaces peak RSS reliably on macOS 14+ for the mlx-lm subprocess | Bench Command | Memory trigger fires wrongly → wrong E4B/E2B decision |
| A2 | `--lora-parameters` rank defaults to 16 in mlx-lm 0.31.2 | Bench Command | Rank differs → memory + convergence off |
| A3 | mlx-swift-lm 3.x includes a registered Gemma 4 architecture | LLMEval Fork | Phase-killing if absent; requires manual model plumbing |
| A4 | Exact `JSContext` bridge shape compiles as written | JSContext Bridge | Implementer rewrites; 30 min cost |
| A5 | Gemma 4 emits `<|tool_call|>` as a literal delimited pair, runtime injects `<|tool_response|>` reply | Stream Parser | Parser regex misses; fix at H2:00 when raw stream is logged |
| A6 | mlx-swift-lm 3.x exposes a way to inject tokens mid-generation (continue with additional tokens) | Stream Parser | Fall back to re-prime full transcript; slower |
| A7 | `xcrun devicectl ... --domain-type appDataContainer --domain-identifier <bundle-id> --destination /Documents/...` is the exact flag shape in Xcode 16 | Device Copy | Command fails at H1:30; 10 min to fix |
| A8 | "Increased Memory Limit" label is present in Xcode 16 capabilities picker | Xcode Setup | Manual entitlement file edit needed |
| A9 | `mlx_lm.fuse --export-gguf false` exists as a flag (vs default behavior) | Fuse Command | Drop flag; default is likely safetensors-only anyway |

**Confirmation path:** A1, A2 resolved in first 10 min of H0 (bench output). A3, A4, A5, A6 resolved by H2 reality. A7, A8 resolved at H1:00 device deploy. All `[ASSUMED]` items are cheap to check — no pre-H0 blocking research needed.

## Open Questions (RESOLVED)

1. **Exact mlx-swift-lm 3.x API shape for tool-token stream interception.**
   - Known: there is a stream; there is a tokenizer with special tokens.
   - Unclear: whether the stream exposes raw token ids or decoded text, and whether `continue with tokens` is a first-class API.
   - Recommendation: at H2:00, grep the `mlx-swift-lm` 3.x source for `AsyncStream`, `generate`, `TokenIterator`. Implement against whatever is there.
   - **Resolution:** resolved by Plan 05 Task 3 Leg B — logs raw token literals and corrects regex if tags differ.

2. **Whether `mlx_lm.fuse` default quant preservation works for E4B 4-bit.**
   - Known: PRD assumes fuse + safetensors works.
   - Unclear: if fuse de-quantizes the base unintentionally.
   - Recommendation: at H1:30 after fuse, `ls -lh adapter.safetensors` — expect ~60 MB. If 3 GB, fuse is de-quantizing; drop fuse, use adapter-only path.
   - **Resolution:** resolved by Plan 04 Task 1 size-guard + no-fuse fallback smoke.

3. **Peak memory measurement for the kill-point.**
   - Known: 20 GB threshold triggers E2B swap.
   - Unclear: which measurement tool gives canonical number.
   - Recommendation: use both `/usr/bin/time -l` (process RSS) AND `mx.metal.get_peak_memory()` (MLX unified-memory allocator). If they disagree by >20%, take the max and err toward E2B.
   - **Resolution:** resolved by Plan 02 Task 2 taking max of `/usr/bin/time -l` maximum resident set size AND `mx.metal.get_peak_memory()`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — PRD pins all versions.
- CLI flags: MEDIUM — sourced from PRD §14 H0 verbatim + mlx-lm LORA.md conventions. Exact flag names for `mlx_lm.fuse --export-gguf` assumed.
- Swift API signatures: MEDIUM-LOW — signatures cited from PRD §8.3 but not independently verified against mlx-swift-lm 3.x source this session. Read source at H0:45.
- Pitfalls: MEDIUM — drawn from PRD risk register (§16) + common iOS gotchas.

**Research date:** 2026-04-18 pre-H0.
**Valid until:** H2 kill-point (decisions gate sequentially; research becomes moot after H2 pass/fail).
