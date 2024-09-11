import {
  Arg,
  CallView,
  CallableType,
  IInstanceType,
  Position,
  State,
  Type,
  UnionType,
  TupleType,
  LiteralType,
  TypedDictType,
  CallInfo,
} from "../types";
import { unzip } from "./stdlib";
import { TextMarker, MarkerRange } from "./codemirror";
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

// https://stackoverflow.com/a/6234804
export function escape_html(str: string): string {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}


export function get_proper_type(type: Type): Type {
  return type[".class"] == "TypeAliasType" && type.resolved ? get_proper_type(type.resolved) : type;
}

// Can only handle TypedDictType
function arg_defaults_for_star2_arg(arg_type: Type): Arg[] {
  arg_type = get_proper_type(arg_type);
  if (arg_type[".class"] != "TypedDictType") return [];
  const typed_dict = arg_type as TypedDictType;

  const { items, default_codes_by_name } = typed_dict;

  return items.map(([name, type], item_i) => {
    return {
      name,
      required: false,
      kind: "ARG_NAMED",
      code: default_codes_by_name[name] || default_code_for_type(type, name),
      type: type,
      // code_type: kwargs_alias!.code_type,
      default_code: default_codes_by_name[name] || null, // TypedDicts don't support defaults
      type_compatible_code_snippets: typed_dict.type_compatible_code_snippets_by_i[item_i],
      is_positional: false,
    };
  })
}

// # Positional argument
// ARG_POS = 0
// # Positional, optional argument (functions only, not calls)
// ARG_OPT = 1
// # *arg argument
// ARG_STAR = 2
// # Keyword argument x=y in call, or keyword-only function arg
// ARG_NAMED = 3
// # **arg argument
// ARG_STAR2 = 4
// # In an argument list, keyword-only and also optional
// ARG_NAMED_OPT = 5
export function arg_defaults_from_callee_type(callee: CallableType): Arg[] {

  let arg_names = callee.arg_names_at_definition ? callee.arg_names_at_definition : callee.arg_names;
  if (!arg_names) {
    console.warn("arg_names not found for ", callee, " likely meaning the type def for it is malformed or missing");
    return [];
  }
  if (arg_names === callee.arg_names) {
    console.warn("arg_names_at_definition not found for ", callee, " likely meaning the type def for it is missing an import or is otherwise missing or malformed. Lack of definition access can can mess up positional-only arguments.");
  }
  if (!callee.default_code_by_arg_idx) {
    console.warn("default_code_by_arg_idx not found for ", callee, " likely meaning the type def for it is malformed");
  }
  return arg_names.flatMap((arg_name: string, arg_i: number) => {
      const arg_kind = get_arg_kind_from_int(callee.arg_kinds[arg_i]);
      const arg_type = callee.arg_types[arg_i];

      if (arg_kind == "ARG_STAR2") {
        const prior_arg_names = arg_names.slice(0, arg_i);
        // Keyword args before the **args will never never be globbed into the **args.
        return arg_defaults_for_star2_arg(arg_type).filter(arg => !prior_arg_names.includes(arg.name));
      }

      // Since the function parameter could be a union type, we need to indicate which of the types the actual code is.
      let arg_default_code: string;
      // let arg_default_type: Type | null;
      if (callee.default_code_by_arg_idx == null) {
        console.warn("No defaults found for", callee);
      }

      const default_at_definition = callee.default_code_by_arg_idx ? callee.default_code_by_arg_idx[arg_i] : null

      arg_default_code = default_at_definition != null ? default_at_definition : default_code_for_type(arg_type, arg_name);

      return [{
        is_positional: callee.arg_names[arg_i] == null || arg_kind == "ARG_POS",
        required: arg_kind == "ARG_POS" || arg_kind == "ARG_NAMED",
        name: arg_name,
        kind: arg_kind,
        code: arg_default_code,
        type: arg_type,
        // code_type: arg_default_type,
        default_code: default_at_definition,
        type_compatible_code_snippets:
          callee.type_compatible_code_snippets_by_arg_i[arg_i],
      }];
    })
    .slice(callee.def_extras.first_arg !== undefined && callee.def_extras.first_arg !== null ? 1 : 0); // ignore first arg (self) if def_extras.first_arg is defined
}

var instance_defaults = {
  'builtins.str':   "'My String'",
  'builtins.float': "0.5",
  'builtins.int':   "1",
  'builtins.bool':  "True",
  'builtins.dict':  "{}",
} as { [instance_name: string]: string };

