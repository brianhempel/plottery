#!/usr/bin/env bash
# Step 2: build the sdist and wheel into dist/. Uploads nothing.
# The wheel is built *from the sdist*, which proves the sdist has everything needed to rebuild it.
# Needs node/npm. Takes a few minutes: npm installs everything from scratch inside the unpacked sdist.
source "$(dirname "$0")/common.sh"

command -v npm >/dev/null || { echo "npm is needed to build the frontend." >&2; exit 1; }
TOOLS=$(tools_bin)

UNCOMMITTED=$(uncommitted_package_files)
if [[ -n "$UNCOMMITTED" ]]; then
  echo "Note: building with uncommitted changes (fine for testing; 5_publish.sh --pypi will refuse):"
  echo "$UNCOMMITTED"
fi

rm -rf "$DIST"
"$TOOLS/python" -m build --outdir "$DIST" "$REPO"

# Remember what this was built from, so 5_publish.sh can check it's publishing the current commit.
{ git -C "$REPO" rev-parse HEAD; echo "$UNCOMMITTED"; } > "$WORK/built-from.txt"

echo
ls -lh "$DIST"
echo "Built $(version). Next: scripts/release/3_check.sh"
