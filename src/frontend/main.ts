import { create_layers_panel, deselect_all_layers, duplicate_selected_layers, layers_from_parseable_comment, layers_from_typed_node, load_selected_layers, select_layer } from "./layer_panel/layer_panel";
// import { set_artist_parent_ids } from "./sidebar/artist/artist";
import { make_plot_widgets, reposition_plot_widgets } from "./sidebar/plot-widget/plot_widget";
// import { focus_on_call_from_code } from "./sidebar/sidebar";
import "./snp.css";
import {
  Arg,
  CallWithArgs,
  State,
  CallInfo,
  Type,
  MethodInfo,
} from "./types";
import "./utils/stdlib";
import {
  arg_defaults_from_callee_type,
  create_el,
  cm_start_pos,
  cm_end_pos,
} from "./utils/misc";
import { JupyterType } from "./utils/types";
import * as deserialize from "./utils/deserialize";
import { attach_events_to_hover_regions, place_add_method_buttons_on_plot } from "./sidebar/hover-regions/hover_regions";
import { create_sidebar_menu_bar, set_margin_right_to_width } from "./sidebar/sidebar";
import { close_all_menus } from "./menus/menus";
import { id_as_new_call } from "./sidebar/call/call";
import { method_info_to_method_with_args } from "./sidebar/methods/method";
import { ParseableComment } from "./layer_panel/layer_panel";
import { create_ai_panel } from "./ai_panel/ai_panel";


// These will already exist where we inject the JS in the notebook.
declare const IPython: any;
declare const Jupyter: JupyterType;

