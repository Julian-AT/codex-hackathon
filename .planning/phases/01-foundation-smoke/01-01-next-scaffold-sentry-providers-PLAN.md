---
phase: 01-foundation-smoke
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - next.config.ts
  - app/layout.tsx
  - app/page.tsx
  - app/instrumentation.ts
  - app/api/smoke/route.ts
  - sentry.client.config.ts
  - sentry.server.config.ts
  - sentry.edge.config.ts
  - .env.example
  - .gitignore
autonomous: true
requirements: [FND-03, FND-04]

must_haves:
  truths:
    - "`next build` succeeds on a Next.js 15.5.x App Router scaffold."
    - "`Sentry.vercelAIIntegration()` is wired and a `gen_ai` span lands in the Sentry project for at least one call."
    - "A single `generateText` smoke route returns 200 bodies from Claude Opus 4.7, GPT-5, and Gemini 2.5 Pro."
    - "Any route that uses `child_process` carries `export const runtime = 'nodejs'`."
  artifacts:
    - path: "package.json"
      provides: "Pinned deps per research/SUMMARY.md §2"
      contains: '"next": "~15.5.15"'
    - path: "app/instrumentation.ts"
      provides: "Sentry init with vercelAIIntegration"
    - path: "app/api/smoke/route.ts"
      provides: "3-provider generateText smoke hitter"
      exports: ["GET"]
    - path: ".env.example"
      provides: "Required env var documentation"
      contains: "ANTHROPIC_API_KEY"
  key_links:
    - from: "app/api/smoke/route.ts"
      to: "@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google"
      via: "generateText"
      pattern: "generateText\\("
    - from: "app/instrumentation.ts"
      to: "@sentry/nextjs"
      via: "Sentry.init with vercelAIIntegration()"
      pattern: "Sentry\\.vercelAIIntegration"
---

<objective>
Bring up the Next.js 15 + AI SDK v6 + Sentry orchestrator surface and verify all three frontier provider keys in a single smoke hit. This is the laptop-side foundation every downstream phase builds on.

Purpose: Unblock Phase 2 orchestrator, Phase 3/4/5 workers, and Sentry `gen_ai` observability. Without this, no worker can run and no training telemetry can be captured.
Output: Working dev server, Sentry `gen_ai` span in dashboard, three successful `generateText` calls.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD_SPEC.md
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/SUMMARY.md
@.planning/research/STACK.md

<interfaces>
<!-- Required pinned versions (research/SUMMARY.md §2). Use these EXACT versions. -->
- `next@~15.5.15` (NOT 16.x)
- `ai@^6.0.168` — import surface: `import { Experimental_Agent as Agent, generateText } from 'ai'`
- `@ai-sdk/anthropic@^3.0.71`
- `@ai-sdk/openai@^3.0.53`
- `@ai-sdk/google@^3.0.64`
- `@sentry/nextjs@^10.49.0` (PRD floor 9.29.0 OK; 10 recommended)
- `zod@^3.25.76`
- `p-limit@^6`
- Node ≥20 (22 LTS preferred)

