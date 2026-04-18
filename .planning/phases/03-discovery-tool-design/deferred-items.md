# Deferred Items — Phase 3

Out-of-scope issues discovered during execution, not caused by current plans.

## Pre-existing TS error in lib/streams/trainParser.test.ts

- **File:** `lib/streams/trainParser.test.ts:3`
- **Error:** `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.`
- **Discovered in:** Plan 03-01 (verified pre-existing via `git stash` + tsc)
- **Scope:** Pre-dates Phase 3 — from Phase 2 (Plan 02-02 trainParser tests). Does NOT block Phase 3 work.
- **Recommendation:** Either add `"allowImportingTsExtensions": true` to tsconfig, or rewrite the import without the `.ts` suffix. Track in Phase 2 cleanup.
