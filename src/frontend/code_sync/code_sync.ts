import { attach_events_to_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { reposition_plot_widgets } from "../sidebar/plot-widget/plot_widget";
import { State } from "../types";
import { TextMarker, MarkerRange } from "../utils/codemirror";
import { debounce, log_event } from "../utils/instrumentation";
import { get_persistent_item } from "../utils/misc";
import { LLMApiKeys } from "../utils/llm";
import { CellCallbacks, CellMessage, JupyterType } from "../utils/types";


declare const IPython: JupyterType | undefined;
(window as any).IPython ||= (window as any).IPython

export function hard_rerun(state: State) {
  state.cell.code_mirror.getAllMarks().forEach(mark => mark.clear());
  if (IPython) { // Notebooks v6, avoid the flash of clearing the output
    execute_cell_but_delay_clearing_output(state.cell);
  } else { // JupyterLab, not going to try to try hack it
    state.cell.execute();
  }
}

// Adapted from notebook/js/codecell.js
function execute_cell_but_delay_clearing_output(cell: any) {

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

  const in_demo_mode = window.sessionStorage.getItem('plottery_demo_mode') === 'true'

  callbacks.iopub!.output = function (msg: CellMessage) {
    if (msg.header.msg_type === "execute_result" || msg.header.msg_type === "error") {
      cell.clear_output(false, true);
    }
    if (in_demo_mode && msg.header.msg_type == "error" && msg.content.evalue!.includes('UserWarning: *c* argument looks like a single numeric RGB or RGBA sequence')) {
      // swallow the message
    } else if (in_demo_mode && msg.header.msg_type == "stream" && msg.content.text.includes('UserWarning: *c* argument looks like a single numeric RGB or RGBA sequence')) {
      // swallow the message
    }
    orig_output_callback(...arguments);
  }

  cell.last_msg_id = cell.kernel.execute(cell.get_text(), callbacks, {
    silent: false,
    store_history: true,
    stop_on_error : stop_on_error,
    cell: cell
  });
  // CodeCell.msg_cells[cell.last_msg_id] = cell;
  cell.render();
  cell.events.trigger('execute.CodeCell', {cell: cell, plottery_hard_rerun: true});
  var that = cell;
  function handleFinished(_evt: any, data: any) {
      if (that.kernel.id === data.kernel.id && that.last_msg_id === data.msg_id) {
              that.events.trigger('finished_execute.CodeCell', {cell: that});
          that.events.off('finished_iopub.Kernel', handleFinished);
        }
  }
  cell.events.on('finished_iopub.Kernel', handleFinished);
}

// Is the Plottery UI actually being rendered? Notebook 7 (JupyterLab) windows the notebook
// and marks offscreen cells `content-visibility: auto`, whose subtrees Chrome does not lay
// out or render. The code-sync RAF loop keeps running there (the element is still connected),
// so without this guard it would read/write the cell source while it's offscreen. We pass
// contentVisibilityAuto so a skipped content-visibility subtree counts as not-rendered, and
// fall back to "rendered" on browsers without checkVisibility.
function ui_is_rendered(state: State): boolean {
  const el = state.snp_outer as any;
  if (typeof el.checkVisibility !== "function") return true;
  return el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
}

export function add_sync_code_on_change_watcher(
  get_code: () => string,
  marks: TextMarker<MarkerRange>[],
  state: State,
  is_active: () => boolean = () => true // stop watching (e.g. a chain link torn down because an upstream link changed)
) {
  let curr_code = get_code();

  function keep_synced() {
    if (!is_active()) return; // stop the loop; don't reschedule

    // Hold all writes while the cell isn't being rendered (e.g. scrolled offscreen under
    // Notebook 7's windowing). We deliberately don't read/refresh curr_code here, so
    // scrolling back into view can't trigger a spurious sync. Just reschedule and re-check.
    if (ui_is_rendered(state)) {
      const code = get_code();

      // Never sync a transient empty value back into the source. In CodeMirror 5 a
      // clearWhenEmpty:false mark survived its range going empty; CodeMirror 6 mark
      // decorations cannot be empty (mapping drops them, and re-adding one throws
      // "Mark decorations may not be empty"), so writing "" mid-edit (e.g. while the
      // user is clearing a contenteditable chain-link widget) blanks the source
      // expression AND loses the mark that tracks it. Keeping the last non-empty value
      // avoids the disappearing RHS; committing/rerunning re-derives everything anyway.
      if (curr_code != code && code.trim() !== "") {
        curr_code = code;
        sync_code_range(marks, code, state);
        debounce('code sync', 333, () => log_event('other', 'code sync', {code: state.cell.code_mirror.getValue()}));
      }
    }

    // requestAnimationFrame(keep_synced);
    state.is_in_dom() && is_active() && requestAnimationFrame(keep_synced);
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
    const range = mark.find();
    if (!range) return; // mark was dropped (e.g. cleared by a concurrent rerun); nothing to sync
    cm.replaceRange(code, range.from, range.to);
  });

  // Selecting the code leaves a highlight on what has changed, BUT it scrolls
  // the window which is really jarring when you are doing a direct manipulation.
  // ({ from, to } = mark.find()!);
  // code_mirror.setSelection(from, to);

  redraw_cell(state);
}

