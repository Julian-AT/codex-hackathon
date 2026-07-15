---
phase: 1
slug: identity-cleanup-baseline-and-migration-map
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-15
reviewed_at: 2026-07-15
interface: terminal-cli
---

# Phase 1 — UI Design Contract

> MLX — the personal coding dataset and model pipeline uses a compact, deterministic terminal interface in Phase 1. This contract covers human-readable Bun/Ink output and the non-visual JSON mode; it does not introduce a browser UI.

---

## Locked Interaction Decisions

- Bare `mlx` prints the canonical product introduction, ordered help, and a successful exit. It never launches a REPL or starts a model process.
- One typed command tree owns parsing, parent/leaf help, canonical ordering, and the owning phase for every documented command path.
- Later-phase leaves remain visible and parseable. Invocation returns `UNAVAILABLE`, names the owning phase, exits nonzero, and performs no network, model, repository, or artifact side effect.
- `mlx doctor` is read-only. It inspects every `mlx` candidate in PATH order without executing candidates and reports the effective candidate plus shadowed candidates.
- JSON mode emits one stable UTF-8 object with keys ordered as `schemaVersion`, `ok`, `command`, `status`, `data`, and `error`. It emits no ANSI styling, Ink frame, progress text, or human preamble.
- Validation status (`PASS`, `FAIL`, `SKIP`) and evidence source (`LIVE`, `REPLAY`, `FIXTURE`) are independent labels. Neither position nor color may imply that one source is equivalent to another.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Manual terminal design using the existing Ink runtime where dynamic rendering is warranted |
| Preset | Not applicable |
| Component library | Ink primitives only; plain text for one-shot output |
| Icon library | None; status meaning uses words, with no icon dependency |
| Font | Operator-configured monospace terminal font; MLX never changes terminal font settings |
| Rendering target | UTF-8 terminal, 80 columns preferred, 40 columns minimum |

The interface is line-oriented and left-aligned. It uses no cards, gradients, decorative borders, large ASCII art, or full-screen takeover for Phase 1 commands. Content order and labels carry the hierarchy; color only reinforces it.

### Terminal structure

- Product title: one line, once, at the start of root help.
- Section heading: title case followed by a colon, with one blank line before the section.
- Command row: two-space indent, canonical command path, at least two spaces, then a short verb-led description.
- Diagnostic row: stable label, colon, value. Related detail lines use a two-space hanging indent.
- Status row: `STATUS  SOURCE  CHECK_ID  REASON`, with two spaces between logical columns. Narrow terminals stack `REASON` on a four-space-indented following line.
- Final summary: follows all individual validation rows; it never precedes or replaces them.

---

## Spacing Scale

The declared scale is a 4 px-equivalent system. One terminal column is the runtime equivalent of the base 4 px token; vertical spacing is quantized to terminal rows.

| Token | Value | Terminal mapping | Usage |
|-------|-------|------------------|-------|
| xs | 4px | 1 column | Status-to-label gap, inline punctuation clearance |
| sm | 8px | 2 columns | Command indentation, logical column separation |
| md | 16px | 4 columns or 1 blank row | Hanging detail indentation, section separation |
| lg | 24px | 6 columns | Nested command descriptions at wide widths |
| xl | 32px | 8 columns | Reserved alignment width for short status labels |
| 2xl | 48px | 12 columns | Maximum fixed label column before wrapping |
| 3xl | 64px | 16 columns | Maximum nested indentation; do not exceed it |

Exceptions: terminal row height is controlled by the operator, so vertical tokens map to zero or one blank row. No output uses repeated blank rows to simulate larger visual spacing.

---

## Typography

Phase 1 cannot control the operator's terminal font size. These four sizes are presentation equivalents and semantic roles; runtime output remains one terminal cell high and realizes hierarchy with the two permitted weights only.

| Role | Size | Weight | Line Height | Terminal realization |
|------|------|--------|-------------|----------------------|
| Caption / provenance | 12px equivalent | 400 | 1.4 | Dim default monospace; never smaller or hidden |
| Body / detail | 14px equivalent | 400 | 1.4 | Default terminal text |
| Section heading | 16px equivalent | 600 | 1.3 | Bold default or cyan |
| Product title | 20px equivalent | 600 | 1.2 | Bold cyan, one line only |

