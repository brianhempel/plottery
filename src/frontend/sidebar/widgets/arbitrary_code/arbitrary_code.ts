import { create_el } from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type ArbitraryCodeWidget = Widget & {
  kind: WidgetKind.ArbitraryCode;
};

export function create_arbitrary_code_widget(code: string): ArbitraryCodeWidget {
  const el = create_el("div", "snp-arg");
  el.innerText = code;
  el.contentEditable = "true";
  el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      el.blur();
    }
  });

  return {
    kind: WidgetKind.ArbitraryCode,
    el,
  };
}

export function clone_arbitrary_code_widget(widget: ArbitraryCodeWidget): ArbitraryCodeWidget {
  return create_arbitrary_code_widget(arbitrary_code_widget_to_code(widget));
}

export function arg_code_matches_arbitrary_code_widget(
  widget: ArbitraryCodeWidget,
  arg_code: string
): boolean {
  if (arbitrary_code_widget_to_code(widget) == arg_code) {
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
