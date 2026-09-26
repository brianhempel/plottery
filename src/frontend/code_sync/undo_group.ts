import { State } from "../types";

// Continuous GUI interactions (dragging a shape on the plot, scrubbing a slider, dragging
// around a color picker, typing in an on-plot text box) rewrite the cell's code on every
// animation frame. An "undo group" folds all of those writes into a single undo step, so
// one Ctrl/Cmd-Z returns the code to what it was before the interaction.
//
// Notebook v6 (CodeMirror 5): code writes during a group use an origin starting with "*",
// which CM5 always merges into the previous history event of the same origin, and
// changeGeneration(true) closes the history event at both ends of the group.
//
// JupyterLab / Notebook 7: cell undo is the Yjs UndoManager on the cell's shared model (not
// CodeMirror 6's history), which merges changes that arrive within captureTimeout (500ms) of
// each other. For the duration of the group we stretch that to Infinity, and stopCapturing()
// at both ends so the group doesn't merge with neighboring edits.

export type UndoGroup = {
  pending_close: number | undefined; // requestAnimationFrame id
  saved_capture_timeout: number | undefined;
};

type YjsUndoManager = { captureTimeout: number; stopCapturing(): void };

// The group lives on the code mirror object so it is per-cell and survives rerenders (new
// State objects) that happen mid-interaction.
function current_group(state: State): UndoGroup | undefined {
  return (state.cell.code_mirror as any).plottery_undo_group;
}

function set_current_group(state: State, group: UndoGroup | undefined) {
  (state.cell.code_mirror as any).plottery_undo_group = group;
}

function yjs_undo_manager(state: State): YjsUndoManager | undefined {
  return (state.cell.jupyterlab_cell?.model.sharedModel as any)?.undoManager ?? undefined;
}

// Origin to pass to replaceRange for code writes, so CM5 merges them into the open group.
// (The CM6 wrapper ignores the origin; Yjs merges by time instead.)
export function undo_group_origin(state: State): string | undefined {
  return current_group(state) ? "*plottery-undo-group" : undefined;
}

// Returns the group, to pass to end_undo_group.
export function begin_undo_group(state: State): UndoGroup {
  // A new interaction starting while the previous one's close is still pending (or never
  // ended) closes the old group first rather than nesting.
  if (current_group(state)) close_undo_group(state);

  const undo_manager = yjs_undo_manager(state);
  const group: UndoGroup = { pending_close: undefined, saved_capture_timeout: undo_manager?.captureTimeout };
  if (state.cell.jupyterlab_cell) {
    if (undo_manager) {
      undo_manager.stopCapturing();
      undo_manager.captureTimeout = Infinity;
    }
  } else {
    (state.cell.code_mirror as any).changeGeneration(true);
  }
  set_current_group(state, group);
  return group;
}

// No-op if `group` was already closed (e.g. superseded by a newer interaction's group).
export function end_undo_group(state: State, group: UndoGroup) {
  if (current_group(state) !== group || group.pending_close !== undefined) return;
  // The code sync loop (add_sync_code_on_change_watcher) writes the interaction's final value
  // on the next animation frame, so wait for that write before closing the group.
  group.pending_close = requestAnimationFrame(() => {
    group.pending_close = requestAnimationFrame(() => close_undo_group(state));
  });
}

function close_undo_group(state: State) {
  const group = current_group(state);
  if (!group) return;
  if (group.pending_close !== undefined) cancelAnimationFrame(group.pending_close);
  set_current_group(state, undefined);

  if (state.cell.jupyterlab_cell) {
    const undo_manager = yjs_undo_manager(state);
    if (undo_manager) {
      undo_manager.captureTimeout = group.saved_capture_timeout ?? 500;
      undo_manager.stopCapturing();
    }
  } else {
    (state.cell.code_mirror as any).changeGeneration(true);
  }
}

// Undo groups for the widget interactions that write code continuously. (On-plot shape drags
// are grouped in attach_events_to_hover_regions.) Delegated on plottery_outer so it covers widgets
// that are created and replaced after this runs.
export function attach_undo_groups_to_continuous_inputs(state: State) {
  const outer = state.plottery_outer;

  // Slider scrubs: from pointer down on a range input until the pointer is released anywhere.
  outer.addEventListener("pointerdown", evt => {
    const target = evt.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "range") return;
    const group = begin_undo_group(state);
    const on_release = () => {
      document.removeEventListener("pointerup", on_release, true);
      document.removeEventListener("pointercancel", on_release, true);
      end_undo_group(state, group);
    };
    document.addEventListener("pointerup", on_release, true);
    document.addEventListener("pointercancel", on_release, true);
  }, true);

  // Color picker: the native picker fires `input` continuously while open and `change` when
  // it closes with a new value. `change` doesn't fire if the color ends up back where it
  // started, so also close the group after a pause, so it can't stay open indefinitely
  // (which, under JupyterLab, would swallow later typing into the same undo step).
  let color_group: UndoGroup | undefined;
  let color_idle_timer: number | undefined;
  const end_color_group = () => {
    window.clearTimeout(color_idle_timer);
    if (color_group) { end_undo_group(state, color_group); color_group = undefined; }
  };
  outer.addEventListener("input", evt => {
    const target = evt.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "color") return;
    color_group ||= begin_undo_group(state);
    window.clearTimeout(color_idle_timer);
    color_idle_timer = window.setTimeout(end_color_group, 1000);
  }, true);
  outer.addEventListener("change", evt => {
    const target = evt.target;
    if (target instanceof HTMLInputElement && target.type === "color") end_color_group();
  }, true);

  // On-plot text box: one undo step per editing session (focus to blur), like typing
  // directly in the code editor.
  let text_box_group: UndoGroup | undefined;
  outer.addEventListener("focusin", evt => {
    if (evt.target instanceof HTMLElement && evt.target.classList.contains("plot-widget-input")) text_box_group = begin_undo_group(state);
  });
  outer.addEventListener("focusout", evt => {
    if (text_box_group && evt.target instanceof HTMLElement && evt.target.classList.contains("plot-widget-input")) {
      end_undo_group(state, text_box_group);
      text_box_group = undefined;
    }
  });
}
