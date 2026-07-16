# Phase 1: Identity, cleanup, baseline, and migration map - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 58 proposed new/modified files or fixture families
**Analogs found:** 48 / 58

## Scope and interpretation

CONTEXT.md locks behavior but delegates exact module boundaries. The concrete paths below are the
smallest focused split consistent with RESEARCH.md's dependency direction:

```text
entry -> catalog/parser -> result -> renderer
                           |
                           +-> independent state, doctor, migration, identity, validation domains
```

The planner may combine a test with its subject or rename a focused module, but should not merge
the domains into a giant `index.ts`, load legacy Ink/model/server code from the public entry, or
move later-phase product implementations into Phase 1.

`src/commands/**`, the brownfield pipeline under `lib/**`, operational `scripts/**`, and
`ios/SpecialistApp/**` are inventory inputs in this phase, not public-CLI dispatch targets and not
deletion candidates.

## File Classification

| New/Modified File | Change | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `package.json` | modify | config | request-response | same file, lines 5-16 | exact |
| `README.md` | modify | config | transform | same file, lines 1-11 and 72-109 | exact |
| `.gitignore` | modify | config | file-I/O | same file, lines 14-18 and 27-47 | exact |
| `biome.json` | modify | config | batch | same file, lines 18-30 | exact |
| `vitest.config.ts` | modify | config | batch | same file, lines 4-15 | exact |
| `vitest.integration.config.ts` | create | config | batch | `vitest.config.ts` | role-match |
| `mlx.package.json` | create | config | file-I/O | none | none |
| `src/cli.tsx` | modify | controller | request-response | same entry seam, lines 1 and 49-50 | exact |
| `src/repl.tsx` | modify | component | request-response | same file, lines 39-41 and 296-303 | exact |
| `src/app-oneshot.tsx` | modify | component | event-driven | same file, lines 258-263 | exact |
| `src/lib/conversation.ts` | modify | service | streaming | same file, lines 5-20 | exact |
| `src/lib/config.ts` | modify | config | file-I/O | same file, lines 1-65 and 109-160 | exact |
| `src/lib/config.test.ts` | modify | test | file-I/O | same file, lines 10-60 and 93-99 | exact |
| `src/cli/command-catalog.ts` | create | config | transform | `src/commands/index.ts` | role-match |
| `src/cli/command-catalog.test.ts` | create | test | transform | `src/commands/index.test.ts` | role-match |
| `src/cli/parser.ts` | create | controller | request-response | `src/commands/index.ts` | role-match |
| `src/cli/parser.test.ts` | create | test | request-response | `src/commands/index.test.ts` | role-match |
| `src/cli/result.ts` | create | model | request-response | `lib/training/supervisor.ts` | role-match |
| `src/cli/result.test.ts` | create | test | request-response | `lib/training/supervisor.test.ts` | role-match |
| `src/cli/render-json.ts` | create | utility | transform | `lib/data/split.ts` | partial |
| `src/cli/render-human.ts` | create | utility | transform | `src/lib/config.ts` | partial |
| `src/cli/renderers.test.ts` | create | test | transform | `src/commands/index.test.ts` | role-match |
| `src/cli/main.ts` | create | controller | request-response | `src/cli.tsx` | partial |
| `src/cli/main.test.ts` | create | test | request-response | `src/commands/index.test.ts` | role-match |
| `src/core/mlx-home.ts` | create | utility | transform | `src/lib/config.ts` | role-match |
| `src/core/mlx-home.test.ts` | create | test | transform | `src/lib/config.test.ts` | role-match |
| `src/core/state-ownership.ts` | create | service | file-I/O | `src/lib/config.ts` | role-match |
| `src/core/state-ownership.test.ts` | create | test | file-I/O | `lib/training/supervisor.test.ts` | role-match |
| `src/core/doctor.ts` | create | service | file-I/O | none | none |
| `src/core/doctor.test.ts` | create | test | file-I/O | `lib/training/supervisor.test.ts` (fixture lifecycle only) | role-match |
| `src/identity/audit.ts` | create | service | batch | none | none |
| `src/identity/audit.test.ts` | create | test | batch | `src/commands/index.test.ts` (table/assertion style only) | role-match |
| `src/migration/inventory-schema.ts` | create | model | transform | `lib/discovery/worker.ts` | role-match |
| `src/migration/inventory-schema.test.ts` | create | test | transform | `lib/discovery/validate/schema.test.ts` | role-match |
| `src/migration/repository-scanner.ts` | create | service | batch | `lib/data/split.ts` | partial |
| `src/migration/repository-scanner.test.ts` | create | test | batch | `lib/data/split.test.ts` | role-match |
| `src/migration/removal-gate.ts` | create | service | transform | `lib/training/supervisor.ts` | role-match |
| `src/migration/removal-gate.test.ts` | create | test | transform | `lib/training/supervisor.test.ts` | role-match |
| `src/migration/render-review.ts` | create | utility | transform | `lib/data/split.ts` | partial |
| `src/migration/render-review.test.ts` | create | test | transform | `lib/data/split.test.ts` | role-match |
| `migration/legacy-assets.v1.json` | create | config | file-I/O | archived planning inventory + `lib/data/split.ts` | partial |
| `migration/legacy-assets.v1.md` | create | config | transform | `.planning/migrations/2026-07-15-legacy-planning-inventory.md` | partial |
| `src/validation/result.ts` | create | model | transform | `lib/training/supervisor.ts` | role-match |
| `src/validation/result.test.ts` | create | test | transform | `lib/training/supervisor.test.ts` | role-match |
| `src/validation/check-catalog.ts` | create | config | batch | `src/commands/index.ts` | role-match |
| `src/validation/check-catalog.test.ts` | create | test | batch | `src/commands/index.test.ts` | role-match |
| `src/validation/capabilities.ts` | create | service | request-response | none | none |
| `src/validation/capabilities.test.ts` | create | test | request-response | `lib/training/supervisor.test.ts` (pure state matrix only) | role-match |
| `src/validation/runner.ts` | create | service | batch | none | none |
| `src/validation/runner.test.ts` | create | test | batch | none | none |
| `src/validation/report.ts` | create | utility | transform | `src/lib/config.ts` | partial |
| `src/validation/report.test.ts` | create | test | transform | `src/commands/index.test.ts` | role-match |
| `src/validation/cli.ts` | create | controller | request-response | `src/cli.tsx` | partial |
| `test/integration/cli-contract.test.ts` | create | test | request-response | none | none |
| `test/integration/package-bin.test.ts` | create | test | file-I/O | none | none |
| `test/integration/validation-scripts.test.ts` | create | test | batch | none | none |
| `test/integration/privacy-boundaries.test.ts` | create | test | request-response | none | none |
| `fixtures/phase-1/{identity,doctor,state,migration}/**` | create | test | file-I/O | existing `lib/**/__fixtures__` plus temp-dir tests | role-match |

