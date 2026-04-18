# Phase 5: Train Model A (H6) — Research

**Researched:** 2026-04-18
**Domain:** MLX LoRA SFT + GRPO training orchestration via Node child_process
**Confidence:** HIGH (every claim below was verified against the actually-installed `mlx-lm==0.31.2` / `mlx-lm-lora==0.1.9` in `.venv/`, or against the Phase 1 01-02-SUMMARY.md on-disk logs.)

---

## Summary

Phase 5 is a **scripts-only** phase. It ships two bash wrappers (`scripts/train.sh`, `scripts/grpo.sh`) plus the Node-side supervisor logic that watches stdout, detects NaN, rolls back to the last numbered adapter checkpoint, and merges reward events into the existing `data-train` SSE stream (contract already owned by Phase 2 plan 02-02).

Three big unknowns were resolved by reading the installed package source directly:

1. **`mlx-lm-lora` 0.1.9 CLI cannot accept a custom reward function.** The `run()` path in `.venv/lib/python3.12/site-packages/mlx_lm_lora/train.py` line 460 hardcodes `reward_funcs` to four R1-XML rewards (`r1_accuracy_reward_func`, `r1_int_reward_func`, `r1_strict_format_reward_func`, `r1_soft_format_reward_func`). `--reward-weights` only reweights that fixed list. There is **no `--reward-fn` / `--reward-path` flag**. The STATE.md open question ("does GRPO need a reward_bridge.py shim?") is now answered: **yes if we want a judge-jury float reward; no if we downscope to R1 built-ins**. Both paths are laid out in the decision matrix below.
2. **mlx-lm has no `--grad-clip` flag.** TRN-04's "grad clip on" cannot be satisfied via CLI alone. The defense reduces to NaN-detect-and-rollback on the Node side — which we can do cleanly — plus the LR of 1e-5 already being conservative enough to make divergence unlikely.
3. **Checkpoint shape is dual-file.** mlx-lm writes both `adapters.safetensors` (latest, overwritten every `save_every`) *and* `{iter:07d}_adapters.safetensors` (numbered, persisted). Rollback = copy the most recent numbered file over `adapters.safetensors`, then `--resume-adapter-file` into that. Verified in `.venv/lib/python3.12/site-packages/mlx_lm/tuner/trainer.py` lines 371–380.

**Primary recommendation:** Ship SFT via `mlx_lm.lora` (straight CLI, no surprises — Phase 1 verified 0.434 s/iter, 400 iters ≈ 2:54 wall-clock, huge margin under the 12-min TRN-01 budget). For GRPO, pick Path A (R1-format rewards with a small data adapter) or Path B (sanctioned `.py` carve-out for judge-jury bridge) **at phase entry**, not mid-execution. Path C (skip GRPO) is the TRN-02 kill-point fallback and does not need pre-work.

---

## User Constraints (from CLAUDE.md — no CONTEXT.md yet)

