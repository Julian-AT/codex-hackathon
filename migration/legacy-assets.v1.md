# MLX — the personal coding dataset and model pipeline: Legacy Migration Review

> This project is distinct from Apple's MLX project and is not affiliated with or endorsed by Apple.

Canonical source: `migration/legacy-assets.v1.json` (schema 1, inventory 1.0.1).
This file is generated from validated JSON. Do not edit it by hand.

## Coverage

| Category | Policy | Discovered | Records | Status | Evidence |
|---|---:|---:|---:|---|---|
| legacy-command | records | 22 | 22 | reconciled | controlled tracked paths plus explicit source declarations |
| executable-name | records | 3 | 3 | reconciled | controlled tracked paths plus explicit source declarations |
| runtime-path | records | 22 | 22 | reconciled | controlled tracked paths plus explicit source declarations |
| generated-artifact | records | 29 | 29 | reconciled | controlled tracked paths plus explicit source declarations |
| script | records | 15 | 15 | reconciled | controlled tracked paths plus explicit source declarations |
| product-string | records | 1 | 1 | reconciled | controlled tracked paths plus explicit source declarations |
| dynamic-tool-path | records | 9 | 9 | reconciled | controlled tracked paths plus explicit source declarations |
| ios-component | records | 11 | 11 | reconciled | controlled tracked paths plus explicit source declarations |
| planning-artifact | records | 55 | 55 | reconciled | controlled tracked paths plus explicit source declarations |

## Runtime-state scope

- **legacy-user-config — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **legacy-project-config — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **canonical-mlx-root — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **repository-generated-data — source-records:** Only version-controlled path declarations and tracked metadata are represented; artifact contents remain unopened.
- **environment-derived-root — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **os-temporary-state — source-records:** Only version-controlled path declarations and tracked metadata are represented; artifact contents remain unopened.
- **build-cache-vendor — source-records:** Only version-controlled path declarations and tracked metadata are represented; artifact contents remain unopened.
- **device-container-state — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **process-network-runtime — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **external-global-executable — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.
- **credentials-private-repositories — not-inspected:** External or operator-controlled state is represented by source expressions and deliberately not inspected.

## Exact migration records

### legacy-command

- **65195ec23a86e482ad324ce3a0475070dfbd4dc9e497cc82ac4c25b823f3a8fb** — `src/commands/index.ts#command=/? -> /help`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **60339303dc7956cd81305ad50b3fe6dda6b2b0d4ec93705553f81ca7babea227** — `src/commands/index.ts#command=/cfg -> /config`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **d252aaa5fb752c59253ecbb419eca9ae3a622e6d5274a3df09d62ef90b2eb118** — `src/commands/index.ts#command=/clear`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **8b68fc3e374d4557e96c6bb69f5e13da4f9d2ee51fe42a66fec36c9b305ffb2b** — `src/commands/index.ts#command=/config`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **fa2630cb4a0b3c66edd484f0e4b003bcd35c06d4523331814a02b3494606c20b** — `src/commands/index.ts#command=/data-gen`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **bdf56d95600f7eb59c58ae96cf8ecb150e43df5f23b7c79a21d40ba6c4a6df2e** — `src/commands/index.ts#command=/deploy`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **99643895b3f4c471939cd535f7b68b2aa4fb5b740f80258ab4d2d025156f2748** — `src/commands/index.ts#command=/dg -> /data-gen`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **cf859f692c4a0b12910796bf4cccd98759d74c12405cac15477bc6ef33ebf970** — `src/commands/index.ts#command=/disc -> /discover`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **518d711066d9f85e8e1ac012e2b9abbf0e350e10217e8ef6fe4e35869c098dc2** — `src/commands/index.ts#command=/discover`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **a889c95765c2389c23e78b677fd704742c69b94b1c0b02f0b95cc5d370d3502f** — `src/commands/index.ts#command=/eval`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **1072a3d49da252fe90edd15e7f6d29c0f6a4687ee38954def4913c4cf2b52fd3** — `src/commands/index.ts#command=/exit -> quit`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **9401754aa8b8ee2fd2244b93081b5d0dff19f812a1d3df20bb59ef823ed57478** — `src/commands/index.ts#command=/fuse`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **4de318ebba70945891490cfb461b25655770136b68cffc1eb95f859e2262ed6d** — `src/commands/index.ts#command=/help`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **b8afa9d14361b56ad69ead6e58b8576e04d35d89e02e0337db9a96d5fb335392** — `src/commands/index.ts#command=/pipe -> /pipeline`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **f64d5b2ea5ebb1d5bc1a27f4f12f0577ba5731f207493785d59877d7800b6a22** — `src/commands/index.ts#command=/pipeline`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **85e2bfd6024ffb03f8483ba651655fca7dd3e57a709295556f882aa3c0448451** — `src/commands/index.ts#command=/q -> quit`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **365e99c18e2032e79db3e2a28a96a6d9e8d25eb6332cc5dd74bbcbd8805d5716** — `src/commands/index.ts#command=/quit`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **89b7c9b99115085448abc2ca90a977231f118dde08666feea071edeaa54853b4** — `src/commands/index.ts#command=/serve`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **37dbe93e2929895fb11a5a99d19327fbf1b15755d850a8b075aadf3e13de472b** — `src/commands/index.ts#command=/st -> /status`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **9f0866fccb6ee8d62df1485d9dc8a836805d59e8607eec74bfdd4c6f99a2a50c** — `src/commands/index.ts#command=/status`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **933d00f2b87da6796b5d0ac76a2b79cef0e3d55237f04fd0906d7ba10a528604** — `src/commands/index.ts#command=/train`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/commands/index.ts / phase-1-plan-05

