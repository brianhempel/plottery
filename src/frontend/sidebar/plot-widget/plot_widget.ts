import {
  Arg,
  ArgView,
  State,
} from "../../types";
import {
  create_edit_icon,
  create_el,
  find_call_that_satisfies,
  relativeBoundingRect,
} from "../../utils/misc";
import { WidgetKind } from "../widgets/widget";
import "./plot_widget.css";

export type PlotWidget = {
  call_code: string;
  arg_name: string;
  type: string;
};


/**
 * Widgets that are located on the plot. Right now, the only one supported is
 * to edit text. E.g. editing the 'title' by clicking it on the plot.
 * @param state
 */
export function make_plot_widgets(state: State) {
  const plot_widgets_config: PlotWidget[] = [
    {
      call_code: "ax.set_title",
      arg_name: "label",
      type: "builtins.str",
    },
    {
      call_code: "ax.set_xlabel",
      arg_name: "xlabel",
      type: "builtins.str",
    },
    {
      call_code: "ax.set_ylabel",
      arg_name: "ylabel",
      type: "builtins.str",
    },
  ];

  for (const plot_widget_config of plot_widgets_config) {
    // Find the call
    let target_call = find_call_that_satisfies((call_info, _) => {
      const call_code_prefix = call_info.loc_via_func_code_and_num[0];
      return call_code_prefix == plot_widget_config.call_code;
    }, state);

    if (target_call == undefined) {
      // console.warn(
      //   "[Make plot widgets] Target call is null for",
      //   plot_widget_config
      // );
      continue;
    }

    // Find the arg in call
    let target_arg: {
      arg: Arg;
      view: ArgView;
    } | undefined = target_call.view.arguments.find(({ arg }) => arg.name == plot_widget_config.arg_name);

    if (target_arg == undefined) {
      // console.warn(
      //   "[Make plot widgets] Target arg is null for",
      //   plot_widget_config
      // );
      continue;
    }

    // Find the hover element
    const show_on: number[] = target_call.info.show_on; // Python artist object_ids
    console.log("show_on", show_on);

    const hover_regions = Array.from(state.snp_outer.querySelector("svg")?.querySelectorAll('[data-artist-id]') || []).filter(el => show_on.includes(parseInt(el.getAttribute("data-artist-id") || "-1")));

    // console.log("hover_regions", hover_regions);

    let widget = target_arg.view.widget;
    // if (widget.kind == WidgetKind.Dropdown) {
    //   widget = (widget as DropdownWidget).selected_item;
    // }

    // Only show on last hover region
    for (const hover_region of hover_regions.slice(-1)) {
      if (widget.kind == WidgetKind.Literal && plot_widget_config.type == "builtins.str") {
        // const container = create_el("div", "plot-widget-container");

        const el = create_el("div", "plot-widget", state.snp_outer);
        const {top, right} = relativeBoundingRect(hover_region, state.snp_outer)
        el.style.top = `${top}px`;
        el.style.left = `${right}px`;
        const icon = create_edit_icon();
        icon.classList.add("plot-widget-edit-icon");
        el.append(icon);

        // Freeform input box
        const plot_widget_el = create_el("div", "plot-widget-input", el);
        plot_widget_el.contentEditable = "true";

        plot_widget_el.innerText = widget.el.innerText;

        // Clicking on the el, triggers the input box to show above the el
        icon.addEventListener("click", () => {
          plot_widget_el.classList.toggle("visible");
          icon.classList.toggle("toggled");
        });

        plot_widget_el.addEventListener("input", () => {
          widget.el.innerText = plot_widget_el.innerText;
        });

        // Clicking anywhere else, hides the widget
        document.addEventListener("mousedown", e => {
          if (
            plot_widget_el.classList.contains("visible") &&
            e.target != plot_widget_el
          ) {
            plot_widget_el.classList.remove("visible");
            icon.classList.remove("toggled");
          }
        });
      }
    }
  }
}