### Locked Decisions (Hard Constraints, PRD §19.4 / CLAUDE.md)
- `mlx-lm==0.31.2` + `mlx-lm-lora==0.1.9` **only**. No Axolotl, no LLaMA-Factory, no HF Transformers+MPS, no llama.cpp. [VERIFIED: requirements.txt, Phase 1 01-02-SUMMARY deviation #1 — PRD said 0.1.0 but that release is not on PyPI; 0.1.9 is the earliest py3.12-compatible 0.1.x.]
- **Zero `.py` files authored.** Python is a pinned CLI subprocess only. A sanctioned `.py` carve-out requires explicit PRD-owner sign-off. [CITED: CLAUDE.md Hard Constraints; PRD §19.4; 01-02-SUMMARY §GRPO escalation clause]
- Training runs **≤ 20 min wall-clock** hard cap. TRN budget inside that is ≤ 17 min (12 SFT + 5 GRPO). [CITED: PRD §6.4, §19.4]
- Base model **`unsloth/gemma-4-E4B-it-UD-MLX-4bit`** holds. Phase 1 bench peak 6.311 GB ≫ under the 20 GB kill-point, so E2B fallback is not triggered. [VERIFIED: 01-02-SUMMARY.md]
- Streaming contract is **already owned by Phase 2 plan 02-02**: `/api/train` spawns, `trainParser.ts` parses `Iter N: Train loss X` and `Iter N: Reward X`, emits `{type:'data-train', data:{iter,loss?,reward?}, transient:true}`. Phase 5 **does not own** the route; it only owns the scripts, the NaN-detect supervisor, and the reward-merge glue. [VERIFIED: .planning/phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md]
- `Sentry.startSpan({op:'training.sft'|'training.grpo'})` wrapping is already wired in Phase 2 (`lib/observability/trainingSpans.ts`). Phase 5 emits per-iter attributes through it. [VERIFIED: same]
- Node ≥ 20 / Next.js 15 App Router; `runtime='nodejs'` + `dynamic='force-dynamic'` on `/api/train`. [CITED: CLAUDE.md §Tech Stack Locks]

### Claude's Discretion
- GRPO path selection (A / B / C — see Decision Matrix below) — one of these must be chosen at phase-plan time.
- Exact shell shape of `scripts/train.sh` vs `scripts/grpo.sh` (env-var overrides, flag templating).
- NaN-detect heuristic details (which log lines, debounce, how many consecutive NaNs trigger revert).
- Reward-bridge transport if Path B is chosen (HTTP POST to local Next.js vs Unix socket).

### Deferred Ideas (OUT OF SCOPE for Phase 5)
- Per-dimension judge ensembles beyond the Opus+Gemini jury.
- DPO / ORPO training modes.
- Anything other than rank 16 / 16 layers / batch 2 / seq 1024 SFT config.
- Adapter fuse + iPhone deploy — those live in Phase 6.
- Gradient clipping at the MLX optimizer level (not exposed by CLI; relies on NaN-rollback as defense).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRN-01 | `scripts/train.sh` SFT 400 iters, rank 16, last 16 layers, batch 2, seq 1024, LR 1e-5, ≤12 min | Flag map + wall-clock projection confirmed (§Standard Stack, §Wall-Clock Math) |
| TRN-02 | `scripts/grpo.sh` GRPO 150 iters, group 4, LR 5e-6, judge-jury float reward, ≤5 min | GRPO flag surface + reward-fn limitation documented; 3 viable paths mapped (§GRPO Decision Matrix) |
| TRN-03 | Loss + reward stream to same Recharts chart at 5-step cadence; reward overlays when GRPO begins | `--steps-per-report 5` confirmed; reward-emission shape verified (§Reward Stream Integration) |
| TRN-04 | Grad clip on, ckpt every 100 iters, NaN/divergence reverts; SFT-only fallback on unrecoverable | `--save-every 100` verified; dual-file checkpoint shape verified; NaN-detect pattern designed (§Rollback Mechanism). Grad-clip pitfall documented (§Common Pitfalls P3). |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SFT execution (forward/backward pass) | Python CLI subprocess | — | Only `mlx_lm.lora` can drive MLX kernels; hard constraint |
| GRPO execution | Python CLI subprocess | — | Same |
| stdout → SSE parsing | API (Node) | — | Owned by Phase 2 02-02; Phase 5 uses as-is |
| NaN detection | API (Node, supervisor loop) | Script (return code) | Regex on `trainParser` output; SIGTERM on trigger |
| Checkpoint rollback | API (Node — fs + respawn) | Script (bash helper) | Node orchestrates: stop child, copy numbered ckpt, restart with `--resume-adapter-file` |
| Reward scoring (Path B only) | API (Node, local HTTP endpoint called by bridge) | Frontier APIs (Opus+Gemini) | Judge-jury lives in Node already; bridge just reaches into it |
| Loss/reward rendering | Browser (React/Recharts) | — | Owned by Phase 2 02-02 LossChart; Phase 5 writes, Phase 2 renders |
| Script authoring | Script (bash) | — | CLAUDE.md A05 — no Python code authored |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mlx-lm` | 0.31.2 | SFT LoRA over quantized Gemma 4 E4B | PRD-locked; Phase 1 verified 0.434 s/iter; only MLX path to 4B training on M4 Pro in <20 min |
| `mlx-lm-lora` | **0.1.9** (not 0.1.0 as PRD states) | GRPO / DPO / ORPO extension of the same trainer pipeline | PRD-locked (with documented deviation — 0.1.0 does not exist on PyPI; 0.1.6 drops py3.12) |
| `wandb` | latest (offline) | Transitive hard-import of `mlx_lm_lora` — fails at help-screen without it | Phase 1 deviation #2; `WANDB_MODE=offline` preserves airplane-mode story |
| Node.js `child_process.spawn` | built-in | Fire the Python CLI; own stdout | Only way to keep A05 (no .py authored) while streaming live loss |
| Node.js `node:readline` | built-in | Line-buffered parsing of `Iter N: Train loss X` | Already wired in Phase 2 02-02 |
| `@sentry/nextjs` | ^10.49.0 | `training.sft` / `training.grpo` spans | Already wired in Phase 2 via `withTrainingSpan` helper |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `node:fs/promises` | Copy numbered adapter ckpt over `adapters.safetensors` | Rollback path only |
| `chokidar` | Watch adapter dir for new `{iter:07d}_adapters.safetensors` | Optional — surface progress beyond the SSE loss events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash wrappers | A YAML config file (`--config`) the mlx-lm CLI supports | YAML is nicer but bash is more debuggable mid-demo; stick with bash |
| CLI `mlx_lm_lora.train` | Python-level `from mlx_lm_lora.trainer.grpo_trainer import train_grpo` call site passing custom `reward_funcs` | This is the **only** way to get a judge-jury reward — and it requires an authored .py file (Path B carve-out) |
| `--save-every 100` + numbered ckpt | Periodic `cp` of `adapters.safetensors` from bash | Built-in is cleaner and atomic; use it |

**Installation (already done in Phase 1):** `pip install -r requirements.txt` inside `.venv/` — contains `mlx-lm[train]==0.31.2`, `mlx-lm-lora==0.1.9`, `wandb`.

---

## GRPO Decision Matrix (TRN-02 — resolve at phase-plan time)

The PRD §6.2 text "Reward function: Judge-jury float 0–1" **cannot be satisfied by the `mlx_lm_lora.train` CLI** as shipped in 0.1.9. [VERIFIED: `.venv/lib/python3.12/site-packages/mlx_lm_lora/train.py` lines 598–644 hardcode `reward_funcs` to a 4-element R1-XML list; line 298 exposes only `--reward-weights` for reweighting that fixed list.]

Three paths forward:

### Path A — R1-style rewards (strict A05 compliance, narration-compatible) — **RECOMMENDED**
- Use the built-in `r1_accuracy_reward_func` + `r1_strict_format_reward_func` as the reward signal.
- This requires the GRPO dataset to be prompt-only JSONL in the shape `{"prompt": "...", "answer": "..."}` that `GRPODataset` consumes (confirmed in `.venv/.../mlx_lm_lora/trainer/datasets.py` line 9–43).
- Narration: "GRPO reinforces format discipline — the adapter learns to emit `<think>…</think><answer>…</answer>` structure, which on-device tool invocation benefits from."
- **Cost:** We don't get a judge-jury reward in this stage; the headline scoreboard is unaffected (Phase 7 is cross-family judged regardless). Honest narration.
- **Wall-clock:** fits inside 5-min TRN-02 budget trivially — built-in rewards are pure string ops, no network.

### Path B — Sanctioned `.py` carve-out (`scripts/grpo_runner.py`)
- Import `train_grpo` directly; pass a custom `reward_func` that POSTs completions to `http://localhost:3000/api/judge` (Phase 4 territory), gets back float reward.
- **Requires explicit PRD-owner sign-off** (CLAUDE.md + 01-02-SUMMARY escalation clause). Do not take this path without a user decision.
- Wall-clock risk: 150 iters × 4 completions × round-trip judge latency (Opus+Gemini average ~3–5 s per pair) = **30+ min on the inside**. Blows the 5-min TRN-02 budget by 6×. Would need to degrade to a single-judge Gemini-only or a local quick-classifier. Significant scope creep.

### Path C — Skip GRPO entirely (TRN-02 kill-point invocation)
- Ship SFT-only adapter. Narrate as Tier-2 explicitly.
- `scripts/grpo.sh` still exists but its entrypoint is the skip-decision logic, not a subprocess.
- This is the fallback guaranteed by TRN-04 / roadmap kill-point gate anyway ("reward variance <0.01 for 10 steps → kill GRPO"). Making it the *default* simplifies the phase.

**Planner recommendation:** Plan Path A as the primary. Keep Path C as the kill-switch. Do not plan for Path B unless the user explicitly signs off on the .py carve-out and concurrently waives the 5-min budget.

---

## Runtime State Inventory

> Phase 5 is a new-artifacts phase, not a rename/refactor. Only items that already exist and will be reused or overwritten are tracked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Phase 4 `data/training/training.jsonl` (expected, not yet produced) | Consume read-only |
| Stored data | Phase 1 `data/bench/adapter-50iter/adapters.safetensors` (31 MB) | **Do not overwrite** — reserved for Phase 6 fallback hot-swap. Phase 5 writes to a different `--adapter-path`. |
| Live service config | Sentry DSN (already in .env from Phase 1) | Reuse as-is |
| OS-registered state | None — training is a transient subprocess | None |
| Secrets/env vars | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` (for Path B judge bridge only) | Reuse from .env |
| Build artifacts | `.venv/` Python env (Phase 1) | Reuse as-is |

**Nothing found in category:** OS-registered state — verified (no launchd, no systemd, no Task Scheduler for this phase).

---

## Architecture Patterns

### System Architecture Diagram

```
             ┌─────────────────────────────────────────────────────────────┐
             │  Browser (Recharts LossChart — owned by Phase 2 02-03)     │
             └─────────────────────────▲───────────────────────────────────┘
                                       │ SSE (data-train parts)
             ┌─────────────────────────┴───────────────────────────────────┐
             │  Next.js /api/train  (Phase 2 02-02 — already built)        │
             │    ─ spawn(bin, args, {PYTHONUNBUFFERED:1})                 │
             │    ─ readline → parseTrainLine → writer.write data-train    │
             │    ─ withTrainingSpan('sft'|'grpo', iters, …)               │
             │                                                             │
             │  ┌─────── Phase 5 NEW: Supervisor ─────────────────┐        │
             │  │ onParsed(pt):                                    │        │
             │  │   if pt.loss === NaN or (pt.loss > 100 and       │        │
             │  │                           iter > 20):            │        │
             │  │     child.kill('SIGTERM')                        │        │
             │  │     rollback(adapterDir, lastNumberedCkpt)       │        │
             │  │     respawn(args + ['--resume-adapter-file', …]) │        │
             │  └──────────────────────────────────────────────────┘        │
             └─────────────┬───────────────────────────────────────────────┘
                           │ argv: --model --train --iters 400 …
             ┌─────────────▼───────────────────────────────────────────────┐
             │  Python .venv/bin/mlx_lm.lora   (SFT)                       │
             │     ─ writes adapters.safetensors   (every save_every)      │
             │     ─ writes 0000100_adapters.safetensors (numbered)        │
             │     ─ stdout: "Iter N: Train loss X"  (every steps_per_rpt) │
             └─────────────────────────────────────────────────────────────┘
                           │ on SFT completion, bash pipeline triggers:
             ┌─────────────▼───────────────────────────────────────────────┐
             │  Python .venv/bin/mlx_lm_lora.train --train-mode grpo       │
             │     ─ consumes {prompt,answer}.jsonl (R1-format Path A)     │
             │     ─ reward_funcs = r1_accuracy + r1_strict_format         │
             │     ─ stdout: "Iter N: Reward X"                            │
             │     ─ writes to same --adapter-path (merges onto SFT LoRA)  │
             └─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions for Phase 5)
