import { Arg, ArgView, CallWithArgs, Type, UnionType } from "../../types";
import { MarkerRange, TextMarker } from "../../utils/codemirror";
import { create_el } from "../../utils/misc";
import {
  AliasWidget,
  create_alias_widget,
  arg_code_matches_alias_widget,
} from "../widgets/alias/alias";
import {
  ColorWidget,
  create_color_widget,
  arg_code_matches_color_widget,
} from "../widgets/color/color";
import {
  DropdownWidget,
  create_dropdown_widget,
  select_dropdown_item,
} from "../widgets/dropdown/dropdown";
import {
  CodeSnippetWidget,
  create_code_snippet_widget,
  arg_code_matches_code_snippet_widget,
} from "../widgets/code_snippet/code_snippet";

import {
  LiteralWidget,
  create_literal_widget,
  arg_code_matches_literal_widget,
} from "../widgets/literal/literal";
import { Widget, WidgetKind, widget_to_code } from "../widgets/widget";
import "./arg.css";
import { create_arbitrary_code_widget } from "../widgets/arbitrary_code/arbitrary_code";

export function create_arg_view(
  arg: Arg,
  options: { positional: boolean; disabled: boolean }
): ArgView {
  const arg_el = create_el("div", "snp-arg-view");

  // Prefix with the argument name
  const prefixEl = create_el("div", "snp-arg-name", arg_el);
  // prefixEl.innerHTML = `${arg.name}<span class="snp-arg-colon">:</span>`;
  prefixEl.innerHTML = `${arg.name}`;

  if (options.disabled) {
    arg_el.classList.add("snp-arg-disabled");
  }

  // Get the widgets based on the type
  let widgets = arg_view_widgets_from_type(arg.type);

  // Code snippet widgets
  widgets = widgets.concat((arg.type_compatible_code_snippets ?? []).map(create_code_snippet_widget));

  let widget_to_select = widgets.find(widget => arg_code_matches_widget(widget, arg.code));

  // If the user code does not match any of the type-derived widgets or the code snippets, then create an arbitrary code widget and put it first.
  if (!widget_to_select) {
    var arbitrary_code_widget = create_arbitrary_code_widget(arg.code);
    widgets.unshift(arbitrary_code_widget);
    widget_to_select = arbitrary_code_widget;
  }

  // If there are multiple widgets at this point, create a dropdown
  if (widgets.length > 1 && widget_to_select) {
    var widget: Widget = create_dropdown_widget(widgets);
    select_dropdown_item(widget as DropdownWidget, widget_to_select);
  } else {
    var widget: Widget = widgets[0];
  }

  arg_el.append(widget.el);

  return {
    el: arg_el,
    widget,
    positional: options.positional,
    disabled: options.disabled,
  };
}

export function enable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.remove("snp-arg-disabled");
  arg_view.disabled = false;
}

export function disable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.add("snp-arg-disabled");
  arg_view.disabled = true;
}

export function arg_view_widgets_from_type(type: Type): Widget[] {
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
    return type.items.flatMap(arg_view_widgets_from_type);
  } else if (typeof type == "object" && type[".class"] == "TypeAliasType") {
    return [create_alias_widget(type)];
  }

  console.warn("No type widget implemented!", type);
  return [];
}

export function arg_code_matches_widget(
  widget: Widget,
  arg_code: string
): boolean {
  if (widget.kind == WidgetKind.Dropdown) {
    console.warn("We don't support nested arg dropdowns right now", widget, arg_code);
    return false
  } else if (widget.kind == WidgetKind.Alias) {
    return arg_code_matches_alias_widget(widget as AliasWidget, arg_code);
  } else if (widget.kind == WidgetKind.CodeSnippet) {
    return arg_code_matches_code_snippet_widget(widget as CodeSnippetWidget, arg_code);
  } else if (widget.kind == WidgetKind.Literal) {
    return arg_code_matches_literal_widget(widget as LiteralWidget, arg_code);
  } else if (widget.kind == WidgetKind.Color) {
    return arg_code_matches_color_widget(widget as ColorWidget, arg_code);
  }

  console.warn("No implementation for matching...", widget, arg_code);
  return false;
}

export function arg_view_to_code(arg: Arg, arg_view: ArgView): string {
  const value_code = widget_to_code(arg_view.widget);
  return arg_view.positional ? value_code : `${arg.name}=${value_code}`;
}
