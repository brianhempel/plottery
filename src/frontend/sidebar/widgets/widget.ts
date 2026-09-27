import { Type } from "../../types";
import { create_alias_widget } from "./alias/alias";
import { create_color_widget } from "./color/color";
import { DropdownWidget, create_dropdown_widget, select_dropdown_item } from "./dropdown/dropdown";
import { create_literal_widget } from "./literal/literal";
import { create_arbitrary_code_widget } from "./arbitrary_code/arbitrary_code";
import { default_code_for_type, get_proper_type } from "../../utils/misc";
import { create_bool_widget } from "./bool/bool";
import { create_code_and_control_widget } from "./code_and_control/code_and_control";
import "./widget.css";

export type Widget = {
  el: HTMLElement;
  does_match_arg_code: (arg_code: string) => boolean;
  kind_label_for_dropdown: string;
  to_code: () => string;
  set_code: (new_code: string) => void;
  clone: () => Widget;
};

// Always returns a dropdown widget. So if you edit the code, you can revert to the original.
export function make_widget_for_code_and_type(code: string, type: Type | null, default_code: string | null, type_compatible_code_snippets: string[] | undefined, extra_widgets?: Widget[]): DropdownWidget {

  let widgets: Widget[] = type ? widgets_from_type(type) : [];

  // Add default if it's not already represented
  if (default_code && !widgets.find(w => w.to_code() == default_code)) {
    // Use a non-arbitrary widget kind if possible
    const rich_widget = widgets.find(w => w.does_match_arg_code(default_code))?.clone();
    if (rich_widget) {
      rich_widget.set_code(default_code);
      widgets.unshift(rich_widget);
    } else {
      widgets.unshift(create_arbitrary_code_widget(default_code));
    }
  }

  // Code snippet widgets
  widgets = widgets.concat((type_compatible_code_snippets ?? []).map(create_arbitrary_code_widget));

  // Extra dropdown items, e.g. cross-call link suggestions (which never match arg code, so
  // they can't become the auto-selected item below)
  widgets = widgets.concat(extra_widgets ?? []);

  let widget_to_select = widgets.find(w => w.does_match_arg_code(code));

  // If the user code does not match any of the type-derived widgets or the code snippets, then create an arbitrary code widget and put it first.
  if (!widget_to_select) {
    var arbitrary_code_widget = create_arbitrary_code_widget(code);
    widgets.unshift(arbitrary_code_widget);
    widget_to_select = arbitrary_code_widget;
  }

  // If there are multiple widgets at this point, create a dropdown
  const widget: DropdownWidget = create_dropdown_widget(widgets);
  select_dropdown_item(widget as DropdownWidget, widget_to_select || widgets[0]);

  widget.selected_item?.set_code(code);

  return widget;
}

function widgets_from_type(type: Type): Widget[] {
  if (typeof type == "string") {
    throw new Error("widgets_from_type() called with string type: " + type);
  }

  if (type[".class"] == "TypeAliasType" && type.type_ref == "matplotlib._typing.ColorType") {
    return [create_code_and_control_widget("(0.90, 0.39, 0.40)", type)];
  }

  // Don't want ArrayLike to produce bool, float, int, string etc defaults, just [1,2,3]
  if (type[".class"] == "TypeAliasType" && type.type_ref == "matplotlib._typing.ArrayLike") {
    return [create_arbitrary_code_widget(default_code_for_type(type))];
  }

  type = get_proper_type(type);

  if (type[".class"] == "LiteralType") {
    return [create_literal_widget(type)];
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.bool") {
    return [
      create_code_and_control_widget("True",  type),
      create_code_and_control_widget("False", type),
      // create_bool_widget("True"),
      // create_bool_widget("False"),
    ];
    // return [
    //   create_arbitrary_code_widget("True"),
    //   create_arbitrary_code_widget("False"),
    // ];
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.float") {
    return [
      create_code_and_control_widget(default_code_for_type(type), type),
    ]
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.int") {
    return [
      create_code_and_control_widget(default_code_for_type(type), type),
    ]
  } else if (type[".class"] == "UnionType") {
    return type.items.flatMap(t => widgets_from_type(t));
  } else if (type[".class"] == "TypeAliasType") {
    console.warn("I don't think we are creating TypeAliasType widgets anymore...but we got here somehow??", type);
    return [create_alias_widget(type)];
  } else if ((type[".class"] == "Instance" && type.type_ref == "builtins.str") ||
             type[".class"] == "NoneType" ||
             type[".class"] == "TupleType"
            ) {
    return [create_arbitrary_code_widget(default_code_for_type(type))];
  }

  // console.warn("No type widget implemented!", type);
  return [];
}

