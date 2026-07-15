---
phase: 03-discovery-tool-design
plan: 05
subsystem: tools
tags: [fallback, supabase, hand-written, kill-point, SWR-08]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [SWR-08-fallback, adapter-tools.fallback.json]
  affects: [03-04]
tech_stack:
  added: []
  patterns: [vm-sandbox, base64url-manual-decode, pure-compute-tools]
key_files:
  created:
    - lib/tools/hand-written-supabase.ts
    - lib/tools/hand-written-supabase.test.ts
    - data/adapter-tools.fallback.json
  modified:
    - .gitignore
decisions:
  - "Hand-rolled base64url decoder for JWT tool (no Buffer/atob in empty vm context)"
  - "Used regex literal (not RegExp constructor) for connection string parser"
  - "All tools use var/function for max vm compat (no const/let/arrow)"
metrics:
  duration_seconds: 285
  completed: "2026-04-18T12:21:19Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 05: Hand-Written Supabase Fallback Tools Summary

SWR-08 kill-point safety net: 8 pure-compute Supabase tools passing full 5-gate validation, serialized to fallback manifest.

## Tool Inventory

| # | Tool Name | Description | Body Size |
|---|-----------|-------------|-----------|
| 1 | `supabase_rls_policy_template` | RLS DDL generation for table/role/operation | ~200 chars |
| 2 | `supabase_select_query_builder` | Parameterized SELECT with WHERE clauses | ~500 chars |
| 3 | `supabase_storage_path_builder` | Storage object path from bucket/user/file | ~150 chars |
| 4 | `supabase_edge_function_name_validator` | Deno-compat name validation | ~300 chars |
| 5 | `supabase_column_type_mapper` | PG type to TS type mapping (24 types) | ~400 chars |
| 6 | `supabase_connection_string_parser` | Pure-regex postgres:// URL parsing | ~250 chars |
| 7 | `supabase_jwt_claims_extractor` | Hand-rolled base64url decode, extract sub/role/exp | ~700 chars |
| 8 | `supabase_migration_filename` | YYYYMMDDHHMMSS_snake_case.sql from ms+desc | ~400 chars |

## Validation Results

All 8 tools pass the full 5-gate validator:

| Gate | Name | Result |
|------|------|--------|
| 1 | Schema (AJV 2020-12) | 8/8 pass |
| 2 | Parse (AST deny-list) | 8/8 pass |
| 3 | Sandbox (empty vm smoke) | 8/8 pass |
| 4 | Fuzz (10 inputs, 0 throws) | 8/8 pass |
| 5 | Trajectory (deep-equal) | 8/8 pass |

Validation wall-time: ~525ms for all 8 tools (62ms avg per tool across 5 gates). This is well within budget for Plan 03-04's parallelism calibration.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `eb170e3` | 8 tools + fallback JSON + gitignore whitelist |
| 2 | `d53fd6b` | Unit tests: all 8 pass 5-gate validator |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.gitignore` excluded `data/adapter-tools.fallback.json`**
- **Found during:** Task 1 commit
- **Issue:** `.gitignore` had `data/*` with only `!data/corpus.json` exception; fallback JSON was ignored
- **Fix:** Added `!data/adapter-tools.fallback.json` to `.gitignore` exceptions
- **Files modified:** `.gitignore`
- **Commit:** `eb170e3`

### Design Notes

- **JWT tool (supabase_jwt_claims_extractor):** Required a hand-rolled base64url decoder because `vm.createContext({})` provides zero Node globals (no `Buffer`, no `atob`). The 20-line inline decoder uses only `String.fromCharCode` and character index math.
- **Connection string parser:** Regex literal `/pattern/` works correctly in vm context; escaping of forward slashes (`\/`) within the regex is critical.
- **Fuzz resilience:** Every tool guards all inputs with `String(args.x || '')` / `Number(args.x) || 0` / `Array.isArray()` patterns. The fuzz generator sends values outside enum constraints (STRING_PRIMS for all string-typed properties regardless of enum), so tool bodies must not assume enum-valid inputs.
- **Migration filename:** Uses `new Date(ms)` constructor (not banned) but handles `NaN` from extreme numbers (1e308) gracefully via the pad() helper returning string representations of NaN that don't throw.

## Threat Surface

No new threat surface introduced. All tools are pure-compute with no network, no filesystem, and no dynamic code generation. The fallback manifest is a static JSON artifact with `source: 'fallback'` provenance marker.

## Self-Check: PASSED

All 3 created files verified on disk. Both commit hashes (eb170e3, d53fd6b) found in git log.
