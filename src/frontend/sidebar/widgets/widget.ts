import { Type } from "../../types";
import { create_alias_widget } from "./alias/alias";
import { create_color_widget } from "./color/color";
import { DropdownWidget, create_dropdown_widget, select_dropdown_item } from "./dropdown/dropdown";
import { create_literal_widget } from "./literal/literal";
import { create_arbitrary_code_widget } from "./arbitrary_code/arbitrary_code";
import { default_code_and_code_type_for_type } from "../../utils/misc";

export type Widget = {
  el: HTMLElement;
  does_match_arg_code: (arg_code: string) => boolean;
  kind_label_for_dropdown: string;
  to_code: () => string;
  set_code: (new_code: string) => void;
  clone: () => Widget;
};

export function make_widget_for_code_and_type(code: string, type: Type, type_compatible_code_snippets: string[]): Widget {
  let widgets = widgets_from_type(type);

  // Code snippet widgets
  widgets = widgets.concat((type_compatible_code_snippets ?? []).map(create_arbitrary_code_widget));

  let widget_to_select = widgets.find(widget => widget.does_match_arg_code(code));

  // If the user code does not match any of the type-derived widgets or the code snippets, then create an arbitrary code widget and put it first.
  if (!widget_to_select) {
    var arbitrary_code_widget = create_arbitrary_code_widget(code);
    widgets.unshift(arbitrary_code_widget);
    widget_to_select = arbitrary_code_widget;
  } else {
    widget_to_select.set_code(code);
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
