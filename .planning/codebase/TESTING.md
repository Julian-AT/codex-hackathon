# Testing Patterns

**Analysis Date:** 2026-07-15

This map covers MLX — the personal coding dataset and model pipeline. Tests are primarily TypeScript unit and integration-style tests around CLI commands, data generation, validation gates, training supervision, and local pipeline behavior.

## Test Framework

**Runner:**
- Vitest 3.2.x from `package.json`.
- Config: `vitest.config.ts`.
- Test environment: Node (`environment: 'node'` in `vitest.config.ts`).
- Test include globs: `lib/**/*.test.ts`, `lib/**/*.spec.ts`, `src/**/*.test.ts`.
- `fileParallelism: false` in `vitest.config.ts`; tests run without file-level parallelism because several tests touch shared paths such as `data/adapter-tools.json`, `data/split.manifest.json`, and `data/.test-emit`.
- Test and hook timeouts are 10 seconds by default in `vitest.config.ts`.

**Assertion Library:**
- Vitest `expect`, with explicit imports because `globals: false` in `vitest.config.ts`.
- Use `describe`, `it`, `expect`, `beforeEach`, `afterEach`, and `vi` from `vitest`.

**Run Commands:**
```bash
bun run test          # Run all Vitest tests once
bun run test:watch    # Run Vitest in watch mode
bun run typecheck     # Type-check TypeScript with no emit
bun run check         # Run Biome lint/format checks
```

Coverage is not configured in `package.json` or `vitest.config.ts`. There is no enforced coverage threshold.

## Test File Organization

**Location:**
- Tests are co-located beside the code under test.
- Library tests live under `lib/**`: `lib/data/dedupe.test.ts`, `lib/discovery/validate/sandbox.test.ts`, `lib/training/supervisor.test.ts`.
- CLI and REPL support tests live under `src/**`: `src/commands/commands.test.ts`, `src/commands/index.test.ts`, `src/lib/config.test.ts`.
- Pure validation contract tests live under `src/validation/**`, colocated with result normalization, capability evidence, and the ordered check catalog.
- iOS Swift test files exist under `ios/SpecialistApp/GemmaToolParserTests.swift`, but TypeScript Vitest excludes `ios` through `tsconfig.json` and Biome ignores `ios` through `biome.json`.

**Naming:**
- Use `.test.ts` for TypeScript tests.
- Use one test file per implementation module when practical: `lib/data/split.ts` → `lib/data/split.test.ts`, `lib/streams/trainParser.ts` → `lib/streams/trainParser.test.ts`.
- Broader command behavior is grouped in `src/commands/commands.test.ts`; command registry parsing is isolated in `src/commands/index.test.ts`.

**Structure:**
```text
lib/data/
├── dedupe.ts
├── dedupe.test.ts
├── emit-jsonl.ts
├── emit-jsonl.test.ts
└── __fixtures__/

lib/discovery/validate/
├── index.ts
├── index.test.ts
├── sandbox.ts
├── sandbox.test.ts
└── sandbox.worker.mjs

src/lib/
├── config.ts
├── config.test.ts
├── conversation.ts
└── conversation.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';
import { runInSandbox } from './sandbox';

describe('runInSandbox', () => {
	it('runs a happy-path body and returns JSON-serialized value', async () => {
		const r = await runInSandbox('function addNumbers(args) { return { sum: args.a + args.b }; }', {
			a: 2,
			b: 3,
		});
		expect(r.ok).toBe(true);
		expect(r.value).toEqual({ sum: 5 });
	});
});
```

**Patterns:**
- Group tests by public function or domain concept: `describe('MinHash')` and `describe('Cosine')` in `lib/data/dedupe.test.ts`; `describe('loadConfig')` and `describe('formatConfig')` in `src/lib/config.test.ts`.
- Use behavior-focused `it(...)` descriptions that state the invariant: `it('returns pass: false for overlapping sets')` in `lib/data/emit-jsonl.test.ts`, `it('rolls back on two consecutive NaN losses')` in `lib/training/supervisor.test.ts`.
- For a missing implementation in a registered RED gate, use a late dynamic import and fail through a named Vitest assertion so the suite collects successfully; setup/import/collection errors are not valid RED evidence.
- Use local fixture helpers at the top of the file: `makeTrainingExample` in `lib/data/emit-jsonl.test.ts`, `makeExample` in `lib/data/stratify.test.ts`, `makeCheckpointDir` in `lib/training/supervisor.test.ts`.
- Use `beforeEach` to reset environment variables and mocks: `src/lib/config.test.ts`, `lib/data/qa-worker.test.ts`, `lib/data/judge.test.ts`.
- Use `afterEach` to clean temporary files and restore process state: `lib/data/emit-jsonl.test.ts`, `src/lib/config.test.ts`, `lib/training/rollback.test.ts`, `lib/training/supervisor.test.ts`.

## Mocking

**Framework:** Vitest `vi`.

**Patterns:**
```typescript
vi.mock('ai', () => ({
	generateObject: vi.fn().mockResolvedValue({
		object: {
			question: 'What is RLS in Supabase?',
			answer: 'Row Level Security ...',
			toolCalls: undefined,
		},
	}),
}));

vi.mock('@/lib/model', () => ({
	getModel: vi.fn(() => 'mocked-local-model'),
}));
```

**What to Mock:**
- Mock LLM and model clients in worker tests: `lib/data/qa-worker.test.ts`, `lib/data/judge.test.ts`, `lib/data/traj-worker.test.ts`, `src/lib/conversation.test.ts`.
- Mock command dependencies in `src/commands/commands.test.ts`: `@/lib/discovery/corpus`, `@/lib/discovery/pipeline`, `@/lib/data/pipeline`, `@/lib/training/run-training`, `@/lib/eval/run`, `@/lib/adapter/run-adapter`.
- Mock UI components when testing command behavior rather than Ink rendering: `../components/train-view` and `../components/pipeline-view` in `src/commands/commands.test.ts`.
- Use `vi.mocked(moduleFn)` when changing mock behavior inside a test, as in `lib/data/qa-worker.test.ts` and `lib/data/judge.test.ts`.