- **842c821ffed35d6c584b7d2bce7000a19097287abcdaebc9500cf8caa6c9b1c0** — `src/repl.tsx#command=bare invocation -> retained Ink REPL`
  - Purpose: Legacy legacy-command locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / typed-cli-command-tree / reviewed=true
  - Coverage: requirements=IDEN-05; acceptance=AC-09
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/repl.tsx / phase-1-plan-05

### executable-name

- **600c483e5e998607a5c11a7b0cdcc8e6ee4b817d224853d354a9db8f77c13317** — `README.md#executable=bun src/cli.tsx`
  - Purpose: Legacy executable-name locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / sole-mlx-package-entry / reviewed=true
  - Coverage: requirements=IDEN-02; acceptance=AC-03
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / README.md / phase-1-plan-05

- **a6a6d29940cc43ab29fe7435be59e24d57141cf878abc417120bd47a59b5d69b** — `package.json#executable=bun pipeline`
  - Purpose: Legacy executable-name locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / sole-mlx-package-entry / reviewed=true
  - Coverage: requirements=IDEN-02; acceptance=AC-03
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / package.json / phase-1-plan-05

- **ebd47bc8c2901f8773e14d2f1940821bad7ea425bf36e716e26738ef31fbbf7d** — `package.json#executable=bun start`
  - Purpose: Legacy executable-name locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 1 / sole-mlx-package-entry / reviewed=true
  - Coverage: requirements=IDEN-02; acceptance=AC-03
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / package.json / phase-1-plan-05

### runtime-path

- **47f5a6f9098243dbbd0b88337cca44a67b1162dcecc8f5547f578ad646717666** — `.env.example#expression=ADAPTER_DIR=data/training/model-a-adapter`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .env.example / phase-1-plan-05

- **c80286647554d32ba5d3c4110e015a2f6b4f13c0891d2c4446b229e9c69f8c12** — `.env.example#expression=MLX_SERVER_URL=http://localhost:8080/v1`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .env.example / phase-1-plan-05

- **85ab7031b437bc1f0c1613f41e924046d769420bec95c7e6abc9058d415226d4** — `lib/data/checkpoint.ts#expression=data/checkpoints`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/checkpoint.ts / phase-1-plan-05

- **556eb88c0ee39242abdfc91b3fb197fac48f70bedb9d92392e75208768ffbd51** — `lib/data/emit-jsonl.ts#expression=data/eval.jsonl`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/emit-jsonl.ts / phase-1-plan-05

- **f611ba376b9a00cb8a0fed4d7ed39397766bc2742a1793d41be762ae934fb680** — `lib/data/emit-jsonl.ts#expression=data/training.jsonl`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/emit-jsonl.ts / phase-1-plan-05

- **b62dfc3595c00cbe9ef3942a109dc404e748b9c0738b4cae0c4a660ee32b6940** — `lib/data/split.ts#expression=data/split.manifest.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/split.ts / phase-1-plan-05

- **7f120e7f8d2eea6f669762d4249fcbd744ccb391eea321ba6a6fc5774a0098c1** — `lib/discovery/corpus.ts#expression=data/corpus.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/corpus.ts / phase-1-plan-05

- **e5d21af6b60f3d1ca25b35abe8f556cda93bb426e6099f5a8b315ebafcc7472e** — `lib/discovery/manifest.ts#expression=data/adapter-tools.fallback.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/manifest.ts / phase-1-plan-05

- **73d810295e2c4bc461768acf9b7b7b3f91d9feb29c38efb3a0acae78868e096d** — `lib/discovery/manifest.ts#expression=data/adapter-tools.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/manifest.ts / phase-1-plan-05

- **93bc46cb51b542bedea4b0d8b88c2f61c157cc89d044764518cbad4ec534da1e** — `lib/model.ts#expression=http://localhost:8080/v1`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/model.ts / phase-1-plan-05

- **f2f9dc1fc076a37033b253a6240385e165b72b580444f2a6c1f2f156b6eee416** — `scripts/_lib.sh#expression=.venv/bin/activate`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/_lib.sh / phase-1-plan-05

- **4df045270b89b531145af2e4baa4b5a7c4a4d69ccb5238f6eea5d65be50bad1e** — `scripts/deploy-adapter.sh#expression=/tmp/adapter-verify.txt`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **15a533c31ce41da5dfa7b42f364a02a0f0f5a04245c1043f6f1b546a0fd6780f** — `scripts/deploy-adapter.sh#expression=Documents/adapters/model-a`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **07c6b1780e43430d379f27a52b2c679ff40fa8916e8256aa14a2e34f33aebd43** — `scripts/deploy-adapter.sh#expression=data/state/adapter-deploy.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **8cdb7b0ee23ec100d016d403631f89036b83a27f801db104d93ebe362ea3ffd9** — `scripts/deploy-adapter.sh#expression=data/state/ios-device.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **c90c5846985dbfb75f083a00807ad7992e3e2f46f4c3b85a473f2211d8c3c42e** — `scripts/grpo-smoke.sh#expression=/Users/julianschmidt/Documents/GitHub/codex-hackathon/.venv/bin/activate`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/grpo-smoke.sh / phase-1-plan-05