export function default_code_for_type(
  type: Type | string,
  name?: string
): string {

  if (typeof type == "string") {
    console.error("default_code_for_type: type is a string", type);
    // return `no default code for ${JSON.stringify(type)}`;
    return '...';
  }

  // Try to find a literal first; if that fails, use a default for the first type.
  const first_literal = find_first_literal_type(type);
  if (first_literal) {
    return first_literal.value_unparsed;
  } else if (type[".class"] == "Instance" && name && type.type_ref == "builtins.str") { // Use arg name as default string
    return `'${name.capitalize()}'`;
  } else if (type[".class"] == "Instance" && type.type_ref in instance_defaults) {
    return instance_defaults[type.type_ref] as string;
  } else if (type[".class"] == "UnionType") {
    return default_code_for_type(type.items[0], name);
  } else if (
    "type_ref" in type &&
    type["type_ref"] == "matplotlib._typing.ArrayLike"
  ) {
    return "[1,2,3]";
  } else if (type[".class"] == "Instance" && (type.type_ref.endsWith(".Sequence") || type.type_ref.endsWith(".Iterable")) && type.args.length == 1) {
    const item_code = default_code_for_type(type.args[0]);
    return `[${item_code}, ${item_code}, ${item_code}]`;
  } else if (type[".class"] == "TupleType") {
    const item_codes = type.items.map(t => default_code_for_type(t));
    const perhaps_trailing_comma = type.items.length == 1 ? "," : "";
    return `(${item_codes.join(", ")}${perhaps_trailing_comma})`;
  } else if (type[".class"] == "TypeAliasType" && type.resolved) {
    return default_code_for_type(type.resolved);
  } else if (type[".class"] == "NoneType") {
    return "None";
  }

  // console.warn(`no default code for ${JSON.stringify(type)}`);
  return '...';
}

function find_first_literal_type(type: Type | string): LiteralType | null {
  if (typeof type == "string") {
    return null;
  } else if (type[".class"] == "LiteralType") {
    return type;
  } else if (type[".class"] == "UnionType") {
    for (const t of type.items) {
      const literal_type = find_first_literal_type(t);
      if (literal_type) {
        return literal_type;
      }
    }
  } else if (type[".class"] == "TypeAliasType") {
    return find_first_literal_type(type.resolved);
  }
  return null;
}

// export function default_code_and_code_type_for_type(
//   type: Type | string,
//   name?: string
// ): [string, Type] {
//   // @TODO: Why is this hardcoded?
//   // const default_value_from_name = [
//   //   ["width", "builtins.float", "1.0"],
//   //   ["height", "builtins.float", "1.0"],
//   // ];

//   // const [_, __, default_code] = default_value_from_name.find(
//   //   ([default_name, default_type, default_code]) =>
//   //     name == default_name && type == default_type
//   // ) || [undefined, undefined, undefined];

//   // if (default_code !== undefined) {
//   //   return [default_code, type];
//   // }

//   if (typeof type == "string") {
//     console.error("default_code_and_code_type_for_type: type is a string", type);
//     return ["None", { ".class": "NoneType" }];
//   }

//   if ((type as IInstanceType)?.type_ref == "builtins.str") {
//     return ['"Bananas..."', type];
//   } else if ((type as IInstanceType)?.type_ref == "builtins.float") {
//     return ["0.5", type];
//   } else if (
//     type[".class"] == "Instance" &&
//     type["type_ref"] == "builtins.dict"
//   ) {
//     return ["{}", type];
//   } else if (type[".class"] == "UnionType") {
//     return default_code_and_code_type_for_type(
//       (type as UnionType).items[0],
//       name
//     );
//   } else if (
//     type[".class"] == "LiteralType" // &&
//     // (type["fallback"] as IInstanceType)?.type_ref == "builtins.str"
//   ) {
//     // const ltype = type as LiteralType;
//     return [JSON.stringify(type.value), type.fallback];
//   } else if (
//     "type_ref" in type &&
//     type["type_ref"] == "matplotlib._typing.ArrayLike"
//   ) {
//     return ["[1,2,3]", type];
//   } else if (type[".class"] == "TupleType") {
//     const [item_codes, types] = unzip(type.items.map(t => default_code_and_code_type_for_type(t)));
//     const out_code = `[${item_codes.join(", ")}]`;
//     const out_type: TupleType = {
//       ".class": "TupleType",
//       implicit: type.implicit,
//       items: types,
//       partial_fallback: type.partial_fallback,
//     };
//     return [out_code, out_type];
//   }

//   return ["None", { ".class": "NoneType" }];
// }

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

// export function relativeTopLeft(el: Element, container: Element) : [number, number] {
//   const { top, left } = relativeBoundingRect(el, container);
//   return [top, left];
// }

