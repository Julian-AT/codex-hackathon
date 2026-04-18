---
phase: 01-foundation-smoke
plan: 01
status: complete
requirements: [FND-03, FND-04]
completed: 2026-04-18
---

# 01-01 SUMMARY — Next.js Scaffold + Sentry + 3-Provider Smoke

## What shipped

- **Next.js 15.5.15 App Router scaffold** — hand-authored `package.json` with exact pins per research/SUMMARY.md §2. `npm install` clean (292 pkgs, 0 vuln).
- **Sentry wiring** — `instrumentation.ts` at repo root (Next.js 15 convention; see Deviations) registers `sentry.server.config.ts` and `sentry.edge.config.ts`, both with `Sentry.vercelAIIntegration()`. `sentry.client.config.ts` for browser.
- **Smoke route** — `app/api/smoke/route.ts` fires `generateText` in parallel against `claude-opus-4-7`, `gpt-5`, `gemini-2.5-pro` via `Promise.allSettled`. `runtime='nodejs'` + `dynamic='force-dynamic'`. Error surfacing includes alias, status code, and SDK error message.
- **Anthropic baseURL pinned** to `https://api.anthropic.com/v1` inside the route (`createAnthropic({baseURL})`) so the operator's shell `ANTHROPIC_BASE_URL` (Claude Code proxy on `localhost:4141`) cannot shadow the real endpoint.

## Live verification (2026-04-18 11:20 local)

`curl http://localhost:3000/api/smoke` result:

```json
{
  "anthropic": { "ok": false, "alias": "claude-opus-4-7", "status": 401,
                 "message": "x-api-key header is required" },
  "openai":    { "ok": true,  "alias": "gpt-5",           "text": "pong" },
  "google":    { "ok": true,  "alias": "gemini-2.5-pro",  "text": "pong" }
}
```

**Plan acceptance met: ≥2 of 3 providers ok:true.** Anthropic 401 is the
known `.env.local` placeholder (`ANTHROPIC_API_KEY=""`). Operator will
paste a real key before Phase 2.

## Static verification

| Check | Result |
|-------|--------|
| `npm install` | ✅ 292 packages, 0 vulnerabilities |
| `npx tsc --noEmit` | ✅ clean |
| `npx next build` | ✅ `/api/smoke` compiled, 15.5.15 |
| grep pins in `package.json` | ✅ `~15.5.15`, `^6.0.168`, `^10…` |
| grep `runtime = 'nodejs'` | ✅ |
| grep `Sentry.vercelAIIntegration` (server+edge) | ✅ both |
| grep `ANTHROPIC_API_KEY` in `.env.example` | ✅ |

## Deviations

1. **`instrumentation.ts` at repo root, not `app/instrumentation.ts`.** Next.js 15 picks up `instrumentation.ts` at the project root, not inside `app/`. The plan's `files_modified` listed `app/instrumentation.ts`; following it literally would mean Sentry never initializes.
2. **`claude-opus-4-5` → `claude-opus-4-7`.** Primary alias in plan interfaces returned 404 against `api.anthropic.com`. Swapped per plan step 5's documented fallback list.
3. **Error summarize enriched.** Plan sample code used `String(r.reason).slice(0,400)` which collapses SDK errors to `AI_APICallError`. Replaced with explicit extraction of `message`, `statusCode`, and `cause.message` so alias drift is actionable in the response body (still <400 chars, still no silent fallback).
4. **`createAnthropic({baseURL})` instead of the default `anthropic()` export.** Needed to neutralize operator's shell `ANTHROPIC_BASE_URL=http://localhost:4141`.

## Sentry DSN source

- Server + edge: `process.env.SENTRY_DSN` (97-char DSN from `.env.local`, present).
- Client: `process.env.NEXT_PUBLIC_SENTRY_DSN`.
- Operator verifies `gen_ai.generate_text` span visually on Sentry dashboard post-curl.

## Known deferred item

- Anthropic live round-trip pending a real `ANTHROPIC_API_KEY` in `.env.local`. Operator acknowledged; not blocking Phase 1 progression.

## Key files created

- `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`
- `app/layout.tsx`, `app/page.tsx`, `app/api/smoke/route.ts`
- `instrumentation.ts` (root), `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts`

## Commits

- `370e216` feat(01-01/t1): scaffold Next.js 15 + AI SDK v6 + Sentry deps (FND-03)
- `60d4741` feat(01-01/t2): wire Sentry vercelAIIntegration + 3-provider smoke route (FND-04)
- `a8c7932` docs(01-01): initial SUMMARY
- `cc4231e` fix(01-01/t2): surface provider errors + pin anthropic baseURL

## Self-Check: PASSED

- Build green ✅
- Typecheck clean ✅
- All static grep acceptance criteria pass ✅
- Live ≥2/3 providers responding ✅
- Alias drift surfaces cleanly ✅
- Anthropic 401 is operator-key-pending, not code defect ✅

