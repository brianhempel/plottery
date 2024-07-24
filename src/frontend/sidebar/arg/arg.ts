import { Arg, ArgView, CallWithArgs, Type, UnionType } from "../../types";
import { create_el } from "../../utils/misc";
import { Widget, make_widget_for_code_and_type, widget_to_code } from "../widgets/widget";
import "./arg.css";

export function create_arg_view(
  arg: Arg,
  options: { disabled: boolean }
): ArgView {
  const arg_el = create_el("div", "snp-arg-view");

  // Prefix with the argument name
  const prefixEl = create_el("div", "snp-arg-name", arg_el);
  // prefixEl.innerHTML = `${arg.name}<span class="snp-arg-colon">:</span>`;
  prefixEl.innerHTML = `${arg.name}`;

  if (options.disabled && arg.required) {
    console.warn("Arg is required but disabled!", arg, options);
  }

  if (options.disabled) {
    arg_el.classList.add("snp-arg-disabled");
  }

  // Get the widgets based on the type
  var widget: Widget = make_widget_for_code_and_type(arg.code, arg.type, arg.type_compatible_code_snippets);

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
      ev.stopPropagation();
      ev.preventDefault();
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
  const value_code = widget_to_code(arg_view.widget);
  return arg_view.positional ? value_code : `${arg.name}=${value_code}`;
}
