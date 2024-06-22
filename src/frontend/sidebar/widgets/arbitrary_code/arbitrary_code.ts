import { create_el } from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type ArbitraryCodeWidget = Widget & {
  kind: WidgetKind.ArbitraryCode;
  code: string;
};

export function create_arbitrary_code_widget(code: string): ArbitraryCodeWidget {
  const el = create_el("div", "snp-arg");
  el.innerText = code;
  el.contentEditable = "true";

  return {
    kind: WidgetKind.ArbitraryCode,
    code: code,
    el,
  };
}

export function arg_code_matches_arbitrary_code_widget(
  widget: ArbitraryCodeWidget,
  arg_code: string
): boolean {
  if (widget.code == arg_code) {
    return true;
  } else {
    return false;
  }
}

export function arbitrary_code_widget_to_code(widget: ArbitraryCodeWidget) {
  return widget.el.innerText;
}

export function change_arbitrary_code_widget_code(widget: ArbitraryCodeWidget, new_code: string) {
  widget.el.innerText = new_code;
}

export function get_arbitrary_code_widget_type_id(widget: ArbitraryCodeWidget) {
  return "code";
}