## Pattern Assignments

### Product package, entry, and public copy

**Applies to:** `package.json`, `mlx.package.json`, `src/cli.tsx`, `README.md`,
`src/repl.tsx`, `src/app-oneshot.tsx`, and `src/lib/conversation.ts`.

**Closest existing seams:** `package.json` and `src/cli.tsx`.

**Package configuration pattern** (`package.json` lines 5-16):

```json
{
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "bun src/cli.tsx",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "biome check ."
  }
}
```

Keep the ESM package and script-map shape. Replace the package identity, add exactly one `bin.mlx`
entry, package the ownership marker, and expose all eight required script names. Do not add a
second executable alias.

**Entry boundary to retain** (`src/cli.tsx` lines 1 and 49-50):

```typescript
#!/usr/bin/env bun

async function main() {
	const args = process.argv.slice(2);
}
```

Retain only the shebang and process-argument boundary. The current top-level Ink/config/server
imports and scattered `process.exit()` calls are the legacy behavior being replaced. The entry
should import a pure `main(args, io, deps)`, perform one final write, and assign
`process.exitCode`.

**Canonical copy source** (`AGENTS.md` line 10):

```text
MLX — the personal coding dataset and model pipeline
```

This exact first mention, followed by a clear non-affiliation distinction from Apple's MLX, replaces
the current strings at:

- `README.md` lines 1-3
- `src/cli.tsx` line 21
- `src/repl.tsx` lines 40 and 300-302
- `src/app-oneshot.tsx` line 261
- `src/lib/conversation.ts` line 7
- `package.json` line 2 and the new description field