// Trying to
// (a) only run one request at once, and
// (b) not sometimes freeze, and
// (c) always run the last state of the code
// is rather tricky.
function kernel_is_busy(state: State): boolean {

  // Can't figure out how to query the kernel reliably
  // after .execute (Notebooks v6) or .requestExecute (JupyterLab)
  // to discover requests immediately after they're queued. There seems
  // to be a delay before the kernel knows it's busy.

  // So we'll keep our own record of an outstanding request, at least
  // until we are sure the kernel state is probably correct.

  const outstanding_kernel_request_time = state.outstanding_kernel_request_time;
  if (outstanding_kernel_request_time) {
    if (new Date().getTime() - outstanding_kernel_request_time < 500) {
      return true;
    }
  }

  // If request is more than half a second old, it could be a long running request
  // or, somehow the request never returned (e.g. kernel shutdown),
  // but by now the kernel state should be reliable.

  const kernel = state.cell.kernel;
  if (kernel) { // Notebooks v6
    const any_pending_messages = kernel._pending_messages.length > 0;
    const iopub_not_done = !!kernel.last_msg_callbacks && !kernel.last_msg_callbacks.iopub_done;
    return any_pending_messages || iopub_not_done;
  } else { // JupyterLab
    const is_busy = state.cell.jupyterlab_cell!.parent.parent.sessionContext.session?.kernel.status !== 'idle';
    // if (is_busy) { console.log("Kernel is busy"); }
    return is_busy
  }
}

function handle_error_or_stdout_stderr(state: State, msg: CellMessage) {
  const in_demo_mode = window.sessionStorage.getItem('plottery_demo_mode') === 'true'

  if (msg.header.msg_type == "error") {
    if (!in_demo_mode || !msg.content.evalue!.includes('UserWarning: *c* argument looks like a single numeric RGB or RGBA sequence')) {
      // Display the error, but adjust line number for the lines we added to the top of the cell.
      state.stdout_stderr.innerText += msg.content.evalue!.replaceAll(
        /\b(line +)(\d+)/gi,
        (_: string, line_space: string, n_str: string) =>
          `${line_space}${parseInt(n_str) - state.provenance_is_off_by_n_lines}`
      );
    }
  } else if (msg.header.msg_type == "stream") {
    if (!in_demo_mode || !msg.content.text.includes('UserWarning: *c* argument looks like a single numeric RGB or RGBA sequence')) {
      state.stdout_stderr.innerText += msg.content.text;
    }
  } else {
    console.warn("[snp unhandlable iopub message]", msg);
  }
}

