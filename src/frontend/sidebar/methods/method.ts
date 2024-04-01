import { MethodView, MethodWithArgs, State } from "../../types";
import { create_el } from "../../utils/misc";
import { add_method_code } from "../sidebar";
import "./method.css";

/**
 * Methods shown in the sidebar. For now, it just shows their name...
 *
 * - ax.bar
 * - ax.barh
 * ...
 */
export function create_method_view(
  method: MethodWithArgs,
  state: State
): MethodView {
  const code_mirror = state.cell.code_mirror;

  let line_count = code_mirror.getValue().split("\n").length;
  let mark = code_mirror.markText(
    { line: line_count - 2, ch: 0 },
    { line: line_count - 2, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  ); // insert at end, for now...

  let code_prefix = `${method.receiver_name}.${method.method_info.name}`;

  const el = create_el("div", "snp-method-view");
  el.innerText = code_prefix;

  // @TODO: Don't add if max calls is 1 and has already
  // been called.
  el.addEventListener("click", _ => {
    add_method_code(mark, method.code, state);
  });

  return {
    el,
    mark,
  };
}