The legacy modules remain inventoried and unreachable from the new public entry. Updating their
user-facing identity does not authorize retaining their old command surface as MLX behavior.

**Ownership marker:** no repository analog exists. Use a small versioned, Zod-validated data file
whose package/product ID and declared entry can be checked without executing the candidate. Keep it
separate from the state-root ownership marker.

---

### Typed CLI catalog, parser, results, and renderers

**Applies to:** all files under `src/cli/`.

**Primary analog:** `src/commands/index.ts`.

**Typed command union** (`src/commands/index.ts` lines 6-38):

```typescript
interface CommandBase {
	name: string;
	aliases?: string[];
	description: string;
	argSpec?: string;
}

interface ActionCommand extends CommandBase {
	kind: 'action';
	run: (ctx: CommandContext) => Promise<void>;
}

interface ImmediateCommand extends CommandBase {
	kind: 'immediate';
	run: (ctx: CommandContext) => void;
}

export type Command = ActionCommand | ImmediateCommand;
```

Copy the literal-data-plus-discriminant technique, not the legacy aliases, React context, or handler
loaders. The Phase 1 catalog should use readonly path segments, owner phase, availability, ordered
arguments, and ordered options as its only source for parsing and help.

**Pure parse-result pattern** (`src/commands/index.ts` lines 67-99):

```typescript
export type UserInput =
	| { kind: 'command'; name: string; args: string[] }
	| { kind: 'conversation'; text: string }
	| { kind: 'unknown_command'; name: string }
	| { kind: 'quit' };

export function processUserInput(input: string): UserInput {
	const trimmed = input.trim();
	// deterministic parsing returns a typed value
	// rather than printing or mutating process state
}
```

Use the same pure-return shape for root help, parent help, leaf help, implemented command,
`UNAVAILABLE`, unknown command, and malformed arguments. Unlike the legacy parser, the new parser
must walk nested path segments and must not classify plain text as conversation.

**Sorted projection pattern** (`src/commands/index.ts` lines 109-115):

```typescript
export function getCompletions(partial: string): string[] {
	const lower = partial.toLowerCase();
	const names = Array.from(REGISTRY.keys());
	const aliasKeys = Object.keys(ALIASES).filter((a) => ALIASES[a] !== 'quit');
	const all = [...names, ...aliasKeys];
	return all.filter((n) => n.startsWith(lower)).sort();
}
```

Project help and tests from the catalog, but use explicit catalog order for command display and
explicit code-point sorting where the contract calls for sorted collections. Do not depend on
locale-sensitive ordering.

**Test table style** (`src/commands/index.test.ts` lines 17-38 and 108-126):

```typescript
it('parses command with args', () => {
	expect(processUserInput('/config set model foo')).toEqual({
		kind: 'command',
		name: 'config',
		args: ['set', 'model', 'foo'],
	});
});

it('returns sorted results', () => {
	const matches = getCompletions('');
	const sorted = [...matches].sort();
	expect(matches).toEqual(sorted);
});
```

Expand this into a matrix for every authoritative leaf, parent, help position, global `--json`,
required argument, unavailable owner, unknown token, byte-stable JSON envelope, and control
character.

**Renderer boundary:** there is no exact renderer analog. `render-json.ts` must construct keys in
the locked order (`schemaVersion`, `ok`, `command`, `status`, `data`, `error`), stringify once,
and append one newline. `render-human.ts` may sanitize C0/C1 characters but must not be imported by
JSON mode.

---

### MLX_HOME resolution and state ownership

**Applies to:** `src/core/mlx-home.ts`, `src/core/state-ownership.ts`,
`src/lib/config.ts`, and their tests.

**Primary analog:** `src/lib/config.ts`.

**Import and typed-boundary pattern** (`src/lib/config.ts` lines 1-4 and 55-56):

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';

export type Config = z.input<typeof ConfigSchema>;
export type ResolvedConfig = z.output<typeof ConfigSchema>;
```

Preserve Node built-ins plus Zod and the input/output type split. Improve the boundary by injecting
`env` and `homedir` into a pure resolver, checking a nonblank override with `path.isAbsolute`
before lexical normalization, and returning structured invalid-root results.

**Legacy path seam to replace** (`src/lib/config.ts` lines 109-123):

```typescript
export function getUserConfigPath(): string {
	return join(homedir(), '.codex', 'settings.json');
}

