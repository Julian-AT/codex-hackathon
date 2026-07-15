# AGENTS.md — Forgeprint

## Mission

Forgeprint turns accepted GitHub repository history into a local, provenance-first coding dataset, a Gemma 4 MLX adapter, executable evaluations, and a presentation dashboard.

## Product invariants

- The product and binary are `forgeprint`. Never create a `codex` binary or alias.
- Private repositories, mirrors, prompts, datasets, adapters, and source snippets stay outside Git and local by default.
- Do not treat AI-generated code as lower quality merely because it was AI-generated.
- Verification, provenance, leakage control, and holdout integrity outrank dataset size.
- Runtime model tools are fixed and typed. Never expose arbitrary shell execution.
- Never fabricate metrics or mark fixture/replay data as live.
- Never store or train hidden chain-of-thought; use concise observable plans and tool traces.

## Engineering conventions

- Bun workspaces, TypeScript strict mode, named exports, Zod at every external boundary.
- Biome: tabs, single quotes, semicolons, 100-character line width.
- Use process argument arrays; do not construct shell commands from model/user text.
- Use explicit error classes and preserve causes. Do not silently swallow failures.
- Long-running operations must support cancellation, cleanup, checkpoints, and resume.
- Keep platform-specific MLX code behind a backend interface with a deterministic mock.
- Tests must not require network, GitHub auth, private data, Apple Silicon, or MLX unless explicitly gated.

## Data and privacy

- Runtime data root is `~/.forgeprint` or `FORGEPRINT_HOME`.
- Never commit mirrors, raw evidence, datasets, model weights, adapters, secrets, tokens, absolute home paths, or private repository names.
- Presentation mode redacts private names and code unless explicitly allowlisted.
- Cloud egress is denied for private/internal repositories by default.

## Required checks

Before completing a change, run and fix:

```bash
bun run check
bun run typecheck
bun run test
bun run test:integration
bun run studio:build
bun run cloud:check
git diff --check
```

Mac-only MLX checks are gated by `FORGEPRINT_MLX_INTEGRATION=1`. Report them as unverified when not executed; never describe a skipped check as passing.

## Completion standard

Do not leave production TODOs, fake data paths, empty commands, placeholder success messages, unsafe shell calls, or stale Supabase/iPhone behavior. Update documentation whenever behavior, schemas, commands, privacy boundaries, or training configuration changes.
