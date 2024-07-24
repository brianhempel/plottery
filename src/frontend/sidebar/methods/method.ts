import { MethodInfoWithType, MethodView, MethodWithArgs, SelectableArtist, State } from "../../types";
import { arg_defaults_from_callee_type, create_el, get_shortest_qualified_name } from "../../utils/misc";
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

  const el = create_el("div", "snp-method-view");
  el.innerText = method.receiver_dot_name; // "ax.bar"

  el.addEventListener("click", _ => add_method_call(method, state));

  return {
    el,
  };
}

export function add_method_call(
  method: MethodWithArgs,
  state: State
) {
  const mark = add_line_of_code(method.code, state);
  const loc = mark.find()!.to.line + state.cell_lineno - 1;
  state.persistent_dataset.new_calls = `["${method.receiver_dot_name}${loc}"]`;
  hard_rerun(state);
}

// export function calls_and_methods_by_artist(state: State): {
//   [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
// } {
//   let all_calls_and_methods: {
//     [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
//   } = {};
//   state.selectable_artists.forEach(artist => {
//     const artist_call_infos = state.calls.filter(call_info => {
//       return call_info.show_on.at(-1) == artist.id;
//     });
//     let artist_method_infos = state.methods.filter(method => {
//       return method.show_on.at(-1) == artist.id;
//     });
//     const artist_calls = artist_call_infos.map(
//       call_info => call_info_to_call_with_args(call_info, state.cell_lineno, state.cell.code_mirror)
//     )
//     let artist_methods = get_methods(
//       artist_method_infos,
//       state.selectable_artists
//     );
//     // Filter out methods that're already called
//     artist_methods = artist_methods.filter(method => {
//       const is_already_called = artist_calls.find(
//         call =>
//           call.call_info.loc_via_func_code_and_num[0] ==
//           `${method.receiver_name}.${method.method_info.name}`
//       );
//       return !(method.method_info.max_calls == 1 && is_already_called);
//     });
//     all_calls_and_methods[artist.id] = {
//       calls: artist_calls,
//       methods: artist_methods,
//     };
//   });
//   return all_calls_and_methods;
// }

export function get_methods(
  method_infos: MethodInfoWithType[],
): MethodWithArgs[] {
  return method_infos.map(method_info => {
    let receiver_name = get_shortest_qualified_name(method_info.receiver_names);

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

    let [required_positional_arg, required_keyword_args] =
      arg_defaults.filter(arg => arg.required).partition(arg => arg.kind == "ARG_POS");

    let required_positional_arg_codes = required_positional_arg.map(arg => arg.code);

    let required_keyword_arg_codes = required_keyword_args.map(arg => `${arg.name}=${arg.code}`);

    let receiver_dot_name = `${receiver_name}.${method_info.name}`;
    let code = `${receiver_dot_name}(${required_positional_arg_codes
      .concat(required_keyword_arg_codes)
      .join(",")})\n`;

    return {
      method_info,
      receiver_dot_name,
      code,
      required_positional_arg,
      required_keyword_args,
    };
  });
}


