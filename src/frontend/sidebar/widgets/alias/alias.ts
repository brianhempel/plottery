import { TypeAliasType } from "../../../types";
import {
  create_el,
  default_code_and_code_type_for_type,
  is_array_like,
} from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type AliasWidget = Widget & {
  kind: WidgetKind.Alias;
  a_type: TypeAliasType;
};

export function create_alias_widget(a_type: TypeAliasType): AliasWidget {
  const el = create_el("div", ["snp-arg", "snp-arg-alias"]);
  const value = default_code_and_code_type_for_type(a_type)[0];
  el.innerText = value;

  // Should be editable
  el.contentEditable = "true";
  el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      el.blur();
    }
  });

  return {
    kind: WidgetKind.Alias,
    el,
    a_type
  };
}

export function clone_alias_widget(widget: AliasWidget): AliasWidget {
  let new_widget = create_alias_widget(widget.a_type);
  new_widget.el.innerText = widget.el.innerText;
  return new_widget;
}

export function arg_code_matches_alias_widget(
  widget: AliasWidget,
  arg_code: string
): boolean {
  // @TODO: Make more robust
  return widget.a_type.type_ref == "matplotlib._typing.ArrayLike" && is_array_like(arg_code)
}

export function alias_widget_to_code(widget: AliasWidget) {
  return widget.el.innerText;
}

export function change_alias_widget_code(widget: AliasWidget, new_code: string) {
  widget.el.innerText = new_code;
}

export function get_alias_widget_type_id(widget: AliasWidget) {
  // @TODO: Make more robust
  if (widget.a_type.type_ref == "matplotlib._typing.ArrayLike") {
    return "list";
  } else {
    return "???";
  }
}
