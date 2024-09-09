import { create_el, is_numeric, maybe_round_number, number_to_string_not_ugly, sig_figs } from "../../../utils/misc";
import { Widget } from "../widget";

export type FloatWidget = Widget & {
  kind: "FloatWidget";
  slider: HTMLInputElement;

  // stuff to handle adaptive range:
  base: number;
  base_position: number;
};

export function create_float_widget(code: string): FloatWidget {
  const el = create_el("div", "snp-widget");

  // let slider: Slider = make_slider(parseFloat(code));

  let slider = create_el("input", "snp-slider") as HTMLInputElement;
  slider.type = "range";
  slider.min = "-1";
  slider.value = "0";
  slider.max = "1";
  slider.step = "any";

  el.append(slider);
  el.classList.add("snp-arg-number");

  const widget: FloatWidget = {
    kind: "FloatWidget",
    el,
    kind_label_for_dropdown: "float",
    does_match_arg_code: (arg_code: string) => is_numeric(arg_code),
    to_code:             ()                 => number_to_string_not_ugly(position_to_float(widget.slider, widget.base)),
    set_code:            (new_code: string) => widget.base = eval(new_code),
    clone:               ()                 => create_float_widget(widget.to_code()),
    base:                parseFloat(code),
    base_position:       0,
    slider,
  };

  // Prevent layer drag by @mech https://stackoverflow.com/a/34588661
  slider.addEventListener('mouseenter', () => slider.closest(".snp-layer")?.setAttribute("draggable", "false") );
  slider.addEventListener('mouseleave', () => slider.closest(".snp-layer")?.setAttribute("draggable", "true")  );

  // Prevent click from opening dropdown
  slider.addEventListener("click", ev => { ev.stopPropagation(); });


  // Lock the size of the neighbor code box to prevent it from moving the slider while dragging
  // Also, don't show the selected layer while dragging
  slider.addEventListener("mousedown", ev => {
    const sibling = el.previousElementSibling
    if (sibling) {
      (sibling as HTMLElement).style.width = sibling.getBoundingClientRect().width + "px";
    }
    slider.closest(".snp_outer")?.querySelector(".hover_regions")?.classList.add("hide_during_interaction");
  });

  slider.addEventListener("mouseup", ev => {
    // Unlock the size of the neighbor code box
    const sibling = el.previousElementSibling
    if (sibling) {
      (sibling as HTMLElement).style.width = '';
    }
    // Show selected layer again
    slider.closest(".snp_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");

    // Reset the slider to the middle and adjust its range
    widget.base = position_to_float(widget.slider, widget.base);
    widget.slider.value = "0";
  });

  // console.log(widget);

  return widget
}

function position_to_float(slider: HTMLInputElement, base: number): number {
  const position  = parseFloat(slider.value);
  const dir       = Math.sign(position);

  // Default to 10^-0.48 if base is 0 (i.e. slider range -10 to 10)
  // if base is non-zero, use the same order of magnitude.
  const delta = position_to_delta(base, position);

  // Calculate the delta per pixel for maybe_round_number
  const position_per_px = (parseFloat(slider.max) - parseFloat(slider.min)) / slider.getBoundingClientRect().width; // 2/width.  not perfect but close
  const delta_per_px_left  = delta - position_to_delta(base, position - position_per_px);
  const delta_per_px_right = delta - position_to_delta(base, position + position_per_px);
  const delta_per_px = Math.max(Math.abs(delta_per_px_left), Math.abs(delta_per_px_right));

  return sig_figs(maybe_round_number(base + dir*delta, delta_per_px), 2);
  // return sig_figs(base + dir*delta, 2);
}

function position_to_delta(base: number, position: number) {
  const base_pow_10 = base == 0 ? -0.48 : Math.log10(Math.abs(base));
  const offset = Math.pow(10, base_pow_10);

  // Range is ±1.5 powers of 10 from the starting number.
  const delta = Math.pow(10, Math.abs(position) * 1.5 + base_pow_10) - offset;
  return delta;
}
