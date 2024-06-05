import { IInstanceType, LiteralType, NoneType } from "../../../types";
import {
  create_el,
  default_code_and_code_type_for_type,
  is_numeric,
  is_string_like,
} from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";
import { Slider, make_slider, update_slider_val } from "./slider/slider";

export type LiteralWidget = Widget & {
  kind: WidgetKind.Literal;
  type: LiteralType | string | IInstanceType | NoneType;
  slider: Slider | null;
};

/**
 * A literal widget is a
 * @param type Literal type
 * @returns
 */
export function create_literal_widget(
  type: LiteralType | IInstanceType | NoneType
): LiteralWidget {
  const el = create_el("div", "snp-arg");

  if ((type as IInstanceType)?.type_ref == "builtins.str") {
    el.contentEditable = "true";
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
  )
    el.classList.add("snp-arg-number");

  return {
    kind: WidgetKind.Literal,
    el,
    type,
    slider,
  };
}

export function is_literal_type_a_kind_of(
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

export function arg_code_matches_literal_widget(
  widget: LiteralWidget,
  arg_code: string
): boolean {
  if (
    is_literal_type_a_kind_of(widget.type, "builtins.str") &&
    is_string_like(arg_code)
  ) {
    widget.el.innerText = arg_code;
    return true;
  } else if (
    is_literal_type_a_kind_of(widget.type, "builtins.float") &&
    is_numeric(arg_code)
  ) {
    update_slider_val(widget, parseFloat(arg_code));
    return true;
  } else if (widget.el.innerText == arg_code) {
    return true;
  } else {
    return false;
  }
}

export function literal_widget_to_code(widget: LiteralWidget) {
  if (widget.type == "builtins.float") {
    return widget.slider!.val_el.innerText;
  } else {
    return widget.el.innerText;
  }
}

export function get_literal_widget_type_id(widget: LiteralWidget) {
  if (widget.type == "builtins.str") {
    return "str";
  } else if (widget.type == "builtins.float") {
    return "num";
  } else if (widget.type == null) {
    return "None";
  } else {
    return "lit";
  }
}