export function loadConfig(): ResolvedConfig {
	const userRaw = readJsonSafe(getUserConfigPath());
	const projectRaw = readJsonSafe(getProjectConfigPath());
	const envOverrides = extractEnvOverrides();
	const merged = deepMerge(userRaw, projectRaw, envOverrides);
	return ConfigSchema.parse(merged);
}
```

Do not copy the `.codex` paths, project-local precedence, or the error swallowing at lines 58-65.
The Phase 1 public config path derives beneath `<MLX_HOME>/config`. Help, doctor, parse errors, and
unavailable commands must not call a creating or reading config path.

**Write boundary to adapt** (`src/lib/config.ts` lines 137-160):

```typescript
export function setProjectConfig(dotPath: string, value: unknown): void {
	const configPath = getProjectConfigPath();
	// build validated data
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, JSON.stringify(existing, null, '\t') + '\n');
}
```

Keep directory creation inside an explicitly mutating operation only. State initialization needs
four explicit outcomes: missing root, owned root, unowned root, and unsafe/malformed root. It must
fail closed on symlinks and preserve pre-existing sentinels.

**Environment cleanup test pattern** (`src/lib/config.test.ts` lines 10-25):

```typescript
beforeEach(() => {
	for (const key of keys) delete process.env[key];
});

