import { create_layers_panel, deselect_all_layers, duplicate_selected_layers, layers_from_parseable_comment, layers_from_typed_node, load_selected_layers, select_layer } from "./layer_panel/layer_panel";
// import { set_artist_parent_ids } from "./sidebar/artist/artist";
import { make_plot_widgets, reposition_plot_widgets } from "./sidebar/plot-widget/plot_widget";
// import { focus_on_call_from_code } from "./sidebar/sidebar";
import "./snp.css";
import {
  Arg,
  DynamicCallInfo,
  CallWithArgs,
  CallableType,
  Position,
  SelectableArtist,
  State,
  TypeAliasType,
  TypedDictType,
  StaticCallTypeInfo,
  Type,
  MethodInfoWithType,
} from "./types";
import "./utils/array";
import {
  arg_defaults_from_callee_type,
  create_el,
  cm_start_pos,
  cm_end_pos,
} from "./utils/misc";
import { JupyterType, get_arg_kind_from_int } from "./utils/types";
import * as deserialize from "./utils/deserialize";
import { attach_events_to_hover_regions, place_add_method_buttons_on_plot } from "./sidebar/hover-regions/hover_regions";
import { create_sidebar_menu_bar } from "./sidebar/sidebar";
import { close_all_menus } from "./menus/menus";
import { get_code_and_loc_for_call } from "./sidebar/call/call";
import { get_methods } from "./sidebar/methods/method";
import { ParseableComment } from "./types";


// These will already exist where we inject the JS in the notebook.
declare const IPython: any;
declare const Jupyter: JupyterType;

// Entry point
function attach_snp(
  snp_outer: HTMLElement,
  cell_lineno: number,
  provenance_is_off_by_n_lines: number,
  user_call_type_info: StaticCallTypeInfo[],
  sidebar_stuff: {
    methods: MethodInfoWithType[];
    calls: DynamicCallInfo[];
  },
  notebook_typed_defs: Type[],
  notebook_parseable_comments: ParseableComment[],
  user_iterables: string[],
) {
  console.log("user_call_type_info", user_call_type_info);
  console.log("sidebar_stuff", sidebar_stuff);

  // Initialize state
  const cell_el = snp_outer.closest(".code_cell");
  const cell = Jupyter.notebook.get_cells().filter(cell => cell.element[0] === cell_el)[0];
  const state: State = {
    canvas_selection: null,

    cell: cell,
    cell_lineno: cell_lineno,

    last_cell_code_executed: cell.get_text(),
    provenance_is_off_by_n_lines,

    notebook_typed_defs: [],
    user_iterables: user_iterables,

    methods: get_methods(sidebar_stuff.methods),

    layers_panel: { el: create_el("div"), layers: [] }, // Dummy, replaced immediately below.

    calls: sidebar_stuff.calls,
    calls_with_args: [],

    busy: false,
    persistent_dataset: (snp_outer.closest('.output')! as HTMLElement).dataset,
    dragging_layers: [],

    snp_outer: snp_outer,
    plot_area: snp_outer.querySelector(".plot_area")!,
    hover_regions_container: snp_outer.querySelector(".hover_regions")!,
    hover_regions_svg: () => state.hover_regions_container.querySelector("svg") as SVGElement | undefined,
    set_hover_regions_html: (html_svg_str: string) => { state.hover_regions_container.innerHTML = html_svg_str; },

    plot_widgets: [],

    sidebar_el: create_el("div", "snp-sidebar", snp_outer.querySelector(".plot_and_sidebar")!),
    stdout_stderr: snp_outer.querySelector(".stdout_stderr")!,

    command_shortcuts: {}, // Added by menu items in menus.ts
  };

  // Put stdout_stderr at the bottom
  // state.stdout_stderr.remove();
  // snp_outer.append(state.stdout_stderr);

  snp_outer.tabIndex = 0; // So it can recieve keyboard events (cmd-d for duplicate, etc)

  console.log("State", state);

  const sidebar_menu_bar = create_sidebar_menu_bar(state);

  state.sidebar_el.append(sidebar_menu_bar);

  // const calls_with_args = user_call_type_info.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror))
  // state.layers = notebook_ast.body.map(stmt => layer_from_ast_node(calls_with_args, stmt, state));

  // log the number of keys in notebook_typed_defs
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs).length);
  // console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs));

  state.notebook_typed_defs = deserialize.python_objects_to_js(notebook_typed_defs);

  state.calls_with_args = sidebar_stuff.calls.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror));

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

  // Select new call(s) or re-gen the selection state
  if (new_calls.length > 0) {
    // select layers whose get_code_and_loc_for_call(call.call_info) appears in new_calls
    state.layers_panel.layers.forEach(layer => {
      const codes_and_locs = layer.calls_with_args.map(call_with_args => get_code_and_loc_for_call(call_with_args.call_info));
      // console.log(codes_and_locs)
      if (codes_and_locs.some(code_and_loc => new_calls.includes(code_and_loc))) {
        select_layer(layer, state);

        // If there's an associated plot widget, "click" it to start editing
        for (const { icon_el, show_on_loc_via_func_code_and_num } of state.plot_widgets) {
          if (layer.calls_with_args.some(call_with_args => call_with_args.call_info.loc_via_func_code_and_num == show_on_loc_via_func_code_and_num)) {
            icon_el.click();
          }
        }
      }
    });

    state.persistent_dataset.new_calls = "[]";
  } else {
    load_selected_layers(state);
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

  (window as any)["last_snp_state"] = state;

  // Suppress additional plot
  // setTimeout(() => {
  //   snp_outer.parentElement?.parentElement?.nextElementSibling?.remove();
  // }, 200);
}

