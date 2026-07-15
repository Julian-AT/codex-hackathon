# Coding Conventions

**Analysis Date:** 2026-07-15

This map covers MLX — the personal coding dataset and model pipeline. Use the conventions below when adding TypeScript/Bun CLI, local pipeline, and validation code.

## Naming Patterns

**Files:**
- Use lowercase kebab-case for command and multiword modules: `src/commands/data-gen.ts`, `src/lib/context-store.ts`, `lib/adapter/run-adapter.ts`, `lib/training/run-training.ts`.
- Use lowercase single nouns for focused modules: `lib/data/dedupe.ts`, `lib/data/split.ts`, `lib/data/checkpoint.ts`, `lib/discovery/corpus.ts`.
- Keep tests co-located with implementation using `.test.ts`: `lib/data/dedupe.test.ts`, `lib/discovery/validate/sandbox.test.ts`, `src/lib/config.test.ts`.
- Keep React Ink components in `src/components/*.tsx` with kebab-case filenames: `src/components/input-prompt.tsx`, `src/components/message-list.tsx`.
- Avoid new giant `index.ts` modules. `src/commands/index.ts` is a registry and type surface; new subsystem logic belongs in dedicated files such as `lib/data/pipeline.ts` or `src/commands/serve.ts`.

**Functions:**
- Use `camelCase` verbs for functions: `processUserInput` in `src/commands/index.ts`, `loadConfig` in `src/lib/config.ts`, `validateTool` in `lib/discovery/validate/index.ts`, `runDataGenPipeline` in `lib/data/pipeline.ts`.
- Use factory-style `make*` helpers in tests and deterministic helpers: `makeTrainingExample` in `lib/data/emit-jsonl.test.ts`, `makeRng` in `lib/data/personas.ts`, `makeCheckpointDir` in `lib/training/supervisor.test.ts`.
- Use `run*` for operations with side effects or external execution: `runDiscoveryPipeline` in `lib/discovery/pipeline.ts`, `runEval` in `lib/eval/run.ts`, `runTraining` in `lib/training/run-training.ts`.
- Use `validate*` for validation gates that return structured pass/fail objects: `validateSchema` in `lib/discovery/validate/schema.ts`, `validateParse` in `lib/discovery/validate/parse.ts`, `validateFuzz` in `lib/discovery/validate/fuzz.ts`.

**Variables:**
- Use `camelCase` for locals and object properties: `serverStatus`, `rawInput`, `sourceChunks`, `tokenCount`, `failedGate`.
- Use `UPPER_SNAKE_CASE` for module constants: `REGISTRY` and `ALIASES` in `src/commands/index.ts`, `TMP_DIR` in `lib/data/emit-jsonl.test.ts`, `SPLIT_MANIFEST_PATH` in `lib/data/split.ts`.
- Use concise loop variables only in tight local loops (`i`, `ex`, `ev`) as in `lib/data/dedupe.ts` and `src/commands/discover.ts`; prefer descriptive names outside those scopes.

**Types:**
- Use `PascalCase` for interfaces and type aliases: `CommandContext`, `Command`, `UserInput` in `src/commands/index.ts`; `TrainingExample`, `ChatMessage`, `DynamicToolSpec` in `lib/data/types.ts` and `lib/discovery/types.ts`.
- Model discriminated unions with string literal `kind` or `type` fields: `UserInput` in `src/commands/index.ts`, `PipelineEvent` in `lib/discovery/pipeline.ts`, `SupervisorSignal` in `lib/training/supervisor.ts`.
- Export package-boundary types from the module that owns the contract: `lib/discovery/types.ts` owns discovery contracts; `lib/data/types.ts` re-exports selected discovery types for data-generation code.

## Code Style

**Formatting:**
- Tool: Biome via `biome.json`.
- Run `bun run check` before completion; run `bun run format` for mechanical formatting.
- Biome settings in `biome.json`: tabs for indentation, line width 100, single quotes, semicolons required, organized imports enabled.
- New TypeScript should follow the Biome shape used in `src/commands/index.ts`, `src/lib/config.ts`, and `lib/discovery/validate/index.ts`.
- Some current `lib/data/*.ts` and `lib/data/*.test.ts` files use two-space indentation, for example `lib/data/dedupe.ts` and `lib/data/dedupe.test.ts`. Do not copy that style into new files; let Biome normalize touched files when the change scope allows.

**Linting:**
- Tool: Biome recommended linter via `biome.json`.
- `noExplicitAny` is disabled, but prefer `unknown`, typed schemas, or narrow interfaces at boundaries. Existing examples: `toErrorMessage(error: unknown)` in `lib/server/errors.ts`, `validateSchema(parameters: unknown)` in `lib/discovery/validate/schema.ts`.
- Non-null assertions are warnings. Avoid `!` except in test assertions or after local invariants are clear; prefer explicit guards when adding production code.
- `tsconfig.json` enables `strict`, `isolatedModules`, `resolveJsonModule`, and `moduleResolution: "bundler"`. Keep new code strict-compatible.

## Import Organization

**Order:**
1. Node built-ins: `node:fs/promises`, `node:path`, `node:crypto`.
2. Third-party packages: `react`, `ink`, `zod`, `ai`, `p-limit`, `vitest`.
3. Absolute project imports through `@/*` for cross-root library references: `@/lib/model`, `@/lib/discovery/pipeline`.
4. Relative local imports for same-area modules: `./types`, `../tool-args`, `./validate/index`.
5. Type-only imports should use `import type` or inline `type` specifiers: `import type { Command } from './index';`, `import { type ManifestMeta, copyFallback } from './manifest';`.