// clips to container if el goes outside of it by more than slop
export function relativeBoundingRect(el: Element, container: Element) : DOMRect {
  const slop = 17;
  const elRect = el.getBoundingClientRect();
  const refRect = container.getBoundingClientRect();

  const x = elRect.x - refRect.x;
  const y = elRect.y - refRect.y;
  const right = x + elRect.width;
  const bot = y + elRect.height;
  const clippedX     = Math.max(-slop, Math.min(x, refRect.width + slop));
  const clippedY     = Math.max(-slop, Math.min(y, refRect.height + slop));
  const clippedRight = Math.max(-slop, Math.min(right, refRect.width + slop));
  const clippedBot   = Math.max(-slop, Math.min(bot, refRect.height + slop));

  return DOMRect.fromRect({
    x: clippedX,
    y: clippedY,
    width:  clippedRight - clippedX,
    height: clippedBot - clippedY,
  });
}

// Absolutely positions el over the center of shape, where container is the appropriate relative ancestor.
export function place_centered_over_shape(shape: Element, el: HTMLElement, container: Element) {
  const shapeRect = relativeBoundingRect(shape, container);
  const elRect = el.getBoundingClientRect();

  let top = shapeRect.top + shapeRect.height / 2 - elRect.height / 2;
  let left = shapeRect.left + shapeRect.width / 2 - elRect.width / 2;

  el.style.position = "absolute";
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

// Absolutely positions el over shape, where container is the appropriate relative ancestor.
export function place_over_shape(shape: Element, el: HTMLElement, container: Element) {
  // const containerRect = container.getBoundingClientRect();
  const shapeRect = relativeBoundingRect(shape, container);
  const elRect = el.getBoundingClientRect();

  const pad = 6;
  if (elRect.width + pad*2 < shapeRect.width && elRect.height + pad*2 < shapeRect.height) {
    // If bigger than shape, place in upper right corner
    el.style.position = "absolute";
    el.style.top = `${shapeRect.top + pad}px`;
    el.style.left = `${shapeRect.right - elRect.width - pad}px`;
  } else if (elRect.height + pad*2 < shapeRect.height) {
    // If only wider than shape, place in center top
    el.style.position = "absolute";
    el.style.top = `${shapeRect.top + pad}px`;
    let left = shapeRect.left + shapeRect.width / 2 - elRect.width / 2;
    el.style.left = `${left}px`;
  } else {
    place_centered_over_shape(shape, el, container);
  }
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

export function cm_start_pos(pos: Position, cell_lineno: number) {
  return { line: pos.line - cell_lineno, ch: pos.column };
}

export function cm_end_pos(pos: Position, cell_lineno: number) {
  return { line: pos.end_line - cell_lineno, ch: pos.end_column };
}

export function snp_logo_svg_html() {
  return `<svg height="22.0955" viewBox="0 0 119.803 22.0955" width="119.803" xmlns="http://www.w3.org/2000/svg"><path d="m24.5353 2.18898v14.36252h-3.8031v-14.36252z"/><path d="m19.3836.134156v16.397844h-3.8031v-16.397844z"/><path d="m14.232 5.47245v11.05955h-3.803v-11.05955z"/><path d="m9.08052 8.75592v7.77608h-3.80303v-7.77608z"/><path d="m3.80303 7.66143v8.87057h-3.80303v-8.87057z"/><path d="m32.4881 7.65507h1.4094c1.5612 0 2.3417-.67939 2.3417-2.03816s-.7805-2.03815-2.3417-2.03815h-1.4094zm0 8.84643h-4.2497v-16.348583h6.7649c1.8358 0 3.2416.477016 4.2173 1.431043.9757.95403 1.4635 2.29835 1.4635 4.03295s-.4878 3.07892-1.4635 4.03295c-.9757.95404-2.3815 1.43104-4.2173 1.43104h-2.5152z"/><path d="m46.4951.0829737v16.4185263h-3.9246v-16.4185263z"/><path d="m52.8914 10.8858c0 .3758.0687.7191.206 1.0299s.318.5818.5421.8131c.224.2313.4914.4119.8022.542s.6396.1952.9866.1952c.3469 0 .6757-.0651.9865-.1952s.5782-.3107.8023-.542c.224-.2313.4047-.5023.542-.8131.1374-.3108.206-.6469.206-1.0083 0-.3469-.0686-.6757-.206-.98651-.1373-.31078-.318-.58181-.542-.81309-.2241-.23128-.4915-.41197-.8023-.54206-.3108-.1301-.6396-.19515-.9865-.19515-.347 0-.6758.06505-.9866.19515-.3108.13009-.5782.31078-.8022.54206-.2241.23128-.4048.4987-.5421.80225s-.206.62875-.206.97575zm-4.1414-.0434c0-.8239.1663-1.59366.4987-2.30919.3325-.71552.7951-1.33709 1.3877-1.8647.5927-.5276 1.2974-.94318 2.1141-1.24674.8167-.30355 1.7093-.45533 2.6778-.45533.954 0 1.8394.14816 2.6561.44449s1.525.70829 2.1249 1.2359c.5998.52761 1.066 1.1564 1.3985 1.88638.3324.72998.4987 1.53589.4987 2.41759 0 .8818-.1699 1.6876-.5096 2.4176s-.8058 1.3588-1.3985 1.8864c-.5926.5276-1.3046.936-2.1357 1.2251-.8312.2891-1.731.4336-2.6995.4336-.954 0-1.8358-.1445-2.6453-.4336-.8094-.2891-1.5069-.7011-2.0923-1.2359-.5855-.5349-1.0444-1.1745-1.3769-1.919-.3324-.7444-.4987-1.5719-.4987-2.4826z"/><path d="m68.8064 8.65247v7.84903h-3.9246v-7.84903h-1.3009v-3.27406h1.3009v-3.33911h3.9246v3.33911h2.2333v3.27406z"/><path d="m77.4794 8.65247v7.84903h-3.9246v-7.84903h-1.3009v-3.27406h1.3009v-3.33911h3.9246v3.33911h2.2333v3.27406z"/><path d="m89.5349 9.32462c-.1301-.54929-.3976-.99016-.8023-1.32263s-.8962-.4987-1.4744-.4987c-.6071 0-1.1022.15901-1.4853.47702-.383.31801-.6251.76611-.7263 1.34431zm-4.5967 2.27668c0 1.6912.795 2.5368 2.385 2.5368.8529 0 1.4961-.3469 1.9298-1.0407h3.7944c-.7661 2.5441-2.6814 3.8161-5.7458 3.8161-.9396 0-1.7997-.1409-2.5803-.4228-.7805-.2819-1.4491-.683-2.0056-1.2034s-.9865-1.1419-1.2901-1.8647c-.3036-.7227-.4553-1.5322-.4553-2.4284 0-.9251.1445-1.75992.4336-2.50435.2891-.74444.7011-1.37684 1.2359-1.89722.5349-.52038 1.1817-.92151 1.9406-1.20338.7589-.28188 1.6154-.42281 2.5694-.42281.9396 0 1.7852.14093 2.5368.42281.7517.28187 1.3877.69022 1.9081 1.22506.5204.53483.9179 1.18892 1.1925 1.96227.2747.77334.412 1.64422.412 2.61272v.412z"/><path d="m95.4325 5.37841h3.9245v1.82133c.4192-.66493.932-1.17447 1.539-1.52862.608-.35415 1.316-.53122 2.125-.53122h.336c.123 0 .264.01445.423.04336v3.75108c-.52-.26019-1.084-.39029-1.691-.39029-.911 0-1.594.27103-2.049.8131-.4553.54206-.683 1.33345-.683 2.37425v4.7701h-3.9245z"/><path d="m110.242 14.9838s-5.378-9.60539-5.378-9.60539h4.554s2.97 5.70249 2.97 5.70249 2.884-5.70249 2.884-5.70249h4.51s-8.933 16.67389-8.933 16.67389h-4.402s3.795-7.0685 3.795-7.0685z"/></svg>`
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
// export function is_string_like(val: string) {
//   const v = val.trim();
//   if (v.startsWith(`"`) && v.endsWith(`"`)) {
//     return true;
//   } else if (v.startsWith(`'`) && v.endsWith(`'`)) {
//     return true;
//   } else if (v.startsWith("`") && v.endsWith("`")) {
//     return true;
//   }

//   return false;
// }

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

// // Sort by number of dots, then by total length.
// function compare_qualified_names(name1: string, name2: string) {
//   return (
//     name1.length +
//     100 * name1.split(".").length -
//     (name2.length + +100 * name2.split(".").length)
//   );
// }

// export function get_shortest_qualified_name(names: string[]) {
//   return names.sort(compare_qualified_names)[0];
// }

// If 0 or a 1-sigfig number is within dx/2, snap to it
export function maybe_round_number(x: number, dx: number) {
  dx = Math.abs(dx*0.5)

  if (x >= -dx && x <= dx) {
    return 0;
  }

  const nice_x = sig_figs(x, 1);

  return nice_x - dx <= x && x <= nice_x + dx ? nice_x : x;
}

// Round to given number of significant figures.
// A mashup of Brian, GPT-4o, and Sam Mason https://stackoverflow.com/a/56974893
export function sig_figs(x: number, ndigits: number): number {
  if (x === 0 || !isFinite(x)) {
      return x;
  }
  const order = Math.ceil(Math.log10(Math.abs(x)));
  const factor = Math.pow(10, ndigits - order);
  return Math.round(x * factor) / factor;
}

export function add_line_of_code(
  code: string, // without newline, unless you want to add an extra newline after
  state: State
): TextMarker<MarkerRange> {
  const cm = state.cell.code_mirror;

  const plt_show_line = (cm.getLine(state.plt_show_lineno_in_cell - 1) || '');
  const indentation = (plt_show_line.match(/^\s*/) || [''])[0];

  // if line before is blank, insert before the blank
  // otherwise, insert immeditately above plt.show()
  const n_lines_before = (cm.getLine(state.plt_show_lineno_in_cell - 2) || '').match(/^\s*$/) ? 2 : 1;

  const insert_line = state.plt_show_lineno_in_cell - n_lines_before;

  // Add a newline every time we switch from "set_" calls to other calls

  const line_before         = (cm.getLine(insert_line - 1) || '').trim();
  const line_before_has_set = line_before.includes('.set_');
  const new_code_has_set    = code.includes('.set_');
  const perhaps_prefix_newline = (line_before_has_set != new_code_has_set && line_before !== '') ? '\n' : '';

  let mark = cm.markText(
    { line: insert_line, ch: 0 },
    { line: insert_line, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  );

  let { from, to } = mark.find()!;
  cm.replaceRange(perhaps_prefix_newline + code.replaceAll(/^/mg, indentation) + '\n', from, to);

  return mark;
}

// So that 0.1 + 0.2 actually prints 0.3
//
// BUT this does limit us to 12 digits of precision
export function number_to_string_not_ugly(n: number): string {
  if (n == 0) {
    return "0";
  }

  // Convert to 12 digits left of the decimal point
  const precision = 12

  const base10 = Math.floor(Math.log10(Math.abs(n)));
  const sign = n < 0 ? "-" : "";
  const nnn_nnn_nnn_nnn = Math.abs(n) * Math.pow(10, precision - base10);

  // Round it off
  const rounded_nnn_nnn_nnn_nnn = Math.round(nnn_nnn_nnn_nnn);

  // Division still sometimes produces the wonky .999999 or .0000001 so
  // we will place the decimal point manually

  // let before_decimal = rounded_nnn_nnn_nnn_nnn.toString()
  // let after_decimal  = ""
  // let cur_base10 = precision
  // while (cur_base10 != base10) {
  //   if (cur_base10 > base10) {
  //     after_decimal  = before_decimal.slice(-1) + after_decimal
  //     before_decimal = before_decimal.slice(0, -1)
  //     if (before_decimal.length == 0) {
  //       before_decimal = "0"
  //     }
  //     cur_base10 -= 1
  //   } else if (cur_base10 < base10) {
  //     before_decimal += "0"
  //     cur_base10 += 1
  //   }
  // }

  // Division still sometimes produces the wonky .999999 or .0000001 so
  // we will place the decimal point manually

  let as_str = rounded_nnn_nnn_nnn_nnn.toString();
  let before_decimal, after_decimal: string;
  let base10_shift = base10 - precision;
  if (base10_shift < 0) {
    before_decimal = as_str.slice(0, base10_shift); // could be ''
    let padding    = '0'.repeat(-base10_shift) // ensure enough leading zeros for moving the decimal point
    after_decimal  = (padding + as_str).slice(base10_shift);
  } else {
    before_decimal = as_str + '0'.repeat(base10_shift);
    after_decimal  = '0'
  }

  // This will use e notation if base10 >= 21 or base10 <= -7
  return parseFloat(sign + before_decimal + "." + after_decimal).toString();
}

export function select_code_text(code_el: HTMLElement) {
  const code = code_el.innerText;

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();

    let [start_i, end_i] = [0, code.length];

    // If a literal string, select inside the string.
    if ((code.startsWith(`'`) && code.endsWith(`'`)) || (code.startsWith(`"`) && code.endsWith(`"`))) {
      start_i = 1;
      end_i = code.length - 1;
    }

    if (!code_el.firstChild) { code_el.append(''); }

    range.setStart(code_el.firstChild!, start_i);
    range.setEnd(code_el.firstChild!, end_i);

    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function non_colliding_name(base_name: string, avoid_names: string[]): string {
  let name = base_name;
  let i = 1;
  while (avoid_names.includes(name)) {
    i++;
    name = `${base_name}${i}`;
  }
  return name;
}

