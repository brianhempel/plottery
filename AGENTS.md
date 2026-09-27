# AGENTS.md

## Read `README.md` first

`README.md` is the canonical guide to this project (**Plottery**, an in-notebook graphical UI for Matplotlib). It covers install/run steps, the big-picture data flow, the repo layout, the Python ↔ TypeScript split, and detailed UI-interaction walkthroughs (§9). Start there — most "how does this fit together?" questions are answered in it.

Quick orientation (details in `README.md`):

- `src/plottery/` — Python package: rendering, mypy type inference, hover regions, serialization (core in `__init__.py`).
- `src/frontend/` — TypeScript UI, bundled by Vite → `src/plottery/static/plugin.js` + `plottery.css` (entry `attach_plottery()` in `main.ts`). Every `.css` file must be imported by its `.ts` module (`import "./foo.css";`) or it's left out of the bundle.
- `src/nbextension_plottery/` — browser extension for classic Jupyter Notebook v6.
- `src/plottery_jupyter/` — browser extension for JupyterLab / Notebook v7.
- `pyproject.toml`, `scripts/release/` — the `plottery-ui` PyPI package and its build/check/publish scripts (README "Releasing to PyPI"). Never run `5_publish.sh` yourself.

## No Outer-Level const/let in Typescript

Because the Javascript is re-injected on every cell run, you cannot use `const` or `let` at any global scope. Otherwise the user will get "Identifier 'xyz' has already been declared" and the new code will not run.

## Matplotlib

To answer questions about Matplotlib's internals, reference its current source at `pip show matplotlib | grep Location:`.

## Build

| Change you made | How to rebuild |
|---|---|
| `src/frontend/` (TS/CSS) | `npm run watch-ts` (rebuilds on save) or `npm run build-ts` (one-shot) |
| Notebook v6 extension (`src/nbextension_plottery/`) | `npm run build` (installs + enables the nbextension and builds the bundle) |
| JupyterLab extension (`src/plottery_jupyter/`) | `npm run install-labextension` |
| Packaging (`pyproject.toml`, what goes in the wheel) | `scripts/release/2_build.sh`, then `scripts/release/3_check.sh` |

There is **no automated test suite**. Verify changes by exercising the live UI (below).

## UI testing

Plottery only exists as the interactive output of a Jupyter cell, so "testing" means running Jupyter and driving the rendered UI in a browser.

### 1. Make sure your change is actually live

- **Frontend (`src/frontend/`):** keep `npm run watch-ts` running, then **re-run the plot cell**. The JS bundle is re-inlined into the cell output on every manual run, so a cell re-run is enough to pick up TS/CSS changes — no Jupyter restart needed.
- **Python (`src/plottery/`):** `plottery` is imported once at kernel start, so **restart the kernel** and re-run the cell to pick up changes.
- **Extensions (`nbextension_plottery` / `plottery_jupyter`):** rebuild (`npm run build` / `npm run install-labextension`), then hard-reload the browser page.

### 2. Start Jupyter in the background

```bash
OPENAI_API_KEY=$OPENAI_API_KEY jupyter notebook --no-browser --port 8888
```

Then get the tokenized URL the browser needs:

```bash
jupyter notebook list
# -> http://localhost:8888/?token=abc123...
```

