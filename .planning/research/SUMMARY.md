# Research — Pre-Seeded from PRD_SPEC.md

The PRD already embeds full primary-source research. Rather than re-running the 4-parallel-researcher fan-out (STACK / FEATURES / ARCHITECTURE / PITFALLS), pointers into the PRD follow. If a future phase needs deeper research, spawn fresh `gsd-project-researcher` agents against the specific question; don't re-scrape what's already here.

## Pointers

| Dimension    | Read from PRD_SPEC.md | Also |
|--------------|----------------------|------|
| STACK        | §5 (base model), §6 (fine-tuning), §13 (full tech stack) | §20 references |
| FEATURES     | §2 (goals tier 1/2/3), §9 (dynamic tool system), §11 (eval) | — |
| ARCHITECTURE | §4 (system topology, runtime boundaries), §8 (on-device runtime), §10 (Coordinator/Worker) | §19.1 repo layout |
| PITFALLS     | §5.4 (Gemma 4 tool-call drift), §14 kill-points, §16 (risk register, 17 rows), §19.4 (must-follow conventions) | §4.2 (PWA blocker), §18 (de-risk) |

## Key risks (top 5 from PRD §16)

1. **R2 (20):** Total SFT+GRPO > 17 min. Mitigation: H0 bench drives iter count.
2. **R3 (16):** Venue Wi-Fi flakes, teacher stalls. Mitigation: hotspot, cache, multi-provider fallback.
3. **R4 (16):** Gemma 4 tool-call format drift (Jackrong caveat). Mitigation: SFT on well-formed trajectories + strict parser + BFCL-AST eval.
4. **R5 (16):** Solo-operator cognitive overload. Mitigation: 8 memorized guidepost phrases + auto-advancing scoreboard transitions.
5. **R17 (16):** Friday work cut forces broken smoke path. Mitigation: H0–H2 are explicit smoke-test gates with kill-points to demote tier rather than continue on broken foundation.

## Do-not-build list (PRD §19.4)

- No PWA / WebLLM / transformers.js / llama.cpp paths.
- No HuggingFace Transformers + MPS, Axolotl, LLaMA-Factory.
- No sensitive data in training corpus.
- No auto-formatting agent-generated JS tool bodies — reject, don't fix.
- No cache-breaking the base-model download on iPhone.
- No E2B / WebContainers / CodeSandbox for tool sandboxing.
- No per-dimension multi-judge.
- No Gemma 4 audio / vision modalities.
- No training runs longer than 20 minutes wall-clock.
