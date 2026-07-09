import { log_event } from "../../../utils/instrumentation";
import { create_el, select_code_text } from "../../../utils/misc";
import { Widget } from "../widget";

export type ArbitraryCodeWidget = Widget & {
  kind: "ArbitraryCode";
};

export function create_arbitrary_code_widget(code: string): ArbitraryCodeWidget {
  const el = create_el("div", ["snp-widget", "arbitrary-code-widget"]);
  el.textContent = code;
  el.contentEditable = "true";
  el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      log_event("gui", "code widget enter", { arg_code: el.innerText });
      ev.stopPropagation();
      ev.preventDefault();
      el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      el.closest(".snp_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
      el.blur();
    } else {
      log_event("gui", "code widget keydown", { arg_code: el.innerText });
    }
  });

  const widget: ArbitraryCodeWidget = {
    kind: "ArbitraryCode",
    el,
    kind_label_for_dropdown: "code",
    does_match_arg_code: (arg_code: string) => arg_code == widget.to_code(),
    // textContent (not innerText): innerText returns "" for elements in non-rendered
    // subtrees (e.g. Notebook 7 windows offscreen cells with content-visibility:auto),
    // which made the code-sync watcher blank this arg out of the cell source. textContent
    // is layout-independent (and cheaper: no forced reflow).
    to_code:             ()                 => widget.el.textContent ?? "",
    set_code:            (new_code: string) => { widget.el.textContent = new_code },
    clone:               ()                 => create_arbitrary_code_widget(widget.to_code()),
  };

  // Prevent layer drag by @mech https://stackoverflow.com/a/34588661
  el.addEventListener('mouseenter', () => el.closest(".snp-layer")?.setAttribute("draggable", "false") );
  el.addEventListener('mouseleave', () => el.closest(".snp-layer")?.setAttribute("draggable", "true")  );

  // When el is clicked, select its text
  el.addEventListener("focus", ev => { select_code_text(el); log_event("gui", "code widget focus", { arg_code: el.innerText }); });

  return widget
}