Only weights 400 and 600 are permitted. Uppercase is reserved for finite machine-aligned state tokens such as `PASS`, `FAIL`, `SKIP`, `OWNED`, `COLLISION`, and `UNAVAILABLE`; headings and prose use sentence/title case.

---

## Color

MLX does not paint or assume a terminal background. ANSI colors are enabled only for an interactive color-capable TTY and are suppressed for `--json`, `NO_COLOR`, `TERM=dumb`, and non-TTY output. Every state remains unambiguous when rendered monochrome.

| Role | ANSI / fallback | Usage |
|------|-----------------|-------|
| Dominant (60%) | Terminal default foreground / plain text | Body, commands, values, reasons |
| Secondary (30%) | Dim gray / plain text | Descriptions, provenance labels, paths, shadowed candidates |
| Accent (10%) | Cyan / bold default foreground | Product title, section headings, current in-flight check only |
| Success | Green / `PASS` or `OWNED` text | Passed validation and owned executable classification |
| Warning | Yellow / `SKIP` or `UNAVAILABLE` text | Capability skip, later-phase unavailability, nonfatal guidance |
| Destructive | Red / `FAIL`, `COLLISION`, or `BLOCKED` text | Failures, collision, invalid state root, blocked removal |

Accent is reserved for the product title, section headings, and the single current in-flight check. It is never used for every command, every path, validation source labels, or completed states.

Color never replaces the literal state token. `LIVE`, `REPLAY`, and `FIXTURE` use the same neutral treatment so evidence provenance is read from text, not inferred from visual prominence.

---

## Copywriting Contract

| Element | Required copy |
|---------|---------------|
| Root introduction | `MLX — the personal coding dataset and model pipeline` |
| Primary next action | `Run mlx doctor to check the executable and local environment.` |
| Doctor empty heading | `No mlx executable found in PATH.` |
| Doctor empty body | `Install or link this package as mlx, then run mlx doctor again. No files or shell settings were changed.` |
| Collision error | `PATH resolves mlx to an executable that is not owned by this installation.` |
| Collision action | `Resolve the PATH conflict manually, then run mlx doctor again. No files or shell settings were changed.` |
| Unavailable command | `This command is defined but is not available in Phase 1.` |
| Unavailable action | Pattern: `Available in Phase N: phase name. Run mlx parent --help to inspect this command group.` Replace `N`, `phase name`, and `parent` with registry values before rendering. |
| Unknown command | Pattern: `Unknown command: input. Run mlx --help to list valid commands.` Replace `input` with the sanitized parsed value. |
| Empty validation heading | `No validation results were produced.` |
| Empty validation body | `The validation run is invalid and is reported as FAIL. Inspect the checker configuration and run the command again.` |
| Validation error | Pattern: `check-id failed: reason. Specific repair or owning-phase action.` Render the actual stable check ID, reason, and action. |
| Capability skip | Pattern: `check-id skipped: named capability is unavailable on this host. This is SKIP, not PASS.` Render the actual check ID and probed capability. |
| Removal blocked | `Removal blocked: current replacement evidence is incomplete. Record the exact replacement owner, acceptance coverage, and reviewed evidence before reconsidering removal.` |
| Destructive confirmation | Not offered in Phase 1. Phase 1 inventories legacy assets and blocks unsafe removal; it never deletes production assets. |

Copy rules:

- Lead with the outcome, then state the reason, then give exactly one safe next action.
- Never use a bare `Something went wrong`, `Done`, `Success`, or `Unavailable` without the affected object and reason.
- Never imply affiliation with or endorsement by another project using the same executable name.
- Never call `SKIP`, `REPLAY`, `FIXTURE`, a mock, or an unavailable later-phase shell a successful live result.
- Paths and user-provided values are quoted or placed on their own indented line; terminal escape/control characters are sanitized before display.

---

## Surface Contracts

### Bare help

