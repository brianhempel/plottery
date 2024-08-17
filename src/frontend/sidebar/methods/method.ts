import { MethodInfo, MethodView, MethodWithCode, State } from "../../types";
import { arg_defaults_from_callee_type, create_el } from "../../utils/misc";
import { hard_rerun } from "../../code_sync/code_sync";
import "./method.css";
import { add_line_of_code } from "../../utils/misc";
import { id_of_new_call } from "../call/call";

// /**
//  * Buttons to click to add method calls to the code.
//  */
// export function create_method_view(
//   method: MethodWithCode,
//   state: State
// ): MethodView {

//   const el = create_el("div", "snp-method-view");
//   el.innerText = method.receiver_dot_name; // "ax.bar"
//   el.title = method.method_info.docstring_first_line;

//   el.addEventListener("click", _ => add_method_call(method, state));

//   return {
//     el,
//   };
// }

export function add_method_call(
  method: MethodWithCode,
  state: State
) {
  const mark = add_line_of_code(method.code, state);
  const line = mark.find()!.to.line + state.cell_lineno - 1;
  state.persistent_dataset.new_calls = `["${id_of_new_call(method.receiver_dot_name, line)}"]`;
  hard_rerun(state);
}

export function method_info_to_method_with_args(method_info: MethodInfo): MethodWithCode {

  let arg_defaults = arg_defaults_from_callee_type(method_info.type);

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

  let [required_positional_args, required_keyword_args] =
    arg_defaults.filter(arg => arg.required).partition(arg => arg.kind == "ARG_POS");

  let required_positional_arg_codes = required_positional_args.map(arg => arg.code);

  let required_keyword_arg_codes = required_keyword_args.map(arg => `${arg.name}=${arg.code}`);

  let receiver_dot_name = `${method_info.receiver_name}.${method_info.name}`;
  let code = `${receiver_dot_name}(${required_positional_arg_codes
    .concat(required_keyword_arg_codes)
    .join(",")})\n`;

  return {
    method_info,
    receiver_dot_name,
    code
  };
}