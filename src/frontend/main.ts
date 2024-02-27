import { create_sidebar } from "./sidebar/sidebar";
import "./snp.css";
import {
  AppState,
  CallInfo,
  MethodInfo,
  Model,
  SelectableArtist,
  View,
} from "./state";
import { get_all_calls_and_methods } from "./utils/args";
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
  AppState.model = model;

  // Initialize view (stores view's state, e.g. sidebar elements)
  const view = initialize_view(model, snp_outer);
  AppState.view_model = view;

  // Find all calls and methods for artists
  const all_calls_and_methods = get_all_calls_and_methods(model);

  // Create a sidebar to show them
  view.sidebar = create_sidebar(all_calls_and_methods, model, view);

  // Put stdout_stderr at the bottom
  view.stdout_stderr.remove();
  snp_outer.append(view.stdout_stderr);

  // Suppress additional plot
  setTimeout(() => {
    snp_outer.parentElement?.parentElement?.nextElementSibling?.remove();
  }, 200);
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
    .filter(cell => cell.element[0] === cell_el)[0];

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

  // Clear an extra plot (if it's there)
  const output = snp_outer.parentElement!.parentElement!.parentElement!;

  if (output.children.length > 1) {
    output.removeChild(output.children[1]);
  }

  // Put stdout_stderr at the bottom
  const stdout_stderr: HTMLElement = snp_outer.querySelector(".stdout_stderr")!;
  stdout_stderr.remove();
  snp_outer.append(stdout_stderr);

  return {
    hovered_elems: [],
    snp_outer: snp_outer,
    sidebar: undefined,
    stdout_stderr,
  };
}

(window as any)["attach_snp"] = attach_snp;
