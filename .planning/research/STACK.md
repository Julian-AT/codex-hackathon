# STACK — Implementation-Level Technology Detail

**Project:** Offline Specialist-LLM Pipeline (Gemma 4 E4B → iPhone 17 airplane mode)
**Researched:** 2026-04-18 (H-6 before demo)
**Authoritative source:** `PRD_SPEC.md` §13, §19.4. All locks here are PRD-mandated — do not deviate.
**Overall confidence:** HIGH on npm packages, MEDIUM on MLX Python coordinates, MEDIUM on iOS SPM coordinates.

---

## Runtime Versions

| Runtime | Pin | Verified |
|---|---|---|
| Node.js | ≥ 20.x (use 22 LTS if available) | HIGH — AI SDK v6 requires Node 18+, Sentry 10 requires 20+ |
| npm | ≥ 10 | HIGH |
| Python | 3.12 (venv only; no `.py` files authored) | HIGH — `mlx-lm` declares `Requires: Python >=3.8` |
| Swift | 5.9 | HIGH — PRD lock |
| Xcode | 16.x | HIGH — `xcrun devicectl` ships with Xcode 15+; use 16 for iOS 18 SDK |
| iOS deployment target | 18.0 | HIGH — PRD lock; iPhone 17 ships 18.2+ |

### JavaScript package versions (npm, verified 2026-04-18)

| Package | Pin | npm latest | Notes |
|---|---|---|---|
| `ai` | `^6.0.168` | 6.0.168 | HIGH — `ai-v6` dist-tag is at 6.0.132; `latest` has moved to 6.0.168. Use `^6.0.168`. |
| `@ai-sdk/anthropic` | `^3.0.71` | 3.0.71 | HIGH |
| `@ai-sdk/openai` | `^3.0.53` | 3.0.53 | HIGH |
| `@ai-sdk/google` | `^3.0.64` | 3.0.64 | HIGH |
| `@sentry/nextjs` | `^10.49.0` | 10.49.0 | HIGH — PRD says `≥9.29.0`; 10.x is current and retains `Sentry.vercelAIIntegration()`. |
| `next` | `~15.5.15` | 15.5.15 (latest 15.x) | HIGH — pin to 15.5.x. DO NOT upgrade to 16.x (`next@16.2.4` exists but is outside PRD lock and changes Route Handler semantics). |
| `zod` | `^3.25.76` (3.x line required by `ai@6`) | — | HIGH — `ai@6` peer: `zod: ^3.25.76 || ^4.1.8`. Use 3.25+ for broad compat; 4.x only if you know the migration. |
| `zod-to-json-schema` | `^3.24.x` | — | HIGH |
| `p-limit` | `^6.x` | — | HIGH |
| `recharts` | latest 2.x | — | HIGH |
| `chokidar` | `^3.6` or `^4.x` | — | HIGH |
| `eventsource-parser` | `^3.x` | — | HIGH |
| `jsonschema` | latest | — | HIGH |
| `acorn` | `^8.x` | — | HIGH — used by tool-body syntax validator |

### Python packages (pip)

| Package | Pin | Verified |
|---|---|---|
| `mlx-lm` | `==0.31.2` | HIGH — PyPI confirms 0.31.2 exists (released Apr 7, 2026). Extras: `test`, `train`, `evaluate`, `cuda12`, `cuda13`, `cpu`. |
| `mlx-lm-lora` | `==0.1.0` | MEDIUM — PyPI confirms 0.1.0 exists. Note: the `mlx-lm-lora` package line has since advanced to 1.1.10; PRD pins 0.1.0 intentionally — do not bump during the 6-hour window. |
| `datasketch` | latest | HIGH — MinHash dedup in data-gen |
| `jsonschema` | latest | HIGH — Python-side schema validation if needed by the fuzzer |

---

## Install Commands

### Node / Next.js orchestrator

```bash
# from repo root
npm init -y  # skip if already present
npm install next@~15.5.15 react@19 react-dom@19
npm install ai@^6.0.168 \
            @ai-sdk/anthropic@^3.0.71 \
            @ai-sdk/openai@^3.0.53 \
            @ai-sdk/google@^3.0.64
npm install @sentry/nextjs@^10.49.0
npm install zod@^3.25.76 zod-to-json-schema p-limit@^6 \
            recharts chokidar eventsource-parser jsonschema acorn
npm install -D typescript @types/node @types/react
```

### Python venv for MLX CLI

