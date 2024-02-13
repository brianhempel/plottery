import { Arg, CallInfo, CallableType, Model, Position } from "../state";
import { partition, takeWhile } from "../utils/array";
import CodeMirror from "../utils/codemirror";
import {
  arg_defaults_from_callee_type,
  item_to_end_pos,
  item_to_start_pos,
} from "../utils/misc";
import { shortest_qualified_name } from "../utils/names";
import { get_arg_kind_from_int } from "../utils/types";

export function build_sidebar(m: Model, snp_outer: HTMLElement) {
  let methods_to_place_on_canvas = [];

  m.selectable_artists.forEach(({ id, names }) => {
    const artist_name = shortest_qualified_name(names);

    const artist_methods = m.methods.filter((method) =>
      method.show_on.includes(id)
    );

    const artist_calls = m.calls.filter((call_info) =>
      call_info.show_on.includes(id)
    );

    const methods_called = [];

    const call_widgets = artist_calls.map((call_info) => {
      const args = get_args(call_info, m.cell_lineno, m.cell.code_mirror);

      const start_pos = item_to_start_pos(call_info.call, m.cell_lineno);
      const end_pos = item_to_end_pos(call_info.call, m.cell_lineno);

      const mark = m.cell.code_mirror.markText(start_pos, end_pos, {
        inclusiveRight: true,
        inclusiveLeft: true,
      });

      const callee_code = m.cell.code_mirror.getRange(
        item_to_start_pos(call_info.callee, m.cell_lineno),
        item_to_end_pos(call_info.callee, m.cell_lineno)
      );

      const [given_positional_args, given_keyword_args] = partition(
        args,
        (arg) => arg.name == null
      );

      const widget = make_call_widget(
        call_info.callee,
        given_positional_args,
        given_keyword_args,
        callee_code,
        m.cell.code_mirror,
        mark
      );
    });
  });

  return null;
}

export function get_args(
  call_info: CallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): Arg[] {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== undefined;

  let args: Arg[] = [];

  call_info.given_args.forEach((given_arg, arg_i: number) => {
    const arg_kind = get_arg_kind_from_int(given_arg.kind);
    const arg_i_at_func_def = given_arg["name"]
      ? call_info.callee.arg_names.indexOf(given_arg.name)
      : callee_has_self_arg
      ? arg_i + 1
      : arg_i;

    const arg_val_code = code_mirror.getRange(
      item_to_start_pos(given_arg, cell_lineno),
      item_to_end_pos(given_arg, cell_lineno)
    );

    args.push({
      name: given_arg.name,
      kind: arg_kind,
      code: arg_val_code,
      type: call_info.callee.arg_types[arg_i_at_func_def],
      code_type: undefined,
      type_compatible_local_names:
        call_info.callee.arg_type_compatible_local_names[arg_i_at_func_def],
    });
  });

  return args;
}

export function make_call_widget(
  callee: CallableType & {
    pos: Position;
  },
  given_positional_args: Arg[],
  given_keyword_args: Arg[],
  callee_code: string,
  cm: CodeMirror.DocOrEditor,
  mark: CodeMirror.TextMarker<CodeMirror.MarkerRange>
) {
  const arg_defaults = arg_defaults_from_callee_type(callee);

  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    (arg) => arg.kind === "ARG_POS"
  ); // we could also look for arg.kind === "ARG_OPT" here,
  // but optional positional args look nicer when given as keyword args

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      (arg) =>
        !given_keyword_args.some((given_arg) => given_arg.name === arg.name)
    )
    .filter((arg) => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  // arg_els.push(
  //   ...given_positional_args.map((arg) =>
  //     make_arg_el(sync_editor_and_output, arg, { positional: true })
  //   )
  // );

  // if used for a new call, required args need to be generated
  let needed_positional_args = takeWhile(
    missing_positional_args,
    (arg) => arg.kind === "ARG_POS"
  );

  let missing_optional_positional_arg_els = missing_positional_args.slice(
    needed_positional_args.length
  );

  return widget;
}

// export function make_arg_el(arg: Arg, options = { positional: false }) {
//   const arg_el = createElement("span");

//   if (arg.kind !== "ARG_POS") {
//     // Make remove button
//     const remove_button = createElement("span");
//     remove_button.innerText = "❌";
//     remove_button.style.fontSize = "0.5em";
//     remove_button.style.verticalAlign = "super";
//     remove_button.style.cursor = "pointer";
//     remove_button.title = `Remove argument \`${arg.name}\``;

//     remove_button.addEventListener("click", (ev) => {
//       const ellipses_el = siblingsAfter(arg_el).find(
//         (node) => node.hidden_arg_els !== undefined
//       );
//       // Try to remove the extra comma.
//       // Need to skip any ellipses elements.
//       const node_before = siblingsBefore(arg_el).find(
//         (node) => to_code(node) !== "" && !node.textContent.match(/^\s*$/)
//       );
//       const node_after = siblingsAfter(arg_el).find(
//         (node) => to_code(node) !== "" && !node.textContent.match(/^\s*$/)
//       );
//       if (node_before?.textContent?.match(/\s*,\s*$/)) {
//         node_before.textContent = node_before.textContent.replace(
//           /\s*,\s*$/,
//           ""
//         );
//       } else if (node_after?.textContent?.match(/^\s*,\s*/)) {
//         node_after.textContent = node_before.textContent.replace(
//           /^\s*,\s*/,
//           ""
//         );
//       }
//       arg_el.remove();
//       if (ellipses_el) {
//         ellipses_el.hidden_arg_els.push(arg_el);
//         ellipses_el.style.display = "inline";
//       }
//       sync_editor_and_output();
//     });
//     arg_el.append(remove_button);
//   }

//   if (options?.positional) {
//     arg_el.append(
//       arg_to_widget(
//         sync_editor_and_output,
//         arg.code,
//         arg.type,
//         arg.code_type,
//         arg.type_compatible_local_names
//       )
//     );
//   } else {
//     arg_el.append(
//       arg.name,
//       "=",
//       arg_to_widget(
//         sync_editor_and_output,
//         arg.code,
//         arg.type,
//         arg.code_type,
//         arg.type_compatible_local_names
//       )
//     );
//   }
//   return arg_el;
// }
