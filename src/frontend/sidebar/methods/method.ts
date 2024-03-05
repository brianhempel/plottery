import { MethodView, MethodWithArgs, SNPState } from "../../state";
import { create_el } from "../../utils/misc";
import { add_method_code } from "../sidebar";
import "./method.css";

export function create_method_view(
  method: MethodWithArgs,
  state: SNPState
): MethodView {
  const code_mirror = state.model.cell.code_mirror;

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
  el.addEventListener("click", e => {
    add_method_code(mark, method.code, state);
  });
  // syntax_highlight(new_code, el);

  return {
    el,
    mark,
  };
}
