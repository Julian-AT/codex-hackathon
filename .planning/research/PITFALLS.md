# Domain Pitfalls

**Domain:** Local-first personal coding evidence, dataset, benchmark, and model pipeline
**Project:** MLX — the personal coding dataset and model pipeline
**Researched:** 2026-07-15
**Overall confidence:** HIGH for contract-specific risks; MEDIUM for dependency/runtime details that must be rechecked against installed versions

## Phase Key

| Phase | Mandated boundary |
|---|---|
| P1 | Identity, cleanup, baseline, and migration map |
| P2 | Foundation: configuration, SQLite, CAS, runs, and job queue |
| P3 | GitHub inventory, mirrors, identities, and accurate metrics |
| P4 | Evidence extraction, accepted-state quality, and preference profile |
| P5 | Hugging Face dataset compiler, deduplication, and leakage-safe splits |
| P6 | Runtime tools, worktrees, MLX PersonalBench, and model adapters |
| P7 | Apple Silicon MLX-LM training, experiment tracking, and paired evaluation |
| P8 | Studio, presentation mode, privacy review, and end-to-end acceptance |

## Critical Pitfalls

These failures invalidate privacy, dataset, benchmark, or completion claims. They should block release rather than become warnings in a report.

### 1. Treating the brownfield demo as an incremental implementation of the target system

**What goes wrong:** Existing Supabase corpus generation, chunk splitting, mutable JSON manifests, answer-matching evaluation, training wrappers, or iOS runtime are renamed and presented as the repository evidence pipeline.

**Why it happens:** The demo has visible CLI, data, training, and evaluation surfaces, so preserving its shape appears faster than implementing the missing catalog, Git history, evidence, Parquet, split, and worktree boundaries.

**Consequences:** Generated examples lack authorized repository scope, accepted-state provenance, task-group splits, Hugging Face configs, executable evaluation, and privacy gates. Passing legacy tests creates a false completion signal.

**Warning signs:** Production code still reads or writes canonical artifacts under repository `data/`; tests depend on generated `data/adapter-tools.json`; the primary split unit is a documentation chunk; benchmark scores come from Q&A answer matching; acceptance language refers to a training demo rather than dataset validation.

**Prevention:** P1 must inventory every legacy command, artifact, store, script, test, and user-facing claim; classify each as retain, adapt, fixture, quarantine, or remove; and map every replacement to a contract acceptance criterion. New production state must use `MLX_HOME`; legacy outputs may survive only as explicitly labeled fixtures or migration inputs.

**Recovery and verification:** Stop downstream release work, produce a migration inventory and replacement-coverage matrix, move mutable fixtures out of runtime contract paths, then prove each destructive removal has a tested replacement. P8's independent audit must trace every definition-of-done item to non-legacy evidence.

**Owning phases:** P1 primary; P8 closure. P2-P7 must reject legacy artifacts at their package boundaries.

### 2. Product identity migration overwrites or invokes an unrelated `mlx`

**What goes wrong:** Installation shadows Apple's or another operator-installed `mlx`, stale product names remain in help/config/artifacts, or old config paths are silently reused as MLX state.

**Why it happens:** Binary naming and path migration are treated as cosmetic search-and-replace work.

**Consequences:** The wrong executable can run, unrelated files can be overwritten, and screenshots or published metadata can misrepresent the product.

**Warning signs:** `which -a mlx` is never checked; `mlx doctor` does not report executable provenance; packaging installs over an existing binary; help, package descriptions, screenshots, or generated cards contain legacy product names; mutable state defaults inside the checkout.

**Prevention:** P1 owns one `mlx` bin entry, `MLX_HOME` path resolution, explicit legacy-state migration, collision detection, and a repository-wide user-facing identity scan. Never overwrite an unrelated executable without operator action.

**Recovery and verification:** Remove only the link or binary installed by this project, restore the pre-install path entry if recorded, and rerun doctor from a clean shell. Verify both collision and no-collision fixtures and scan built artifacts, not only source text.

**Owning phases:** P1; P8 repeats identity and artifact scans.

### 3. Repository accessibility is mistaken for operator authorization

**What goes wrong:** Scanning enumerates, clones, analyzes, or exports every repository visible to the token, including private organization or collaborator repositories the operator never selected.

**Why it happens:** GitHub API inventory and MLX training eligibility are represented by one boolean or implicit default.

**Consequences:** Private code is copied without consent, holdouts become training inputs, metrics include irrelevant work, and derived artifacts may violate repository policy.

**Warning signs:** A scan immediately clones repositories; new accessible repos default to `included`; selection state is absent or overwritten on rescan; `holdout` and `metrics-only` are aliases for inclusion; repository permission or visibility changes do not invalidate downstream jobs.

**Prevention:** Separate discovery from authorization. Persist `included`, `excluded`, `holdout`, `metrics-only`, and `pending-review` plus export policy independently. Default new and changed repositories to `pending-review`; snapshot the exact authorized selection into every run; require explicit expansion of scope.

**Recovery and verification:** Cancel affected jobs, quarantine and securely delete unauthorized mirrors/objects after a reference audit, rotate any release fingerprint, rebuild every derivative from a clean authorized manifest, and run a provenance query proving no excluded repository ID or object remains.

**Owning phases:** P3 primary; P2 enforces immutable selection inputs; P5 and P8 recheck export scope.

### 4. Incomplete GitHub inventory is reported as a complete profile

**What goes wrong:** Only the first API page, the wrong affiliation set, or the token-visible subset is counted as all accessible or selected repositories.

**Why it happens:** List endpoints commonly default to 30 rows; token scopes and GitHub App installation scope can silently limit results; rate limits and partial retries are mistaken for empty pages.

**Consequences:** Repository, collaboration, and activity metrics are understated, selection review is incomplete, and snapshot reproducibility is lost.

**Warning signs:** No pagination-completion record or `Link`/cursor handling; exactly 30/100 results; authentication principal/scopes absent from the run; rate-limit responses produce successful empty inventories; cached ETags are reused across credentials; owned, organization, collaborator, archived, and fork populations are not separated.

**Prevention:** Record endpoint, query/filter, pagination cursor/page count, response timestamp, principal, scopes, conditional-request validators, rate-limit state, and a completion flag. Model API errors and permission gaps separately from zero results. Never claim inaccessible repositories are absent.

**Recovery and verification:** Rerun from a new inventory snapshot after fixing credentials/pagination, compare repository IDs and population deltas, mark earlier metrics superseded rather than mutating them, and require fixture tests for multi-page, rate-limited, and permission-limited responses.

**Owning phases:** P3; P8 ensures displayed populations expose coverage and snapshot time.

### 5. Git history semantics silently distort engineering metrics

**What goes wrong:** Shallow or stale clones, wrong default branches, merge traversal, author/committer confusion, co-author parsing, rename heuristics, binary rows, mailmap aliases, or blame semantics produce plausible but inaccurate totals.

**Why it happens:** Git commands are deterministic only after their repository state and options are fully specified. Several valid interpretations answer different questions.

