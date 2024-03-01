import { Widget } from "./sidebar/widgets/widget";
import { MarkerRange, TextMarker } from "./utils/codemirror";
import { Cell } from "./utils/types";

export class AppState {
  static model: Model;
  static view_model: View;
}

/* ------------------------------------------------------ */
/*                          Types                         */
/* ------------------------------------------------------ */

/* ------------------------ Model ----------------------- */
export type Model = {
  canvas_selection: SelectedItem | null;

  // Jupyter Cell the output is in
  cell: Cell;
  cell_lineno: number;

  last_cell_code_executed: string;
  provenance_is_off_by_n_lines: number;

  selectable_artists: SelectableArtist[];

  methods: MethodInfo[];
  calls: CallInfo[];

  busy: boolean;
};

export type SelectedItem =
  | { name: string }
  | { func_code: string; call_num: number };

export type SelectableArtist = {
  id: number; // 140533847992896
  names: string[]; // ['ax.yaxis.label', 'ax.axes.yaxis.label'...]
};

/* --------------------- View Model --------------------- */
export type View = {
  hovered_elems: Element[];
  snp_outer: HTMLElement;
  stdout_stderr: HTMLElement;

  sidebar?: SidebarView;
};

export type SidebarView = {
  els: SidebarViewEls;
  artists: { [name: string]: ArtistView };
};

export type SidebarViewEls = {
  el: HTMLElement;
  header_el: HTMLElement;
  artists_el: HTMLElement;
};

export type ArtistView = {
  els: ArtistViewEls;

  is_expanded: boolean;

  calls: CallView[];
  methods: MethodView[];
};

export type ArtistViewEls = {
  el: HTMLElement;
  header_el: HTMLElement;
  collapse_button_el: HTMLElement;
  name_el: HTMLElement;
  body_el: HTMLElement;
  collapse_indent_el: HTMLElement;
  calls_el: HTMLElement;
};

export type CallView = {
  els: CallViewEls;
  is_elided: boolean; // (i.e. not collapsed args into ...)

  arguments: ArgView[];
};

export type CallViewEls = {
  el: HTMLElement;
  name_el: HTMLElement;
  start_bracket_el: HTMLElement;
  args_el: HTMLElement;
  end_bracket_el: HTMLElement;
};

export type MethodView = {
  el: HTMLElement;
  mark: TextMarker<MarkerRange>;
};

export type ArgView = {
  el: HTMLElement;
  widget: Widget;

  optional: boolean;

  positional: boolean;

  comma_el: HTMLElement | null;
};

/* ----------------- Sidebar call types ----------------- */
export type Position = {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
};

export type MethodInfo = {
  max_calls: number; // 1, Infinity, etc.
  name: string; // "set_title"
  receiver: number; // 140533847992896
  show_on: number[]; // [140533847992896, 140533885438224]
  type: CallableType & { pos: Position };
};

export type Arg = {
  name: string | null;
  kind: string;
  code: string;
  type: Type;
  code_type: Type | undefined;
  type_compatible_local_names: string[];
};

export type CallInfo = MethodInfo & {
  call: { pos: Position };
  callee: CallableType & { pos: Position };
  func_code_and_num: [string, number]; // ["ax.bar", 1]

  // It's either a Type with { kind, name, pos }, OR
  // its just { kind, name, pos }.
  given_args: ((Type | {}) & {
    kind: number; // 3
    name: string | null; // "align"
    pos: Position;
  })[];
};

export type CallWithArgs = {
  call_info: CallInfo;
  given_positional_args: Arg[];
  given_keyword_args: Arg[];
  missing_positional_args: Arg[];
  missing_keyword_args: Arg[];
  needed_positional_args: Arg[];
  missing_optional_positional_args: Arg[];
};

export type MethodWithArgs = {
  method_info: MethodInfo;
  required_positional_arg: Arg[];
  required_keyword_args: Arg[];
  receiver_name: string;
};

// if (type === "builtins.str") {
//   return ['""', type];
// } else if (type === "builtins.float") {
//   return ["0.0", type];
// } else if (
//   type[".class"] === "Instance" &&
//   type["type_ref"] === "builtins.dict"
// ) {
//   return ["{}", type];
// } else if (type[".class"] === "UnionType") {
//   return default_code_and_code_type_for_type((type as Type).items[0], name);
// } else if (
//   type[".class"] === "LiteralType" &&
//   type["fallback"] == "builtins.str"
// ) {
//   return [JSON.stringify(type["value"]), type["fallback"]];
// } else if (type["type_ref"] === "matplotlib._typing.ArrayLike") {
//   return ["[1,2,3]", type];
// } else {
//   return ["None", { ".class": "NoneType" }];
// }

export type Type =
  | "builtins.str"
  | "builtins.float"
  | string // "matplotlib.axes._axes.Axes", etc.
  | UnionType
  | LiteralType
  | AnyType
  | CallableType
  | NoneType
  | TypeAliasType
  | IInstanceType;

export type UnionType = {
  ".class": "UnionType";
  items: Type[];
};

export type LiteralType = {
  ".class": "LiteralType";
  value: string | number; // "left"
  fallback: string; // "builtins.str"
};

export type AnyType = {
  ".class": "AnyType";
  type_of_any: number; // 1
  source_any?: null; // ?
  missing_import_name: null; // ?
};

export type CallableType = {
  ".class": "CallableType";

  arg_kinds: number[]; // [0, 0, 1, ...]
  arg_names: string[]; // ['self', 'label', 'fontdict', 'loc', ...]
  arg_type_compatible_local_names: string[][]; // [['ax'], ['colors', 'counts'], ...]
  arg_types: Type[];

  bound_args: undefined[]; // ?
  def_extras: {
    first_arg: string; // 'self'
  };

  definition_arguments_default_code: (number | string | null)[];
  fallback: string; // "builtins.str"

  from_concatenate: boolean;
  implicit: boolean;
  imprecise_arg_kinds: boolean;
  is_ellipses_arg: boolean;

  name: string; // "set_title of Axes"
  ret_type: Type; // "matplotlib.text.Text"

  type_gaurd: null; // ?
  unpack_kwargs: false;

  variables: undefined[]; // ?
};

export type NoneType = {
  ".class": "NoneType";
};

export type TypeAliasType = {
  ".class": "TypeAliasType";
  args: undefined[]; // ?
  type_ref: string; // "matplotlib._typing.ArrayLike"
};

export type IInstanceType = {
  ".class": "Instance";
  args: Type[]; // "['matplotlib.lines.Line2D']"
  type_ref: string; // "builtins.list"
};
