import { Arg, ArgView } from "../../types";
import { create_el } from "../../utils/misc";
import { Widget, make_widget_for_code_and_type } from "../widgets/widget";
import "./arg.css";

// Arg handling needs to support int versus float sliders, colors, booleans, and e.g. fontdicts.

export function create_arg_view(
  arg: Arg,
  options: { disabled: boolean }
): ArgView {
  const arg_el = create_el("div", "snp-arg-view");
  arg_el.title = JSON.stringify(arg.type);

  // Prefix with the argument name
  const prefixEl = create_el("div", "snp-arg-name", arg_el);
  prefixEl.innerText = arg.name;

  if (options.disabled && arg.required) {
    console.warn("Arg is required but disabled!", arg, options);
  }

  if (options.disabled) {
    arg_el.classList.add("snp-arg-disabled");
  }

  // Get the widgets based on the type
  var widget: Widget = make_widget_for_code_and_type(arg.code, arg.type, arg.default_code, arg.type_compatible_code_snippets);

  arg_el.append(widget.el);

  const view: ArgView = {
    el: arg_el,
    widget,
    positional: arg.is_positional,
    disabled: options.disabled,
  }

  // On clicking on a hidden arg view, unhide it
  arg_el.addEventListener("mousedown", ev => {
    if (view.disabled) {
      enable_arg_view(view);
      // ev.stopPropagation();
      // ev.preventDefault();
    }
  });

  // On clicking the arg name, hide it
  prefixEl.addEventListener("mousedown", ev => {
    if (!view.disabled && !arg.required) {
      disable_arg_view(view);
      ev.stopPropagation();
      ev.preventDefault();
    }
  });

  const arg_name_width = 120;
  prefixEl.style.minWidth = `${arg_name_width}px`;

  // If the item name is too long (112px), make it smaller.
  // But we can't do this until the actual width is known.
  const resizeObserver = new ResizeObserver((entries) => {
    // console.log("resizeObserver", entries);
    for (const entry of entries) {
      if (entry.borderBoxSize) {
        const width = (entry.borderBoxSize[0] || entry.borderBoxSize).inlineSize;
        if (width > 0) {
          if (width > arg_name_width) {
            prefixEl.style.width = `${arg_name_width}px`;
            const xscale = arg_name_width / width;
            const dx     = (width - arg_name_width) / 2;
            prefixEl.style.transform = `scale(${xscale}, 1) translate(-${dx}px, 0)`;
          }
          resizeObserver.disconnect();
          break;
        }
      }
    }
  });
  resizeObserver.observe(prefixEl);

  return view;
}

export function enable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.remove("snp-arg-disabled");
  arg_view.disabled = false;
}

export function disable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.add("snp-arg-disabled");
  arg_view.disabled = true;
}

export function arg_view_to_code(arg: Arg, arg_view: ArgView): string {
  const value_code = arg_view.widget.to_code();
  return arg_view.positional ? value_code : `${arg.name}=${value_code}`;
}