**Consequences:** Commits, churn, active periods, language history, ownership, and surviving-line claims cannot be defended or reproduced.

**Warning signs:** Mirrors have shallow boundaries; branch names are hard-coded to `main`; metric records omit source SHA and Git version/options; merge and non-merge counts do not reconcile; `--numstat` hyphens enter arithmetic; rename-heavy commits double count paths; `.mailmap` coverage and unmatched identities are hidden; blame output is labeled “all lines written.”

**Prevention:** Use full bare mirrors and pin each metrics build to resolved default-branch SHA. Define authored, committed, merge, non-merge, and co-authored populations separately. Use NUL-safe parsing, record rename/copy thresholds, track binary rows but exclude them from line arithmetic, and label blame strictly as surviving attributed lines. Identity aliases are explicit data with unmatched coverage, never guesses.

**Recovery and verification:** Recompute from synthetic histories covering merges, reverts, renames, aliases, binary files, branch changes, and force-updated remotes. Compare command-level golden facts and reconciliation identities; version metric definitions and invalidate derived releases when semantics change.

**Owning phases:** P3 primary; P4 consumes only versioned repository snapshots; P8 displays definition, population, exclusions, and timestamp.

### 6. Generated, vendored, or duplicated code inflates activity and profile claims

**What goes wrong:** Dependencies, build output, generated clients, minified files, snapshots, vendored code, submodules, or the same forked history are counted as personal engineering evidence.

**Why it happens:** One exclusion policy is reused across current-tree SLOC, historical churn, blame, and training evidence even though each metric needs a defined population.

**Consequences:** Language mix, current lines, churn, complexity, and preference frequency become dominated by code the operator did not meaningfully accept or author.

**Warning signs:** Sudden activity spikes align with vendor imports or generated files; fork pairs contribute the same commits; lockfiles dominate changed lines; exclusions are UI-only filters; current-tree and history totals use unexplained different rules.

**Prevention:** Version classifiers and operator patterns; retain exclusion reason per path/change; distinguish analytics-only metadata from training eligibility; deduplicate shared Git object history across repository relationships; report excluded populations alongside included totals.

**Recovery and verification:** Reclassify from immutable source snapshots, rebuild dependent metrics/evidence, publish before/after deltas, and keep the superseded definition available for audit.

**Owning phases:** P3; P4 applies training eligibility; P8 exposes exclusions.

### 7. Path validation is lexical while filesystem resolution escapes `MLX_HOME`

**What goes wrong:** `..`, absolute paths, symlinks, hardlinks, case/Unicode aliases, archive members, or a time-of-check/time-of-use replacement redirect mirrors, worktrees, objects, model outputs, or destructive cleanup outside configured roots.

**Why it happens:** Checking `startsWith(root)` on an unnormalized string is confused with containment of the resolved filesystem object.

**Consequences:** Private data disclosure, arbitrary file overwrite/deletion, corrupted CAS, or host compromise.

**Warning signs:** Caller-provided paths are joined directly; symlink checks occur only once; output directories come from environment variables; deletion uses recursive force on an unverified path; archive extraction preserves links or special files; tests cover `../` but not symlink swaps and sibling-prefix paths.

**Prevention:** Centralize typed path capabilities. Canonicalize roots, validate path segments, resolve existing ancestors, reject links where not required, use descriptor-relative/exclusive creation where available, and recheck containment at mutation. Archive extraction goes to a new bounded temporary directory with absolute/outside paths, links, devices, duplicate overwrites, excessive files, and excessive expansion rejected.

**Recovery and verification:** Stop all workers, inventory writes against manifests and filesystem audit logs, restore affected external files from backup, discard suspect outputs, and run adversarial traversal/symlink/archive tests on every write/delete boundary.

**Owning phases:** P2 for shared paths/CAS; P3 mirrors; P5 exports; P6 worktrees; P7 model outputs; P8 final security audit.

### 8. Content addressing is implemented as hash-shaped filenames without integrity

**What goes wrong:** CAS objects are written non-atomically, trusted by pathname without rehashing, collected while referenced, or hashed with ambiguous serialization.

**Why it happens:** SHA-256 naming is treated as sufficient provenance.

**Consequences:** Interrupted writes and collisions-by-bug propagate corrupted source, patches, manifests, datasets, or benchmark tasks while identifiers appear valid.

**Warning signs:** Direct writes to final object paths; no size/hash verification on read; references are plain paths; GC scans only recent runs; structured hashes depend on map order; manifests can reference missing objects.

**Prevention:** Define canonical bytes per object type; stream to a same-filesystem temporary file, fsync, hash, then atomically install; verify existing objects before reuse; store digest, size, media/schema type; make GC mark from all immutable manifests and catalog references before sweep.

**Recovery and verification:** Quarantine failed objects and all derivatives, reconstruct from source snapshots where possible, fail closed when provenance cannot be restored, and run full reference/hash audits before release or GC.

**Owning phases:** P2 primary; P4/P5 verify object closure; P8 exercises retention and disaster recovery.

### 9. SQLite schema evolution is ad hoc or only works on a fresh database

**What goes wrong:** Code mutates tables at runtime, migrations are non-transactional or reordered, foreign keys are not enabled on every connection, or an upgrade cannot resume after interruption.

**Why it happens:** Development tests create the latest schema from scratch and never exercise real upgrade paths.

**Consequences:** Existing catalogs become unreadable, partially migrated state is mistaken for current, orphan rows survive, and rollback destroys evidence lineage.

**Warning signs:** `CREATE/ALTER TABLE` outside migration files; schema version inferred from table existence; no migration lock/checksum; `PRAGMA foreign_keys` is set once globally; tests skip N-2/N-1 upgrades and interrupted migration; destructive changes precede backup/inventory.

**Prevention:** Persist ordered, checksummed migrations; acquire an application migration lock; verify WAL and foreign-key PRAGMAs per connection; use transactional rebuild patterns where supported; record schema and application compatibility; back up with SQLite's backup API before destructive transitions; refuse unknown/newer schema versions.

**Recovery and verification:** Restore the pre-migration backup or resume a specifically designed idempotent migration, then run `integrity_check`, `foreign_key_check`, expected-version checks, and row/reference reconciliation. Never “repair” by silently recreating an empty database.

**Owning phases:** P2 primary; P1 supplies legacy data inventory; every later phase adds migrations through P2's contract; P8 tests upgrade acceptance.

### 10. Leases and retries create duplicate or unrecoverable work

**What goes wrong:** Two workers claim one job, an expired worker commits after replacement, heartbeats race with cancellation, retries duplicate side effects, or a crash leaves `running` forever.

**Why it happens:** Claim/read/update operations are separate, lease ownership is not fenced, and idempotency covers job creation but not stage outputs.

**Consequences:** Duplicate Hub pushes, inconsistent manifests, concurrent mirror/worktree mutation, corrupted checkpoints, and pipelines that cannot resume safely.

