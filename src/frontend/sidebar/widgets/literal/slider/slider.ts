import { create_el } from "../../../../utils/misc";
import { LiteralWidget } from "../literal";
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

  let mult = 0.02;

  let pressed = false;
  let ix = 0;
  let iv = 0;
  base.addEventListener("mousedown", e => {
    pressed = true;
    ix = e.x;
    iv = parseFloat(val_el.innerText);
    el.classList.add("pressed");
    document.body.style.cursor = "e-resize";
  });

  document.addEventListener("mousemove", e => {
    if (pressed) {
      const dx = mult * (e.x - ix);

      const new_value = iv + dx;
      val_el.innerText = new_value.toFixed(2);

      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener("mouseup", e => {
    if (pressed) {
      pressed = false;
      el.classList.remove("pressed");

      document.body.style.cursor = "inherit";
    }
  });

  return {
    val,
    min,
    max,
    val_el,
    el,
    base,
  };
}

export function update_slider_val(widget: LiteralWidget, new_value: number) {
  if (widget.slider == null) {
    console.warn("No slider found!");
    return;
  }

  widget.slider.val = new_value;
  widget.slider.val_el.innerText = new_value.toString();
}
