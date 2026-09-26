import { create_layers_panel, deselect_all_layers, is_layer_selected, layers_from_parseable_comment, layers_from_typed_node, load_selected_layers, select_layer } from "./layer_panel/layer_panel";
// import { set_artist_parent_ids } from "./sidebar/artist/artist";
import { make_plot_widgets, reposition_plot_widgets } from "./sidebar/plot-widget/plot_widget";
// import { focus_on_call_from_code } from "./sidebar/sidebar";
import "./plottery.css";
import {
  Arg,
  CallWithArgs,
  State,
  CallInfo,
  Type,
  MethodInfo
} from "./types";
import "./utils/stdlib";
import {
  arg_defaults_from_callee_type,
  create_el,
  cm_start_pos,
  cm_end_pos,
  get_persistent_item,
  set_persistent_item,
  notebook_code_cells,
  attach_jupyter_cell_height_sync,
  detach_jupyter_cell_height_sync,
} from "./utils/misc";
import { Cell, JupyterLabNotebookPanel, JupyterType, jupyterlab_cell_to_notebook_v6_cell } from "./utils/types";
import * as deserialize from "./utils/deserialize";
import { attach_events_to_hover_regions, place_add_method_buttons_on_plot } from "./sidebar/hover-regions/hover_regions";
import { create_sidebar_menu_bar, set_margin_right_to_width } from "./sidebar/sidebar";
import { close_all_menus } from "./menus/menus";
import { id_as_new_call } from "./sidebar/call/call";
import { method_info_to_method_with_args } from "./sidebar/methods/method";
import { ParseableComment } from "./layer_panel/layer_panel";
import { attach_ai_line_highlight_clearing_handlers, create_ai_panel } from "./ai_panel/ai_panel";
import { attach_undo_groups_to_continuous_inputs } from "./code_sync/undo_group";
import { log_event, rate_limit } from "./utils/instrumentation";
import { DocOrEditor } from "./utils/codemirror";



// These will exist in Notebooks v6, but not in JupyterLab.
declare const Jupyter: JupyterType | undefined;
(window as any).Jupyter ||= (window as any).Jupter

function find_cell(plottery_outer: HTMLElement): Cell {
  const cell_el = plottery_outer.closest(Jupyter ? ".code_cell" : ".jp-Cell");
  return notebook_code_cells(plottery_outer).filter(cell => cell.element[0] === cell_el)[0];
}



