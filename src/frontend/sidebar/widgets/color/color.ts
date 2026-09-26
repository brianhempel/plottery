import { TypeAliasType } from "../../../types";
import { log_event } from "../../../utils/instrumentation";
import { create_el, hex_to_rgb } from "../../../utils/misc";
import { Widget } from "../widget";
import "./color.css";

export type ColorWidget = Widget & {
  kind: "Color";
  type: TypeAliasType;
  color_picker: HTMLInputElement;
};

export function create_color_widget(type: TypeAliasType): ColorWidget {
  const el = create_el("div", "plottery-widget");

  // Color picker
  const color_picker = create_el("input", "plottery-arg-color") as HTMLInputElement;
  color_picker.setAttribute("type", "color");
  color_picker.setAttribute("value", "#e66465");

  el.append(color_picker);

  const widget: ColorWidget = {
    kind: "Color",
    type,
    el,
    kind_label_for_dropdown: "color",
    does_match_arg_code: (arg_code: string) => code_to_hex(arg_code) !== undefined,
    to_code:             ()                 => color_widget_to_code(widget),
    set_code:            (new_code: string) => { change_color_widget_code(widget, new_code) },
    clone:               ()                 => clone_color_widget(widget),
    color_picker,
  };

  // Don't open dropdown when clicking on the color picker
  color_picker.addEventListener("click", ev => {
    log_event("gui", "color picker widget open", { arg_code: widget.to_code() });
    ev.stopPropagation();
  });

  return widget
}

function clone_color_widget(widget: ColorWidget): ColorWidget {
  const new_widget = create_color_widget(widget.type);
  change_color_widget_code(new_widget, widget.to_code());
  return new_widget;
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

function color_widget_to_code(widget: ColorWidget) {
  const rgb = hex_to_rgb(widget.color_picker.value);
  return `(${(rgb.r / 255).toFixed(2)}, ${(rgb.g / 255).toFixed(2)}, ${(
    rgb.b / 255
  ).toFixed(2)})`;
}

function change_color_widget_code(widget: ColorWidget, new_code: string) {
  let hex = code_to_hex(new_code);
  if (hex) {
    widget.color_picker.value = hex;
  } else {
    console.error(`change_color_widget_code: don't know how to use ${new_code} as a color.`);
  }
}