Bare `mlx` and `mlx --help` use the same root layout and deterministic command order. Bare `mlx` exits zero. The canonical introduction is the first product mention and appears exactly once.

```text
MLX — the personal coding dataset and model pipeline

Usage:
  mlx <command> [options]

Commands:
  doctor              Check executable ownership and local environment
  init                Initialize explicitly owned local state
  auth status         Show authentication status
  ...                 Remaining documented paths in canonical contract order

Options:
  --json              Emit one machine-readable JSON object
  -h, --help          Show help

Run mlx doctor to check the executable and local environment.
```

Contract details:

- Root help groups related paths without changing the authoritative order. Parent help such as `mlx dataset --help` lists every child leaf and owning phase.
- A later-phase leaf is visibly annotated `available Phase N`; it is not hidden and is not labeled implemented.
- Leaf `--help` exits zero even when invoking the leaf itself would return `UNAVAILABLE`.
- Unknown paths render one deterministic suggestion only when there is one unambiguous match; otherwise they render the root-help action.

### Doctor diagnostics

Doctor displays classification first, then evidence, then remediation. It has no spinner, prompt, install action, or mutation affordance.

```text
mlx doctor

Executable: COLLISION
Effective path:
  /usr/local/bin/mlx
Reason: PATH resolves mlx to an executable that is not owned by this installation.
Shadowed candidates: 1
  /Users/example/.local/bin/mlx  OWNED

Resolve the PATH conflict manually, then run mlx doctor again. No files or shell settings were changed.
```

- Human classifications are `OWNED`, `COLLISION`, and `NOT FOUND`; JSON status values are `owned`, `collision`, and `not-found`.
- Candidate order always follows PATH order. The effective candidate is never visually buried among shadowed candidates.
- `OWNED` exits zero. `COLLISION` and `NOT FOUND` exit nonzero.
- Even when metadata inspection fails, doctor reports the path it could safely resolve, the inspection failure, and that no candidate was executed or modified.

### Unavailable commands

An unavailable leaf uses a warning hierarchy, not a success or generic error hierarchy.

```text
UNAVAILABLE  mlx dataset build

This command is defined but is not available in Phase 1.
Available in Phase 5: Hugging Face dataset compiler, deduplication, and leakage-safe splits.
Run mlx dataset --help to inspect this command group.
```

- The command path and owning phase are mandatory.
- There is no progress animation, success verb, generated artifact path, or suggestion that legacy behavior ran.
- The result exits nonzero and renders identically for repeated invocations under the same controlled state.

### JSON mode

JSON mode is a separate renderer selected before any human or Ink output is created.

```json
{
  "schemaVersion": "1",
  "ok": false,
  "command": "dataset build",
  "status": "unavailable",
  "data": null,
  "error": {
    "code": "UNAVAILABLE",
    "message": "This command is defined but is not available in Phase 1.",
    "ownerPhase": 5
  }
}
```

- Production serialization is compact and ends with one newline; the expanded example above is explanatory only.
- Exactly one object is written to stdout for help, success, collision, not-found, unavailable, parse error, and validation failure.
- Collections use their documented deterministic sort order. Volatile fields are omitted unless the command contract requires and controls them.
- Human progress, warnings, stack traces, and ANSI sequences never share stdout with the JSON document. Expected failures are represented inside the envelope.
- JSON field names and status values never change according to terminal width, TTY capability, locale, or color settings.

### Validation status reporting

Final human reports show all checks in fixed command/check order before the aggregate.

```text
Validation baseline

STATUS  SOURCE   CHECK ID                 REASON
PASS    FIXTURE  cli.command-contract     All documented command paths parsed.
FAIL    LIVE     studio.build             Studio is not implemented; owned by Phase 8.
SKIP    LIVE     local.apple-silicon      Apple Silicon capability is unavailable on this host.

Result: FAIL — 1 PASS, 1 FAIL, 1 SKIP
```