Use `jupyter lab` instead to test the JupyterLab build. If `OPENAI_API_KEY` is unset the AI panel is simply hidden (fine unless you're testing AI prompts).

### 3. Render a plot

In the browser, open the tokenized URL, then make a cell that ends in `plt.show()` (click the **New Plot** toolbar button for starter code, or create a new notebook). A self-contained smoke test that doesn't depend on any data files:

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.bar(["a", "b", "c"], [1, 3, 2])
plt.show()
```

Run it with Shift+Enter; the Plottery UI renders in the cell output. (Most demo notebooks under `src/` rely on local data — prefer the snippet above.)

> **Put the test notebook in `src/`.** The nbextension boots the kernel with a bare `import plottery` and no `sys.path` setup, and a kernel's working dir is its notebook's folder — so the notebook must sit next to `src/plottery/`. In a notebook elsewhere (e.g. the repo root), plots render as plain Matplotlib with a "Plottery could not be loaded in this kernel" message instead of the UI (unless `plottery-ui` is pip-installed in that environment).

### 4. Exercise the UI and verify

Exercise these with the UI tools below and screenshot the result (see `README.md` §9 for the expected behavior of each):

- **Layers panel:** click a layer → its args appear in the Properties panel and the matching shape highlights on the plot.
- **Drag a shape or its edges** → the relevant number in the cell's code updates and the plot redraws.
- **Argument dropdown:** open it → suggestions appear; hovering previews live; selecting rewrites the code.
- **On-plot ＋ buttons** → a new method call (e.g. `ax.set_title(...)`) is inserted into the code.
- **AI panel** (needs the key) → type a prompt, press Enter, confirm the cell code changes and re-renders.

The core invariant is **the code is the ground truth**: after any GUI action, the cell's Python source must change to match, and re-running that source must reproduce the same plot. Check the editor text, the plot image, and the browser console for errors.

#### UI Testing Tools

Cursor's browser use tools do not expose the DOM at fine enough granularity. Launch the user's system Chrome with --remote-debugging-port=9222 and drive it over Chrome Devtools Protocol (CDP), using the tools below.

These tools are provided in ui_testing_tools/*.js:

node ready.js - poll until CDP is reachable (up to 10s), then print targets JSON

node screenshot.js [OUT_PATH.png] - takes a screenshot (default: cdp_screenshot.png)

node eval.js 'document.title' - run JS in the renderer, print result as JSON

node click.js '.my-selector' - click an element by CSS selector
node click.js 500 300 - click at x,y coordinates

node type.js 'hello' - type text into the focused element
node type.js --key Enter - press a special key (Enter, Escape, Tab, ArrowUp/Down/Left/Right, Backspace, Delete, Space)

node wait_for.js '.my-selector' [timeout_ms] - wait for a CSS selector to appear (default timeout: 10s)

node cursor.js 5 - move editor cursor to line 5 (uses Ctrl+G)

node visible.js '.my-selector' - check if element is in viewport (exit 0=visible, 2=offscreen, 1=not found)

node scroll.js '.my-selector' - scroll element into view
node scroll.js down [pixels] - scroll the page down (default 300px)
node scroll.js up [pixels] - scroll the page up (default 300px)

node cdp_send.js Domain.method '{"param":"value"}' - send arbitrary CDP command (e.g. for mouse move/press/release sequences that click.js can't do, like node cdp_send.js Input.dispatchMouseEvent '{"type":"mouseMoved","x":100,"y":200}')

#### CDP workflow

1. Launch the user's Chrome with a **dedicated** `--user-data-dir` so it actually opens the debug port. Reusing the default profile just opens a tab in the already-running Chrome with **no** debug port:

        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
          --remote-debugging-port=9222 --user-data-dir=/tmp/plottery-cdp \
          --no-first-run --window-size=1400,1000 \
          --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
          "http://localhost:8888/notebooks/src/<nb>.ipynb?token=..."

   Let the shell background it (no `nohup &`). Clean up later with `pkill -f /tmp/plottery-cdp`, which leaves the user's normal Chrome untouched.

   Keep the two `--disable-*backgrounding*` flags. Without them, once other windows cover the Chrome window, macOS reports the page as hidden and Chrome pauses `requestAnimationFrame`. Plottery syncs GUI edits into the code on animation frames, so drags and widget changes then silently never reach the code, even though handlers still fire and cursors still arm. If edits aren't landing, check `node eval.js 'document.visibilityState'`.
2. `node ready.js` — wait for CDP and confirm the notebook is the `page` target.
3. A fresh kernel has no live UI yet, so **run the cell**, then wait for the UI:

        node eval.js 'Jupyter.notebook.execute_cells([0])'
        node wait_for.js '.plottery-layers-panel' 40000

4. Check the code-is-ground-truth invariant anytime with `node eval.js 'Jupyter.notebook.get_cell(0).get_text()'`.

**Targeting:** derive coordinates from `getBoundingClientRect()` (via `eval.js`, `visible.js`, or `click.js '.selector'`, which clicks an element's center) — **not** from screenshot pixels. The captured PNG is scaled relative to the CSS-pixel space that CDP mouse events use.

#### Dragging a shape (use `cdp_send.js`)

`click.js` can't drag, and a drag needs an *arming hover* first: each hover region picks its handler (x / y / edge) from cursor proximity inside its own `mousemove` listener. Dispatch in order:

1. `Input.dispatchMouseEvent {"type":"mouseMoved","x":X,"y":Y}` onto the shape to arm the handler. The edge zone is `min(10, dim/4)`px, so hover within ~4px of an edge to get a resize instead of a move. Confirm via the region's `style.cursor` (`row-resize` / `ew-resize` / `move`).
2. `mousePressed` at the same point.
3. several `mouseMoved` with `"buttons":1` toward the target.
4. `mouseReleased`.

Overlapping regions intercept by z-order (`fig` / `ax` span the whole plot; a freshly-added `axvline` can sit on top of a bar). Use `document.elementFromPoint(x, y)` to confirm what's on top and target a non-occluded shape.

#### Key DOM hooks (for CDP selectors)

- `.plottery-layers-panel`, `.plottery-layer` — layer rows (includes a hidden `.plottery-code-layer` per import/blank line).
- `.plottery-properties-panel`, `.plottery-args` — the selected call's argument rows/widgets.
- `[data-call-id]` — hover-region `<g>` on the plot (also carries `data-artist-name` and `data-*-bounds`).
- `.plottery-method-view` — on-plot ＋ buttons/menus; **only visible while the plot is hovered** (`.plot_area:hover`), so move the mouse over the plot first. `.plottery-menu-item` are the items inside an opened menu.
- `.plot_area img` (plot PNG), `.hover_regions` (SVG overlay), `.stdout_stderr` (renders kernel error text — check it after an action).

Note: a click on a plot object is swallowed while an argument **dropdown drawer is open** — send `node type.js --key Escape` first.

### 5. Cleanup

Stop the background Jupyter process (and `npm run watch-ts`) when you're done.
