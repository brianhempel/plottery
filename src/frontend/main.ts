import { set_artist_parent_ids } from "./sidebar/artist/artist";
import { make_hover_regions } from "./sidebar/hover-regions/hover_regions";
import { make_plot_widgets } from "./sidebar/plot-widget/plot_widget";
import { create_sidebar, focus_on_call_from_code } from "./sidebar/sidebar";
import { create_toggles } from "./sidebar/toggles/toggles";
import "./snp.css";
import {
  Arg,
  CallInfo,
  CallWithArgs,
  CallableType,
  MethodInfo,
  MethodWithArgs,
  Position,
  SelectableArtist,
  State,
  TypeAliasType,
  TypedDictType,
} from "./types";
import { partition, takeWhile } from "./utils/array";
import {
  arg_defaults_from_callee_type,
  get_shortest_qualified_name,
  item_to_end_pos,
  item_to_start_pos,
} from "./utils/misc";
import { JupyterType, get_arg_kind_from_int } from "./utils/types";

// These will already exist where we inject the JS in the notebook.
declare const IPython: any;
declare const Jupyter: JupyterType;

// Entry point
function attach_snp(
  snp_outer: HTMLElement,
  cell_lineno: number,
  provenance_is_off_by_n_lines: number,
  user_call_info: any,
  sidebar_stuff: {
    selectable_artists: SelectableArtist[];
    methods: MethodInfo[];
    calls: CallInfo[];
  }
) {
  // ...Initialize some globals
  (window as any)["snp_persistent_artists"] =
    (window as any)["snp_persistent_artists"] ?? {};
  (window as any)["snp_persistent_calls"] =
    (window as any)["snp_persistent_calls"] ?? {};

  // Initialize state
  const state = initialize_state(
    snp_outer,
    cell_lineno,
    provenance_is_off_by_n_lines,
    sidebar_stuff
  );

  // Put stdout_stderr at the bottom
  state.stdout_stderr.remove();
  snp_outer.append(state.stdout_stderr);

  // Set artist.parent_id on all artists
  set_artist_parent_ids(sidebar_stuff.selectable_artists);

  // Get all calls and methods for artists
  state.all_calls_and_methods = get_all_calls_and_methods(state);
  console.log("State", state);

  // Create sidebar
  state.sidebar = create_sidebar(
    state.all_calls_and_methods,
    state.selectable_artists,
    state
  );
  state.snp_outer.append(state.sidebar.els.el);

  // Make hover regions
  state.hover_regions = make_hover_regions(state);

  // Make plot widgets on those hover regions
  make_plot_widgets(state);

  // Create toggles
  create_toggles(state);

  // Focus on call (i.e. expand the sidebar to show the call)
  // e.g. when adding a new method, expand it's call
  const focused_call: string | null = (window as any)["snp_focused_call"];
  if (focused_call != null) {
    focus_on_call_from_code(focused_call, state);
    (window as any)["snp_focused_call"] = null;
  }

  // Suppress additional plot
  setTimeout(() => {
    snp_outer.parentElement?.parentElement?.nextElementSibling?.remove();
  }, 200);
}

function initialize_state(
  snp_outer: HTMLElement,
  cell_lineno: number,
  provenance_is_off_by_n_lines: number,
  sidebar_stuff: {
    selectable_artists: SelectableArtist[];
    methods: MethodInfo[];
    calls: CallInfo[];
  }
): State {
  const cell_el = snp_outer.closest(".code_cell");

  const cell = Jupyter.notebook
    .get_cells()
    .filter(cell => cell.element[0] === cell_el)[0];

  // const hovered_elems = [...snp_outer.querySelectorAll("g")] as SVGGElement[];

  return {
    canvas_selection: null,

    cell: cell,
    cell_lineno: cell_lineno,

    last_cell_code_executed: cell.get_text(),
    provenance_is_off_by_n_lines,

    selectable_artists: sidebar_stuff.selectable_artists,

    methods: sidebar_stuff.methods,
    calls: sidebar_stuff.calls,

    busy: false,

    snp_outer: snp_outer,
    sidebar: undefined,
    stdout_stderr: snp_outer.querySelector(".stdout_stderr")!,
  };
}

