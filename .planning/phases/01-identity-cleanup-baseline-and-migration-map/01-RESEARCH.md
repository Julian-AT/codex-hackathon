# Phase 1: Identity, cleanup, baseline, and migration map — Research

**Researched:** 2026-07-15  
**Question:** What does the planner need to know to implement the collision-safe MLX CLI surface, `MLX_HOME` boundary, complete brownfield migration inventory/removal gate, and honest validation baseline without crossing later phases?  
**Confidence:** HIGH for repository and contract facts; MEDIUM-HIGH for the recommended internal file split because exact module boundaries are delegated to the implementer.

<user_constraints>

## Implementation Decisions

### CLI Contract and Unavailable Commands
- Use a typed command tree with one leaf per documented command path so parsing, help, and JSON output are deterministic.
- Bare `mlx` prints the canonical product introduction plus ordered help and exits successfully; it does not launch the legacy REPL.
- Later-phase commands parse fully but return a structured `UNAVAILABLE` result naming their owning phase, exit nonzero, and perform no side effects until implemented.
- JSON mode uses one stable envelope with `schemaVersion`, `ok`, `command`, `status`, `data`, and `error`; collections are sorted and stdout contains JSON only.

### Doctor and Executable Collision Handling
- Recognize an MLX-owned executable through read-only realpath inspection plus an adjacent or package ownership marker; never execute a candidate or trust its filename alone.
- Inspect every `mlx` candidate in PATH order, classify the effective first candidate, and report shadowed candidates.
- `owned` exits zero; `collision` and `not-found` exit nonzero with stable machine-readable codes.
- Remediation is guidance only. MLX never overwrites, unlinks, renames, installs over, or modifies PATH, aliases, symlinks, shell configuration, or an unrelated executable automatically.

### MLX_HOME and Legacy State
- Unset or blank `MLX_HOME` resolves to `~/.mlx`; nonblank overrides must be absolute and are normalized without following unsafe symlinks.
- Create state directories lazily only for commands that intentionally mutate state; help and doctor remain read-only.
- An existing unowned `.mlx` root fails closed unless it has an MLX ownership manifest or the operator explicitly initializes or adopts it.
- Never automatically read, copy, or migrate `.codex` state. Move current operator-facing configuration to MLX paths and inventory remaining legacy writers for their owning phase.

### Migration Inventory and Validation Baseline
- Use versioned, schema-validated JSON as the canonical migration inventory and generate a deterministic Markdown review from it.
- Reconcile the inventory with a deterministic repository scanner covering exact locators, explicit path-specific exclusions, and evidenced zero-count mandatory categories.
- Default legacy assets to blocked `adapt` or `retain` dispositions. A `remove` disposition requires current exact replacement evidence, and Phase 1 deletes no legacy production assets.
- Each validation check reports one `PASS`, `FAIL`, or `SKIP` independently from its `LIVE`, `REPLAY`, or `FIXTURE` evidence source. Missing later-phase products fail explicitly, and aggregates never hide individual failures.

### the agent's Discretion
- Exact internal module boundaries, numeric exit-code assignments, ownership-marker encoding, inventory schema field representation, and deterministic report locations are at the agent's discretion within the Phase 1 specification and repository conventions.

</user_constraints>

## Research answer

Phase 1 should replace the process entry path, not the legacy pipeline implementation. A small, side-effect-free CLI core must decide parsing, help, JSON/human rendering, state-root resolution, collision classification, and unavailable results before any Ink, server, model, repository, or legacy command module can load. `[CITED: 01-CONTEXT.md; 01-SPEC.md; 01-UI-SPEC.md]`

The brownfield cleanup gate is a deliverable in its own right. The existing planning inventory accounts for 55 archived planning files but explicitly says repository commands, executable names, runtime paths, generated data, scripts, product strings, dynamic-tool code, and iOS components are still uninventoried. The canonical Phase 1 inventory therefore must be record-level JSON reconciled against a scanner, not a prose area map. `[VERIFIED: .planning/migrations/2026-07-15-legacy-planning-inventory.md]`

The validation target is intentionally mixed: portable Phase 1 code health and integration checks pass, absent Studio/dataset/benchmark products fail, and only a genuinely unavailable local host capability may skip. A green aggregate across all eight scripts is neither required nor honest while those later products are absent. `[CITED: 01-SPEC.md AC-19 through AC-24]`

No SQLite catalog, CAS, job queue, repository ingestion, dataset compiler, benchmark runner, training workflow, or Studio implementation should be pulled forward. The new `mlx` tree exposes those later leaves and their owners but does not import or invoke their legacy analogues. `[CITED: docs/MLX_PROJECT_SPEC.md sections 24 and 28; 01-SPEC.md Boundaries]`

### Provenance labels used below

- `[VERIFIED]` means directly observed in the current repository or by a non-mutating local tool/version probe.
- `[CITED]` means required by an authoritative contract, accepted context, or phase specification.
- `[ASSUMED]` means a planning assumption that must be confirmed by implementation tests; no locked decision depends on it.

<phase_requirements>
## Phase Requirements

