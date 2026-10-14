import { Layer, LayersPanel } from "./layer_panel/layer_panel";
import { PlotWidget } from "./sidebar/plot-widget/plot_widget";
import { CallLayout } from "./sidebar/call/call_layout";
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

  llm_api_keys: { [provider: string]: string }; // keyed by provider name, see plottery_ai_provider in utils/llm.ts
  mpl_version: string;

  // **** Actual state ****

  last_cell_code_executed: string;
  outstanding_kernel_request_time: undefined | number;
  redraw_waiting_for_idle: boolean; // see redraw_when_idle in code_sync.ts
  dragging_layers: Layer[]

  // The selected layers, in the order they were selected (see select_layer in layer_panel.ts).
  selection: LayerSelection[];
  // Where a shift-click range selection in the layers panel starts, and the selection it adds to.
  selection_anchor: { layer: Layer; base: LayerSelection[] } | undefined;
  // Removes the Properties panel's rows for several selected calls, if shown (see multi_args.ts).
  teardown_multi_args: (() => void) | undefined;

  is_in_dom: () => boolean; // false after a hard rerun of the cell; everything is old then


  // **** View outputs ****

  plottery_outer: HTMLElement;
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

  // Live mapping tables by table_key ("ax.bar #1|color"), fed fresh rows on every redraw.
  mapping_tables: Map<string, (runtime: MappingTableRuntime) => void>;
  // The dicts the tables' overrides can use, by name, shared by the tables that use them.
  mapping_dicts: Map<string, MappingDict>;
  // The cell's defs and classes, for which dicts a call can see.
  mapping_scopes: MappingScope[];

};

// A selected layer, and which of its calls the Properties panel shows (undefined: its first).
export type LayerSelection = {
  layer: Layer;
  call_view: CallView | undefined;
};