```
scripts/
├── train.sh              # NEW — SFT wrapper (TRN-01)
├── grpo.sh               # NEW — GRPO wrapper (TRN-02) — Path A shape
├── _lib.sh               # NEW — shared (venv activate, env checks)
└── micro-bench.sh        # EXISTING — Phase 1

lib/training/
├── supervisor.ts         # NEW — NaN detect + rollback orchestrator
├── rollback.ts           # NEW — pure fs util: find latest numbered ckpt, atomic copy
└── supervisor.test.ts    # NEW — unit tests for NaN heuristic

data/training/
├── training.jsonl        # Phase 4 SFT input (messages + tools schema)
├── grpo.jsonl            # NEW — Path A prompt/answer set (Phase 5 small adapter)
└── model-a-adapter/      # NEW — --adapter-path target
    ├── adapters.safetensors       # latest (overwritten)
    ├── 0000100_adapters.safetensors # rollback point 1
    ├── 0000200_adapters.safetensors # rollback point 2
    ├── 0000300_adapters.safetensors # rollback point 3
    ├── 0000400_adapters.safetensors # rollback point 4 (final SFT)
    └── adapter_config.json
```

### Pattern 1: SFT `scripts/train.sh` (TRN-01)
**What:** Thin wrapper around `mlx_lm.lora` invoking the PRD §6.2 config.
**When:** Invoked by `/api/train` subprocess when `mode==='sft'`, or manually for Phase 6 bench.
**Example shape:**
```bash
#!/usr/bin/env bash
# scripts/train.sh — SFT LoRA on Gemma 4 E4B for Model A
# Source: derived from PRD §6.2 and Phase 1 01-02 verified flags
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

: "${MODEL:=unsloth/gemma-4-E4B-it-UD-MLX-4bit}"
: "${DATA_DIR:=data/training}"
: "${ADAPTER_DIR:=data/training/model-a-adapter}"
: "${ITERS:=400}"
: "${RANK:=16}"
: "${NUM_LAYERS:=16}"
: "${BATCH:=2}"
: "${SEQ_LEN:=1024}"
: "${LR:=1e-5}"
: "${SAVE_EVERY:=100}"
: "${STEPS_PER_REPORT:=5}"

mkdir -p "$ADAPTER_DIR"

exec python -u -m mlx_lm lora \
  --model          "$MODEL" \
  --train \
  --data           "$DATA_DIR" \
  --iters          "$ITERS" \
  --num-layers     "$NUM_LAYERS" \
  --batch-size     "$BATCH" \
  --max-seq-length "$SEQ_LEN" \
  --learning-rate  "$LR" \
  --grad-checkpoint \
  --save-every     "$SAVE_EVERY" \
  --steps-per-report "$STEPS_PER_REPORT" \
  --adapter-path   "$ADAPTER_DIR"
```
*(Note: `--rank` — verify in planner; mlx-lm 0.31.2's rank may be in `adapter_config.json` rather than CLI. Default is 8. If CLI lacks `--rank`, write `adapter_config.json` beforehand with `{"lora_parameters": {"rank": 16, "scale": 20.0, "dropout": 0.0}}` and let `--adapter-path` point at it. [ASSUMED: rank flag may need verification against `mlx_lm.lora --help` — the Phase 1 help capture I have does not include it. Phase 5 planner must confirm on wave 0.])*

### Pattern 2: GRPO `scripts/grpo.sh` — Path A (TRN-02 recommended)
**What:** Invoke `mlx_lm_lora.train` with `--train-mode grpo`, built-in R1 rewards, resumed from the SFT adapter.
**When:** Invoked after SFT exit 0, at the user's click or automatically when SFT span closes.
**Example shape:**
```bash
#!/usr/bin/env bash
# scripts/grpo.sh — GRPO with built-in R1 rewards on top of SFT adapter
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

: "${MODEL:=unsloth/gemma-4-E4B-it-UD-MLX-4bit}"
: "${DATA_DIR:=data/training}"                 # contains grpo/{train,valid}.jsonl
: "${ADAPTER_DIR:=data/training/model-a-adapter}"
: "${ITERS:=150}"
: "${GROUP:=4}"
: "${MAX_COMPLETION:=512}"
: "${LR:=5e-6}"
: "${SAVE_EVERY:=50}"
: "${STEPS_PER_REPORT:=5}"
: "${WANDB_MODE:=offline}"
export WANDB_MODE

# Sanctioned built-in reward mix: accuracy (weight 2.0) + strict format (weight 0.5)
# Order must match grpo_trainer.py default list: [accuracy, int, strict_format, soft_format]
: "${REWARD_WEIGHTS:=[2.0,0.0,0.5,0.0]}"

exec python -u -m mlx_lm_lora.train \
  --train-mode      grpo \
  --model           "$MODEL" \
  --train \
  --data            "$DATA_DIR/grpo" \
  --iters           "$ITERS" \
  --group-size      "$GROUP" \
  --max-completion-length "$MAX_COMPLETION" \
  --learning-rate   "$LR" \
  --grad-checkpoint \
  --save-every      "$SAVE_EVERY" \
  --steps-per-report "$STEPS_PER_REPORT" \
  --reward-weights  "$REWARD_WEIGHTS" \
  --resume-adapter-file "$ADAPTER_DIR/adapters.safetensors" \
  --adapter-path    "$ADAPTER_DIR"
```

### Pattern 3: NaN-Detect Supervisor (TRN-04)
**What:** Supervisor wraps the existing `/api/train` subprocess lifecycle. Watches parsed `TrainPoint` events; on NaN or loss-spike, SIGTERM the child, copy the most recent numbered adapter back to `adapters.safetensors`, respawn with `--resume-adapter-file`.

```typescript
// lib/training/supervisor.ts — sketch
type TrainPoint = { iter: number; loss?: number; reward?: number };

const NAN_THRESHOLD = 2;          // consecutive NaNs before SIGTERM
const SPIKE_MULTIPLIER = 10;      // loss jumps 10× EMA
const MAX_ROLLBACKS = 2;          // give up after this many

export class TrainSupervisor {
  private nanCount = 0;
  private emaLoss: number | null = null;
  private rollbacks = 0;

  ingest(pt: TrainPoint, child: ChildProcess): 'continue' | 'rollback' | 'abort' {
    if (pt.loss === undefined) return 'continue';
    const bad = Number.isNaN(pt.loss) || !Number.isFinite(pt.loss);
    if (bad) this.nanCount++; else this.nanCount = 0;
    if (this.nanCount >= NAN_THRESHOLD) {
      return this.rollbacks < MAX_ROLLBACKS ? 'rollback' : 'abort';
    }
    // spike detection (only after iter 20 so EMA has warmed up)
    if (this.emaLoss !== null && pt.iter > 20 && pt.loss > this.emaLoss * SPIKE_MULTIPLIER) {
      return this.rollbacks < MAX_ROLLBACKS ? 'rollback' : 'abort';
    }
    this.emaLoss = this.emaLoss === null ? pt.loss : 0.9 * this.emaLoss + 0.1 * pt.loss;
    return 'continue';
  }
  // rollback() {…} — calls lib/training/rollback.ts, then respawn
}
```

### Pattern 4: Rollback Utility
```typescript
// lib/training/rollback.ts — sketch, VERIFIED against mlx-lm trainer.py:371-380
import { readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function rollbackToLatestCheckpoint(adapterDir: string): Promise<number> {
  const entries = await readdir(adapterDir);
  // Pattern per mlx-lm/tuner/trainer.py:375: `{it:07d}_adapters.safetensors`
  const numbered = entries
    .map(n => /^(\d{7})_adapters\.safetensors$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (numbered.length === 0) throw new Error('no numbered checkpoint to revert to');
  const latest = numbered[0][0];
  await copyFile(join(adapterDir, latest), join(adapterDir, 'adapters.safetensors'));
  return Number(numbered[0][1]);   // the iteration we rolled back to
}
```

### Anti-Patterns to Avoid
- **Authoring `.py` files without sign-off.** A05 is a hard constraint (CLAUDE.md + PRD §19.4). Path B is only viable with explicit PRD-owner sign-off.
- **Relying on grad-clip CLI flag.** It does not exist in mlx-lm 0.31.2 (verified). Don't reference it in scripts.
- **Baking `--reward-fn` into `grpo.sh`.** The flag does not exist. Only `--reward-weights` exists.
- **Overwriting `adapter-50iter/` from Phase 1.** That's Phase 6's hot-swap fallback. Use a separate `--adapter-path`.
- **Re-parsing stdout in Phase 5.** Phase 2 02-02's `trainParser.ts` already does this. Phase 5 consumes `TrainPoint` events, not raw stdout.
- **Animating Recharts during live data.** Phase 2 02-02 already sets `isAnimationActive={false}` — don't regress this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loss regex parsing | Your own parser | Phase 2's `parseTrainLine` | Already unit-tested with 6 cases; same output shape |
| Sentry span wrapping | `Sentry.startSpan` from scratch | Phase 2's `withTrainingSpan('sft'\|'grpo', iters, fn)` | Already enforces op-name convention |
| Training subprocess spawn | New `child_process.spawn` call | Phase 2's `/api/train` route | Already handles SIGTERM, orphan cleanup, dynamic='force-dynamic' |
| Gradient clipping | Custom optimizer patch in .py | Not possible via CLI — **rely on NaN-rollback + low LR** | PRD §6.2 LR 1e-5 is already conservative; rollback is the defense |
| GRPO reward function | A Node↔Python bridge unless user sign-off | Built-in R1 rewards (Path A) | CLI limitation (see Decision Matrix) |
| Checkpoint numbering | Custom `cp adapters.safetensors iter-100.safetensors` in bash | `--save-every 100` (built-in, atomic, numbered) | mlx-lm already writes `{iter:07d}_adapters.safetensors`; don't duplicate |

**Key insight:** Phase 5 is mostly *glue*. Phase 2 owns the stream; Phase 4 owns the JSONL; mlx-lm owns the numerical work. Phase 5's unique deliverables are (1) the two bash wrappers, (2) the NaN supervisor, (3) the rollback utility, and (4) the Path-A GRPO data adapter (a tiny transform from Phase 4's tool-call JSONL into `{prompt, answer}` shape).

