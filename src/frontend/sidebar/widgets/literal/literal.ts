import { LiteralType } from "../../../state";
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
  type: LiteralType | string;
  slider: Slider | null;
};

export function create_literal_widget(
  type: LiteralType | string
): LiteralWidget {
  const el = create_el("div", "snp-arg");

  if (type == "builtins.str") {
    el.contentEditable = "true";
  }

  let slider: Slider | null = null;

  const default_value = default_code_and_code_type_for_type(type)[0];

  if (type == "builtins.float") {
    // ...make a slider
    slider = make_slider(parseFloat(default_value));
    el.append(slider.el);
  } else {
    el.innerText = default_value;
  }

  // Set appropriate styles
  if (
    type == "builtins.str" ||
    (typeof type == "object" && type.fallback == "builtins.str")
  )
    el.classList.add("snp-arg-str");

  if (
    type == "builtins.float" ||
    (typeof type == "object" && type.fallback == "builtins.float")
  )
    el.classList.add("snp-arg-number");

  return {
    kind: WidgetKind.Literal,
    el,
    type,
    slider,
  };
}

export function match_arg_code_to_literal_widget(
  widget: LiteralWidget,
  arg_code: string
): boolean {
  if (widget.type == "builtins.str" && is_string_like(arg_code)) {
    widget.el.innerText = arg_code;

    return true;
  } else if (widget.type == "builtins.float" && is_numeric(arg_code)) {
    update_slider_val(widget, parseFloat(arg_code));

    return true;
  } else if (widget.el.innerText == arg_code) {
    return true;
  } else {
    console.log("[Literal] No match!", widget, arg_code);
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
  } else {
    return "lit";
  }
}