```bash
# REQUIRED: Python 3.12 (not 3.13 — untested with mlx-lm 0.31.2 on Apple Silicon)
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# Core training + evaluation extras. 'train' gives trl-like utilities; 'evaluate' gives lm-eval hooks.
pip install "mlx-lm[train]==0.31.2"

# RL stage (GRPO). PRD pins 0.1.0 — do not bump.
pip install "mlx-lm-lora==0.1.0"

# Data-gen helpers
pip install datasketch jsonschema

# Smoke
python -c "import mlx_lm, mlx_lm_lora; print(mlx_lm.__version__)"
mlx_lm.generate --model unsloth/gemma-4-E4B-it-UD-MLX-4bit --prompt "hi" --max-tokens 2
```

> Pitfall: `pip install mlx-lm[train]` on a non-Apple-Silicon Mac will fail at the `mlx` wheel resolution. M4 Pro on macOS 14.6+ is the validated target. If you see `ERROR: No matching distribution found for mlx`, check `uname -m` → must be `arm64`.

---

## Config Snippets

### `next.config.ts` — minimum for `child_process`

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Allow spawning Python subprocesses from Route Handlers.
  serverExternalPackages: ['@sentry/nextjs'],
  experimental: {
    // AI SDK v6 streaming works fine with the stable runtime; no experimental flags required.
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  // Only upload source maps in CI; locally we skip to save time.
  widenClientFileUpload: true,
  disableLogger: true,
});
```

### Route Handler boilerplate (any route that spawns `mlx_lm.*`)

```ts
// app/api/train/route.ts
import { spawn } from 'node:child_process';

// MANDATORY — child_process is not available on the Edge runtime.
export const runtime = 'nodejs';
// SFT ~12min + GRPO ~5min + slack. PRD targets 17min total. 20min ceiling.
export const maxDuration = 1200; // seconds (20 min)
// Do not cache streaming responses.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  // ... createUIMessageStream + spawn('python', ['-m', 'mlx_lm.lora', ...], { env: { ...process.env, PYTHONUNBUFFERED: '1' }})
}
```

> Pitfall: `maxDuration` on self-hosted Node is advisory only, but without it the Vercel deploy path would cap at 10s. Since the demo is self-hosted on the laptop, this is belt-and-suspenders.

### `instrumentation.ts` (root, next to `app/`)

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

// Optional, for capturing request errors in Route Handlers:
export { captureRequestError as onRequestError } from '@sentry/nextjs';
```

