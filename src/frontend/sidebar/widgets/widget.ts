import { Type } from "../../types";
import {
  AliasWidget,
  alias_widget_to_code,
  arg_code_matches_alias_widget,
  change_alias_widget_code,
  clone_alias_widget,
  create_alias_widget,
  get_alias_widget_type_id,
} from "./alias/alias";
import {
  ColorWidget,
  arg_code_matches_color_widget,
  change_color_widget_code,
  clone_color_widget,
  color_widget_to_code,
  create_color_widget,
  get_color_widget_type_id,
} from "./color/color";
import { DropdownWidget, change_dropdown_widget_code, create_dropdown_widget, dropdown_widget_to_code, select_dropdown_item } from "./dropdown/dropdown";
import {
  LiteralWidget,
  arg_code_matches_literal_widget,
  change_literal_widget_code,
  clone_literal_widget,
  create_literal_widget,
  get_literal_widget_type_id,
  literal_widget_to_code,
} from "./literal/literal";
import {
  ArbitraryCodeWidget,
  get_arbitrary_code_widget_type_id,
  arbitrary_code_widget_to_code,
  change_arbitrary_code_widget_code,
  clone_arbitrary_code_widget,
  create_arbitrary_code_widget,
  arg_code_matches_arbitrary_code_widget,
} from "./arbitrary_code/arbitrary_code";
import { default_code_and_code_type_for_type } from "../../utils/misc";

export enum WidgetKind {
  Dropdown = "Dropdown",
  Literal = "Literal",
  Alias = "Alias",
  ArbitraryCode = "ArbitraryCode",
  Color = "Color",
}

export type Widget = {
  kind: WidgetKind;
  el: HTMLElement;
};

export function make_widget_for_code_and_type(code: string, type: Type, type_compatible_code_snippets: string[]): Widget {
  let widgets = widgets_from_type(type);

  // Code snippet widgets
  widgets = widgets.concat((type_compatible_code_snippets ?? []).map(create_arbitrary_code_widget));

  let widget_to_select = widgets.find(widget => arg_code_matches_widget(widget, code));

  // If the user code does not match any of the type-derived widgets or the code snippets, then create an arbitrary code widget and put it first.
  if (!widget_to_select) {
    var arbitrary_code_widget = create_arbitrary_code_widget(code);
    widgets.unshift(arbitrary_code_widget);
    widget_to_select = arbitrary_code_widget;
  } else {
    change_widget_code(widget_to_select, code);
  }

  // If there are multiple widgets at this point, create a dropdown
  if (widgets.length > 1 && widget_to_select) {
    var widget: Widget = create_dropdown_widget(widgets);
    select_dropdown_item(widget as DropdownWidget, widget_to_select);
  } else {
    var widget: Widget = widgets[0];
  }
  return widget;
}

function widgets_from_type(type: Type): Widget[] {
  if (
    typeof type == "object" &&
    type[".class"] == "TypeAliasType" &&
    type.type_ref == "matplotlib._typing.ColorType"
  ) {
    return [create_color_widget(type)];
  } else if (
    typeof type == "string" ||
    (typeof type == "object" && type[".class"] == "LiteralType") ||
    (typeof type == "object" && type[".class"] == "Instance") ||
    (typeof type == "object" && type[".class"] == "NoneType")
  ) {
    return [create_literal_widget(type)];
  } else if (typeof type == "object" && type[".class"] == "UnionType") {
    return type.items.flatMap(widgets_from_type);
  } else if (typeof type == "object" && type[".class"] == "TypeAliasType") {
    return [create_alias_widget(type)];
  } else if (typeof type == "object" && type[".class"] == "TupleType") {
    return [create_arbitrary_code_widget(default_code_and_code_type_for_type(type)[0])];
  }

  console.warn("No type widget implemented!", type);
  return [];
}

function arg_code_matches_widget(
  widget: Widget,
  arg_code: string
): boolean {
  if (widget.kind == WidgetKind.Dropdown) {
    console.warn("We don't support nested arg dropdowns right now", widget, arg_code);
    return false
  } else if (widget.kind == WidgetKind.Alias) {
    return arg_code_matches_alias_widget(widget as AliasWidget, arg_code);
  } else if (widget.kind == WidgetKind.ArbitraryCode) {
    return arg_code_matches_arbitrary_code_widget(widget as ArbitraryCodeWidget, arg_code);
  } else if (widget.kind == WidgetKind.Literal) {
    return arg_code_matches_literal_widget(widget as LiteralWidget, arg_code);
  } else if (widget.kind == WidgetKind.Color) {
    return arg_code_matches_color_widget(widget as ColorWidget, arg_code);
  }

  console.warn("No implementation for matching...", widget, arg_code);
  return false;
}


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

export function clone_widget(widget: Widget) : Widget {
  if (widget.kind == WidgetKind.Alias) {
    return clone_alias_widget(widget as AliasWidget);
  } else if (widget.kind == WidgetKind.ArbitraryCode) {
    return clone_arbitrary_code_widget(widget as ArbitraryCodeWidget);
  } else if (widget.kind == WidgetKind.Literal) {
    return clone_literal_widget(widget as LiteralWidget);
  } else if (widget.kind == WidgetKind.Dropdown) {
    throw new Error("clone_widget: should not be cloning dropdown widgets because we don't have nested dropdowns");
  } else if (widget.kind == WidgetKind.Color) {
    return clone_color_widget(widget as ColorWidget);
  }
  throw new Error("clone_widget: shouldn't get here: unknown widget kind");
}