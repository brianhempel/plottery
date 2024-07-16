import { MethodView, MethodWithArgs, State } from "../../types";
import { create_el } from "../../utils/misc";
import { hard_rerun } from "../../code_sync/code_sync";
import "./method.css";
import { add_line_of_code } from "../../utils/misc";

/**
 * Buttons to click to add method calls to the code.
 */
export function create_method_view(
  method: MethodWithArgs,
  state: State
): MethodView {

  let code_prefix = `${method.receiver_name}.${method.method_info.name}`;

  const el = create_el("div", "snp-method-view");
  el.innerText = code_prefix;

  el.addEventListener("click", _ => {
    const mark = add_line_of_code(method.code, state);
    const prefix = method.code.split("(")[0];
    const loc = mark.find()!.to.line + state.cell_lineno - 1;
    state.persistent_dataset.new_calls = `["${prefix}${loc}"]`;
    hard_rerun(state);
  });

  return {
    el,
  };
}


