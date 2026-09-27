import { Type } from "../../../types";
import { create_el } from "../../../utils/misc";
import { ArbitraryCodeWidget, create_arbitrary_code_widget } from "../arbitrary_code/arbitrary_code";
import { create_bool_widget } from "../bool/bool";
import { create_color_widget } from "../color/color";
import { create_float_widget } from "../float/float";
import { create_int_widget } from "../int/int";
import { Widget } from "../widget";
import "./code_and_control.css";

// A text box next to a GUI control.
// If the text becomes incompatible with the GUI, a new GUI is found or the GUI is removed.

export type CodeAndControlWidget = Widget & {
  kind: "CodeAndControl";
  code_widget: ArbitraryCodeWidget;
  control_widget: Widget | null;
  control_widget_observer: MutationObserver | null;
  type: Type;
};

export function create_code_and_control_widget(code: string, type: Type): CodeAndControlWidget {
  const el = create_el("div", ["plottery-widget", "code-and-control-widget"]);
  const code_widget = create_arbitrary_code_widget(code);

  el.append(code_widget.el);

  const widget: CodeAndControlWidget = {
    kind: "CodeAndControl",
    el,
    kind_label_for_dropdown: "code",
    does_match_arg_code: (arg_code: string) => widget.control_widget?.does_match_arg_code(arg_code) || arg_code == widget.to_code(),
    to_code:             code_widget.to_code,
    set_code:            (new_code: string) => { code_widget.set_code(new_code); perhaps_set_control_widget_code(widget, new_code); },
    clone:               ()                 => create_code_and_control_widget(widget.to_code(), widget.type),
    code_widget,
    control_widget: null,
    control_widget_observer: null,
    type,
  };

  attach_dom_change_handler(code_widget.el, () => {
    // console.log('code widget changed');
    const new_code = code_widget.to_code();
    widget.control_widget?.to_code() != new_code && perhaps_set_control_widget_code(widget, new_code);
  });

  // Now, generate and attach the control widget
  widget.set_code(code)

  return widget
}

function attach_dom_change_handler(el: HTMLElement, callback: () => void): MutationObserver {
  const observer = new MutationObserver(callback);
  observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });

  // input element changes are not always reflected in the DOM, attach a change listener
  el.querySelectorAll("input").forEach(input => { input.addEventListener("input", callback); });

  return observer;
}

function attach_control_widget_change_handler(widget: CodeAndControlWidget, control_widget: Widget) {
  widget.control_widget_observer = attach_dom_change_handler(control_widget.el, () => {
    // console.log('control widget changed');
    const new_code = control_widget.to_code();
    widget.code_widget.to_code() != new_code && widget.code_widget.set_code(new_code);
  });
}

export function perhaps_make_control_widget(code: string, type: Type): Widget | null {
  if (type[".class"] == "TypeAliasType" && type.type_ref == "matplotlib._typing.ColorType") {
    return create_color_widget(type);
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.bool") {
    return create_bool_widget(code);
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.float") {
    return create_float_widget(code);
  } else if (type[".class"] == "Instance" && type.type_ref == "builtins.int") {
    return create_int_widget(code);
  }

  return null;
}

function perhaps_set_control_widget_code(widget: CodeAndControlWidget, new_code: string) {
  const { control_widget } = widget;

  if (control_widget && control_widget.does_match_arg_code(new_code)) {
    control_widget.set_code(new_code);
  } else {
    control_widget?.el.remove();
    widget.control_widget_observer?.disconnect();
    widget.control_widget = null;
    widget.control_widget_observer = null;
    const new_control_widget = perhaps_make_control_widget(new_code, widget.type);
    if (new_control_widget?.does_match_arg_code(new_code)) {
      widget.control_widget = new_control_widget;
      widget.el.append(new_control_widget.el);
      attach_control_widget_change_handler(widget, new_control_widget);
      widget.kind_label_for_dropdown = new_control_widget.kind_label_for_dropdown;
    } else {
      widget.kind_label_for_dropdown = "code";
    }
  }
}