**Warning signs:** Claims use `SELECT` then `UPDATE`; completion checks only job ID, not lease token/attempt; retries generate new output identities; wall-clock jumps expire healthy workers; `running` rows have no heartbeat/owner; cancellation does not terminate child process groups; non-zero subprocess exits can still mark success.

**Prevention:** Claim atomically in a short transaction; issue a fencing token per attempt; require it on heartbeat/checkpoint/complete; derive idempotency from immutable input/config/implementation hashes; make external side effects explicit two-phase operations; model cancellation and bounded retry categories; capture process groups and exit codes.

**Recovery and verification:** Reap expired leases on startup, prove output identity before reuse, clean orphan processes/worktrees, reconcile job events with final manifests, and fault-inject crashes at claim, checkpoint, side-effect, commit, and cleanup boundaries.

**Owning phases:** P2 primary; P3-P7 implement resumable stages; P8 runs crash-recovery acceptance.

### 11. WAL is enabled but not operated

**What goes wrong:** Long read transactions starve checkpoints, the WAL grows until disk pressure, `SQLITE_BUSY` becomes random failure, or the catalog is placed on a network filesystem where WAL assumptions do not hold.

**Why it happens:** `PRAGMA journal_mode=WAL` is treated as the complete concurrency design.

**Consequences:** Jobs stall, writes fail, shutdown/restart behaves inconsistently, and catalog durability claims are unverified.

**Warning signs:** No busy timeout/retry classification; readers hold transactions during long filesystem/model work; WAL frames/bytes and checkpoint status are unobserved; manual checkpoints are always `TRUNCATE`; catalog paths may be remote/network-mounted.

**Prevention:** Keep database transactions short; never perform Git, model, or filesystem work inside them; configure bounded busy handling; monitor WAL size and checkpoint progress; schedule checkpoints with understood blocking behavior; reject unsupported network-filesystem placement in doctor.

**Recovery and verification:** Stop writers, close stale readers, run an appropriate checkpoint, verify integrity, and resume jobs through leases rather than replaying side effects. Test concurrent readers/writers, checkpoint starvation, abrupt process death, and disk-full behavior.

**Owning phases:** P2; P8 includes operational health checks.

### 12. Reproducibility manifests omit a semantic input

**What goes wrong:** A run fingerprint excludes identity mappings, filter rules, prompt/model versions, schema features, split manifest, tokenizer/chat template, check registry, environment, or implementation revision.

**Why it happens:** Only repository SHAs and top-level config are hashed.

**Consequences:** Different datasets or scores share an ID, cached stages are reused incorrectly, and published artifacts cannot be reproduced.

**Warning signs:** Editing aliases, exclusions, prompt text, tool schemas, or tokenizer does not change the run fingerprint; manifests are mutable after completion; hashes serialize unordered objects; timestamps or local paths make otherwise identical builds differ.

**Prevention:** Define a canonical fingerprint input schema for every stage, separating semantic inputs from non-semantic runtime metadata. Include implementation and dependency versions, canonicalize ordering/encoding, write immutable fsynced manifests, and parent-link derived artifacts.

**Recovery and verification:** Recompute fingerprints, invalidate affected cache entries/releases/results, rebuild descendants, and add metamorphic tests proving every semantic input changes identity while irrelevant presentation metadata does not.

**Owning phases:** P2 establishes run manifests; P3-P7 define stage inputs; P8 verifies lineage end to end.

### 13. Evidence provenance is lossy, mutable, or points at the wrong Git state

**What goes wrong:** A plausible task or preference cannot be traced to repository snapshot, base/head/parent SHAs, source object hashes, paths, generator/prompt version, validation, privacy, and task group.

**Why it happens:** SQLite rows repeat mutable text, generated annotations overwrite deterministic facts, or commit/PR relationships are simplified to one SHA.

**Consequences:** Examples cannot be audited, leakage cannot be diagnosed, and accepted/reverted/merge state can be misclassified.

**Warning signs:** Evidence IDs change on re-export; raw code is duplicated in rows; source objects can be edited; merge commits have no parent policy; generated intent has no model/prompt ID; validators update evidence in place; object references are missing from closure reports.

**Prevention:** Keep immutable schema-versioned evidence facts separate from versioned semantic annotations. Store raw content in CAS, retain base/head/parents and source refs, append new derivations, and require complete provenance before a record can exceed Q1.

**Recovery and verification:** Re-extract from the pinned mirror snapshot, compare deterministic fields, supersede rather than mutate bad evidence, and demote any record whose complete lineage cannot be restored.

**Owning phases:** P4 primary; P2 supplies immutable storage; P5 rejects incomplete provenance.

### 14. Accepted state and quality tiers become unexplained model scores

**What goes wrong:** A same-model judge or semantic score substitutes for merged state, survival, patch application, or executable verification; AI-authorship metadata is used as a negative quality coefficient.

**Why it happens:** Semantic scoring is easier to aggregate than reconstructing repository state and running checks.

**Consequences:** Low-quality or leaked examples are promoted, valid AI-assisted accepted work is suppressed, and Q2-Q4 labels make claims they did not earn.

**Warning signs:** Quality is a single float; Q3/Q4 can be assigned without recorded checks; generator and judge IDs are implicit or identical but labeled independent; failures are retried until a pass; acceptance/survival cannot be queried separately; authorship origin changes default score.

**Prevention:** Preserve interpretable components and hard gates. Deterministically establish accepted state, survival, patch/schema results, and verification tier. LLM judgments remain versioned semantic annotations with bounded retries and honest independence labels. Privacy, schema integrity, and leakage never become weighted soft scores.

**Recovery and verification:** Recompute tiers from recorded evidence/check results, demote unsupported examples, run threshold sensitivity analysis, and compare sampled labels with independent inspection.

**Owning phases:** P4; P5 enforces tier eligibility; P8 labels quality populations honestly.

### 15. Preference synthesis overgeneralizes local conventions or contaminates holdouts

**What goes wrong:** A repository formatter setting becomes a global personal preference, rare observations become certain rules, counter-evidence disappears, or holdout repositories influence the profile card used to evaluate them.

**Why it happens:** Concise style summaries reward certainty and frequency without scope or independence.

**Consequences:** The profile misrepresents the developer, trains contradictory behavior, and leaks evaluation-repository information into base+profile comparisons.

**Warning signs:** Claims lack scope, support count, independent repository count, uncertainty, exceptions, or counter-evidence; one large repository dominates; profile generation reads all evidence before splitting; changing holdout content changes the training profile.

**Prevention:** Split repository/task eligibility before preference aggregation. Enforce global/language/framework/repository scopes, shrink sparse estimates, cap repository influence, retain counter-evidence/exceptions, and build a benchmark-specific profile strictly from allowed training evidence.

**Recovery and verification:** Rebuild profile artifacts from the split manifest, run leave-one-repository-out influence checks, and invalidate all prompted/tuned benchmark results that used a contaminated profile.

**Owning phases:** P4 builds profile; P5 enforces holdout isolation; P6/P7 bind exact profile version to results.