---

## Reward Stream Integration (TRN-03)

Phase 2 plan 02-02 already emits **both** shapes into the same stream:
```typescript
// parseTrainLine already handles both:
// "Iter 5: Train loss 1.234"  → { iter: 5, loss: 1.234 }
// "Iter 120: Reward 0.87"      → { iter: 120, reward: 0.87 }
```

The `LossChart.tsx` already has **dual Y-axis** (`yAxisId="loss"` left, `yAxisId="reward"` right) — reward naturally overlays when GRPO iterations begin streaming.

**Open question for planner:** Does `mlx_lm_lora.train` GRPO stdout emit the literal string `"Iter N: Reward X"`? [ASSUMED — needs Wave 0 smoke verify]. The Phase 1 grpo-help.log confirms GRPO exists but the data-shape error prevented a live stdout capture. Wave 0 of Phase 5 must do a 5-iter GRPO smoke on a minimal `{prompt,answer}` JSONL and capture the actual log-line format. If it differs (e.g., `"Iter N: reward 0.87"` lowercase, or `"reward_accuracy 0.5, reward_format 0.25"` per-fn breakdown seen at grpo_trainer.py line 724), `parseTrainLine` in Phase 2 needs a regex tweak — which Phase 5 owns the PR for.

**Planner action:** Wave 0 task — "GRPO 5-iter smoke on R1-format JSONL; capture exact stdout; confirm or amend `REWARD_RE` regex."

