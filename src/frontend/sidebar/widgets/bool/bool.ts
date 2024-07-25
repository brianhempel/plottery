import { create_el } from "../../../utils/misc";
import { Widget } from "../widget";

export type BoolWidget = Widget & {
  kind: "Bool";
  isOn: boolean;
  switchEl: HTMLElement;
};

export function create_bool_widget(code: string): BoolWidget {
  const el = create_el("div", "snp-widget");

  el.innerHTML = `<div class="snp-bool-switch"><span class="switch-knob"></span></div>`;

  const switchEl = el.querySelector(".snp-bool-switch") as HTMLElement;
  const isOn = code == "True";

  const widget: BoolWidget = {
    kind: "Bool",
    el,
    kind_label_for_dropdown: "bool",
    does_match_arg_code: (arg_code: string) => arg_code == "True" || arg_code == "False",
    to_code:             ()                 => widget.isOn ? "True" : "False",
    set_code:            (new_code: string) => { widget.isOn = new_code == "True"; move_knob(widget) },
    clone:               ()                 => create_bool_widget(widget.to_code()),
    isOn,
    switchEl,
  };
  move_knob(widget)

  switchEl.addEventListener("click", ev => {
    widget.isOn = !widget.isOn;
    move_knob(widget)
    ev.stopPropagation();
    ev.preventDefault();
  });

  return widget
}

function move_knob(widget: BoolWidget) {
  if (widget.isOn) {
    widget.switchEl.classList.add("on");
  } else {
    widget.switchEl.classList.remove("on");
  }
}