### 16. Type/schema drift crosses TypeScript, SQLite, Parquet, Python, and training exports

**What goes wrong:** Package types, database columns, JSON Schema, Arrow types, `datasets.Features`, Parquet physical types, and JSONL converters accept different values or nullability.

**Why it happens:** Each layer evolves independently and nested message/tool fields are inferred from samples.

**Consequences:** Some shards fail only at load time, values coerce or truncate silently, old releases cannot be read, and training views no longer trace to canonical rows.

**Warning signs:** Schemas are duplicated manually; `Json`/nested fields differ by shard; empty lists infer null types; local compiler succeeds but generic `load_dataset` fails; schema changes reuse the same semantic version; tests cover only non-empty happy paths.

**Prevention:** Choose canonical versioned boundary schemas, generate or validate adapters, use explicit Arrow/HF features, define null/empty/timestamp/float behavior, and keep training exports as deterministic views. Schema changes require compatibility classification and release-version changes.

**Recovery and verification:** Reject the release, migrate into a new immutable dataset version, validate every config/split and edge-case fixture with pinned Python dependencies, and compare row IDs plus canonical field hashes across representations.

**Owning phases:** P2 catalog migrations; P4 evidence schema; P5 canonical dataset and exports; P6 benchmark schema; P7 experiment schema.

### 17. Deduplication removes useful evidence or leaves cross-split copies

**What goes wrong:** Exact and near duplicates are handled after split, embedding similarity alone deletes rows, siblings across configs are treated as independent, or quadratic demo algorithms are used at core scale.

**Why it happens:** Dedup is optimized for row count instead of source lineage and split integrity.

**Consequences:** Evaluation memorization, biased repository mix, irreproducible representative choice, or dataset builds that fail at 25k-50k rows.

**Warning signs:** No cluster/decision artifact; dedup order differs between runs; high embedding score is the only removal reason; duplicate variants have different `task_group_id`; cross-split similarity runs only after publication; memory/time grows quadratically.

**Prevention:** Apply the contract order: exact object/patch, instruction hash, MinHash, syntax fingerprints, embeddings only for candidate generation, then source/split-aware review. Persist cluster membership, representative rationale, algorithm/version/thresholds; use scalable LSH/streaming stages before core scale.

**Recovery and verification:** Recluster from canonical pre-dedup records, regenerate splits and all exports/results, inspect boundary clusters, and publish deterministic dedup plus cross-split similarity reports.

**Owning phases:** P5; P4 supplies task/source linkage; P8 blocks release on audit failure.

### 18. Splits are assigned to rows after variants are generated

**What goes wrong:** Siblings from one commit/PR/issue/review or synthetic regression cross train/eval; repository and temporal holdouts shrink away; future information appears in pre-change context; preference summaries leak holdout repositories.

**Why it happens:** Existing deterministic chunk or random-row splitting looks reproducible but uses the wrong unit.

**Consequences:** Benchmark gains measure memorization or direct target leakage rather than transferable behavior.

**Warning signs:** Rows hash independently; split has no reason/cutoff; one task group appears in multiple splits/configs without linkage; whole-repository holdout contributes evidence/profile features; prompts contain target diff phrases or future paths; small corpora silently disable holdouts.

**Prevention:** Assign repository/task-group/time splits before variant expansion. Store one deterministic split-manifest row per task group with repository, cutoff, reason, and hash. Enforce complete repository isolation, per-repo temporal cutoffs, future snapshot dates, metadata/log scans, and near-duplicate cross-split audits. Small data changes percentages, not the existence of holdouts.

**Recovery and verification:** Treat leakage as release-blocking, revoke/supersede affected datasets and model results, rebuild profile/dedup/splits/exports, retrain if contaminated data was consumed, and rerun benchmark from fresh tasks/worktrees.

**Owning phases:** P5 primary; P4 must not aggregate before eligibility; P6/P7 consume only signed split manifests; P8 audits.

### 19. Privacy and licensing gates run only at upload time

**What goes wrong:** Secrets, credentials, emails, private names, paths, commit URLs, raw traces, or restricted code enter intermediate exports, logs, fixtures, Studio caches, model prompts, or adapters before the final push scan.

**Why it happens:** “Local-first” is mistaken for “safe to duplicate anywhere locally,” and visibility/license policy is not propagated with every object.

**Consequences:** Sensitive data reaches source control, cloud judges, presentation assets, backups, or a Hub repository despite a later blocked upload.

**Warning signs:** Scans apply only to Parquet; logs include environment or subprocess command lines; raw traces are considered public after pseudonymizing repository IDs; `public_demo` shares source paths/text; cloud endpoints are configurable without egress classification; fixture bundles are not scanned.

**Prevention:** Propagate visibility, export policy, and privacy result through evidence and derivatives. Scan at ingestion, example eligibility, export, presentation, and publish boundaries. Minimize logs/environments, forbid hidden reasoning, default traces local-only, and require explicit sanitized approval for external model calls.

**Recovery and verification:** Halt egress, rotate exposed credentials, remove/revoke affected artifacts where possible, purge caches/logs according to an incident inventory, regenerate fingerprints, and rerun secret/PII/license scans over the exact artifact closure.

**Owning phases:** P3 source policy; P4/P5 gates; P6 external model/worktree traces; P7 experiment artifacts; P8 publication and presentation review.

### 20. Hugging Face publication is explicit in the CLI but unsafe in effect

**What goes wrong:** A stale preview is confirmed after files change, the wrong owner/repository/config/revision receives data, a published version is mutated, private mode is omitted, or a token appears in logs.

**Why it happens:** Confirmation is attached to the command rather than a checksummed upload plan and immutable release.

**Consequences:** Private source or misleading metadata is uploaded irreversibly enough to require incident response; consumers load a different dataset than the manifest describes.

**Warning signs:** `push` can build and upload in one unreviewed step; preview lists directories rather than exact files/hashes/visibility; confirmation is reusable; destination defaults from ambient credentials; uploads target a mutable version; no post-push generic config load is performed.

**Prevention:** Build and fully validate an immutable release first. Generate an exact destination/revision/file/hash/visibility preview, bind one confirmation to its digest, default private, verify current authenticated identity, and upload to a versioned private staging revision. Never publish raw local CAS paths or credentials.

**Recovery and verification:** Stop the upload, revoke/rotate tokens, remove or quarantine the remote revision, inspect access/audit logs, create a new dataset version rather than rewriting history, and load every remote config/split without custom code before declaring success.

**Owning phases:** P5 implementation; P8 privacy/egress acceptance.

### 21. Local Parquet succeeds while the Hugging Face dataset contract is broken

**What goes wrong:** A Python script can read files, but config YAML, explicit features, generic `load_dataset`, Dataset Viewer, cards, Croissant metadata, shards, or remote repository layout fail.

**Why it happens:** Compiler success is substituted for consumer acceptance; custom dataset scripts or inferred schemas mask layout errors.

**Consequences:** The primary product is not Hugging Face-native and cannot support reproducible downstream training or inspection.

