import { CallInfo, MethodInfo, Model, SelectableArtist, View } from "./state";
import { JupyterType } from "./utils/types";

// These will already exist where we inject the JS in the notebook.
declare const IPython: any;
declare const Jupyter: JupyterType;

// Entry point
function attach_snp(
  snp_outer: HTMLElement,
  cell_lineno: number,
  provenance_is_off_by_n_lines: number,
  user_call_info: any,
  sidebar_stuff: {
    selectable_artists: SelectableArtist[];
    methods: MethodInfo[];
    calls: CallInfo[];
  }
) {
  // Initialize model (stores info about the cell)
  const model = initialize_model(
    snp_outer,
    cell_lineno,
    provenance_is_off_by_n_lines,
    sidebar_stuff
  );

  // Initialize view (stores view's state, e.g. sidebar elements)
  const view = initialize_view(model, snp_outer);

  // Find objects, methods, and their args
  // model.objects = ...
  // model.methods = ...

  //
}

function initialize_model(
  snp_outer: HTMLElement,
  cell_lineno: number,
  provenance_is_off_by_n_lines: number,
  sidebar_stuff: {
    selectable_artists: SelectableArtist[];
    methods: MethodInfo[];
    calls: CallInfo[];
  }
): Model {
  const cell_el = snp_outer.closest(".code_cell");

  const cell = Jupyter.notebook
    .get_cells()
    .filter((cell) => cell.element[0] === cell_el)[0];

  return {
    canvas_selection: null,

    cell: cell,
    cell_lineno: cell_lineno,

    last_cell_code_executed: cell.get_text(),
    provenance_is_off_by_n_lines,

    selectable_artists: sidebar_stuff.selectable_artists,

    methods: sidebar_stuff.methods,
    calls: sidebar_stuff.calls,

    busy: false,
  };
}

function initialize_view(model: Model, snp_outer: HTMLElement): View {
  // const sidebar = build_sidebar(model, snp_outer);

  return {
    hovered_elems: [],
    snp_outer: snp_outer,
    sidebar: undefined,
    stdout_stderr: snp_outer.querySelector(".stdout_stderr")!,
  };
}

(window as any)["attach_snp"] = attach_snp;
