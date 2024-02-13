import {
  Arg,
  CallableType,
  LiteralType,
  Position,
  Type,
  UnionType,
} from "../state";
import { get_arg_kind_from_int } from "./types";

export function arg_defaults_from_callee_type(
  callee: CallableType & {
    pos: Position;
  }
): Arg[] {
  return callee.arg_names
    .map((arg_name: string, arg_i: string | number) => {
      const arg_kind = get_arg_kind_from_int(callee.arg_kinds[arg_i]);
      const arg_type = callee.arg_types[arg_i];

      // Since the function parameter could be a union type, we need to indicate which of the types the actual code is.
      let arg_default_code: string;
      let arg_default_type: Type | undefined;
      if (callee.definition_arguments_default_code[arg_i]) {
        arg_default_code = callee.definition_arguments_default_code[arg_i];
        arg_default_type = undefined; // We don't know.
      } else {
        [arg_default_code, arg_default_type] =
          default_code_and_code_type_for_type(arg_type, arg_name);
      }

      return {
        is_active: false,
        name: arg_name,
        kind: arg_kind,
        code: arg_default_code,
        type: arg_type,
        code_type: arg_default_type,
        type_compatible_local_names:
          callee.arg_type_compatible_local_names[arg_i],
      };
    })
    .slice(callee.def_extras.first_arg !== undefined ? 1 : 0); // ignore first arg (self) if def_extras.first_arg is defined
}

export function default_code_and_code_type_for_type(
  type: Type,
  name?: string
): [string, Type] {
  const default_value_from_name = [
    ["width", "builtins.float", "1.0"],
    ["height", "builtins.float", "1.0"],
  ];

  const [_, __, default_code] = default_value_from_name.find(
    ([default_name, default_type, default_code]) =>
      name == default_name && type == default_type
  ) || [undefined, undefined, undefined];

  if (default_code !== undefined) {
    return [default_code, type];
  }

  if (type == "builtins.str") {
    return ['""', type];
  } else if (type == "builtins.float") {
    return ["0.0", type];
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
    type[".class"] == "LiteralType" &&
    type["fallback"] == "builtins.str"
  ) {
    const ltype = type as LiteralType;
    return [JSON.stringify(ltype.value), ltype.fallback];
  } else if (type["type_ref"] == "matplotlib._typing.ArrayLike") {
    return ["[1,2,3]", type];
  } else {
    return ["None", { ".class": "NoneType" }];
  }
}

export function createElement(
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

export function item_to_start_pos(
  item: { pos: Position },
  cell_lineno: number
) {
  return { line: item.pos.line - cell_lineno, ch: item.pos.column };
}

export function item_to_end_pos(item: { pos: Position }, cell_lineno: number) {
  return { line: item.pos.end_line - cell_lineno, ch: item.pos.end_column };
}
