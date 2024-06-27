import {
  Arg,
  DynamicCallInfo,
  CallView,
  CallableType,
  IInstanceType,
  Position,
  State,
  Type,
  UnionType,
} from "../types";
import { get_arg_kind_from_int } from "./types";

// declare global {
//   interface EventTarget {
//     snpOrigAddEventListener: EventTarget['addEventListener'];
//     snpEventListeners: { eventName: string, f: EventListenerOrEventListenerObject | null, opts: boolean | AddEventListenerOptions | undefined }[];
//     // removeEventListeners: () => void;
//   }
// }

// if(!EventTarget.prototype.snpOrigAddEventListener) {
//   // Keep track of event listeners so we can remove them
//   // Based on Ivan Castellanos & alex, https://stackoverflow.com/a/6434924
//   EventTarget.prototype.snpOrigAddEventListener = EventTarget.prototype.addEventListener;
//   EventTarget.prototype.addEventListener = function (eventName, f, opts) {
//     this.snpOrigAddEventListener(eventName, f, opts);
//     this.snpEventListeners = this.snpEventListeners || [];
//     this.snpEventListeners.push({ eventName: eventName, f: f , opts: opts });
//   };
//   // EventTarget.prototype.removeEventListeners = function() {
//   //   for (const { eventName, f, opts } of (this.snpEventListeners || [])) {
//   //     this.removeEventListener(eventName, f, opts)
//   //   }
//   //   this.snpEventListeners = [];
//   // };
// }

// export function copy_event_listeners(from: EventTarget, to: EventTarget) {
//   for (const { eventName, f, opts } of (from.snpEventListeners || [])) {
//     to.addEventListener(eventName, f, opts);
//   }
// }


export function arg_defaults_from_callee_type(
  callee: CallableType & {
    pos: Position;
  }
): Arg[] {
  return callee.arg_names
    .map((arg_name: string, arg_i: number) => {
      const arg_kind = get_arg_kind_from_int(callee.arg_kinds[arg_i]);
      const arg_type = callee.arg_types[arg_i];

      // Since the function parameter could be a union type, we need to indicate which of the types the actual code is.
      let arg_default_code: string;
      let arg_default_type: Type | null;
      if (callee.default_code_by_arg_idx == null) {
        console.warn("No defaults found for", callee);
      }

      if (callee.default_code_by_arg_idx?.at(arg_i)) {
        arg_default_code = callee.default_code_by_arg_idx[
          arg_i
        ] as string;
        arg_default_type = null; // We don't know.
      } else {
        [arg_default_code, arg_default_type] =
          default_code_and_code_type_for_type(arg_type, arg_name);
      }

      return {
        is_positional: false,
        name: arg_name,
        kind: arg_kind,
        code: arg_default_code,
        type: arg_type,
        code_type: arg_default_type,
        type_compatible_code_snippets:
          callee.type_compatible_code_snippets_by_arg_i[arg_i],
      };
    })
    .slice(callee.def_extras.first_arg !== undefined ? 1 : 0); // ignore first arg (self) if def_extras.first_arg is defined
}

export function default_code_and_code_type_for_type(
  type: Type | string,
  name?: string
): [string, Type] {
  // @TODO: Why is this hardcoded?
  // const default_value_from_name = [
  //   ["width", "builtins.float", "1.0"],
  //   ["height", "builtins.float", "1.0"],
  // ];

  // const [_, __, default_code] = default_value_from_name.find(
  //   ([default_name, default_type, default_code]) =>
  //     name == default_name && type == default_type
  // ) || [undefined, undefined, undefined];

  // if (default_code !== undefined) {
  //   return [default_code, type];
  // }

  if (typeof type == "string") {
    console.error("default_code_and_code_type_for_type: type is a string", type);
    return ["None", { ".class": "NoneType" }];
  }

  if ((type as IInstanceType)?.type_ref == "builtins.str") {
    return ['"Bananas..."', type];
  } else if ((type as IInstanceType)?.type_ref == "builtins.float") {
    return ["0.5", type];
  } else if (
    type[".class"] == "Instance" &&
    type["type_ref"] == "builtins.dict"
  ) {
    return ["{}", type];
  } else if (type[".class"] == "UnionType") {
    return default_code_and_code_type_for_type(
      (type as UnionType).items[0],
      name
    );
  } else if (
    type[".class"] == "LiteralType" // &&
    // (type["fallback"] as IInstanceType)?.type_ref == "builtins.str"
  ) {
    // const ltype = type as LiteralType;
    return [JSON.stringify(type.value), type.fallback];
  } else if (
    "type_ref" in type &&
    type["type_ref"] == "matplotlib._typing.ArrayLike"
  ) {
    return ["[1,2,3]", type];
  }

  return ["None", { ".class": "NoneType" }];
}