<!-- Model aliases (verify via smoke route). Providers rotate; if alias 404s, the route MUST log the exact aliases it tried. -->
- Anthropic: `claude-opus-4-5` (primary), fallback `claude-opus-4-7` / `claude-opus-4-latest`
- OpenAI: `gpt-5`
- Google: `gemini-2.5-pro`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Next.js 15 + AI SDK v6 + pinned deps</name>
  <files>
    package.json, tsconfig.json, next.config.ts, app/layout.tsx, app/page.tsx, .gitignore, .env.example
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §13 (tech stack)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/SUMMARY.md §2 (pinned versions with verify-at-H0 flags)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/CLAUDE.md (hard constraints — no PWA, no HF Transformers, no Python app code)
  </read_first>
  <action>
    Initialize Next.js 15 App Router scaffold in repo root (do NOT use `create-next-app`; hand-author to keep pins exact).

    1. Write `package.json` with EXACT versions from interfaces block above:
       - `"next": "~15.5.15"`, `"react": "^19"`, `"react-dom": "^19"`
       - `"ai": "^6.0.168"`, `"@ai-sdk/anthropic": "^3.0.71"`, `"@ai-sdk/openai": "^3.0.53"`, `"@ai-sdk/google": "^3.0.64"`
       - `"@sentry/nextjs": "^10.49.0"`
       - `"zod": "^3.25.76"`, `"zod-to-json-schema": "latest"`, `"p-limit": "^6"`, `"recharts": "latest"`, `"chokidar": "latest"`, `"eventsource-parser": "latest"`, `"jsonschema": "latest"`, `"acorn": "^8"`
       - scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"typecheck": "tsc --noEmit"`
       - `"engines": { "node": ">=20" }`
    2. Write `tsconfig.json` with `"target": "ES2022"`, `"moduleResolution": "bundler"`, `strict: true`, `paths: { "@/*": ["./*"] }`.
    3. Write `next.config.ts` — empty config object (`export default { }`), TypeScript.
    4. Write `app/layout.tsx` and `app/page.tsx` — minimal "Offline Specialist-LLM Pipeline" landing. page.tsx may be a placeholder link list.
    5. Write `.env.example` documenting required env vars:
       ```
       ANTHROPIC_API_KEY=
       OPENAI_API_KEY=
       GOOGLE_GENERATIVE_AI_API_KEY=
       SENTRY_DSN=
       NEXT_PUBLIC_SENTRY_DSN=
       ```
    6. Write `.gitignore` including `node_modules/`, `.next/`, `.env*` (but NOT `.env.example`), `.venv/`, `data/`, `ios/*/build/`, `*.safetensors`.
    7. Run `npm install`. If install succeeds, run `npx next build` to prove the scaffold compiles.
    8. DO NOT introduce tailwind, shadcn, or any extra UI lib in this task — out of scope; Phase 2 will do the agent grid.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npm install && npx tsc --noEmit && npx next build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains the EXACT version strings listed above (grep each).
    - `grep -E "\"next\": \"~15.5.15\"" package.json` succeeds.
    - `grep -E "\"ai\": \"\\^6.0.168\"" package.json` succeeds.
    - `grep -E "\"@sentry/nextjs\": \"\\^10" package.json` succeeds.
    - `npx next build` exits 0.
    - `.env.example` contains all 5 env var names listed in step 5.
  </acceptance_criteria>
  <done>Scaffold builds cleanly with the exact pinned deps and Phase 2+ can import from `ai`, `@sentry/nextjs`, and all three providers.</done>
</task>

<task type="auto">
  <name>Task 2: Wire Sentry + 3-provider `/api/smoke` route</name>
  <files>
    app/instrumentation.ts, sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, app/api/smoke/route.ts
  </files>
  <read_first>
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/PRD_SPEC.md §12 (Sentry integration points)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/SUMMARY.md §2 and §7 item 4 (provider model alias smoke test)
    - /Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/research/PITFALLS.md (P22 Anthropic TPM org-level)
  </read_first>
  <action>
    Wire Sentry AI integration and a single smoke route hitting all three frontier providers via `generateText`.

    1. `app/instrumentation.ts`:
       ```ts
       export async function register() {
         if (process.env.NEXT_RUNTIME === 'nodejs') {
           await import('./sentry.server.config');
         }
         if (process.env.NEXT_RUNTIME === 'edge') {
           await import('./sentry.edge.config');
         }
       }
       ```
    2. `sentry.server.config.ts` and `sentry.edge.config.ts` — both:
       ```ts
       import * as Sentry from '@sentry/nextjs';
       Sentry.init({
         dsn: process.env.SENTRY_DSN,
         tracesSampleRate: 1.0,
         integrations: [Sentry.vercelAIIntegration()],
       });
       ```
    3. `sentry.client.config.ts`:
       ```ts
       import * as Sentry from '@sentry/nextjs';
       Sentry.init({
         dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
         tracesSampleRate: 1.0,
       });
       ```
    4. `app/api/smoke/route.ts`:
       ```ts
       import { generateText } from 'ai';
       import { anthropic } from '@ai-sdk/anthropic';
       import { openai } from '@ai-sdk/openai';
       import { google } from '@ai-sdk/google';

       export const runtime = 'nodejs'; // hard constraint: child_process callers require this
       export const dynamic = 'force-dynamic';

       export async function GET() {
         const prompt = 'Reply with the single word: pong.';
         const [a, o, g] = await Promise.allSettled([
           generateText({ model: anthropic('claude-opus-4-5'), prompt, experimental_telemetry: { isEnabled: true, functionId: 'smoke.anthropic' } }),
           generateText({ model: openai('gpt-5'), prompt, experimental_telemetry: { isEnabled: true, functionId: 'smoke.openai' } }),
           generateText({ model: google('gemini-2.5-pro'), prompt, experimental_telemetry: { isEnabled: true, functionId: 'smoke.google' } }),
         ]);
         const summarize = (r: PromiseSettledResult<{ text: string }>) =>
           r.status === 'fulfilled' ? { ok: true, text: r.value.text } : { ok: false, error: String(r.reason).slice(0, 400) };
         return Response.json({
           anthropic: summarize(a),
           openai: summarize(o),
           google: summarize(g),
         });
       }
       ```
    5. If the Anthropic alias 404s, the route MUST log `model alias not found: claude-opus-4-5` in the error text so the operator can swap to `claude-opus-4-7` or `claude-opus-4-latest` without redeploying code. Do NOT silently try fallbacks — reject and surface.
    6. HARD CONSTRAINT: the `runtime = 'nodejs'` line is MANDATORY on every route file we ever write that calls `child_process` or `spawn`. Keep it here so the pattern is cemented.
  </action>
  <verify>
    <automated>cd /Users/julianschmidt/Documents/GitHub/codex-hackathon && npx tsc --noEmit && (npx next dev &>/tmp/next.log & echo $! > /tmp/next.pid; sleep 8; curl -s http://localhost:3000/api/smoke | tee /tmp/smoke.json | head -c 2000; kill $(cat /tmp/next.pid) 2>/dev/null) && grep -E '"ok":true' /tmp/smoke.json | head -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export const runtime = 'nodejs'" app/api/smoke/route.ts` succeeds.
    - `grep -E "Sentry\\.vercelAIIntegration" sentry.server.config.ts` succeeds.
    - `grep -E "Sentry\\.vercelAIIntegration" sentry.edge.config.ts` succeeds.
    - `curl http://localhost:3000/api/smoke` returns JSON with all three provider entries; at least two must have `"ok": true` (if one provider is down at H0, operator manually switches alias per action step 5).
    - Sentry dashboard shows ≥1 `gen_ai.generate_text` span within 60 s of the curl hit. (Operator-verified visually; automated check is route returning 200 with telemetry flag set.)
  </acceptance_criteria>
  <done>Smoke route returns 200 with ≥2 of 3 providers responding, Sentry receives `gen_ai` spans. Provider alias drift is visible in the response body, not silent.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /api/smoke | Public HTTP endpoint. No user input is passed to models (hardcoded prompt). |
| /api/smoke → provider APIs | Outbound to frontier providers; API keys cross this boundary via process env. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | `.env` secrets in git | mitigate | `.gitignore` excludes `.env*` except `.env.example`; only placeholder keys committed. |
| T-01-02 | Information Disclosure | Smoke route leaking provider error bodies | mitigate | Truncate error to 400 chars; do not echo raw provider 401 bodies (may contain headers). |
| T-01-03 | Denial of Service | Public `/api/smoke` hit in a loop burns TPM | accept | Pre-demo dev env only; demo machine not publicly reachable. Remove route before any deploy. |
| T-01-04 | Tampering | Unpinned deps drift at install time | mitigate | Exact version pins per research/SUMMARY.md §2; lockfile committed. |
</threat_model>

<verification>
- `npm install` + `npx next build` + `npx tsc --noEmit` all exit 0.
- `curl /api/smoke` returns JSON; ≥2 providers `ok:true`.
- Sentry dashboard shows `gen_ai` spans for the 3 provider calls.
- Grep confirms `runtime = 'nodejs'` on the route.
- `.env` not committed; `.env.example` is.
</verification>

<success_criteria>
FND-03 (Next.js 15 + AI SDK v6 + Sentry ≥9.29.0 scaffold with `runtime='nodejs'` on child_process routes) and FND-04 (one `generateText` hello each to Opus 4.7, GPT-5, Gemini 2.5 Pro) pass within 45 min. Phase 2 orchestrator can `import { Experimental_Agent as Agent } from 'ai'` on top of this scaffold.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-smoke/01-01-SUMMARY.md` noting:
- Exact Anthropic alias that worked (likely `claude-opus-4-5` or `-4-7`).
- Sentry DSN source (which env var the dashboard shows on).
- Any provider that failed and the workaround.
</output>
