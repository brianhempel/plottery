#!/usr/bin/env bash
# Step 4: try the built wheel in a real browser, from the fresh venv 3_check.sh made. The automated
# checks can't tell whether the labextension actually loads and the UI works. Uploads nothing.
#   scripts/release/4_try_in_browser.sh            # JupyterLab
#   scripts/release/4_try_in_browser.sh notebook   # Notebook 7
# Any further arguments go to Jupyter, e.g. `... lab --port 8898 --no-browser`.
source "$(dirname "$0")/common.sh"

APP="${1:-lab}"
[[ -x "$WORK/test-venv/bin/jupyter" ]] || { echo "Run scripts/release/3_check.sh first." >&2; exit 1; }

# Not under src/, so `import plottery` can only find the installed wheel.
TRY_DIR="$WORK/try"
rm -rf "$TRY_DIR"
mkdir -p "$TRY_DIR"
"$WORK/test-venv/bin/python" - "$TRY_DIR/try_plottery.ipynb" <<'PY'
import sys
import nbformat as n
nb = n.v4.new_notebook(cells=[n.v4.new_code_cell(
    'import matplotlib.pyplot as plt\n\nfig, ax = plt.subplots()\nax.bar(["a", "b", "c"], [1, 3, 2])\nplt.show()')])
nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3 (ipykernel)", "language": "python"}
n.write(nb, sys.argv[1])
PY

echo "Opening Jupyter $APP from the test venv. Run the cell, then check that:"
echo "  - the Plottery UI appears, and clicking a layer shows its properties"
echo "  - the on-plot 'ax' menu adds a call (e.g. ax.axhline) to the code"
echo "  - dragging that line changes its number in the code, and the plot redraws"
echo "  - an argument's dropdown (e.g. its color) opens and rewrites the code"
echo "  - the New Plot button and the Plottery on/off toggle are in the toolbar"
echo "Ctrl+C to stop."
cd "$TRY_DIR"
exec "$WORK/test-venv/bin/jupyter" "$APP" try_plottery.ipynb "${@:2}"
