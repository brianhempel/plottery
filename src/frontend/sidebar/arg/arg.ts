import { Arg, ArgView, State } from "../../types";
import { create_el } from "../../utils/misc";
import { Widget, make_widget_for_code_and_type } from "../widgets/widget";
import "./arg.css";

// Arg handling needs to support int versus float sliders, colors, booleans, and e.g. fontdicts.

export function create_arg_view(
  arg: Arg,
  call_docstring: string | null,
  options: { disabled: boolean }
): ArgView {
  const arg_el = create_el("div", "snp-arg-view");

  // arg_el.title = JSON.stringify(arg.type);

  // Look for '...arg_name...:' and anything following at a higher indent level
  const regex = new RegExp(`^([ \\t]*)[\\w ,]*\\b${arg.name}\\b.*:.*(\\n+\\1[ \\t].*)*`, 'm');
  const arg_docstring = (call_docstring || '').match(regex)?.at(0);

  arg_el.title = arg_docstring || `No documentation available for ${arg.name}`;

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

  const arg_name_width = 105;
  set_max_width(prefixEl, arg_name_width);

  return view;
}

// If the item name is too long (120px), make it smaller.
// But we can't do this until the actual width is known.
function set_max_width(el: HTMLElement, width_px: number) {
  el.style.minWidth = `${width_px}px`;

  const resizeObserver = new ResizeObserver((entries) => {
    // console.log("resizeObserver", entries);
    for (const entry of entries) {
      if (entry.borderBoxSize) {
        const width = (entry.borderBoxSize[0] || entry.borderBoxSize).inlineSize;
        if (width > 0) {
          if (width > width_px) {
            el.style.width = `${width_px}px`;
            const xscale = width_px / width;
            const dx     = (width - width_px) / 2;
            el.style.transform = `scale(${xscale}, 1) translate(-${dx}px, 0)`;
          }
          resizeObserver.disconnect();
          break;
        }
      }
    }
  });
  resizeObserver.observe(el);
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

// Show the value the value of the control, but in the layer panel
// export function make_proxy_arg_el(arg : Arg, view : ArgView, state: State) : HTMLElement {
//   const proxy_arg_el = create_el("div", ["snp-arg-view", "snp-proxy"]);

//   const name_el = create_el("div", ["snp-arg-name", "snp-proxy"], proxy_arg_el);
//   const code_el = create_el("div", ["snp-arg-value", "snp-proxy"], proxy_arg_el);

//   name_el.innerText = arg.name;

//   const arg_name_width = 120;
//   set_max_width(name_el, arg_name_width);

//   let last_code = '';
//   let last_disabled = false;
//   function sync() {
//     if (view.widget.to_code() !== last_code) {
//       last_code = view.widget.to_code();
//       code_el.innerText = last_code;
//     }
//     if (view.disabled !== last_disabled) {
//       last_disabled = view.disabled;
//       proxy_arg_el.classList.toggle("snp-arg-disabled", last_disabled);
//     }
//     state.is_in_dom() && requestAnimationFrame(sync);
//   }
//   sync();

//   return proxy_arg_el;
// }

