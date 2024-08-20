import { add_sync_code_on_change_watcher } from "../../code_sync/code_sync";
import {
  Arg,
  ArgView,
  CallInfo,
  CallView,
  CallWithArgs,
  State,
} from "../../types";
import {
  create_el,
  cm_end_pos,
  cm_start_pos,
  number_to_string_not_ugly,
  sig_figs,
} from "../../utils/misc";
import {
  arg_view_to_code,
  create_arg_view,
  enable_arg_view,
} from "../arg/arg";
import {
  collapse_collapsable,
  create_collapsable_els,
  open_collapsable,
} from "../collapsable/collapsable";
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
export function id_as_new_call(call: CallInfo) {
  return id_of_new_call(call.func_code, call.call.pos.line);
}

// 20 | ax.bar(...) -> "ax.bar at line 20"
export function id_of_new_call(func_code: string, line_no: number): string {
  return `${func_code} at line ${line_no}`;
}



/**
 * Creates a call in the sidebar. e.g.
 *
 * ax.barh
 *   - y=data[0]
 *   - heights=data[1]
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

  const { el: call_el, body_el, header_el } = create_collapsable_els();
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

  const add_args = (args: Arg[], disabled: boolean) => {
    args.forEach(arg => {
      const arg_view = create_arg_view(arg, call.call_info.docstring, {disabled});
      body_el.append(arg_view.el);
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

  // Don't need the below, **args are flattened into the keyword args
  // if (kwargs != null) {
  //   const kwargs_collapsable = create_collapsable_els();
  //   kwargs_collapsable.el.classList.add("snp-kwargs");

  //   collapse_collapsable(kwargs_collapsable.el);

  //   body_el.append(kwargs_collapsable.el);
  //   const kwargs_label = create_el(
  //     "div",
  //     "snp-call-kwargs-label",
  //     kwargs_collapsable.header_el
  //   );
  //   kwargs_label.innerText = "See more";

  //   kwargs.forEach(arg => {
  //     const arg_view = create_arg_view(arg, {disabled: true});
  //     kwargs_collapsable.body_el.append(arg_view.el);
  //     arg_and_views.push({ arg, view: arg_view });
  //   });
  // }

  const call_view: CallView = {
    els: {
      el: call_el,
      header_el,
      name_el: name_el,
      body_el,
    },
    is_elided: false,
    mark: mark,
    arguments: arg_and_views,
  };

  add_sync_code_on_change_watcher(() => call_to_code(call_view), [mark], state);

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

export function perhaps_get_drag_xy_handler(call_view: CallView) : undefined | ((fig_px: [number, number], delta_px: [number, number], boundses: Boundses) => void) {

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

      return (fig_px, delta_px, boundses: Boundses) => {
        enable_arg_view(view);

        const [fig_x0,  fig_y0,  fig_x1,  fig_y1]  = boundses.fig_px_bounds;
        const [axes_x0, axes_y0, axes_x1, axes_y1] = boundses.axes_px_bounds;

        const [mouse_fig_x, mouse_fig_y] = fig_px;
        // const [mouse_dx,    mouse_dy]    = delta_px;

        // Relative mouse position inside of axes, from 0 to 1
        const mouse_x = (mouse_fig_x - (axes_x0 - fig_x0)) / (axes_x1 - axes_x0) - 0.05; // Not quite the corner
        const mouse_y = (mouse_fig_y - (axes_y0 - fig_y0)) / (axes_y1 - axes_y0) - 0.05; // Not quite the corner

        view.widget.set_code(`(${number_to_string_not_ugly(sig_figs(mouse_x, 2))}, ${number_to_string_not_ugly(sig_figs(mouse_y, 2))})`);
      };
    }
  }
  return undefined;
}


export function perhaps_get_drag_x_handler(call_view: CallView) : undefined | ((fig_px: number, delta_px: number, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  let perhaps_view = first_ten_args.find(({ arg }) => arg.name == 'x')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view, 'x') : undefined;
}

export function perhaps_get_drag_y_handler(call_view: CallView) : undefined | ((fig_px: number, delta_px: number, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  let perhaps_view = first_ten_args.find(({ arg }) => arg.name == 'y')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view, 'y') : undefined;
}

export function perhaps_get_drag_width_handler(call_view: CallView) : undefined | ((fig_px: number, delta_px: number, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  let perhaps_view = first_ten_args.find(({ arg }) => arg.name == 'width')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view, 'x') : undefined;
}

export function perhaps_get_drag_height_handler(call_view: CallView) : undefined | ((fig_px: number, delta_px: number, boundses: Boundses) => void) {

  const first_ten_args = call_view.arguments.slice(0, 10);

  let perhaps_view = first_ten_args.find(({ arg }) => arg.name == 'height')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view, 'y') : undefined;
}


function drag_handler_for_arg_view(view: ArgView, x_or_y: 'x' | 'y') : ((fig_px: number, delta_px: number, boundses: Boundses) => void) {
  const starting_arg_code = view.widget.to_code();

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

  return (_fig_px, delta_px, boundses: Boundses) => {
    enable_arg_view(view);

    // Convert pixels to the units of the axes
    const [x_min,    y_min,    x_max,    y_max]    = boundses.axes_unit_bounds;
    const [x_min_px, y_min_px, x_max_px, y_max_px] = boundses.axes_px_bounds;

    // y inverted
    const units_per_px = x_or_y == 'x' ? (x_max - x_min) / (x_max_px - x_min_px) : -(y_max - y_min) / (y_max_px - y_min_px);

    const new_number = delta_px === 0 ? starting_number : sig_figs(starting_number + delta_px*units_per_px, 2);
    let new_arg_code: string;
    if (code_lhs === undefined) { // code is bare literal number
      new_arg_code = number_to_string_not_ugly(new_number);
    } else if (new_number === 0) {
      new_arg_code = code_lhs;
    } else {
      new_arg_code = `${code_lhs.trimEnd()} + ${number_to_string_not_ugly(new_number)}`;
    }
    view.widget.set_code(new_arg_code);
  };
}
