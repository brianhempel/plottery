import { IInstanceType, LiteralType,  } from "../../../types";
import { create_el } from "../../../utils/misc";
import { create_arbitrary_code_widget } from "../arbitrary_code/arbitrary_code";
import { Widget } from "../widget";

export type LiteralWidget = Widget & {
  kind: "LiteralWidget";
};

// Literal widgets are not editable in theory (because they are an atomic value),
// but they produce a regular code widget when chosen from a dropdown to let
// the user edit it freely anyway.
export function create_literal_widget(type: LiteralType): LiteralWidget {

  const el = create_el("div", ["plottery-widget", "literal-widget"]);
  el.textContent = type.value_unparsed;

  if ((type.fallback as IInstanceType)?.type_ref == 'builtins.str') {
    el.classList.add("plottery-arg-str");
  } else if ((type.fallback as IInstanceType)?.type_ref == 'builtins.float' ||
             (type.fallback as IInstanceType)?.type_ref == 'builtins.int') {
    el.classList.add("plottery-arg-number");
  }

  const widget: LiteralWidget = {
    kind: "LiteralWidget",
    el,
    kind_label_for_dropdown: "lit",
    does_match_arg_code: (arg_code: string) => arg_code == widget.to_code(),
    // textContent, not innerText: see arbitrary_code.ts (innerText reads "" in non-rendered subtrees).
    to_code:             ()                 => widget.el.textContent ?? "",
    set_code:            ()                 => undefined, // Not editable
    clone:               ()                 => create_arbitrary_code_widget(widget.to_code()), // Turn into a regular code widget when chosen from a dropdown
  };

  return widget
}
