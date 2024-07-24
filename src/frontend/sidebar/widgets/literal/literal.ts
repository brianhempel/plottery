import { IInstanceType, LiteralType, NoneType } from "../../../types";
import {
  create_el,
  default_code_and_code_type_for_type,
  is_numeric,
  is_string_like,
} from "../../../utils/misc";
import { Widget } from "../widget";
import { Slider, make_slider, update_slider_val } from "./slider/slider";

export type LiteralWidget = Widget & {
  kind: "Literal";
  type: LiteralType | string | IInstanceType | NoneType;
  slider: Slider | null;
};

/**
 * A literal widget is a
 * @param type Literal type
 * @returns
 */
export function create_literal_widget(
  type: LiteralType | string | IInstanceType | NoneType
): LiteralWidget {
  const el = create_el("div", "snp-arg");

  if ((type as IInstanceType)?.type_ref == "builtins.str") {
    el.contentEditable = "true";
    el.addEventListener("keydown", ev => {
      if (ev.code === "Enter") {
        ev.stopPropagation();
        ev.preventDefault();
        el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
        el.blur();
      }
    });
  }

  let slider: Slider | null = null;

  const default_value = default_code_and_code_type_for_type(type)[0];

  if (is_literal_type_a_kind_of(type, "builtins.float")) {
    // ...make a slider
    slider = make_slider(parseFloat(default_value));
    el.append(slider.el);
  } else {
    el.innerText = default_value;
  }

  // Set appropriate styles
  if (is_literal_type_a_kind_of(type, "builtins.str"))
    el.classList.add("snp-arg-str");

  if (
    is_literal_type_a_kind_of(type, "builtins.float") ||
    is_literal_type_a_kind_of(type, "builtins.int")
  ) {
    el.classList.add("snp-arg-number");
  }

  const widget: LiteralWidget = {
    kind: "Literal",
    el,
    kind_label_for_dropdown: literal_kind_label_for_dropdown(type),
    does_match_arg_code: (arg_code: string) => arg_code_matches_literal_widget(widget, arg_code),
    to_code:             ()                 => widget.type == "builtins.float" ? widget.slider!.val_el.innerText : widget.el.innerText,
    set_code:            (new_code: string) => { widget.slider ? update_slider_val(widget.slider, eval(new_code)) : widget.el.innerText = new_code },
    clone:               ()                 => clone_literal_widget(widget),
    type,
    slider,
  };

  return widget
}

function clone_literal_widget(widget: LiteralWidget): LiteralWidget {
  const new_widget = create_literal_widget(widget.type);
  if (widget.slider && new_widget.slider) {
    update_slider_val(new_widget.slider, widget.slider.val);
  } else {
    new_widget.el.innerText = widget.el.innerText;
  }
  return new_widget;
}

function is_literal_type_a_kind_of(
  type: LiteralType | string | IInstanceType | NoneType,
  kind: string
): boolean {
  if (type == kind) {
    return true;
  } else if (
    typeof type == "object" &&
    type?.[".class"] == "Instance" &&
    type.type_ref == kind
  ) {
    return true;
  } else if (
    typeof type == "object" &&
    type?.[".class"] == "LiteralType" &&
    (type.fallback as IInstanceType)?.type_ref == kind
  ) {
    return true;
  } else {
    return false;
  }
}

function arg_code_matches_literal_widget(
  widget: LiteralWidget,
  arg_code: string
): boolean {
  if (
    is_literal_type_a_kind_of(widget.type, "builtins.str") &&
    is_string_like(arg_code)
  ) {
    return true;
  } else if (
    is_literal_type_a_kind_of(widget.type, "builtins.float") &&
    is_numeric(arg_code)
  ) {
    return true;
  } else if (widget.el.innerText == arg_code) {
    return true;
  } else {
    return false;
  }
}


function literal_kind_label_for_dropdown(type: LiteralType | string | IInstanceType | NoneType) {
  if (type == "builtins.str") {
    return "str";
  } else if (type == "builtins.float") {
    return "num";
  } else if (type == null) {
    return "None";
  } else {
    return "lit";
  }
}