export function redraw_cell(state: State, ignore_busy: boolean = false) {
  const cell = state.cell;

  if (!ignore_busy && kernel_is_busy(state)) return;

  const code_executing = cell.get_text();
  if (code_executing == state.last_cell_code_executed) return;
  state.last_cell_code_executed = code_executing;

  const request_time = new Date().getTime();
  state.outstanding_kernel_request_time = request_time;

  state.stdout_stderr.innerHTML = "";

  state.hover_regions_container.classList.add("hidden");

  const fig_idx = get_persistent_item(state, 'fig_idx') || '0';
  const postfix =
`\nlast_snp = snp.show_ui(fig_idx=${fig_idx}, snp_class=snp.SNPFigureOnly) # Store to a variable for debugging
last_snp`;

  // For JupyterLab, see https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/outputarea/src/widget.ts#L678
  const on_iopub_output = (msg: any) => {
    // console.log("onIOPub", msg);
    // // const model = outputArea.model;
    // const msgType = msg.header.msg_type;
    // // let output: nbformat.IOutput;
    // let output;
    // const transient = (msg.content as any).transient || {};
    // const displayId = transient['display_id'] as string;
    // let targets: number[] | undefined;

    const msg_type = msg.header.msg_type;
    if ( msg_type == "execute_result" && msg.content.data["image/png"] ) {
      // Replace background image
      const img = state.plot_area.querySelector("img")!;
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else if (msg_type === "status" || msg_type === "execute_input") {
      // Swallow these JupyterLab-specific messages
    } else {
      handle_error_or_stdout_stderr(state, msg);
    }

    // switch (msgType) {
    //   case 'execute_result':
    //   case 'display_data':
    //   case 'stream':
    //   case 'error':
    //     output = { ...msg.content, output_type: msgType };
    //     model.add(output);
    //     break;
    //   case 'clear_output': {
    //     model.clear(msg.content.wait);
    //     break;
    //   }
    //   case 'update_display_data':
    //     output = { ...msg.content, output_type: 'display_data' };
    //     targets = this._displayIdMap.get(displayId);
    //     if (targets) {
    //       for (const index of targets) {
    //         model.set(index, output);
    //       }
    //     }
    //     break;
    //   case 'status': {
    //     const executionState = (msg as KernelMessage.IStatusMsg).content
    //       .execution_state;
    //     if (executionState === 'idle') {
    //       // If status is idle, the kernel is no longer blocked by the input
    //       this._pendingInput = false;
    //     }
    //     break;
    //   }
      // case 'idle':
      //   break;
    //   default:
    //     console.warn("[snp redraw_cell_jupyterlab unhandlable output message]", msg);
    //     break;
    // }
    // if (displayId && msgType === 'display_data') {
    //   targets = this._displayIdMap.get(displayId) || [];
    //   targets.push(model.length - 1);
    //   this._displayIdMap.set(displayId, targets);
    // }
  };

  const on_shell_reply = (_msg: any) => {
    // console.log("onReply", _msg);
    if (state.outstanding_kernel_request_time == request_time) {
      state.outstanding_kernel_request_time = undefined;
    }
    if (code_executing != cell.get_text()) {
      // console.log("iopub done", state.cell.kernel.last_msg_callbacks.iopub_done);
      redraw_cell(state);
    } else {
      // Wait to refresh hover regions until the cell is not changing value.
      refresh_hover_regions(state);
    }

    // API responses that contain a pager are special cased and their type
    // is overridden from 'execute_reply' to 'display_data' in order to
    // render output.
    // const model = outputArea.model;
    // const content = msg.content;
    // if (content.status !== 'ok') {
    //   return;
    // }
    // const payload = content && content.payload;
    // if (!payload || !payload.length) {
    //   return;
    // }
    // const pages = payload.filter((i: any) => (i as any).source === 'page');
    // if (!pages.length) {
    //   return;
    // }
    // const page = JSON.parse(JSON.stringify(pages[0]));
    // const output: nbformat.IOutput = {
    //   output_type: 'display_data',
    //   data: (page as any).data as nbformat.IMimeBundle,
    //   metadata: {}
    // };
    // model.add(output);
  };

  kernel_execute(code_executing, postfix, on_iopub_output, on_shell_reply, state);


  // if (cell.kernel) { // Notebooks v6
  //   const callbacks: CellCallbacks = cell.get_callbacks();

  //   callbacks.iopub!.output = function (msg: CellMessage) {
  //     // console.log("iopub output callback", msg);
  //     if (
  //       msg.header.msg_type == "execute_result" &&
  //       msg.content.data["image/png"]
  //     ) {
  //       // Replace background image
  //       const img = state.plot_area.querySelector("img")!;
  //       img.src = "data:image/png;base64," + msg.content.data["image/png"];
  //     } else {
  //       handle_error_or_stdout_stderr(state, msg);
  //     }
  //   };

  //   callbacks.shell!.reply = function (_msg: CellMessage) {
  //     if (state.outstanding_kernel_request_time == request_time) {
  //       state.outstanding_kernel_request_time = undefined;
  //     }
  //     if (code_executing != cell.get_text()) {
  //       // console.log("iopub done", state.cell.kernel.last_msg_callbacks.iopub_done);
  //       redraw_cell(state);
  //     } else {
  //       // Wait to refresh hover regions until the cell is not changing value.
  //       refresh_hover_regions(state);
  //     }
  //   }

  //   // If we add an explicit show_ui, the notebook extension will not re-add it again
  //   cell.kernel.execute(code_executing + postfix, callbacks, {
  //     silent: false,
  //     store_history: false,
  //     stop_on_error: true,
  //     cell: cell, // For our nbextension to know which cell is executing, even though we're not executing the cell's code exactly
  //     doesnt_need_snp_show_ui: true, // Tell the exention not to add another show_ui
  //   });
  // } else { // JupyterLab
  //   // Based on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/cells/src/widget.ts#L1692
  //   // and, more importantly, on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/outputarea/src/widget.ts#L878

  //   const jl_cell = cell.jupyterlab_cell;

  //   if (!jl_cell) {
  //     throw new Error("snp redraw_cell_jupyterlab: cell should have a backing JupyterLab cell!");
  //   }

  //   const metadata = {
  //     ...jl_cell.model.metadata,
  //     cellId: jl_cell.model.sharedModel.getId(),
  //     doesnt_need_snp_show_ui: true, // Tell the labexention not to add another show_ui
  //   };

  //   const kernel = jl_cell.parent.parent.sessionContext.session?.kernel;

  //   if (!kernel) {
  //     throw new Error('snp redraw_cell jupyterlab: Session has no kernel.');
  //   }

  //   console.log("Executing");
  //   const future = kernel.requestExecute({
  //     code: code_executing + postfix,
  //     silent: false,
  //     store_history: false,
  //     stop_on_error: true,
  //   }, false, metadata);

  //     // Based on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/outputarea/src/widget.ts#L678
  //   future.onIOPub = (msg: any) => {
  //     // console.log("onIOPub", msg);
  //     // // const model = outputArea.model;
  //     // const msgType = msg.header.msg_type;
  //     // // let output: nbformat.IOutput;
  //     // let output;
  //     // const transient = (msg.content as any).transient || {};
  //     // const displayId = transient['display_id'] as string;
  //     // let targets: number[] | undefined;

  //     const msg_type = msg.header.msg_type;
  //     if (
  //       msg_type == "execute_result" &&
  //       msg.content.data["image/png"]
  //     ) {
  //       // Replace background image
  //       const img = state.plot_area.querySelector("img")!;
  //       img.src = "data:image/png;base64," + msg.content.data["image/png"];
  //     } else if (msg_type === "status" || msg_type === "execute_input") {

  //     } else {
  //       handle_error_or_stdout_stderr(state, msg);
  //     }

  //     // need to check code_executing to potentially retry

  //     // switch (msgType) {
  //     //   case 'execute_result':
  //     //   case 'display_data':
  //     //   case 'stream':
  //     //   case 'error':
  //     //     output = { ...msg.content, output_type: msgType };
  //     //     model.add(output);
  //     //     break;
  //     //   case 'clear_output': {
  //     //     model.clear(msg.content.wait);
  //     //     break;
  //     //   }
  //     //   case 'update_display_data':
  //     //     output = { ...msg.content, output_type: 'display_data' };
  //     //     targets = this._displayIdMap.get(displayId);
  //     //     if (targets) {
  //     //       for (const index of targets) {
  //     //         model.set(index, output);
  //     //       }
  //     //     }
  //     //     break;
  //     //   case 'status': {
  //     //     const executionState = (msg as KernelMessage.IStatusMsg).content
  //     //       .execution_state;
  //     //     if (executionState === 'idle') {
  //     //       // If status is idle, the kernel is no longer blocked by the input
  //     //       this._pendingInput = false;
  //     //     }
  //     //     break;
  //     //   }
  //       // case 'idle':
  //       //   break;
  //     //   default:
  //     //     console.warn("[snp redraw_cell_jupyterlab unhandlable output message]", msg);
  //     //     break;
  //     // }
  //     // if (displayId && msgType === 'display_data') {
  //     //   targets = this._displayIdMap.get(displayId) || [];
  //     //   targets.push(model.length - 1);
  //     //   this._displayIdMap.set(displayId, targets);
  //     // }
  //   };

  //   future.onReply = (_msg: any) => {
  //     console.log("onReply", _msg);
  //     if (state.outstanding_kernel_request_time == request_time) {
  //       state.outstanding_kernel_request_time = undefined;
  //     }
  //     if (code_executing != cell.get_text()) {
  //       // console.log("iopub done", state.cell.kernel.last_msg_callbacks.iopub_done);
  //       redraw_cell(state);
  //     } else {
  //       // Wait to refresh hover regions until the cell is not changing value.
  //       refresh_hover_regions(state);
  //     }

  //     // API responses that contain a pager are special cased and their type
  //     // is overridden from 'execute_reply' to 'display_data' in order to
  //     // render output.
  //     // const model = outputArea.model;
  //     // const content = msg.content;
  //     // if (content.status !== 'ok') {
  //     //   return;
  //     // }
  //     // const payload = content && content.payload;
  //     // if (!payload || !payload.length) {
  //     //   return;
  //     // }
  //     // const pages = payload.filter((i: any) => (i as any).source === 'page');
  //     // if (!pages.length) {
  //     //   return;
  //     // }
  //     // const page = JSON.parse(JSON.stringify(pages[0]));
  //     // const output: nbformat.IOutput = {
  //     //   output_type: 'display_data',
  //     //   data: (page as any).data as nbformat.IMimeBundle,
  //     //   metadata: {}
  //     // };
  //     // model.add(output);
  //   };
  // }
}


// Execute `code` — which need not match the cell's text — and swap in the resulting figure
// image only, leaving the cell code, marks, and the rest of the SNP UI untouched. Used by the
// AI panel's live preview; the caller saves/restores the previous img src etc. to revert.
// `should_apply` is checked at each output message so a preview the user has since abandoned
// (kernel executions can't be aborted) doesn't clobber the restored original.
export function preview_figure_only(
  state: State,
  code: string,
  should_apply: () => boolean,
  on_reply: () => void = () => {}
) {
  const request_time = new Date().getTime();
  state.outstanding_kernel_request_time = request_time;

  state.stdout_stderr.innerHTML = "";

  state.hover_regions_container.classList.add("hidden");

  const fig_idx = get_persistent_item(state, 'fig_idx') || '0';
  const postfix =
`\nlast_snp = snp.show_ui(fig_idx=${fig_idx}, snp_class=snp.SNPFigureOnly) # Store to a variable for debugging
last_snp`;

  const on_iopub_output = (msg: CellMessage) => {
    if (!should_apply()) { return; }

    const msg_type = msg.header.msg_type;
    if ( msg_type == "execute_result" && msg.content.data["image/png"] ) {
      // Replace background image
      const img = state.plot_area.querySelector("img")!;
      img.src = "data:image/png;base64," + msg.content.data["image/png"];
    } else if (msg_type === "status" || msg_type === "execute_input") {
      // Swallow these JupyterLab-specific messages
    } else {
      handle_error_or_stdout_stderr(state, msg);
    }
  };

  const on_shell_reply = (_msg: CellMessage) => {
    if (state.outstanding_kernel_request_time == request_time) {
      state.outstanding_kernel_request_time = undefined;
    }
    on_reply();
  };

  kernel_execute(code, postfix, on_iopub_output, on_shell_reply, state);
}


export function refresh_hover_regions(state: State) {
  const cell = state.cell;

  state.stdout_stderr.innerHTML = "";

  const code_executing = cell.get_text();
  state.last_cell_code_executed = code_executing;

  const request_time = new Date().getTime();
  state.outstanding_kernel_request_time = request_time;

  const fig_idx = get_persistent_item(state, 'fig_idx') || '0';
  const postfix =
`\nlast_snp = snp.show_ui(fig_idx=${fig_idx}, snp_class=snp.SNPFigureAndHoverRegions) # Store to a variable for debugging
last_snp`;

  const on_iopub_output = (msg: CellMessage) => {

    // Replace hover regions
    const msg_type = msg.header.msg_type;
    if (
      msg_type === "execute_result" &&
      msg.content.data["image/svg+xml"]
    ) {
      // console.log("Replacing hover regions");
      state.set_hover_regions_html(msg.content.data["image/svg+xml"]);
      state.hover_regions_container.classList.remove("hidden");
      attach_events_to_hover_regions(state);
      reposition_plot_widgets(state);

      if ( msg.content.data["image/png"] ) {
        // Replace background image with higher DPI version
        const img = state.plot_area.querySelector("img")!;
        img.src = "data:image/png;base64," + msg.content.data["image/png"];
      }
    } else if (msg_type === "status" || msg_type === "execute_input") {
      // Swallow these JupyterLab-specific messages
    } else {
      handle_error_or_stdout_stderr(state, msg);
    }
  };

  const on_shell_reply = (_msg: CellMessage) => {
    if (state.outstanding_kernel_request_time == request_time) {
      state.outstanding_kernel_request_time = undefined;
    }

    // In case there was a change in the meantime
    redraw_cell(state, true);
  }

  // cell.kernel.execute(code_executing + postfix, callbacks, {
  //   silent: false,
  //   store_history: false,
  //   stop_on_error: true,
  //   cell: cell, // For our nbextension to know which cell is executing, even though we're not executing the cell's code exactly
  //   doesnt_need_snp_show_ui: true, // Tell the exention not to add another show_ui
  // });

  kernel_execute(code_executing, postfix, on_iopub_output, on_shell_reply, state);
}


// Handle Notebooks v6 and JupyterLab.
// Also tell the extension not to add the snp.show_ui call, presumably it is in postfix.
function kernel_execute(
  code_executing: string,
  postfix: string,
  on_iopub_output: (msg: CellMessage) => void,
  on_shell_reply:  (msg: CellMessage) => void,
  state: State
) {
  const cell = state.cell;
  if (cell.kernel) { // Notebooks v6
    const callbacks: CellCallbacks = cell.get_callbacks();

    callbacks.iopub!.output = on_iopub_output;
    callbacks.shell!.reply  = on_shell_reply

    // If we add an explicit show_ui, the notebook extension will not re-add it again
    cell.kernel.execute(code_executing + postfix, callbacks, {
      silent: false,
      store_history: false,
      stop_on_error: true,
      cell: cell, // For our nbextension to know which cell is executing, even though we're not executing the cell's code exactly, the nbextension will then remove this field because it's wasteful and causes 'message too large' crashes if the cell gets serialized and sent to python
      doesnt_need_snp_show_ui: true, // Tell the exention not to add another show_ui
    });
  } else { // JupyterLab
    // Based on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/cells/src/widget.ts#L1692
    // and, more importantly, on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/outputarea/src/widget.ts#L878

    const jl_cell = cell.jupyterlab_cell;

    if (!jl_cell) {
      throw new Error("snp kernel_execute jupyterlab: cell should have a backing JupyterLab cell!");
    }

    const metadata = {
      ...jl_cell.model.metadata,
      cellId: jl_cell.model.sharedModel.getId(),
      doesnt_need_snp_show_ui: true, // Tell the labexention not to add another show_ui
    };

    const kernel = jl_cell.parent.parent.sessionContext.session?.kernel;

    if (!kernel) {
      throw new Error('snp kernel_execute jupyterlab: Session has no kernel.');
    }

    console.log("Executing");
    const future = kernel.requestExecute({
      code: code_executing + postfix,
      silent: false,
      store_history: false,
      stop_on_error: true,
    }, false, metadata);

    // Based on https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/outputarea/src/widget.ts#L678
    future.onIOPub = on_iopub_output;
    future.onReply = on_shell_reply;
  }
}


// Run code in the kernel purely for its stdout, resolving with the captured text. The output
// goes to our own iopub callback and is never written into the notebook's saved output, so
// this is how we pull server-only data into JS without persisting it. Rejects on a kernel
// error (e.g. the code raised).
export function kernel_eval_stdout(code: string, state: State): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let errored: Error | undefined = undefined;
    const on_iopub_output = (msg: any) => {
      const msg_type = msg.header.msg_type;
      if (msg_type === "stream") stdout += msg.content.text;
      else if (msg_type === "error") errored = new Error((msg.content.evalue as string) || "kernel error");
    };
    const on_shell_reply = () => { errored ? reject(errored) : resolve(stdout); };
    kernel_execute(code, "", on_iopub_output, on_shell_reply, state);
  });
}