**What NOT to Mock:**
- Do not mock pure deterministic logic. Test real implementations for deduplication, split hashes, parsers, schema validation, tool-argument normalization, and training supervision: `lib/data/dedupe.test.ts`, `lib/data/split.test.ts`, `lib/streams/trainParser.test.ts`, `lib/discovery/validate/schema.test.ts`, `lib/training/supervisor.test.ts`.
- Test `src/validation/result.ts`, `capabilities.ts`, and `check-catalog.ts` directly. These modules are pure contracts; host process adapters and recursive package-script execution do not belong in their unit suites.
- Do not call live external model APIs in unit tests. Use `vi.mock('ai', ...)` and `vi.mock('@/lib/model', ...)`.
- Do not rely on committed generated outputs as proof of live behavior. Fixture and replay data must remain labeled as such per `AGENTS.md` and `docs/MLX_PROJECT_SPEC.md`.

## Fixtures and Factories

**Test Data:**
```typescript
const mockChunks: Chunk[] = [
	{
		id: 'llms.txt#0001',
		source: 'llms',
		text: 'Supabase uses Row Level Security (RLS) policies to control data access at the row level.',
		tokenCount: 15,
		ordinal: 0,
	},
];
```

**Location:**
- JSON fixtures live in `lib/data/__fixtures__/mock-corpus.json`, `lib/data/__fixtures__/mock-tools.json`, `lib/discovery/__fixtures__/mock-candidates.json`, and `lib/discovery/__fixtures__/llms-mini.txt`.
- Inline fixtures are common for compact unit tests: `mockChunks` in `lib/data/qa-worker.test.ts`, `mockTools` in `lib/data/emit-jsonl.test.ts`, command context objects in `src/commands/commands.test.ts`.
- Temporary filesystem fixtures should use OS temp directories where possible: `mkdtemp(path.join(tmpdir(), ...))` in `lib/training/supervisor.test.ts` and `lib/training/rollback.test.ts`.
- Tests that touch repository `data/` paths must clean up explicitly. Examples: `lib/data/emit-jsonl.test.ts` removes files under `data/.test-emit`; `lib/data/split.test.ts` unlinks `SPLIT_MANIFEST_PATH`.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not configured. Add Vitest coverage tooling before using a coverage command.
```

The practical quality gate is the stable script set in `package.json`: `bun run test`, `bun run typecheck`, and `bun run check`. `AGENTS.md` also requires additional project-level scripts such as `test:integration`, `studio:build`, `dataset:validate`, `benchmark:smoke`, and `local:check`, but these scripts are not present in the current `package.json`.

## Test Types

**Unit Tests:**
- Pure algorithm tests: MinHash/cosine dedupe in `lib/data/dedupe.test.ts`, stratification in `lib/data/stratify.test.ts`, train parser in `lib/streams/trainParser.test.ts`.
- Parser and schema tests: `lib/discovery/validate/parse.test.ts`, `lib/discovery/validate/schema.test.ts`, `lib/discovery/validate/trajectory.test.ts`, `lib/data/schema-gate.test.ts`.
- Configuration and command parsing tests: `src/lib/config.test.ts`, `src/commands/index.test.ts`.

**Integration Tests:**
- Command orchestration with mocked dependencies: `src/commands/commands.test.ts`.
- Pipeline behavior around manifests, fallback, and kill points: `lib/discovery/pipeline.test.ts`.
- Sandbox validation using worker execution and timeout/memory boundaries: `lib/discovery/validate/sandbox.test.ts`.
- JSONL writing and overlap validation with real filesystem writes: `lib/data/emit-jsonl.test.ts`.

**E2E Tests:**
- Not used in the current TypeScript test suite.
- No Playwright, browser, or full Studio E2E config is detected.
- No current test script runs the full required MLX acceptance flow from repository ingestion through Hugging Face dataset validation and benchmark execution.

## Common Patterns

**Async Testing:**
```typescript
it('returns meta array matching examples length', async () => {
	const { generateQABatch } = await import('./qa-worker.js');
	const result = await generateQABatch({
		trainChunks: mockChunks,
		tools: mockTools,
		count: 2,
		concurrency: 1,
		seed: 'test-seed-2',
	});

	expect(result.meta.length).toBe(result.examples.length);
});
```

**Error Testing:**
```typescript
it('re-throws non-KillPointError exceptions', async () => {
	const mock = runDiscoveryPipeline as ReturnType<typeof vi.fn>;
	mock.mockRejectedValueOnce(new Error('network failure'));

	await expect(cmd.run(ctx)).rejects.toThrow('network failure');
});
```

**Filesystem Cleanup:**
```typescript
afterEach(async () => {
	await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
```

**Environment Cleanup:**
```typescript
beforeEach(() => {
	for (const key of ['MLX_SERVER_URL', 'LOCAL_MODEL', 'ADAPTER_DIR', 'IPHONE_UDID']) {
		savedEnv[key] = process.env[key];
		delete process.env[key];
	}
});
```

**Dynamic Imports After Mocks:**
- Use dynamic `await import(...)` after `vi.mock(...)` for modules that capture dependencies at import time. This pattern appears in `lib/data/qa-worker.test.ts`, `lib/data/emit-jsonl.test.ts`, and `src/commands/commands.test.ts`.

---

*Testing analysis: 2026-07-15*
