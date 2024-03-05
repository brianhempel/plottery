import { get_config } from "./config";
import { populate_parent_ids } from "./sidebar/artist/artist";
import { make_hover_regions } from "./sidebar/hover-regions/hover_regions";
import { make_plot_widgets } from "./sidebar/plot-widget/plot_widget";
import { create_sidebar, focus_on_call_from_code } from "./sidebar/sidebar";
import { create_toggles } from "./sidebar/toggles/toggles";
import "./snp.css";
import {
  CallInfo,
  MethodInfo,
  Model,
  SNPState,
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
  // ...Initialize some globals
  (window as any)["snp_persistent_artists"] =
    (window as any)["snp_persistent_artists"] ?? {};
  (window as any)["snp_persistent_calls"] =
    (window as any)["snp_persistent_calls"] ?? {};

  // Initialize model (stores info about the cell)
  const model = initialize_model(
    snp_outer,
    cell_lineno,
    provenance_is_off_by_n_lines,
    sidebar_stuff
  );

  // Initialize view (stores view's state, e.g. sidebar elements)
  const view = initialize_view(model, snp_outer);

  const state: SNPState = { model, view };

  // Populate artist_child
  populate_parent_ids(sidebar_stuff.selectable_artists);

  // Find all calls and methods for artists
  const all_calls_and_methods = get_all_calls_and_methods(model);
  state.model.all_calls_and_methods = all_calls_and_methods;

  console.log(state);

  // Create a sidebar to show them
  view.sidebar = create_sidebar(
    all_calls_and_methods,
    model.selectable_artists,
    state
  );
  view.snp_outer.append(view.sidebar.els.el);

  // Make hover regions
  view.hover_regions = make_hover_regions(state);

  // Make plot widgets on those hover regions
  make_plot_widgets(get_config().plot_widgets, state);

  // Create toggles
  create_toggles(state);

  // Put stdout_stderr at the bottom
  view.stdout_stderr.remove();
  snp_outer.append(view.stdout_stderr);

  // Focus on any outstanding calls
  const focused_call: string | null = (window as any)["snp_focused_call"];
  if (focused_call != null) {
    focus_on_call_from_code(focused_call, state);
    (window as any)["snp_focused_call"] = null;
  }

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
  // Put stdout_stderr at the bottom
  const stdout_stderr: HTMLElement = snp_outer.querySelector(".stdout_stderr")!;
  stdout_stderr.remove();
  snp_outer.append(stdout_stderr);

  const hovered_elems = [...snp_outer.querySelectorAll("g")] as SVGGElement[];

  return {
    hovered_elems,
    snp_outer: snp_outer,
    sidebar: undefined,
    stdout_stderr,
  };
}

(window as any)["attach_snp"] = attach_snp;
