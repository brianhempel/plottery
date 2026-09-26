import { add_sync_code_on_change_watcher } from "../../code_sync/code_sync";
import { select_call_view } from "../../layer_panel/layer_panel";
import { set_properties_panel_on } from "../../properties_panel/properties_panel";
import {
  Arg,
  ArgView,
  CallInfo,
  CallView,
  CallWithArgs,
  State,
  Type,
} from "../../types";
import { log_event, rate_limit } from "../../utils/instrumentation";
import {
  create_el,
  cm_end_pos,
  cm_start_pos,
  number_to_string_not_ugly,
  sig_figs,
  maybe_round_number,
} from "../../utils/misc";
import {
  create_arg_view,
  enable_arg_view,
  // make_proxy_arg_el,
  // make_proxy_arg_view,
} from "../arg/arg";
import { Boundses } from "../hover-regions/hover_regions";
import { capture_call_layout, render_call_layout } from "./call_layout";
import "./call.css";


// Reference a call by name and line number.
//
// Used only to identify newly added calls in the code, for
// selecting them after SNP regenerates on the cell re-run.
// So it's quite transient.
//
// We can't use call_id because it's hard to compute the appropriate call number
// for a new call that doesn't exist yet. BUT we can't get rid of call_id and
// use the below everywhere because call number is more robust to other kind of code changes
// than line number.
//
// Line number here is relative to the notebook, not the cell.
export function id_as_new_call(call_info: CallInfo) {
  return id_of_new_call(call_info.func_code, call_info.call.pos.line);
}

// 20 | ax.bar(...) -> "ax.bar at line 20"
export function id_of_new_call(func_code: string, line_no: number): string {
  return `${func_code} at line ${line_no}`;
}



/**
 * Creates a call in the sidebar, and its properties below it (which get transplanted to the properties panel)
 */
