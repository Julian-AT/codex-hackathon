#!/usr/bin/env bash
set -euo pipefail
if [ ! -d ios/_upstream ]; then
  git clone --depth 1 https://github.com/ml-explore/mlx-swift-examples ios/_upstream
fi
mkdir -p ios/SpecialistApp
rsync -a --delete --exclude=".git" ios/_upstream/Applications/LLMEval/ ios/SpecialistApp/
echo "Bootstrapped. Open ios/SpecialistApp/ in Xcode 16 and confirm the scheme."