afterEach(() => {
	for (const [key, val] of Object.entries(savedEnv)) {
		if (val === undefined) delete process.env[key];
		else process.env[key] = val;
	}
});
```

Prefer passing an environment object directly to the pure resolver; use save/restore only at the
process integration boundary.

**Temporary filesystem pattern** (`lib/training/supervisor.test.ts` lines 1-20):

```typescript
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmpDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
```

Reuse the lifecycle with an `mlx-` prefix and per-test directories. Never point new tests at the
repository `data/` directory or real `~/.mlx` / `~/.codex`.

---

### Collision-safe doctor

**Applies to:** `src/core/doctor.ts` and `src/core/doctor.test.ts`.

**Analog:** none for the domain logic. Existing process modules launch candidates and are therefore
unsafe analogs for ownership detection.

Implement the research algorithm directly behind a read-only filesystem port:

1. accept PATH text, delimiter, cwd, declared package entry, and marker location as inputs;
2. inspect each exact `mlx` candidate in PATH order with `lstat/stat/realpath`;
3. represent broken links and inspection failures as data;
4. require realpath agreement plus a validated package marker for `owned`;
5. return effective and shadowed candidates in deterministic order;
6. never execute, open the executable body, install, unlink, rename, or edit shell state.

The temp-directory lifecycle above is reusable for tests, but doctor fixtures must additionally use
an execution-sentinel candidate and byte/hash/link-target before/after assertions across repeated
and parallel calls.

Do not copy `src/lib/server-manager.ts` lines 16-22: its `spawn(...)` and `unref()` behavior is
exactly what doctor must never do.

---

### Identity audit

**Applies to:** `src/identity/audit.ts`, `src/identity/audit.test.ts`, public-copy modifications,
and `.gitignore` / `biome.json` scope updates.

**Analog:** none for repository identity scanning.

Build deterministic, path-specific rules over version-controlled user-facing source and generated
test artifacts. Each exclusion needs an exact path/pattern, rule, and rationale. Mandatory
categories such as screenshots need evidenced zero counts rather than disappearing from the
report.

The audit must not recursively inspect ignored data, real environment files, operator homes,
private mirrors, models, adapters, or raw traces. The Git remote and authoritative historical
planning material may retain legacy words only through explicit non-user-facing exclusions.

Use test tables like `src/commands/index.test.ts`, and cover canonical first mention, Apple
distinction, forbidden product tokens, package metadata, help output, generated artifacts,
path-specific exclusions, and zero tracked screenshots.

---

### Migration inventory, reconciliation, removal gate, and review

**Applies to:** all `src/migration/**` files plus
`migration/legacy-assets.v1.{json,md}`.

**Schema analog:** `lib/discovery/worker.ts`.

**Nested Zod disk-contract pattern** (`lib/discovery/worker.ts` lines 35-50):

```typescript
export const DYNAMIC_TOOL_SPEC_DISK_SCHEMA = z.object({
	type: z.literal('function'),
	function: z.object({
		name: z.string().regex(/^[a-z][a-z0-9_]*$/),
		description: z.string().min(10).max(400),
		parameters: z.record(z.string(), z.unknown()),
	}),
	meta: z.object({
		requiresNetwork: z.boolean(),
		sourceWorker: z.string(),
		sourceChunks: z.array(z.string()),
	}),
});
```

Copy the nested schema and literal/enum constraints. Export `z.input` / `z.output` types and parse
the entire canonical JSON before reconciliation, eligibility, or rendering. Model conditional
fields in discriminated branches so they cannot be silently omitted.

**Deterministic hash and sort pattern** (`lib/data/split.ts` lines 58-67):

```typescript
export function computeSplitHash(salt: string, trainIds: string[]): string {
	const sorted = [...trainIds].sort();
	return createHash('sha256')
		.update(salt + ':' + sorted.join(','))
		.digest('hex');
}
```

Adapt this to category-plus-semantic-locator stable IDs and evidence digests. Do not use source line
numbers in IDs. Use a fixed category order, then code-point locator order; avoid locale-sensitive
sorting.

**Manifest write pattern to improve** (`lib/data/split.ts` lines 100-117):

```typescript
const splitHash = computeSplitHash(
	salt,
	trainChunks.map((c) => c.id),
);

if (persist) {
	const manifestData = { salt, trainRatio, splitHash, train, eval: evaluation };
	mkdirSync(path.dirname(SPLIT_MANIFEST_PATH), { recursive: true });
	writeFileSync(SPLIT_MANIFEST_PATH, JSON.stringify(manifestData, null, 2) + '\n', 'utf-8');
}
```

Copy deterministic projection and trailing-newline behavior. Unlike this legacy writer, Phase 1
must inject repository roots/paths, validate before writing, omit volatile timestamps from
byte-stability checks, and generate Markdown only from validated sorted JSON. A `--check` path must
fail on drift without rewriting.

**Determinism test pattern** (`lib/data/split.test.ts` lines 23-30 and 75-92):

```typescript
it('is deterministic — identical input produces identical output', () => {
	const a = splitDocs(corpus);
	const b = splitDocs(corpus);
	expect(a.splitHash).toBe(b.splitHash);
});

const recomputedHash = computeSplitHash(loaded.salt, loaded.train);
expect(recomputedHash).toBe(result.splitHash);
```

Apply the same repeat/recompute proof to inventory records, report output, evidence digests, and
removal eligibility.

**Existing inventory content source**
(`.planning/migrations/2026-07-15-legacy-planning-inventory.md` lines 143-152):

```text
Any later removal or reuse must:
1. identify the exact repository path,
2. classify it as retain, adapt, fixture-only, archive, or remove,
3. record its current replacement owner and requirement coverage,
4. verify the replacement against the authoritative MLX contracts,
5. preserve honest LIVE, REPLAY, and FIXTURE labeling.
```

Import all 55 exact archived planning paths from this source, then add records for every scanner
locator in the other eight mandatory categories. The prose inventory is source evidence, not the
canonical machine contract.

**Removal-state pattern** (`lib/training/supervisor.ts` lines 4-8 and 80-92):

```typescript
export type SupervisorSignal =
	| { kind: 'continue' }
	| { kind: 'rollback'; reason: 'nan' | 'spike'; nextRollbackIndex: number }
	| { kind: 'abort'; reason: 'nan.unrecoverable' | 'spike.unrecoverable' };

private escalate(reason: 'nan' | 'spike'): SupervisorSignal {
	if (this.rollbacks >= MAX_ROLLBACKS) {
		return { kind: 'abort', reason: 'nan.unrecoverable' };
	}
	return { kind: 'rollback', reason, nextRollbackIndex: this.rollbacks + 1 };
}
```

Copy the explicit-state/fail-closed transition style. Compute `blocked` versus `eligible` from
current exact evidence; never trust a declared eligible status. Plan, placeholder, mock, fixture,
replay, and unavailable evidence cannot authorize removal. Phase 1 performs zero production
deletions regardless of eligibility.

---

### Validation results, check catalog, runner, and report

**Applies to:** all `src/validation/**` files and the eight `package.json` scripts.

**Result analog:** `lib/training/supervisor.ts`.

Use a discriminated union, as above, so every normalized check has exactly one status. Keep evidence
source independent:

```typescript
type ValidationResult = {
	checkId: string;
	status: 'PASS' | 'FAIL' | 'SKIP';
	source: 'LIVE' | 'REPLAY' | 'FIXTURE';
	reason: string;
	capability?: { id: string; available: boolean };
};
```

Unknown, empty, missing, or contradictory input normalizes to `FAIL`. `SKIP` without a named,
actually unavailable host capability also normalizes to `FAIL`. Aggregate precedence is
`FAIL > SKIP > PASS` and never removes individual rows.

**Catalog analog:** `src/commands/index.ts` lines 40-53 and 101-107.

```typescript
const REGISTRY = new Map<string, Loader>([
	['discover', loader],
	['data-gen', loader],
]);

export function getCommandNames(): string[] {
	return Array.from(REGISTRY.keys());
}
```

Copy one ordered registry as the source of check IDs, labels, evidence-source expectations,
capability requirements, and fixed executable/argument arrays. Do not copy dynamic handler imports
or legacy command names.

**Runner:** no safe exact analog exists. The repository's existing subprocess modules invoke
`bash`/Python for product work and do not expose the required allowlisted checker contract.
Implement an injected runner that accepts an executable and immutable argument array, always uses
`shell: false`, bounds captured output, and cannot recurse from a public script into itself.

Required Phase 1 script outcomes:

| Script | Required Phase 1 behavior | Source |
|---|---|---|
| `check` | real source-scope Biome check; PASS after scope repair | LIVE |
| `typecheck` | real strict TypeScript check; PASS | LIVE |
| `test` | real unit suite; PASS, with fixture cases labeled | LIVE/FIXTURE per check |
| `test:integration` | synthetic process/package/privacy fixtures; PASS | FIXTURE |
| `studio:build` | explicit missing Phase 8 product; FAIL | LIVE |
| `dataset:validate` | explicit missing Phase 5 product; FAIL | LIVE |
| `benchmark:smoke` | explicit missing Phase 6 product; FAIL | LIVE |
| `local:check` | PASS for present Phase 1 capabilities or named host SKIP | LIVE |

**Human formatting analog** (`src/lib/config.ts` lines 162-178):

```typescript
export function formatConfig(config: ResolvedConfig): string {
	const lines: string[] = [];
	// project structured values into ordered lines
	return lines.join('\n');
}
```

Copy structured-value-to-lines separation. The validation report must show every check in fixed
command/check order before the aggregate, with visible status and source on each row.

---

### Test configuration, process integration, privacy harness, and fixtures

**Applies to:** `vitest.config.ts`, `vitest.integration.config.ts`,
`test/integration/**`, and `fixtures/phase-1/**`.

**Config analog** (`vitest.config.ts` lines 4-15):

```typescript
export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts', 'src/**/*.test.ts'],
		testTimeout: 10_000,
		hookTimeout: 10_000,
		fileParallelism: false,
	},
	resolve: {
		alias: { '@': path.resolve(__dirname, '.') },
	},
});
```

Reuse the Node environment, explicit includes, no globals, deterministic file execution, and alias.
Give integration tests a distinct include/config and bounded timeout instead of hiding them inside
the unit command.

There is no current analog for process-level CLI, isolated package install, or privacy-denial
fixtures. The new integration harness must:

- invoke the checked-in entry with an explicit Bun/runtime path and synthetic environment;
- use only fixture PATH directories and temp homes;
- pack/install into an isolated temp prefix/cache without global link or network;
- assert exactly one `mlx` bin and a packaged ownership marker;
- install deny spies for fetch, model/server spawn, GitHub/HF commands, clone/enumeration,
  publication, real home/config paths, and ignored private artifacts;
- assert bare/help/doctor/unavailable/inventory/baseline paths create no state or egress;
- keep candidate and shell-config sentinel bytes, hashes, modes, and link targets unchanged.

Fixture data must be synthetic and labeled `FIXTURE`. Do not reuse mutable repository `data/`
manifests, the developer's real PATH, or operator state.

## Shared Patterns

### Imports and module boundaries

**Sources:** `src/lib/config.ts` lines 1-4, `src/commands/index.ts` lines 1-2,
`tsconfig.json` line 16, and `vitest.config.ts` lines 13-15.

- Node built-ins first, third-party runtime imports next, then relative/type-only imports.
- Use `import type` for type-only dependencies.
- `@/*` maps to the repository root, but focused siblings may use relative imports.
- Public entry and JSON rendering must not import React, Ink, model, server, or legacy command
  modules.

### Typed boundaries

**Sources:** `src/lib/config.ts` lines 6-56 and `lib/discovery/worker.ts` lines 35-50.

Use Zod at JSON/marker/result package boundaries and export inferred input/output types. Pure
internal algorithms may use TypeScript unions, but untrusted JSON and filesystem metadata must be
parsed before use.

### Expected failures and fatal errors

**Sources:** `lib/training/supervisor.ts` lines 4-8 and `lib/server/errors.ts` lines 7-20.

Return structured values for parse errors, unavailable commands, collisions, not-found candidates,
invalid roots, failed checks, scanner mismatches, and blocked removal. Reserve throws for
unrecoverable internal invariants; sanitize and truncate the final human message while preserving
structured JSON fields.

### Determinism

**Sources:** `src/commands/index.ts` lines 109-115 and `lib/data/split.ts` lines 58-67.

Use literal catalog order where order is contractual, code-point sorting for unordered
collections, SHA-256 for stable evidence identity/digests, fixed JSON key insertion order, one
trailing newline, and no timestamps/random IDs/terminal-width/locale inputs in deterministic
artifacts.

### Filesystem tests

**Source:** `lib/training/supervisor.test.ts` lines 1-20.

Use `mkdtemp(tmpdir())`, record every directory, and remove recursively in `afterEach`. Extend the
pattern with injected filesystem ports and byte/hash/link-target assertions for doctor/state
tests.

### Authentication

Not applicable in Phase 1. No command should contact GitHub, Hugging Face, a model server, or any
other authenticated service. Privacy integration tests should fail if those seams are reached.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `mlx.package.json` | config | file-I/O | No collision-safe package ownership marker exists. |
| `src/core/doctor.ts` | service | file-I/O | No read-only PATH candidate inspector exists; current process code launches programs. |
| `src/identity/audit.ts` | service | batch | No deterministic identity/product-surface audit exists. |
| `src/validation/capabilities.ts` | service | request-response | No named capability-to-SKIP contract exists. |
| `src/validation/runner.ts` | service | batch | Existing subprocess paths are product-specific and not an injected shell-free checker registry. |
| `src/validation/runner.test.ts` | test | batch | No shell-injection/recursion/privacy runner fixture exists. |
| `test/integration/cli-contract.test.ts` | test | request-response | Current tests call functions, not the public process boundary. |
| `test/integration/package-bin.test.ts` | test | file-I/O | The package currently exposes no bin and has no isolated pack/install test. |
| `test/integration/validation-scripts.test.ts` | test | batch | Five required scripts are absent and current scripts are not registry-backed checks. |
| `test/integration/privacy-boundaries.test.ts` | test | request-response | No cross-command egress/operator-state denial harness exists. |

For these files, use the locked CONTEXT.md decisions and RESEARCH.md algorithms directly. Do not
adapt unsafe behavior merely to manufacture an analog.

## Metadata

**Primary analog search scope:** `src/**`, `lib/**`, root tool/package configuration, and the
existing planning migration inventory.

**Files scanned:** 120 tracked/untracked source/config paths after excluding `node_modules`,
`.git`, `.next`, `.venv`, ignored `data` contents, and `ios/_upstream`.

**Primary analogs selected (early stop):**

1. `src/commands/index.ts` — typed command union, pure parsing, ordered projections
2. `src/lib/config.ts` — Node/Zod configuration and filesystem boundary
3. `lib/discovery/worker.ts` — nested Zod disk contract
4. `lib/data/split.ts` — deterministic hash, manifest, and round-trip verification
5. `lib/training/supervisor.ts` — discriminated result states and fail-closed transitions

**Supporting tests read:** `src/commands/index.test.ts`, `src/lib/config.test.ts`,
`lib/discovery/validate/schema.test.ts`, `lib/data/split.test.ts`, and
`lib/training/supervisor.test.ts`.

**Pattern extraction date:** 2026-07-15
