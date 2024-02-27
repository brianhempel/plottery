import {
  Arg,
  ArgView,
  CallView,
  CallViewEls,
  CallWithArgs,
  Model,
} from "../../state";
import { Ticker } from "../../utils/Ticker";
import {
  create_chevron,
  create_el,
  item_to_end_pos,
  item_to_start_pos,
} from "../../utils/misc";
import {
  create_arg_view,
  make_arg_view_non_optional,
  make_arg_view_optional,
} from "../arg/arg";
import { sync_call_code } from "../sidebar";
import { widget_to_code } from "../widgets/dropdown/dropdown";
import "./call.css";

export function create_call_view(
  model: Model,
  call: CallWithArgs,
  artist_name: string
): CallView {
  // Mark the range of code in cell for when user changes the call
  const mark = model.cell.code_mirror.markText(
    item_to_start_pos(call.call_info.call, model.cell_lineno),
    item_to_end_pos(call.call_info.call, model.cell_lineno),
    {
      inclusiveLeft: true,
      inclusiveRight: true,
    }
  );

  // Call container
  const call_els = create_call_view_skeleton();
  call_els.name_el.innerText = call.call_info.func_code_and_num[0];

  // Arguments
  const {
    given_positional_args,
    given_keyword_args,
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
  } = call;

  const arg_views: ArgView[] = [];

  console.log(call);

  const add_args = (args: Arg[], positional: boolean, optional: boolean) => {
    args.forEach(arg => {
      const arg_view = create_arg_view(arg, call, mark, {
        positional,
        optional,
      });
      call_els.args_el.append(arg_view.el);
      arg_views.push(arg_view);
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

  // Remove the last comma
  [...call_els.args_el.querySelectorAll(".snp-comma")].at(-1)?.remove();

  update_commas(arg_views);

  // Button to expand the optional args
  const expand_button_el = create_chevron();
  expand_button_el.classList.add("snp-call-expand-button");

  expand_button_el.addEventListener("click", () => {
    if (call_els.el.classList.contains("expanded")) {
      // Collapse it
      call_els.el.classList.remove("expanded");

      arg_views.forEach(arg_view => {
        if (arg_view.optional) {
          arg_view.el.style.maxWidth = "0px";
        }
      });
    } else {
      // Expand it
      call_els.el.classList.add("expanded");

      arg_views.forEach(arg_view => {
        if (arg_view.optional) {
          arg_view.el.style.maxWidth = `${arg_view.el.scrollWidth}px`;
        }
      });
    }
  });

  call_els.el.append(expand_button_el);

  // On clicking on a hidden arg view, unhide it
  arg_views.forEach(arg_view => {
    if (!arg_view.optional) return;

    arg_view.el.addEventListener("mousedown", e => {
      if (arg_view.optional) {
        make_arg_view_non_optional(arg_view);
        arg_view.el.style.maxWidth = "inherit";

        update_commas(arg_views);
      } else if (e.ctrlKey) {
        make_arg_view_optional(arg_view);
        update_commas(arg_views);

        if (!call_els.el.classList.contains("expanded")) {
          arg_view.el.style.maxWidth = "0px";
        }
      }
    });
  });

  // On change of call, check if it's code changed
  let curr_inner_text = call_els.el.innerHTML;
  let curr_code = call_to_code(call_els.name_el.innerText, arg_views);

  // @TODO: Unregister on destroy (?)
  Ticker.instance.registerTick(() => {
    if (curr_inner_text != call_els.el.innerText) {
      const code = call_to_code(call_els.name_el.innerText, arg_views);

      if (curr_code != code) {
        sync_call_code(mark, code);
        curr_code = code;
      }
    }
  });

  // Add the call view
  return {
    els: call_els,
    is_elided: false,
    arguments: arg_views,
  };
}

function update_commas(arg_views: ArgView[]) {
  // Clear existing optional commas
  arg_views.forEach(arg_view => {
    arg_view.comma_el?.classList.remove("snp-comma-optional");
  });

  // Find the last non-optional arg (if any) and makes its comma optional
  const last_non_optional_arg_view = arg_views.findLast(arg_view => {
    return !arg_view.optional;
  });
  last_non_optional_arg_view?.comma_el?.classList.add("snp-comma-optional");
}

export function call_to_code(call_name: string, arg_views: ArgView[]) {
  let code = `${call_name}(`;

  arg_views.forEach(arg_view => {
    code += arg_view_to_code(arg_view);
  });

  // Remove trailing comma
  code = code.slice(0, -2);

  code += ")";

  return code;
}

export function arg_view_to_code(arg_view: ArgView): string {
  if (arg_view.optional == true) return "";

  let code = "";

  if (!arg_view.positional) {
    // Get prefix
    code += (arg_view.el.children[0] as HTMLElement).innerText;
  }

  code += widget_to_code(arg_view.widget);

  code += ", ";

  return code;
}

export function create_call_view_skeleton(): CallViewEls {
  // Call container
  const el = create_el("div", "snp-call");

  // Call name
  const name_el = create_el("div", "snp-call-name", el);

  // Starting bracket
  const start_bracket_el = create_el("div", "snp-bracket", el);
  start_bracket_el.innerText = "(";

  // Args
  const args_el = create_el("div", "snp-call-args", el);

  // Ending bracket
  const end_bracket_el = create_el("div", "snp-bracket", el);
  end_bracket_el.innerText = ")";

  return {
    el,
    name_el,
    start_bracket_el,
    args_el,
    end_bracket_el,
  };
}