// The server's LLM API keys live in the kernel's environment (snp.py reads them from env
// vars). We deliberately do NOT bake them into a cell's saved _repr_html_ — that would leak
// them into any shared .ipynb. Instead we fetch them from the kernel at runtime, once per
// page (cached on window, since each cell output re-runs its own copy of this bundle in its
// own module scope). A notebook user with kernel access can read these env vars anyway;
// keeping them out of the saved file is the whole point. On failure we resolve to {} and drop
// the cache so the next AI interaction retries.
export function fetch_server_llm_keys(state: State): Promise<LLMApiKeys> {
  const w = window as any;
  if (w.__plottery_server_llm_keys) return w.__plottery_server_llm_keys as Promise<LLMApiKeys>;

  // Local (not module-level): a top-level `const` would land in page-global scope and break
  // re-injection on the next cell run — see AGENTS.md "No Outer-Level consts in Typescript".
  const sentinel = "__PLOTTERY_LLM_KEYS__"; // prefixed to the JSON so we can find our stdout line

  const code =
`import snp as _snp
print(${JSON.stringify(sentinel)} + _snp.llm_api_keys_json())`;

  const promise = kernel_eval_stdout(code, state).then(stdout => {
    const line = stdout.split("\n").find(l => l.startsWith(sentinel));
    if (!line) throw new Error("plottery: no server-key line in kernel output");
    return JSON.parse(line.slice(sentinel.length)) as LLMApiKeys;
  }).catch(err => {
    console.warn("plottery: couldn't fetch server LLM keys from kernel", err);
    w.__plottery_server_llm_keys = undefined; // let the next call retry
    return {} as LLMApiKeys;
  });

  w.__plottery_server_llm_keys = promise;
  return promise;
}



