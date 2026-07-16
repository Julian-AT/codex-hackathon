# Deferred Items

- `bun run check` remains red on pre-existing operator-owned files outside Plan 02-01, including `lib/discovery/validate/parse.test.ts`. The seven Plan 02-01 files pass a scoped Biome check, all 30 focused tests, and typecheck. No unrelated file was changed to repair the repository-wide baseline.
