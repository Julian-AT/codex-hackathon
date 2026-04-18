---
name: Phase 5 Context — Train Model A
description: Locked decisions captured after research, before planning
type: project
---

# Phase 5: Train Model A — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Source:** Post-research reconciliation (no discuss-phase run)

<domain>
## Phase Boundary

Phase 5 delivers two bash training scripts + a Node-side training supervisor and checkpoint-rollback utility, producing a live-trained LoRA adapter with loss + reward curves streamed on the Phase 2 chart. Phase 2 owns `/api/train`, LossChart, and Sentry spans; Phase 4 owns the training JSONL. Phase 5 is the glue between them plus the training numerics.
</domain>

<decisions>
## Implementation Decisions

### GRPO Reward Function — LOCKED: Path A (R1 built-ins)
- Use `mlx-lm-lora` 4 hardcoded R1-XML reward functions with `--reward-weights` tuning.
- NO custom reward shim. NO `.py` files authored. CLAUDE.md hard constraint preserved.
- Narration reframes the GRPO beat as "XML-structure reward" (format + tag-validity + content-correctness over hardcoded R1 rubric), not judge-jury float.
- PRD §6.2 "judge-jury float reward" text diverges from reality here — plan MUST document this divergence; PRD update is downstream.

### Version Pin — LOCKED: mlx-lm-lora==0.1.9
- What's actually installed in the Phase 1 venv. Eliminates drift risk between script and env.
- Planner MUST include a task that updates `requirements.txt` / `pyproject.toml` / CLAUDE.md / PRD tech-stack lock from 0.1.0 → 0.1.9.
- mlx-lm stays at 0.31.2 (unchanged).

### Grad Clipping — LOCKED: Node-side NaN detect + numbered-checkpoint rollback
- `mlx-lm==0.31.2` has no `--grad-clip` flag. TRN-04's grad-clip language is unreachable via CLI.
- Supervisor parses stdout every step, flips to rollback on NaN/Inf loss, restores the last `{iter:07d}_adapters.safetensors` via a Node-side rollback util.
- Checkpoint cadence: `--save-every 100` (TRN-04 requirement). Keeps both `adapters.safetensors` (latest) and numbered snapshots.

### GRPO Iter Count — LOCKED: Wave 0 smoke measures; default plan assumes 150 but reduces if smoke overshoots 5 min
- 5-iter GRPO smoke captures real s/iter at group=4, max_completion=512.
- If projected 150-iter wall > 5 min, reduce to nearest 50-iter multiple that fits.
- SFT stays at 400 iters (Phase 1 bench projects 2:54 wall-clock — 9+ min slack under the 12-min TRN-01 budget).

### Script Authoring — LOCKED: bash only
- `scripts/train.sh` (SFT), `scripts/grpo.sh` (GRPO), `scripts/_lib.sh` (shared env + checkpoint helpers).
- NO `.py` files. Python stays a pinned CLI subprocess per CLAUDE.md.

### Streaming Contract — LOCKED: single merged SSE via Phase 2's /api/train
- Loss (SFT + GRPO) and reward (GRPO only) merge into one Recharts series at 5-step cadence.
- Reward stream begins when supervisor detects the GRPO phase boundary (script transition).
- Sentry `training.sft` / `training.grpo` spans emit per Phase 2 contract (ORC-05 already wired).

### NaN Recovery — LOCKED: revert + narrate
- Unrecoverable SFT NaN (kill-point TRN-04) → supervisor emits `training.aborted` event, frontend pill flips to "Tier 2 — prior-checkpoint adapter", demo continues with last good snapshot.
- Unrecoverable GRPO collapse (reward variance <0.01 for 10 steps, kill-point TRN-02) → supervisor kills GRPO process, emits `grpo.collapsed`, frontend pill "SFT-only adapter — Tier 2", demo continues.

### Phase 4 Contract — Assumed
- Training JSONL ships in mlx-lm `tools` format: `{"messages": [...], "tools": [OpenAI-schema]}` per PRD §6.1.
- Phase 5 owns a tiny SFT-JSONL → GRPO prompt/answer transform util (strips assistant turn for GRPO rollouts).
- Phase 4 plans do not exist yet — Phase 5 plans proceed against the PRD-locked contract; if Phase 4 diverges, Phase 5 plans update.

### Claude's Discretion
- Exact Node process-management pattern for supervisor (spawn vs fork) — planner picks.
- Exact checkpoint-rollback util API surface — planner picks.
- Whether Wave 0 smoke is a separate plan or a task within the SFT plan — planner picks.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec
- `PRD_SPEC.md` — §14 execution plan, §13 tech-stack locks, §15 fallback tiers, §19.4 hard constraints, TRN-* REQs
- `CLAUDE.md` — project instructions + hard constraints

### Research + prior phases
- `.planning/phases/05-train-model-a/05-RESEARCH.md` — command surfaces, reward landmine, checkpoint shape, rollback pattern
- `.planning/phases/01-foundation-smoke/01-02-SUMMARY.md` — Phase 1 micro-bench (0.434 s/iter E4B), GRPO surface capture
- `.planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md` — Phase 2 contract for `/api/train` + LossChart + training spans

### Planning
- `.planning/ROADMAP.md` — Phase 5 goal + success criteria + kill-point gates
- `.planning/REQUIREMENTS.md` — TRN-01..TRN-04
</canonical_refs>

<specifics>
## Specific Ideas

- Wave 0 (smoke, ≤5 min): verify `--rank` flag shape on mlx-lm-lora 0.1.9, run 5-iter GRPO smoke, capture stdout `Iter N: Reward …` format, pick final GRPO iter count.
- Wave 1 (scripts + glue, parallelizable): `scripts/train.sh`, `scripts/grpo.sh`, `scripts/_lib.sh`, `lib/training/supervisor.ts`, `lib/training/rollback.ts`, SFT→GRPO transform, unit tests.
- Wave 2 (integration, serial): wire supervisor into Phase 2's `/api/train`, end-to-end SFT→GRPO→fused-adapter dry run, loss+reward chart verified live.
</specifics>

<deferred>
## Deferred Ideas

- True judge-jury GRPO (Path B `.py` carve-out) — deferred; breaks hard constraint.
- GRPO reward-variance collapse auto-detector beyond the simple 10-step rolling stddev — keep simple in hackathon window.
- PRD §6.2 text reconciliation (judge-jury → R1 XML) — documented in plan notes, PRD update out of phase scope.
</deferred>

---

*Phase: 05-train-model-a*
*Context locked: 2026-04-18 post-research*
