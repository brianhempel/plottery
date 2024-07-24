import { create_el } from "../../../utils/misc";
import { Widget } from "../widget";

export type ArbitraryCodeWidget = Widget & {
  kind: "ArbitraryCode";
};

export function create_arbitrary_code_widget(code: string): ArbitraryCodeWidget {
  const el = create_el("div", "snp-arg");
  el.innerText = code;
  el.contentEditable = "true";
  el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      el.blur();
    }
  });

  const widget: ArbitraryCodeWidget = {
    kind: "ArbitraryCode",
    el,
    kind_label_for_dropdown: "code",
    does_match_arg_code: (arg_code: string) => arg_code == widget.to_code(),
    to_code:             ()                 => widget.el.innerText,
    set_code:            (new_code: string) => { widget.el.innerText = new_code },
    clone:               ()                 => create_arbitrary_code_widget(widget.to_code()),
  };

  return widget
}
