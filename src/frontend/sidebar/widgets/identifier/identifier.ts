import { create_el } from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type IdentifierWidget = Widget & {
  kind: WidgetKind.Identifier;
  name: string;
};

export function create_identifier_widget(name: string): IdentifierWidget {
  const el = create_el("div", "snp-arg");
  el.innerText = name;

  return {
    kind: WidgetKind.Identifier,
    name,
    el,
  };
}

export function match_arg_code_to_identifier_widget(
  widget: IdentifierWidget,
  arg_code: string
): boolean {
  if (widget.name == arg_code) {
    return true;
  } else {
    console.log("[Identifier] No match!", widget, arg_code);
    return false;
  }
}

export function identifier_widget_to_code(widget: IdentifierWidget) {
  return widget.el.innerText;
}

export function get_identifier_widget_type_id(widget: IdentifierWidget) {
  return "var";
}
