import { create_el } from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type CodeSnippetWidget = Widget & {
  kind: WidgetKind.CodeSnippet;
  code: string;
};

export function create_code_snippet_widget(code: string): CodeSnippetWidget {
  const el = create_el("div", "snp-arg");
  el.innerText = code;

  return {
    kind: WidgetKind.CodeSnippet,
    code: code,
    el,
  };
}

export function arg_code_matches_code_snippet_widget(
  widget: CodeSnippetWidget,
  arg_code: string
): boolean {
  if (widget.code == arg_code) {
    return true;
  } else {
    return false;
  }
}

export function code_snippet_widget_to_code(widget: CodeSnippetWidget) {
  return widget.el.innerText;
}

export function change_code_snippet_widget_code(widget: CodeSnippetWidget, new_code: string) {
  widget.el.innerText = new_code;
}

export function get_code_snippet_widget_type_id(widget: CodeSnippetWidget) {
  return "var";
}
