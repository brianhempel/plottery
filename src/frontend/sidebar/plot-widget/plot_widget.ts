import { select_call_view } from "../../layer_panel/layer_panel";
import {
  Arg,
  ArgView,
  State,
} from "../../types";
import { debounce, log_event } from "../../utils/instrumentation";
import { select_code_text } from "../../utils/misc";
import {
  create_edit_icon,
  create_el,
  relativeBoundingRect,
} from "../../utils/misc";
import { enable_arg_view } from "../arg/arg";
import { hover_regions_for_call } from "../hover-regions/hover_regions";
import "./plot_widget.css";

export type PlotWidgetConfig = {
  method_name: string;
  arg_name: string;
};

export type PlotWidget = {
  el: HTMLElement;
  icon_el: HTMLElement;
  input_el: HTMLElement;
  show_on_call_id: string; // can't use artist id's because they change on live sync
}


/**
 * Widgets that are located on the plot. Right now, the only one supported is
 * to edit text. E.g. editing the 'title' by clicking it on the plot.
 * @param state
 */
export function make_plot_widgets(state: State) {
  const plot_widgets_configs: PlotWidgetConfig[] = [
    {
      method_name: "set_title",
      arg_name: "label",
    },
    {
      method_name: "set_xlabel",
      arg_name: "xlabel",
    },
    {
      method_name: "set_ylabel",
      arg_name: "ylabel",
    },
    {
      method_name: "text",
      arg_name: "s",
    },
    {
      method_name: "suptitle",
      arg_name: "t",
    },
    // {
    //   method_name: "set_ylim",
    //   arg_name: "bottom",
    // },
  ];

  for (const plot_widget_config of plot_widgets_configs) {

    const target_calls = state.layers_panel.layers.flatMap(layer => {
      return layer.calls_with_args.filterMap((call_with_args, i) => {
        if (call_with_args.call_info.func_code.split('.').at(-1) == plot_widget_config.method_name) {
          return {
            info: call_with_args.call_info,
            view: layer.call_views[i],
          }
        }
      });
    });

    for(const target_call of target_calls) {
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

      const show_on_call_id = target_call.info.call_id;

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
        select_code_text(plot_widget_el);
        select_call_view(target_call.view, state);
        // auto-triggered after method add, so don't log it as a user action, which would be misleading here
        // log_event("gui", "on-plot text widget click open", {call: target_call.info.func_code, arg: target_arg.arg.name, arg_code: plot_widget_el.innerText});
      });

      plot_widget_el.addEventListener("input", () => {
        enable_arg_view(target_arg.view);
        widget.set_code(plot_widget_el.innerText);
        debounce("on-plot text widget input", 1000, () => {
          log_event("gui", "on-plot text widget input", {call: target_call.info.func_code, arg: target_arg.arg.name, arg_code: plot_widget_el.innerText, code: state.cell.code_mirror.getValue()});
        });
      });

      // Clicking anywhere else, hides the widget.
      const on_document_mousedown = (e: MouseEvent) => {
        if (!plot_widget_el.isConnected) { document.removeEventListener("mousedown", on_document_mousedown); return; } // Remove self once stale after rerender
        if (
          !plot_widget_el.classList.contains("hidden") &&
          e.target != plot_widget_el
        ) {
          plot_widget_el.classList.add("hidden");
          icon.classList.remove("hidden");
          plot_widget_el.blur();
          reposition_plot_widgets(state); // The widget was not repositioned during the edits.
        }
      };
      document.addEventListener("mousedown", on_document_mousedown);

      state.plot_widgets.push({
        el,
        icon_el: icon,
        input_el: plot_widget_el,
        show_on_call_id,
      });
    }
  }
}

export function reposition_plot_widgets(state: State) {

  // console.log("repositioning", state.plot_widgets)
  for (const { el, input_el, show_on_call_id } of state.plot_widgets) {

    // Don't reposition the element while editting
    if (!input_el.classList.contains("hidden")) {
      continue;
    }

    const hover_region: Element | undefined =
      hover_regions_for_call(show_on_call_id, state).at(-1); // Only show on last hover region if multiple matches

    if (hover_region) {
      const {top, right, width} = relativeBoundingRect(hover_region, state.plot_area)
      el.style.top = `${top}px`;
      el.style.left = `${right}px`;
      input_el.style.left = `-${width}px`;
    } else {
      console.log("can't position", show_on_call_id, el)
    }
  }

}