- **cd12fe209328f6d15e3e27c3a8b7038c7bac30103b5b794969c470e01812c213** — `scripts/ios-deploy-device.sh#expression=data/state/ios-device.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/ios-deploy-device.sh / phase-1-plan-05

- **818704e9cdca2d39571a29a80f3de3e99d66e5ee96722849e0a56ef667584162** — `scripts/preflight-demo.sh#expression=data/cassette`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/preflight-demo.sh / phase-1-plan-05

- **08ed086e678bfc1bd366bac15a1d84e9e8fb2a580be58c391561b0acf5b1aa35** — `scripts/preflight-demo.sh#expression=data/state/preflight-demo.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/preflight-demo.sh / phase-1-plan-05

- **e00a599f6a20b1a814846288d27356d79c92bd88e911e03ba6277c118df803c1** — `scripts/verify-device.sh#expression=data/state/verify-device.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/verify-device.sh / phase-1-plan-05

- **2a90cae1ddef17d0ad7efd0db5fa8603b9847e6cde4d6f68202943e6ffa3fd46** — `src/lib/config.ts#expression=<MLX_HOME>/config/config.json`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/lib/config.ts / phase-1-plan-05

- **6e83f2badd913cc83bf1e1ac53201ce343bfe6b13abcc0ca6bb8588826d11664** — `src/lib/config.ts#expression=data/training/model-a-adapter`
  - Purpose: Legacy runtime-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 2 / contained-local-state-foundation / reviewed=true
  - Coverage: requirements=FNDN-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / src/lib/config.ts / phase-1-plan-05

### generated-artifact

- **bc9a9732207e1ee6f10ac0cc044bd005fb377ebd175fd69456f5cad2b7b065c8** — `data/adapter-tools.fallback.json#file=data/adapter-tools.fallback.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/adapter-tools.fallback.json / phase-1-plan-05

- **e2548d486aa0f02e1224876132f6ca86954a25360c8f43a9217a733624878299** — `data/adapter-tools.json#file=data/adapter-tools.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/adapter-tools.json / phase-1-plan-05

- **6da7cf9be08ee0eac641089c59760517cc93097f01efc5b8d9dec850231b8b0e** — `data/bench/README.md#file=data/bench/README.md`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/README.md / phase-1-plan-05

- **79f8c2323aed03913e42430e9d766a026b05de814bd73a7667f494259ebec940** — `data/bench/bench.jsonl#file=data/bench/bench.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/bench.jsonl / phase-1-plan-05

- **a62ffead57e037aee79e73c6d69624cd212a7410b3430de435812ac14fdecc62** — `data/bench/e4b.log#file=data/bench/e4b.log`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/e4b.log / phase-1-plan-05

- **b3ee557615865e9978d4bd89de32add80baa97437dfe1154f88df18c5433d385** — `data/bench/grpo-5iter.log#file=data/bench/grpo-5iter.log`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/grpo-5iter.log / phase-1-plan-05

- **fb9dc9333133d5a6666d265e0b196cd63ab4c2433fd508bc208456edb79ad419** — `data/bench/grpo-help.log#file=data/bench/grpo-help.log`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/grpo-help.log / phase-1-plan-05

- **11bdb22abbe1fdcc3369269192b8f0be1d4267d7d88034e8ac5665b70f90ec98** — `data/bench/grpo-smoke.log#file=data/bench/grpo-smoke.log`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/grpo-smoke.log / phase-1-plan-05

- **db74f2ead2a4697d1446d13966d36503d7a8ec238d16ef288437d0eb3cfb8c8f** — `data/bench/rank-help.log#file=data/bench/rank-help.log`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/rank-help.log / phase-1-plan-05

- **3aa100ee5d041ea3d49381de6f524281d89ceaf02ac1f05bfb8974fe93ca6d09** — `data/bench/train.jsonl#file=data/bench/train.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/train.jsonl / phase-1-plan-05

- **43336dbd661fdf7a2e93cafc6b671165726e495a534145590a4ab1440ab2175d** — `data/bench/valid.jsonl#file=data/bench/valid.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/bench/valid.jsonl / phase-1-plan-05

- **79ddbb1fbcdc46f32c4fb997d74fbcf9b0879070a66bc327cd0eb6e7c8e37b87** — `data/corpus.json#file=data/corpus.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/corpus.json / phase-1-plan-05

- **b2f25efa57ae6f2d9f75064fb290f98be9243ed04864fa8886a6fdd5281ac31d** — `data/training/grpo/smoke-train.jsonl#file=data/training/grpo/smoke-train.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/training/grpo/smoke-train.jsonl / phase-1-plan-05

- **c49a56dcabdd81accf6f43aa88927937183e47317f28a079eeb53dacccb09ead** — `data/training/grpo/smoke-valid.jsonl#file=data/training/grpo/smoke-valid.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/training/grpo/smoke-valid.jsonl / phase-1-plan-05

- **1b9811ba974544fb5045f44c40e86444e23845f692fd3ce2d7a4432be92a05ee** — `data/training/grpo/train.jsonl#file=data/training/grpo/train.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/training/grpo/train.jsonl / phase-1-plan-05

- **f174006379e79a63b3c08c2336cf1e9d340b8bd68cfdc8010b2531c442dbbcb1** — `data/training/grpo/valid.jsonl#file=data/training/grpo/valid.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / data/training/grpo/valid.jsonl / phase-1-plan-05

- **61ab1fbb41a5afb5ad00878a73971b6a8b51379c4e2709aabbdea9016fdcd673** — `lib/data/checkpoint.ts#artifact=data/checkpoints/<worker>.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/checkpoint.ts / phase-1-plan-05