| Requirement | What the implementation must establish | Primary seam | Fast proof | Provenance |
|---|---|---|---|---|
| IDEN-01 | Canonical first mention and no forbidden user-facing product branding; explicit Apple-name distinction | package metadata, root/parent help, user-facing source/generated identity audit | source-scope audit plus fresh help/package artifact scan | `[CITED: REQUIREMENTS.md, 01-SPEC.md AC-01/02]` |
| IDEN-02 | Exactly one exported product binary, `mlx`; no takeover behavior | `package.json` `bin`, executable ownership marker, process entry | package/tarball inspection and isolated install fixture | `[CITED: AC-03/04]` |
| IDEN-03 | Unset/blank default and valid absolute `MLX_HOME`; Phase 1-owned paths only | pure root resolver and state ownership module | table test for unset, blank, relative, spaces, Unicode, normalization | `[CITED: AC-05/06]` |
| IDEN-04 | Read-only `owned`/`collision`/`not-found` classification in PATH order | injected executable-candidate inspector | synthetic PATH fixture with execution/hash/metadata sentinels | `[CITED: AC-07/08]` |
| IDEN-05 | Every authoritative command leaf is unique, ordered, help-visible, and owner-tagged | one typed command catalog | registry completeness/uniqueness and parse matrix | `[CITED: AC-09/10/11]` |
| IDEN-06 | One deterministic JSON envelope for every outcome | result union plus dedicated JSON renderer | byte equality and JSON parse tests across outcomes | `[CITED: AC-12]` |
| IDEN-07 | Exact record for every mandatory brownfield category and locator | inventory schema, reviewed JSON, repository scanner | reconciliation with duplicate/missing/extra/zero-category cases | `[CITED: AC-13/14/15]` |
| IDEN-08 | Removal stays blocked without exact, reviewed, current replacement evidence | inventory eligibility validator | fail-first evidence-kind, stale digest, and coverage tests | `[CITED: AC-16/17/18]` |
| IDEN-09 | Eight distinct stable scripts reach real checks/gates | validation registry and package scripts | package script inspection plus invocation test | `[CITED: AC-19/20/21/24]` |
| IDEN-10 | Status and evidence source remain independent; invalid results fail closed | validation result schema, normalizer, aggregator, report renderer | invalid-shape matrix and fixed-order aggregate snapshot | `[CITED: AC-22/23]` |

</phase_requirements>

## Current repository evidence the planner must account for

### Public surface and state

- The current `package.json` is named `codex-hackathon`, has no `description` or `bin`, and only exposes `start`, `pipeline`, `test`, `test:watch`, `typecheck`, `check`, and `format`. `[VERIFIED: package.json]`
- `src/cli.tsx` defaults to the Ink REPL, exports eight legacy one-shot commands, prints a legacy introduction, and can start `mlx_lm.server` before invoking one-shot work. This file cannot remain the behavioral shape of bare `mlx`. `[VERIFIED: src/cli.tsx]`
- `src/commands/index.ts` is a flat slash-command registry with legacy aliases and conversation parsing; it has no nested command hierarchy, phase ownership, unavailable result, or JSON contract. `[VERIFIED: src/commands/index.ts]`
- `src/lib/config.ts` reads `~/.codex/settings.json` and `<cwd>/.codex/settings.json`, writes the latter, silently turns read/parse errors into `{}`, and defaults adapter state into repository-local `data/`. `[VERIFIED: src/lib/config.ts]`
- Current user-facing legacy identity occurs in `src/cli.tsx`, `src/repl.tsx`, `src/app-oneshot.tsx`, and `src/lib/conversation.ts`; the package name also retains a forbidden product token. `[VERIFIED: scoped repository search on 2026-07-15]`
- No tracked PNG, JPEG, GIF, WebP, SVG, or PDF screenshot asset was found. The identity audit still needs an explicit zero-count record/rule so later screenshots cannot bypass it. `[VERIFIED: tracked extension scan on 2026-07-15]`

### Test and tooling baseline

- Vitest currently includes `lib/**/*.test.ts`, `lib/**/*.spec.ts`, and `src/**/*.test.ts`, uses the Node environment, disables file parallelism, and sets 10-second test/hook timeouts. `[VERIFIED: vitest.config.ts]`
- Existing tests are co-located, use Vitest tables/mocks/temp directories, and some legacy tests mutate fixed `data/` paths. The known schema-gate failure comes from a mutable generated manifest being treated as a fixture. `[VERIFIED: .planning/codebase/TESTING.md and CONCERNS.md]`
- Biome 1.9.4 is configured for tabs, single quotes, semicolons, 100 columns, and currently ignores `data`, `ios`, `.venv`, and `.claude`, but not `.next`. `[VERIFIED: biome.json; local version probe]`
- The current supported local environment has Bun 1.3.11, Node 22.22.3, Git 2.50.1, TypeScript 5.9.3, Vitest 3.2.4, and Darwin arm64; local `biome`, `vitest`, and `tsc` executables are present. No executable named `mlx` was probed, by design. `[VERIFIED: non-mutating version/availability probes on 2026-07-15]`
- The phase specification records the pre-implementation baseline as typecheck passing, unit test failing on the mutable manifest, Biome failing on `.next`, and five required scripts missing. Research did not rerun mutation-prone legacy tests. `[CITED: 01-SPEC.md Background; VERIFIED: current package script absence]`

### Dirty-worktree constraint

The working tree already contains numerous unrelated modified/untracked files, including `package.json`, `src/cli.tsx`, `biome.json`, `vitest.config.ts`, generated `data/` files, and the entire current `src/commands/` tree. The executor must use path-scoped diffs and must not attribute pre-existing deletions or generated changes to Phase 1. `[VERIFIED: git status --short on 2026-07-15]`

## Architecture responsibility map