- `PASS`, `FAIL`, and `SKIP` are mutually exclusive and always printed in full.
- `LIVE`, `REPLAY`, and `FIXTURE` occupy an independent adjacent column on every row.
- Missing, empty, contradictory, or unknown checker results render as `FAIL` with a normalization reason.
- `SKIP` requires a named capability probe and a specific unavailable capability. Missing implementation is always `FAIL`.
- Interactive human mode may show one non-animated `RUNNING` line for the current check. Completed rows remain in fixed order. Non-TTY mode emits completed rows only. JSON mode buffers until it can emit the single final object.
- The aggregate uses failure dominance (`FAIL` over `SKIP` over `PASS`) but never suppresses an individual row or promotes its source classification.

---

## Responsive and Robust Terminal Behavior

- At 80 columns and above, render aligned status and help columns.
- From 40–79 columns, retain state/source/check columns and wrap descriptions with a four-space hanging indent.
- Below 40 columns, use a vertical label/value layout. Never truncate a status token, error code, owning phase, executable path, or remediation command.
- Long paths and Unicode roots wrap on their own indented line. Preserve the exact value while escaping terminal control characters.
- Large candidate/check collections are not silently clipped. One-shot output streams the complete ordered list; future interactive views may paginate only with an explicit `shown N of M` marker.
- No animation is required for Phase 1. This keeps snapshots, logs, screen readers, redirected output, and low-capability terminals stable.
- `Ctrl-C` during a check exits through a concise interruption diagnostic and never prints a success summary. JSON-mode interruption may exit before a document only when the process is externally terminated before it can safely serialize; it must never print a partial JSON object.

---

## UI Considerations

> Shape-rooted terminal states are resolved here so planning can lift them as implementation truths. Copy references the canonical strings in `## Copywriting Contract` rather than inventing variants.

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| Empty / no data | Doctor candidate list; validation result list | ✅ covered | Zero candidates render the doctor empty copy and nonzero exit; zero validation results normalize to a visible `FAIL` using the empty-validation copy. Help cannot silently become empty: a missing command registry is an invariant failure. |
| Loading / in-flight | Validation result list | ✅ covered | Human TTY output may show one literal, non-animated `RUNNING` row for the current check; non-TTY output shows completed rows only; JSON emits no in-flight state and waits for one final object. |
| Error / failure | Help parse result; doctor inspection; unavailable leaf; validation report | ✅ covered | Each failure names the affected command/check/path, stable state or code, reason, safe next action, and nonzero outcome. Partial JSON and generic error-only copy are forbidden. |
| Populated / happy path | Help command list; doctor candidate list; validation result list | ✅ covered | Typical results use canonical order, stable labels, two-space logical column gaps, and a final summary after all individual rows. |
| Partial / incomplete | Doctor metadata; validation result list | ✅ covered | Safely resolved evidence remains visible, missing metadata is labeled unknown/inspection failure, and missing or contradictory validation fields normalize to `FAIL`; no absent value is presented as success. |
| Overflow / truncation | Command catalog; PATH candidates; validation rows | ✅ covered | Width breakpoints switch aligned rows to hanging-indent or label/value layouts. Lists remain complete and long paths/reasons wrap; silent clipping and ellipsis are forbidden for decisive evidence. |
| Zero / one / many | Command groups; shadowed PATH candidates; validation checks | ✅ covered | Counts use correct singular/plural copy, zero states are explicit, one item does not receive decorative list chrome, and many items retain deterministic order with visible total counts where relevant. |
| Long text | Product/help descriptions; paths; reasons; remediation | ✅ covered | Prose wraps at word boundaries, identifiers and paths move to indented lines when needed, terminal controls are escaped, and codes, command paths, phase ownership, and remediation commands are never truncated. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None | Not applicable; Phase 1 is a terminal CLI and `shadcn_initialized` remains `false` |
| Third-party web registries | None | Prohibited for this phase; do not initialize Tailwind, Radix, Base UI, or a browser component registry |
| Terminal packages | Existing Ink primitives only | Any new terminal UI dependency requires package/version review, lockfile diff inspection, non-TTY/`NO_COLOR` behavior tests, and confirmation that JSON mode imports no renderer side effects |

Manual terminal output is the canonical implementation. No registry block, generated web component, remote font, telemetry asset, or runtime network dependency is required to satisfy this UI contract.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-15
