import { Type } from "../../types";
import { create_alias_widget } from "./alias/alias";
import { create_color_widget } from "./color/color";
import { DropdownWidget, create_dropdown_widget, select_dropdown_item } from "./dropdown/dropdown";
import { create_literal_widget } from "./literal/literal";
import { create_arbitrary_code_widget } from "./arbitrary_code/arbitrary_code";
import { default_code_for_type } from "../../utils/misc";

export type Widget = {
  el: HTMLElement;
  does_match_arg_code: (arg_code: string) => boolean;
  kind_label_for_dropdown: string;
  to_code: () => string;
  set_code: (new_code: string) => void;
  clone: () => Widget;
};

export function make_widget_for_code_and_type(code: string, type: Type | null, default_code: string | null, type_compatible_code_snippets: string[] | undefined): Widget {

  let widgets: Widget[] = type ? widgets_from_type(type) : [];

  // Add default if it's not represented by a type-derived widget
  if (default_code && !widgets.find(w => w.does_match_arg_code(default_code))) {
    widgets.unshift(create_arbitrary_code_widget(default_code));
  }

  // Code snippet widgets
  widgets = widgets.concat((type_compatible_code_snippets ?? []).map(create_arbitrary_code_widget));

  let widget_to_select = widgets.find(w => w.does_match_arg_code(code));

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
  } else if (typeof type == "string") {
    return [create_literal_widget(type)];
  } else if (type[".class"] == "LiteralType") {
    return [create_literal_widget(type)];
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.bool") {
    return [
      create_arbitrary_code_widget("True"),
      create_arbitrary_code_widget("False"),
    ];
  } else if (type[".class"] == "UnionType") {
    return type.items.flatMap(widgets_from_type);
  } else if (type[".class"] == "TypeAliasType") {
    return [create_alias_widget(type)];
  } else if ((type[".class"] == "Instance" && type.type_ref == "builtins.str") ||
             type[".class"] == "NoneType" ||
             type[".class"] == "TupleType"
            ) {
    return [create_arbitrary_code_widget(default_code_for_type(type))];
  }

  console.warn("No type widget implemented!", type);
  return [];
}
