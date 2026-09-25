import { Layer, LayersPanel } from "./layer_panel/layer_panel";
import { PlotWidget } from "./sidebar/plot-widget/plot_widget";
import { Widget } from "./sidebar/widgets/widget";
import { MarkerRange, TextMarker } from "./utils/codemirror";
import { Cell } from "./utils/types";


/* ------------------------ State ----------------------- */
export type State = {

  // **** Effectively static stuff to create the view ****

  cell: Cell;
  cell_lineno: number;
  plt_show_lineno_in_cell: number;
  provenance_is_off_by_n_lines: number;

  methods: MethodInfo[];
  methods_with_code: MethodWithCode[];

  calls: CallInfo[];
  calls_with_args: CallWithArgs[];

  notebook_typed_defs: Type[],
  user_iterables: string[];
  avoid_names: string[];

  llm_api_keys: { [provider: string]: string }; // keyed by provider name, see snp_ai_provider in utils/llm.ts
  mpl_version: string;

  // **** Actual state ****

  last_cell_code_executed: string;
  outstanding_kernel_request_time: undefined | number;
  dragging_layers: Layer[]

  is_in_dom: () => boolean; // false after a hard rerun of the cell; everything is old then


  // **** View outputs ****

  snp_outer: HTMLElement;
  plot_area: HTMLElement;
  stdout_stderr: HTMLElement;

  hover_regions_svg: () => SVGElement | undefined; // The SVG element is not always there (e.g. during drag ops) and is sometimes replaced.
  set_hover_regions_html: (html_svg_str: string) => void;
  hover_regions_container: HTMLElement;
  plot_widgets: PlotWidget[]; // On-plot UI edit widgets

  sidebar_el: HTMLElement;
  layers_panel: LayersPanel;
  properties_el: HTMLElement;

  command_shortcuts: { [keys: string]: (state: State) => void };

};

export type CallView = {
  els: CallViewEls;
  mark: TextMarker<MarkerRange>;
  arguments: {
    arg: Arg;
    view: ArgView;
  }[];
};

export type CallViewEls = {
  el: HTMLElement;
  header_el: HTMLElement;
  name_el: HTMLElement;
  // proxies_el: HTMLElement;
  properties_el: HTMLElement;
};

// export type MethodView = {
//   el: HTMLElement;
// };

// One editable link in a variable-sharing provenance chain (e.g. the w1 or 0.5 in `w2 ▸ w1 ▸ 0.5`),
// bound to its source location via a CodeMirror mark + sync watcher. `active` flips to false when the
// link is torn down because an upstream link changed (making it stale).
export type ChainLink = {
  widget: Widget;
  mark: TextMarker<MarkerRange>;
  pos: Position;
  sep_el: HTMLElement;
  link_el: HTMLElement;
  active: boolean;
};

export type ArgView = {
  el: HTMLElement;
  widget: Widget;
  disabled: boolean;
  positional: boolean;
  chain_links?: ChainLink[];
};

// One node of a variable-sharing provenance chain: how a value reached an argument
// through variable bindings. `pos` is the editable RHS expression; `children` is the
// provenance of that expression (0 or 1 for a plain variable; more for future operations).
export type ProvNode = {
  kind: "var";
  var_name: string | null;
  pos: Position;
  children: ProvNode[];
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
  docstring_first_line: string; // "Set a title for the axes."
  receiver: number; // 140533847992896
  receiver_name: string; // "ax.bar"
  type: CallableType;
  show_on: number[]; // [140533847992896, 140533885438224]
};

export type CallInfo = {
  // name: string;
  func_code: string; // "ax.bar"
  call_id: string; // "ax.bar #1"

  call: { pos: Position };
  callee: CallableType & { pos: Position };

  docstring: string | null; // the full docstring

  // It's either a Type with { name, pos }, OR
  // its just { name, pos } if mypy couldn't type the arg
  given_args: ((Type | {}) & {
    name: string | null; // "align"
    pos: Position;
    provenance?: ProvNode; // variable-sharing provenance chain, if the arg is a tracked variable
  })[];

  // Per-parameter "link" suggestions: type-compatible non-variable arguments at *other*
  // call sites. Choosing one introduces a variable shared by both call sites.
  link_suggestions_by_arg_name?: { [arg_name: string]: LinkSuggestion[] };
};

// A type-compatible non-variable argument at another call site. No source position: positions
// go stale as soon as any soft GUI edit rewrites the cell, so the frontend resolves the target
// at hover/click time via call_id + arg_name through the live CallViews (whose marks track edits).
export type LinkSuggestion = {
  code: string;       // the expression at the other call site, e.g. "(0, 0, 1)" (for the label; may be stale, live value read at use time)
  arg_name: string;   // parameter name at the other call, e.g. "color"
  call_label: string; // 'ax.bar(["a", "b", "c"], ...)'
  call_id: string;    // "ax.bar #1"
};

export type Arg = {
  name: string;
  kind: "ARG_POS" | "ARG_OPT" | "ARG_STAR" | "ARG_NAMED" | "ARG_STAR2" | "ARG_NAMED_OPT";
  code: string;
  type: Type | null; // Sometimes users provide an argument that's not in the type definition.
  code_type?: Type | null; // mypy's type for `code` as of the last full render. Only for given args.
  default_code: string | null;
  type_compatible_code_snippets: string[];
  required: boolean;
  is_positional: boolean;
  provenance?: ProvNode; // variable-sharing provenance chain, if this arg is a tracked variable
  link_suggestions?: LinkSuggestion[]; // type-compatible non-variable args at other call sites
};

export type CallWithArgs = {
  call_info: CallInfo;
  given_positional_args: Arg[];
  given_keyword_args: Arg[];
  needed_positional_args: Arg[];
  missing_optional_positional_args: Arg[];
  missing_keyword_args: Arg[];
};

export type MethodWithCode = {
  method_info: MethodInfo;
  receiver_dot_name: string; // "ax.bar"
  code: string; // "ax.bar(...)"
};


/* ----------------- Python types ----------------- */
export type Type =
  | UnionType
  | LiteralType
  | AnyType
  | CallableType
  | NoneType
  | TypeAliasType
  | IInstanceType
  | TypedDictType
  | TupleType;

export type TupleType = {
  ".class": "TupleType";
  implicit: boolean;
  items: Type[];
  partial_fallback: Type;
}

export type UnionType = {
  ".class": "UnionType";
  items: Type[];
};

export type LiteralType = {
  ".class": "LiteralType";
  value: string | number; // "left"
  value_unparsed: string; // "'left'"
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
  arg_names: string[];                      // [null,  null, 'label', 'fontdict', 'loc', ...] // null means positional-only (i.e. before a slash)
  arg_names_at_definition: null | string[]; // ['self', 'x', 'label', 'fontdict', 'loc', ...] // so we have to use this list in that case
  type_compatible_code_snippets_by_arg_i: string[][]; // [['ax'], ['colors', 'counts'], ...]
  arg_types: Type[];

  def_extras: {
    first_arg: string; // 'self'
  };

  default_code_by_arg_idx: (string | null)[];
  fallback: string; // "builtins.str"

  from_concatenate: boolean;
  implicit: boolean;
  imprecise_arg_kinds: boolean;
  is_ellipses_arg: boolean;

  name: string; // "set_title of Axes"
  definition_fullname: string | null; // "matplotlib.axes._axes.Axes.set_title"
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
  type_compatible_code_snippets_by_i: string[][]; // [['ax'], ['colors', 'counts'], ...]
  required_keys: string[];
  default_codes_by_name: { [arg_name: string]: string };
};