export type CallView = {
  els: CallViewEls;
  mark: TextMarker<MarkerRange>;
  arguments: {
    arg: Arg;
    view: ArgView;
  }[];
  // The call's source formatting, so edits preserve it. given_args[i] fills call_layout.slots[i].
  layout: { call_layout: CallLayout; given_args: Arg[] };
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

  // It's either a Type with { name, pos }, OR
  // its just { name, pos } if mypy couldn't type the arg
  given_args: ((Type | {}) & {
    name: string | null; // "align"
    pos: Position;
    provenance?: ProvNode; // variable-sharing provenance chain, if the arg is a tracked variable
    is_iterable?: boolean; // mypy types the value as an iterable (not a str)
    mapping_table?: MappingTableInfo; // the arg is a mapping table's comprehension
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
  pos?: Position; // source position of the value, for args given in the call
  provenance?: ProvNode; // variable-sharing provenance chain, if this arg is a tracked variable
  link_suggestions?: LinkSuggestion[]; // type-compatible non-variable args at other call sites
  element_info?: ElementInfo | null; // set if the parameter can take a list (so it can be a mapping table)
  code_is_iterable?: boolean; // mypy types the given code as an iterable. Only for given args.
  mapping_table?: MappingTableInfo; // the given code is a mapping table. Only for given args.
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
  element_info_by_arg_i?: (ElementInfo | null)[]; // only on callees of calls in the cell

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
  element_info_by_i?: (ElementInfo | null)[]; // only on callees of calls in the cell
};


/* ----------------- Mapping tables ----------------- */
// A spreadsheet editor for list comprehension args, with an optional dict of overrides:
//
//   [F for X in E]              [F for I, X in enumerate(E)]
//   [M.get(X, F) for X in E]    [M.get(K, F) for I, X in enumerate(E)]   (K is I or X)
//
//   df_indicator_to_color = {0: 'red', 1: 'blue'}
//   ax.bar(..., color=[df_indicator_to_color.get(indicator, 'gray') for indicator in df['indicator']])
//
// See sidebar/mapping_table/ and plottery/mapping_table.py.

// A parameter that can take a list, and what each element of that list is.
export type ElementInfo = {
  element_type: Type | null; // null if unknown (e.g. bare ArrayLike)
  element_snippets: string[]; // user code snippets compatible with element_type
};

export type MappingTableValue = {
  repr: string;
  hex: string | null;  // when the value is a color
  code: string | null; // literal code that evaluates to the value, if there is one
};

export type MappingTableItem = {
  key_code: string | null; // a dict key literal equal to the item, or null if there is none (NaN, unhashable, ...)
  display: string;
  match_id: string | null; // equal for items that are equal as dict keys (0, 0.0, False)
  is_nan: boolean;
};

// One distinct item of the iterable (merged over all runs of the comprehension).
export type MappingTableColumn = MappingTableItem & {
  first_i: number;
  count: number;
  formula: MappingTableValue | null; // at its first occurrence
  mapped: MappingTableValue | null;  // at its first occurrence
};

// One iteration of the last run. `col` indexes MappingTableRuntime.columns; if null (too many
// distinct items to track), the row carries its own item fields.
export type MappingTableRow = Partial<MappingTableItem> & {
  i: number;
  col: number | null;
  formula: MappingTableValue | null;
  mapped: MappingTableValue | null;
};

export type MappingTableRuntime = {
  n_runs: number;
  n_rows: number; // in the last run
  rows: MappingTableRow[];
  rows_capped: boolean;
  columns: MappingTableColumn[];
  n_unique: number;
  unique_capped: boolean;
  categorical: boolean; // whether "show unique values only" starts checked
};

export type MappingEntry = {
  key_code: string;
  value_code: string;
  match_id: string | null;
};

// A dict a table's overrides could use, from Python (CellNames.cell_dict_info in mapping_table.py).
export type MappingDictCandidate =
  | { name: string; in_cell: false; editable: false; reason: string } // from another cell
  | { name: string; in_cell: true; editable: false; reason: string; assign_pos: Position | null }
  | {
      name: string;
      in_cell: true;
      editable: true;
      reason: null;
      value_pos: Position; // the {...}
      entries: MappingEntry[];
      alone: boolean; // its statement is alone on its lines
      n_refs: number; // references to it in the cell, its assignment's target included
    };

// From Python: the dicts a table could use, and the cell's scopes.
export type MappingDictsInfo = {
  dicts: MappingDictCandidate[];
  scopes: { pos: Position; kind: "def" | "class" }[];
};

export type MappingScope = { mark: TextMarker<MarkerRange>; kind: "def" | "class" };

// One of the cell's dicts, shared by every table using it (see mapping_table/mapping_dicts.ts).
export type MappingDict = {
  name: string;
  read_only_reason: string | null; // null: a {...} literal in this cell that the tables can edit
  in_cell: boolean;
  // Editable: the {...}. Read-only in this cell: its assignment (to tell whether it's above a
  // call). Otherwise null.
  mark: TextMarker<MarkerRange> | null;
  entries: MappingEntry[]; // the committed overrides (editable dicts only)
  alone: boolean;          // its statement is alone on its lines, so they can be deleted
  external_refs: number;   // references to it other than its assignment and the tables using it
  users: Set<MappingDictUser>;
  preview: (() => MappingEntry[]) | null; // the overrides with a cell's edit in progress
  watching: { active: boolean } | null;   // its code watcher, once a table uses it
};

export type MappingDictUser = {
  render: () => void;
  on_rename: () => void;                  // the dict was renamed: use its new name
  uses_name: (name: string) => boolean;   // whether the table's code refers to `name`
};

export type MappingTableInfo = {
  table_key: string; // "ax.bar #1|color"
  mapping_name: string | null; // M, or null without a dict of overrides
  index_name: string | null;   // I, or null without enumerate
  item_name: string;
  key_on: "item" | "index";
  formula_code: string;
  iterable_code: string;
  runtime: MappingTableRuntime | null; // null if the comprehension didn't run (yet)
};
