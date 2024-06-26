import { TypeAliasType } from "../../../types";
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

// "(0.90, 0.39, 0.40)" => "#e66465"
export function code_to_hex(code: string) : string | undefined {
  const match = code.replaceAll(/\s/g, "").match(/^\((-?[\d\.]+),(-?[\d\.]+),(-?[\d\.]+)\)$/);
  if (!match) return undefined;
  const hex =
    match.slice(1) // first arg is the whole match, discard
      .map(Number)
      .map(channel => Math.round(channel * 255).toString(16))
      .map(hex => hex.length === 1 ? "0" + hex : hex)
      .join("");
  return "#" + hex;
}

export function arg_code_matches_color_widget(
  widget: ColorWidget,
  arg_code: string
): boolean {
  return code_to_hex(arg_code) !== undefined;
}

export function color_widget_to_code(widget: ColorWidget) {
  const rgb = hex_to_rgb(widget.color_picker.value);
  return `(${(rgb.r / 255).toFixed(2)}, ${(rgb.g / 255).toFixed(2)}, ${(
    rgb.b / 255
  ).toFixed(2)})`;
}

export function change_color_widget_code(widget: ColorWidget, new_code: string) {
  let hex = code_to_hex(new_code);
  if (hex) {
    widget.color_picker.value = hex;
  } else {
    console.error(`change_color_widget_code: don't know how to use ${new_code} as a color.`);
  }
}

export function get_color_widget_type_id(widget: ColorWidget) {
  return "color";
}