**Warning signs:** Validation imports project code; only `sft` loads; configs have name/path drift; README metadata is hand-maintained; thousands of tiny shards; checksums exclude cards/schemas; Viewer validation is assumed from local Arrow readability.

**Prevention:** Pin and record `datasets`, `pyarrow`, and Hub versions; use explicit Features; validate all required configs/splits locally through generic Parquet loading and, for a private staging release, through `<owner>/<dataset>, <config>`. Generate card, config YAML, schemas, manifest, statistics, and Croissant from one release model.

**Recovery and verification:** Reject and version-bump the release, fix schema/layout generation, reload every config including empty/edge cases, verify checksums and Viewer compatibility where privacy permits, and preserve the failed report.

**Owning phases:** P5; P8 includes real release/load acceptance.

### 22. Worktree execution escapes the task snapshot or command policy

**What goes wrong:** The model reads the reference patch/future commit, writes outside the disposable worktree, invokes arbitrary shell through a check, inherits secrets, accesses the network, or mutates the mirror/shared cache.

**Why it happens:** Tool names are fixed, but their host implementations accept raw paths, shell strings, ambient environment, or repository-controlled commands.

**Consequences:** Benchmark leakage, host compromise, private egress, irreproducible checks, and cross-task contamination.

**Warning signs:** `run_check` accepts text rather than `check_id`; check definitions concatenate repository input; child processes inherit the full environment; worktrees share writable dependencies; reference refs remain available to model tools; patch paths are validated only by Git; loopback/cloud network policy is unstated.

**Prevention:** Use an inspected versioned command registry with executable plus argument arrays, bounded resources/output/time, minimal environment, explicit cwd, network policy, and no shell interpolation. Resolve every tool path inside the task root, hide reference/future objects from the model interface, and apply patches only to a fresh worktree pinned at `base_sha`.

**Recovery and verification:** Kill the process group, quarantine the worktree/trace, inspect external writes/network attempts, rotate exposed credentials, invalidate the result, and rerun adversarial path/argument/environment/reference-leak tests.

**Owning phases:** P6 primary; P2 shared process/job cleanup; P8 security acceptance.

### 23. Worktree and process cleanup works only on success

**What goes wrong:** Timeouts, cancellation, crashes, or non-zero exits leave model servers, tests, locks, worktrees, or modified shared state behind.

**Why it happens:** Current process management is best-effort `SIGTERM`, may unref servers, and can ignore training subprocess exit codes.

**Consequences:** Later tasks observe contaminated files/ports/caches, disk fills, and failed jobs appear successful.

**Warning signs:** No process-group tracking or escalation; cleanup status absent from results; worktree count grows; reruns behave differently; a parser reaching EOF is treated as success regardless of exit status.

**Prevention:** Supervise process groups, capture stdout/stderr and exit/signal, cancel descendants, escalate after a timeout, use `finally` cleanup registered in job state, and audit worktree/mirror cleanliness before reuse.

**Recovery and verification:** Reap orphan processes and stale worktrees on startup, mark uncertain attempts failed, verify mirrors by object/ref checks, and fault-inject termination at each lifecycle stage.

**Owning phases:** P2 process/job primitives; P6 benchmark/runtime; P7 training; P8 recovery audit.

### 24. Benchmark variants do not receive the same experiment

**What goes wrong:** Base, profile, and tuned variants differ in task set, context/tool budget, prompt wrapper, chat template, sampling, checks, hardware state, or retry policy.

**Why it happens:** Each model adapter chooses convenient defaults, or tasks that error are rerun/dropped selectively.

**Consequences:** Reported gain cannot be attributed to profile conditioning or fine-tuning.

**Warning signs:** Results cannot join one-to-one by task fingerprint; adapters hide prompt/template changes; tuned models get more steps/context; missing results disappear from aggregate tables; cache/warmup policy differs; exact profile/adapter/tokenizer IDs are absent.

**Prevention:** Materialize a signed experiment matrix before execution. Bind task fingerprint, prompt/profile/tool/check versions, budgets, seed/sampling, retry/error policy, hardware/software, model/tokenizer/template, and adapter to every sample result. Compare only paired tasks and report missing/error categories.

**Recovery and verification:** Discard the comparison, not merely the bad rows; rerun all affected pairs under one manifest and audit adapter normalization with golden request/trace fixtures.

**Owning phases:** P6 harness and adapters; P7 final matrix; P8 presentation consumes signed comparisons only.

### 25. Benchmark statistics turn noise into a win claim

**What goes wrong:** Tiny differences on 20-50 tasks are shown without paired uncertainty, failed/missing tasks are omitted, aggregate composites hide execution regressions, or repeated comparisons are cherry-picked.

**Why it happens:** A single percentage or presentation score is easier to communicate than a task-level paired analysis.

**Consequences:** Base+profile or tuned improvement is overstated; decisions optimize noise; the Studio makes a scientifically unsupported claim.

**Warning signs:** Only means/accuracy appear; confidence intervals lack task count; unpaired bootstrap is used for paired runs; McNemar inputs exclude discordant failures; no effect size; aggregate and category deltas disagree; `MLX Score` is the sole conclusion.

**Prevention:** Preserve sample-level results. Report paired deltas, paired bootstrap 95% intervals, McNemar for matched binary outcomes, Bradley-Terry plus human agreement for style pairs, effect sizes, task counts, category breakdowns, and missing/error populations. Define resampling unit as independent task group/repository where dependence matters; label exploratory multiple comparisons.

**Recovery and verification:** Retract the win language, recompute from the immutable complete result set, independently reproduce statistics from Parquet, and increase held-out tasks when intervals are decision-inconclusive.

**Owning phases:** P6 statistics; P7 paired evaluation; P8 presentation claim audit.

### 26. Benchmark graders reward reference imitation instead of task resolution

**What goes wrong:** String similarity to a reference patch substitutes for patch application, fail-to-pass checks, pass-to-pass regressions, localization, safety, and unnecessary-change review.

**Why it happens:** Existing evaluation is answer matching, and executable repository checks are expensive.

**Consequences:** Valid alternative solutions fail, copied/leaked solutions win, and resolved@1 is not actually measured.

**Warning signs:** Reference patch text enters prompt/metadata/model-visible Git; tasks have no base SHA or allowed checks; synthetic tests do not fail before/pass after; evaluator cannot distinguish infrastructure error from model failure; only aggregate judge scores survive.

**Prevention:** Grade in disposable base-SHA worktrees with deterministic checks and traceable components. Keep reference patches inaccessible to the model and optional for analysis. Validate synthetic regressions fail before and pass after; preserve infrastructure/model/policy failure categories.

**Recovery and verification:** Rebuild invalid tasks, rerun all variants, audit target/reference text against prompts/traces, and demote non-executable tasks to an explicitly lower-confidence suite.

**Owning phases:** P6; P5 supplies isolated benchmark config; P8 labels suite and verification tier.

### 27. MLX-LM export silently trains the wrong tokens

