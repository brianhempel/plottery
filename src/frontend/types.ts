import { P_Module } from "./ast_types";
import { Widget } from "./sidebar/widgets/widget";
import { MarkerRange, TextMarker } from "./utils/codemirror";
import { Cell } from "./utils/types";

/* ------------------------------------------------------ */
/*                          Types                         */
/* ------------------------------------------------------ */

/* ------------------------ State ----------------------- */
export type State = {

  // **** Effectively static stuff to create the view ****

  cell: Cell;
  cell_lineno: number;

  last_cell_code_executed: string;
  provenance_is_off_by_n_lines: number;

  selectable_artists: SelectableArtist[];

  methods: MethodWithArgs[];
  calls: DynamicCallInfo[];
  calls_with_args: CallWithArgs<DynamicCallInfo>[];

  calls_and_methods_by_artist?: {
    [key: string]: {
      calls: CallWithArgs<DynamicCallInfo | StaticCallTypeInfo>[];
      methods: MethodWithArgs[];
    };
  };
  notebook_typed_defs: Type[],


  // **** Actual state ****

  canvas_selection: SelectedItem | null;
  busy: boolean;


  // **** View outputs ****

  // hovered_elems: SVGGElement[];
  snp_outer: HTMLElement;
  stdout_stderr: HTMLElement;

  hover_regions_svg: () => SVGElement | undefined; // The SVG element not always there (e.g. during drag ops) and is sometimes replaced.
  set_hover_regions_html: (html_svg_str: string) => void;
  hover_regions_container: HTMLElement;

  layers: Layer[];
  sidebar?: SidebarView;

  // hover_regions?: {
  //   el: HTMLElement;
  //   regions: {
  //     [artist_id: number]: HoverRegion;
  //   };
  // };
};


export type SelectedItem =
  | { name: string }
  | { func_code: string; call_num: number };

export type SelectableArtist = {
  id: number; // 140533847992896
  names: string[]; // ['ax.yaxis.label', 'ax.axes.yaxis.label'...]
  parent_id?: number;
};

export type HoverRegion = {
  el: HTMLElement;
  calls: { info: DynamicCallInfo; view: CallView }[];
  methods: { info: MethodInfo; view: MethodView }[];
  artist: ArtistView | null;
};

export type SidebarView = {
  el: HTMLElement;
  artists_el: HTMLElement;
  artists: { [name: string]: ArtistView };
};

export type ArtistView = {
  els: ArtistViewEls;

  calls: CallView[];
  methods: MethodView[];
};

export type ArtistViewEls = {
  el: HTMLElement;
  header_el: HTMLElement;
  name_el: HTMLElement;
  body_el: HTMLElement;
};

export type Layer = {
  el: HTMLElement;
  calls_with_args: CallWithArgs<DynamicCallInfo>[];
  call_views: CallView[];
}

export type CallView = {
  els: CallViewEls;
  is_elided: boolean; // (i.e. not collapsed args into ...)

  arguments: {
    arg: Arg;
    view: ArgView;
  }[];
};

export type CallViewEls = {
  el: HTMLElement;
  header_el: HTMLElement;
  name_el: HTMLElement;
  body_el: HTMLElement;
};

export type MethodView = {
  el: HTMLElement;
  mark: TextMarker<MarkerRange>;
};

export type ArgView = {
  el: HTMLElement;
  widget: Widget;

  disabled: boolean;

  positional: boolean;
};

export type PersistantArtist = {
  collapsed: boolean;
};

export type PersistantCall = {
  collapsed: boolean;
  elided: boolean;
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
};

export type MethodInfoWithType = MethodInfo & {
  type: CallableType & { pos: Position };
};

export type Arg = {
  name: string;
  kind: string;
  code: string;
  type: Type;
  code_type: Type | null;
  type_compatible_code_snippets: string[];
  is_positional: boolean;
};

export type StaticCallTypeInfo = MethodInfo & {
  call: { pos: Position };
  callee: CallableType & { pos: Position };

  // It's either a Type with { kind, name, pos }, OR
  // its just { kind, name, pos }.
  given_args: ((Type | {}) & {
    kind: number; // 3
    name: string | null; // "align"
    pos: Position;
  })[];
};

export type DynamicCallInfo =  StaticCallTypeInfo & {
  loc_via_func_code_and_num: [string, number]; // ["ax.bar", 1]
};

export type CallWithArgs<call_info_type> = {
  call_info: call_info_type;
  given_positional_args: Arg[];
  given_keyword_args: Arg[];
  missing_positional_args: Arg[];
  missing_keyword_args: Arg[];
  needed_positional_args: Arg[];
  missing_optional_positional_args: Arg[];
  kwargs: Arg[] | null;
};

export type MethodWithArgs = {
  method_info: MethodInfoWithType;
  code: string;
  required_positional_arg: Arg[];
  required_keyword_args: Arg[];
  receiver_name: string;
};

export type Type =
  | UnionType
  | LiteralType
  | AnyType
  | CallableType
  | NoneType
  | TypeAliasType
  | IInstanceType
  | TypedDictType;

export type UnionType = {
  ".class": "UnionType";
  items: Type[];
};

export type LiteralType = {
  ".class": "LiteralType";
  value: string | number; // "left"
  fallback: Type;
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
  type_compatible_code_snippets_by_arg_i: string[][]; // [['ax'], ['colors', 'counts'], ...]
  arg_types: Type[];

  bound_args: null[]; // ?
  def_extras: {
    first_arg: string; // 'self'
  };

  default_code_by_arg_idx: (number | string | null)[];
  fallback: string; // "builtins.str"

  from_concatenate: boolean;
  implicit: boolean;
  imprecise_arg_kinds: boolean;
  is_ellipses_arg: boolean;

  name: string; // "set_title of Axes"
  ret_type: Type; // "matplotlib.text.Text"

  type_gaurd: null; // ?
  unpack_kwargs: false;

  variables: null[]; // ?
};

export type NoneType = {
  ".class": "NoneType";
};

export type TypeAliasType = {
  ".class": "TypeAliasType";
  args: null[]; // ?
  type_ref: string; // "matplotlib._typing.ArrayLike"
  resolved: Type;
};

export type IInstanceType = {
  ".class": "Instance";
  args: Type[]; // "['matplotlib.lines.Line2D']"
  type_ref: string; // "builtins.list"
};

export type TypedDictType = {
  ".class": "TypedDictType";
  fallback: Type; // "builtins.dict"
  items: [string, Type][];
  required_keys: string[];
};