export function create_el(
  tag: string,
  classes: string[] | string = [],
  parent?: Element
) {
  const el = document.createElement(tag);

  if (Array.isArray(classes)) {
    el.classList.add(...classes);
  } else {
    el.classList.add(classes);
  }

  if (parent != undefined) {
    parent.appendChild(el);
  }

  return el;
}

export function relativeTopLeft(el: Element, container: Element) : [number, number] {
  const { top, left } = relativeBoundingRect(el, container);
  return [top, left];
}

export function relativeBoundingRect(el: Element, container: Element) : DOMRect {
  const elRect = el.getBoundingClientRect();
  const refRect = container.getBoundingClientRect();

  return DOMRect.fromRect({
    x: elRect.x - refRect.x,
    y: elRect.y - refRect.y,
    width: elRect.width,
    height: elRect.height,
  });
}

// Absolutely positions el over the center of shape, where container is the appropriate relative ancestor.
export function place_centered_over_shape(shape: Element, el: HTMLElement, container: Element) {
  // const [plot_width, plot_height] = [
  //   snp_state.img.getBoundingClientRect().width,
  //   snp_state.img.getBoundingClientRect().height,
  // ];
  const shapeRect = relativeBoundingRect(shape, container);
  const elRect = el.getBoundingClientRect();
  let top = shapeRect.top + shapeRect.height / 2 - elRect.height / 2;
  let left = shapeRect.left + shapeRect.width / 2 - elRect.width / 2;
  // top = Math.max(0, Math.min(top, plot_height - elRect.height));
  // left = Math.max(0, Math.min(left, plot_width - elRect.width));
  el.style.position = "absolute";
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

export function reposition_to_avoid_overlap(el: HTMLElement, avoid_els: Element[], container: Element) {
  const el_rect = relativeBoundingRect(el, container);
  const avoid_el = avoid_els.find(avoid_el => {
    const avoid_rect = relativeBoundingRect(avoid_el, container);
    return (
      el_rect.left < avoid_rect.right &&
      avoid_rect.left < el_rect.right &&
      el_rect.top < avoid_rect.bottom &&
      avoid_rect.top < el_rect.bottom
    );
  });
  if (avoid_el) {
    el.style.top = relativeBoundingRect(avoid_el, container).bottom + 3 + "px";
    reposition_to_avoid_overlap(el, avoid_els, container);
  }
}

export function item_to_start_pos(
  item: { pos: Position },
  cell_lineno: number
) {
  return { line: item.pos.line - cell_lineno, ch: item.pos.column };
}

export function item_to_end_pos(item: { pos: Position }, cell_lineno: number) {
  return { line: item.pos.end_line - cell_lineno, ch: item.pos.end_column };
}

export function create_dropdown_arrow() {
  const svgContainer = create_el("div");

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.innerHTML = `<polygon points="5.9,88.2 50,11.8 94.1,88.2"></polygon>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 100 100");

  return svgContainer;
}

export function create_chevron() {
  const svgContainer = create_el("div");

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.innerHTML = `<path d="M12 19a.749.749 0 0 1-.53-.22l-3.25-3.25a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215L12 17.19l2.72-2.72a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734l-3.25 3.25A.749.749 0 0 1 12 19Z"></path><path d="M12 18a.75.75 0 0 1-.75-.75v-7.5a.75.75 0 0 1 1.5 0v7.5A.75.75 0 0 1 12 18ZM2.75 6a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2.75 6Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 6.75 6Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Zm4 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Z"></path>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 24 24");
  svgEl.setAttribute("width", "24px");
  svgEl.setAttribute("height", "24px");

  return svgContainer;
}

export function create_dropdown_nook() {
  const svgContainer = create_el("div");

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  svgEl.innerHTML = `<g clip-path="url(#clip0_29_4)">
<path d="M0.426963 3.57302L3.82296 0.177023C3.84619 0.153742 3.87377 0.135271 3.90415 0.122667C3.93452 0.110064 3.96708 0.103577 3.99996 0.103577C4.03285 0.103577 4.06541 0.110064 4.09578 0.122667C4.12615 0.135271 4.15374 0.153742 4.17696 0.177023L7.57296 3.57302C7.60802 3.60799 7.6319 3.65257 7.64158 3.70113C7.65127 3.74968 7.64631 3.80002 7.62736 3.84576C7.6084 3.89149 7.57628 3.93057 7.53509 3.95803C7.4939 3.9855 7.44547 4.00011 7.39596 4.00002H0.603963C0.554453 4.00011 0.506031 3.9855 0.464836 3.95803C0.423642 3.93057 0.39153 3.89149 0.372571 3.84576C0.353612 3.80002 0.348661 3.74968 0.358344 3.70113C0.368027 3.65257 0.39191 3.60799 0.426963 3.57302Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_29_4">
<rect width="8" height="3" fill="white"/>
</clipPath>
</defs>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 8 3");
  svgEl.setAttribute("width", "8px");
  svgEl.setAttribute("height", "3px");
  return svgContainer;
}

export function create_edit_icon() {
  const svgContainer = create_el("div");

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  svgEl.innerHTML = `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>`;
  svgContainer.append(svgEl);
  svgEl.setAttribute("viewBox", "0 0 24 24");
  svgEl.setAttribute("width", "24px");
  svgEl.setAttribute("height", "24px");
  return svgContainer;
}

// https://stackoverflow.com/a/58550111
export function is_numeric(num: unknown) {
  return (
    (typeof num === "number" ||
      (typeof num === "string" && num.trim() !== "")) &&
    !isNaN(num as number)
  );
}

export function is_array_like(val: string) {
  if (val.trim().at(0) == "[" && val.trim().at(-1) == "]") {
    return true;
  }

  return false;
}

// @TODO: Make more robust (e.g. check f strings)
export function is_string_like(val: string) {
  const v = val.trim();
  if (v.startsWith(`"`) && v.endsWith(`"`)) {
    return true;
  } else if (v.startsWith(`'`) && v.endsWith(`'`)) {
    return true;
  } else if (v.startsWith("`") && v.endsWith("`")) {
    return true;
  }

  return false;
}

export function syntax_highlight(code: string, container: HTMLElement) {
  const CodeMirror = window["CodeMirror"];
  CodeMirror.runMode(
    code,
    {
      name: "python",
      version: 3,
      singleLineStringErrors: false,
    } as any,
    container
  );
}

export function insert_to_beginning_of_el(
  parent: HTMLElement,
  el_to_insert: HTMLElement
) {
  parent.insertBefore(el_to_insert, parent.firstChild);
}

export function find_call_that_satisfies(
  pred: (info: DynamicCallInfo, view: CallView) => boolean,
  state: State
) : { info: DynamicCallInfo, view: CallView } | undefined {
  console.log("find_call_that_satisfies state", state);

  // Go through all the call views from artists
  for (const layer of state.layers_panel.layers) {
    for (let i = 0; i < layer.calls_with_args.length; i++) {
      const calls_with_args = layer.calls_with_args[i];
      const call_view = layer.call_views[i];

      if (pred(calls_with_args.call_info, call_view)) {
        return { info: calls_with_args.call_info, view: call_view };
      }
    }
  }

  return undefined;
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function hex_to_rgb(hex: string): { r: number; g: number; b: number } {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Sort by number of dots, then by total length.
export function compare_qualified_names(name1: string, name2: string) {
  return (
    name1.length +
    100 * name1.split(".").length -
    (name2.length + +100 * name2.split(".").length)
  );
}

export function get_shortest_qualified_name(names: string[]) {
  return names.sort(compare_qualified_names)[0];
}