| Responsibility | Recommended owner | Must depend on | Must not depend on |
|---|---|---|---|
| Process entry and exit-code assignment | `src/cli.tsx` as a thin shebang entry | pure CLI `main(args, io, deps)` | Ink, server manager, model client, legacy app |
| Command identity/order/ownership/usage | focused command catalog module under `src/cli/` | literal typed data only | dynamic imports or handler side effects |
| Parsing and help projection | parser/help modules under `src/cli/` | command catalog | legacy slash parser, REPL state |
| Outcome contract | result/exit-code modules under `src/cli/` | discriminated unions | console calls |
| Human and JSON presentation | separate renderers under `src/cli/` | outcome contract and UI copy constants | one another; JSON must not import Ink |
| MLX root resolution | focused path module under `src/core/` or `src/lib/` | `node:os`, `node:path` | filesystem mutation |
| State ownership/init | focused state module | root resolver, `node:fs` | `.codex` readers or legacy writer migration |
| Executable collision diagnosis | focused doctor module | injected PATH/current-entry values and read-only fs port | executing candidates, shell lookup, install logic |
| Migration inventory contract | `src/migration/` schema/validator | Zod and canonical JSON | destructive cleanup |
| Repository reconciliation | `src/migration/` scanner | fixed tracked-file/source rules | ignored/private/operator directory walks |
| Deterministic review | `src/migration/` Markdown renderer | validated, sorted records | hand-maintained duplicate prose |
| Validation result/gates | `src/validation/` | typed checker registry, fixed subprocess arguments | shell strings, hidden aggregate-only output |
| Brownfield pipeline/REPL/iOS | existing `src/commands`, `lib`, `scripts`, `ios` | inventory only during Phase 1 | public CLI dispatch |

The exact directories may vary, but the dependency direction is the important planning invariant: entry → pure catalog/parser → result → renderer, with state, doctor, migration, and validation as independent domain modules. `[ASSUMED: recommended module layout; direction follows locked side-effect and JSON requirements]`

### Command ownership catalog

One catalog should contain the following canonical leaves and owner phases. Parent nodes are structural and render help; they are not aliases for a leaf. `[CITED: docs/MLX_PROJECT_SPEC.md section 24; owner inference from ROADMAP.md phase boundaries]`

| Owner | Leaves |
|---|---|
| Phase 1 | `doctor`, `init` |
| Phase 2 | `gc` |
| Phase 3 | `auth status`, `repos scan`, `repos review`, `repos set`, `mirror`, `metrics build`, `metrics show` |
| Phase 4 | `evidence build`, `preferences build` |
| Phase 5 | `dataset build`, `dataset validate`, `dataset inspect`, `dataset push` |
| Phase 6 | `benchmark build`, `benchmark run`, `benchmark compare`, `model serve`, `agent run` |
| Phase 7 | `train preflight`, `train run` |
| Phase 8 | `studio`, `demo`, `pipeline` |

`model serve` and `agent run` are assigned to Phase 6 because that phase owns model adapters, fixed tools, and the executable runtime; `pipeline` is assigned to Phase 8 because only end-to-end acceptance can safely make it functional. `[ASSUMED: unique-owner recommendation consistent with ROADMAP.md; planner may adjust only if it preserves one explicit owner]`

### CLI implementation pattern

Use the command tree as the only source for parser transitions, canonical help order, parent/leaf help, usage strings, owner phases, and availability. Avoid separate arrays in entry, help, and tests; the current duplication between `ONE_SHOT_COMMANDS`, the slash registry, and README is the drift mechanism Phase 1 is replacing. `[VERIFIED: current duplication in src/cli.tsx, src/commands/index.ts, README.md]`

Recommended leaf data:

```ts
type CommandLeaf = {
	path: readonly string[];
	description: string;
	ownerPhase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
	availability: 'implemented' | 'unavailable';
	usage?: string;
	arguments?: readonly ArgumentSpec[];
	options?: readonly OptionSpec[];
};
```

Parse global `--json`/`--help` before selecting a renderer, but still validate the command path and leaf-specific argument shape deterministically. Leaf help succeeds without calling the leaf. A valid later-phase invocation yields `UNAVAILABLE`; an unknown command or malformed required option yields a parse result, not an unavailable result. `[CITED: 01-UI-SPEC.md Bare help, Unavailable commands, JSON mode]`

Have the entry set `process.exitCode` after the final write instead of calling `process.exit()` throughout the domain. This avoids truncating the one JSON document and makes `main()` integration-testable. `[ASSUMED: recommended Node/Bun process discipline]`

### Deterministic result and renderer pattern

Construct the envelope in the locked key order and omit volatile timestamps, random IDs, terminal width, locale-dependent content, and stack traces. Use `JSON.stringify` once, write one trailing newline, and never initialize the human renderer in JSON mode. `[CITED: 01-UI-SPEC.md JSON mode]`

```ts
type CliEnvelope = {
	schemaVersion: '1';
	ok: boolean;
	command: string;
	status: CliStatus;
	data: unknown | null;
	error: CliError | null;
};
```

Use stable status/error enums and explicit exit-code constants. The actual numbers are discretionary, but tests must pin them for help/success, parse failure, unavailable, doctor collision/not-found, invalid state, and internal invariant failure. `[CITED: 01-CONTEXT.md discretion; 01-SPEC.md AC-07/09/11/12]`

Human output must sanitize C0/C1 control characters from command input, paths, and reasons while preserving the exact logical value in JSON. Static help/doctor/unavailable output should use plain text; Ink remains unnecessary and must not be imported for Phase 1 one-shot output. `[CITED: 01-UI-SPEC.md Copywriting and Registry Safety]`

## `MLX_HOME` and state ownership pattern

Make root resolution a pure function with injected environment and home directory. Check whether the nonblank override is absolute before normalization; do not call `realpath`, create directories, load config, or inspect `.codex` from the resolver. `[CITED: locked MLX_HOME decision and AC-05/06]`