// Entry point
function attach_plottery(
  plottery_outer: HTMLElement,
  cell_lineno: number,
  plt_show_lineno_in_cell: number,
  provenance_is_off_by_n_lines: number,
  methods: MethodInfo[],
  calls: CallInfo[],
  notebook_typed_defs: Type[],
  notebook_parseable_comments: ParseableComment[],
  user_iterables: string[],
  avoid_names: string[],
  mpl_version: string,
  fig_idx: number,
  fig_names: string[],
) {
  console.time('time attach_plottery');

  console.time('time init state');
  // Initialize state
  const cell = find_cell(plottery_outer);
  console.log("cell", cell);
  (window as any).cell = cell;
  const state: State = {
    cell: cell,
    cell_lineno: cell_lineno,

    last_cell_code_executed: cell.get_text(),
    outstanding_kernel_request_time: undefined,

    plt_show_lineno_in_cell,
    provenance_is_off_by_n_lines,

    notebook_typed_defs: [],
    user_iterables: user_iterables,
    avoid_names: avoid_names,

    methods: methods,
    methods_with_code: methods.map(m => method_info_to_method_with_args(m, avoid_names)),

    // Not baked into the notebook (that would leak the server keys when shared); the AI panel
    // fetches them from the kernel and fills this in. See fetch_server_llm_keys / create_ai_panel.
    llm_api_keys: {},
    mpl_version: mpl_version,

    layers_panel: { el: create_el("div"), layers: [] }, // Dummy, replaced immediately below.

    calls: calls,
    calls_with_args: [],

    dragging_layers: [],

    plottery_outer: plottery_outer,
    plot_area: plottery_outer.querySelector(".plot_area")!,
    hover_regions_container: plottery_outer.querySelector(".hover_regions")!,
    hover_regions_svg: () => state.hover_regions_container.querySelector("svg") as SVGElement | undefined,
    set_hover_regions_html: (html_svg_str: string) => { state.hover_regions_container.innerHTML = html_svg_str; },

    is_in_dom: () => state.plottery_outer.isConnected,

    plot_widgets: [],

    sidebar_el:    plottery_outer.querySelector(".plottery-sidebar")!,
    properties_el: create_el("div", ["plottery-properties-panel", "hidden"], plottery_outer.querySelector(".plot_and_sidebar")!),

    stdout_stderr: plottery_outer.querySelector(".stdout_stderr")!,

    command_shortcuts: {}, // Added by menu items in menus.ts
  };
  console.timeEnd('time init state');

  // Marks from prior renders are all stale now — this attach rebuilds every layer/call/arg and
  // its marks from scratch. Clear them up front so they don't accumulate across manual cell
  // reruns (the cell's editor persists, and only GUI hard_rerun cleared marks before), which
  // made each successive attach re-sort an ever-larger decoration set and grow slower.
  const cm_for_clearing = state.cell.code_mirror as any;
  if (typeof cm_for_clearing.clear_all_marks === "function") {
    cm_for_clearing.clear_all_marks(); // CM6 facade (JupyterLab / Notebooks v7): one O(n) dispatch
  } else {
    cm_for_clearing.getAllMarks?.().forEach((m: any) => m.clear()); // real CM5 (Notebooks v6)
  }

  console.time('time make layers');
  const make_stuff_nice_for_screenshots = window.sessionStorage.getItem('make_stuff_nice_for_screenshots') === 'true'
  const in_demo_mode = window.sessionStorage.getItem('plottery_demo_mode') === 'true';

  const sidebar_margin_right = 20;
  if (Jupyter) {
    // In Notebooks v6, put the sidebar somewhat into the left gutter so the whole UI is centered.
    set_margin_right_to_width(state.sidebar_el, sidebar_margin_right, 83 + (make_stuff_nice_for_screenshots || in_demo_mode ? 113 : 0));
  } else if (document.body.dataset.notebook == 'notebooks') {
    // In Notebooks v7, the constant to center it is different.
    set_margin_right_to_width(state.sidebar_el, sidebar_margin_right, 83 + 84 + (make_stuff_nice_for_screenshots || in_demo_mode ? 113 : 0));
  } else {
    // In JupyterLab, the cell codebox is the full width of the page, so it's not necessary.
    state.sidebar_el.style.marginRight = `${sidebar_margin_right}px`;
  }

  // FOR SCREENSHOTS, SET window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true') IN JAVASCRIPT
  // %%javascript
  // window.sessionStorage.removeItem('make_stuff_nice_for_screenshots')
  // window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')

  if (make_stuff_nice_for_screenshots || in_demo_mode) {
    document.body.style.backgroundColor = 'white';
    document.querySelectorAll('.prompt_container,.output_prompt,.out_prompt_overlay').forEach(el => { (el as HTMLElement).style.display = 'none'; });
    document.querySelectorAll('#notebook-container').forEach(el => (el as HTMLElement).style.boxShadow = 'none');

    if (in_demo_mode) {
      state.plot_area.style.minWidth = '460px';
      state.plot_area.style.maxWidth = '460px';

      document.getElementById('header')!.style.height = '0px';
      document.getElementById('header')!.style.overflow = 'hidden';

      window.dispatchEvent(new Event('resize'));
    }

    const style = document.createElement("style");
    // link.type = "text/css";
    // link.rel = "stylesheet";
    style.append(`
div.cell.selected,
.edit_mode div.cell.selected \{
    border-color: transparent;
\}
div.cell.selected::before,
.edit_mode div.cell.selected::before \{
    background-color: transparent;
\}

div#notebook .CodeMirror { font-size: 17px }
    `);
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  // Put stdout_stderr at the bottom
  // state.stdout_stderr.remove();
  // plottery_outer.append(state.stdout_stderr);

  plottery_outer.tabIndex = 0; // So it can recieve keyboard events (cmd-d for duplicate, etc)

  console.log("State", state);

  const sidebar_menu_bar = create_sidebar_menu_bar(state, fig_idx, fig_names);

  state.sidebar_el.append(sidebar_menu_bar);

  // The AI panel is always shown now: its gear-icon config panel lets the user pick a
  // provider and enter their own API key, so it must be reachable even with no server key.
  state.sidebar_el.append(create_ai_panel(state));
  attach_ai_line_highlight_clearing_handlers();

  // const calls_with_args = user_call_type_info.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror))
  // state.layers = notebook_ast.body.map(stmt => layer_from_ast_node(calls_with_args, stmt, state));

  // log the number of keys in notebook_typed_defs
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs).length);
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs));

  state.notebook_typed_defs = deserialize.python_objects_to_js(notebook_typed_defs);

  state.calls_with_args = calls.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror));

  const layers = state.notebook_typed_defs.flatMap(typed_node =>
    (typed_node as any).line >= cell_lineno ? layers_from_typed_node(typed_node, state) : []
  );

  notebook_parseable_comments.filter(comment => comment.line >= cell_lineno).forEach(comment => {
    const layers_from_comment = layers_from_parseable_comment(comment, state);

    // Put the layer in the right location: before the first layer that starts after it.
    // (Not the first that *ends* after it, or a comment inside e.g. a function body would land above the def.)
    layers_from_comment.forEach(comment_layer => {
      const comment_layer_line = comment_layer.mark.find()!.to.line;
      const insert_i = layers.findIndex(layer => layer.mark.find()!.from.line > comment_layer_line);
      if (insert_i >= 0) {
        layers.splice(insert_i, 0, comment_layer);
      } else {
        layers.push(comment_layer);
      }
    })
  })

  state.layers_panel = create_layers_panel(layers, state);

  // Cap cell height and let it scroll, so we can see both plot and code on the screen at the same time.
  // Uses the CodeMirror scroller element, which works for both the real CM5 editor
  // (Notebooks v6) and the CM6-backed facade (JupyterLab / Notebooks v7).
  state.cell.code_mirror.getScrollerElement().style.maxHeight = "42vh";

  // Clicks on non-selectable elements on plot should deselect.
  // (Clicks on selectable elements do not propogate to the container.)
  state.hover_regions_container.addEventListener("click", _ => { log_event('gui', 'plot background click deselect all'); deselect_all_layers(state); });

  // Track cursor movement in the cell to keep the layer selection in sync with where the user is editing.
  // Only available in Notebooks v6 right now; the JupyterLab CM6 facade doesn't expose these APIs.
  const cm = state.cell.code_mirror as any;
  if (typeof cm.on === 'function' && typeof cm.getCursor === 'function') {
    // This listener lives on the cell's *input* editor, which survives re-runs, so a new
    // one would pile up on every render and keep acting on dead renders. Remove the previous
    // render's listener so exactly one (the live render's) is ever attached at a time.
    cm.__plottery_cursor_activity_off?.();

    const on_cursor_activity = () => {
      // Guard the brief window between this render's output being cleared and the next
      // render attaching (which removes this listener): don't act on a detached render.
      if (!state.is_in_dom()) return;

      // Don't fight a real text selection (e.g. user is highlighting code).
      if (cm.somethingSelected && cm.somethingSelected()) return;

      const cursor_idx = cm.indexFromPos(cm.getCursor());

      // Iterate in reverse so the innermost (most specific) enclosing layer wins;
      // children come after their parent in state.layers_panel.layers.
      const containing = [...state.layers_panel.layers].reverse().find(layer => {
        const range = layer.mark.find();
        if (!range) return false;
        return cm.indexFromPos(range.from) <= cursor_idx && cursor_idx <= cm.indexFromPos(range.to);
      });

      // If the cursor isn't inside any layer (e.g. blank line, plt.show, etc.),
      // leave the existing selection alone. Only sync selection for function-call
      // layers — body layers (if/for/def/plain code) scroll the editor out of view.
      if (containing && containing.call_views.length > 0 && !is_layer_selected(containing)) {
        select_layer(containing, state);
      }
    };

    cm.on("cursorActivity", on_cursor_activity);
    cm.__plottery_cursor_activity_off = () => cm.off("cursorActivity", on_cursor_activity);
  }

  state.sidebar_el.append(state.layers_panel.el);


  create_el("h2", "plottery-properties-panel-header", state.properties_el);

  console.timeEnd('time make layers');
  console.time('time make plot widgets');

  // Make plot widgets on those hover regions
  // (Populates state.plot_widgets)
  make_plot_widgets(state);

  place_add_method_buttons_on_plot(state);

  attach_events_to_hover_regions(state);
  attach_undo_groups_to_continuous_inputs(state);
  reposition_plot_widgets(state);

  console.timeEnd('time make plot widgets');
  console.time('time final setup');

  // Keyboard commands
  // Registered on the outer element that can accept keyboard events
  plottery_outer.addEventListener("keydown", evt => {
    const ev = evt as KeyboardEvent;
    const isMac = window.navigator.platform.match(/Mac|iPhone/);

    if ((isMac && ev.metaKey) || (!isMac && ev.ctrlKey)) { // CMD or CNTRL key
      let keys = (ev.shiftKey ? '⇧' : '') + ev.key.toUpperCase();

      if (state.command_shortcuts[keys]) {
        ev.stopPropagation();
        ev.preventDefault();
        state.command_shortcuts[keys](state);
        close_all_menus(state);
      }
    }
  });


  const new_calls: string[] = JSON.parse(get_persistent_item(state, "new_calls") || "[]");

  // console.log("new_calls", new_calls);

  // Select new call(s) or re-gen the selection state
  if (new_calls.length > 0) {
    // select layers whose get_code_and_loc_for_call(call.call_info) appears in new_calls
    state.layers_panel.layers.forEach(layer => {
      const ids_as_new_call = layer.calls_with_args.map(call_with_args => id_as_new_call(call_with_args.call_info));
      // console.log(ids_as_new_call)
      if (ids_as_new_call.some(id => new_calls.includes(id))) {
        select_layer(layer, state);

        // If there's an associated plot widget, "click" it to start editing
        for (const { icon_el, show_on_call_id } of state.plot_widgets) {
          if (layer.calls_with_args.some(call_with_args => call_with_args.call_info.call_id == show_on_call_id)) {
            icon_el.click();
          }
        }
      }
    });

    set_persistent_item(state, "new_calls", "[]");
  } else {
    load_selected_layers(state);
  }

  // Be sure fig_idx is stored so that re-runs of the cell preserve it
  if (!get_persistent_item(state, "fig_idx")) {
    set_persistent_item(state, "fig_idx", fig_idx.toString());
  }


  function attach_code_cell_logging(): void {
    // Jupyter.notebook.events.on('execute.CodeCell', (event, data) => {
    //   console.log("execute.CodeCell", data);
    //   state.last_cell_code_executed = data.cell.get_text();
    // }
    if (Jupyter) {

      if (!(window as any)['plottery notebook logging events attached']) {
        (window as any)['plottery notebook logging events attached'] = true;
        (Jupyter.notebook as any).events.on('execute.CodeCell', (_ev: any, data: any) => {
          if (!data.plottery_hard_rerun) {
            // triggered by user, not a plottery GUI action
            const cellno = Jupyter.notebook.get_cells().indexOf(data.cell);
            log_event("code", "code cell manual execute", { cellno, code: data.cell.get_text() });
          }
        });

        (Jupyter.notebook as any).events.on('create.Cell', (_ev: any, data: any) => {
          // also triggered on undo of delete cell, but not sure how to tell if that's the case
          log_event("code", "code cell create", { cellno: data.index });
        });

        (Jupyter.notebook as any).events.on('delete.Cell', (_ev: any, data: any) => {
          log_event("code", "code cell delete", { cellno: data.index, code: data.cell.get_text() });
        });

        // Log when user tabs out and back
        document.addEventListener('visibilitychange', () => {
          log_event("other", document.hidden ? "browser tab hidden" : "browser tab visible");
        });

        window.setInterval(attach_code_cell_logging, 2000); // Ensure new cells get the events below

        // In case the browser crashes, lose less work.
        (Jupyter.notebook as any).set_autosave_interval(10 * 1000); // 10sec
      }

      Jupyter.notebook.get_cells().forEach((cell: Cell) => {
        if (cell.cell_type === "code" && !(cell.code_mirror as any)['plottery logging events attached']) {

          const cellno = Jupyter.notebook.get_cells().indexOf(cell);

          (cell.code_mirror as any)['plottery logging events attached'] = true;
          (cell.code_mirror as any).on("mousedown", (cm: DocOrEditor) => {
            log_event("code", "code cell click", { cellno, code: cm.getValue() });
          });
          (cell.code_mirror as any).on("change", (cm: DocOrEditor, change: { origin: string}) => {
            if (change.origin === "undo")   { log_event("code", "code cell undo", { cellno, code: cm.getValue() }); }
            if (change.origin === "redo")   { log_event("code", "code cell redo", { cellno, code: cm.getValue() }); }
            if (change.origin === "+input") { rate_limit("code cell keydown", 1000, () => log_event("code", "code cell keydown", { cellno, code: cm.getValue() })); } // this catches additions, but not backspace
          });
          (cell.code_mirror as any).on("keydown", (cm: DocOrEditor, ev: KeyboardEvent) => {
            if (ev.key === "Backspace") { rate_limit("code cell keydown", 1000, () => log_event("code", "code cell keydown", { cellno, code: cm.getValue() })); }
            // if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
            // }
          });
        }
      });
    }
  }

  attach_code_cell_logging();

  // Notebook v7 / JupyterLab content-visibility windowing underestimates Plottery cell
  // height (ignores HTML UI). Keep the estimate + contain-intrinsic-size in sync with the
  // real layout, including after New Cell rewrites them from the bad estimate.
  attach_jupyter_cell_height_sync(state);

  (window as any)["last_plottery_state"] = state;

  console.timeEnd('time final setup');

  console.timeEnd('time attach_plottery');
}