**What goes wrong:** Chat templates, prompt masking, right-side truncation, tool schemas, or long trajectory serialization omit intermediate assistant tool calls or cut off targets.

**Why it happens:** JSONL parses successfully, so loss semantics are assumed correct.

**Consequences:** Training appears to run while supervision is missing, mismatched to inference, or dominated by truncated/instruction tokens.

**Warning signs:** No per-example token/mask audit; completion target token count is zero or unexpectedly small; tool trajectories remain one long final-completion sample; tokenizer/template version absent; truncation records are missing; training and serving templates differ.

**Prevention:** Compile prefix-to-next-assistant-action examples for trajectories; run the installed tokenizer/chat template; record total/target tokens and truncation; reject examples whose required target/context is removed; golden-test masks and tool calls against the exact MLX-LM version used.

**Recovery and verification:** Invalidate exports and experiments, rebuild from the same canonical dataset fingerprint with corrected transform/version, inspect decoded masked samples, and retrain before claiming results.

**Owning phases:** P5 export compiler; P7 installed-version acceptance.

### 28. Portable tests are reported as Apple Silicon MLX acceptance

**What goes wrong:** Mock subprocesses, Linux CI, fixture logs, or an E2B-only run are described as proof that E4B QLoRA, checkpoint/resume, adapter inference, memory, and throughput work on the target M4 Pro.

**Why it happens:** Hardware runs are expensive and event pressure rewards a green status.

**Consequences:** Training readiness and final model claims are false; version or memory failures appear only during the presentation.

**Warning signs:** Mac tests return pass when capability is absent; skip is not visible; installed `mlx_lm ... --help` is never inspected; hard-coded flags or machine paths remain; peak memory and versions are missing; non-zero child exit can be ignored; E4B checkpoint resume is untested.

**Prevention:** Maintain two explicit gates. Portable tests cover schema, exports, command generation, parsers, job recovery, and mock supervision and report unsupported hardware as `SKIPPED`. Target acceptance must actually run E2B generation/tool call and E4B preflight, bounded QLoRA, save/resume, adapter inference, paired subset evaluation, and record peak memory/tokens per second/wall time/versions within the operational budget.

**Recovery and verification:** Relabel previous evidence as fixture/replay/portable, run the full capability-gated sequence on the target machine, preserve signed raw run manifests/log classifications, and do not infer completion from a subset.

**Owning phases:** P7 primary; P1 establishes stable capability-aware scripts; P8 verifies labels and evidence.

### 29. Studio mixes live, replay, fixture, and cached values

**What goes wrong:** A view-level badge says LIVE while some charts use fixtures, replay data is presented as a completed live run, or stale caches combine different dataset/benchmark fingerprints.

**Why it happens:** Provenance is attached to pages rather than each metric/data series and replay is optimized for presentation continuity.

**Consequences:** The product makes false metrics, training, privacy, or benchmark claims even if backend artifacts are correct.

**Warning signs:** Data series lack run/dataset/result IDs; a badge is manually set in UI code; fixture values can enter production API responses; refreshed panels show different snapshot times; composite numbers cannot be recomputed from source artifacts; replay signature/checksum is not verified.

**Prevention:** Carry `LIVE`/`REPLAY`/`FIXTURE`, source manifest ID, snapshot time, population, and exclusions with every API datum. Derive badges, never set them cosmetically. Refuse mixed-fingerprint aggregation unless visibly separated. Verify signed/checksummed replay manifests and keep fixtures in isolated namespaces.

**Recovery and verification:** Remove or relabel the claim, invalidate caches, reload one immutable manifest, compare UI aggregates to independent DuckDB/Parquet queries, and run screenshot/E2E checks for all three labels and mixed-source rejection.

**Owning phases:** P8; P2 event/run types and P3-P7 outputs must carry source classification.

### 30. A local Studio or model endpoint is accidentally network-accessible

**What goes wrong:** Bun/server defaults bind to `0.0.0.0`, development errors expose paths/secrets, or permissive browser/API behavior lets another origin read private artifacts.

**Why it happens:** “Local app” is assumed to imply loopback, but server defaults and environment overrides may not.

**Consequences:** Private repository metrics, code, traces, or controls become accessible on the LAN.

**Warning signs:** Hostname is omitted; environment can broaden bind without confirmation; startup logs do not state address; development mode/stack traces are enabled; no hostile-origin tests; browser assets call externally hosted services.

**Prevention:** Bind explicitly to `127.0.0.1`/`::1`, reject non-loopback overrides by default, choose/record ports safely, disable sensitive development responses, constrain origins, and keep presentation assets offline.

**Recovery and verification:** Stop the server, inspect exposure window/logs, rotate any exposed credentials, and test network reachability from non-loopback interfaces before restart.

**Owning phases:** P8 for Studio/API; P6/P7 for model endpoints.

### 31. Event success floor is upgraded into a project completion claim

**What goes wrong:** A 500-2,000-row presentation build, 20-50 tasks, profile-only comparison, or replay becomes evidence that the core/full dataset, E4B adapter, or entire acceptance specification is complete.

**Why it happens:** Presentation pressure collapses “honest event floor” and “definition of done.”

**Consequences:** Missing leakage, hardware, privacy, migration, and reproducibility work is concealed; roadmap phases are prematurely closed.

**Warning signs:** Fixture/replay metrics are unlabeled; row count replaces quality/token counts; absent tuned results are implied by UI design; skipped tests contribute to pass totals; phase evidence points to a command surface rather than acceptance artifacts.

**Prevention:** Maintain separate event and product acceptance matrices. Every claim names dataset/result fingerprint, scale, verification tier, mode, and gate status. No phase closes on screenshots or mocked output.

**Recovery and verification:** Correct presentation copy and roadmap status, preserve the honest narrower result, reopen unmet phases, and run the independent final audit against the full project spec.

**Owning phases:** P8, with P1 defining baseline status and every phase producing explicit acceptance evidence.

## Moderate Pitfalls

These failures usually do not invalidate the entire architecture, but they can corrupt a run, distort an experiment, or make recovery expensive.

### 1. API caching freezes stale repository metadata

**What goes wrong:** Conditional requests reuse an ETag under changed credentials/query scope, or `304` metadata is treated as a new complete snapshot.

**Warning signs:** Cache key omits principal, endpoint parameters, or API version; repository visibility/default branch changes do not alter inventory; snapshot timestamp is request time rather than source observation time.

**Prevention:** Scope cache keys to principal, endpoint, parameters, headers/API version, and authorization class; persist original response provenance and distinguish reused from fetched data.

**Recovery and verification:** Invalidate and rescan, compare ID/visibility/default-branch deltas, and supersede derived metrics.

**Owning phases:** P3; P8 displays observation time.

### 2. Disk exhaustion turns atomic pipelines into partial systems

**What goes wrong:** Mirrors, WAL, CAS, worktrees, Parquet shards, model caches, and checkpoints compete for the same volume until writes or cleanup fail.

**Warning signs:** No preflight estimate/headroom, WAL or worktree counts grow, GC cannot explain reclaimable bytes, failed atomic rename leaves temporary files indefinitely.