| Input | Required result |
|---|---|
| `MLX_HOME` absent | `<homedir>/.mlx` |
| empty or whitespace-only | `<homedir>/.mlx` |
| relative path, including `~/.mlx` | actionable invalid-root failure |
| absolute path | lexically normalized absolute root |
| spaces/Unicode | exact logical characters preserved after normalization |

Only `mlx init` should create Phase 1 state. Help, root help, parent/leaf help, parse errors, unavailable commands, and doctor stay read-only. The state ownership marker should have its own schema/product identifier and be distinct from the package/executable marker. `[CITED: locked lazy-creation and unowned-root decisions]`

Recommended initialization states:

1. Missing root: create only the minimum root/ownership record required by Phase 1.
2. Root with a valid MLX ownership record: return idempotent success.
3. Existing root without the record: fail closed unless an explicit adoption option was supplied.
4. Root or final ownership path that is a symlink, malformed marker, or conflicting product marker: fail closed and report that nothing was changed.

An adoption action should create/replace no legacy content and should leave existing sentinels byte-identical; it records ownership only. Full path containment, config schema migration, atomic manifest/fsync infrastructure, and migration of all writers remain Phase 2. `[CITED: 01-SPEC.md boundaries; ASSUMED: minimal adoption behavior]`

Do not preserve a project-local `.codex` configuration layer as an MLX feature. Public Phase 1 config paths should be derived beneath `<MLX_HOME>/config`; every remaining legacy `data/`, `.codex`, environment-derived, script, model, adapter, and device writer belongs in the migration inventory. `[CITED: locked decisions; VERIFIED: legacy writers in repository search]`

## Collision-safe doctor pattern

Doctor needs dependency injection even if the public command does not expose it. Its core should accept a PATH string, current entry/package marker location, working directory, platform delimiter, and a read-only filesystem adapter. Production supplies process values; tests supply synthetic directories. `[ASSUMED: recommended test seam]`

Algorithm:

1. Split PATH in declared order; normalize an empty/relative entry against the supplied working directory.
2. For each entry, inspect the exact `mlx` candidate with `lstat`/`stat`/execute-bit checks and `realpath`; handle broken links and inspection errors as data.
3. Never open or run the candidate body. Do not use `command -v`, `which`, `--version`, a shell, or package install/link commands.
4. Mark a candidate owned only when its realpath matches this package's declared `mlx` entry and a validated package ownership marker is present. A filename or executable bit alone is insufficient.
5. The first candidate is effective; preserve PATH order for all shadowed candidates.
6. Render `owned`, `collision`, or `not-found`, including stable code/guidance and safely resolved evidence. Make no remediation mutation.

`package.json` plus a small versioned package marker can provide the two-factor ownership evidence: the marker identifies this product/package, while `package.json.bin` maps exactly one name (`mlx`) to the entry. The integration fixture must prove the marker survives packing/installing. `[ASSUMED: recommended marker encoding within agent discretion]`

The strongest no-execution fixture is an executable file that would write a sentinel if launched. Hash and stat candidate files, PATH fixture files, symlinks, aliases-as-fixture-data, and shell-config sentinels before/after repeated and parallel doctor calls. No test should use the developer's real PATH candidates. `[CITED: AC-04/08; additional-context prohibition]`

## Brownfield migration inventory

### Mandatory category reconciliation

The scanner should operate on tracked repository paths plus explicit test fixture inputs, not on a recursive walk of ignored directories. Each discovered locator is compared one-to-one against the canonical JSON. Exclusions must name one exact path/pattern, rule, and rationale; a blanket “docs” or “generated” exclusion is too broad. `[CITED: locked scanner decision and AC-13]`

| Mandatory category | Current repository evidence to seed the inventory | Required scanner rule | Provenance |
|---|---|---|---|
| `legacy-command` | eight one-shot commands; slash registry commands/aliases; bare REPL/conversation behavior; README command surface | parse known command catalog/registry declarations and documented invocation blocks into stable logical locators | `[VERIFIED: src/cli.tsx, src/commands/index.ts, README.md]` |
| `executable-name` | `bun src/cli.tsx`, `bun start`, package scripts, package name, absent `bin` | inspect package metadata, shebang entry, invocation docs, and script command tokens | `[VERIFIED: package.json, README.md, src/cli.tsx]` |
| `runtime-path` | `.codex` config expressions; `data/` roots; env-derived adapter/output roots; `/tmp/adapter-verify.txt`; device state; fixed absolute venv path | scan path constants and filesystem/subprocess operands with exact file+symbol locators | `[VERIFIED: src/lib/config.ts, lib/**, scripts/**, .env.example]` |
| `generated-artifact` | 15 tracked `data/` files plus untracked/ignored corpus, split, training, eval, checkpoint, adapter, fused, state, cassette, and bench expressions | combine tracked `data/` paths with source-declared artifact expressions; do not read ignored artifact contents | `[VERIFIED: git tracked-file list and source search]` |
| `script` | 15 tracked shell/TypeScript operational scripts | one exact path record for every tracked `scripts/` file, including helper/setup/smoke/bench/device scripts | `[VERIFIED: git tracked-file list]` |
| `product-string` | forbidden `codex` tokens and noncanonical first mentions in CLI/REPL/one-shot/conversation/package; legacy README identity | scoped token/first-mention rules with path-specific exclusions for authoritative historical/internal text | `[VERIFIED: scoped repository search]` |
| `dynamic-tool-path` | generated tool design/validation, fallback handwritten Supabase tools, manifests, trajectory generation, Swift loader/JS execution | prefix/symbol rules across `lib/discovery`, `lib/tools`, relevant `lib/data`, data manifests, and iOS loader/registry | `[VERIFIED: ARCHITECTURE.md; repository paths]` |
| `ios-component` | 11 tracked files under `ios/SpecialistApp` and related iOS/deploy scripts | exact tracked component path records plus cross-category script/path records | `[VERIFIED: git tracked-file list]` |
| `planning-artifact` | 55 archived files across six legacy phase directories | import/reconcile every exact path from the existing archived manifest | `[VERIFIED: existing planning inventory]` |

