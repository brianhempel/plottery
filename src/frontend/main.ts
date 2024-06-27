import { create_layers_panel, layer_from_typed_node } from "./layer_panel/layer_panel";
import { set_artist_parent_ids } from "./sidebar/artist/artist";
import { make_plot_widgets } from "./sidebar/plot-widget/plot_widget";
// import { focus_on_call_from_code } from "./sidebar/sidebar";
import "./snp.css";
import {
  Arg,
  DynamicCallInfo,
  CallWithArgs,
  CallableType,
  MethodWithArgs,
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
  get_shortest_qualified_name,
  item_to_end_pos,
  item_to_start_pos,
} from "./utils/misc";
import { JupyterType, get_arg_kind_from_int } from "./utils/types";
import * as deserialize from "./utils/deserialize";
import { attach_events_to_hover_regions, place_add_method_buttons_on_plot } from "./sidebar/hover-regions/hover_regions";


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
    selectable_artists: SelectableArtist[];
    methods: MethodInfoWithType[];
    calls: DynamicCallInfo[];
  },
  notebook_typed_defs: Type[]
) {
  console.log("user_call_type_info", user_call_type_info);
  console.log("sidebar_stuff", sidebar_stuff);

  // ...Initialize some globals
  (window as any)["snp_persistent_artists"] =
    (window as any)["snp_persistent_artists"] ?? {};
  (window as any)["snp_persistent_calls"] =
    (window as any)["snp_persistent_calls"] ?? {};

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

    selectable_artists: sidebar_stuff.selectable_artists,
    methods: get_methods(sidebar_stuff.methods, sidebar_stuff.selectable_artists),

    layers_panel: create_layers_panel([]),

    calls: sidebar_stuff.calls,
    calls_with_args: [],

    busy: false,

    snp_outer: snp_outer,
    hover_regions_container: snp_outer.querySelector(".hover_regions")!,
    hover_regions_svg: () => state.hover_regions_container.querySelector("svg") as SVGElement | undefined,
    set_hover_regions_html: (html_svg_str: string) => { state.hover_regions_container.innerHTML = html_svg_str; },

    sidebar_el: create_el("div", "snp-sidebar", snp_outer),
    stdout_stderr: snp_outer.querySelector(".stdout_stderr")!,
  };

  // Put stdout_stderr at the bottom
  state.stdout_stderr.remove();
  snp_outer.append(state.stdout_stderr);

  // Set artist.parent_id on all artists
  set_artist_parent_ids(state.selectable_artists);

  // Get all calls and methods for artists
  // state.calls_and_methods_by_artist = calls_and_methods_by_artist(state);
  console.log("State", state);

  // const calls_with_args = user_call_type_info.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror))
  // state.layers = notebook_ast.body.map(stmt => layer_from_ast_node(calls_with_args, stmt, state));

  // log the number of keys in notebook_typed_defs
  console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs).length);
  console.log("notebook_typed_defs keys", Object.keys(notebook_typed_defs));

  state.notebook_typed_defs = deserialize.python_objects_to_js(notebook_typed_defs);

  state.calls_with_args = sidebar_stuff.calls.map(call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror));

  const layers = state.notebook_typed_defs.filterMap(typed_node =>
    typed_node.line >= cell_lineno ? layer_from_typed_node(typed_node, state) : null
  );

  state.layers_panel = create_layers_panel(layers);

  state.sidebar_el.append(state.layers_panel.el);


  // state.sidebar = create_sidebar(
  //   state.all_calls_and_methods,
  //   state.selectable_artists,
  //   state
  // );
  // state.snp_outer.append(state.sidebar.el);

  // state.hover_regions = undefined;

  // Make plot widgets on those hover regions
  make_plot_widgets(state);

  place_add_method_buttons_on_plot(state);

  attach_events_to_hover_regions(state);


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

// export function calls_and_methods_by_artist(state: State): {
//   [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
// } {
//   let all_calls_and_methods: {
//     [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
//   } = {};

//   state.selectable_artists.forEach(artist => {
//     const artist_call_infos = state.calls.filter(call_info => {
//       return call_info.show_on.at(-1) == artist.id;
//     });