### `sentry.server.config.ts`

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,           // demo, capture everything
  profilesSampleRate: 0,            // not demo-critical
  integrations: [
    Sentry.vercelAIIntegration({    // auto gen_ai spans for every AI SDK call
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
});
```

> Confidence: HIGH. `Sentry.vercelAIIntegration()` auto-enabled for AI SDK v5+ and remains the v6 pattern per Sentry docs. With `@sentry/nextjs@10`, the integration is also available without manual registration, but explicit init removes ambiguity.

### `.env.example`

```
# LLM providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
# Observability
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=...
SENTRY_PROJECT=...
# iOS device (populated after H1)
IPHONE_UDID=
IOS_BUNDLE_ID=com.yourorg.specialistapp
```

### Provider client construction (AI SDK v6)

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// Teacher / generator
export const teacher = anthropic('claude-opus-4-5-20250929'); // use provider's current Opus 4.7 alias
// Judges
export const gpt5   = openai('gpt-5');
export const gemini = google('gemini-2.5-pro');
```

> Model ID strings: confidence MEDIUM. Verify the exact provider alias at H0 with a `generateText({ model: teacher, prompt: 'hi', maxTokens: 2 })` smoke test. Providers change aliases without warning.

---

## iOS — SPM Coordinates

Swift Package Manager dependencies for the iOS target. Verified against the mlx-swift ecosystem split that happened in April 2026 (mlx-swift-examples → `mlx-swift-lm` extraction).

```swift
// Package.swift (or Xcode > File > Add Package Dependencies)
dependencies: [
    // Core LM library (extracted from mlx-swift-examples)
    .package(url: "https://github.com/ml-explore/mlx-swift-lm", from: "3.0.0"),
    // Tokenizer adapter
    .package(url: "https://github.com/ml-explore/swift-tokenizers-mlx", from: "0.1.0"),
    // HF model-download adapter (needed for first-launch base-weight fetch;
    // post-launch is airplane-mode so this is only used during H1 setup)
    .package(url: "https://github.com/ml-explore/swift-hf-api-mlx", from: "0.1.0"),
    // Underlying MLX Swift (pulled transitively, pin explicitly for determinism)
    .package(url: "https://github.com/ml-explore/mlx-swift", from: "0.21.0"),
],
targets: [
    .target(name: "SpecialistCore", dependencies: [
        .product(name: "MLXLM",        package: "mlx-swift-lm"),
        .product(name: "MLXLMCommon",  package: "mlx-swift-lm"),
        .product(name: "Tokenizers",   package: "swift-tokenizers-mlx"),
        .product(name: "HFHub",        package: "swift-hf-api-mlx"),
        // JavaScriptCore and Network are system frameworks — no SPM entry.
    ]),
]
```

| Framework | Source | Notes |
|---|---|---|
| `mlx-swift-lm` | github.com/ml-explore/mlx-swift-lm | Products typically: `MLXLM`, `MLXLMCommon`. Confidence MEDIUM — verify product names in the repo's `Package.swift` at H1 before importing. |
| `swift-tokenizers-mlx` | github.com/ml-explore/swift-tokenizers-mlx | Product: `Tokenizers`. Confidence MEDIUM. |
| `swift-hf-api-mlx` | github.com/ml-explore/swift-hf-api-mlx | Product: `HFHub` (name likely `HubApi`). Confidence MEDIUM. |
| `JavaScriptCore` | Apple system | `import JavaScriptCore` — no SPM. |
| `Network` | Apple system | `import Network` — provides `NWPathMonitor`. No SPM. |

> **Action at H1:** clone `mlx-swift-examples` (PRD §14 H0 step), inspect its `Package.swift`, and copy the exact product names verbatim into `SpecialistApp.xcodeproj`. The April 2026 split renamed several products; do not trust cached knowledge.

> Key API: `LoRATrain.loadLoRAWeights(model:, url:)` lives in `mlx-swift-lm` (or its examples folder) — reference: `mlx-swift-examples/Tools/llm-tool/LoraCommands.swift`.

---

## Entitlements

### `com.apple.developer.kernel.increased-memory-limit`

Required for Gemma 4 E4B (~3 GB weights + KV cache) on iPhone 17. Without it, iOS caps a foreground app at ~3 GB and kills on the first activation spike.

**Add to `SpecialistApp.entitlements`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.kernel.increased-memory-limit</key>
    <true/>
    <!-- Also useful during a single long inference to prevent the debug-time
         memory ceiling from being re-imposed when the app is in the background: -->
    <key>com.apple.developer.kernel.extended-virtual-addressing</key>
    <true/>
</dict>
</plist>
```

**Xcode wiring:**

1. Target → Signing & Capabilities → `+ Capability` → search "Increased Memory Limit". Add it.
2. Confirm `CODE_SIGN_ENTITLEMENTS = SpecialistApp/SpecialistApp.entitlements` in Build Settings.
3. If the capability is absent from the `+ Capability` list, enable it manually in the entitlements file as above.

**Provisioning profile:**

- Requires a paid Apple Developer account (free tier does NOT grant this entitlement).
- Go to https://developer.apple.com/account → Certificates, Identifiers & Profiles → select your App ID → enable "Increased Memory Limit" capability → regenerate the provisioning profile → download → double-click to install → in Xcode, Signing & Capabilities, select the refreshed profile.
- Automatically-managed signing usually picks up the new profile, but if not, toggle "Automatically manage signing" off/on.
- Confidence: HIGH on the mechanism; MEDIUM on whether the current dev account has it already enabled — verify before H1.

> Pitfall: on a free-provisioning team, the app will build and install but silently run without the raised limit, causing a jetsam kill the moment the model is loaded. Always test the entitlement by reading it back at runtime:
> ```swift
> // Log at app launch
> if let value = Bundle.main.infoDictionary?["com.apple.developer.kernel.increased-memory-limit"] { print("raised-mem entitlement:", value) }
> ```
> Better: use `os_proc_available_memory()` and log — a non-entitled iPhone 17 reports ~3 GB; an entitled one reports ~6 GB+.

---

## Known Install Pitfalls (M4 Pro / iPhone 17 / iOS 18.2+)

1. **`mlx-lm` wheel on Python 3.13** — installs but emits DeprecationWarning cascades and has intermittent tokenizer-thread segfaults. **Pin Python 3.12.**
2. **`mlx-lm[train]` pulls `trl`** which has a `torch` runtime dep; the install succeeds on Apple Silicon but `torch` is ~700 MB. Budget 2–3 min for the first install. Don't start the install at H0:55.
3. **`mlx-lm-lora==0.1.0` vs newer** — the package has since moved to 1.1.x. PRD pins 0.1.0 because its GRPO CLI flags are what `scripts/grpo.sh` expects. Bumping breaks the CLI surface. Pin with `==`, not `~=` or `>=`.
4. **Gemma 4 weight download** — the first `mlx_lm.generate --model unsloth/gemma-4-E4B-it-UD-MLX-4bit` downloads ~3 GB to `~/.cache/huggingface/hub/`. Pre-fetch in the H-1 window (see PRD §18 item 3).
5. **Next.js 16 upgrade trap** — `npm install next` without a version grabs 16.2.4 today. 16.x changed `cookies()`/`headers()` to async and shifted Route Handler timing semantics; the PRD was written against 15.x. **Pin `next@~15.5.15`.**
6. **`ai-v6` dist-tag lag** — `npm install ai@ai-v6` installs 6.0.132, not 6.0.168. Use explicit `ai@^6.0.168` to get the latest stable v6. `ai@beta` resolves to 7.0.0-beta.111 — do not install.
7. **`@sentry/nextjs@9` vs `@10`** — the PRD says "≥ 9.29.0". `@10.49.0` is current and adds OTel-native `gen_ai` spans; the `vercelAIIntegration()` API is backward-compatible. Using 10 is fine and recommended.
8. **Sentry App Router tunnel** — `withSentryConfig` adds a `/monitoring` ingress route by default. On self-hosted Node with `Content-Security-Policy` headers, this can 403. For the demo, remove the tunnel (`tunnelRoute: undefined`) or leave default if no CSP is set.
9. **AI SDK v6 `ToolLoopAgent` import path** — in v6 stable, the primary API is `Experimental_Agent` (rebranded from `ToolLoopAgent`). Search the v6 docs at H3 before hard-coding the import:
   ```ts
   import { Experimental_Agent as Agent } from 'ai';
   ```
   PRD uses the name `ToolLoopAgent`. Reconcile by aliasing on import. Confidence MEDIUM — verify exact name at H3.
10. **`createUIMessageStream` + `writer.merge()`** — these are v6 primitives. v5 had `createDataStream`. Do not copy v5 examples verbatim.
11. **`xcrun devicectl` requires paired device** — if first-time pairing is needed, run:
    ```bash
    xcrun devicectl list devices
    xcrun devicectl device info details --device <UDID>
    ```
    Pair via Xcode → Window → Devices and Simulators the first time; USB-C MFi cable required (data cable, not power-only).
12. **`devicectl device copy to --domain-type appDataContainer`** requires the app to be installed and have at least one prior launch; a fresh install without a launch has no Documents container. Run the app once after install before pushing the first adapter.
13. **iPhone 17 iOS 18.2+** — `NWPathMonitor` requires iOS 12+. No compatibility concern. `JSContext` is iOS 7+. Both fine.
14. **JSContext memory caps on iOS** — each `JSContext` is limited to ~256 MB default heap. Not an issue for our agent-written JS bodies (small pure functions) but do not allocate huge arrays inside tool JS. Release the context between demo sessions.
15. **M4 Pro 24 GB thermal** — sustained GRPO rollouts throttle after ~4 min without external airflow. `caffeinate -dims` is PRD-mandated; also plug into wall power and point a desk fan at the chassis during H6.

---

## Sources

- `mlx-lm` on PyPI: https://pypi.org/project/mlx-lm/ (verified 0.31.2, Apr 7 2026)
- `mlx-lm-lora` on PyPI: https://pypi.org/project/mlx-lm-lora/ (verified 0.1.0 in release list)
- `ai` package (npm): `npm view ai dist-tags` → `latest: 6.0.168`, `ai-v6: 6.0.132`, `beta: 7.0.0-beta.111`
- `@sentry/nextjs` (npm): `10.49.0` latest
- `next` (npm): `15.5.15` latest 15.x; `16.2.4` on `latest`
- AI SDK providers (npm): `@ai-sdk/anthropic@3.0.71`, `@ai-sdk/openai@3.0.53`, `@ai-sdk/google@3.0.64`
- PRD_SPEC.md §13 (Technology Stack), §19.4 (Must-follow conventions) — authoritative
- Apple Developer — Increased Memory Limit capability: https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_kernel_increased-memory-limit
- Sentry Vercel AI integration: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/vercelai/

---

**End of STACK.md. Next step: H0 environment setup per PRD §14.**