The final inventory count must come from the implemented scanner, not from the seed counts above. The current `src/commands/` tree is untracked, and ignored runtime artifacts can change independently; both are reasons to defer authoritative counts until the Phase 1 files are staged in a controlled fixture/snapshot. `[VERIFIED: dirty worktree; ASSUMED: count-finalization approach]`

### Runtime-state inventory categories

Runtime state must be explicit even when the backing state is deliberately not inspected.

| Runtime-state class | Repository evidence to record | Inspection policy in Phase 1 |
|---|---|---|
| Legacy user config | source expressions for `~/.codex/settings.json` | record expression/owner; never read real `~/.codex` |
| Legacy project config | source expression for `<cwd>/.codex/settings.json` | record expression; never walk an ignored real `.codex` directory |
| Canonical MLX root | `~/.mlx` / `MLX_HOME`, ownership record, Phase 1 config paths | test only with synthetic temp roots; never inspect real `~/.mlx` |
| Repository-generated data | corpus, tool manifests, split, JSONL, checkpoints, adapters, fused models, bench/state/cassette paths | record tracked paths and source expressions; do not read ignored/private contents |
| Environment-derived external roots | `ADAPTER_DIR`, `DATA_DIR`, `OUT_DIR`, model/server/device variables | record variable/path sink and owning phase; do not resolve live values |
| OS temporary state | `/tmp/adapter-verify.txt` and test temp prefixes | record production fixed temp paths; tests use fresh OS temp directories |
| Build/cache/vendor roots | `.next`, `.venv`, `ios/_upstream`, build outputs | classify and exclude from normal source checks with exact rationale; do not treat as acceptance |
| Device container state | iOS adapter/tool destinations and `data/state/*.json` receipts | record source definitions only; do not connect to or inspect a real device |
| Process/network runtime | local model server processes/endpoints and evaluation endpoints | inventory owners/egress risk; do not start models or contact endpoints |
| External/global executable state | PATH `mlx` candidates, aliases, links, shell configuration | production doctor may inspect on explicit invocation; research/tests use synthetic fixtures only |
| Credentials/private repositories | `.env.local`, GitHub/HF tokens, private repo manifests/mirrors | explicitly out of scanner scope and not inspected; path/policy references only |

This distinction prevents “not observed” from being misreported as “does not exist.” External/operator categories should have a declared `not-inspected` scope reason, while mandatory repository categories use evidenced counts, including zero. `[CITED: privacy constraints and AC-13/24]`

### Canonical JSON shape

Use a Zod-discriminated, versioned JSON contract and validate before scanning eligibility or rendering Markdown. A practical shape is:

```ts
type MigrationInventory = {
	schemaVersion: '1';
	inventoryVersion: string;
	mandatoryCategories: readonly CategoryCoverage[];
	records: readonly MigrationRecord[];
	exclusions: readonly PathExclusion[];
};

type MigrationRecord = {
	id: string;
	locator: ExactLocator;
	category: MigrationCategory;
	legacyPurpose: string;
	disposition: 'retain' | 'adapt' | 'fixture-only' | 'archive' | 'remove';
	replacementOwner: { phase: number; component: string };
	requirementCoverage: readonly string[];
	replacementEvidence: readonly ReplacementEvidence[];
	removalStatus: 'not-applicable' | 'blocked' | 'eligible' | 'removed';
	review: { status: 'pending' | 'approved'; evidenceDigest?: string };
	provenance: { discoveredBy: string; source: string };
};
```

Stable IDs should derive from category plus semantic locator, not line number. A locator should name a path plus a symbol, logical command, artifact expression, or file identity so harmless line movement does not churn every record. Sort with a fixed category order and then Unicode code-point locator order before serialization/reporting. `[ASSUMED: recommended schema representation]`

Category coverage needs a scan rule, expected policy (`records` or `evidenced-zero`), discovered count, record count, and reconciliation status. Do not create fake asset records merely to represent zero. `[CITED: locked zero-count requirement]`

### Removal eligibility invariant

The validator should compute eligibility; the JSON must not be trusted merely because it says `eligible`.

```text
eligible(remove record) =
  exact locator reconciled
  AND reviewed replacement owner exists
  AND requirement/acceptance coverage is nonempty and valid
  AND every required replacement evidence locator exists
  AND evidence digest/version is current
  AND evidence kind is not plan|placeholder|mock|fixture|replay|unavailable
  AND review status is approved
```

Any failed term normalizes `removalStatus` to `blocked` and fails inventory validation. `retain`, `adapt`, `fixture-only`, and `archive` remain non-removal dispositions. Phase 1 should contain zero production source/runtime deletions regardless of computed eligibility. `[CITED: AC-16/17/18]`

The deterministic Markdown is a projection only: render it from validated sorted JSON and add a `--check` mode that fails if the committed review differs. Never maintain fields independently in JSON and Markdown. `[CITED: locked canonical JSON decision]`

## Standard stack for Phase 1

No new runtime dependency is needed.

