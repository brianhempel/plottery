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
  TupleType,
  LiteralType,
  TypedDictType,
} from "../types";
import { unzip } from "./array";
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

function get_proper_type(type: Type): Type {
  return type[".class"] == "TypeAliasType" && type.resolved ? get_proper_type(type.resolved) : type;
}

function arg_defaults_for_star2_arg(arg_type: Type): Arg[] {
  arg_type = get_proper_type(arg_type);
  if (arg_type[".class"] != "TypedDictType") return [];
  const typed_dict = arg_type as TypedDictType;

  const { items, default_codes } = typed_dict;
  // const items: undefined | [string, Type][] = typed_dict?.items;
  // const default_codes: undefined | { [arg_name: string]: string; } = typed_dict?.default_codes;

  return items.map(([name, type], item_i) => {
    return {
      name,
      required: false,
      kind: "ARG_NAMED",
      code: default_codes[name] || default_code_for_type(type, name),
      type: type,
      // code_type: kwargs_alias!.code_type,
      default_code: default_codes[name] || null, // TypedDicts don't support defaults
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
export function arg_defaults_from_callee_type(
  callee: CallableType & {
    pos: Position;
  }
): Arg[] {
  let arg_names = callee.arg_names_at_definition ? callee.arg_names_at_definition : callee.arg_names;
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
    .slice(callee.def_extras.first_arg !== undefined ? 1 : 0); // ignore first arg (self) if def_extras.first_arg is defined
}


export function default_code_for_type(
  type: Type | string,
  name?: string
): string {
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
    console.error("default_code_for_type: type is a string", type);
    return `no default code for ${JSON.stringify(type)}`;
  }

  // Try to find a literal first; if that fails, use a default for the first type.
  const first_literal = find_first_literal_type(type);
  if (first_literal) {
    return first_literal.value_unparsed;
  } else if ((type as IInstanceType)?.type_ref == "builtins.str") {
    return "'Bananas...'";
  } else if ((type as IInstanceType)?.type_ref == "builtins.float") {
    return "0.5";
  } else if ((type as IInstanceType)?.type_ref == "builtins.int") {
    return "1";
  } else if (
    type[".class"] == "Instance" &&
    type["type_ref"] == "builtins.dict"
  ) {
    return "{}";
  } else if (type[".class"] == "UnionType") {
    return default_code_for_type(type.items[0], name);
  } else if (
    "type_ref" in type &&
    type["type_ref"] == "matplotlib._typing.ArrayLike"
  ) {
    return "[1,2,3]";
  } else if (type[".class"] == "TupleType") {
    const item_codes = type.items.map(t => default_code_for_type(t));
    const perhaps_trailing_comma = type.items.length == 1 ? "," : "";
    return `(${item_codes.join(", ")}${perhaps_trailing_comma})`;
  } else if (type[".class"] == "TypeAliasType" && type.resolved) {
    return default_code_for_type(type.resolved);
  } else if (type[".class"] == "NoneType") {
    return "None";
  }

  return `no default code for ${JSON.stringify(type)}`;
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

export function cm_start_pos(pos: Position, cell_lineno: number) {
  return { line: pos.line - cell_lineno, ch: pos.column };
}

export function cm_end_pos(pos: Position, cell_lineno: number) {
  return { line: pos.end_line - cell_lineno, ch: pos.end_column };
}

export function snp_logo_svg_html() {
  return `
<svg x="0px" y="0px" width="170px" height="17px" viewBox="0 0 170 17" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g id="Layer 1">
    <g id="Text">
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M37.2724,4.57035 C36.8241,4.20017,36.3759,3.92609,35.9277,3.74812 C35.4794,3.57014,35.0452,3.48116,34.625,3.48116 C34.0927,3.48116,33.6585,3.6093,33.3223,3.86558 C32.9861,4.12186,32.818,4.45645,32.818,4.86935 C32.818,5.1541,32.9021,5.38903,33.0701,5.57412 C33.2382,5.75921,33.4589,5.91939,33.732,6.05465 C34.0051,6.18991,34.3133,6.30737,34.6565,6.40704 C34.9997,6.5067,35.3393,6.61348,35.6755,6.72739 C37.0202,7.183,38.0043,7.79167,38.6276,8.55339 C39.2509,9.31512,39.5626,10.3082,39.5626,11.5327 C39.5626,12.3585,39.426,13.1059,39.1529,13.7751 C38.8797,14.4443,38.4805,15.0174,37.9552,15.4943 C37.43,15.9713,36.7856,16.3415,36.0222,16.6049 C35.2588,16.8683,34.3938,17,33.4273,17 C31.4243,17,29.5683,16.3949,27.8594,15.1847 C27.8594,15.1847,29.6243,11.8103,29.6243,11.8103 C30.2406,12.3656,30.85,12.7785,31.4523,13.049 C32.0546,13.3195,32.6499,13.4548,33.2382,13.4548 C33.9106,13.4548,34.4114,13.2982,34.7405,12.9849 C35.0697,12.6717,35.2343,12.3157,35.2343,11.9171 C35.2343,11.675,35.1923,11.465,35.1082,11.2871 C35.0242,11.1091,34.8841,10.9454,34.688,10.7959 C34.4919,10.6464,34.2363,10.5075,33.9211,10.3794 C33.6059,10.2513,33.2242,10.1089,32.776,9.95226 C32.2437,9.78141,31.7219,9.59275,31.2107,9.38631 C30.6994,9.17986,30.2441,8.90578,29.8449,8.56407 C29.4457,8.22236,29.1235,7.79167,28.8784,7.27198 C28.6333,6.7523,28.5107,6.0938,28.5107,5.29648 C28.5107,4.49916,28.6403,3.77659,28.8994,3.12877 C29.1586,2.48095,29.5228,1.92567,29.992,1.46294 C30.4613,1.00021,31.0356,0.640704,31.7149,0.384423 C32.3943,0.128141,33.1542,8.06807e-07,33.9946,8.06807e-07 C34.7791,8.06807e-07,35.5985,0.110344,36.4529,0.331031 C37.3074,0.551717,38.1268,0.875628,38.9113,1.30276 C38.9113,1.30276,37.2724,4.57035,37.2724,4.57035 z"/>
      </g>
      <g id="Text Copy">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M146.215,0.153705 C146.215,0.153705,146.215,16.5515,146.215,16.5515 C146.215,16.5515,142.412,16.5515,142.412,16.5515 C142.412,16.5515,142.412,0.153705,142.412,0.153705 C142.412,0.153705,146.215,0.153705,146.215,0.153705 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M45.5928,0.141815 C45.5928,0.141815,45.5928,9.54648,45.5928,9.54648 C45.5928,9.54648,49.5849,5.59548,49.5849,5.59548 C49.5849,5.59548,54.7957,5.59548,54.7957,5.59548 C54.7957,5.59548,49.3958,10.657,49.3958,10.657 C49.3958,10.657,55.1109,16.5515,55.1109,16.5515 C55.1109,16.5515,49.774,16.5515,49.774,16.5515 C49.774,16.5515,45.5928,12.0879,45.5928,12.0879 C45.5928,12.0879,45.5928,16.5515,45.5928,16.5515 C45.5928,16.5515,41.7898,16.5515,41.7898,16.5515 C41.7898,16.5515,41.7898,0.219334,41.7898,0.219334 C41.7898,0.219334,45.5928,0.141815,45.5928,0.141815 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M63.6834,9.48241 C63.5574,8.94137,63.2982,8.50712,62.906,8.17965 C62.5138,7.85218,62.0376,7.68844,61.4773,7.68844 C60.8889,7.68844,60.4092,7.84506,60.038,8.15829 C59.6668,8.47153,59.4322,8.9129,59.3341,9.48241 C59.3341,9.48241,63.6834,9.48241,63.6834,9.48241 z M59.2291,11.7249 C59.2291,13.3907,59.9995,14.2236,61.5403,14.2236 C62.3667,14.2236,62.9901,13.8819,63.4103,13.1985 C63.4103,13.1985,67.0872,13.1985,67.0872,13.1985 C66.3449,15.7044,64.4889,16.9573,61.5193,16.9573 C60.6088,16.9573,59.7754,16.8185,59.019,16.5408 C58.2625,16.2632,57.6147,15.8681,57.0754,15.3555 C56.5361,14.843,56.1194,14.2307,55.8253,13.5188 C55.5311,12.8069,55.384,12.0096,55.384,11.1269 C55.384,10.2157,55.5241,9.39342,55.8042,8.66018 C56.0844,7.92693,56.4836,7.30402,57.0019,6.79146 C57.5202,6.27889,58.147,5.88379,58.8824,5.60616 C59.6178,5.32852,60.4477,5.1897,61.3722,5.1897 C62.2827,5.1897,63.1021,5.32852,63.8305,5.60616 C64.5589,5.88379,65.1752,6.28601,65.6795,6.81281 C66.1838,7.33961,66.569,7.98388,66.8351,8.7456 C67.1012,9.50733,67.2343,10.3652,67.2343,11.3191 C67.2343,11.3191,67.2343,11.7249,67.2343,11.7249 C67.2343,11.7249,59.2291,11.7249,59.2291,11.7249 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M73.7898,8.82035 C73.7898,8.82035,73.7898,16.5515,73.7898,16.5515 C73.7898,16.5515,69.9868,16.5515,69.9868,16.5515 C69.9868,16.5515,69.9868,8.82035,69.9868,8.82035 C69.9868,8.82035,68.7261,8.82035,68.7261,8.82035 C68.7261,8.82035,68.7261,5.59548,68.7261,5.59548 C68.7261,5.59548,69.9868,5.59548,69.9868,5.59548 C69.9868,5.59548,69.9868,2.30653,69.9868,2.30653 C69.9868,2.30653,73.7898,2.30653,73.7898,2.30653 C73.7898,2.30653,73.7898,5.59548,73.7898,5.59548 C73.7898,5.59548,75.954,5.59548,75.954,5.59548 C75.954,5.59548,75.954,8.82035,75.954,8.82035 C75.954,8.82035,73.7898,8.82035,73.7898,8.82035 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M85.5141,9.1407 C84.8557,8.68509,84.1903,8.45729,83.518,8.45729 C83.1538,8.45729,82.8141,8.52136,82.4989,8.6495 C82.1838,8.77764,81.9071,8.95917,81.669,9.19409 C81.4309,9.42902,81.2453,9.70666,81.1122,10.027 C80.9791,10.3474,80.9126,10.7069,80.9126,11.1055 C80.9126,11.4899,80.9791,11.8423,81.1122,12.1627 C81.2453,12.483,81.4274,12.7607,81.6585,12.9956 C81.8896,13.2305,82.1663,13.4121,82.4884,13.5402 C82.8106,13.6683,83.1538,13.7324,83.518,13.7324 C84.2324,13.7324,84.8977,13.4832,85.5141,12.9849 C85.5141,12.9849,85.5141,16.2739,85.5141,16.2739 C84.5756,16.6868,83.6861,16.8932,82.8456,16.8932 C82.0612,16.8932,81.3153,16.758,80.6079,16.4874 C79.9006,16.2169,79.2772,15.8289,78.7379,15.3235 C78.1987,14.818,77.7679,14.2129,77.4458,13.5082 C77.1236,12.8034,76.9625,12.0168,76.9625,11.1482 C76.9625,10.2797,77.1166,9.48597,77.4248,8.76696 C77.7329,8.04795,78.1531,7.4286,78.6854,6.90892 C79.2177,6.38924,79.8515,5.98346,80.5869,5.69158 C81.3223,5.39971,82.1102,5.25377,82.9507,5.25377 C83.8752,5.25377,84.7296,5.4531,85.5141,5.85176 C85.5141,5.85176,85.5141,9.1407,85.5141,9.1407 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M88.2035,0.238511 C88.2035,0.238511,92.0065,0.148596,92.0065,0.148596 C92.0065,0.148596,92.0065,6.98367,92.0065,6.98367 C92.5248,6.34296,93.0501,5.91227,93.5823,5.69158 C94.1146,5.4709,94.738,5.36055,95.4523,5.36055 C96.8111,5.36055,97.8371,5.74142,98.5305,6.50314 C99.2238,7.26487,99.5705,8.29355,99.5705,9.5892 C99.5705,9.5892,99.5705,16.5515,99.5705,16.5515 C99.5705,16.5515,95.7675,16.5515,95.7675,16.5515 C95.7675,16.5515,95.7675,11.0201,95.7675,11.0201 C95.7675,10.4648,95.7255,10.0163,95.6414,9.67462 C95.5574,9.33291,95.4173,9.06952,95.2212,8.88442 C94.885,8.58543,94.4788,8.43593,94.0026,8.43593 C93.3582,8.43593,92.8645,8.6317,92.5213,9.02324 C92.1781,9.41478,92.0065,9.97362,92.0065,10.6997 C92.0065,10.6997,92.0065,16.5515,92.0065,16.5515 C92.0065,16.5515,88.2035,16.5515,88.2035,16.5515 C88.2035,16.5515,88.2035,0.238511,88.2035,0.238511 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M100.852,9.22613 C100.852,9.22613,106.882,9.22613,106.882,9.22613 C106.882,9.22613,106.882,12.451,106.882,12.451 C106.882,12.451,100.852,12.451,100.852,12.451 C100.852,12.451,100.852,9.22613,100.852,9.22613 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M108.185,5.59548 C108.185,5.59548,111.988,5.59548,111.988,5.59548 C111.988,5.59548,111.988,6.98367,111.988,6.98367 C112.506,6.34297,113.032,5.91227,113.564,5.69158 C114.096,5.4709,114.72,5.36055,115.434,5.36055 C116.19,5.36055,116.838,5.48513,117.378,5.7343 C117.917,5.98346,118.376,6.33585,118.754,6.79146 C119.062,7.16164,119.272,7.57454,119.384,8.03015 C119.496,8.48576,119.552,9.00544,119.552,9.5892 C119.552,9.5892,119.552,16.5515,119.552,16.5515 C119.552,16.5515,115.749,16.5515,115.749,16.5515 C115.749,16.5515,115.749,11.0201,115.749,11.0201 C115.749,10.4791,115.711,10.0412,115.634,9.70666 C115.557,9.37207,115.42,9.10511,115.224,8.90578 C115.056,8.73492,114.867,8.6139,114.657,8.54271 C114.446,8.47153,114.222,8.43593,113.984,8.43593 C113.34,8.43593,112.846,8.6317,112.503,9.02324 C112.16,9.41478,111.988,9.97362,111.988,10.6997 C111.988,10.6997,111.988,16.5515,111.988,16.5515 C111.988,16.5515,108.185,16.5515,108.185,16.5515 C108.185,16.5515,108.185,5.59548,108.185,5.59548 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M120.834,9.22613 C120.834,9.22613,126.864,9.22613,126.864,9.22613 C126.864,9.22613,126.864,12.451,126.864,12.451 C126.864,12.451,120.834,12.451,120.834,12.451 C120.834,12.451,120.834,9.22613,120.834,9.22613 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M132.642,7.83794 C132.642,7.83794,134.008,7.83794,134.008,7.83794 C135.521,7.83794,136.277,7.16876,136.277,5.8304 C136.277,4.49204,135.521,3.82286,134.008,3.82286 C134.008,3.82286,132.642,3.82286,132.642,3.82286 C132.642,3.82286,132.642,7.83794,132.642,7.83794 z M132.642,16.5515 C132.642,16.5515,128.524,16.5515,128.524,16.5515 C128.524,16.5515,128.524,0.448493,128.524,0.448493 C128.524,0.448493,135.079,0.448493,135.079,0.448493 C136.858,0.448493,138.221,0.918342,139.166,1.85804 C140.112,2.79774,140.584,4.12186,140.584,5.8304 C140.584,7.53894,140.112,8.86307,139.166,9.80276 C138.221,10.7425,136.858,11.2123,135.079,11.2123 C135.079,11.2123,132.642,11.2123,132.642,11.2123 C132.642,11.2123,132.642,16.5515,132.642,16.5515 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M152.414,11.0201 C152.414,11.3903,152.48,11.7284,152.613,12.0345 C152.746,12.3407,152.921,12.6076,153.139,12.8354 C153.356,13.0632,153.615,13.2412,153.916,13.3693 C154.217,13.4975,154.536,13.5616,154.872,13.5616 C155.208,13.5616,155.527,13.4975,155.828,13.3693 C156.129,13.2412,156.388,13.0632,156.605,12.8354 C156.823,12.6076,156.998,12.3407,157.131,12.0345 C157.264,11.7284,157.33,11.3974,157.33,11.0415 C157.33,10.6997,157.264,10.3758,157.131,10.0697 C156.998,9.76361,156.823,9.49665,156.605,9.26884 C156.388,9.04104,156.129,8.86307,155.828,8.73493 C155.527,8.60678,155.208,8.54271,154.872,8.54271 C154.536,8.54271,154.217,8.60678,153.916,8.73493 C153.615,8.86307,153.356,9.04104,153.139,9.26884 C152.921,9.49665,152.746,9.76005,152.613,10.059 C152.48,10.358,152.414,10.6784,152.414,11.0201 z M148.401,10.9774 C148.401,10.1658,148.562,9.40766,148.884,8.70289 C149.206,7.99812,149.654,7.38589,150.228,6.86621 C150.803,6.34652,151.486,5.93719,152.277,5.63819 C153.068,5.3392,153.933,5.1897,154.872,5.1897 C155.796,5.1897,156.654,5.33564,157.446,5.62751 C158.237,5.91939,158.924,6.32517,159.505,6.84485 C160.086,7.36453,160.538,7.98388,160.86,8.70289 C161.182,9.4219,161.343,10.2157,161.343,11.0842 C161.343,11.9527,161.179,12.7464,160.85,13.4655 C160.52,14.1845,160.069,14.8038,159.494,15.3235 C158.92,15.8432,158.23,16.2454,157.425,16.5302 C156.619,16.8149,155.747,16.9573,154.809,16.9573 C153.884,16.9573,153.03,16.8149,152.246,16.5302 C151.461,16.2454,150.785,15.8396,150.218,15.3128 C149.651,14.786,149.206,14.156,148.884,13.4227 C148.562,12.6895,148.401,11.8744,148.401,10.9774 z"/>
      </g>
      <g id="Text">
        <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M167.836,8.82035 C167.836,8.82035,167.836,16.5515,167.836,16.5515 C167.836,16.5515,164.033,16.5515,164.033,16.5515 C164.033,16.5515,164.033,8.82035,164.033,8.82035 C164.033,8.82035,162.772,8.82035,162.772,8.82035 C162.772,8.82035,162.772,5.59548,162.772,5.59548 C162.772,5.59548,164.033,5.59548,164.033,5.59548 C164.033,5.59548,164.033,2.30653,164.033,2.30653 C164.033,2.30653,167.836,2.30653,167.836,2.30653 C167.836,2.30653,167.836,5.59548,167.836,5.59548 C167.836,5.59548,170,5.59548,170,5.59548 C170,5.59548,170,8.82035,170,8.82035 C170,8.82035,167.836,8.82035,167.836,8.82035 z"/>
      </g>
    </g>
    <g id="Text">
      <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M24.5353,2.18898 C24.5353,2.18898,24.5353,16.5515,24.5353,16.5515 C24.5353,16.5515,20.7322,16.5515,20.7322,16.5515 C20.7322,16.5515,20.7322,2.18898,20.7322,2.18898 C20.7322,2.18898,24.5353,2.18898,24.5353,2.18898 z"/>
    </g>
    <g id="Text Copy">
      <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M19.3836,0.134156 C19.3836,0.134156,19.3836,16.532,19.3836,16.532 C19.3836,16.532,15.5805,16.532,15.5805,16.532 C15.5805,16.532,15.5805,0.134156,15.5805,0.134156 C15.5805,0.134156,19.3836,0.134156,19.3836,0.134156 z"/>
    </g>
    <g id="Text Copy 1">
      <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M14.232,5.47245 C14.232,5.47245,14.232,16.532,14.232,16.532 C14.232,16.532,10.429,16.532,10.429,16.532 C10.429,16.532,10.429,5.47245,10.429,5.47245 C10.429,5.47245,14.232,5.47245,14.232,5.47245 z"/>
    </g>
    <g id="Text Copy 2">
      <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M9.08052,8.75592 C9.08052,8.75592,9.08052,16.532,9.08052,16.532 C9.08052,16.532,5.27749,16.532,5.27749,16.532 C5.27749,16.532,5.27749,8.75592,5.27749,8.75592 C5.27749,8.75592,9.08052,8.75592,9.08052,8.75592 z"/>
    </g>
    <g id="Text Copy 3">
      <path style="fill:#000000;fill-opacity:1;fill-rule:nonzero;opacity:1;stroke:none;" d="M3.80303,7.66143 C3.80303,7.66143,3.80303,16.532,3.80303,16.532 C3.80303,16.532,5.72458e-16,16.532,5.72458e-16,16.532 C5.72458e-16,16.532,5.72458e-16,7.66143,5.72458e-16,7.66143 C5.72458e-16,7.66143,3.80303,7.66143,3.80303,7.66143 z"/>
    </g>
  </g>
</svg>
`
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
  // console.log("find_call_that_satisfies state", state);

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

// Round to given number of significant figures.
// A mashup of Brian, GPT-4o, and Sam Mason https://stackoverflow.com/a/56974893
export function sig_figs(x: number, ndigits: number): number {
  if (x === 0 || !isFinite(x)) {
      return x;
  }
  const order = Math.ceil(Math.log10(Math.abs(x)));
  const factor = Math.pow(10, ndigits - order);
  return Math.round(x * factor) / factor;
}export function add_line_of_code(
  code: string,
  state: State
): TextMarker<MarkerRange> {
  const cm = state.cell.code_mirror;

  let line_count = cm.getValue().split("\n").length;
  let mark = cm.markText(
    { line: line_count - 3, ch: 0 },
    { line: line_count - 3, ch: 0 },
    { inclusiveRight: true, inclusiveLeft: true, clearWhenEmpty: false }
  ); // insert at end, for now...

  let { from, to } = mark.find()!;
  cm.replaceRange(code, from, to);

  return mark;
}

// So that 0.1 + 0.2 actually prints 0.3
//
// BUT this does limit us to 12 digits of precision
export function number_to_string_not_ugly(n: number) {
  if (n === 0) {
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

  let before_decimal = rounded_nnn_nnn_nnn_nnn.toString()
  let after_decimal  = ""
  let cur_base10 = precision
  while (cur_base10 != base10) {
    if (cur_base10 > base10) {
      after_decimal  = before_decimal.slice(-1) + after_decimal
      before_decimal = before_decimal.slice(0, -1)
      if (before_decimal.length == 0) {
        before_decimal = "0"
      }
      cur_base10 -= 1
    } else if (cur_base10 < base10) {
      before_decimal += "0"
      cur_base10 += 1
    }
  }

  // This will use e notation if base10 >= 21 or base10 <= -7
  return parseFloat(sign + before_decimal + "." + after_decimal).toString();
}