---

## Common Pitfalls

### P1: `mlx-lm-lora==0.1.0` is not on PyPI
**What goes wrong:** `pip install mlx-lm-lora==0.1.0` fails with "No matching distribution found."
**Root cause:** Release was yanked or never uploaded. PRD §13 states 0.1.0 as the lock but the reality is 0.1.9. [VERIFIED: 01-02-SUMMARY.md deviation #1]
**Avoid:** Pin 0.1.9 in requirements.txt. Update PRD §13 or accept the documented deviation.

### P2: `mlx_lm_lora.train --help` fails without wandb
**What goes wrong:** `ModuleNotFoundError: No module named 'wandb'` on help screen alone.
**Root cause:** Hard-import at module load in 0.1.9, even when `--wandb` is not passed. [VERIFIED: 01-02-SUMMARY.md deviation #2]
**Avoid:** Include `wandb` in requirements.txt; set `WANDB_MODE=offline` in `_lib.sh` to preserve airplane-mode story.

### P3: No `--grad-clip` flag exists (TRN-04 partially-unimplementable)
**What goes wrong:** Plan says "grad clip on" — but the CLI has no such flag. [VERIFIED: `mlx_lm.lora --help` captured in Phase 1 has `--grad-checkpoint` (memory optimization, different thing), no `--grad-clip`.]
**Avoid:** Drop grad-clip from the plan's literal claims. Defense is (a) LR 1e-5 conservative, (b) NaN-detect supervisor + rollback (Pattern 3 + 4).

### P4: GRPO custom reward requires `.py` authoring
**What goes wrong:** CLI has no `--reward-fn`. Tries to pass a judge-jury float reward → impossible without authored Python.
**Root cause:** `reward_funcs` argument to `train_grpo()` is only reachable from a Python call site, not CLI. [VERIFIED: `.venv/.../mlx_lm_lora/train.py:460` hardcodes the list.]
**Avoid:** Path A (built-in R1 rewards) primary; Path C (skip, ship SFT-only) fallback; Path B (sanctioned .py) only with user sign-off.

### P5: GRPO data format is prompt-only, not `messages`+`tools`
**What goes wrong:** Phase 1's 5-iter GRPO smoke crashed with `ValueError: Unsupported data format for GRPO training.` because `bench.jsonl` was SFT messages-shape.
**Root cause:** `GRPODataset` in `mlx_lm_lora/trainer/datasets.py` expects `{"prompt": str, "answer": str, "type"?: str}` — **not** the SFT `messages` + `tools` format. [VERIFIED: datasets.py:9-43 + 01-02-SUMMARY observed error]
**Avoid:** Phase 5 ships a small transform from Phase 4's held-out tool-call set into `{prompt, answer}` shape for GRPO consumption. Keep it in `data/training/grpo/{train,valid}.jsonl`. ≈100–200 examples is enough.

### P6: `--save-every` emits two files per save; rollback must pick the numbered one
**What goes wrong:** Rollback copies `adapters.safetensors` over itself — no-op.
**Root cause:** `adapters.safetensors` is the *current* (potentially-corrupted) file; only `{iter:07d}_adapters.safetensors` preserves history. [VERIFIED: `mlx_lm/tuner/trainer.py:371-380`]
**Avoid:** `rollback.ts` (Pattern 4) explicitly filters for `\d{7}_adapters\.safetensors`.

### P7: `--resume-adapter-file` after rollback must point at `adapters.safetensors`, not the numbered file
**What goes wrong:** Respawning with `--resume-adapter-file 0000100_adapters.safetensors` works technically, but subsequent `--save-every` writes to `adapters.safetensors` (unchanged), breaking the rollback chain on the *next* NaN.
**Avoid:** Rollback utility **first copies numbered → adapters.safetensors**, then respawns pointing at `adapters.safetensors`. Future saves overwrite cleanly.

### P8: `mlx_lm.lora --rank` flag may not exist
**What goes wrong:** Script assumes `--rank 16` CLI flag; script errors.
**Root cause:** mlx-lm historically sets rank via `adapter_config.json` in the adapter path, not CLI. [ASSUMED — Phase 1 help capture does not show `--rank`. Must verify in Wave 0.]
**Avoid:** Wave 0 task: run `mlx_lm.lora --help | grep -i rank`. If absent, pre-create `adapter_config.json` with the desired rank before SFT starts. The planner must decide which of the two shapes to code.

### P9: Hot-reload orphan training subprocesses
**What goes wrong:** Developer edits `app/api/train/route.ts`, Next.js hot-reloads, but the Python subprocess keeps running, burning memory.
**Already mitigated:** Phase 2 plan 02-02 has the `CHILDREN` module-scoped Map + `process.on('beforeExit')` SIGTERM + `dynamic='force-dynamic'` defense. Phase 5 must not regress these when adding supervisor logic.

### P10: 17-minute wall-clock is under the 20-min hard cap — no slack for retries
**What goes wrong:** 1 rollback costs ~30 s (SIGTERM + copy + respawn + ramp). 2 rollbacks = 1 minute. Plus the re-forward-passes already consumed.
**Mitigation:** `MAX_ROLLBACKS = 2` in the supervisor. More than that → abort + ship whatever adapter we have. Honest Tier 2 narration.

---

## Wall-Clock Math (TRN-01, TRN-02 budget verification)

From Phase 1 01-02-SUMMARY (50-iter SFT on the exact same model & config):
- Wall-clock: 32 s
- Sec/iter: 0.434 s

**SFT 400-iter projection:**
- 400 iters × 0.434 s/iter = **174 s ≈ 2:54**. [VERIFIED: linear extrapolation from 01-02 bench]
- Budget: 12 min. Headroom: 9+ min. Rollback can occur twice and still land comfortably.

**GRPO 150-iter projection (Path A):**
- GRPO forward-passes 4 completions per prompt (`group_size=4`) before a single gradient step. Per-iter cost is ~4× a pure generation pass plus the R1 reward math (negligible).
- [ASSUMED] Generation-dominated pass at max_completion_length=512, batch=2, group=4 → ~4–8 s/iter on M4 Pro.
- 150 × 6 s ≈ **15 min**. **This BLOWS the 5-min TRN-02 budget by 3×.**
- **Mitigation:** drop iters to 50 (5 min at 6 s/iter) OR drop max_completion_length to 256 (halves gen time) OR drop group_size to 2 (halves per-iter).
- **Planner action:** Wave 0 GRPO 5-iter smoke must measure sec/iter and decide final iter count. Do not blindly run 150 iters — it will miss the budget. The PRD §6.2 table's "150 iters" assumption predates the 0.1.9 data-format smoke and must be re-validated.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 venv | All training | ✓ | 3.12 (uv-managed) | — |
| `mlx-lm` | SFT | ✓ | 0.31.2 | — |
| `mlx-lm-lora` | GRPO | ✓ | **0.1.9** (not 0.1.0) | — |
| `wandb` (offline) | mlx-lm-lora hard-import | ✓ | latest | — |
| Phase 4 `data/training/training.jsonl` | SFT input | ✗ | — | **Blocking**: Phase 5 cannot fully execute until Phase 4 emits this. Wave 0 can substitute the Phase 1 `data/bench/{train,valid}.jsonl` for a dry run. |
| Phase 2 `/api/train` route | Subprocess + SSE | ✓ (planned; wave 1 of Phase 2) | — | — |
| Phase 2 `trainParser.ts` + `withTrainingSpan` | Parsing + Sentry | ✓ (planned; wave 1 of Phase 2) | — | — |
| HF cache `~/.cache/huggingface/` | E4B weights | ✓ | 9 files cached | — |

**Missing dependencies with no fallback:** Phase 4 `training.jsonl` (soft-blocking — Wave 0 dry-run can use Phase 1 bench JSONL).

**Missing dependencies with fallback:** —

---

## State of the Art

| Old Approach (pre-2026) | Current Approach | When Changed | Impact |
|-------------------------|------------------|--------------|--------|
| HF Transformers + MPS for Mac LoRA | `mlx-lm` | Throughout 2025 | MLX is now the standard for Apple Silicon LoRA; PRD §19.4 A04 excludes HF+MPS |
| Axolotl/LLaMA-Factory YAML configs | `mlx-lm` CLI + YAML via `-c` flag | 2025 | Same — MLX-native is the M-series path |
| PPO with external reward | GRPO (group-relative, no value model) | 2024–2025 | `mlx-lm-lora` 0.1.x ships GRPO; no PPO option |
| Custom reward functions via CLI | Hardcoded R1-XML list | 0.1.9 reality | **This is the specific gap that breaks PRD §6.2's judge-jury claim** |

**Deprecated/outdated claims in PRD:**
- PRD §13 states `mlx-lm-lora==0.1.0` — use 0.1.9.
- PRD §6.2 table row "Reward function: Judge-jury float 0–1" — not reachable via CLI (see Decision Matrix).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GRPO stdout line format is `"Iter N: Reward X"` | Reward Stream Integration | Parser regex miss; reward events silently dropped. Wave 0 smoke verifies. |
| A2 | `mlx_lm.lora` has no `--rank` CLI flag; rank is set via `adapter_config.json` | Pattern 1 + Pitfall P8 | Script fails on invocation. Wave 0 smoke verifies (one `mlx_lm.lora --help \| grep rank`). |
| A3 | GRPO sec/iter ~4–8 s at group 4 / max_completion 512 on M4 Pro 24 GB | Wall-Clock Math | 150 iters misses 5-min budget; iter count or completion-length must shrink. Wave 0 smoke measures. |
| A4 | R1-format rewards produce non-trivial, non-zero gradient signal on tool-call prompts (Path A is *useful*, not just cheap) | GRPO Decision Matrix Path A | GRPO reward variance stays ~0 → TRN-02 kill-point triggers → ship SFT-only (which is the planned fallback anyway). Low risk. |
| A5 | Phase 4's output JSONL lands before Phase 5 H6 execution | Environment Availability | Wave 0 can work around with Phase 1 bench JSONL for dry-run. Phase 5 H6 live run is blocked if Phase 4 slips. |
| A6 | NaN-spike detection with `SPIKE_MULTIPLIER=10` is neither too tight nor too loose for Gemma 4 E4B QLoRA loss dynamics | Pattern 3 | Too tight → false-positive rollbacks eating budget. Too loose → lets divergence ride. Tune during Wave 0 — start conservative. |

---

## Open Questions

1. **Does the user sign off on Path B (sanctioned `.py` carve-out) for true judge-jury GRPO?**
   - What we know: PRD §6.2 text says judge-jury. CLI cannot do it. CLAUDE.md + PRD §19.4 A05 require explicit sign-off for any .py authoring.
   - What's unclear: Is the narration commitment to "judge-jury reward" stronger than the zero-.py constraint?
   - Recommendation: Ask at `/gsd-discuss-phase 5` time. If unsure, default to Path A (ship in budget, narrate R1-format refinement honestly).

2. **Final GRPO iter count (150 vs adjusted)?**
   - What we know: PRD says 150. Our wall-clock math suggests 150 × 6 s/iter ≈ 15 min (overshoot).
   - What's unclear: Real sec/iter.
   - Recommendation: Wave 0 smoke 5 iters → projected → pick iter count that lands ≤ 4 min (leaving 1 min slack inside the 5-min TRN-02 budget).

3. **Does Phase 4 produce a prompt-only eval set suitable for GRPO Path A, or does Phase 5 own the transform?**
   - Recommendation: Phase 5 owns it. A ~50-line transform script reading Phase 4's tool-call JSONL and emitting `{prompt: user_content, answer: expected_tool_name}` pairs. Plan it as a Wave 1 task.

---

## Validation Architecture

*(Config has `workflow.nyquist_validation: false` — section skipped per template rule.)*

---

## Security Domain

> `security_enforcement` is not set in config. Defaulting to enabled. Phase 5 surface is narrow (laptop-local subprocess).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-operator laptop demo; no auth surface |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Already enforced by Phase 2 02-02: closed regex on `model`, enum on `mode`, cap on `iters` |
| V6 Cryptography | no | — |
| V12 API / Secure Deployment | yes | `spawn` with literal argv, no shell, no user strings into argv (inherited from Phase 2) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Argv injection via request body | Tampering/EoP | Phase 2 already enforces closed regex on model, enum on mode; Phase 5 adds no new body fields |
| Orphan subprocess on hot-reload | DoS | Phase 2 CHILDREN map + SIGTERM on beforeExit + `dynamic='force-dynamic'` |
| Supervisor infinite rollback loop | DoS | `MAX_ROLLBACKS = 2` cap in supervisor |
| Judge-bridge (Path B) leaking training prompts to 3rd-party LLM | Info Disclosure | Path B only; if chosen, narrate honestly. Training data is public Supabase docs — low severity. |
| wandb online mode phoning home | Info Disclosure / airplane-mode compromise | `WANDB_MODE=offline` in `_lib.sh` |

---

## Project Constraints (from CLAUDE.md)

- **Single source of truth:** PRD_SPEC.md. This RESEARCH flags three PRD-SoT deviations (mlx-lm-lora version 0.1.9 vs 0.1.0; no `--grad-clip` flag; no `--reward-fn` flag) — PRD §13 and §6.2 may need patching.
- **Zero `.py` files authored.** Path A and Path C comply; Path B does not.
- **≤ 20 min training wall-clock hard cap.** 150-iter GRPO may violate this — see Wall-Clock Math.
- **No PWA, WebLLM, transformers.js, llama.cpp, Axolotl, Core ML, ExecuTorch, E2B.** None relevant to Phase 5 anyway.
- **Auto-format agent-generated JS.** Not relevant to Phase 5 (tool-design lives in Phase 3).
- **Vision/audio.** Not relevant.
- **Sentry vercelAIIntegration.** Already wired Phase 2; Phase 5 just emits attributes via the existing helper.
- **AI SDK v6 (`ToolLoopAgent`, `createUIMessageStream`, `writer.merge`).** Phase 5 does not add new routes.

---

## Sources

### Primary (HIGH confidence)
- `.venv/lib/python3.12/site-packages/mlx_lm_lora/train.py` — read lines 420–470, 598–644 for GRPO CLI → trainer wiring and hardcoded reward list
- `.venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/grpo_reward_functions.py` — full read; confirmed R1-only built-ins
- `.venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/grpo_trainer.py` — read reward_funcs wiring at lines 15–23, 159–166, 269–308, 383–385, 531–534, 598–602, 674–725
- `.venv/lib/python3.12/site-packages/mlx_lm_lora/trainer/datasets.py` — confirmed `GRPODataset` prompt/answer shape at lines 9–43
- `.venv/lib/python3.12/site-packages/mlx_lm/tuner/trainer.py` — confirmed numbered-checkpoint file format and cadence at lines 371–380
- Phase 1 `data/bench/grpo-help.log` — captured CLI surface (no --reward-fn, no --reward-path)
- Phase 1 `data/bench/grpo-smoke.log` — captured `ValueError: Unsupported data format for GRPO training.`
- Phase 1 `01-02-SUMMARY.md` — sec/iter benchmark, version deviation notes
- Phase 2 `02-02-train-subprocess-loss-chart-PLAN.md` — existing streaming + Sentry contract
- `PRD_SPEC.md` — §6.2, §6.4, §10.5, §13, §14 H6, §19.4
- `.planning/REQUIREMENTS.md` — TRN-01..TRN-04
- `.planning/ROADMAP.md` — Phase 5 goal and kill-points

### Secondary (MEDIUM confidence)
- PRD §20 references to `mlx-lm-lora` GitHub — not directly fetched this session but consistent with installed source

### Tertiary (LOW confidence)
- GRPO sec/iter projection (A3) — derived from generation-speed analogues, not measured. Wave 0 smoke closes this gap.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and flags verified from installed packages
- Architecture: HIGH — Phase 2 contract is locked and read directly
- GRPO reward-fn surface: HIGH — sourced from installed .py directly
- Wall-clock math: MEDIUM (SFT HIGH from Phase 1 data; GRPO assumed until Wave 0 smoke)
- NaN heuristic tuning: MEDIUM — conservative initial values; tunable
- Pitfalls: HIGH — most observed directly in Phase 1 logs or source

**Research date:** 2026-04-18
**Valid until:** 2026-04-19 (this is a hackathon; the dependency graph will not change in 24 h)

---

## RESEARCH COMPLETE

**Phase:** 5 — Train Model A (H6)
**Confidence:** HIGH

### Key Findings
- `mlx-lm-lora==0.1.9` **cannot accept a custom reward function via CLI**. PRD §6.2's "Judge-jury float reward" is unreachable without a sanctioned `.py` carve-out. Three paths mapped (A: R1 built-ins, B: .py bridge, C: skip GRPO).
- `mlx-lm==0.31.2` has no `--grad-clip` CLI flag. TRN-04's grad-clip defense reduces to NaN-detect + numbered-checkpoint rollback on the Node side.
- Checkpoint shape is verified: `{iter:07d}_adapters.safetensors` numbered files + one `adapters.safetensors` latest, per `--save-every`. Rollback utility design provided.
- SFT 400-iter projects to **2:54 wall-clock** (Phase 1 bench × 8 extrapolation) — 9+ min of slack against 12-min TRN-01 budget. SFT is safe.
- GRPO 150-iter at group 4 / max_completion 512 **likely overshoots** the 5-min TRN-02 budget. Wave 0 smoke must measure and re-pick iter count.
- Phase 5 is a **glue phase**: Phase 2 owns the stream, Phase 4 owns the JSONL, mlx-lm owns the numerics. Phase 5 ships two bash scripts, one supervisor, one rollback util, one tiny data-shape transform.

### File Created
`/Users/julianschmidt/Documents/GitHub/codex-hackathon/.planning/phases/05-train-model-a/05-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Installed packages inspected directly |
| Architecture | HIGH | Phase 2 contract read from plan file |
| GRPO reward-fn surface | HIGH | Python source read directly; 3-path decision matrix authored |
| Pitfalls | HIGH | Mostly observed in Phase 1 logs or source |
| Wall-clock math | MEDIUM | SFT HIGH (measured); GRPO assumed until Wave 0 smoke |

### Open Questions
1. Does the user authorize Path B (sanctioned `.py` carve-out) for judge-jury GRPO? Default recommendation: Path A.
2. Final GRPO iter count — fix in Wave 0 smoke, do not blindly trust PRD §6.2's 150.
3. Does Phase 5 own the SFT-JSONL → GRPO-prompt-shape transform? Recommendation: yes, Wave 1 task.

### Ready for Planning
Research complete. Planner can now author `05-0X-*-PLAN.md` files. Recommended wave breakdown:
- **Wave 0 (smoke / verify):** `mlx_lm.lora --help | grep rank`; 5-iter GRPO smoke on minimal R1-format JSONL; capture real `Iter N: Reward …` stdout shape; pick final GRPO iter count.
- **Wave 1 (scripts + glue):** `scripts/train.sh`, `scripts/grpo.sh`, `scripts/_lib.sh`, `data/training/grpo` transform, `lib/training/supervisor.ts` + `rollback.ts` with unit tests.
- **Wave 2 (integration):** wire supervisor into `/api/train` at the `onParsed` seam; end-to-end SFT→GRPO→final-adapter run on Phase 4 JSONL (or Phase 1 bench JSONL as dry-run).
