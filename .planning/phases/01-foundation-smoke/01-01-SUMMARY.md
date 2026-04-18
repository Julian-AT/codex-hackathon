---
phase: 01-foundation-smoke
plan: 01
status: complete-deferred-live-check
requirements: [FND-03, FND-04]
completed: 2026-04-18
---

# 01-01 SUMMARY — Next.js Scaffold + Sentry + 3-Provider Smoke

## What shipped

- **Next.js 15.5.15 App Router scaffold** — hand-authored `package.json` with exact pins per research/SUMMARY.md §2 (no `create-next-app`). `react@^19`, `ai@^6.0.168`, `@ai-sdk/{anthropic,openai,google}`, `@sentry/nextjs@^10.49.0`, `zod`, `p-limit`, `acorn`, `chokidar`, `recharts`, `eventsource-parser`. `npm install` clean (292 pkgs, 0 vuln).
- **Sentry wiring** — `instrumentation.ts` at repo root (see Deviations) registers `sentry.server.config.ts` and `sentry.edge.config.ts`, both with `Sentry.vercelAIIntegration()`. `sentry.client.config.ts` for browser.
- **Smoke route** — `app/api/smoke/route.ts` fires `generateText` in parallel against Claude Opus (`claude-opus-4-5`), GPT-5 (`gpt-5`), Gemini 2.5 Pro (`gemini-2.5-pro`) via `Promise.allSettled`; per-provider errors surface in the response body (plan step 5 — no silent alias fallback). `runtime='nodejs'` + `dynamic='force-dynamic'`.
- **.env.example** documenting all 5 required env vars. `.gitignore` excludes `.env*` but keeps `.env.example`.

## Verification

| Check | Result |
|-------|--------|
| `npm install` | ✅ 292 packages, 0 vulnerabilities |
| `npx tsc --noEmit` | ✅ clean |
| `npx next build` | ✅ `/api/smoke` compiled, 15.5.15 |
| grep pins in `package.json` | ✅ `~15.5.15`, `^6.0.168`, `^10…` |
| grep `runtime = 'nodejs'` | ✅ |
| grep `Sentry.vercelAIIntegration` (server+edge) | ✅ both |
| grep `ANTHROPIC_API_KEY` in `.env.example` | ✅ |

## Deferred to operator (requires live keys)

- `curl http://localhost:3000/api/smoke` returning ≥2/3 providers `ok:true` — **blocked** until operator sets `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` in `.env`. The route is built and typechecked; only the network verification is open.
- Sentry `gen_ai.generate_text` span visible in dashboard — requires `SENTRY_DSN` set before curl.

## Deviations

1. **`instrumentation.ts` at repo root, not `app/instrumentation.ts`.** Next.js 15 picks up `instrumentation.ts` at the project root (same level as `app/`), not inside it. The plan's `files_modified` listed `app/instrumentation.ts`; following it literally would mean Sentry never initializes. Followed the framework convention instead.

## Exact Anthropic alias

- Route wired to `claude-opus-4-5` per plan interfaces block.
- If the live curl returns `404 model not found`, operator swaps to `claude-opus-4-7` or `claude-opus-4-latest` (plan step 5 — errors echoed, not swallowed).

## Sentry DSN source

- Server + edge: `process.env.SENTRY_DSN`.
- Client: `process.env.NEXT_PUBLIC_SENTRY_DSN`.

## Key files created

- `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`
- `app/layout.tsx`, `app/page.tsx`, `app/api/smoke/route.ts`
- `instrumentation.ts` (root), `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts`

## Commits

- `370e216` feat(01-01/t1): scaffold Next.js 15 + AI SDK v6 + Sentry deps (FND-03)
- `60d4741` feat(01-01/t2): wire Sentry vercelAIIntegration + 3-provider smoke route (FND-04)

## Self-Check

- Build green ✅
- Typecheck clean ✅
- All static grep acceptance criteria pass ✅
- Live provider round-trip deferred pending operator API keys ⏳