- **e43c967790edcc92b4cbfeb7ecb603b66cd386a9b38e0c39b2fcae53415172f2** — `lib/data/checkpoint.ts#artifact=data/checkpoints/<worker>.meta.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/checkpoint.ts / phase-1-plan-05

- **6aee6bc70ad1635d5b8fc6d224baa8a1d5dccdb890533cc52a901ab8aacbb3a3** — `lib/data/emit-jsonl.ts#artifact=data/eval.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/emit-jsonl.ts / phase-1-plan-05

- **0e3eb71088f10c11ad20396669072296cb7fa64da02430a27a87a9701d409357** — `lib/data/emit-jsonl.ts#artifact=data/training.jsonl`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/emit-jsonl.ts / phase-1-plan-05

- **bfab51aa090ab2491b92b234cf31d258187d348f0ad1ea247d3166c162e3d294** — `lib/data/split.ts#artifact=data/split.manifest.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/split.ts / phase-1-plan-05

- **5491d74120fccc06ada366f10971215c8b01941751d7269d6d2850718f2f990a** — `scripts/_lib.sh#artifact=data/training/model-a-adapter/adapter_config.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/_lib.sh / phase-1-plan-05

- **9d2e6805c3a720fafe429aea09bc06be6729cb133035901b8a0ee396c19e82a8** — `scripts/_lib.sh#artifact=data/training/model-a-adapter/adapters.safetensors`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/_lib.sh / phase-1-plan-05

- **9069985ef1ca5f035edf0c874b13a731bd036f0edd28e36122bd6a7f3ffeda1e** — `scripts/deploy-adapter.sh#artifact=data/state/adapter-deploy.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **37a305835ccdca4bebd1efa8d8a760f6db16821781e7b498cf83bf93f777f159** — `scripts/fuse-bench.sh#artifact=data/fused-e4b-50iter`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/fuse-bench.sh / phase-1-plan-05

- **21cee46d8baf61d8023786875e93673adfbd296f68ec47764c78b75c072b8787** — `scripts/fuse.sh#artifact=data/fused/model-a`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/fuse.sh / phase-1-plan-05

- **06e9f23e466ec5928918143dd770b654ca7fc8ec6adfc84edc9c4451f59b0eed** — `scripts/fuse.sh#artifact=data/fused/model-a/adapter-tools.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/fuse.sh / phase-1-plan-05

- **2f92af79b548557f683576af6054582b9efc036282e391a7938252ed8ac470b3** — `scripts/preflight-demo.sh#artifact=data/state/preflight-demo.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/preflight-demo.sh / phase-1-plan-05

- **42becf88ae95dc03d645694285a8bb144506b93ecb3a7f220f36014d830f8202** — `scripts/verify-device.sh#artifact=data/state/verify-device.json`
  - Purpose: Legacy generated-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 5 / versioned-dataset-and-export-builds / reviewed=true
  - Coverage: requirements=DATA-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/verify-device.sh / phase-1-plan-05

### script

- **de5f1936f561d1bad8b8872cb44eb632155eeb2898eac9f5c1ce51c8fff5ef0d** — `scripts/_lib.sh#file=scripts/_lib.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/_lib.sh / phase-1-plan-05

- **b54c8a0afdfa4c677b1cfde81936a355b679e250ac9b2a153fa790a955b112e6** — `scripts/build-grpo-jsonl.ts#file=scripts/build-grpo-jsonl.ts`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/build-grpo-jsonl.ts / phase-1-plan-05

- **a51c611cbeda3d48ad2b25a832fba6ffadfbd294e3d5ac6072eb002586468729** — `scripts/deploy-adapter.sh#file=scripts/deploy-adapter.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/deploy-adapter.sh / phase-1-plan-05

- **34d03ec7b530234284ac2980784db9cc070a453de5438ba562cebbe2c007f7c2** — `scripts/fuse-bench.sh#file=scripts/fuse-bench.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/fuse-bench.sh / phase-1-plan-05

- **95e221ec6ad7238136fb2cc985c1af2a3882c168672b55e1cca23565dc7690de** — `scripts/fuse.sh#file=scripts/fuse.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/fuse.sh / phase-1-plan-05

- **99a4f2bfca713ef87bc97ca34ebd41ae50f387bec5bf45386e3c4d37415a24ae** — `scripts/grpo-smoke.sh#file=scripts/grpo-smoke.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/grpo-smoke.sh / phase-1-plan-05

- **e9e17131a69d5fd0556e68cb995bd947fee4894ad893274a3481d6baf40c1502** — `scripts/grpo.sh#file=scripts/grpo.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/grpo.sh / phase-1-plan-05

- **3d66ced1110a8d5b8523c990f922dd8fa4e882c327b69d6e385763bbd2e7c5a6** — `scripts/ios-bootstrap.sh#file=scripts/ios-bootstrap.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/ios-bootstrap.sh / phase-1-plan-05

- **960ac281e1af001233b064a7a5d7d50d39ffb38a753956a8ae35d3bb10e118cf** — `scripts/ios-deploy-device.sh#file=scripts/ios-deploy-device.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/ios-deploy-device.sh / phase-1-plan-05

- **95ca1b343474454c5a7908128a565c34f37126a938dafbc183abd786ce5ae947** — `scripts/micro-bench.sh#file=scripts/micro-bench.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/micro-bench.sh / phase-1-plan-05

