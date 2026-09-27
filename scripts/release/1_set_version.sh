#!/usr/bin/env bash
# Step 1: set the release version. It lives only in src/plottery_jupyter/package.json;
# pyproject.toml reads it from there.
#   scripts/release/1_set_version.sh 0.1.0
source "$(dirname "$0")/common.sh"

if [[ $# -ne 1 ]]; then
  echo "usage: scripts/release/1_set_version.sh VERSION   (currently $(version))" >&2
  exit 2
fi
NEW=$1
(cd "$REPO/src/plottery_jupyter" && npm version "$NEW" --no-git-tag-version --allow-same-version >/dev/null)

echo "Version is now $(version). Commit it before building a release:"
echo "  git commit -m 'Version $NEW' src/plottery_jupyter/package.json src/plottery_jupyter/package-lock.json"