**Prevention:** Add per-class usage reporting, conservative preflight reserves, bounded temporary/extraction space, retention policies, and manifest-aware GC dry runs. Never delete the only provenance copy to make room for a downstream derivative.

**Recovery and verification:** Stop writers, remove only verified unreferenced temporaries/objects/worktrees, checkpoint safely, then resume through idempotent jobs and rehash outputs.

**Owning phases:** P2; P3/P5/P6/P7 provide estimators; P8 exposes health.

### 3. Dependency and CLI drift changes behavior without changing artifacts

**What goes wrong:** Broad/floating versions or remembered MLX-LM/HF flags alter schemas, templates, training, or validation.

**Warning signs:** `latest`/broad ranges on boundary packages; installed CLI help is not captured; same dataset/experiment ID spans dependency updates.

**Prevention:** Pin compatible versions, batch upgrades, inspect installed help/signatures, record lockfile/dependency/tool versions in fingerprints, and rerun compatibility fixtures.

**Recovery and verification:** Restore the recorded environment or rebuild as a new version; never compare experiments across silent toolchain drift.

**Owning phases:** P1 baseline; P5 HF toolchain; P7 MLX-LM; P8 reproducibility audit.

### 4. LLM retry policy hides systematic semantic failures

**What goes wrong:** Bounded semantic workers repeatedly regenerate until schema/leakage/quality checks pass, biasing the retained corpus while losing failure evidence.

**Warning signs:** Only final attempt is recorded; retry counts correlate with task type/repository; prompts/models change mid-run; failures become empty metadata.

**Prevention:** Record every observable attempt/status/model/prompt, cap and classify retries, preserve failure rates, and never modify deterministic evidence.

**Recovery and verification:** Recompute affected annotations under one versioned policy and report selection bias/failure populations.

**Owning phases:** P4; P5 reports funnel attrition; P8 visualizes it honestly.

### 5. Synthetic task decomposition creates incoherent tasks

**What goes wrong:** Large commits are split by hunks without dependency analysis, producing instructions unsolvable from their base state or targets requiring omitted changes.

**Warning signs:** Patch does not apply independently; context selector repeatedly needs sibling changes; tests pass only when full original commit is present.

**Prevention:** Prefer coherent original task groups; decompose only with file/symbol/dependency analysis and independent patch/check validation; retain shared source group.

**Recovery and verification:** Merge invalid children back into metadata-only evidence or rebuild them as one group; rerun fail-before/pass-after validation.

**Owning phases:** P4; P5 keeps siblings together; P6 validates executability.

### 6. Current metrics and historical evidence use incompatible clocks

**What goes wrong:** Git commit author time, committer time, GitHub event time, filesystem time, and run time are mixed without timezone or semantic labels.

**Warning signs:** Temporal cutoffs differ between rebuilds; future tasks sort before training tasks; active-day charts change with operator timezone; amended commits shift history unexpectedly.

**Prevention:** Store original timestamps/timezones plus normalized UTC, define which clock each metric/split uses, and record operator display timezone separately.

**Recovery and verification:** Recompute temporal manifests and all descendants when clock semantics change.

**Owning phases:** P3 definitions; P5 temporal splits; P8 display.

### 7. “Private Hub” is treated as a license grant

**What goes wrong:** Private upload is assumed to permit redistribution of collaborator/organization repository code.

**Warning signs:** Dataset card declares a generic public license; repository export policy ignores source license/organization rules; private status is the only policy check.

**Prevention:** Keep rights/export policy distinct from visibility; default uncertain source to local-only or metadata-only; document custom/private use restrictions.

**Recovery and verification:** Remove affected remote content, rebuild permitted configs, and correct the card/version.

**Owning phases:** P3 policy capture; P5 publication; P8 privacy review.

### 8. Stable commands exist but do not exercise the named gate

**What goes wrong:** Required scripts are wrappers that always succeed, silently skip, or run only legacy unit tests.

**Warning signs:** `dataset:validate` does not build/load configs; `benchmark:smoke` does not execute a worktree; `local:check` reports hardware absence as pass; exit codes ignore child failures.

**Prevention:** Define machine-readable outcomes (`PASS`, `FAIL`, `SKIPPED` with reason/capability), make each script emit an artifact, and test negative paths.

**Recovery and verification:** Correct scripts, rerun from a clean checkout and clean `MLX_HOME`, and invalidate acceptance evidence produced by placeholder commands.

**Owning phases:** P1 establishes scripts; P2-P8 progressively replace placeholders; P8 verifies semantics.

## Minor Pitfalls

### 1. Display rounding prevents metric reconciliation

**What goes wrong:** Rounded percentages and abbreviated counts no longer sum or match downloadable data.

**Prevention:** Preserve exact values in APIs/artifacts, state denominators, and round only at the final display layer with an “other/rounding” explanation.

**Owning phases:** P3 and P8.

### 2. Pseudonymous repository IDs are unstable

**What goes wrong:** IDs depend on display name or unsalted hashes and change on rename or leak guessable names.

**Prevention:** Derive stable local IDs from host repository identity under a protected versioned mapping; use separate export pseudonyms and never expose reversible inputs.

**Owning phases:** P2/P3; P5 export.

### 3. Presentation mode relies on external fonts/assets

**What goes wrong:** Offline operation changes layout or leaks network requests.

**Prevention:** Bundle approved assets, test offline 16:9 rendering, and record asset checksums.

**Owning phases:** P8.

### 4. Cleanup removes evidence needed to reproduce a screenshot

**What goes wrong:** Retention keeps the rendered replay but deletes its manifest, schema, or source result.

**Prevention:** Treat replay as a manifest-rooted artifact closure and include it in GC reachability/dry-run output.

**Owning phases:** P2 and P8.

## Portable Verification vs Apple Silicon Acceptance

Portable checks are mandatory and should run on non-Apple systems where supported. They cannot satisfy the hardware gate.

| Capability | Portable verification | Apple Silicon capability-gated acceptance | Invalid substitute |
|---|---|---|---|
| Paths/CAS/catalog/jobs | Traversal, symlink, atomic-write, hash, migration, lease, crash, disk-full fixtures | Same tests on target filesystem plus interruption/restart under real local load | Unit test with in-memory paths/database only |
| Git/GitHub/metrics | Synthetic repositories and paginated API fixtures with exact expected metrics | Optional explicitly selected live repository reconciliation, labeled `LIVE` | Enumerating private repositories for test coverage |
| Evidence/dataset | Deterministic extraction fixtures; real Python Parquet build; generic `load_dataset` for every config/split; leakage/privacy audits | Same artifacts may be built on target; no MLX hardware required | JSONL parsing or fixture rows presented as HF acceptance |
| Runtime/benchmark | Disposable synthetic worktrees, allowlisted real checks, adversarial cleanup, sample-level stats reproduction | Target-machine execution records hardware/software and process behavior | Answer matching or reference-patch similarity |
| MLX-LM exports | Exact tokenizer/template/mask/truncation tests when dependency can load; command/config compatibility checks | Real E2B generation/tool call; E4B preflight and bounded QLoRA; checkpoint/resume; adapter inference; paired subset; peak memory, throughput, wall time, versions | Mock process, replay log, non-Apple CI, E2B-only success, or a reported skip |
| Studio | Build/E2E/API provenance tests, loopback bind test, offline replay, label and screenshot checks | Target presentation rehearsal using signed artifacts; training data remains labeled by actual source | A view-level LIVE badge over fixtures or replay |

