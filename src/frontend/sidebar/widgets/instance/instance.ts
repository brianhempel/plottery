import { IInstanceType } from "../../../state";
import {
  create_el,
  default_code_and_code_type_for_type,
} from "../../../utils/misc";
import { Widget, WidgetKind } from "../widget";

export type InstanceWidget = Widget & {
  kind: WidgetKind.Instance;
  type: IInstanceType;
  value: string;
};

export function create_instance_widget(type: IInstanceType): InstanceWidget {
  // @TODO: Change arg-str depending on if it's a str!
  const el = create_el("div", "snp-arg");
  const value = default_code_and_code_type_for_type(type)[0];
  el.innerText = value;
  el.contentEditable = "true";

  return {
    kind: WidgetKind.Instance,
    el,
    value,
    type,
  };
}

export function instance_widget_to_code(widget: InstanceWidget) {
  return widget.el.innerText;
}

export function match_arg_code_to_instance_widget(
  widget: InstanceWidget,
  arg_code: string
): boolean {
  if (widget.value == arg_code) {
    return true;
  } else {
    console.log("[instance] No match!", widget, arg_code);
    return false;
  }
}

export function get_instance_widget_type_id(widget: InstanceWidget) {
  // @TODO: Make more robust
  if (widget.type.type_ref == "builtins.dict") {
    return "dict";
  }

  return "???";
}
