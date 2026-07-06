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
  arg_view_to_code,
  create_arg_view,
  enable_arg_view,
  // make_proxy_arg_el,
  // make_proxy_arg_view,
} from "../arg/arg";
import { Boundses } from "../hover-regions/hover_regions";
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


  name_el.innerText = call.call_info.func_code;
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

export function call_to_code(call_view: CallView) : string {
  const func_code = call_view.els.name_el.innerText;
  const args_str =
    call_view.arguments.
      filterMap(({ arg, view }) => view.disabled ? null : arg_view_to_code(arg, view)).
      join(", ");

  return `${func_code}(${args_str})`;
}

// The handling for dragging on the plot has to be routed through the layers UI element because all the logic
// for attaching the arguments to the code is buried there, including adding new args and modifying current args.

export function perhaps_get_drag_xy_handler(call_view: CallView) : undefined | ((client_px_in_fig: [number, number], delta_px: [number, number], fig_bb: DOMRect, boundses: Boundses) => void) {

  // move legend handler
  //
  // changed legend loc to e.g. (0.5, 0.5) which is the bot left corner, relative to the axes bounds
  if (call_view.els.name_el.innerText.endsWith(".legend")) {
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
        const [axes_x0, axes_y0, axes_x1, axes_y1] = boundses.axes_px_bounds;

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


export function perhaps_get_drag_x_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  const perhaps_x_view = first_ten_args.find(({ arg }) => arg.name == 'x')?.view;
  if (perhaps_x_view) {
    return drag_handler_for_arg_view(perhaps_x_view, 'x', false);
  }

  return undefined;
}

export function perhaps_get_drag_y_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  let perhaps_view = first_ten_args.find(({ arg }) => arg.name == 'y')?.view;

  let coord_sys: 'axes_units' | 'axes_size' = 'axes_units'

  // the y for ax.set_title is relative to the axes height
  if (call_view.els.name_el.innerText.endsWith(".set_title")) {
    coord_sys = 'axes_size'
  }

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view, 'y', false, coord_sys) : undefined;
}

export function perhaps_get_drag_left_edge_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  const perhaps_xmin_view = first_ten_args.find(({ arg }) => arg.name == 'xmin')?.view;
  if (perhaps_xmin_view) {
    return drag_handler_for_arg_view(perhaps_xmin_view, 'x', false);
  }

  const perhaps_left_view = first_ten_args.find(({ arg }) => arg.name == 'left')?.view;
  if (perhaps_left_view) {
    return drag_handler_for_arg_view(perhaps_left_view, 'x', false);
  }

  const perhaps_width_view = first_ten_args.find(({ arg }) => arg.name == 'width')?.view;
  if (perhaps_width_view) {
    return drag_handler_for_arg_view(perhaps_width_view, 'x', true);
  }

  return undefined;
}

export function perhaps_get_drag_right_edge_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  const perhaps_xmax_view = first_ten_args.find(({ arg }) => arg.name == 'xmax')?.view;
  if (perhaps_xmax_view) {
    return drag_handler_for_arg_view(perhaps_xmax_view, 'x', false);
  }

  const perhaps_right_view = first_ten_args.find(({ arg }) => arg.name == 'right')?.view;
  if (perhaps_right_view) {
    return drag_handler_for_arg_view(perhaps_right_view, 'x', false);
  }

  const perhaps_width_view = first_ten_args.find(({ arg }) => arg.name == 'width')?.view;
  if (perhaps_width_view) {
    return drag_handler_for_arg_view(perhaps_width_view, 'x', false);
  }

  return undefined;
}

export function perhaps_get_drag_top_edge_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  const perhaps_ymax_view = first_ten_args.find(({ arg }) => arg.name == 'ymax')?.view;
  if (perhaps_ymax_view) {
    return drag_handler_for_arg_view(perhaps_ymax_view, 'y', false);
  }

  const perhaps_top_view = first_ten_args.find(({ arg }) => arg.name == 'top')?.view;
  if (perhaps_top_view) {
    return drag_handler_for_arg_view(perhaps_top_view, 'y', false);
  }

  const perhaps_height_view = first_ten_args.find(({ arg }) => arg.name == 'height')?.view;
  if (perhaps_height_view) {
    return drag_handler_for_arg_view(perhaps_height_view, 'y', false);
  }

  return undefined;
}

export function perhaps_get_drag_bottom_edge_handler(call_view: CallView) : undefined | ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  const perhaps_ymin_view = first_ten_args.find(({ arg }) => arg.name == 'ymin')?.view;
  if (perhaps_ymin_view) {
    return drag_handler_for_arg_view(perhaps_ymin_view, 'y', false);
  }

  const perhaps_bottom_view = first_ten_args.find(({ arg }) => arg.name == 'bottom')?.view;
  if (perhaps_bottom_view) {
    return drag_handler_for_arg_view(perhaps_bottom_view, 'y', false);
  }

  const perhaps_height_view = first_ten_args.find(({ arg }) => arg.name == 'height')?.view;
  if (perhaps_height_view) {
    return drag_handler_for_arg_view(perhaps_height_view, 'y', true);
  }

  return undefined;
}


function drag_handler_for_arg_view(view: ArgView, x_or_y: 'x' | 'y', reversed: boolean = false, coord_sys: 'axes_units' | 'axes_size' = 'axes_units') : ((client_px_in_fig: number, delta_px: number, fig_bb: DOMRect, boundses: Boundses) => void) {
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
    starting_number = 0;
    code_lhs = starting_arg_code;
  }

  return (_client_px_in_fig, delta_px, fig_bb: DOMRect, boundses: Boundses) => {
    enable_arg_view(view);

    // Convert pixels to the units of the axes
    const [x_min,    y_min,    x_max,    y_max]    = boundses.axes_unit_bounds;
    const [x_min_px, y_min_px, x_max_px, y_max_px] = boundses.axes_px_bounds;

    // If at higher DPI, these are not 1-to-1
    const [fig_x0,  _fig_y0,  fig_x1,  _fig_y1]  = boundses.fig_px_bounds;
    const client_px_per_fig_px = fig_bb.width / (fig_x1 - fig_x0);
    let units_per_fig_px: number;
    if (coord_sys == 'axes_units') {
      // y inverted
      units_per_fig_px = x_or_y == 'x' ? (x_max - x_min) / (x_max_px - x_min_px) : -(y_max - y_min) / (y_max_px - y_min_px);
    } else if (coord_sys = 'axes_size') {
      // y inverted
      units_per_fig_px = x_or_y == 'x' ? 1 / (x_max_px - x_min_px) : -1 / (y_max_px - y_min_px);
    } else {
      throw new Error(`drag_handler_for_arg_view this shouldn't happen ${coord_sys}`);
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
