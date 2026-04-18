# STATE — Project Memory

**Status:** initialized. No phases started. No builds run.

## Current Position

- **Active phase:** none (Phase 1 is next).
- **Next command:** `/gsd-plan-phase 1`.
- **Mode:** yolo, coarse, parallel. Workflow agents: research + plan-check + verifier ON.

## Decisions Log

| When | Decision | Source |
|------|----------|--------|
| 2026-04-18 init | Base model pinned `unsloth/gemma-4-E4B-it-UD-MLX-4bit`; fallback E2B if H0 bench > 20 GB peak | PRD §5 |
| 2026-04-18 init | No PWA / WebLLM / transformers.js / llama.cpp / HF Transformers / Core ML / ExecuTorch paths | PRD §2.3, §4.2 |
| 2026-04-18 init | Zero Python application code — Python is a pinned CLI subprocess only | PRD §2.3, §3 |
| 2026-04-18 init | Tool sandbox: `node:vm` + `worker_threads`, 2s AbortController, 64 MB cap — no E2B / WebContainers | PRD §9.3, §19.4 |
| 2026-04-18 init | Teacher: Claude Opus 4.7. Judge jury: GPT-5 + Gemini 2.5 Pro (cross-family anti-leakage) | PRD §4.1, §7.2, §11.4 |
| 2026-04-18 init | Primary product: Supabase. Audience-pick cache priority: Vercel AI SDK → Zod → Hono | PRD §17 |
| 2026-04-18 init | Airplane-mode enforcement via `NWPathMonitor` + Guided Access; `requiresNetwork:true` tools return structured error offline, training data covers both success and refusal trajectories | PRD §8.4, §9.5 |

## Open Questions

None at init. All questions pre-resolved in PRD_SPEC.md.

## Rolling Notes

- Friday prep time was lost; Saturday is H0→H12 hard with no slack. Every kill-point in each phase is load-bearing.
- Audience pre-cache (Vercel AI SDK / Zod / Hono) is v2 stretch, not v1 blocker.
- Tier 3 cassette from H7 is the always-on floor: the demo cannot fail below cassette + live narration.
