import { TypeAliasType } from "../../../state";
import { create_el, hex_to_rgb } from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";
import "./color.css";

export type ColorWidget = Widget & {
  kind: WidgetKind.Color;
  type: TypeAliasType;
  color_picker: HTMLInputElement;
};

export function create_color_widget(type: TypeAliasType): ColorWidget {
  const el = create_el("div", "snp-arg");

  // Color picker
  const color_picker = create_el("input", "snp-arg-color") as HTMLInputElement;
  color_picker.setAttribute("type", "color");
  color_picker.setAttribute("value", "#e66465");

  el.append(color_picker);

  return {
    kind: WidgetKind.Color,
    type,
    el,
    color_picker,
  };
}

export function match_arg_code_to_color_widget(
  widget: ColorWidget,
  arg_code: string
): boolean {
  return false;
}

export function color_widget_to_code(widget: ColorWidget) {
  const rgb = hex_to_rgb(widget.color_picker.value);
  return `(${(rgb.r / 255).toFixed(2)}, ${(rgb.g / 255).toFixed(2)}, ${(
    rgb.b / 255
  ).toFixed(2)})`;
}

export function get_color_widget_type_id(widget: ColorWidget) {
  return "color";
}