(window as any)["attach_snp"] = attach_snp;

export function call_info_to_call_with_args<call_info_type extends (DynamicCallInfo | StaticCallTypeInfo)>(
  call_info: call_info_type,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): CallWithArgs<call_info_type> {
  const args = get_args(call_info, cell_lineno, code_mirror);

  const [given_positional_args, given_keyword_args] =
    args.filter(arg => arg.name != "kwargs").partition(arg => arg.is_positional);

  const {
    needed_positional_args,
    missing_optional_positional_args,
    missing_keyword_args,
    kwargs,
  } = segment_args(
    call_info.callee,
    given_positional_args,
    given_keyword_args
  );

  // console.log("call_info_to_call_with_args",{
  //   call_info,
  //   given_positional_args,
  //   given_keyword_args,
  //   missing_positional_args,
  //   missing_keyword_args,
  //   needed_positional_args,
  //   missing_optional_positional_args,
  //   kwargs,
  // })

  return {
    call_info,
    given_positional_args,
    given_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    missing_keyword_args,
    kwargs,
  };
}

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

function get_args(
  call_info: StaticCallTypeInfo | DynamicCallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): Arg[] {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== undefined;

  let arg_names = call_info.callee.arg_names_at_definition ? call_info.callee.arg_names_at_definition : call_info.callee.arg_names;
  if (arg_names === call_info.callee.arg_names) {
    console.warn("arg_names_at_definition not found for ", call_info, " likely meaning the type def for it is missing an import or is otherwise missing or malformed. Lack of definition access can can mess up positional-only arguments.");
  }

  return call_info.given_args.map((given_arg, arg_i: number) => {
    const arg_i_at_func_def =
      given_arg["name"] ? arg_names.indexOf(given_arg.name) : (callee_has_self_arg ? arg_i + 1 : arg_i);

    const arg_kind_i = call_info.callee.arg_kinds[arg_i_at_func_def]
    const arg_kind = get_arg_kind_from_int(arg_kind_i);

    const arg_val_code = code_mirror.getRange(
      cm_start_pos(given_arg.pos, cell_lineno),
      cm_end_pos(given_arg.pos, cell_lineno)
    );

    return {
      name: given_arg["name"] || arg_names[arg_i_at_func_def],
      required: arg_kind == "ARG_POS" || arg_kind == "ARG_NAMED", // For args given by keyword, we'd have to look up the original definition to know if the keyword arg is required. Required keyword args are rare, so let's not worry about it.
      is_positional: given_arg.name == null,
      kind: arg_kind,
      code: arg_val_code,
      type: call_info.callee.arg_types[arg_i_at_func_def],
      code_type: null,
      type_compatible_code_snippets:
        call_info.callee.type_compatible_code_snippets_by_arg_i[arg_i_at_func_def],
    };
  });
}

export function segment_args(
  callee: CallableType & {
    pos: Position;
  },
  given_positional_args: Arg[],
  given_keyword_args: Arg[]
) {
  let arg_defaults = arg_defaults_from_callee_type(callee);

  const kwargs_alias = arg_defaults.find(arg => arg.name == "kwargs");

  const kwargs_items = (
    (kwargs_alias?.type as TypeAliasType)?.resolved as TypedDictType
  )?.items;

  const kwargs: Arg[] | null = kwargs_items
    ? kwargs_items.map(([name, item]) => {
        return {
          name,
          kind: "ARG_NAMED",
          code: kwargs_alias!.code,
          type: item,
          code_type: kwargs_alias!.code_type,
          type_compatible_code_snippets: [],
          is_positional: false,
          required: false,
        };
      })
    : null;

  arg_defaults = arg_defaults.filter(arg => arg.name != "kwargs");

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
    needed_positional_args,
    missing_optional_positional_args,
    missing_keyword_args,
    kwargs,
  };
}