//     let artist_method_infos = state.methods.filter(method => {
//       return method.show_on.at(-1) == artist.id;
//     });

//     const artist_calls = artist_call_infos.map(
//       call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror)
//     )

//     let artist_methods = get_methods(
//       artist_method_infos,
//       state.selectable_artists
//     );

//     // Filter out methods that're already called
//     artist_methods = artist_methods.filter(method => {
//       const is_already_called = artist_calls.find(
//         call =>
//           call.call_info.loc_via_func_code_and_num[0] ==
//           `${method.receiver_name}.${method.method_info.name}`
//       );

//       return !(method.method_info.max_calls == 1 && is_already_called);
//     });

//     all_calls_and_methods[artist.id] = {
//       calls: artist_calls,
//       methods: artist_methods,
//     };
//   });

//   return all_calls_and_methods;
// }

export function get_methods(
  method_infos: MethodInfoWithType[],
  artists: SelectableArtist[],
): MethodWithArgs[] {
  return method_infos.map(method_info => {
    let receiver_name = get_shortest_qualified_name(
      artists.find(other_artist => other_artist.id == method_info.receiver)?.names || [""]
    );

    let arg_defaults = arg_defaults_from_callee_type(method_info.type);

    let [required_positional_arg, required_keyword_args] =
      arg_defaults.filter(
        arg => arg.kind == "ARG_POS" || arg.kind == "ARG_NAMED"
      ).partition(arg => arg.kind == "ARG_POS");

    let required_positional_arg_codes = required_positional_arg.map(
      arg => arg.code
    );

    let required_keyword_arg_codes = required_keyword_args.map(
      arg => `${arg.name}=${arg.code}`
    );

    let code_prefix = `${receiver_name}.${method_info.name}`;
    let code = `${code_prefix}(${required_positional_arg_codes
      .concat(required_keyword_arg_codes)
      .join(",")})\n`;

    return {
      method_info,
      code,
      required_positional_arg,
      required_keyword_args,
      receiver_name,
    };
  });
}

export function call_info_to_call_with_args<call_info_type extends (DynamicCallInfo | StaticCallTypeInfo)>(
  call_info: call_info_type,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): CallWithArgs<call_info_type> {
  const args = get_args(call_info, cell_lineno, code_mirror);

  const [given_positional_args, given_keyword_args] =
    args.filter(arg => arg.name != "kwargs").partition(arg => arg.is_positional);

  const {
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs,
  } = segment_args(
    call_info.callee,
    given_positional_args,
    given_keyword_args
  );

  return {
    call_info,
    given_positional_args,
    given_keyword_args,
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs,
  };
}

export function get_args(
  call_info: StaticCallTypeInfo | DynamicCallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): Arg[] {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== undefined;

  return call_info.given_args.map((given_arg, arg_i: number) => {
    const arg_kind = get_arg_kind_from_int(given_arg.kind);
    const arg_i_at_func_def =
      given_arg["name"] ? call_info.callee.arg_names.indexOf(given_arg.name) : (callee_has_self_arg ? arg_i + 1 : arg_i);

    const arg_val_code = code_mirror.getRange(
      item_to_start_pos(given_arg, cell_lineno),
      item_to_end_pos(given_arg, cell_lineno)
    );

    return {
      name: call_info.callee.arg_names[arg_i_at_func_def],
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
        };
      })
    : null;

  arg_defaults = arg_defaults.filter(arg => arg.name != "kwargs");

  const missing_positional_args =
    arg_defaults.slice(given_positional_args.length).takeWhile(arg => arg.kind === "ARG_POS");
      // we could also look for arg.kind === "ARG_OPT" here,
      // but optional positional args look nicer when given as keyword args

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      arg => !given_keyword_args.some(given_arg => given_arg.name === arg.name)
    );
  // .filter(arg => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  // if used for a new call, required args need to be generated
  let needed_positional_args =
    missing_positional_args.takeWhile(arg => arg.kind === "ARG_POS");

  let missing_optional_positional_args = missing_positional_args.slice(
    needed_positional_args.length
  );

  return {
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs,
  };
}
