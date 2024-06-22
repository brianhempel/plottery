import {
  AliasWidget,
  alias_widget_to_code,
  change_alias_widget_code,
  get_alias_widget_type_id,
} from "./alias/alias";
import {
  ColorWidget,
  change_color_widget_code,
  color_widget_to_code,
  get_color_widget_type_id,
} from "./color/color";
import { DropdownWidget, change_dropdown_widget_code, dropdown_widget_to_code } from "./dropdown/dropdown";
import {
  CodeSnippetWidget,
  get_code_snippet_widget_type_id,
  code_snippet_widget_to_code,
  change_code_snippet_widget_code,
} from "./code_snippet/code_snippet";
import {
  LiteralWidget,
  change_literal_widget_code,
  get_literal_widget_type_id,
  literal_widget_to_code,
} from "./literal/literal";
import {
  ArbitraryCodeWidget,
  get_arbitrary_code_widget_type_id,
  arbitrary_code_widget_to_code,
  change_arbitrary_code_widget_code,
} from "./arbitrary_code/arbitrary_code";

export enum WidgetKind {
  Dropdown = "Dropdown",
  Literal = "Literal",
  Alias = "Alias",
  CodeSnippet = "CodeSnippet",
  ArbitraryCode = "ArbitraryCode",
  Color = "Color",
}

export type Widget = {
  kind: WidgetKind;
  el: HTMLElement;
};

/**
 * Given a widget (that's not a dropdown!), returns the id for it.
 * It's used to add a label next to items in dropdown drawer.
 *
 * For example, | [1, 2, 3]  list |
 *                            ^ that's the id
 * @param widget
 * @returns
 */
export function get_widget_type_id(widget: Widget): string {
  if (widget.kind == WidgetKind.Alias) {
    return get_alias_widget_type_id(widget as AliasWidget);
  } else if (widget.kind == WidgetKind.CodeSnippet) {
    return get_code_snippet_widget_type_id(widget as CodeSnippetWidget);
  } else if (widget.kind == WidgetKind.ArbitraryCode) {
    return get_arbitrary_code_widget_type_id(widget as ArbitraryCodeWidget);
  } else if (widget.kind == WidgetKind.Literal) {
    return get_literal_widget_type_id(widget as LiteralWidget);
  } else if (widget.kind == WidgetKind.Color) {
    return get_color_widget_type_id(widget as ColorWidget);
  }

  console.warn("No implementation for matching...", widget);
  return "None";
}

export function widget_to_code(widget: Widget): string {
  if (widget.kind == WidgetKind.Alias) {
    return alias_widget_to_code(widget as AliasWidget);
  } else if (widget.kind == WidgetKind.CodeSnippet) {
    return code_snippet_widget_to_code(widget as CodeSnippetWidget);
  } else if (widget.kind == WidgetKind.ArbitraryCode) {
    return arbitrary_code_widget_to_code(widget as ArbitraryCodeWidget);
  } else if (widget.kind == WidgetKind.Literal) {
    return literal_widget_to_code(widget as LiteralWidget);
  } else if (widget.kind == WidgetKind.Dropdown) {
    return dropdown_widget_to_code(widget as DropdownWidget);
  } else if (widget.kind == WidgetKind.Color) {
    return color_widget_to_code(widget as ColorWidget);
  }

  return "None";
}

export function change_widget_code(widget: Widget, new_code: string) : undefined {
  if (widget.kind == WidgetKind.Alias) {
    change_alias_widget_code(widget as AliasWidget, new_code);
  } else if (widget.kind == WidgetKind.CodeSnippet) {
    change_code_snippet_widget_code(widget as CodeSnippetWidget, new_code);
  } else if (widget.kind == WidgetKind.ArbitraryCode) {
    change_arbitrary_code_widget_code(widget as ArbitraryCodeWidget, new_code);
  } else if (widget.kind == WidgetKind.Literal) {
    change_literal_widget_code(widget as LiteralWidget, new_code);
  } else if (widget.kind == WidgetKind.Dropdown) {
    change_dropdown_widget_code(widget as DropdownWidget, new_code);
  } else if (widget.kind == WidgetKind.Color) {
    change_color_widget_code(widget as ColorWidget, new_code);
  }
}