export function create_call_view(call: CallWithArgs, state: State): CallView {
  const code_mirror = state.cell.code_mirror;
  const cell_lineno = state.cell_lineno;

  // Mark the range of code in cell for when user changes the call
  const mark = code_mirror.markText(
    cm_start_pos(call.call_info.call.pos, cell_lineno),
    cm_end_pos(call.call_info.call.pos, cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
  );

  // Call container

  const call_el = create_el("div", []);
  const header_el = create_el("div", [], call_el);
  // const proxies_el = create_el("div", ["snp-args", "snp-proxy-args"], call_el);
  const properties_el = create_el("div", ["snp-args"], call_el);

  call_el.classList.add("snp-call");
  const name_el = create_el("div", "snp-call-name", header_el);


  name_el.textContent = call.call_info.func_code;
  name_el.title = call.call_info.docstring || `No docstring available for ${call.call_info.func_code}`;


  // Arguments
  const {
    given_positional_args,
    needed_positional_args,
    missing_optional_positional_args,
    given_keyword_args,
    missing_keyword_args,
  } = call;

  const arg_and_views: { arg: Arg; view: ArgView }[] = [];

  // Synchronously write the call's current widget state into the cell. Used when breaking the
  // first link of a variable-sharing chain (which edits the call argument, and so has no
  // dedicated mark) before a structural rerun. `call_view` is assigned below but only read at
  // call time (on a later click), so the forward reference is safe.
  const flush_call = () => {
    const range = mark.find();
    if (range) code_mirror.replaceRange(call_to_code(call_view), range.from, range.to);
  };

  const add_args = (args: Arg[], disabled: boolean) => {
    args.forEach(arg => {
      const arg_view = create_arg_view(arg, call.call_info.docstring, {disabled}, state, flush_call, mark);
      // const proxy_arg_el = make_proxy_arg_el(arg, arg_view, state);
      properties_el.append(arg_view.el);
      // proxies_el.append(proxy_arg_el);
      arg_and_views.push({ arg, view: arg_view });
    });
  };

  // Positional args
  add_args(given_positional_args, false);
  add_args(needed_positional_args, false);

  // Positional args (optional)
  add_args(missing_optional_positional_args, true);

  // Keyword args
  add_args(given_keyword_args, false);

  // Keyword args (optional)
  add_args(missing_keyword_args, true);

  const call_view: CallView = {
    els: {
      el: call_el,
      header_el,
      name_el: name_el,
      // proxies_el,
      properties_el,
    },
    mark: mark,
    arguments: arg_and_views,
    layout: capture_layout(call, code_mirror, cell_lineno),
  };

  add_sync_code_on_change_watcher(() => call_to_code(call_view), [mark], state);

  // This is redundant with the layer panel, but in theory (and maybe in the future)
  // there may be more than one call per layer
  call_el.addEventListener("click", ev => {
    select_call_view(call_view, state);
    ev.stopPropagation();
    ev.preventDefault();
  });

  return call_view;
}

// Capture the call's formatting (line breaks, comments, etc.) from the cell source so edits
// can rewrite argument values in place. See call_layout.ts.
function capture_layout(call: CallWithArgs, code_mirror: CodeMirror.DocOrEditor, cell_lineno: number): CallView["layout"] {
  const call_pos = call.call_info.call.pos;
  const call_start = cm_start_pos(call_pos, cell_lineno);
  const text = code_mirror.getRange(call_start, cm_end_pos(call_pos, cell_lineno));
  const offset_in_call = (pos: CodeMirror.Position) => code_mirror.getRange(call_start, pos).length;

  const given_args = [...call.given_positional_args, ...call.given_keyword_args];
  given_args.sort((a, b) => a.pos!.line - b.pos!.line || a.pos!.column - b.pos!.column);

  const arg_ranges = given_args.map(arg => [
    offset_in_call(cm_start_pos(arg.pos!, cell_lineno)),
    offset_in_call(cm_end_pos(arg.pos!, cell_lineno)),
  ] as [number, number]);
  const callee_end = offset_in_call(cm_end_pos(call.call_info.callee.pos, cell_lineno));

  return { call_layout: capture_call_layout(text, callee_end, arg_ranges), given_args };
}

export function call_to_code(call_view: CallView) : string {
  const { call_layout, given_args } = call_view.layout;
  const given: { slot: number; value: string }[] = [];
  const new_positional: { value: string }[] = [];
  const new_keyword: { prefix: string; value: string }[] = [];
  call_view.arguments.forEach(({ arg, view }) => {
    if (view.disabled) return;
    const value = view.widget.to_code();
    const slot = given_args.indexOf(arg);
    if (slot !== -1)          given.push({ slot, value });
    else if (view.positional) new_positional.push({ value });
    else                      new_keyword.push({ prefix: `${arg.name}=`, value });
  });
  return render_call_layout(call_layout, given, new_positional, new_keyword);
}

// The handling for dragging on the plot has to be routed through the layers UI element because all the logic
// for attaching the arguments to the code is buried there, including adding new args and modifying current args.

export function perhaps_get_drag_xy_handler(call_view: CallView) : undefined | ((client_px_in_fig: [number, number], delta_px: [number, number], fig_bb: DOMRect, boundses: Boundses) => void) {

  // move legend handler
  //
  // changed legend loc to e.g. (0.5, 0.5) which is the bot left corner, relative to the axes bounds
  if ((call_view.els.name_el.textContent ?? "").endsWith(".legend")) {
    let perhaps_view = call_view.arguments.find(({ arg }) => arg.name == 'loc')?.view;

    if (perhaps_view) {
      const view = perhaps_view;
      // const starting_arg_code = widget_to_code(view.widget);
      // let [starting_x, starting_y] = starting_arg_code.replaceAll(/\(\[\]\)\s/g,'').split(",").map(parseFloat);
      // if (starting_x === undefined || starting_y === undefined || isNaN(starting_x) || isNaN(starting_y)) {
      //   [starting_x, starting_y] = [NaN, NaN];
      // }

      return (client_px_in_fig: [number, number], delta_px: [number, number], fig_bb: DOMRect, boundses: Boundses) => {
        enable_arg_view(view);

        const [fig_x0,  fig_y0,  fig_x1,  fig_y1]  = boundses.fig_px_bounds;
        const [axes_x0, axes_y0, axes_x1, axes_y1] = boundses.axes_px_bounds ?? boundses.fig_px_bounds; // A figure legend's loc is relative to the figure

        const [mouse_x, mouse_y] = client_px_in_fig;
        // const [mouse_dx,    mouse_dy]    = delta_px;

        // If at higher DPI, these are not 1-to-1
        const client_px_per_fig_px = fig_bb.width / (fig_x1 - fig_x0);

        // Relative mouse position inside of axes, from 0 to 1
        const mouse_axes_x = (mouse_x / client_px_per_fig_px - (axes_x0 - fig_x0)) / (axes_x1 - axes_x0) - 0.05; // Not quite the corner
        const mouse_axes_y = (mouse_y / client_px_per_fig_px - (axes_y0 - fig_y0)) / (axes_y1 - axes_y0) - 0.05; // Not quite the corner

        const arg_code = `(${number_to_string_not_ugly(sig_figs(mouse_axes_x, 2))}, ${number_to_string_not_ugly(sig_figs(mouse_axes_y, 2))})`
        view.widget.set_code(arg_code);

        rate_limit("dragging", 500, () => { log_event("gui", "on-plot dragging", {arg: "loc", arg_code, drag_direction: "xy"}); });
      };
    }
  }
  return undefined;
}


type DragHandler1D = (client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void;

export function perhaps_get_drag_x_handler(call_view: CallView) : undefined | DragHandler1D {
  return first_drag_handler(call_view, 'x', [['x', false]]);
}

export function perhaps_get_drag_y_handler(call_view: CallView) : undefined | DragHandler1D {
  // the y for ax.set_title is relative to the axes height
  const coord_sys = (call_view.els.name_el.textContent ?? "").endsWith(".set_title") ? 'axes_size' : 'axes_units';

  return first_drag_handler(call_view, 'y', [['y', false]], coord_sys);
}

export function perhaps_get_drag_left_edge_handler(call_view: CallView) : undefined | DragHandler1D {
  return first_drag_handler(call_view, 'x', [['xmin', false], ['left', false], ['width', true]]);
}

export function perhaps_get_drag_right_edge_handler(call_view: CallView) : undefined | DragHandler1D {
  return first_drag_handler(call_view, 'x', [['xmax', false], ['right', false], ['width', false]]);
}

export function perhaps_get_drag_top_edge_handler(call_view: CallView) : undefined | DragHandler1D {
  return first_drag_handler(call_view, 'y', [['ymax', false], ['top', false], ['height', false]]);
}

export function perhaps_get_drag_bottom_edge_handler(call_view: CallView) : undefined | DragHandler1D {
  return first_drag_handler(call_view, 'y', [['ymin', false], ['bottom', false], ['height', true]]);
}

// Handler for the first of the candidate args (among the call's first ten) that can be dragged.
// An arg whose code can't take a `+ N` (e.g. a list) is skipped in favor of the next candidate.
function first_drag_handler(call_view: CallView, x_or_y: 'x' | 'y', candidates: [arg_name: string, reversed: boolean][], coord_sys: 'axes_units' | 'axes_size' = 'axes_units') : undefined | DragHandler1D {

  const first_ten_args = call_view.arguments.slice(0, 10);

  for (const [arg_name, reversed] of candidates) {
    const arg_and_view = first_ten_args.find(({ arg }) => arg.name == arg_name);
    const handler = arg_and_view && drag_handler_for_arg_view(arg_and_view.arg, arg_and_view.view, x_or_y, reversed, coord_sys);
    if (handler) { return handler; }
  }

  return undefined;
}

// Whether code of this type might take a `+ N`. Only rules out types we know can't (lists,
// strings, ...), so unknowns like an untyped pandas column (AnyType) stay draggable.
function type_could_be_number(type: Type) : boolean {
  switch (type[".class"]) {
    case "Instance":      return !["builtins.list", "builtins.tuple", "builtins.str", "builtins.bytes", "builtins.dict", "builtins.set", "builtins.frozenset", "builtins.range"].includes(type.type_ref);
    case "TupleType":
    case "TypedDictType": return false;
    case "LiteralType":   return type_could_be_number(type.fallback); // Literal["left"] falls back to builtins.str
    case "TypeAliasType": return type_could_be_number(type.resolved);
    case "UnionType":     return type.items.every(type_could_be_number);
    default:              return true; // AnyType, NoneType (which snp.py also sends when mypy has no type), etc.
  }
}

// Returns undefined if the arg's code can't be dragged, rather than generating code that would crash on rerun (e.g. `[1, 2, 3] + 0.5`).
function drag_handler_for_arg_view(arg: Arg, view: ArgView, x_or_y: 'x' | 'y', reversed: boolean = false, coord_sys: 'axes_units' | 'axes_size' = 'axes_units') : undefined | DragHandler1D {
  // If the value reached this arg through variables ending in a numeric literal (e.g. w2 ▸ w1 ▸ 0.5),
  // direct manipulation edits that trailing literal (the last chain link) in place; otherwise it edits
  // the arg's own code via the usual EXPR + NUMBER scheme on the first widget. Only consider links that
  // are still active (an upstream edit may have torn down the trailing literal).
  const last_link = view.chain_links?.filter(l => l.active).at(-1);
  const target_widget = (last_link && last_link.widget.to_code().trim().match(/^-?[0-9\.]+$/))
    ? last_link.widget
    : view.widget;

  const starting_arg_code = target_widget.to_code();

  // The branches below will set these two, based on what kind of code we have
  let code_lhs: string | undefined = undefined;
  let starting_number: number = 0;

  // Match literal number
  let literal_only_match = starting_arg_code.trim().match(/^-?[0-9\.]+$/);

  // Match starting_arg_code with "STUFF + NUMBER" (or flipped) so we don't keep adding + x + x + x on every new drag
  let stuff_plus_lit_match = starting_arg_code.match(/^(?<stuff>.*)\s*\+\s*(?<number>-?[0-9\.]+)\s*$/) ||
    starting_arg_code.match(/^\s*(?<number>-?[0-9\.]+)\s*\+\s*(?<stuff>.*)\s*$/);

  if (literal_only_match) {
    code_lhs = undefined; // there is no non-numeric stuff
    starting_number = parseFloat(literal_only_match[0]);
  } else if (stuff_plus_lit_match) {
    code_lhs = stuff_plus_lit_match.groups!["stuff"].trim();
    starting_number = parseFloat(stuff_plus_lit_match.groups!["number"]);
  } else { // code has no number in it yet
    // Only start an EXPR + NUMBER if EXPR might be a number. arg.code_type is from the last full
    // render, so only trust it while the code is unchanged since then (e.g. not edited in the properties panel).
    const code_type_is_current = !!arg.code_type && starting_arg_code.trim() == arg.code.trim();
    if (!code_type_is_current || !type_could_be_number(arg.code_type!) || starting_arg_code.trim() == "None") {
      return undefined;
    }
    starting_number = 0;
    code_lhs = starting_arg_code;
  }

  return (_client_px_in_fig, delta_px, fig_bb: DOMRect, boundses: Boundses) => {
    enable_arg_view(view);

    // If at higher DPI, these are not 1-to-1
    const [fig_x0,  fig_y0,  fig_x1,  fig_y1]  = boundses.fig_px_bounds;
    const client_px_per_fig_px = fig_bb.width / (fig_x1 - fig_x0);

    // Convert pixels to the units of the axes
    let units_per_fig_px: number;
    if (!boundses.axes_px_bounds || !boundses.axes_unit_bounds) {
      // Not in an axes (fig.suptitle, fig.text, ...), so x and y are fractions of the figure. y inverted
      units_per_fig_px = x_or_y == 'x' ? 1 / (fig_x1 - fig_x0) : -1 / (fig_y1 - fig_y0);
    } else {
      const [x_min,    y_min,    x_max,    y_max]    = boundses.axes_unit_bounds;
      const [x_min_px, y_min_px, x_max_px, y_max_px] = boundses.axes_px_bounds;
      if (coord_sys == 'axes_units') {
        // y inverted
        units_per_fig_px = x_or_y == 'x' ? (x_max - x_min) / (x_max_px - x_min_px) : -(y_max - y_min) / (y_max_px - y_min_px);
      } else if (coord_sys == 'axes_size') {
        // y inverted
        units_per_fig_px = x_or_y == 'x' ? 1 / (x_max_px - x_min_px) : -1 / (y_max_px - y_min_px);
      } else {
        throw new Error(`drag_handler_for_arg_view this shouldn't happen ${coord_sys}`);
      }
    }

    if (reversed) { delta_px = -delta_px; }
    const delta_per_px = units_per_fig_px/client_px_per_fig_px;
    console.log(`delta_per_px: ${delta_per_px}`);
    const new_number = delta_px === 0 ? starting_number : sig_figs(maybe_round_number(starting_number + delta_px*delta_per_px, delta_per_px*3), 2);
    let new_arg_code: string;
    if (code_lhs === undefined) { // code is bare literal number
      new_arg_code = number_to_string_not_ugly(new_number);
    } else if (new_number === 0) {
      new_arg_code = code_lhs;
    } else {
      new_arg_code = `${code_lhs.trimEnd()} + ${number_to_string_not_ugly(new_number)}`;
    }
    target_widget.set_code(new_arg_code);

    rate_limit("dragging", 500, () => { log_event("gui", "on-plot dragging", {arg: view.el.querySelector('.snp-arg-name')?.textContent || '', arg_code: new_arg_code, drag_direction: x_or_y}); });
  };
}