- **cfc40985ecce7c3f305256e3a8cb516c6d4dbd4fdcf95f91625a97f8a570e8a4** — `scripts/preflight-demo.sh#file=scripts/preflight-demo.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/preflight-demo.sh / phase-1-plan-05

- **8386b673da52e429ff01d5830e1760188d9f85f4a20601a506f75b3ca7f0a1c7** — `scripts/setup-venv.sh#file=scripts/setup-venv.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/setup-venv.sh / phase-1-plan-05

- **6c246ed29c1756ed57172971b05e9bc92ecdd7b7eb8920ab2838a8bd69e96148** — `scripts/smoke-pipeline.ts#file=scripts/smoke-pipeline.ts`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/smoke-pipeline.ts / phase-1-plan-05

- **92f7b7b64d6078a8d44c30643391abcf4c839ee401e616ece0580541192b61b7** — `scripts/train.sh#file=scripts/train.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/train.sh / phase-1-plan-05

- **c77c1294b730ca212e3c783028929488cb14fbe89a47dee86b9eea961dc63ebe** — `scripts/verify-device.sh#file=scripts/verify-device.sh`
  - Purpose: Legacy script locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 7 / inspected-allowlisted-training-operations / reviewed=true
  - Coverage: requirements=TRNG-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / scripts/verify-device.sh / phase-1-plan-05

### product-string

- **4e52e5b7239ce8a85cb331f27c8699f9a2091bca702422a2bbe6500e1860f033** — `forgeprint-codex-cloud-master-prompt.md#artifact=root cloud build prompt with prohibited Forgeprint and codex product identity`
  - Purpose: Legacy root cloud-build prompt prescribed the prohibited Forgeprint product identity, executable, state root, and unsafe broad private-repository scope.
  - Disposition/removal: remove / eligible
  - Owner: Phase 1 / canonical-mlx-identity-and-migration-gate / reviewed=true
  - Coverage: requirements=IDEN-01, IDEN-07, IDEN-08; acceptance=AC-01, AC-13, AC-16, AC-18
  - Evidence: source:README.md#canonical-product-identity@558c039500ba5dd600415ef1ed2deae3e60f1133#c93cb5129cada7def56bf5275e5e699e32b6823ac7393bdcd2a71221a4f0448e; schema:src/identity/audit.ts#auditIdentity@f0e4a03350e84437f99e3e81fa207632e8a6edd8#c1d8ca8964ca211776369e2c6ab53d22ce254df3026611722c188b0d39456c58; test:src/identity/audit.test.ts#forbidden-product-brand@46521f1ac6fa0ed4fd20b05ee6027e096012447b#0a35e83ab437988dccd2a92858ead4b82244d03be8ec91de0025ec2213d74fb9; executable:mlx.package.json#bin.mlx@f570a1d43899f7057029b437cdbb22135816f0db#c015d05476093512d4716a52d706f71665ff305c43dd34d9d6335819a5af7281
  - Review: approved / phase-1-incident-remediation / 4b5b109828c0e10afe5059ae619edd7124eaf25772135884567e86fb725bb49f
  - Provenance: post-merge-root-artifact-reconciliation / 3881d89:forgeprint-codex-cloud-master-prompt.md / merge-3881d89 / source-digest=d27cd18bd26590b013d92a4f5663a9f498f6794ecff8209485b56ffd8f8bc95e / source-version=477b0a7fd8563159ad2eb18349337153e17d94fa

### dynamic-tool-path

- **e83e6390905adcd79a4783759c45630644a811766f380757f90c30c03f70bf29** — `ios/SpecialistApp/AdapterToolsLoader.swift#symbol=AdapterToolsLoader.loadAndRegister`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/AdapterToolsLoader.swift / phase-1-plan-05

- **3c9f54ab3ad0b003e5695f6f693e9c9dae0cb0e77328a42df878460640143110** — `ios/SpecialistApp/ToolRegistry.swift#symbol=ToolRegistry`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/ToolRegistry.swift / phase-1-plan-05

- **1a5bb244820851aadfb4de90a5dc2a28a197f7b6a8bb4586530411f3fcc634e5** — `lib/data/traj-worker.ts#symbol=runTrajectoryWorker`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/data/traj-worker.ts / phase-1-plan-05

- **f12a093eb10dc4f778b3c425fdddd1aabf63395cae855e297f8e07a9bc75272b** — `lib/discovery/manifest.ts#symbol=copyFallback`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/manifest.ts / phase-1-plan-05

- **2fc2c72e16165f1a473ef94cfb3b35e5225876d6b80b5b52fbb86d628323ac8f** — `lib/discovery/manifest.ts#symbol=writeManifest`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/manifest.ts / phase-1-plan-05

- **559ae1d4c3db3a52f18109f9b2bcfade468aaaab4ab911ef9cec4ed1e1db55d4** — `lib/discovery/pipeline.ts#symbol=runDiscoveryPipeline`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/pipeline.ts / phase-1-plan-05

- **9b4eaa739ee6b76744dcca94d40b8e0b5a1840f97585ff4e1abbe7984de4cb1d** — `lib/discovery/validate/index.ts#symbol=validateCandidate`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/validate/index.ts / phase-1-plan-05

- **c566b64838aa5f376484a37b6ca7e6ffbb5892798049d4bb6ad215a31e8c686b** — `lib/discovery/worker.ts#symbol=generateToolCandidate`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/discovery/worker.ts / phase-1-plan-05

