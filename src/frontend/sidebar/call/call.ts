import { add_sync_code_on_change_watcher, sync_code_range } from "../../code_sync/code_sync";
import {
  Arg,
  ArgView,
  CallView,
  CallViewEls,
  CallWithArgs,
  DynamicCallInfo,
  State,
} from "../../types";
import {
  create_el,
  cm_end_pos,
  cm_start_pos,
  sig_figs,
} from "../../utils/misc";
import {
  arg_view_to_code,
  create_arg_view,
  enable_arg_view,
  disable_arg_view,
} from "../arg/arg";
import {
  collapse_collapsable,
  create_collapsable_els,
  open_collapsable,
} from "../collapsable/collapsable";
import { change_widget_code, widget_to_code } from "../widgets/widget";
import "./call.css";

// by name and line number
export function get_code_and_loc_for_call(call: DynamicCallInfo) {
  return `${call.loc_via_func_code_and_num[0]}${call.call.pos.line}`;
}

/**
 * Creates a call in the sidebar. e.g.
 *
 * ax.barh
 *   - y=data[0]
 *   - heights=data[1]
 */
export function create_call_view(call: CallWithArgs<DynamicCallInfo>, state: State): CallView {
  const code_mirror = state.cell.code_mirror;
  const cell_lineno = state.cell_lineno;

  // Mark the range of code in cell for when user changes the call
  const mark = code_mirror.markText(
    cm_start_pos(call.call_info.call.pos, cell_lineno),
    cm_end_pos(call.call_info.call.pos, cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true }
  );

  // Call container

  const { el: call_el, body_el, header_el } = create_collapsable_els();
  call_el.classList.add("snp-call");
  const name_el = create_el("div", "snp-call-name", header_el);

  name_el.innerText = call.call_info.loc_via_func_code_and_num[0];


  // Arguments
  const {
    given_positional_args,
    given_keyword_args,
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs,
  } = call;

  const arg_and_views: { arg: Arg; view: ArgView }[] = [];

  const add_args = (args: Arg[], positional: boolean, disabled: boolean) => {
    args.forEach(arg => {
      const arg_view = create_arg_view(arg, {positional, disabled: disabled});
      body_el.append(arg_view.el);
      arg_and_views.push({ arg, view: arg_view });
    });
  };

  // Positional args
  add_args(given_positional_args, true, false);
  add_args(needed_positional_args, true, false);

  // Positional args (optional)
  add_args(missing_optional_positional_args, true, true);
  add_args(missing_positional_args, true, true);

  // Keyword args
  add_args(given_keyword_args, false, false);

  // Keyword args (optional)
  add_args(missing_keyword_args, false, true);

  // TODO: Store kwargs_collapsable in call els
  if (kwargs != null) {
    const kwargs_collapsable = create_collapsable_els();
    kwargs_collapsable.el.classList.add("snp-kwargs");

    collapse_collapsable(kwargs_collapsable.el);

    body_el.append(kwargs_collapsable.el);
    const kwargs_label = create_el(
      "div",
      "snp-call-kwargs-label",
      kwargs_collapsable.header_el
    );
    kwargs_label.innerText = "See more";

    kwargs.forEach(arg => {
      const arg_view = create_arg_view(arg, {
        positional: false,
        disabled: true,
      });
      kwargs_collapsable.body_el.append(arg_view.el);
      arg_and_views.push({ arg, view: arg_view });
    });
  }

  // On clicking on a hidden arg view, unhide it
  arg_and_views.forEach(({ view }) => {
    view.el.addEventListener("mousedown", e => {
      if (view.disabled) {
        enable_arg_view(view);
      } else if (e.ctrlKey) {
        disable_arg_view(view);
      }
    });
  });

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

  add_sync_code_on_change_watcher(() => call_to_code(call_view), mark, state);

  return call_view;
}

export function call_to_code(call_view: CallView) : string {
  const call_name = call_view.els.name_el.innerText;
  const args_str =
    call_view.arguments.
      filterMap(({ arg, view }) => view.disabled ? null : arg_view_to_code(arg, view)).
      join(", ");

  return `${call_name}(${args_str})`;
}

// So that 0.1 + 0.2 actually prints 0.3
function number_to_string_not_ugly(n: number) {
  const str = n.toString();

  if (str.match(/\.\d*9999999999\d\d\d$/)) {
    return number_to_string_not_ugly(n * 1.00000000000001);
  }
  return str.replace(/0+000000000\d\d\d$/, "");
}



// The handling for dragging on the plot has to be routed through the layers UI element because all the logic
// for attaching the arguments to the code is buried there, including adding new args and modifying current args.

export function perhaps_get_drag_x_handler(call_view: CallView) : undefined | ((delta: number) => void) {

  let perhaps_view = call_view.arguments.find(({ arg }) => arg.name == 'x')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view) : undefined;
}


export function perhaps_get_drag_width_handler(call_view: CallView) : undefined | ((delta: number) => void) {

  let perhaps_view = call_view.arguments.find(({ arg }) => arg.name == 'width')?.view;

  return perhaps_view ? drag_handler_for_arg_view(perhaps_view) : undefined;
}

function drag_handler_for_arg_view(view: ArgView) : ((delta: number) => void) {
  const starting_arg_code = widget_to_code(view.widget);

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

  return (delta) => {
    enable_arg_view(view);

    const new_number = delta === 0 ? starting_number : sig_figs(starting_number + delta, 2);
    let new_arg_code: string;
    if (code_lhs === undefined) { // code is bare literal number
      new_arg_code = number_to_string_not_ugly(new_number);
    } else if (new_number === 0) {
      new_arg_code = code_lhs;
    } else {
      new_arg_code = `${code_lhs.trimEnd()} + ${number_to_string_not_ugly(new_number)}`;
    }
    change_widget_code(view.widget, new_arg_code);
  };
}
