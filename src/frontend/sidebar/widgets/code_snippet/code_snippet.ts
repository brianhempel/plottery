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

export function match_arg_code_to_code_snippet_widget(
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

export function get_code_snippet_widget_type_id(widget: CodeSnippetWidget) {
  return "var";
}
