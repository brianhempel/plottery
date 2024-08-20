import { attach_events_to_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { reposition_plot_widgets } from "../sidebar/plot-widget/plot_widget";
import { State } from "../types";
import { TextMarker, MarkerRange } from "../utils/codemirror";
import { CellMessage } from "../utils/types";


export function hard_rerun(state: State) {
  state.cell.code_mirror.getAllMarks().forEach(mark => mark.clear());
  // state.cell.execute();
  execute_cell_but_delay_clearing_output(state.cell);
}

// Adapted from notebook/js/codecell.js
function execute_cell_but_delay_clearing_output(cell) {

  const stop_on_error = true

  // cell.clear_output(false, true);
  var old_msg_id = cell.last_msg_id;
  if (old_msg_id) {
      cell.kernel.clear_callbacks_for_msg(old_msg_id);
      // delete CodeCell.msg_cells[old_msg_id]; // Pretty sure this isn't used
      cell.last_msg_id = null;
  }
  if (cell.get_text().trim().length === 0) {
      // nothing to do
      cell.set_input_prompt(null);
      return;
  }
  cell.set_input_prompt('*');
  cell.element.addClass("running");
  var callbacks = cell.get_callbacks();
  const orig_output_callback = callbacks.iopub!.output;

  callbacks.iopub!.output = function (msg: CellMessage) {
    if (msg.header.msg_type === "execute_result" || msg.header.msg_type === "error") {
      cell.clear_output(false, true);
    }
    orig_output_callback(...arguments);
  }

  cell.last_msg_id = cell.kernel.execute(cell.get_text(), callbacks, {silent: false, store_history: true, stop_on_error : stop_on_error});
  // CodeCell.msg_cells[cell.last_msg_id] = cell;
  cell.render();
  cell.events.trigger('execute.CodeCell', {cell: cell});
  var that = cell;
  function handleFinished(evt, data) {
      if (that.kernel.id === data.kernel.id && that.last_msg_id === data.msg_id) {
              that.events.trigger('finished_execute.CodeCell', {cell: that});
          that.events.off('finished_iopub.Kernel', handleFinished);
        }
  }
  cell.events.on('finished_iopub.Kernel', handleFinished);
}

export function add_sync_code_on_change_watcher(
  get_code: () => string,
  marks: TextMarker<MarkerRange>[],
  state: State
) {
  let curr_code = get_code();

  function keep_synced() {
    const code = get_code();

    if (curr_code != code) {
      sync_code_range(marks, code, state);
      curr_code = code;
    }

    // requestAnimationFrame(keep_synced);
    state.is_in_dom() && requestAnimationFrame(keep_synced);
  }
  requestAnimationFrame(keep_synced);
}

function sync_code_range(
  marks: TextMarker<MarkerRange>[],
  code: string,
  state: State
) {

  const cm = state.cell.code_mirror;

  marks.forEach(mark => {
    let { from, to } = mark.find()!;
    cm.replaceRange(code, from, to);
  });

  // Selecting the code leaves a highlight on what has changed, BUT it scrolls
  // the window which is really jarring when you are doing a direct manipulation.
  // ({ from, to } = mark.find()!);
  // code_mirror.setSelection(from, to);

  redraw_cell(state);
}

function kernel_is_busy(state: State): boolean {
  const kernel = state.cell.kernel;
  const any_pending_messages = kernel._pending_messages.length > 0;
  const iopub_not_done = kernel.last_msg_callbacks && !kernel.last_msg_callbacks.iopub_done;
  return any_pending_messages || iopub_not_done;
}

export function redraw_cell(state: State, ignore_busy: boolean = false) {
  const cell = state.cell;

  if (!ignore_busy && kernel_is_busy(state)) return;

  const code_executing = cell.get_text();
  if (code_executing == state.last_cell_code_executed) return;
  state.last_cell_code_executed = code_executing;

  state.stdout_stderr.innerHTML = "";

  // Hacktastic way to get live feedback
  const callbacks = cell.get_callbacks();

  // const old_clear_output = callbacks.iopub!.clear_output;
  // callbacks.iopub!.clear_output = function (msg: CellMessage) {
  //   console.log("clear_output callback", msg);
  //   old_clear_output(msg);
  // }

  callbacks.iopub!.output = function (msg: CellMessage) {
    // console.log("output callback", msg);
    if (
      msg.header.msg_type == "execute_result" &&
      msg.content.data["image/png"]
    ) {
      // Replace background image
      const img = state.plot_area.querySelector("img")!;
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
        console.warn("[redraw cell unhandlable output message]", arguments);
      }
    }

    if (code_executing != cell.get_text()) {
      // console.log("iopub done", state.cell.kernel.last_msg_callbacks.iopub_done);
      redraw_cell(state, true);
    } else {
      // Wait to refresh hover regions until the cell is not changing value.
      refresh_hover_regions(state);
    }
  };

  state.hover_regions_container.classList.add("hidden");
  cell.kernel.execute(code_executing.replace('SNP(', `SNPFigureOnly(`), callbacks, {
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
      state.hover_regions_container.classList.remove("hidden");
      attach_events_to_hover_regions(state);
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
      console.warn("[refresh_hover_regions unhandlable output message]", arguments);
    }

    // In case there was a change in the meantime
    redraw_cell(state, true);
  };

  cell.kernel.execute(cell.get_text().replace('SNP(', `SNPFigureAndHoverRegions(`), callbacks, {
    silent: false,
    store_history: false,
    stop_on_error: true,
  });
}