(window as any)["attach_plottery"] = attach_plottery;


// Undo attach_plottery's changes to the cell's input editor (marks, line highlights, cursor listener,
// height cap, height sync). The extensions' global Plottery on/off toggle calls this before it
// strips the UI out of the cell's output, which removes everything else.
function detach_plottery(plottery_outer: HTMLElement) {
  const cell = find_cell(plottery_outer);
  if (!cell) return;

  const cm = cell.code_mirror as any;
  if (typeof cm.clear_all_marks === "function") {
    cm.clear_all_marks(); // CM6 facade: also clears line classes
  } else {
    cm.getAllMarks?.().forEach((m: any) => m.clear());
    cm.eachLine?.((line: any) => {
      cm.removeLineClass(line, "gutter", "plottery-ai-line-changed");
      cm.removeLineClass(line, "background", "plottery-ai-line-changed");
    });
  }
  cm.__plottery_cursor_activity_off?.();
  delete cm.__plottery_cursor_activity_off;
  cm.getScrollerElement().style.maxHeight = "";

  detach_jupyter_cell_height_sync(cell, plottery_outer);
}

(window as any)["detach_plottery"] = detach_plottery;


// # Positional argument
// ARG_POS = 0
// # Positional, optional argument (functions only, not calls)
// ARG_OPT = 1
// # *arg argument
// ARG_STAR = 2
// # Keyword argument x=y in call, or keyword-only function arg
// ARG_NAMED = 3
// # **arg argument
// ARG_STAR2 = 4
// # In an argument list, keyword-only and also optional
// ARG_NAMED_OPT = 5
export function call_info_to_call_with_args(
  call_info: CallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): CallWithArgs {
  const callee = call_info.callee;

  let arg_defaults = arg_defaults_from_callee_type(callee);

  // Cross-call link suggestions apply to given and missing args alike (given args spread
  // their template below, and the missing-arg lists are built from these same templates).
  arg_defaults.forEach(arg => {
    arg.link_suggestions = call_info.link_suggestions_by_arg_name?.[arg.name];
  });

  const given_args: Arg[] = call_info.given_args.map((given_arg, arg_i: number) => {
    const arg_val_code = code_mirror.getRange(
      cm_start_pos(given_arg.pos, cell_lineno),
      cm_end_pos(given_arg.pos, cell_lineno)
    );

    // plottery.py spreads the arg expression's serialized type into given_arg
    const code_type = ".class" in given_arg ? (given_arg as Type) : null;

    // Find the corresponding default arg template based on name or position
    const arg_template = given_arg.name ? arg_defaults.find(arg => given_arg.name === arg.name) : arg_defaults[arg_i];

    // We've been given a named argument that's not in the type definition.
    if (!arg_template) {
      return {
        name: given_arg.name || "unknown",
        required: false,
        is_positional: given_arg.name == null,
        kind: given_arg.name ? "ARG_NAMED" : "ARG_OPT",
        code: arg_val_code,
        pos: given_arg.pos,
        type: null,
        code_type,
        default_code: null,
        type_compatible_code_snippets: [],
        provenance: given_arg.provenance,
        link_suggestions: given_arg.name ? call_info.link_suggestions_by_arg_name?.[given_arg.name] : undefined,
      };
    }

    return {
      ...arg_template,
      is_positional: given_arg.name == null,
      code: arg_val_code,
      pos: given_arg.pos,
      code_type,
      provenance: given_arg.provenance,
    };
  });

  const [given_positional_args, given_keyword_args] = given_args.partition(arg => arg.is_positional);

  const missing_positional_args = arg_defaults.slice(given_positional_args.length).takeWhile(arg => arg.is_positional);

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      arg => !given_keyword_args.some(given_arg => given_arg.name === arg.name)
    );
  // .filter(arg => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  // if used for a new call, required args need to be generated
  let [needed_positional_args, missing_optional_positional_args] =
    missing_positional_args.partition(arg => arg.kind === "ARG_POS");

  return {
    call_info,
    given_positional_args,
    given_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    missing_keyword_args,
  };
}
