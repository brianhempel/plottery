import { State } from "../types";
import { TextMarker, MarkerRange } from "../utils/codemirror";
import { CellMessage } from "../utils/types";


export function hard_rerun(state: State) {
  state.busy = false;
  state.cell.code_mirror.getAllMarks().forEach(mark => mark.clear());
  state.cell.execute();
}

export function sync_call_code(
  mark: TextMarker<MarkerRange>,
  code: string,
  state: State
) {
  let { from, to } = mark.find()!;

  const code_mirror = state.cell.code_mirror;

  code_mirror.replaceRange(code, from, to);
  ({ from, to } = mark.find()!);
  code_mirror.setSelection(from, to);

  redraw_cell(state);
}

export function redraw_cell(state: State) {
  const cell = state.cell;
  const codeExecuting = cell.get_text();

  const img = state.snp_outer.querySelector("img")!;

  if (state.busy || codeExecuting == state.last_cell_code_executed) {
    return;
  }

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
      // This also triggers img.onload which calls attach_snp and reattaches all of our events!
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else {
      if (msg.header.msg_type == "error") {
        // Display the error, but adjust line number for the lines we added to the top of the cell.
        state.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
          /\b(line +)(\d+)/gi,
          (_: string, line_space: string, n_str: string) =>
            `${line_space}${
              parseInt(n_str) - state.provenance_is_off_by_n_lines
            }`
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
      state.busy = false;

      // Replace hover regions
      // if (
      //   msg.header.msg_type === "execute_result" &&
      //   msg.content.data["image/svg+xml"] &&
      //   msg.content.data["application/json"]
      // ) {
      //   replace_hover_regions(snp_state, msg.content.data["image/svg+xml"]);
      //   const json = msg.content.data["application/json"];
      //   snp_state.cell_lineno = json.cell_lineno;
      //   snp_state.provenance_is_off_by_n_lines =
      //     json.provenance_is_off_by_n_lines;
      //   attach_events_to_hover_regions(snp_state);
      // }
      // infer_types_and_attach_widgets(snp_state);
    }
  };

  cell.kernel.execute(codeExecuting, callbacks, {
    silent: false,
    store_history: true,
    stop_on_error: true,
  });
}
