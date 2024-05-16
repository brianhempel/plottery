import {
  Arg,
  ArgView,
  DynamicCallInfo,
  CallView,
  HoverRegion,
  State,
} from "../../types";
import {
  create_edit_icon,
  create_el,
  find_call_that_satisfies,
} from "../../utils/misc";
import { DropdownWidget } from "../widgets/dropdown/dropdown";
import { Widget, WidgetKind } from "../widgets/widget";
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
    // {
    //   call_code: "ax.set_title",
    //   arg_name: "y",
    //   flip: true,
    //   type: "builtins.float",
    // },
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

    if (target_call == null) {
      console.warn(
        "[Make plot widgets] Target call is null for",
        plot_widget_config
      );
      continue;
    }

    // Find the arg in call
    let target_arg: {
      arg: Arg;
      view: ArgView;
    } | null = null;

    for (const { arg, view } of target_call.view.arguments) {
      if (arg.name == plot_widget_config.arg_name) {
        target_arg = { arg, view };
        break;
      }
    }

    if (target_arg == null) {
      console.warn(
        "[Make plot widgets] Target arg is null for",
        plot_widget_config
      );
      continue;
    }

    // Find the hover element
    const hover_region =
      state.hover_regions!.regions[target_call.info.show_on.at(-1)!];

    // Find the widget
    let widget = target_arg.view.widget;
    if (widget.kind == WidgetKind.Dropdown) {
      widget = (widget as DropdownWidget).selected_item;
    }

    if (hover_region.el.querySelector(".plot-widget-container") == null) {
      create_el("div", "plot-widget-container", hover_region.el);
    }

    make_plot_widget(
      plot_widget_config,
      target_call,
      target_arg,
      widget,
      hover_region,
      state
    );
  }
}

export function make_plot_widget(
  config: PlotWidget,
  call: {
    info: DynamicCallInfo;
    view: CallView;
  },
  arg: {
    arg: Arg;
    view: ArgView;
  },
  widget: Widget,
  hover_region: HoverRegion,
  state: State
) {
  if (widget.kind == WidgetKind.Literal && config.type == "builtins.str") {
    const container = hover_region.el.querySelector(".plot-widget-container")!;

    const el = create_el("div", "plot-widget", container);
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