- **f7d0a2bd696c7d4c102b11c19539e87a6a6ee7ea30c97ebde4c8056df33917ea** — `lib/tools/hand-written-supabase.ts#symbol=HAND_WRITTEN_TOOLS`
  - Purpose: Legacy dynamic-tool-path locator retained as exact brownfield migration evidence.
  - Disposition/removal: adapt / blocked
  - Owner: Phase 6 / fixed-host-coding-tools / reviewed=true
  - Coverage: requirements=BNCH-01; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / lib/tools/hand-written-supabase.ts / phase-1-plan-05

### ios-component

- **fb16d6eeb3db72a8105d1ed2af066e00c15705144f092e727fbe853f1e01f711** — `ios/SpecialistApp/AdapterLoaderView.swift#file=ios/SpecialistApp/AdapterLoaderView.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/AdapterLoaderView.swift / phase-1-plan-05

- **88f0797ae60eced5b419e363007efc3a7768ccf535c70c405832f19df3d13f61** — `ios/SpecialistApp/AdapterToolsLoader.swift#file=ios/SpecialistApp/AdapterToolsLoader.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/AdapterToolsLoader.swift / phase-1-plan-05

- **f50da2da0e75991d21fff1935ae10b6138d366a95c71fa1efa12c177f6c029e0** — `ios/SpecialistApp/ChatView.swift#file=ios/SpecialistApp/ChatView.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/ChatView.swift / phase-1-plan-05

- **50cdeb97b00dd2d7bee4d492147430c8fadd680b8338f9434f36f2a15e397ee2** — `ios/SpecialistApp/DynamicTool.swift#file=ios/SpecialistApp/DynamicTool.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/DynamicTool.swift / phase-1-plan-05

- **ea5cf38f93bd6a85b6f46cec2c9ecdcc88b78a67df1243c8307ff0aefc3af1a9** — `ios/SpecialistApp/GemmaToolParser.swift#file=ios/SpecialistApp/GemmaToolParser.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/GemmaToolParser.swift / phase-1-plan-05

- **ce818b8418a6fbb0858fcf96ba91862ab45d13e3238805d6f3403fbd80bec85a** — `ios/SpecialistApp/GemmaToolParserTests.swift#file=ios/SpecialistApp/GemmaToolParserTests.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/GemmaToolParserTests.swift / phase-1-plan-05

- **d414cfe40a906a74c3ac6e968cd96240f851dffeb7b444f530ffc60477d160c9** — `ios/SpecialistApp/ModelState.swift#file=ios/SpecialistApp/ModelState.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/ModelState.swift / phase-1-plan-05

- **c49f8f7b23e62e88d352023fb40d872084b0a26b9fdfe0ee9838f77b50000ce6** — `ios/SpecialistApp/OPERATOR.md#file=ios/SpecialistApp/OPERATOR.md`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/OPERATOR.md / phase-1-plan-05

- **e12a5eea52143dc067492611aee74cadd94285a5187ad30f03eb99dea75c0fa3** — `ios/SpecialistApp/OnlineMonitor.swift#file=ios/SpecialistApp/OnlineMonitor.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/OnlineMonitor.swift / phase-1-plan-05

- **8c12a04ea1d392fa7701518d12e75bf48eb15d9d635995ad8f85e069f5f51034** — `ios/SpecialistApp/ToolRegistry.swift#file=ios/SpecialistApp/ToolRegistry.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/ToolRegistry.swift / phase-1-plan-05

- **499578a31eef34ca00b3d1e7c0f93376561000b7b6fb6c6491868fc8c0061c98** — `ios/SpecialistApp/ToolRoundTripView.swift#file=ios/SpecialistApp/ToolRoundTripView.swift`
  - Purpose: Legacy ios-component locator retained as exact brownfield migration evidence.
  - Disposition/removal: retain / blocked
  - Owner: Phase 8 / optional-ios-migration-evidence / reviewed=true
  - Coverage: requirements=SCAL-06; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / ios/SpecialistApp/ToolRoundTripView.swift / phase-1-plan-05

### planning-artifact

- **a3ba4c35879666aa4cc665e275ed62221a0dcdd9bdbd3dc7894e529038b47056** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-SUMMARY.md / phase-1-plan-05

- **a869356f6a24e0746f0d1f7d2e04f4e72513eb429c961f7d0bc1e1c49397a529** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-01-next-scaffold-sentry-providers-PLAN.md / phase-1-plan-05

- **385c4ed61438f7c4ff924f693e99d8409a185385520ec4f72b48c99f6a6798ef** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-SUMMARY.md / phase-1-plan-05

- **1ba8156f57326a0fe9ffaef4beec56b8c3311277d81ceef9ee77581b267e3121** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-02-python-venv-microbench-PLAN.md / phase-1-plan-05

- **61c0ccbe79c18c58a27d0075eb6685af264f744fb7b9b5081c00bf1ad851cf1c** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-SUMMARY.md / phase-1-plan-05

- **8ee4c0cb2dc27f55f7d744d96a8eb99fbd37db001e9ed01c2be8cd23ce69d05f** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-03-ios-llmeval-fork-deploy-PLAN.md / phase-1-plan-05

- **23a9076beb6ddff9dd93971a6ebc97dff63a918d5d44a2be449a2c1e5793f8db** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-SUMMARY.md / phase-1-plan-05

- **135e5fef1128bc9d2267ac1fd00e0498c1e511b08f83b88c686e854231405c97** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-adapter-hotswap-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-adapter-hotswap-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-04-adapter-hotswap-PLAN.md / phase-1-plan-05

- **1af3d5f3bf4eb4e81906f0f03c45604b7377edee50234bfe55dc8af891bd7100** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-SUMMARY.md / phase-1-plan-05