| Technology | Current evidence | Phase 1 use | Guidance |
|---|---|---|---|
| Bun | 1.3.11 available | product runtime, fixed-argument subprocess checks, package/bin fixture | keep Bun/TypeScript direction; do not upgrade in the identity slice |
| TypeScript | 5.9.3 available, strict config | typed command/result/inventory/validation contracts | preserve strict/isolated modules and focused files |
| Zod | `^3.25.76` dependency | validate inventory, ownership markers, and validation results | use existing package-boundary pattern; no ad hoc structural casts |
| Node built-ins | runtime-provided | `fs`, `path`, `os`, `crypto`, temp fixtures | use argument arrays and read-only fs calls for doctor |
| Vitest | 3.2.4 available | unit/integration matrices and snapshot/byte tests | keep unit tests co-located; add a distinct integration include/config |
| Biome | 1.9.4 available | formatting/lint baseline | add exact generated-output ignores such as `.next`; do not lint private/generated data |
| JSON/Markdown | built in | canonical inventory and deterministic review | JSON is canonical; Markdown is generated/checkable |
| Plain terminal text | existing runtime | help, doctor, unavailable, validation report | do not add a terminal component package; Ink remains unloaded for static output |

`React`/`Ink` are retained brownfield dependencies but are not part of the Phase 1 static CLI core. Python, `uv`, Hugging Face libraries, SQLite, DuckDB, MLX-LM, and browser tooling belong to later phases. `[CITED: AGENTS.md technology direction and phase boundaries]`

## Patterns to follow

- Use discriminated unions for parse/result/checker states and exhaustive switches. `[VERIFIED: repository convention; required for mutually exclusive outcomes]`
- Keep expected failures as structured values; reserve throws for invalid internal invariants. `[VERIFIED: CONVENTIONS.md]`
- Inject filesystem/environment/time/process dependencies into doctor, root, inventory, and validation cores. `[ASSUMED: recommended for deterministic/no-live-state tests]`
- Use `mkdtemp` under the OS temp root and clean it in `afterEach`; never use fixed repository `data/` paths for new Phase 1 tests. `[VERIFIED: good existing test pattern; privacy constraint]`
- Use dynamic imports only behind implemented side-effectful leaves in future phases. Unavailable leaves need no handler import at all. `[CITED: AC-11]`
- Keep package scripts stable while their internals route to versioned check IDs. `[CITED: IDEN-09/10]`
- Treat user-facing copy in `01-UI-SPEC.md` as constants under test, especially the canonical introduction, collision guidance, unavailable copy, empty validation failure, and skip wording. `[CITED: approved UI contract]`

## Do not hand-roll

- Do not create parallel command lists for parsing, help, ownership, and tests; project them from one catalog.
- Do not parse or serialize canonical JSON with regex/string concatenation; use Zod plus `JSON.parse`/`JSON.stringify`.
- Do not implement a shell `which`/`command -v` wrapper; use read-only filesystem candidate inspection.
- Do not implement path normalization by string replacement or expand `~` overrides manually; use `node:path` and `node:os`.
- Do not invent a second schema language for the migration inventory; Zod is already the typed runtime boundary.
- Do not write a custom test runner or hide tool output in a successful no-op. Use Vitest/Biome/TypeScript behind explicit check adapters.
- Do not add Commander/Yargs solely for Phase 1. The locked command tree has bounded syntax and the repository already needs custom phase ownership/unavailability projection. `[ASSUMED: dependency-minimizing recommendation]`
- Do not build SQLite, CAS, jobs, repository scanners for GitHub, dataset schemas, model serving, or Studio as part of this phase.

## Security domain

| Threat | Required Phase 1 control | Proof |
|---|---|---|
| Executing a hostile/unrelated `mlx` | candidate bodies are never launched or imported | execution-sentinel fixture remains absent |
| Overwrite/shadow/path mutation | doctor has no mutation/install/remediation API | file hashes, link targets, PATH/shell sentinels unchanged |
| Filename spoofing | realpath match plus validated package marker | same-name foreign executable classifies collision |
| Symlink/broken-link ambiguity | inspect and report; never follow into execution or writes | symlink/broken/cycle fixture matrix |
| Relative/path traversal state root | require absolute override, normalize lexically, fail invalid | state-root table tests |
| Unowned or symlinked `.mlx` adoption | ownership marker and explicit adopt action; fail closed otherwise | temp-root sentinel tests |
| Terminal escape injection | sanitize human paths/input/reasons; JSON remains structured | control-character snapshots |
| JSON contamination | renderer selected before human/Ink setup; one write | stdout byte/parse/ANSI tests |
| Command shell accidentally starts legacy work | unavailable resolution precedes dynamic import or config load | process/network/fs spies remain untouched |
| Removal gate bypass | schema reconciliation plus computed, digest-aware eligibility | negative evidence/staleness tests |
| Scanner reads secrets/private artifacts | tracked/source-rule scope and exact exclusions; no ignored tree walk | fixture asserting `.env.local`, home, mirror paths unopened |
| Validation command injection | fixed executable+argument arrays, `shell: false` | adversarial path/argument fixture |

Phase 1 identity scanning may read version-controlled user-facing source and generated test artifacts only. It must exclude real `.env.local`, `~/.mlx`, `~/.codex`, credentials, private repository manifests/mirrors, models, adapters, raw traces, and real PATH candidates from automated tests. `[CITED: AGENTS.md; additional context]`

## Validation Architecture

### Nyquist strategy

Every implementation task should land with a fast deterministic proof in the same plan. The default feedback loop is pure/unit tests; integration tests cover the process boundary and package layout; the eight stable scripts are the phase acceptance interface. No plan should postpone all verification to a final umbrella run. `[CITED: Nyquist validation requirement]`

Recommended tiers:

1. **Pure unit (<1 s per file):** command-tree uniqueness/order, parser matrices, root resolution, outcome serialization, inventory schema/reconciliation/eligibility, validation normalization/aggregation.
2. **Filesystem fixture integration:** init ownership/adoption, doctor candidate/symlink/no-execution fixtures, identity scan, inventory repository fixture, Markdown drift check.
3. **CLI process integration:** bare/help/unknown/unavailable/doctor human+JSON stdout and exit codes with synthetic environment; assert no side effects.
4. **Package integration:** pack/install into an isolated temporary prefix, inspect exactly one `mlx` bin and ownership marker, invoke help without global linking or global PATH mutation.
5. **Stable script acceptance:** invoke all eight names, asserting portable pass versus explicit later-product failure versus genuine capability skip.

The package integration is the riskiest environment-sensitive test and should be proven in the first CLI/bin plan. Prefer a locally packed artifact and isolated prefix/cache; never use global `bun link`, overwrite a global executable, or download dependencies during acceptance. `[ASSUMED: recommended early spike within implementation, not a separate research phase]`

### Fast requirement-to-test map

| Requirement | Test file/seam | Fast command | Core cases |
|---|---|---|---|
| IDEN-01 | identity audit unit + generated help/package fixture | `bun run test -- identity` | canonical first mention, forbidden tokens, path-specific exclusions, zero screenshots, Apple distinction review artifact |
| IDEN-02 | package contract + isolated install integration | `bun run test:integration -- package-bin` | exactly one bin, marker packaged, unrelated candidate unchanged, no global link |
| IDEN-03 | root resolver/state init tests | `bun run test -- mlx-home` | unset, blank, relative, absolute, spaces, Unicode, no creation on read-only commands, unowned/symlink root |
| IDEN-04 | doctor unit/process integration | `bun run test -- doctor` | owned/collision/not-found, PATH order, shadowed, broken links, repeat/parallel, never executed |
| IDEN-05 | command catalog/parser/help tests | `bun run test -- command-tree` | every leaf, unique path, owner phase, parent/leaf help, unknown/missing arg, bare success, unavailable no effects |
| IDEN-06 | envelope/render process tests | `bun run test -- cli-json` | exact keys/order/newline, parseability, stable bytes, ANSI/preamble absent, all outcome classes |
| IDEN-07 | inventory schema/scanner/report tests | `bun run test -- migration-inventory` | nine categories, exact locator, duplicate/missing/extra, explicit exclusion, evidenced zero, sorted report |
| IDEN-08 | removal eligibility tests + change manifest review | `bun run test -- removal-gate` | missing owner/coverage/evidence, disallowed evidence kinds, stale digest, repeated review, zero Phase 1 production deletions |
| IDEN-09 | package script and validation adapter integration | `bun run test:integration -- validation-scripts` | all eight distinct names, real checker/gate reached, correct exit behavior, privacy instrumentation |
| IDEN-10 | validation result/aggregate/report tests | `bun run test -- validation-result` | exclusive status, independent source, invalid→FAIL, capability-only SKIP, fixed ordering, failure dominance, all rows shown |

CLI-spawn tests should invoke the entry with an explicit runtime path and a synthetic environment rather than prepending/replacing the developer's real PATH. If the doctor needs PATH input, pass only fixture directories. `[CITED: no-live-state constraint]`

### Eight stable script semantics during Phase 1

| Script | Phase 1 expected result | Evidence source | Notes |
|---|---|---|---|
| `bun run check` | PASS after source-scope/Biome repair | LIVE | generated `.next`, ignored data, vendor/private roots excluded explicitly |
| `bun run typecheck` | PASS | LIVE | strict no-emit TypeScript |
| `bun run test` | PASS | FIXTURE where tests use synthetic data | move mutable manifest assumptions to committed fixture/temp paths |
| `bun run test:integration` | PASS | FIXTURE | synthetic CLI/PATH/home/package fixtures only |
| `bun run studio:build` | FAIL until Phase 8 product exists | LIVE | explicit owning-phase/product gate, never a no-op |
| `bun run dataset:validate` | FAIL until Phase 5 product exists | LIVE | must not validate legacy JSONL as canonical dataset |
| `bun run benchmark:smoke` | FAIL until Phase 6 product exists | LIVE | must not treat legacy answer-match logs as PersonalBench |
| `bun run local:check` | PASS for available Phase 1 capabilities or SKIP for a named unavailable host capability | LIVE | absent implementation is never SKIP; Apple Silicon test outside target host reports SKIP, not PASS |

Implement a shared validation result schema such as:

```ts
type ValidationResult = {
	checkId: string;
	status: 'PASS' | 'FAIL' | 'SKIP';
	source: 'LIVE' | 'REPLAY' | 'FIXTURE';
	reason: string;
	capability?: { id: string; available: boolean };
};
```

Normalization rules must be centralized: missing/empty/unknown/contradictory status is `FAIL`; `SKIP` without a named unavailable capability is `FAIL`; source never changes status; aggregate precedence is `FAIL > SKIP > PASS`; every individual row is retained in fixed command/check order. `[CITED: IDEN-10 and 01-UI-SPEC.md Validation status reporting]`

Wrap tools with fixed argument arrays rather than changing the public script names to raw no-op reporters. Avoid recursive wrappers (`bun run test` spawning `bun run test`). Give each package script a validation entry/check ID whose internal adapter directly starts Biome, `tsc`, Vitest, or a product/capability gate. `[ASSUMED: recommended orchestration pattern satisfying AC-19]`

### Privacy validation

