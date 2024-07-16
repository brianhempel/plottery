import { attach_events_to_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { reposition_plot_widgets } from "../sidebar/plot-widget/plot_widget";
import { State } from "../types";
import { TextMarker, MarkerRange } from "../utils/codemirror";
import { CellMessage } from "../utils/types";


export function hard_rerun(state: State) {
  state.busy = false;
  state.cell.code_mirror.getAllMarks().forEach(mark => mark.clear());
  state.cell.execute();
}

export function add_sync_code_on_change_watcher(
  get_code: () => string,
  mark: TextMarker<MarkerRange>,
  state: State
) {
  let curr_code = get_code();

  function keep_synced() {
    const code = get_code();

    if (curr_code != code) {
      sync_code_range(mark, code, state);
      curr_code = code;
    }

    requestAnimationFrame(keep_synced);
  }
  keep_synced();
}

export function sync_code_range(
  mark: TextMarker<MarkerRange>,
  code: string,
  state: State
) {
  let { from, to } = mark.find()!;

  const code_mirror = state.cell.code_mirror;

  code_mirror.replaceRange(code, from, to);

  // Selecting the code leaves a highlight on what has changed, BUT it scrolls
  // the window which is really jarring when you are doing a direct manipulation.
  // ({ from, to } = mark.find()!);
  // code_mirror.setSelection(from, to);

  redraw_cell(state);
}


export function redraw_cell(state: State) {
  const cell = state.cell;
  const codeExecuting = cell.get_text();

  if (state.busy) return;
  if (codeExecuting == state.last_cell_code_executed) return;

  const img = state.plot_area.querySelector("img")!;

  state.busy = true;
  state.last_cell_code_executed = codeExecuting;
  state.stdout_stderr.innerHTML = "";

  // Hacktastic way to get live feedback
  const callbacks = cell.get_callbacks();

  callbacks.iopub!.output = function (msg: CellMessage) {
    if (
      msg.header.msg_type == "execute_result" &&
      msg.content.data["image/png"]
    ) {
      // Replace background image
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else {
      if (msg.header.msg_type == "error") {
        // Display the error, but adjust line number for the lines we added to the top of the cell.
        state.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
          /\b(line +)(\d+)/gi,
          (_: string, line_space: string, n_str: string) =>
            `${line_space}${parseInt(n_str) - state.provenance_is_off_by_n_lines}`
        );
      } else if (msg.header.msg_type == "stream") {
        state.stdout_stderr.innerText += msg.content.text;
      } else {
        console.warn("[redraw cell]", arguments);
      }
    }

    if (codeExecuting != cell.get_text()) {
      state.busy = false;
      redraw_cell(state);
    } else {
      // Wait to refresh hover regions until the cell is not changing value.
      state.busy = false;
      refresh_hover_regions(state);
    }
  };

  state.hover_regions_container.classList.add("hidden");
  cell.kernel.execute(codeExecuting.replace('SNP(', `SNPFigureOnly(`), callbacks, {
    silent: false,
    store_history: false,
    stop_on_error: true,
  });
}


export function refresh_hover_regions(state: State) {
  const cell = state.cell;

  state.stdout_stderr.innerHTML = "";

  // Hacktastic way to get live feedback
  const callbacks = cell.get_callbacks();

  callbacks.iopub!.output = function (msg: CellMessage) {
    // Replace hover regions
    if (
      msg.header.msg_type === "execute_result" &&
      msg.content.data["image/svg+xml"]
    ) {
      // console.log("Replacing hover regions");
      state.set_hover_regions_html(msg.content.data["image/svg+xml"]);
      attach_events_to_hover_regions(state);
      state.hover_regions_container.classList.remove("hidden");
      reposition_plot_widgets(state);
    } else if (msg.header.msg_type == "error") {
      // Display the error, but adjust line number for the lines we added to the top of the cell.
      state.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
        /\b(line +)(\d+)/gi,
        (_: string, line_space: string, n_str: string) =>
          `${line_space}${parseInt(n_str) - state.provenance_is_off_by_n_lines}`
      );
    } else if (msg.header.msg_type == "stream") {
      state.stdout_stderr.innerText += msg.content.text;
    } else {
      console.warn("[refresh_hover_regions]", arguments);
    }
  };

  cell.kernel.execute(cell.get_text().replace('SNP(', `SNPFigureAndHoverRegions(`), callbacks, {
    silent: false,
    store_history: false,
    stop_on_error: true,
  });
}
