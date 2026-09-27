#!/usr/bin/env bash
# Step 3: check what's in dist/, then install the wheel into a fresh venv and render a plot through a
# real kernel, from a directory outside the repo. Uploads nothing.
source "$(dirname "$0")/common.sh"

TOOLS=$(tools_bin)
WHEEL=$(the_wheel)
SDIST=$(the_sdist)

echo "== Package metadata"
"$TOOLS/twine" check "$DIST"/*

echo "== Wheel contents"
WHEEL_FILES=$(unzip -Z1 "$WHEEL")
for f in plottery/__init__.py plottery/serialize.py plottery/visitor_mypy.py \
         plottery/static/plugin.js plottery/static/plottery.css \
         plottery/python-type-stubs-main/stubs/matplotlib/pyplot.pyi \
         plottery/python-type-stubs-main/LICENSE \
         share/jupyter/labextensions/plottery_jupyter/package.json \
         share/jupyter/labextensions/plottery_jupyter/install.json; do
  grep -q -- "$f\$" <<<"$WHEEL_FILES" || { echo "Wheel is missing $f" >&2; exit 1; }
done
if { echo "$WHEEL_FILES"; tar tzf "$SDIST"; } \
    | grep -E '\.(ipynb|csv|mp4|sqlite3|pages|zip|rb)$|python-type-stubs-main/(tests|utils)/|node_modules/|__pycache__|\.DS_Store'; then
  echo "Files above don't belong in the package." >&2
  exit 1
fi
echo "ok ($(wc -l <<<"$WHEEL_FILES" | tr -d ' ') files in the wheel)"

echo "== Fresh install into $WORK/test-venv"
find "$WORK/test-venv" -name .DS_Store -delete 2>/dev/null || true  # Finder's .DS_Store files can make rm -rf fail
rm -rf "$WORK/test-venv"
"$PYTHON" -m venv "$WORK/test-venv"
"$WORK/test-venv/bin/pip" install --quiet "$WHEEL[lab,notebook]"

echo "== JupyterLab sees the extension"
"$WORK/test-venv/bin/jupyter" labextension list > "$WORK/labextension-list.txt" 2>&1
grep -E "plottery_jupyter.*enabled.*OK.*plottery-ui" "$WORK/labextension-list.txt" || {
  cat "$WORK/labextension-list.txt"
  echo "The wheel didn't install the labextension." >&2
  exit 1
}

echo "== Render a plot through a real kernel"
TEST_DIR=$(mktemp -d)  # outside the repo, so `import plottery` can only find the installed wheel
(cd "$TEST_DIR" && XDG_CACHE_HOME="$TEST_DIR/cache" "$WORK/test-venv/bin/python" "$REPO/scripts/release/smoke_test.py")
rm -rf "$TEST_DIR"

echo
echo "All checks passed for $(basename "$WHEEL")."
echo "Next: scripts/release/4_try_in_browser.sh (checks the labextension in a real browser)"
