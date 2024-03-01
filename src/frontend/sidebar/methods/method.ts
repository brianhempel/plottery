import { AppState, MethodView, MethodWithArgs } from "../../state";
import { create_el, syntax_highlight } from "../../utils/misc";
import "./method.css";

export function create_method_view(method: MethodWithArgs): MethodView {
  const code_mirror = AppState.model.cell.code_mirror;

  let line_count = code_mirror.getValue().split("\n").length;
  let mark = code_mirror.markText(
    { line: line_count - 2, ch: 0 },
    { line: line_count - 2, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  ); // insert at end, for now...

  let required_positional_arg_codes = method.required_positional_arg.map(
    arg => arg.code
  );

  let required_keyword_arg_codes = method.required_keyword_args.map(
    arg => `${arg.name}=${arg.code}`
  );

  let new_code = `${method.receiver_name}.${
    method.method_info.name
  }(${required_positional_arg_codes
    .concat(required_keyword_arg_codes)
    .join(",")})\n`;

  const el = create_el("div", "snp-method-view");

  el.innerText = new_code;
  syntax_highlight(new_code, el);

  return {
    el,
    mark,
  };
}