The Phase 1 integration harness should install spies/deny stubs for `fetch`, model/server spawn, GitHub/HF commands, repository clone/enumeration, publication/upload, and known credential/home paths. Help, doctor fixtures, unavailable leaves, inventory validation, and all baseline check descriptors must complete without triggering them. `[CITED: AC-11/24]`

## Common pitfalls

1. **Loading legacy code before dispatch.** Importing Ink, config, server-manager, or app modules at entry time can read legacy state, emit human output, or start work even when the final result is unavailable/JSON.
2. **Calling a candidate to identify it.** `mlx --version`, shebang inspection by execution, `which`, and shell functions violate the doctor contract.
3. **Equating realpath with ownership.** Realpath is evidence of location; package marker plus declared entry is the ownership decision.
4. **Testing against the real PATH/home.** This can touch Apple's or another product's `mlx`, `.mlx`, `.codex`, credentials, or global shell state. All destructive/no-execution assertions need synthetic fixtures.
5. **Creating state from help/doctor.** Do not call `loadConfig()` or `mkdir` on read-only paths.
6. **Accepting `~` as an absolute override.** Only the default uses `homedir()`; an override must already be absolute.
7. **Letting output mode leak.** One `console.log` or Ink import before JSON serialization breaks AC-12.
8. **Duplicating command metadata.** Separate entry/help/test lists will drift as the current one-shot and slash registries did.
9. **Making unavailable a successful TODO.** It must be nonzero, owner-tagged, structured, and side-effect-free.
10. **Scanning ignored/private contents.** Inventory runtime-path expressions from source; do not recursively inspect live generated roots or operator directories.
11. **Using line numbers as stable inventory IDs.** A formatter change would invalidate every review.
12. **Trusting declared removal status.** Compute eligibility from current evidence and digest/version every time.
13. **Treating fixtures as live.** Unit/integration success may be `FIXTURE`; that does not satisfy live dataset, benchmark, Studio, or Apple training gates.
14. **Making missing product checks skip.** Studio, dataset, and benchmark gates are explicit `FAIL` in Phase 1.
15. **Reusing repository `data/` in new tests.** Existing nondeterminism proves why Phase 1 fixtures must use isolated temp roots.
16. **Overwriting unrelated dirty changes.** `package.json`, CLI/config/test/tool files already overlap likely Phase 1 edits; patch narrowly and inspect path-scoped diffs.
17. **Claiming the whole project is validated.** Phase 1 proves identity, migration control, and baseline semantics only.

## Suggested vertical plan boundaries

These are planning recommendations, not locked module names:

1. **CLI identity and contract slice:** package identity/bin/marker, pure command tree, root/parent/leaf help, unavailable dispatch, JSON/human renderers, isolated package fixture. Covers IDEN-01/02/05/06 and establishes no-side-effect entry architecture.
2. **State and doctor slice:** pure `MLX_HOME`, explicit init/ownership behavior, injected PATH doctor, collision/no-execution fixtures. Covers IDEN-03/04 without pulling Phase 2 storage forward.
3. **Migration control slice:** canonical JSON schema, complete reviewed records, repository scanner, zero-category/exclusion reconciliation, removal gate, generated Markdown. Covers IDEN-07/08; deletes no production assets.
4. **Honest baseline slice:** result schema/normalizer/aggregator, eight stable scripts, current portable repairs, explicit later-phase failures, capability probe, privacy instrumentation. Covers IDEN-09/10 and final cross-slice acceptance.

The first and second slices may be parallel at the pure-module level, but package entry/marker ownership is a dependency for the final doctor integration. The migration inventory should be populated after the CLI/state paths are fixed enough to record their exact dispositions, and baseline integration should run last. `[ASSUMED: recommended dependency order]`

## Planner checklist

- Preserve every locked decision above and quote required UI copy rather than paraphrasing it.
- Keep all 10 IDEN requirements and 24 acceptance criteria mapped to explicit tasks/tests.
- Include the nine migration categories, runtime-state classes, exact exclusions, and 55 planning records.
- Include a clean isolated bin/marker fixture; metadata inspection alone is insufficient for AC-03.
- Include repeated/parallel doctor no-execution and nonmutation fixtures.
- Include no-state-creation tests for bare/help/doctor/unavailable paths.
- Keep legacy pipeline modules retained/unreachable and inventory them; do not delete them in Phase 1.
- Do not introduce database/data/model/Studio work from later phases.
- Make `studio:build`, `dataset:validate`, and `benchmark:smoke` fail honestly in this phase.
- Use path-scoped change manifests because the worktree is already dirty.

## Sources

Authoritative contracts: `AGENTS.md`, `docs/MLX_PROJECT_SPEC.md`, `docs/MLX_DATASET_CONTRACT.md`, `docs/MLX_BENCHMARK_SPEC.md`, `docs/MLX_RESEARCH_RATIONALE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `01-CONTEXT.md`, `01-SPEC.md`, and `01-UI-SPEC.md`.

Repository evidence: `package.json`, `src/cli.tsx`, `src/commands/index.ts`, `src/lib/config.ts`, `vitest.config.ts`, `biome.json`, `README.md`, `.gitignore`, `tsconfig.json`, `.env.example`, `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,CONCERNS}.md`, `.planning/migrations/2026-07-15-legacy-planning-inventory.md`, and tracked/source-path scans under `src/`, `lib/`, `scripts/`, `ios/SpecialistApp/`, and `data/`.

No web access, package installation, private repository access, credential read, model execution, global `mlx` lookup, real `~/.mlx`/`~/.codex` inspection, or product-code modification was used for this research.

---

*Phase: 01-identity-cleanup-baseline-and-migration-map*  
*Research status: ready for planning*