// const cellId = { cellId: model.sharedModel.getId() };
//     metadata = {
//       ...model.metadata,
//       ...metadata,
//       ...cellId
//     };
// const msgPromise = OutputArea.execute(
//   code,
//   cell.outputArea,
//   sessionContext,
//   metadata
// );
// future = cell.outputArea.future;
// const msg = (await msgPromise)!;

// export async function execute(
//   code: string,
//   output: OutputArea,
//   sessionContext: ISessionContext,
//   metadata?: JSONObject
// ): Promise<KernelMessage.IExecuteReplyMsg | undefined> {
//   // Override the default for `stop_on_error`.
//   let stopOnError = true;
//   if (
//     metadata &&
//     Array.isArray(metadata.tags) &&
//     metadata.tags.indexOf('raises-exception') !== -1
//   ) {
//     stopOnError = false;
//   }
//   const content: KernelMessage.IExecuteRequestMsg['content'] = {
//     code,
//     stop_on_error: stopOnError
//   };

//   const kernel = sessionContext.session?.kernel;
//   if (!kernel) {
//     throw new Error('Session has no kernel.');
//   }
//   const future = kernel.requestExecute(content, false, metadata);
//   output.future = future;
//   return future.done;
// }



// value.onIOPub = this._onIOPub;

//     // Handle the execute reply.
//     value.onReply = this._onExecuteReply;

//     // Handle stdin.
//     value.onStdin = msg => {
//       if (KernelMessage.isInputRequestMsg(msg)) {
//         this.onInputRequest(msg, value);
//       }
//     };