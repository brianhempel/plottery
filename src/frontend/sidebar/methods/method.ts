import { MarkerRange, TextMarker } from "../../utils/codemirror";
import { MethodView, MethodWithArgs, State } from "../../types";
import { create_el } from "../../utils/misc";
import { hard_rerun } from "../../code_sync/code_sync";
import "./method.css";

/**
 * Buttons to click to add method calls to the code.
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

  el.addEventListener("click", _ => {
    add_method_code(mark, method.code, state);
  });

  return {
    el,
    mark,
  };
}

export function add_method_code(
  mark: TextMarker<MarkerRange>,
  code: string,
  state: State
) {
  let { from, to } = mark.find()!;
  state.cell.code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find()!);
  const prefix = code.split("(")[0];
  const loc = to.line + state.cell_lineno - 1;

  state.persistent_dataset.new_calls = `["${prefix}${loc}"]`;

  hard_rerun(state);
}
