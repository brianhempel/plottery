import {
  AliasWidget,
  alias_widget_to_code,
  get_alias_widget_type_id,
} from "./alias/alias";
import {
  ColorWidget,
  color_widget_to_code,
  get_color_widget_type_id,
} from "./color/color";
import { DropdownWidget, dropdown_widget_to_code } from "./dropdown/dropdown";
import {
  IdentifierWidget,
  get_identifier_widget_type_id,
  identifier_widget_to_code,
} from "./identifier/identifier";
import {
  LiteralWidget,
  get_literal_widget_type_id,
  literal_widget_to_code,
} from "./literal/literal";

export enum WidgetKind {
  Dropdown = "Dropdown",
  Literal = "Literal",
  Alias = "Alias",
  Identifier = "Identifier",
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
  } else if (widget.kind == WidgetKind.Identifier) {
    return get_identifier_widget_type_id(widget as IdentifierWidget);
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
  } else if (widget.kind == WidgetKind.Identifier) {
    return identifier_widget_to_code(widget as IdentifierWidget);
  } else if (widget.kind == WidgetKind.Literal) {
    return literal_widget_to_code(widget as LiteralWidget);
  } else if (widget.kind == WidgetKind.Dropdown) {
    return dropdown_widget_to_code(widget as DropdownWidget);
  } else if (widget.kind == WidgetKind.Color) {
    return color_widget_to_code(widget as ColorWidget);
  }

  return "None";
}