**Path Aliases:**
- `@/*` maps to the repository root in `tsconfig.json` and `vitest.config.ts`.
- Use `@/lib/...` for imports crossing between `src` and `lib`, as in `src/app-oneshot.tsx` and `lib/data/qa-worker.ts`.
- Use relative imports inside one package or feature directory, as in `lib/discovery/pipeline.ts` and `src/commands/serve.ts`.

## Error Handling

**Patterns:**
- Return typed result objects for expected validation failures instead of throwing. Use `{ pass: false, failedGate, reason }` like `lib/discovery/validate/schema.ts`, `lib/discovery/validate/parse.ts`, and `lib/discovery/validate/trajectory.ts`.
- Throw for programmer errors or unrecoverable invariants: `dedupeByMinHash` helpers throw length mismatch errors in `lib/data/dedupe.ts`; `waitForServer` throws readiness timeout errors in `src/lib/server-manager.ts`.
- Use domain-specific errors when callers need special handling. `KillPointError` in `lib/discovery/pipeline.ts` lets `src/commands/discover.ts` distinguish SWR-08 fallback from ordinary failures.
- Convert unknown caught values with `toErrorMessage` from `lib/server/errors.ts` when surfacing process or stream errors.
- CLI commands should log expected operator-facing errors and return instead of throwing when the command can recover, as in `src/commands/discover.ts`, `src/commands/serve.ts`, and `src/commands/config.ts`.
- Preserve abort/cancellation flow through `AbortSignal` in command contexts: `CommandContext.signal` in `src/commands/index.ts`, pipeline abort handling in `src/commands/commands.test.ts`.

## Logging

**Framework:** Console and command-context logging.

**Patterns:**
- CLI command modules log through `ctx.log(...)` rather than writing directly to console: `src/commands/discover.ts`, `src/commands/pipeline.ts`, `src/commands/train.ts`.
- Process entry code may use `console.log` and `console.error`: `src/cli.tsx`.
- Long-running pipeline events should use typed event callbacks and let the caller decide presentation: `onEvent` in `lib/discovery/pipeline.ts`, `onData` in `src/commands/train.ts`.
- Keep warnings explicit and actionable: `src/commands/discover.ts` logs corpus-size and model-server guidance; `src/commands/serve.ts` logs health-check warnings.

## Comments

**When to Comment:**
- Comment boundary contracts and validation gates where they encode product constraints. Examples: `lib/discovery/types.ts` documents shared vocabulary; `lib/discovery/validate/index.ts` labels schema, parse, sandbox, fuzz, and trajectory gates.
- Use short comments for non-obvious thresholds or risk controls: `lib/coordinator/coordinator.ts` labels step and concurrency caps; `lib/discovery/pipeline.ts` labels the retry arm and SWR-08 kill point.
- Avoid comments that restate simple expressions. Prefer named functions and typed return values for ordinary logic.

**JSDoc/TSDoc:**
- Use block comments sparingly for shared contracts, as in `lib/discovery/types.ts`.
- Most functions do not use JSDoc. Preserve that style unless documenting exported behavior that is hard to infer from type names.

## Function Design

**Size:** Keep most functions small and single-purpose. Parser/validator helpers such as `validateSchema` in `lib/discovery/validate/schema.ts` and `toErrorMessage` in `lib/server/errors.ts` are the model. Larger orchestration functions such as `runDataGenPipeline` in `lib/data/pipeline.ts` and `runDiscoveryPipeline` in `lib/discovery/pipeline.ts` are acceptable when they coordinate named stages and emit progress events.

**Parameters:** Use an options object for public async workflows and anything with more than two knobs: `PipelineOptions` in `lib/discovery/pipeline.ts`, `QABatchOptions` in `lib/data/qa-worker.ts`, `TrajBatchOptions` in `lib/data/traj-worker.ts`, `ServerOptions` in `src/lib/server-manager.ts`.

**Return Values:** Return typed contracts that expose counts, artifacts, and pass/fail details instead of loose objects: `PipelineResult` in `lib/data/pipeline.ts`, `ValidationResult` in `lib/discovery/types.ts`, `EvalRunResult` in `lib/eval/types.ts`.

## Module Design

**Exports:** Prefer named exports for library code and default exports only for command objects. Examples: `src/commands/discover.ts` exports `command` as default; `lib/data/dedupe.ts`, `lib/discovery/validate/index.ts`, and `src/lib/config.ts` use named exports.

**Barrel Files:** Use barrel-style files only for registries or contract aggregation. `src/commands/index.ts` owns command registry, command types, aliases, and completions. Avoid adding feature logic to it.

**Schemas:** Use Zod for internal model/object shapes (`src/lib/config.ts`, `lib/data/qa-prompts.ts`, `lib/discovery/worker.ts`) and AJV for JSON Schema validation of generated tools (`lib/discovery/validate/schema.ts`, `lib/data/schema-gate.ts`). Keep schema definitions close to the module that validates or emits the data.

**Side Effects:** Keep side effects explicit at orchestration boundaries: filesystem writes in `lib/data/emit-jsonl.ts`, `lib/discovery/manifest.ts`, `src/lib/config.ts`; subprocess management in `src/lib/server-manager.ts`, `lib/adapter/run-adapter.ts`, `lib/training/run-training.ts`.

---

*Convention analysis: 2026-07-15*
