import { create_el, is_numeric, number_to_string_not_ugly, sig_figs } from "../../../utils/misc";
import { Widget } from "../widget";

export type IntWidget = Widget & {
  kind: "IntWidget";
  slider: HTMLInputElement;
};

export function create_int_widget(code: string): IntWidget {
  const el = create_el("div", "snp-widget");

  let slider = create_el("input", "snp-slider") as HTMLInputElement;
  slider.type = "range";
  slider.value = parseInt(code).toString();

  el.append(slider);
  el.classList.add("snp-arg-number");

  const widget: IntWidget = {
    kind: "IntWidget",
    el,
    kind_label_for_dropdown: "int",
    does_match_arg_code: (arg_code: string) => is_numeric(arg_code) && parseInt(arg_code) == parseFloat(arg_code),
    to_code:             ()                 => number_to_string_not_ugly(sig_figs(parseInt(slider.value), 2)),
    set_code:            (new_code: string) => { slider.value = eval(new_code).toString(); adjust_slider_range(slider) },
    clone:               ()                 => create_int_widget(widget.to_code()),
    slider,
  };

  adjust_slider_range(slider);

  // Prevent layer drag by @mech https://stackoverflow.com/a/34588661
  slider.addEventListener('mouseenter', () => slider.closest(".snp-layer")?.setAttribute("draggable", "false") );
  slider.addEventListener('mouseleave', () => slider.closest(".snp-layer")?.setAttribute("draggable", "true")  );

  // Prevent click from opening dropdown
  slider.addEventListener("click", ev => { ev.stopPropagation(); });

  // Lock the size of the neighbor code box to prevent it from moving the slider while dragging
  slider.addEventListener("mousedown", ev => {
    const sibling = el.previousElementSibling
    if (sibling) {
      (sibling as HTMLElement).style.width = sibling.getBoundingClientRect().width + "px";
    }
  });

  slider.addEventListener("mouseup", ev => {
    // Unlock the size of the neighbor code box
    const sibling = el.previousElementSibling
    if (sibling) {
      (sibling as HTMLElement).style.width = '';
    }

    adjust_slider_range(widget.slider);
  });

  // console.log(widget);

  return widget
}

// -15 to 15, raised to whatever power of 10 we are starting from
function adjust_slider_range(slider: HTMLInputElement) {
  const n = parseInt(slider.value);
  const pow_10 = Math.max(0, Math.log10(Math.abs(n)));

  slider.min = '-15' + '0'.repeat(Math.floor(pow_10))
  slider.step = '1';
  slider.max = '15'  + '0'.repeat(Math.floor(pow_10))
}
