import { sync_call_code } from "../../code_sync/code_sync";
import {
  Arg,
  ArgView,
  CallView,
  CallViewEls,
  CallWithArgs,
  DynamicCallInfo,
  PersistantCall,
  State,
} from "../../types";
import {
  create_el,
  item_to_end_pos,
  item_to_start_pos,
} from "../../utils/misc";
import {
  arg_view_to_code,
  create_arg_view,
  enable_arg_view as enable_arg_view,
  disable_arg_view as disable_arg_view,
} from "../arg/arg";
import {
  collapse_collapsable,
  create_collapsable_els,
  open_collapsable,
} from "../collapsable/collapsable";
import { get_code_and_loc_for_call } from "../sidebar";
import { change_widget_code, widget_to_code } from "../widgets/widget";
import "./call.css";

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
    item_to_start_pos(call.call_info.call, cell_lineno),
    item_to_end_pos(call.call_info.call, cell_lineno),
    {
      inclusiveLeft: true,
      inclusiveRight: true,
    }
  );

  // Call container

  const { el: call_el, body_el, header_el } = create_collapsable_els();
  call_el.classList.add("snp-call");
  const name_el = create_el("div", "snp-call-name", header_el);

  name_el.innerText = call.call_info.loc_via_func_code_and_num[0];

  const persistent_calls: { [id: string]: PersistantCall } = (window as any)[
    "snp_persistent_calls"
  ];
  const code_and_loc = get_code_and_loc_for_call(call.call_info);

  // If previously expanded, then expand
  if (persistent_calls[code_and_loc]) {
    if (persistent_calls[code_and_loc]?.collapsed) {
      collapse_collapsable(call_el);
    } else {
      open_collapsable(call_el);
    }
  }

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
      const arg_view = create_arg_view(arg, {
        positional,
        disabled: disabled,
      });
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
    if (!view.disabled) return;

    view.el.addEventListener("mousedown", e => {
      if (view.disabled) {
        enable_arg_view(view);
      } else if (e.ctrlKey) {
        disable_arg_view(view);
      }
    });
  });

  // On change of call, check if its code changed
  let curr_code = call_to_code(name_el.innerText, arg_and_views);

  // Sync changes
  function keep_synced() {
    const code = call_to_code(name_el.innerText, arg_and_views);

    if (curr_code != code) {
      sync_call_code(mark, code, state);
      curr_code = code;
    }

    requestAnimationFrame(keep_synced);
  }
  keep_synced();


  return {
    els: {
      el: call_el,
      header_el,
      name_el: name_el,
      body_el,
    },
    is_elided: false,
    arguments: arg_and_views,
  };
}

export function call_to_code(
  call_name: string,
  arg_and_views: {
    arg: Arg;
    view: ArgView;
  }[]
) {
  const args_str =
    arg_and_views.
      filterMap(({ arg, view }) => view.disabled ? null : arg_view_to_code(arg, view)).
      join(", ");

  return `${call_name}(${args_str})`;
}

// So that 0.1 + 0.2 actually prints 0.3
function number_to_string_not_ugly(n: number) {
  const str = n.toString();

  if (str.match(/9999999999\d\d\d$/)) {
    return number_to_string_not_ugly(n * 1.00000000000001);
  }
  return str.replace(/0+000000000\d\d\d$/, "");
}

// The handling has to be routed through the layers UI element because all the logic
// for attaching the arguments to the code is buried there, including adding new args
// and modifying current args.
export function perhaps_get_mouse_drag_x_handler(call_view: CallView) : null | ((dx_px: number, px_per_unit: number) => void) {

  const maybe_arg_and_view = call_view.arguments.find(({ arg }) => arg.name == 'x');

  if (!maybe_arg_and_view) return null;

  const { view: x_arg_view } = maybe_arg_and_view;

  const starting_arg_code = widget_to_code(x_arg_view.widget);

  let code_lhs   = starting_arg_code;
  let starting_rhs_number = 0;

  // Match starting_arg_code with WHATEVER + number, so we don't keep adding + x + x + x on every new drag
  let match = starting_arg_code.match(/^(?<whatever>.*)\s*\+\s*(?<number>-?[0-9\.]+)\s*$/) ||
              starting_arg_code.match(/^(?<number>-?[0-9\.]+)\s*\+\s*(?<whatever>.*)\s*$/);
  if (match) {
    code_lhs = match.groups!["whatever"].trim();
    starting_rhs_number = parseFloat(match.groups!["number"]);
  }

  return (dx_px, px_per_unit) => {
    const new_number = starting_rhs_number + dx_px / px_per_unit;
    const new_arg_code = new_number !== 0 ? `${code_lhs} + ${number_to_string_not_ugly(new_number)}` : code_lhs;
    change_widget_code(x_arg_view.widget, new_arg_code);
  };
}