- **726472cd7e7362cc2f05e91520b6d2b7bb6dbe3828114372007d43947d8c8b4c** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-toolregistry-parser-roundtrip-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-toolregistry-parser-roundtrip-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/01-foundation-smoke/01-05-toolregistry-parser-roundtrip-PLAN.md / phase-1-plan-05

- **fcae65b0d74c87d3a5d0a73f56634ed622f988978e1528d03f84e6093ece3114** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-SUMMARY.md / phase-1-plan-05

- **b7561611cd62abd51dff659b42d5c206563c8153c7f709b538387230616e3fa1** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-01-pipeline-coordinator-worker-PLAN.md / phase-1-plan-05

- **15b9b0f6c561d192693507aac7a82dca931886cf6a5b826b16aff9f36bc30f81** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-SUMMARY.md / phase-1-plan-05

- **f9b47a674b910561046901ce185a73b02edcdaa7b65cd9b64183dfe3b0cb4f2b** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-02-train-subprocess-loss-chart-PLAN.md / phase-1-plan-05

- **51b8ca6d3711f7a58b16132b78da4d979c0c919b92cadb30574a5bf808ec3542** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-SUMMARY.md / phase-1-plan-05

- **d0708fc765ade79095876690364737f66b3598bbb4ad1951cb9014b9e5aeb138** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-agent-grid-demo-page-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-agent-grid-demo-page-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-03-agent-grid-demo-page-PLAN.md / phase-1-plan-05

- **cda25f5ecf40b3d7c38dd39ee24c343d00239c07151c2ad27262fd3318e78b58** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-RESEARCH.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-RESEARCH.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/02-orchestrator-harness/02-RESEARCH.md / phase-1-plan-05

- **8fa7067919d6eb67e54712468598fb721fe694e7216fa3c8ada1b22658718de5** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-SUMMARY.md / phase-1-plan-05

- **1131af752cf66979df989a1d0ae50770971262fbc8500807115d75a97cc7a82f** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-01-corpus-fetch-chunk-PLAN.md / phase-1-plan-05

- **2e18160a7abf8d290e2b9c8ece0f10b3172852cf5a868b7ff107e21f66574cfa** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-SUMMARY.md / phase-1-plan-05

- **58f117ca7a94e4ce7845940ac9165dcd99f8c792b8b7238b058553f969d6c45e** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-validator-gates-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-validator-gates-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-02-validator-gates-PLAN.md / phase-1-plan-05

- **36dbc15aa907555de605ea6f0c52ed1c958b52e5bd1a0d1d44d8f750108661a6** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-SUMMARY.md / phase-1-plan-05

- **95747a7180e9716c0ed002000dea02e3504075ddcd3bb13ede973a0c1f71d5d2** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-tool-design-worker-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-tool-design-worker-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-03-tool-design-worker-PLAN.md / phase-1-plan-05

- **18bc2a591e128be7a42568ab96b9e1e135b7ee5c0e96f7e534e1d19de19088c2** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-SUMMARY.md / phase-1-plan-05

- **49e8cd6fe40b28a26bb71bb32b813d2526728853f170f99454e158d4839280fc** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-swarm-pipeline-manifest-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-swarm-pipeline-manifest-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-04-swarm-pipeline-manifest-PLAN.md / phase-1-plan-05

- **518d79e05919f3d55d7f958fa44df72effa18af5742077559f952b235e5e693b** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-SUMMARY.md / phase-1-plan-05

- **7ef7d428b8d78ce093d3c2ccd2617b6b8bc0a060f32a773989e486018eba18c7** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-fallback-hand-written-tools-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-fallback-hand-written-tools-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-05-fallback-hand-written-tools-PLAN.md / phase-1-plan-05

- **0e9896320f7adc15c57899c27639a671480b85ad6cad591c98a62ef6e7969e89** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-RESEARCH.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-RESEARCH.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-RESEARCH.md / phase-1-plan-05

- **78426f3a45b900fc517fec10769073d1f3d63eb145da4bd9e094c224084f32ee** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-VERIFICATION.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-VERIFICATION.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/03-VERIFICATION.md / phase-1-plan-05

- **30aefec1f868c620dcd62f4877a8175b61998046449264e9fdbe959c6daa43b8** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/deferred-items.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/deferred-items.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/03-discovery-tool-design/deferred-items.md / phase-1-plan-05

- **439ec7d01cdf05720c9d8041312e64cd8a54ea143ea0eb9882854c37ae962121** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-SUMMARY.md / phase-1-plan-05

- **35fd4668422ce3340260f3ac4fd758e3cc2d8cb5a7939ffccc59e6bb49f09860** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-doc-split-types-personas-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-doc-split-types-personas-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-01-doc-split-types-personas-PLAN.md / phase-1-plan-05

- **f56576113684b032901f63c70e92ca05c43ecf119df6327a08eabe0a7d647852** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-SUMMARY.md / phase-1-plan-05

- **60ce4939520db007bd1dd5111e306bb3ac26a4a13038c8c09bbe8c429483b354** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-schema-gate-dedup-stratify-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-schema-gate-dedup-stratify-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-02-schema-gate-dedup-stratify-PLAN.md / phase-1-plan-05

- **8eeea57a88aef35f5020bf15abad90f597df463d98ff90726188038d4693a55b** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-SUMMARY.md / phase-1-plan-05

