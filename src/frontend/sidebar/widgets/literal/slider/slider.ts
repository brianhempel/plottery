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

  // Setup spring
  // const spring_svg = document.createElementNS(
  //   "http://www.w3.org/2000/svg",
  //   "svg"
  // );
  // spring_svg.classList.add("snp-spring-svg");

  // const spring_svg_p1 = document.createElementNS(
  //   "http://www.w3.org/2000/svg",
  //   "path"
  // );
  // spring_svg_p1.classList.add("snp-spring-svg-p1");

  // const spring_svg_p2 = document.createElementNS(
  //   "http://www.w3.org/2000/svg",
  //   "path"
  // );
  // spring_svg_p2.classList.add("snp-spring-svg-p2");

  // spring_svg.append(spring_svg_p1, spring_svg_p2);
  // spring.append(spring_svg);

  let mult = 0.02;

  let pressed = false;
  let ix = 0;
  let iv = 0;
  base.addEventListener("mousedown", e => {
    pressed = true;
    ix = e.x;
    iv = parseFloat(val_el.innerText);

    // update_spring(spring_svg_p1, spring_svg_p2, 0);

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
    // spring,
  };
}

function update_spring(p1: SVGPathElement, p2: SVGPathElement, dx: number) {
  p1.setAttribute("d", `M 0,4 L${dx},4`);

  let m = 1 - Math.exp(-(0.01 * dx ** 2));

  if (dx < 0) {
    p2.setAttribute(
      "d",
      `M ${dx + m * 5},0 L${dx + m * 1},4 L${dx + m * 5},8 M ${dx},-1 L${dx},9`
    );
  } else {
    p2.setAttribute(
      "d",
      `M ${dx - m * 5},0 L${dx - m * 1},4 L${dx - m * 5},8 M ${dx},-1 L${dx},9`
    );
  }
}

export function update_slider_val(widget: LiteralWidget, new_value: number) {
  if (widget.slider == null) {
    console.warn("No slider found!");
    return;
  }

  widget.slider.val = new_value;
  widget.slider.val_el.innerText = new_value.toString();
}
