import { IInstanceType, MethodInfo, MethodView, MethodWithCode, State, Type } from "../../types";
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

export function method_info_to_method_with_args(method_info: MethodInfo, avoid_names: string[]): MethodWithCode {

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

  let ret_name = name_for_ret_type(method_info.type.ret_type);
  let perhaps_assignment = ret_name ? `${non_colliding_name(ret_name, avoid_names)} = ` : '';
  let code = `${perhaps_assignment}${receiver_dot_name}(${required_positional_arg_codes.concat(required_keyword_arg_codes).join(', ')})\n`;

  return {
    method_info,
    receiver_dot_name,
    code
  };
}

// My beautiful segmentor regex, comes in handy!
// "mkNameG_tcIdKey" => [ 'mk', 'Name', 'G', 'tc', 'Id', 'Key' ]
function identifier_to_words(s: string): string[] {
  const words = s.match(/\'|(?:^[^A-Za-z0-9\s\'])?(?:[^a-z\_\s\'\.]+$|[^a-z\_\s\'\.]+[0-9\.]|[^a-z\_\s\'\.]+(?![a-z])|[A-Z][^A-Z0-9\_\s\'\.]+\.?|[^A-Z0-9\_\s\'\.]+\.?)/g)
  return words || [s];
}

// Convert the return type into a name
function name_for_ret_type(ret_type: Type): string | null {
  if (ret_type && ret_type['.class'] == 'NoneType') {
    return null
  }

  const abbrevs: { [k: string]: string } = {
    'axes': 'ax',
    'figure': 'fig',
  }

  let s = (ret_type as IInstanceType)?.type_ref || 'var';
  let is_list = false;
  if (s === 'builtins.list' && (ret_type as IInstanceType).args.length > 0) {
    s = ((ret_type as IInstanceType).args[0] as IInstanceType)?.type_ref || 'var';
    is_list = true;
  } else if (s === 'builtins.ellipsis') {
    s = 'var'
  }
  const base_name = s.split('.').at(-1) || 'var';
  const words = identifier_to_words(base_name).map(w => w.toLowerCase()).map(w => abbrevs[w] || w);
  let name = words.join('_') + (is_list ? 's' : '');
  name = name.replace(/_container/, 's');
  return name;
}

function non_colliding_name(name: string, avoid_names: string[]): string {
  let i = 1;
  while (avoid_names.includes(name)) {
    i++;
    name = `${name}${i}`;
  }
  return name;
}