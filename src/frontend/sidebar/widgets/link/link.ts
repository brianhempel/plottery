import { LinkSuggestion } from "../../../types";
import { create_el } from "../../../utils/misc";
import { Widget } from "../widget";
import { code_to_hex } from "../color/color";
import "./link.css";

// A "link" dropdown suggestion: a type-compatible non-variable argument used at another
// call site, e.g. `color (0, 0, 1) of ax.bar(["a", "b", "c"], ...)`. Choosing it introduces
// a variable shared by both call sites (a non-local edit followed by a hard rerun), so the
// dropdown treats these items specially: hover previews `preview_code()` (the literal value,
// visually identical to the post-link plot) and click runs `on_choose()` instead of selecting.
export type LinkWidget = Widget & {
  kind: "Link";
  is_link_choice: true;
  suggestion: LinkSuggestion;
  preview_code: () => string;
  on_choose: () => void;
};

export function is_link_widget(widget: Widget): widget is LinkWidget {
  return (widget as LinkWidget).is_link_choice === true;
}

export function create_link_widget(
  suggestion: LinkSuggestion,
  preview_code: () => string,
  on_choose: () => void
): LinkWidget {
  const el = create_el("div", ["plottery-widget", "plottery-link-suggestion"]);

  // Color swatch preview, when the linked expression parses as an rgb tuple
  const hex = code_to_hex(suggestion.code);
  if (hex) {
    const swatch_el = create_el("div", "plottery-link-swatch", el);
    swatch_el.style.background = hex;
  }

  const label_el = create_el("div", "plottery-link-label", el);
  const arg_name_el = create_el("span", "plottery-link-arg-name", label_el);
  arg_name_el.innerText = suggestion.arg_name;
  label_el.append(` ${suggestion.code} `);
  const of_el = create_el("span", "plottery-link-of", label_el);
  of_el.innerText = "of";
  label_el.append(` ${suggestion.call_label}`);

  const widget: LinkWidget = {
    kind: "Link",
    is_link_choice: true,
    suggestion,
    el,
    kind_label_for_dropdown: "link",
    // A link item is an action, not a value: it must never be mistaken for the arg's current
    // code (auto-select in make_widget_for_code_and_type, old-item dedup in select_dropdown_item).
    does_match_arg_code: () => false,
    to_code:             () => "",
    set_code:            () => { console.warn("link suggestion widgets have no code to set"); },
    clone:               () => create_link_widget(suggestion, preview_code, on_choose),
    preview_code,
    on_choose,
  };

  return widget;
}