Rules:

- Capability absence produces `SKIPPED` with a reason and missing acceptance item; it never produces `PASS`.
- Fixture and replay tests remain required because they test failure handling and presentation stability, but their output cannot prove live ingestion, training, or evaluation.
- P7 owns the real M4 Pro evidence. P8 may consume it but cannot relabel or synthesize it.

## Phase-Specific Warnings

| Phase | Must be solved before exit | Release-blocking evidence |
|---|---|---|
| P1 | Identity collision handling, `MLX_HOME`, green baseline semantics, stable scripts, complete migration inventory and replacement coverage | Built-artifact identity scan; collision/no-collision doctor tests; legacy artifact classification; current baseline with failures/skips stated |
| P2 | Typed config failures, contained paths, atomic CAS, durable manifests, transactional migrations, per-connection PRAGMAs, fenced leased jobs, crash/process recovery | Upgrade/interruption tests; CAS closure/hash audit; lease race/fault injection; WAL/disk-full recovery; no writes outside roots |
| P3 | Explicit authorization, complete paginated inventory, mirror recovery, identity coverage, exact Git metric definitions and exclusions | Synthetic Git oracle suite; inventory scope/completion report; pinned snapshot metrics reconciliation; unauthorized-repo negative tests |
| P4 | Immutable evidence/provenance, accepted-state components, semantic-worker lineage, scoped preference uncertainty/counter-evidence | Evidence object-closure audit; deterministic re-extraction; Q-tier proof; leave-one-repository-out preference checks |
| P5 | Cross-language schemas, real HF configs, dedup reports, pre-expansion task splits, repository/temporal/future isolation, privacy/license gates, safe explicit push | Generic local and private-staging loads for every config/split; signed release; exact upload preview; zero blocking leakage/privacy findings |
| P6 | Fixed bounded tools, allowlisted checks, clean base-SHA worktrees, process cleanup, non-leaking task/grader construction, paired sample results/statistics | Adversarial execution tests; fail-before/pass-after task proof; task fingerprint matrix; contamination audit; independently reproduced statistics |
| P7 | Installed-version MLX-LM configs, correct masks/templates, supervised tool actions, real E2B/E4B target acceptance, experiment lineage | Signed M4 Pro run manifests for load/train/save/resume/infer/evaluate plus memory/throughput/versions; portable skips kept distinct |
| P8 | Loopback/offline Studio, datum-level source labels, privacy/redaction, accurate event claims, full acceptance and independent audit | UI-to-Parquet reconciliation; network/offline tests; LIVE/REPLAY/FIXTURE E2E evidence; complete acceptance matrix with unresolved items visible |

## Cross-Phase Stop Conditions

Stop the pipeline and invalidate descendants when any of these occur:

- Repository selection or export policy cannot be proven for every source.
- A source object, manifest checksum, provenance edge, or schema version is missing or corrupt.
- A task group crosses a split, a holdout repository influences training/profile data, or target/future content appears in model-visible input.
- A secret, high-risk PII item, or forbidden license/visibility class survives the applicable gate.
- A worktree/check/model subprocess escapes containment, command policy, or cleanup.
- A dataset config does not load generically or a publish preview no longer matches exact release hashes.
- Compared variants are not paired under the same experiment manifest.
- Hardware acceptance is skipped, mocked, replayed, or incomplete but labeled passed/live.
- Studio cannot trace a displayed value to one immutable source classification and fingerprint.

Recovery means creating a new immutable artifact/version and rebuilding dependent lineage. Editing a published dataset, completed run, or signed result in place destroys the audit trail.

## Sources

### Authoritative project sources (HIGH confidence)

- `AGENTS.md`
- `.planning/PROJECT.md`
- `docs/MLX_PROJECT_SPEC.md`
- `docs/MLX_DATASET_CONTRACT.md`
- `docs/MLX_BENCHMARK_SPEC.md`
- `docs/MLX_RESEARCH_RATIONALE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/TESTING.md`

The obsolete `.planning/research/SUMMARY.md` was not used as authoritative input.

### Current official documentation (MEDIUM confidence from research seam; recheck pinned/installed versions during implementation)

- Git documentation: https://git-scm.com/docs/gitmailmap
- Git history and diff documentation: https://git-scm.com/docs/git-log and https://git-scm.com/docs/git-diff
- Git blame documentation: https://git-scm.com/docs/git-blame
- SQLite WAL: https://sqlite.org/wal.html
- SQLite foreign keys and PRAGMAs: https://sqlite.org/foreignkeys.html and https://sqlite.org/pragma.html
- Hugging Face Datasets repository structure: https://huggingface.co/docs/datasets/en/repository_structure
- Hugging Face Datasets loading: https://huggingface.co/docs/datasets/en/package_reference/loading_methods
- Hugging Face dataset cards and upload guidance: https://huggingface.co/docs/hub/en/datasets-cards and https://huggingface.co/docs/hub/en/datasets-upload-guide-llm
- MLX-LM LoRA documentation (v0.31.0 consulted; installed version remains authoritative): https://github.com/ml-explore/mlx-lm/blob/v0.31.0/mlx_lm/LORA.md
- GitHub REST pagination, troubleshooting, rate limits, and best practices: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api, https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api, https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api, and https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- Node child processes: https://nodejs.org/api/child_process.html
- Python archive extraction filters: https://docs.python.org/3/library/tarfile.html
- Bun server binding: https://bun.sh/docs/runtime/http/server
- OWASP path traversal and archive symlink guidance: https://owasp.org/www-community/attacks/Path_Traversal and https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/09-Test_Upload_of_Malicious_Files

## Research Gaps Requiring Phase-Local Recheck

- P2 must validate the chosen Bun SQLite driver’s exact transaction, busy-handler, WAL, backup, and process-concurrency behavior; SQLite engine semantics alone do not prove wrapper behavior.
- P3 must inspect installed `git` and `gh` versions/help and choose exact API queries/scopes before freezing metric definitions.
- P5 must pin a mutually compatible `datasets`/`pyarrow`/`huggingface_hub` set and test Dataset Viewer/private staging behavior; current docs do not prove a future pin.
- P6 must choose the concrete OS containment/resource-limit mechanism available on the target Mac; an allowlist alone is not a sandbox.
- P7 must inspect installed `mlx_lm` help and the selected Gemma model templates, then measure candidate E4B profiles on the actual M4 Pro 24 GB machine.
- P8 must define replay signing/key handling and browser-origin policy before treating checksum verification as an authenticity boundary.
