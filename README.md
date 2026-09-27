# Plottery

Plottery is an in-notebook graphical interface for Matplotlib (MPL). Instead of a static image, with Plottery `plt.show()` produces a rich graphical interface that lets you add plot elements, drag and resize shapes, tweak plot arguments with live preview, and prompt an LLM to make changes. All changes are written to the code live—the code is the ground truth—and code editing is supported at any time.

Plottery is described in our paper...

Brian Hempel, Ruanqianqian (Lisa) Huang, Devamardeep Hayatpur, Sorin Lerner, and Haijun Xia. *Plottery: A Code-Integrated GUI for Matplotlib.* VL/HCC 2026.

...but should also be plausibly usable. See install instructions below.

## Video Figure From Paper

![Plottery Video Figure](https://plottery.org/assets/Plottery%20Video%20Figure.mp4)

## Install

```
pip install plottery-ui
```

Install it into the environment you run Jupyter from (JupyterLab 4 or Notebook 7). To install JupyterLab along with it, use `pip install "plottery-ui[lab]"`. Then start Jupyter and any cell that calls `plt.show()` shows the Plottery UI. The **Plottery** toggle in the notebook toolbar turns it off.

If your notebook's kernel runs in a different Python environment than Jupyter itself, install `plottery-ui` into the kernel's environment too. Otherwise plots appear as ordinary Matplotlib images, with a message saying so.

To avoid having to type your LLM provider's API key on the front-end, set an LLM API key (e.g. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) in the environment you start Jupyter from.

## Development setup

### Setup Python packages.

Create a virtual environment (recommended).

```
python3 -m venv .venv
source .venv/bin/activate
```

Install Python packages.

```
pip install -r requirements.txt
```

Install node packages.

```
npm install
```

The **JupyterLab / Notebook v7** extension has its own npm package; install its dependencies too.

```
cd src/plottery_jupyter
npm install
cd ../..
```

Build and install the extension. This will build the **JupyterLab / Notebook v7** labextension and copy it into Jupyter's `labextensions/` directory:

```
npm run build
```

For **classic Jupyter Notebook (v6)**, `npm run build-nbv6` installs + enables the nbextension:

```
npm run build-nbv6
```

While developing the frontend, `npm run watch-ts` rebuilds `src/plottery/static/plugin.js` and `plottery.css` on change. The bundle is re-inlined into the output on each manual cell re-run, so you just re-run the cell to pick up changes.

Test it by opening jupyter and running `src/plottery.ipynb`.

```
OPENAI_API_KEY=your_key jupyter notebook
```

If `OPENAI_API_KEY` is not provided, the AI panel will not show.

It should also work in Jupyter Lab:

```
OPENAI_API_KEY=your_key jupyter lab
```

If making screenshots, set `window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')`. This whitens the background, remove the execution counts and cell selection styling, and recenters the Plottery UI.

```javascript
%%javascript
window.sessionStorage.removeItem('make_stuff_nice_for_screenshots')
window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')
```

If making videos, set `in_demo_mode`. In addition to adding the `make_stuff_nice_for_screenshots` styling, this will make the plot slightly smaller and will surpress some distracting errors and warnings from Matplotlib.

```javascript
window.sessionStorage.removeItem('in_demo_mode')
window.sessionStorage.setItem('in_demo_mode', 'true')
```

## Releasing to PyPI

`pip install plottery-ui` installs a wheel holding the `plottery` Python package (with the built frontend in `src/plottery/static/` and the type stubs), plus the built JupyterLab extension, which pip puts in `<env>/share/jupyter/labextensions/plottery_jupyter/` where JupyterLab 4 and Notebook 7 find it. `pyproject.toml` describes the package; the scripts in `scripts/release/` build, check, and publish it, one step each. Only `5_publish.sh` uploads anything, and only when told where.

**One-time setup:** make accounts on [PyPI](https://pypi.org/account/register/) and [TestPyPI](https://test.pypi.org/account/register/) (they're separate), create an API token on each, and put them in `~/.pypirc`:

```ini
[pypi]
username = __token__
password = pypi-...

[testpypi]
username = __token__
password = pypi-...
```

**Each release:**

1. `scripts/release/1_set_version.sh 0.1.0`, then commit the version bump. The version lives only in `src/plottery_jupyter/package.json`.
2. `scripts/release/2_build.sh` builds the sdist and wheel into `dist/` (needs node/npm; a few minutes).
3. `scripts/release/3_check.sh` checks the package contents, installs the wheel into a fresh venv, and renders a plot through a real kernel.
4. `scripts/release/4_try_in_browser.sh` (or `... notebook`) opens Jupyter from that venv so you can try the UI by hand. This is the only check that the JupyterLab extension actually loads.
5. `scripts/release/5_publish.sh --testpypi` uploads a practice copy and prints the command to install it from TestPyPI. Try that in a fresh venv on another machine if you can.
6. `scripts/release/5_publish.sh --pypi` publishes for real. It refuses unless you're on `main` and `dist/` was built from the current commit with nothing uncommitted, asks you to type the version to confirm, then tags the commit `v<version>` locally. Push the tag with `git push origin v<version>`.

PyPI never lets you reuse a version number, even after deleting a release, so a broken upload means bumping the version (step 1) and starting over.

---

The remaining sections below are a technical explanation of Plottery's operation.

## 1. Big picture & data flow

There are roughly three technical parts.

1. Jupyter/JupyterLab extension (`src/nbextension_plottery/main.js` / `src/plottery_jupyter/plottery_jupyter.js`) sets up three things: (a) automatic `import plottery` so user does not have to do anything to access Plottery (if the kernel can't import it, the labextension defines a stand-in `plottery` whose `show()` just calls `plt.show()` and prints why, so plotting cells still work), (b) adds a "New Plot" button and a "Plottery On/Off" toggle to the interface (off = ordinary matplotlib: no `plt.show()` rewrite, `plottery.set_enabled(False)` in the kernel, and every Plottery output stripped to its plain PNG so none of it is saved; the setting is in `localStorage`), and (c) sets ups a cell code rewriter to change `plt.show()` to `plottery.show()` (stashes the figure instead of showing it) and append `plottery.show_ui()` to the end of the cell (which actually shows the figure and UI). The JupyterLab version also lifts some Jupyter and CodeMirror modules to globals so we can reference them later.
2. The Python backend (`src/plottery/`) gathers all the information required to build the UI (function arguments and types via mypy, which user variables are type compatible with which arguments, the user's names for axes etc, and the regions where MPL shapes are on the plot).
3. The Typescript frontend (`src/frontend/main.ts`) builds the UI, attaches layer "marks" to text regions of the code editor, and coordinates event handling.

```
                  Jupyter browser extension                    Python kernel
                  (nbextension OR labextension)
  kernel    ───►  tells Python kernel to import plottery  ───► import plottery
  startup                                                      plottery adds an AST rewriter that, on
                                                               each cell execution, wraps function
                                                               calls with logging code to set
                                                               _plottery_came_from_call_id on the call
                                                               results so we know which MPL shapes
                                                               came from which calls.

  user runs ───►  rewrites the cell code:                 ───► the AST rewritter adds call logging
  a cell          plt.show(...)  →  plottery.show(...)         plottery.show(...) stashes the figure
                  also appends plottery.show_ui(fig_idx=N)     plottery.show_ui() builds a `Plottery` object
                  to end of cell                               that has a ._repr_html_() function
                                                               that builds the Plottery UI and bundles its
                                                               Javascript and styles. It returns one big
                                                               HTML blob: <img> of the plot,
                                                               an SVG of "hover regions", the inlined
                                                               built JS and CSS (static/),
                                                               and a <style onload="attach_plottery(...serialized
                                                               types/calls/AST...)"> that triggers the
                                                               Javascript to initialize the UI
  attach_plottery() builds the UI ◄─────────────────────────────────────────────────────────┘

  later, on GUI edit:
  frontend edits CodeMirror text ─► re-executes the cell with a trailing
  plottery.show_ui(plottery_class=PlotteryFigureOnly|PlotteryFigureAndHoverRegions) ─►
  kernel returns a new PNG (and potentially SVG hover regions) over iopub ─►
  frontend swaps the <img>/<svg> in place (no full re-render unless needed)
```

---

## 2. Repo layout (the files that matter)

| Path | What it is |
|------|------------|
| `src/plottery/__init__.py` | **The Python core** (the `plottery` package). Rendering, type inference, hover regions, provenance, serialization, the `Plottery` output object classes, `show()` / `show_ui()`. |
| `src/frontend/` | The actual UI (TypeScript, built with Vite → `src/plottery/static/plugin.js` and `plottery.css`). Entry point is `attach_plottery()` in `main.ts`. |
| `src/nbextension_plottery/main.js` | Browser extension for **Jupyter Notebook (classic, v6)**. |
| `src/plottery_jupyter/` | Browser extension for **JupyterLab / Jupyter Notebook v7** (its own npm package + build). |
| `src/plottery/serialize.py` | Turns arbitrary Python/mypy object graphs into JSON (`arbitrary_to_json`). Inverse of the frontend's `deserialize.ts`. |
| `src/plottery/visitor_mypy.py` | A `TraverserVisitor` over mypy AST nodes (vendored/derived from mypy). Used to walk typed calls. |
| `src/plottery/python-type-stubs-main/` | Our fork of Microsoft's `.pyi` type stubs (matplotlib, numpy, etc.). These determine the arguments in the Properties panel for each MPL call. |
| `vite.config.js`, `tsconfig.json`, `package.json` | Frontend build + the `npm run` scripts that install/enable the extensions. |
| `pyproject.toml`, `scripts/release/` | The `plottery-ui` PyPI package and the scripts that build, check, and publish it (see Releasing to PyPI above). |
| `requirements.txt` | Python deps for development. Only `mypy` is capped, to tested minors (Plottery drives mypy's internal, unstable API). `matplotlib>=3.11` because the bundled stubs and method tables describe 3.11; newer versions work with slightly-off types. |
| `src/see.py` | `See(...)` — a dev-only HTML object inspector for poking at values in the notebook. Not part of the product flow. |
| `src/*.ipynb`, `study_2_*/`, `*.rb` | Demo notebooks and user-study data/analysis. Not part of the tool. |

---

## 3. The two browser extensions (and why there are two)

Jupyter Notebook v6 (classic) and JupyterLab/Notebook v7 have different frontend APIs, so Plottery ships the same behavior twice. They do the same three jobs:

1. **`import plottery`** automatically whenever the kernel (re)starts.
2. **Rewrite `plt.show(...)`** in any executed cell into a `plottery.show(...)` call that also forwards the notebook context the kernel can't otherwise see.
3. **Append `plottery.show_ui(fig_idx=N)`** to the cell so the rich UI is produced as the cell's output, and add a **"New Plot"** toolbar button with starter code.

The rewrite (identical logic in both) looks for `plt.show` / `matplotlib.pyplot.show` / aliased imports and turns:

```python
plt.show()
```

into:

```python
plottery.show(globals() | locals(), cell_lineno, plt_show_lineno_in_cell,
              provenance_is_off_by_n_lines, "<entire notebook code through this cell>")
last_plottery = plottery.show_ui(fig_idx=0)   # appended
last_plottery
```

`plottery.show()` needs `notebook_code_through_cell` because the IPython kernel only ever sees one cell at a time, but type inference needs the whole notebook so far.

### How they differ

| | `src/nbextension_plottery/main.js` | `src/plottery_jupyter/plottery_jupyter.js` |
|---|---|---|
| Target | Jupyter Notebook classic (v6) | JupyterLab / Notebook v7 |
| Module system | RequireJS AMD (`define([...])`), entry `load_ipython_extension` | ES module exporting a `JupyterFrontEndPlugin` (`activate`) |
| Notebook access | global `Jupyter.notebook` / `IPython` | `INotebookTracker` injected by Lab |
| Hooks the rewrite via | listens to `execution_request.Kernel` event; monkeypatches `IPython.CodeCell.prototype.execute` to know the running cell | monkeypatches `kernel.sendShellMessage` and inspects `execute_request` messages |
| Per-cell UI state (`fig_idx`) | read from the cell DOM `output_area … dataset.fig_idx` | read from `sessionStorage` key `cell-<id>-plottery-<key>` |
| Editor it drives | CodeMirror **5** | CodeMirror **6** — so it stashes CM6 classes on `window` (`__CM6EditorView`, `__CM6Decoration`, `StateField`, …) and Lab classes (`__JupyterCodeCellModule`, `__JupyterNotebookActionsModule`) for the Plottery frontend to use |
| Build | none — plain JS, installed via `jupyter nbextension install/enable` | its own npm package; `jupyter-builder build` → `src/plottery_jupyter/labextension`, then copied into Lab's `labextensions/` (development) or shipped in the `plottery-ui` wheel |

Both also pass a `doesnt_need_plottery_show_ui` flag through: when the frontend triggers a re-execute that already includes its own `plottery.show_ui(...)` (e.g. a fast figure-only redraw), the extension must not append a second `show_ui`.

The frontend itself (`src/frontend/`) is shared by both — it's injected into the page by Python (see §5), not by the extensions. The extensions only handle code rewriting of `plt.show()`, kernel bootstrapping, and the toolbar button.

---

## 4. Python vs. frontend — who does what

| Concern | Where |
|---------|-------|
| Rewriting `plt.show` → `plottery.show` / appending `show_ui` | **Browser extension** (`main.js` / `plottery_jupyter.js`) |
| Rendering the plot to PNG / SVG hover-regions | **Python** (`Plottery*._repr_png_` / `_repr_svg_`) |
| Type inference (what args a call takes, their types) | **Python** (mypy, in `plottery/__init__.py`) |
| Provenance: which MPL shapes came from which line of code | **Python** (IPython AST transformer + `tag_with_call_provenance`) |
| Serializing types/calls/AST to JSON for the UI | **Python** (`serialize.py` + `plottery/__init__.py`) |
| Building the UI, widgets, drag handlers, layers, AI panel | **Frontend** (`src/frontend/`) |
| Mapping a drag/GUI change back to a code edit | **Frontend** writes into CodeMirror, then asks the kernel to re-render |
| Coordinate math (plot pixels ↔ data values) | **Frontend**, using `data-*-bounds` attributes Python writes onto the SVG |
| Talking to the LLM | **Frontend** (`utils/llm.ts`); key comes from `OPENAI_API_KEY` env, passed through to `attach_plottery` |

---

## 5. Python backend (`src/plottery/`)

`src/plottery/__init__.py` is imported into the kernel as the module `plottery`. Highlights, in rough order:

- **`show(locals, cell_lineno, …, notebook_code_through_cell)`** — replacement for `plt.show()`. Just stashes the current figure + context into `cell_figs`. Returns nothing (so multiple `show()`s in a cell are fine; only the one is surfaced).
- **`show_ui(fig_idx=0, plottery_class=Plottery)`** — pops one of the stashed figures and returns an instance of one of the render classes. `plottery_class` controls how much work is done:
  - **`PlotteryFigureOnly`** — just `_repr_png_()`. Used for fast live redraws during drags (it even drops DPI mid-drag, capping at ~1000px wide).
  - **`PlotteryFigureAndHoverRegions`** — adds `_repr_svg_()`, the interactive overlay with clickable shapes on the plot. Builds a map of artist→name and computes per-artist bounding regions (`regions2`).
  - **`Plottery`** (the default, full) — additionally runs **mypy inference**, gathers typed **`calls`**, available **`methods`** on each artist, the typed **AST**, parseable **comments**, and user-defined iterable variables. Its **`_repr_html_()`** assembles the final output: the plot `<img>`, the hover-region `<svg>`, an inlined `<script>` of `static/plugin.js`, `static/plottery.css` inlined, and a `<style onload="attach_plottery(...)">` that hands every serialized blob to the frontend.
- **Provenance tracking** — at import time, `plottery` installs an IPython AST transformer (`IPython.get_ipython().kernel.shell.ast_transformers = [RootProvenanceTagger()]`). It wraps every call result in `plottery.tag_with_call_provenance(value, "ax.plot #1")`, attaching `_plottery_came_from_call_id` to the returned objects (including tuple/str/list/int/float/etc, using special included `Tagged*` subclasses). That id is later written onto the SVG regions (`data-call-id=...`) so the frontend can map a clicked region to the source call.
- **Variable-sharing provenance** — the same transformer also tracks how a value reached a matplotlib argument through variable bindings, so the Properties panel can show an editable chain like `w2 ▸ w1 ▸ 0.5`. It attaches a nested `_plottery_provenance` node to values at each binding (`plottery.tag_with_var_provenance` on assignment RHSes and same-cell user-function arguments), and at each matplotlib call site reads the argument's provenance into a global `var_provenance_at_call` log keyed by `(call_id, arg_key)` (`plottery.note_arg_provenance`). `plottery.show()` snapshots that log per figure; `GatherTypedCalls` looks it up per argument and serializes it (converted to notebook coordinates) as `given_arg["provenance"]`.
- **`serialize_type` / `GatherTypedCalls`** — convert mypy types and call sites into the JSON the widgets need (arg names, kinds, types, defaults, source positions).
- **Helpers worth knowing:** `serialize.arbitrary_to_json` (generic object-graph → JSON with id-based cycle handling), `artist_names` (names every matplotlib artist for the UI), `methods_for` / `method_associations` (which possible new function calls to offer on which artist, for on-plot buttons/menus).

---

## 6. Type inference with mypy

Plottery needs accurate argument types to choose the right widget (slider vs color picker vs dropdown of literals vs free code). It does this by running mypy not as a type *checker*, but as a *type oracle*.

`do_mypy_inference(code)` in `plottery/__init__.py`:

- Writes the whole notebook-so-far to a temp file `__plottery_mypy_temp.py`. This is so the file is in the same place on the filesystem as the user's notebook. Currently, the file is also left on disk for debugging.
- Builds a **fine-grained incremental** mypy build and caches it across cell runs; it only does a full rebuild when the set of `import` lines changes (cheap edits reuse the cache).
- Sets options tuned for *inference over checking*: `export_types`, `preserve_asts`, `check_untyped_defs=True` (so bodies of user functions get inferred), and `ignore_errors=True` (type errors in the user's code must not break the tool).
- Points `mypy_path` at the bundled stubs (see §7).

The result exposes `mypy_result.types` (expression → type) and `.graph` (the typed module tree), which `GatherTypedCalls` and `serialize_type` walk to produce `calls`, `methods`, and `notebook_typed_ast`.

---

## 7. Type stubs (`src/plottery/python-type-stubs-main/`)

An updated copy of **Microsoft's `python-type-stubs`** repo — `.pyi` files describing the public API of matplotlib, numpy, scipy, sklearn, networkx, etc. mypy reads these (via `options.mypy_path = ".../python-type-stubs-main/stubs"`) to know, e.g., that `Axes.bar(x, height, width=..., color=...)` takes a color, an array-like, etc., so the UI can render the right control. Only the `stubs/` subtree is used at runtime; the rest (`tests/`, `utils/`, its own README) is upstream baggage, and is left out of the PyPI wheel. Also includes types for potentially irrelevant projects.

---

## 8. Frontend (`src/frontend/`)

TypeScript, bundled by **Vite** (`vite.config.js`) from `src/frontend/main.ts` into `src/plottery/static/plugin.js` and `plottery.css`. Each module imports its own `.css` file (`import "./foo.css";`); a CSS file nothing imports is left out of the bundle. It is not loaded by the Jupyter extensions. The Python `Plottery` class's `_repr_html_()` result bundles the Javascript inline (on every manual cell re-run) for faster dev cycles.

- **`main.ts`** — exposes `window.attach_plottery(...)`. Given the cell element plus all the serialized blobs from Python, it builds the `State`, wires up the sidebar, AI panel, layers panel, plot widgets, hover-region drag handlers, selection sync, and keyboard shortcuts.
- **`code_sync/code_sync.ts`** — the heart of "GUI change → code change → re-render". It writes generated code into CodeMirror "marks" (the regions of code that correspond to layers), then runs the cell again via the right kernel API (CM5/Notebook vs CM6/Lab) with a trailing `show_ui(plottery_class=…)`, and swaps the returned PNG/SVG in place. Has `redraw_cell` (fast PNG), `refresh_hover_regions` (SVG overlay), and `hard_rerun` (full re-execute, used after AI/structural edits).
- **`sidebar/`** — the inspector. `call/call.ts` (one matplotlib call + its plot-drag → arg mapping), `arg/arg.ts` (one argument row), `methods/method.ts` (insert a new method call from an on-plot button/menu), `hover-regions/hover_regions.ts` (the SVG overlay: select/drag/add-method), `plot-widget/plot_widget.ts` (inline on-plot text editing).
- **`sidebar/widgets/`** — the typed controls, chosen from mypy types by `widget.ts`: `code_and_control` (primary scalar control: a code box synced to a slider/toggle/picker), `int`, `float`, `bool`, `color`, `literal` (enum-like values), `alias`, `arbitrary_code` (freeform Python fallback), and `dropdown` (picks among alternatives).
- **`layer_panel/layer_panel.ts`** — a structural list of the cell's code, one row per typed AST node (and parseable comments), with reorder-by-drag and show/hide (comment/uncomment) toggles.
- **`properties_panel/properties_panel.ts`** — pops the selected call's args out next to the plot.
- **`ai_panel/ai_panel.ts`** — natural-language editing; builds a prompt from the code so far, calls the LLM, replaces the cell text, `hard_rerun`s, and highlights changed lines. Hidden unless `OPENAI_API_KEY` is set.
- **`menus/menus.ts`** — reusable dropdown-menu + keyboard-shortcut framework.
- **`utils/`** — `types.ts` (a `Cell` abstraction that papers over CM5/Notebook vs CM6/Lab), `deserialize.ts` (rebuilds Python's id-based JSON graphs into JS objects — inverse of `serialize.py`), `llm.ts` (OpenAI client), `instrumentation.ts` (study logging to `localhost:7777`, received by `usage_events.rb`; off unless `window.localStorage.setItem('plottery_study_logging', 'true')`), `misc.ts`, `stdlib.ts`, and a vendored CodeMirror 5 `codemirror/` type-defs folder.
- **`types.ts` / `ast_types.ts`** — app domain types and a (largely unused) mirror of Python `ast` nodes.

---

## 9. Detailed UI interaction walkthroughs

This section traces what happens for common interactions. All paths below are under `src/frontend/`.

### Shared infrastructure (assumed by every walkthrough below)

**The `State` object (`types.ts`).** A single `State` is built by `attach_plottery()` for each rendered Plottery cell and handed to almost every function — it holds the only references to the live DOM and the editor, so "do X to the plot" almost always means "call something with `state`." Its fields fall into three groups:

- *Static inputs from Python* (set once, at build): `cell` (the CM5/CM6-agnostic `Cell`, see §8), `cell_lineno` / `plt_show_lineno_in_cell` / `provenance_is_off_by_n_lines` (used to map notebook line numbers ↔ in-cell line numbers), `calls` / `calls_with_args`, `methods` / `methods_with_code`, `notebook_typed_defs`, `user_iterables`, `avoid_names` (names already in use, for `non_colliding_name`), and `llm_api_key`.
- *Mutable runtime state*: `last_cell_code_executed` and `outstanding_kernel_request_time` (drive the busy/changed checks below), `dragging_layers` (the in-flight layer drag), and `is_in_dom()` — flips to `false` after a hard rerun, which is how the per-piece change watchers know to stop their `requestAnimationFrame` loop.
- *View handles*: `plottery_outer`, `plot_area` (the plot `<img>` lives here), `stdout_stderr`, `hover_regions_container` + `hover_regions_svg()` / `set_hover_regions_html()`, `plot_widgets`, `sidebar_el`, `layers_panel`, `properties_el`, and `command_shortcuts` (the keymap).

**Per-cell persistent storage (`get_persistent_item` / `set_persistent_item`, `utils/misc.ts`).** A cell re-run rebuilds the entire UI DOM, so a little UI state has to be persisted as strings, keyed per cell, with two backends: on **Notebook v6** the cell's `.output` element `dataset` (classic cells can lack stable ids); on **JupyterLab** `sessionStorage` under `cell-<sharedModel.id>-plottery-<key>` (the labextension reads the same keys). Only three keys exist:

- `fig_idx` — which stashed figure this cell renders; read into the `plottery.show_ui(...)` postfix on every redraw.
- `selected_calls` — the selected layers (keyed by `call_id`); written by `save_selected_layers`, restored by `load_selected_layers` so selection survives a redraw.
- `new_calls` — ids of just-inserted calls, so `main.ts` can auto-select/focus them after the next rebuild, then clears the key.

**The kernel request/response contract (`kernel_execute`, `code_sync.ts`).** Every kernel path funnels through `kernel_execute(code, postfix, on_iopub_output, on_shell_reply, state)`, which papers over v6 vs. Lab:

- **Notebook v6**: `cell.kernel.execute(code + postfix, callbacks, opts)` with `callbacks.iopub.output` / `callbacks.shell.reply` set to the two handlers. `opts` carries `doesnt_need_plottery_show_ui: true` (so the extension won't append a *second* `show_ui`) and `cell` (which the nbextension strips back off before anything reaches Python, to avoid "message too large" crashes).
- **JupyterLab**: `kernel.requestExecute({ code: code + postfix, … }, false, metadata)`; the returned `future`'s `.onIOPub` / `.onReply` get the same two handlers, with `doesnt_need_plottery_show_ui` riding along in `metadata`. Both backends use `store_history: false`, `stop_on_error: true`.

Replies come back as `CellMessage`s (typed in `utils/types.ts`), dispatched on `msg.header.msg_type`:

- the **rendered plot** is an `execute_result` whose `content.data["image/png"]` is base64 — the frontend just sets `img.src = "data:image/png;base64," + …`; hover-region refreshes additionally read `content.data["image/svg+xml"]`.
- `status` / `execute_input` (Lab-only chatter) are swallowed.
- everything else goes to `handle_error_or_stdout_stderr`: `error` → `content.evalue`, `stream` → `content.text`, appended to `state.stdout_stderr`, with line numbers shifted back by `provenance_is_off_by_n_lines` so they point at the user's code, not the lines Plottery prepended.

Two "run one request at a time, always finish on the latest code" guards live here and are assumed by every redraw:

- **`kernel_is_busy(state)`** trusts `state.outstanding_kernel_request_time` first (a request < 500 ms old counts as in-flight, because the kernel's own busy flag lags), then falls back to the real kernel status (v6 `_pending_messages` / `iopub_done`; Lab `kernel.status !== 'idle'`).
- **the reply handler** clears `outstanding_kernel_request_time`, then re-runs immediately if the cell text changed while the kernel was busy, and otherwise settles (e.g. into `refresh_hover_regions`).

**The object model (`layer` → `call_view` → `arg_view` → `widget`, plus the `mark`s).** The sidebar mirrors the cell's code as a tree of plain objects (`types.ts`, `layer_panel/layer_panel.ts`):

- `state.layers_panel.layers: Layer[]` — one **`Layer`** per top-level typed AST statement (and per parseable comment). A `Layer` is `{ el, mark, target_mark, calls_with_args, call_views }`. Its `mark` spans the **whole** statement (used for line-highlighting, show/hide, and as the drag *source* range); `target_mark` spans just the displayed header — identical to `mark` for a one-line statement, but for a `for`/`def` it covers the header so a drop "below" it lands *inside* the block. Block layers recurse: a `for`/`def` layer is immediately followed in the flat `layers` array by its body's sub-layers (with a deeper `indent-N` class).
- `Layer.call_views: CallView[]` — one **`CallView`** per matplotlib (or user-defined) call on that statement's line. A `CallView` is `{ els: { el, header_el, name_el, properties_el }, mark, arguments }`; its `mark` spans that call's source text and is exactly what the call's change-watcher writes into (`add_sync_code_on_change_watcher(() => call_to_code(call_view), [mark], state)`, set up in `create_call_view`).
- `CallView.arguments: { arg: Arg, view: ArgView }[]` — one **`ArgView`** (`{ el, widget, disabled, positional }`) per argument row.
- `ArgView.widget: Widget` — the actual typed control, and the only object that must implement `to_code()` / `set_code()`.

So one editable argument is reached as `layer → call_views[i] → arguments[j].view → widget`. `mark`s live at the layer level (whole node + header) and the call level (the call's text); standalone editable bits — `for`-headers, `def` names (and all their use-sites), `def` arg-lists — get their own marks + watchers in `layers_from_typed_node`.

**Why `call_views` is plural.** `layers_from_typed_node` keeps *every* call whose `call.pos.line` equals the statement's line, filtered to matplotlib / user-defined ones (the rest are logged and dropped), so a line like `ax.plot(x); ax.set_title("t")` produces one layer with two call views. In practice it's almost always 0 or 1 (hence the `// Layers in practice only have zero or one calls` note in `attach_events_to_hover_regions`). All of a layer's call views are rendered into the layer row; selecting the layer only lifts `call_views[0]` (or a specific one passed via `select_call_view`, e.g. clicking that call's on-plot widget) into the Properties panel — the other calls' args stay visible in the layer row, they are **not** dropped.

**DOM ownership across a redraw.** A call's argument rows are a *single* DOM node (`call_view.els.properties_el`) that is **moved, never copied**: `set_properties_panel_on` does `args_el.remove(); properties_el.append(args_el)` to lift it next to the plot, and `clear_properties_panel` (run on every (de)selection) moves the same node back under its call view's `el` in the layer row. Because `redraw_cell` / `refresh_hover_regions` only swap the `<img>` / SVG (see below), this entire object tree — layers, call views, marks, watchers, and the transplanted panel — *survives those paths untouched*. Only `hard_rerun` tears it down: it clears all marks, re-executes, and `attach_plottery` rebuilds a brand-new `State` and tree (the old `state.is_in_dom()` flips to `false`). So a transplant can never dangle — between redraws it's moved home by `clear_properties_panel`, and a structural change rebuilds everything from scratch (selection is then restored from the persisted `selected_calls` / `new_calls`).

**The shared "edit → redraw" mechanism.** Most GUI edits never call the kernel directly. Instead, each editable piece of code (a call, an argument, a `for`-loop header, a function name) owns a [CodeMirror *mark*](https://codemirror.net/5/doc/manual.html#api_marker) — a tracked text range — plus a polling watcher created by `add_sync_code_on_change_watcher(get_code, marks, state)` (`code_sync/code_sync.ts`). On every animation frame it compares `get_code()` (e.g. `call_to_code(call_view)`) to its last value; on a change it calls `sync_code_range`, which writes the new text into the mark with `cm.replaceRange(...)` and then calls `redraw_cell(state)`. So "change a widget" really means "change the text the widget generates" — the watcher notices and re-runs the cell. Widgets therefore only need a working `to_code()` / `set_code()`.

**The three kernel paths** (all in `code_sync.ts`, all routed through `kernel_execute`, which handles both Notebook v6 `cell.kernel.execute` and JupyterLab `kernel.requestExecute` and sets `doesnt_need_plottery_show_ui` so the extension doesn't append another `show_ui`):

- **`redraw_cell`** — fast. Appends `plottery.show_ui(..., plottery_class=plottery.PlotteryFigureOnly)`, then swaps the plot `<img>` with the returned PNG. Guards against overlapping requests (`kernel_is_busy`) and re-runs if the code changed again while the kernel was busy.
- **`refresh_hover_regions`** — appends `plottery.show_ui(..., plottery_class=plottery.PlotteryFigureAndHoverRegions)`, replaces the SVG overlay, re-attaches drag handlers, and swaps in a higher-DPI PNG. Runs once a drag settles.
- **`hard_rerun`** — clears all CodeMirror marks and fully re-executes the cell, so Python rebuilds the entire UI from scratch via `_repr_html_`. Used whenever the code *structure* changes (new line, reorder, AI rewrite).

### Clicking a layer in the Layers panel

Entry: the click listener in `add_listeners_and_checkbox_to_layer` (`layer_panel/layer_panel.ts`) → `select_layer(layer, state)`. No kernel round-trip; this is pure DOM/selection:

1. `deselect_all_layers(state)` clears the previous selection.
2. Adds the `selected` class to `layer.el`.
3. `set_properties_panel_on(layer.call_views[0], state)` (`properties_panel/properties_panel.ts`) **moves** that call's argument-rows node (`.plottery-args`, i.e. `call_view.els.properties_el`) out of the layer row and into the Properties panel next to the plot. (If selection arrived via `select_call_view` — e.g. clicking a specific call's on-plot widget — that call view is lifted instead of `call_views[0]`; see "The object model" above for why this is a move, not a copy, and how it survives redraws.)
4. `compute_selected_hover_regions(state)` (`hover-regions/hover_regions.ts`) clears `.selected` on the SVG, then re-adds it to every `[data-call-id]` region whose id matches a selected call — this is the on-plot highlight.
5. `highlight_lines_for_selected_layers(state)` adds gutter/background line classes in CodeMirror over the layer's line range.
6. `save_selected_layers(state)` persists the selected `call_id`s to per-cell storage so the selection survives the next cell re-run (restored by `load_selected_layers`).

Selection is keyed on `call_id`, so it's robust across redraws (and restored after a `hard_rerun` by `load_selected_layers`).

**Selection is single, despite the plural names.** `select_layer` calls `deselect_all_layers` first, so at most one layer is ever selected; the selection state is nothing more than the `selected` CSS class on `layer.el` (queried by `is_layer_selected`). The plural API — `selected_layers()`, `deselect_all_layers`, `highlight_lines_for_selected_layers`, the array written by `save_selected_layers` — is structural/forward-looking (`selected_layers` even carries a `// Should only be 0 or 1 right now` note); nothing currently *adds* to a selection rather than replacing it. That same `select_layer` is the single funnel reached from every selection gesture: the layer-row click here, an on-plot region click (a `mouseup` with no drag), a plot-widget click (via `select_call_view`), the cursor-tracking below, and the post-rerun restore (`new_calls` / `load_selected_layers`).

In CodeMirror 5 (classic Notebook) only, moving the text cursor into a layer's range also selects that layer: `main.ts` listens for `cursorActivity`, finds the innermost layer whose `mark` contains the cursor, and selects it (it bails while the user has an active text selection, to avoid fighting a highlight). The JupyterLab CM6 facade doesn't expose `on` / `getCursor`, so this is feature-detected and simply skipped there.

### Reordering layers (drag-and-drop)

Layer rows are `draggable`; handlers live in `layer_panel.ts`:

- `dragstart` → `state.dragging_layers = [layer]`.
- `dragover` computes the drop side (top vs. bottom half of the row) and a target indent level from the mouse X (`Math.floor(mouseX / 29)`), showing feedback via `dragover-top` / `dragover-bottom` + `drag-indent-N` classes.
- `drop` does the actual code move:
  1. Reads the chosen indent from the `drag-indent-N` class and re-indents the dragged layers' source text to match.
  2. Computes the insertion point from the *target* layer's `target_mark` (distinct from `mark`: `target_mark` spans the displayed header, so dropping just below e.g. a `for` header lands *inside* the loop body).
  3. Temporarily sets every mark's `inclusiveLeft = false` (so marks don't swallow the insertion), inserts with `cm.replaceRange`, then deletes each source layer's original lines.
  4. `clean_up_passes(cm)` adds/removes `pass` statements so emptied or newly-filled blocks stay valid Python.
  5. `hard_rerun(state)` — structure changed, so rerun the cell to do a full UI rebuild.

`replace_all_preserving_marks` (same file) is the regex-replace helper used here and by the visibility checkbox; it edits text without clobbering existing marks. The per-layer show/hide checkbox uses it to comment/uncomment the layer's lines, then calls `redraw_cell` (or `hard_rerun` when re-enabling a plain-text layer that needs its full UI rebuilt).

### Clicking an on-plot button (add a method call)

On-plot buttons are drawn by `place_add_method_buttons_on_plot` (`hover-regions/hover_regions.ts`): it groups `state.methods_with_code` by each method's `show_on` artist id, skips any method already called its `max_calls` times, and overlays a button on each matching hover region — a single button (e.g. `ax.set_title`) when one method applies, or a dropdown menu (labeled with the artist name) when several do. Placement uses `place_over_shape` / `place_centered_over_shape` + `reposition_to_avoid_overlap`.

**How `show_on` finds the right shape — it's matched by Python `id()`.** When Python renders the hover-region SVG, `region2_to_svg_g` (`plottery/__init__.py`) stamps each region `<g>` with `data-artist-id="{id(artist)}"` (plus `data-artist-name`). When it builds the method list in `_repr_html_`, it walks the hard-coded `method_associations(artist)` tables (`axes_method_associations`, `fig_method_associations`, …); each entry is `(children_paths, method_name, max_calls, docstring_first_line)`, and Python sets `show_on = [id(eval("artist" + path)) for path in children_paths]` — e.g. an Axes-wide method like `bar` uses path `'.patch'` so it shows on `ax.patch`, while `set_title` uses `'.title'` → `ax.title`. `max_calls` is the per-method cap from those same tables (`1` for `set_title`, `float('inf')` for `bar`). The frontend then groups `state.methods_with_code` by `method.method_info.show_on.at(-1)` (the leaf id of the path), drops any whose `state.calls.count(...) >= max_calls`, and places the button(s) on every region whose `data-artist-id` equals that id. So the id flows Python `id(artist)` → `data-artist-id` *and* `show_on`, matched by plain equality in the browser; that's also why a `hard_rerun` (which re-`id()`s objects) is required after adding a call, not a fast redraw.

Clicking → `add_method_call(method, state)` (`sidebar/methods/method.ts`):

1. `add_line_of_code(method.code, state)` inserts the generated call (e.g. `ax.set_title("")`) into the cell immediately above `plt.show()`, matching its indentation.
2. Records the new call's id in the `new_calls` per-cell store so it gets auto-selected/focused after the rebuild.
3. `hard_rerun(state)`.

The `method.code` string was precomputed by `method_info_to_method_with_args`: from the mypy callee type it emits the required positional + keyword args (with default code) and prefixes `name = ` when the return type isn't `None` (naming `ax` / `fig` / etc. via `name_for_ret_type`). The same method list also populates the "＋ Add Layer" menu in the Layers panel.

### Clicking an argument

Argument rows are built by `create_arg_view` (`sidebar/arg/arg.ts`) and live in the Properties panel for the selected call. The value control is always a dropdown (`make_widget_for_code_and_type`, `widgets/widget.ts`) wrapping the type-derived widget(s).

- **(a) Toggle on/off.** Clicking the arg *name* (`prefixEl` mousedown) calls `disable_arg_view` (adds `plottery-arg-disabled`); clicking an already-disabled row calls `enable_arg_view`. Effect on code: `call_to_code` (`call/call.ts`) skips disabled args (`view.disabled ? null : arg_view_to_code(...)`), so a disabled optional kwarg simply drops out of the call. The watcher sees the changed `call_to_code()` and redraws. (Required args can't be disabled.)
- **(b) Dropdown of suggestions.** Clicking the selected value toggles the drawer open (`.expanded`) (`widgets/dropdown/dropdown.ts`). Items come from `make_widget_for_code_and_type`: widgets derived from the mypy type, the parameter's default, and `type_compatible_code_snippets` (user variables/expressions whose type matches this arg — computed in Python as `user_typed_snippets` / `user_iterables`), plus an arbitrary-code fallback. Hovering an item sets `dropdown.previewing_code`, which `to_code()` returns, so the live `redraw_cell` shows a *preview* of that choice; clicking it calls `select_dropdown_item`, which clones the chosen widget into the selected-item slot (keeping the previous value available in the drawer).
- **(c) Editing the arg code.** The selected widget is usually `arbitrary_code` (a `contentEditable` box, `widgets/arbitrary_code/arbitrary_code.ts`) or `code_and_control` (`widgets/code_and_control/code_and_control.ts`), which pairs that box with a GUI control (slider / toggle / color) kept in sync by a `MutationObserver` — editing the text updates the control (or drops it if the text no longer matches the type), and moving the control rewrites the text. Either way the new `to_code()` flows through the same call watcher → `sync_code_range` → `redraw_cell`.

**How the (b) suggestions are computed (all in Python).** The user-variable items come from two structures Python builds in `Plottery.__init__` and serializes to the frontend:

- **`user_typed_snippets`** — a `{ code_string: mypy_type }` map of expressions that could fill an argument. It starts from the user's variables in scope (names that actually appear in the user's code via `get_user_nameset`, minus trivial/callable ones), each typed by mypy (`tree.names[name].type`, or, inside a function where mypy doesn't expose it, a builtins fallback inferred from `type(value).__name__`). It then goes *one level* into concrete containers using the live values: `d[key]`, `d.keys()` / `.values()` / `.items()` for dicts; `xs[i]` per element and `np.arange(len(xs))` for lists/tuples.
- **`user_iterables`** — the subset whose type is an iterable: `is_subtype(t, Iterable[Any])` and **not** `is_subtype(t, str)` (so strings aren't offered to loop over), plus dynamic fallbacks for 1-D numpy arrays and lists. This feeds the for-loop iterable widget and the "＋ Add Layer → For-loop over …" menu.

Then, per argument, `serialize_type` computes `type_compatible_code_snippets_by_arg_i = [name for name, t in user_typed_snippets.items() if is_subtype(t, arg_type)]` (and the analogous `…_by_i` for `**kwargs` TypedDicts). So **"type compatible" means a mypy *subtype*** — `mypy.subtypes.is_subtype`, wrapped in `plottery/__init__.py`'s `is_subtype` (line ~1709) to resolve type aliases first and to treat a bare `Any` snippet as *not* matching a non-`Any` parameter (otherwise untyped values would flood every dropdown). It's subtyping, not equality: a `list[int]` variable is therefore offered for an `Iterable` / `Sequence` / `ArrayLike` parameter, and matplotlib's `ArrayLike` alias resolves so numpy arrays match wherever it's accepted.

### Dragging a shape on the plot

Wiring is in `attach_events_to_hover_regions` (`hover-regions/hover_regions.ts`). For each call's hover regions it pulls candidate drag handlers from `call/call.ts` (`perhaps_get_drag_xy_handler`, `_x_`, `_y_`, and the four edge handlers), then:

- a bare `mousemove` (no button down) picks which handler applies from proximity to an edge vs. the center, and sets the cursor (`col-resize` / `row-resize` / `move` / …);
- `mousedown` records the start point and the figure's bounding rect;
- `document` `mousemove` while pressed computes the pixel delta, calls the active handler, and hides the overlay during the drag;
- `mouseup`: if the mouse didn't move, it's a *click* → `select_layer`; if it moved → `refresh_hover_regions` (regenerate the SVG since shapes moved).

The handlers (`drag_handler_for_arg_view` in `call/call.ts`) translate pixels → code: they parse the target arg's current code into `stuff + number`, convert the pixel delta to axis units using `boundses` — the `data-fig-px-bounds` / `data-axes-px-bounds` / `data-axes-unit-bounds` / `data-region-px-bounds` attributes Python wrote onto each SVG region — compute the new number, and call `view.widget.set_code(...)` (plus `enable_arg_view`, so dragging turns the arg on if it was off). Special cases: legend `loc` (an xy fraction of the axes), `set_title` y (axes-size coords), and bar `width` / `height` edges (reversed). Each `set_code` is picked up by the call watcher → fast `redraw_cell` (DPI is dropped mid-drag for responsiveness); `refresh_hover_regions` runs once on release.

### Submitting an LLM prompt

The AI panel (`ai_panel/ai_panel.ts`) is an input box, shown only when an API key is present. Pressing Enter → `submit_prompt`:

1. Disables the input and shows a spinner.
2. `prompt_for_llm` builds the prompt from every code cell up to and including the current one, delimited with `### Cell N ###` markers, plus fixed instructions (how to add subplots, axes type annotations), ending with "Return only the new code of Cell N".
3. `prompt_llm` (`utils/llm.ts`) calls OpenAI. On success: strip ``` fences and the cell marker, `cm.setValue(newCode)` to replace the whole cell, `hard_rerun(state)`, then diff old vs. new lines and tag changed lines with `plottery-ai-line-changed` (gutter + background). The cursor is moved to the end so a single Cmd/Ctrl-Z undoes the whole AI edit. On error/timeout it surfaces "Oops there was an error." and re-enables the input.

`attach_ai_line_highlight_clearing_handlers` clears those change highlights the next time the cell is run manually.
