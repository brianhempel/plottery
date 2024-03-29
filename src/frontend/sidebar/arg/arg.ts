import { Arg, ArgView, CallWithArgs, Type, UnionType } from "../../state";
import { MarkerRange, TextMarker } from "../../utils/codemirror";
import { create_el } from "../../utils/misc";
import {
  AliasWidget,
  create_alias_widget,
  match_arg_code_to_alias_widget,
} from "../widgets/alias/alias";
import {
  ColorWidget,
  create_color_widget,
  match_arg_code_to_color_widget,
} from "../widgets/color/color";
import {
  DropdownWidget,
  add_items_to_dropdown_widget,
  create_dropdown_widget,
  select_dropdown_item,
} from "../widgets/dropdown/dropdown";
import {
  IdentifierWidget,
  create_identifier_widget,
  match_arg_code_to_identifier_widget,
} from "../widgets/identifier/identifier";

import {
  LiteralWidget,
  create_literal_widget,
  match_arg_code_to_literal_widget,
} from "../widgets/literal/literal";
import { Widget, WidgetKind, widget_to_code } from "../widgets/widget";
import "./arg.css";

export function create_arg_view(
  arg: Arg,
  call: CallWithArgs,
  mark: TextMarker<MarkerRange>,
  options: { positional: boolean; optional: boolean }
): ArgView {
  const arg_el = create_el("div", "snp-arg-view");

  // if (!options.positional) {
  // Prefix with the argument name
  const prefixEl = create_el("div", "snp-arg-name", arg_el);
  prefixEl.innerHTML = `${arg.name}<span class="snp-arg-colon">:</span>`;
  // }

  if (options.optional) {
    arg_el.classList.add("snp-arg-optional");
  }

  // Get the widget from type
  let widget = create_arg_view_widgets(arg.type);

  // Add identifiers
  widget = create_arg_view_identifier_widgets(
    widget,
    arg.type_compatible_local_names
  );

  // Match the `arg.code` to the args
  // console.log(widget, arg.code);
  match_arg_code_to_widget(widget, arg.code);

  arg_el.append(widget.el);

  let comma_el = null;

  return {
    el: arg_el,
    comma_el,
    widget,
    positional: options.positional,
    optional: options.optional,
  };
}

export function make_arg_view_non_optional(arg_view: ArgView) {
  arg_view.el.classList.remove("snp-arg-optional");
  arg_view.optional = false;
}

export function make_arg_view_optional(arg_view: ArgView) {
  arg_view.el.classList.add("snp-arg-optional");
  arg_view.optional = true;
}

export function create_arg_view_widgets(type: Type): Widget {
  if (
    typeof type == "object" &&
    type[".class"] == "TypeAliasType" &&
    type.type_ref == "matplotlib._typing.ColorType"
  ) {
    return create_color_widget(type);
  } else if (
    typeof type == "string" ||
    (typeof type == "object" && type[".class"] == "LiteralType") ||
    (typeof type == "object" && type[".class"] == "Instance") ||
    (typeof type == "object" && type[".class"] == "NoneType")
  ) {
    return create_literal_widget(type);
  } else if (typeof type == "object" && type[".class"] == "UnionType") {
    return create_arg_view_widget_union(type);
  } else if (typeof type == "object" && type[".class"] == "TypeAliasType") {
    return create_alias_widget(type);
  }

  console.warn("No type widget implemented!", type);
  return { kind: null as any, el: create_el("div", "placeholder") };
}

export function create_arg_view_widget_union(u_type: UnionType): Widget {
  const children = u_type.items;

  if (children.length == 1) {
    return create_arg_view_widgets(children[0]);
  }

  return create_dropdown_widget(
    children.map(type => create_arg_view_widgets(type))
  );
}

export function create_arg_view_identifier_widgets(
  widget: Widget,
  identifiers: string[]
): Widget {
  if (identifiers.length == 0) return widget;

  // Make it into a dropdown if not already
  if (widget.kind != WidgetKind.Dropdown) {
    const new_widget = create_dropdown_widget([widget]);
    return create_arg_view_identifier_widgets(new_widget, identifiers);
  }

  // Add identifier widgets to the dropdown
  const identifier_widgets = identifiers.map(name =>
    create_identifier_widget(name)
  );
  add_items_to_dropdown_widget(widget as DropdownWidget, identifier_widgets);

  return widget;
}

export function match_arg_code_to_widget(
  widget: Widget,
  arg_code: string
): boolean {
  if (widget.kind == WidgetKind.Dropdown) {
    let did_match = false;
    // Loop through items, and if any do match, then promote them to be selected
    for (const item of (widget as DropdownWidget).items) {
      const matched = match_arg_code_to_widget(item, arg_code);

      if (matched) {
        did_match = true;
        select_dropdown_item(widget as DropdownWidget, item);
        break;
      }
    }

    return did_match;
  } else if (widget.kind == WidgetKind.Alias) {
    return match_arg_code_to_alias_widget(widget as AliasWidget, arg_code);
  } else if (widget.kind == WidgetKind.Identifier) {
    return match_arg_code_to_identifier_widget(
      widget as IdentifierWidget,
      arg_code
    );
  } else if (widget.kind == WidgetKind.Literal) {
    return match_arg_code_to_literal_widget(widget as LiteralWidget, arg_code);
  } else if (widget.kind == WidgetKind.Color) {
    return match_arg_code_to_color_widget(widget as ColorWidget, arg_code);
  }

  console.warn("No implementation for matching...", widget, arg_code);
  return false;
}

export function arg_view_to_code(arg: Arg, arg_view: ArgView): string {
  if (arg_view.optional == true) return "";

  let code = "";

  if (!arg_view.positional) {
    // Get prefix
    code += `${arg.name}=`;
  }

  code += widget_to_code(arg_view.widget);

  code += ", ";

  return code;
}
