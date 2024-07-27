import { TypeAliasType } from "../../../types";
import {
  create_el,
  default_code_for_type,
  is_array_like,
} from "../../../utils/misc";
import { Widget } from "../widget";

export type AliasWidget = Widget & {
  kind: "Alias";
  a_type: TypeAliasType;
};

export function create_alias_widget(a_type: TypeAliasType): AliasWidget {
  const el = create_el("div", ["snp-arg", "snp-arg-alias"]);
  const value = default_code_for_type(a_type);
  el.innerText = value;

  // Should be editable
  el.contentEditable = "true";
  el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      el.closest(".snp_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
      el.blur();
    }
  });

  const widget: AliasWidget = {
    kind: "Alias",
    el,
    kind_label_for_dropdown: a_type.type_ref == "matplotlib._typing.ArrayLike" ? "list" : "???",
    does_match_arg_code: (arg_code: string) => arg_code_matches_alias_widget(widget, arg_code),
    to_code: () => widget.el.innerText,
    set_code: (new_code: string) => { widget.el.innerText = new_code },
    clone: () => clone_alias_widget(widget),
    a_type,
  };

  return widget;
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

