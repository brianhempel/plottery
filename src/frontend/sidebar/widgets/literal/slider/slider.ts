import { create_el, sig_figs } from "../../../../utils/misc";
import "./slider.css";

export type Slider = {
  val: number;
  min: number;
  max: number;

  el: HTMLElement;
  val_el: HTMLElement;
  base: HTMLElement;
  // spring: HTMLElement;
};

export function make_slider(
  val: number,
  min: number = -Infinity,
  max: number = Infinity
): Slider {
  const el = create_el("div", "snp-slider");
  const base = create_el("div", "snp-slider-base", el);
  const val_el = create_el("div", "snp-slider-val", el);
  val_el.innerText = val.toString();
  val_el.contentEditable = "true";
  val_el.addEventListener("keydown", ev => {
    if (ev.code === "Enter") {
      ev.stopPropagation();
      ev.preventDefault();
      val_el.closest('.snp-dropdown.expanded')?.classList.remove('expanded');
      val_el.blur();
    }
  });

  let val_per_px = 0.02;

  let pressed = false;
  let start_x = 0;
  let start_val = 0;
  base.addEventListener("mousedown", e => {
    pressed = true;
    start_x = e.x;
    start_val = parseFloat(val_el.innerText);
    el.classList.add("pressed");
    document.body.style.cursor = "e-resize";
  });

  document.addEventListener("mousemove", e => {
    if (pressed) {
      const dx = val_per_px * (e.x - start_x);

      const new_value = dx === 0 ? start_val : sig_figs(start_val + dx, 2);
      val_el.innerText = new_value.toString();

      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener("mouseup", _ => {
    if (pressed) {
      pressed = false;
      el.classList.remove("pressed");

      document.body.style.cursor = "inherit";
    }
  });

  return { val, min, max, val_el, el, base };
}

export function update_slider_val(slider: Slider, new_value: number) {
  slider.val = new_value;
  slider.val_el.innerText = new_value.toString();
}