- **ddbb8c0215ee2be58ef3988a5964a46eb9c9dbcff3dca5850a78e43173a4cef9** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-data-gen-qa-worker-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-data-gen-qa-worker-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-03-data-gen-qa-worker-PLAN.md / phase-1-plan-05

- **80435c972f07340f4dcbe6dccbcdeea531bd4677e177281898295e156f61f3fa** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-SUMMARY.md / phase-1-plan-05

- **47f5667f946c358c6a79af5932757c68fc9cc558d36efce16d1db61dddc83115** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-data-gen-traj-worker-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-data-gen-traj-worker-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-04-data-gen-traj-worker-PLAN.md / phase-1-plan-05

- **6f3a6f5822d7b9ad758e55c3317b15f70fafe12bc9bf8858519b5fcdf5bd3298** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-SUMMARY.md / phase-1-plan-05

- **f6a62abcf5dade4a0a60f657af79623ab60162500fc955ad9a0f8b59530c8810** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-judge-pipeline-eval-emission-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-judge-pipeline-eval-emission-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-05-judge-pipeline-eval-emission-PLAN.md / phase-1-plan-05

- **17c403a39226cacd436aa971a25a7f4ce4ce39b656194f7aef60783f182f4901** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-PLAN-INDEX.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-PLAN-INDEX.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-PLAN-INDEX.md / phase-1-plan-05

- **7a9c3feb8b282eca08c73fe9b6b20a0ac29420f2d5c4a4949f9a82561f87f7ab** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-VERIFICATION.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-VERIFICATION.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/04-data-eval-gen/04-VERIFICATION.md / phase-1-plan-05

- **5ddd17bbe365c3b3c8945261f89346fb8c8f0c8a22f7b786d30e16106313697e** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-SUMMARY.md / phase-1-plan-05

- **7aceb3927124f1697658de6c9fc53f4f6bd711839abe39dd96fb384f82e822ce** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-and-version-bump-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-and-version-bump-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-and-version-bump-PLAN.md / phase-1-plan-05

- **f9e1b1cc77594c9a04d8b94013d8c4b65bfb91178b7fb97b84d3cacbfd15d36c** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-notes.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-notes.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-01-smoke-notes.md / phase-1-plan-05

- **2a60902302405c6019ed6d0f269344d83b9010b2a5a9c8b989189b4935c2ef26** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-SUMMARY.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-SUMMARY.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-SUMMARY.md / phase-1-plan-05

- **e0842b5a92369e80af022baed6ce0e07ff465a79f1f4649c6f7fbc43bdd032fc** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-training-scripts-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-training-scripts-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-02-training-scripts-PLAN.md / phase-1-plan-05

- **445cc531dc0866bb318d94240a2bf3c5db7202e79c26427262ecd859ff286131** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-03-supervisor-rollback-transform-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-03-supervisor-rollback-transform-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-03-supervisor-rollback-transform-PLAN.md / phase-1-plan-05

- **64d99322349425e4532d81c951ac2bdb01f3f91ae1b649332a8f1045c308967e** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-e2e-notes.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-e2e-notes.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-e2e-notes.md / phase-1-plan-05

- **1b535c6e637ef754ae0f0f9f8e18aa3de9fe8738fecd4e6666c4b9c5efef26d3** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-integration-e2e-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-integration-e2e-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-04-integration-e2e-PLAN.md / phase-1-plan-05

- **62a37d2d928144f5ed890a0d1ee6862837720b7628253c1ad38c5848b6d3603d** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-CONTEXT.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-CONTEXT.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-CONTEXT.md / phase-1-plan-05

- **bf35bc6f5ac33b7724aad6379b6a10566f34f4619c4d6f1d0bc7cfbac2b351e3** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-RESEARCH.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-RESEARCH.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/05-train-model-a/05-RESEARCH.md / phase-1-plan-05

- **7101971911e187ecec28fdc508d3fd7889c3b5298b42e1a9846564dcb9e96ba2** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-01-fuse-deploy-scripts-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-01-fuse-deploy-scripts-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-01-fuse-deploy-scripts-PLAN.md / phase-1-plan-05

- **25cf523de8359dcd5c96b7ed751bc8aa0ffc371593f74f634b25c2e7a9cd61e6** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-02-ios-chatview-statuspill-toolsloader-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-02-ios-chatview-statuspill-toolsloader-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-02-ios-chatview-statuspill-toolsloader-PLAN.md / phase-1-plan-05

- **0d877be301f74a80fea4ba72c4cf31e9899b6652d55412adc938f135622f197a** — `.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-03-verify-battery-cassette-PLAN.md#file=.planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-03-verify-battery-cassette-PLAN.md`
  - Purpose: Legacy planning-artifact locator retained as exact brownfield migration evidence.
  - Disposition/removal: archive / blocked
  - Owner: Phase 1 / legacy-planning-evidence-archive / reviewed=true
  - Coverage: requirements=IDEN-07; acceptance=AC-13
  - Evidence: none — removal remains blocked
  - Review: pending
  - Provenance: phase-1-controlled-git-and-source-snapshot / .planning/milestones/legacy-2026-04-pre-mlx-phases/06-fuse-deploy-verify-cassette/06-03-verify-battery-cassette-PLAN.md / phase-1-plan-05

## Exact exclusions

- `.planning/migrations/2026-07-15-legacy-planning-inventory.md` / product-string / historical-internal-record — Authoritative migration history is internal provenance rather than user-facing copy.
- `docs/MLX_PROJECT_SPEC.md` / product-string / authoritative-contract — The product contract may name forbidden historical identities only as explicit prohibitions.