// Entry point
function attach_snp(
  snp_outer: HTMLElement,
  cell_lineno: number,
  plt_show_lineno_in_cell: number,
  provenance_is_off_by_n_lines: number,
  methods: MethodInfo[],
  calls: CallInfo[],
  notebook_typed_defs: Type[],
  notebook_parseable_comments: ParseableComment[],
  user_iterables: string[],
  avoid_names: string[],
  llm_api_key: string,
  fig_idx: number,
  fig_names: string[],
) {
  // Initialize state
  const cell_el = snp_outer.closest(".code_cell");
  const cell = Jupyter.notebook.get_cells().filter(cell => cell.element[0] === cell_el)[0];
  const state: State = {
    cell: cell,
    cell_lineno: cell_lineno,

    last_cell_code_executed: cell.get_text(),

    plt_show_lineno_in_cell,
    provenance_is_off_by_n_lines,

    notebook_typed_defs: [],
    user_iterables: user_iterables,
    avoid_names: avoid_names,

    methods: methods,
    methods_with_code: methods.map(m => method_info_to_method_with_args(m, avoid_names)),

    llm_api_key: llm_api_key,

    layers_panel: { el: create_el("div"), layers: [] }, // Dummy, replaced immediately below.

    calls: calls,
    calls_with_args: [],

    persistent_dataset: (snp_outer.closest('.output')! as HTMLElement).dataset,
    dragging_layers: [],

    snp_outer: snp_outer,
    plot_area: snp_outer.querySelector(".plot_area")!,
    hover_regions_container: snp_outer.querySelector(".hover_regions")!,
    hover_regions_svg: () => state.hover_regions_container.querySelector("svg") as SVGElement | undefined,
    set_hover_regions_html: (html_svg_str: string) => { state.hover_regions_container.innerHTML = html_svg_str; },

    is_in_dom: () => !!(state.snp_outer.parentElement?.parentElement?.parentElement),

    plot_widgets: [],

    sidebar_el:    snp_outer.querySelector(".snp-sidebar")!,
    properties_el: create_el("div", ["snp-properties-panel", "hidden"], snp_outer.querySelector(".plot_and_sidebar")!),

    stdout_stderr: snp_outer.querySelector(".stdout_stderr")!,

    command_shortcuts: {}, // Added by menu items in menus.ts
  };
  const make_stuff_nice_for_screenshots = window.sessionStorage.getItem('make_stuff_nice_for_screenshots') === 'true'
  set_margin_right_to_width(state.sidebar_el, 20, 83 + (make_stuff_nice_for_screenshots ? 113 : 0));

  // Put stdout_stderr at the bottom
  // state.stdout_stderr.remove();
  // snp_outer.append(state.stdout_stderr);

  snp_outer.tabIndex = 0; // So it can recieve keyboard events (cmd-d for duplicate, etc)

  console.log("State", state);

  const sidebar_menu_bar = create_sidebar_menu_bar(state, fig_idx, fig_names);

  state.sidebar_el.append(sidebar_menu_bar);

  if (llm_api_key.length > 10) {
    state.sidebar_el.append(create_ai_panel(state));
  } else {
    console.log("No LLM API key provided, not showing AI panel.");
  }

  // const calls_with_args = user_call_type_info.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror))
  // state.layers = notebook_ast.body.map(stmt => layer_from_ast_node(calls_with_args, stmt, state));

  // log the number of keys in notebook_typed_defs
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs).length);
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs));

  state.notebook_typed_defs = deserialize.python_objects_to_js(notebook_typed_defs);

  state.calls_with_args = calls.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror));

  const layers = state.notebook_typed_defs.flatMap(typed_node =>
    typed_node.line >= cell_lineno ? layers_from_typed_node(typed_node, state) : []
  );

  notebook_parseable_comments.filter(comment => comment.line >= cell_lineno).forEach(comment => {
    const layers_from_comment = layers_from_parseable_comment(comment, state);

    // Put the layer in the right location
    layers_from_comment.forEach(comment_layer => {
      const comment_layer_line = comment_layer.mark.find()!.to.line;
      const insert_i = layers.findIndex(layer => layer.mark.find()!.to.line > comment_layer_line);
      if (insert_i) {
        layers.splice(insert_i, 0, comment_layer);
      } else {
        layers.push(comment_layer);
      }
    })
  })

  state.layers_panel = create_layers_panel(layers, state);

  // Clicks on non-selectable elements on plot should deselect.
  // (Clicks on selectable elements do not propogate to the container.)
  state.hover_regions_container.addEventListener("click", _ => { deselect_all_layers(state); });

  state.sidebar_el.append(state.layers_panel.el);

  create_el("h2", "snp-properties-panel-header", state.properties_el);

  // Make plot widgets on those hover regions
  // (Populates state.plot_widgets)
  make_plot_widgets(state);

  place_add_method_buttons_on_plot(state);

  attach_events_to_hover_regions(state);
  reposition_plot_widgets(state);

  // Keyboard commands
  // Registered on the outer element that can accept keyboard events
  snp_outer.addEventListener("keydown", evt => {
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


  const new_calls: string[] = JSON.parse(state.persistent_dataset.new_calls || "[]");

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

    state.persistent_dataset.new_calls = "[]";
  } else {
    load_selected_layers(state);
  }

  // Be sure fig_idx is stored so that re-runs of the cell preserve it
  if (!state.persistent_dataset.fig_idx) {
    state.persistent_dataset.fig_idx = fig_idx.toString();
  }

  // Re-open the selected calls
  // state.persistent_dataset
  // const persistent_calls: { [id: string]: PersistantCall } = (window as any)[
  //   "snp_persistent_calls"
  // ];
  // const code_and_loc = get_code_and_loc_for_call(call.call_info);

  // // If previously expanded, then expand
  // if (persistent_calls[code_and_loc]) {
  //   if (persistent_calls[code_and_loc]?.collapsed) {
  //     collapse_collapsable(call_el);
  //   } else {
  //     open_collapsable(call_el);
  //   }
  // }


  // Focus on call (i.e. expand the sidebar to show the call)
  // e.g. when adding a new method, expand it's call
  // const focused_call: string | null = (window as any)["snp_focused_call"];
  // if (focused_call != null) {
  //   focus_on_call_from_code(focused_call, state);
  //   (window as any)["snp_focused_call"] = null;
  // }

  // FOR SCREENSHOTS, SET window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true') IN JAVASCRIPT
  // %%javascript
  // window.sessionStorage.removeItem('make_stuff_nice_for_screenshots')
  // window.sessionStorage.setItem('make_stuff_nice_for_screenshots', 'true')
  if (make_stuff_nice_for_screenshots) {
    document.body.style.backgroundColor = 'white';
    document.querySelectorAll('.prompt_container,.output_prompt,.out_prompt_overlay').forEach(el => { el.remove() });
    document.querySelectorAll('#notebook-container').forEach(el => (el as HTMLElement).style.boxShadow = 'none');

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
    `);
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  (window as any)["last_snp_state"] = state;
}

(window as any)["attach_snp"] = attach_snp;


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

  const given_args: Arg[] = call_info.given_args.map((given_arg, arg_i: number) => {
    const arg_val_code = code_mirror.getRange(
      cm_start_pos(given_arg.pos, cell_lineno),
      cm_end_pos(given_arg.pos, cell_lineno)
    );

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
        type: null, // Could use the given arg type, `given_arg`
        // code_type: null,
        default_code: null,
        type_compatible_code_snippets: [],
      };
    }

    return {
      ...arg_template,
      is_positional: given_arg.name == null,
      code: arg_val_code,
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
