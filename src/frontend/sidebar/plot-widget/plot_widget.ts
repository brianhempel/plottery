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
import { enable_arg_view } from "../arg/arg";
import { hover_regions_for_call } from "../hover-regions/hover_regions";
import "./plot_widget.css";

export type PlotWidgetConfig = {
  call_code: string;
  arg_name: string;
  type: string;
};

export type PlotWidget = {
  el: HTMLElement;
  icon_el: HTMLElement;
  input_el: HTMLElement;
  show_on_loc_via_func_code_and_num: [string, number]; // can't use artist id's because they change on live sync
}


/**
 * Widgets that are located on the plot. Right now, the only one supported is
 * to edit text. E.g. editing the 'title' by clicking it on the plot.
 * @param state
 */
export function make_plot_widgets(state: State) {
  const plot_widgets_configs: PlotWidgetConfig[] = [
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

  for (const plot_widget_config of plot_widgets_configs) {
    // Find the call
    let target_call = find_call_that_satisfies((call_info, _) => plot_widget_config.call_code == call_info.loc_via_func_code_and_num[0], state);

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
      console.warn(
        "[Make plot widgets] Target arg is null for",
        plot_widget_config
      );
      continue;
    }

    const show_on_loc_via_func_code_and_num = target_call.info.loc_via_func_code_and_num;

    let widget = target_arg.view.widget;

    const el = create_el("div", "plot-widget", state.plot_area);
    const icon = create_edit_icon();
    icon.classList.add("plot-widget-edit-icon");
    el.append(icon);

    // Freeform input box
    const plot_widget_el = create_el("div", ["plot-widget-input", "hidden"], el);
    plot_widget_el.contentEditable = "true";
    plot_widget_el.addEventListener("keydown", ev => {
      if (ev.code === "Enter") {
        plot_widget_el.classList.add("hidden");
        icon.classList.remove("hidden");
        plot_widget_el.blur();
        reposition_plot_widgets(state); // The widget was not repositioned during the edits.
        ev.stopPropagation();
        ev.preventDefault();
      }
    });

    plot_widget_el.innerText = widget.to_code();

    // Clicking on the el, triggers the input box to show above the el
    icon.addEventListener("click", () => {
      plot_widget_el.classList.remove("hidden");
      icon.classList.add("hidden");
      plot_widget_el.focus();

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();

        const range = document.createRange();

        const starting_code = plot_widget_el.innerText;

        let [start_i, end_i] = [0, starting_code.length];

        // If a literal string, select inside the string.
        if ((starting_code.startsWith(`'`) && starting_code.endsWith(`'`)) || (starting_code.startsWith(`"`) && starting_code.endsWith(`"`))) {
          start_i = 1;
          end_i = starting_code.length - 1;
        }

        range.setStart(plot_widget_el.firstChild!, start_i);
        range.setEnd(plot_widget_el.firstChild!, end_i);

        selection.addRange(range);
      }
    });

    plot_widget_el.addEventListener("input", () => {
      enable_arg_view(target_arg.view);
      widget.set_code(plot_widget_el.innerText);
    });

    // Clicking anywhere else, hides the widget
    document.addEventListener("mousedown", e => {
      if (
        !plot_widget_el.classList.contains("hidden") &&
        e.target != plot_widget_el
      ) {
        plot_widget_el.classList.add("hidden");
        icon.classList.remove("hidden");
        plot_widget_el.blur();
        reposition_plot_widgets(state); // The widget was not repositioned during the edits.
      }
    });

    state.plot_widgets.push({
      el,
      icon_el: icon,
      input_el: plot_widget_el,
      show_on_loc_via_func_code_and_num,
    });
  }
}

export function reposition_plot_widgets(state: State) {

  // console.log("repositioning", state.plot_widgets)
  for (const { el, input_el, show_on_loc_via_func_code_and_num } of state.plot_widgets) {

    // Don't reposition the element while editting
    if (!input_el.classList.contains("hidden")) {
      continue;
    }

    const hover_region: Element | undefined =
      hover_regions_for_call(show_on_loc_via_func_code_and_num, state).at(-1); // Only show on last hover region if multiple matches

    if (hover_region) {
      const {top, right, width} = relativeBoundingRect(hover_region, state.plot_area)
      el.style.top = `${top}px`;
      el.style.left = `${right}px`;
      input_el.style.left = `-${width}px`;
    } else {
      console.log("can't position", show_on_loc_via_func_code_and_num, el)
    }
  }

}