import { State } from "../../types";
import { create_el } from "../../utils/misc";
import "./toggles.css";

/**
 * Global on-off bools to enable/disable functionality, normally at the bottom
 * right of the screen: e.g.
 * [x] Show plot widgets
 * [x] Show methods on plot
 * ...
 */
export function create_toggles(state: State) {
  const el = create_el("div", "snp-toggles", state.sidebar!.el);

  // Create a toggle to show or hide methods on plot
  const method_toggle_name = "Show methods on plot";
  const method_toggle_enable = () => {
    state.hover_regions?.el.classList.remove("disable");
  };
  const method_toggle_disable = () => {
    state.hover_regions?.el.classList.add("disable");
  };
  const method_toggle_is_checked = (window as any)[method_toggle_name] == true;
  create_toggle(
    method_toggle_name,
    method_toggle_enable,
    method_toggle_disable,
    el,
    method_toggle_is_checked
  );

  // Is enabled by default
  if (!method_toggle_is_checked) {
    method_toggle_disable();
  }

  // Create a toggle to enable focusing from plot
  const focus_toggle_name = "Allow focus from plot";
  const focus_toggle_enable = () => {
    (window as any)["enable_focus_from_plot"] = true;
  };
  const focus_toggle_disable = () => {
    (window as any)["enable_focus_from_plot"] = false;
  };
  const focus_toggle_is_checked =
    (window as any)["enable_focus_from_plot"] == true;

  const focus_toggle = create_toggle(
    focus_toggle_name,
    focus_toggle_enable,
    focus_toggle_disable,
    el,
    focus_toggle_is_checked
  );

  // Is disabled by default
  if (focus_toggle_is_checked) {
    focus_toggle_enable();
  }

  // Create a toggle to enable showing widgets on plot
  const widget_toggle_name = "Show on-plot widgets";
  const widget_toggle_enable = () => {
    state.snp_outer
      .querySelectorAll(".plot-widget")
      .forEach(w => w.classList.remove("disabled"));

    (window as any)["snp_enable_plot_widget"] = true;
  };
  const widget_toggle_disable = () => {
    state.snp_outer
      .querySelectorAll(".plot-widget")
      .forEach(w => w.classList.add("disabled"));

    (window as any)["snp_enable_plot_widget"] = false;
  };

  const widget_toggle_is_checked =
    (window as any)["snp_enable_plot_widget"] == true;

  const widget_toggle = create_toggle(
    widget_toggle_name,
    widget_toggle_enable,
    widget_toggle_disable,
    el,
    widget_toggle_is_checked
  );

  // Is enabled by default
  if (!widget_toggle_is_checked) {
    widget_toggle_disable();
  }
}

export function create_toggle(
  name: string,
  enable: () => void,
  disable: () => void,
  parent: HTMLElement,
  checked_by_default: boolean
) {
  const el = create_el("div", "snp-toggle", parent);

  const input_el = create_el(
    "input",
    "snp-toggle-input",
    el
  ) as HTMLInputElement;
  if (checked_by_default) {
    input_el.setAttribute("checked", "");
  }
  input_el.setAttribute("type", "checkbox");
  input_el.addEventListener("change", () => {
    if (input_el.checked == true) {
      enable();
    } else {
      disable();
    }

    (window as any)[name] = input_el.checked;
  });

  const name_el = create_el("div", "snp-toggle-name", el);
  name_el.innerText = name;

  return {
    el,
    name_el,
    input_el,
  };
}
