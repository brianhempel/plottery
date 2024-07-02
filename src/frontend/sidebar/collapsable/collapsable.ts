import { create_dropdown_arrow, create_el } from "../../utils/misc";
// import "./collapsable.css";

/**
 * Just a simple element that can be collapsed/uncollapsed.
 *
 * Starts collapsed.
 *
 * Collapsed:
 * [>] Label
 *
 * Uncollapsed:
 * [v] Label
 *      - Child 1
 *      - Child 2
 *      ...
 */
export function create_collapsable_els() {
  // Collapse container
  const el = create_el("div", ["snp-collapsable", "collapsed"]);

  // Header
  const header_el = create_el("div", "snp-collapsable-header", el);

  // Collapse button
  const collapse_button_el = create_dropdown_arrow();
  collapse_button_el.classList.add("snp-collapsable-button");
  header_el.append(collapse_button_el);

  // Outer body
  const outer_body_el = create_el("div", "snp-collapsable-outer-body", el);

  // Indent
  const collapse_indent_el = create_el(
    "div",
    "snp-collapsable-indent",
    outer_body_el
  );

  // Body
  const body_el = create_el("div", "snp-collapsable-body", outer_body_el);

  // Functionality
  header_el.addEventListener("click", () => {
    toggle_collapsable(el);
  });

  return {
    el,
    header_el,
    collapse_button_el,
    body_el,
    outer_body_el,
    collapse_indent_el,
  };
}

export function is_collapsable_collapsed(el: HTMLElement) {
  return el.classList.contains("collapsed");
}

export function collapse_collapsable(el: HTMLElement) {
  return el.classList.add("collapsed");
}

export function open_collapsable(el: HTMLElement) {
  return el.classList.remove("collapsed");
}

export function toggle_collapsable(el: HTMLElement) {
  return el.classList.toggle("collapsed");
}