(window as any)["attach_snp"] = attach_snp;

export function get_all_calls_and_methods(state: State) {
  let all_calls_and_methods: {
    [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
  } = {};

  state.selectable_artists.forEach(artist => {
    const artist_call_infos = state.calls.filter(call_info => {
      return call_info.show_on.at(-1) == artist.id;
    });

    let artist_method_infos = state.methods.filter(method => {
      return method.show_on.at(-1) == artist.id;
    });

    const artist_calls = get_calls(
      artist,
      artist_call_infos,
      state.cell_lineno,
      state.cell.code_mirror
    );

    let artist_methods = get_methods(
      artist,
      artist_method_infos,
      state.selectable_artists,
      state.cell.code_mirror
    );

    // Filter out methods that're already called
    artist_methods = artist_methods.filter(method => {
      const is_already_called = artist_calls.find(
        call =>
          call.call_info.func_code_and_num[0] ==
          `${method.receiver_name}.${method.method_info.name}`
      );

      return !(method.method_info.max_calls == 1 && is_already_called);
    });

    all_calls_and_methods[artist.id] = {
      calls: artist_calls,
      methods: artist_methods,
    };
  });

  return all_calls_and_methods;
}

export function get_methods(
  artist: SelectableArtist,
  method_infos: MethodInfo[],
  artists: SelectableArtist[],
  code_mirror: CodeMirror.DocOrEditor
): MethodWithArgs[] {
  return method_infos.map(method_info => {
    let receiver_name = get_shortest_qualified_name(
      artists.find(other_artist => other_artist.id == method_info.receiver)!
        .names || [""]
    );

    let arg_defaults = arg_defaults_from_callee_type(method_info.type);

    let [required_positional_arg, required_keyword_args] = partition(
      arg_defaults.filter(
        arg => arg.kind == "ARG_POS" || arg.kind == "ARG_NAMED"
      ),
      arg => arg.kind == "ARG_POS"
    );

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

export function get_calls(
  artist: SelectableArtist,
  artist_call_infos: CallInfo[],
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): CallWithArgs[] {
  return artist_call_infos.map(call_info => {
    const args = get_args(call_info, cell_lineno, code_mirror);

    const [given_positional_args, given_keyword_args] = partition(
      args.filter(arg => arg.name != "kwargs"),
      arg => arg.is_positional
    );

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
  });
}

export function get_args(
  call_info: CallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): Arg[] {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== undefined;

  let args: Arg[] = [];

  call_info.given_args.forEach((given_arg, arg_i: number) => {
    const arg_kind = get_arg_kind_from_int(given_arg.kind);
    const arg_i_at_func_def = given_arg["name"]
      ? call_info.callee.arg_names.indexOf(given_arg.name)
      : callee_has_self_arg
      ? arg_i + 1
      : arg_i;

    const arg_val_code = code_mirror.getRange(
      item_to_start_pos(given_arg, cell_lineno),
      item_to_end_pos(given_arg, cell_lineno)
    );

    args.push({
      name: call_info.callee.arg_names[arg_i_at_func_def],
      is_positional: given_arg.name == null,
      kind: arg_kind,
      code: arg_val_code,
      type: call_info.callee.arg_types[arg_i_at_func_def],
      code_type: undefined,
      type_compatible_local_names:
        call_info.callee.arg_type_compatible_local_names[arg_i_at_func_def],
    });
  });

  return args;
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
          type_compatible_local_names: [],
          is_positional: false,
        };
      })
    : null;

  arg_defaults = arg_defaults.filter(arg => arg.name != "kwargs");

  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    arg => arg.kind === "ARG_POS"
  ); // we could also look for arg.kind === "ARG_OPT" here,
  // but optional positional args look nicer when given as keyword args

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      arg => !given_keyword_args.some(given_arg => given_arg.name === arg.name)
    );
  // .filter(arg => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  // if used for a new call, required args need to be generated
  let needed_positional_args = takeWhile(
    missing_positional_args,
    arg => arg.kind === "ARG_POS"
  );

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
