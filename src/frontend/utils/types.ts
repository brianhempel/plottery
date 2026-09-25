import CodeMirror from "./codemirror"; // Codemirror 5 for Notebooks v6
// For JupyterLab's CodeMirror 6, otoh...ugh


// Global Jupyter or IPython object for Notebooks v6
export type JupyterType = {
  notebook: Notebook;
};

export type Notebook = {
  get_cells: () => Cell[];
};



export type JupyterLabNotebookPanel = {
  content: JupyterLabNotebook;
  sessionContext: JupyterLabSessionContext;
};

export type JupyterLabNotebook = {
  model: JupyterLabNotebookModel;
  cellsArray: JupyterLabCell[];
  parent: JupyterLabNotebookPanel;
  // Present when windowingMode is contentVisibility / full / defer (Notebook v7 + JupyterLab).
  viewModel?: {
    setEstimatedWidgetSize: (cellId: string, size: number | null) => void;
  };
};

// https://github.com/jupyterlab/jupyterlab/blob/main/packages/cells/src/widget.ts#L193
export type JupyterLabCell = {
  id: string;

  editor: { editor: CM6Editor } | null;

  node: HTMLElement;

  model: {
    sharedModel: JupyterLabSharedCell,
    metadata: any;
  };

  parent: JupyterLabNotebook;
};

export type JupyterLabCodeCell = {
  // execute(cell: CodeCell, sessionContext: ISessionContext, metadata?: JSONObject): Promise<KernelMessage.IExecuteReplyMsg | void>;
}


// https://codemirror.net/docs/migration/#positions
// CodeMirror 6 the first line has number 1, whereas CodeMirror 5 lines started at 0.
function cm5_pos_to_offset(doc: CM6Doc, pos: CodeMirror.Position): number {
  // CM5 is sometimes robust to positions after the end of the document, whereas CM6 errors.
  if (pos.line + 1 > doc.lines) {
    return doc.length;
  }
  const cm6_lineno = pos.line + 1;
  // console.log("doc", cm6_lineno)
  // console.log("cm6_lineno", cm6_lineno)
  const line = doc.line(cm6_lineno);
  let cm6_ch = Math.min(pos.ch, line.length);
  return line.from + cm6_ch
}
function offset_to_cm5_pos(doc: CM6Doc, offset: number) : CodeMirror.Position {
  let line = doc.lineAt(offset)
  return {line: line.number - 1, ch: offset - line.from}
}

// These are globally exposed by our extension in snp_jupyter/snp_jupyter.js
// They should already be on window, but this makes them available but undefined if they're not.
declare const __CM6StateEffect: any;
(window as any).__CM6StateEffect  ||= (window as any).__CM6StateEffect
declare const __CM6StateField: any;
(window as any).__CM6StateField  ||= (window as any).__CM6StateField
declare const __CM6EditorView: any;
(window as any).__CM6EditorView  ||= (window as any).__CM6EditorView
declare const __CM6Decoration: any;
(window as any).__CM6Decoration  ||= (window as any).__CM6Decoration

type CM5Mark = {
  mark_id: number;
  clear: () => void;
  find: () => CodeMirror.MarkerRange | undefined;
  find_cm6_mark?: () => CM6Mark | undefined;  // debugging
  inclusiveLeft: boolean;
}
type CM6Mark = {
  from: number;
  to: number;
  value: CM6Deco;
}
type CM6Deco = {
  spec: {
    mark_id: number;
    cm5_mark: CM5Mark;
  }
  startSide: number;
}
type CM5LineHandle = CodeMirror.LineHandle & {
  lineNo: number;
}
type CM5EventHandler = (...args: any[]) => void;
type CM5Mock = {
  getValue: () => string;
  getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => string;
  getLine: (line: number) => string;
  lineCount: () => number;
  firstLine: () => number;
  lastLine: () => number;
  getLineHandle: (num: number) => CM5LineHandle;
  getLineNumber: (handle: CM5LineHandle) => number | null;
  eachLine: {
    (f: (line: CM5LineHandle) => void): void;
    (start: number, end: number, f: (line: CM5LineHandle) => void): void;
  };
  replaceRange: (text: string, from: CodeMirror.Position, to?: CodeMirror.Position) => void;
  setValue: (text: string) => void;
  getCursor: (start?: string) => CodeMirror.Position;
  setCursor: (line: number, ch: number, options: { scroll: boolean }) => void;
  somethingSelected: () => boolean;
  on: (eventName: string, handler: CM5EventHandler) => void;
  off: (eventName: string, handler: CM5EventHandler) => void;
  addLineClass: (line: number | CM5LineHandle, where: string, className: string) => CM5LineHandle;
  removeLineClass: (line: number | CM5LineHandle, where: string, className?: string) => CM5LineHandle;
  getScrollerElement: () => HTMLElement;
  scrollIntoView: (pos: CodeMirror.Position | { from: CodeMirror.Position, to: CodeMirror.Position }, margin?: number) => void;
  posFromIndex: (index: number) => CodeMirror.Position;
  indexFromPos: (pos: CodeMirror.Position) => number;
  focus: (options?: { preventScroll: boolean }) => void;
  markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: { inclusiveLeft: boolean, inclusiveRight: boolean, clearWhenEmpty: boolean }) => CM5Mark;
  getAllMarks: () => CM5Mark[];
  clear_all_marks: () => void;

  // for debugging
  cm6: CM6Editor;
  all_cm6_marks: () => { from: number, to: number, value: any }[];
}

// https://codemirror.net/docs/migration/
type CM6Editor = {
  state: {
    doc: CM6Doc;
    field: (field: any) => any;
    selection: CM6Selection;
  };
  dispatch: (transaction: any) => void;
  focus: () => void;
  scrollDOM: HTMLElement; // the .cm-scroller element
};
type CM6Selection = {
  main: CM6SelectionRange;
  ranges: CM6SelectionRange[];
}
type CM6SelectionRange = {
  from: number;
  to: number;
  anchor: number;
  head: number;
  empty: boolean;
}
type CM6Doc = {
  lineAt(pos: number): CM6Line;
  line(n: number): CM6Line;
  lines: number;
  length: number;
  toString(): string;
}
// https://codemirror.net/docs/ref/#state.Line
type CM6Line = {
  from: number; // The position of the start of the line.
  to: number; // The position at the end of the line (before the line break, or at the end of document for the last line).
  number: number; // This line's line number (1-based).
  text: string; // The line's content.
  length: number; // The length of the line (not including any line break after it)
}

// Returns an object that imitates the CodeMirror 5 API, but is backed by CodeMirror 6
export function monkey_patch_codemirror5_on_codemirror6(cm6: CM6Editor): CodeMirror.DocOrEditor {
  if ((cm6 as any).__plottery_cm5_facade) {
    return (cm6 as any).__plottery_cm5_facade;
  }

  // Marks based on https://codemirror.net/docs/migration/#marked-text

  // The __CM6StateEffect, __CM6StateField, __CM6EditorView, and __CM6Decoration classes are globally exposed by our extension in snp_jupyter/snp_jupyter.js

  const add_marks    = __CM6StateEffect.define()
  const filter_marks = __CM6StateEffect.define()
  const add_line_classes    = __CM6StateEffect.define()
  const filter_line_classes = __CM6StateEffect.define()
  const cursor_activity_handlers = new Set<CM5EventHandler>();
  let cm5: CM5Mock;

  // From https://codemirror.net/docs/migration/#marked-text
  const mark_handler = __CM6StateField.define({
    // Start with an empty set of decorations
    create() { return __CM6Decoration.none },

    // This is called whenever the editor updates—it computes the new set
    update(value: any, tr: any) {

      // Move the decorations to account for document changes
      value = value.map(tr.changes)

      // If this transaction adds or removes decorations, apply those changes
      for (let effect of tr.effects) {
        if (effect.is(add_marks)) {
          value = value.update({ add: effect.value, sort: true })
        }
        else if (effect.is(filter_marks)) {
          value = value.update({ filter: effect.value })
        }
      }

      return value
    },
    // Indicate that this field provides a set of decorations
    provide: (f: any) => __CM6EditorView.decorations.from(f)
  })

  const line_class_handler = __CM6StateField.define({
    create() { return __CM6Decoration.none },

    update(value: any, tr: any) {
      value = value.map(tr.changes)

      for (let effect of tr.effects) {
        if (effect.is(add_line_classes)) {
          value = value.update({ add: effect.value, sort: true })
        }
        else if (effect.is(filter_line_classes)) {
          value = value.update({ filter: effect.value })
        }
      }

      return value
    },

    provide: (f: any) => __CM6EditorView.decorations.from(f)
  })

  const cursor_activity_handler = __CM6EditorView.updateListener.of((update: any) => {
    if (update.selectionSet) {
      cursor_activity_handlers.forEach(handler => handler(cm5));
    }
  });

  // Add the extension
  cm6.dispatch({ effects: __CM6StateEffect.appendConfig.of([mark_handler, line_class_handler, cursor_activity_handler]) });

  function all_cm6_marks() : { from: number, to: number, value: CM6Deco }[] {
    let cm6_marks: any[] = [];
    cm6.state.field(mark_handler).between(0, cm6.state.doc.length, (from: number, to: number, deco: any) => {
      cm6_marks.push({ from, to, value: deco });
    });
    return cm6_marks;
  }

  let mark_id_counter = 1;

  function line_handle(line_no: number): CM5LineHandle {
    return {
      text: cm6.state.doc.line(line_no + 1).text,
      lineNo: line_no,
      on: () => {},
      off: () => {},
    };
  }

  function line_number(line: number | CM5LineHandle): number {
    return typeof line === "number" ? line : line.lineNo;
  }

  cm5 = {
    getValue: () => cm6.state.doc.toString(),

    getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => {
      const from_offset = cm5_pos_to_offset(cm6.state.doc, from);
      const to_offset = cm5_pos_to_offset(cm6.state.doc, to);
      return (cm6 as any).state.sliceDoc(from_offset, to_offset)
    },

    getLine: (line: number) => cm6.state.doc.line(line + 1).text,

    lineCount: () => cm6.state.doc.lines,

    firstLine: () => 0,

    lastLine: () => cm6.state.doc.lines - 1,

    getLineHandle: line_handle,

    getLineNumber: (handle: CM5LineHandle) => {
      return handle.lineNo < cm6.state.doc.lines ? handle.lineNo : null;
    },

    eachLine: ((startOrF: number | ((line: CM5LineHandle) => void), end?: number, f?: (line: CM5LineHandle) => void) => {
      const start = typeof startOrF === "number" ? startOrF : 0;
      const stop = typeof startOrF === "number" ? end! : cm6.state.doc.lines;
      const callback = typeof startOrF === "number" ? f! : startOrF;

      for (let line_no = start; line_no < stop; line_no++) {
        callback(line_handle(line_no));
      }
    }) as CM5Mock["eachLine"],

    replaceRange: (text: string, from: CodeMirror.Position, to?: CodeMirror.Position) => {
      const from_offset = cm5_pos_to_offset(cm6.state.doc, from);
      const to_offset = cm5_pos_to_offset(cm6.state.doc, to || from);
      // console.log("replaceRange", from_offset, to_offset, text);
      // console.log("doc", cm6.state.doc.toString());
      return cm6.dispatch({
        changes: {from: from_offset, to: to_offset, insert: text}
      });
    },

    setValue: (text: string) => {
      return cm6.dispatch({
        changes: {from: 0, to: cm6.state.doc.length, insert: text, addToHistory: true}
      });
    },

    getCursor: (start?: string) => {
      const selection = cm6.state.selection.main;
      let offset = selection.head;
      if (start === "from") {
        offset = selection.from;
      } else if (start === "to") {
        offset = selection.to;
      } else if (start === "anchor") {
        offset = selection.anchor;
      }

      return offset_to_cm5_pos(cm6.state.doc, offset);
    },

    setCursor: (line: number, ch: number, options: { scroll: boolean }) => {
      return cm6.dispatch({selection: {anchor: cm5_pos_to_offset(cm6.state.doc, { line, ch }), scrollIntoView: options.scroll}});
    },

    somethingSelected: () => {
      return cm6.state.selection.ranges.some(range => !range.empty);
    },

    on: (eventName: string, handler: CM5EventHandler) => {
      if (eventName === "cursorActivity") {
        cursor_activity_handlers.add(handler);
      }
    },

    off: (eventName: string, handler: CM5EventHandler) => {
      if (eventName === "cursorActivity") {
        cursor_activity_handlers.delete(handler);
      }
    },

    getScrollerElement: () => cm6.scrollDOM,

    scrollIntoView: (pos: CodeMirror.Position | { from: CodeMirror.Position, to: CodeMirror.Position }, _margin?: number) => {
      // Scroll ONLY the editor's own scroller so the target line lands near the
      // bottom of the code box (with a couple of lines of context below it),
      // without moving the cursor/selection. If the line is already fully visible
      // (e.g. the user just clicked it in the editor), don't scroll at all.
      //
      // We deliberately avoid EditorView.scrollIntoView here: it scrolls every
      // scrollable ancestor (including the page/viewport) to reveal the position,
      // and its y:"end" didn't reliably bottom-align. Instead we set
      // scrollDOM.scrollTop directly. lineBlockAt reads CM6's height map, so it
      // works even for lines outside the currently-rendered viewport; documentTop
      // maps document coordinates into the scroller's scroll space.
      const LINES_BELOW = 2; // leave the selected line as the third-to-last line.
      const view = cm6 as any;
      const from_pos = "from" in pos ? pos.from : pos;
      const from_offset = cm5_pos_to_offset(cm6.state.doc, from_pos);
      const scroller = cm6.scrollDOM;
      const scroller_rect = scroller.getBoundingClientRect();
      const block = view.lineBlockAt(from_offset);
      const line_screen_top = view.documentTop + block.top;
      const line_screen_bottom = view.documentTop + block.bottom;
      const already_visible =
        line_screen_top >= scroller_rect.top && line_screen_bottom <= scroller_rect.bottom;
      if (already_visible) return;
      const content_top_in_scroller =
        view.documentTop - scroller_rect.top + scroller.scrollTop;
      const line_bottom_in_scroller = content_top_in_scroller + block.bottom;
      scroller.scrollTop =
        line_bottom_in_scroller + LINES_BELOW * view.defaultLineHeight - scroller.clientHeight; // browser clamps <0.
    },

    posFromIndex : (index: number) => {
      return offset_to_cm5_pos(cm6.state.doc, index);
    },

    indexFromPos: (pos: CodeMirror.Position) => {
      return cm5_pos_to_offset(cm6.state.doc, pos);
    },

    focus: () => cm6.focus.apply(cm6),

    addLineClass: (line: number | CM5LineHandle, where: string, className: string) => {
      const line_no = line_number(line);
      const cm6_line = cm6.state.doc.line(line_no + 1);
      const deco = __CM6Decoration.line({
        class: className,
        cm5_where: where,
        cm5_class_name: className,
      }).range(cm6_line.from);

      cm6.dispatch({ effects: add_line_classes.of([deco]) });
      return line_handle(line_no);
    },

    removeLineClass: (line: number | CM5LineHandle, where: string, className?: string) => {
      const line_no = line_number(line);

      cm6.dispatch({
        effects: filter_line_classes.of((from: number, _to: number, value: any) => {
          const spec = value.spec || {};
          const deco_line_no = cm6.state.doc.lineAt(from).number - 1;
          return !(
            deco_line_no === line_no &&
            spec.cm5_where === where &&
            (className === undefined || spec.cm5_class_name === className)
          );
        })
      });

      return line_handle(line_no);
    },

    markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: { inclusiveLeft: boolean, inclusiveRight: boolean, clearWhenEmpty: boolean }) => {
      // In our usage, clearWhenEmpty is always false, so don't bother supporting it
      if (options.clearWhenEmpty) {
        throw new Error("snp: clearWhenEmpty is not supported in our hacky monkey-patch of CodeMirror 6")
      }
      const from_offset = cm5_pos_to_offset(cm6.state.doc, from);
      const to_offset = cm5_pos_to_offset(cm6.state.doc, to);

      const mark_id = mark_id_counter;
      mark_id_counter += 1;

      const find_cm6_mark = () => {
        return all_cm6_marks().find(({ value: deco }) => deco.spec.mark_id === mark_id)
      };

      const cm5_mark: CM5Mark = {
        mark_id: mark_id,
        clear: () => {
          cm6.dispatch({ effects: filter_marks.of((_from: number, _to: number, value: any) => value.spec.mark_id !== mark_id) })
        },
        find: () => {
          const cm6_mark = find_cm6_mark()
          if (cm6_mark) {
            const range: CodeMirror.MarkerRange = {
              from: offset_to_cm5_pos(cm6.state.doc, cm6_mark.from),
              to:   offset_to_cm5_pos(cm6.state.doc, cm6_mark.to),
            }
            return range;
          } else {
            return undefined;
          }
        },
        set inclusiveLeft(bool: boolean) {
          const cm6_mark = find_cm6_mark();
          if (cm6_mark) {
            if (bool === false) {
              cm6_mark.value.startSide = 500000000
            } else {
              cm6_mark.value.startSide = -1
            }
          }
        },
        find_cm6_mark, // debugging
      };

      // https://codemirror.net/docs/ref/#view.Decoration%5Emark
      const deco = __CM6Decoration.mark({
        inclusiveStart: options.inclusiveLeft,
        inclusiveEnd:   options.inclusiveRight,
        mark_id: mark_id,
        cm5_mark: cm5_mark,
      });
      // CM6's MarkDecoration.range() throws "Mark decorations may not be empty", but CM5 allows
      // empty marks (e.g. the params of a zero-arg `def f():`). RangeSets keep and map empty
      // ranges fine (an inclusive one grows to cover typed text, like CM5), so for empty marks
      // skip the check by calling the base RangeValue.range() that MarkDecoration overrides.
      const deco_mark: CM6Mark = from_offset < to_offset
        ? deco.range(from_offset, to_offset)
        : Object.getPrototypeOf(Object.getPrototypeOf(deco)).range.call(deco, from_offset, to_offset);

      cm6.dispatch({ effects: add_marks.of([deco_mark]) })

      return cm5_mark;
    },

    getAllMarks: () => {
      return all_cm6_marks().map(({ value: deco }) => deco.spec.cm5_mark);
    },

    // Drop ALL of our marks (and selected-layer line classes) in a single transaction.
    // getAllMarks().forEach(m => m.clear()) dispatches once per mark, and each dispatch
    // re-filters the whole decoration RangeSet — O(n^2) in the number of marks. This is one
    // O(n) filter dispatch. attach_snp calls it up front: the underlying CM6 editor persists
    // across cell reruns, so without clearing, every render's marks piled onto the previous
    // render's (only GUI hard_rerun cleared them), making each attach re-sort an ever-larger
    // set — attach time grew ~4s per manual rerun (7s -> 38s over 8 runs on a big cell).
    clear_all_marks: () => {
      cm6.dispatch({ effects: [filter_marks.of(() => false), filter_line_classes.of(() => false)] });
    },

    // for debugging:
    cm6,
    all_cm6_marks,
  };

  (cm6 as any).__plottery_cm5_facade = cm5;
  return (cm5 as any) as CodeMirror.DocOrEditor;
}


declare const __JupyterCodeCellModule: JupyterCodeCellModule | undefined;
(window as any).__JupyterCodeCellModule ||= (window as any).__JupyterCodeCellModule

type JupyterLabSessionContext = {
  session?: {
    kernel: {
      status: string;
      requestExecute: (
        content: {
          code: string;
          silent?: boolean;
          store_history?: boolean;
          user_expressions?: any;
          allow_stdin?: boolean;
          stop_on_error?: boolean;
        },
        disposeOnDone?: boolean,
        metadata?: any,
      ) => {
        onIOPub: (msg: CellMessage) => void;
        onReply: (msg: CellMessage) => void;
        done: Promise<any>;
      };
    }
  }
}

// https://github.com/jupyterlab/jupyterlab/blob/main/packages/cells/src/widget.ts#L1703
export type JupyterCodeCellModule = {
  execute(cell: JupyterLabCodeCell, sessionContext: JupyterLabSessionContext, metadata?: any): Promise<any | void>;
}

declare const __JupyterNotebookActionsModule: JupyterNotebookActionsModule | undefined;
(window as any).__JupyterNotebookActionsModule ||= (window as any).__JupyterNotebookActionsModule

// https://github.com/jupyterlab/jupyterlab/blob/v4.2.5/packages/notebook/src/actions.tsx#L579
type JupyterNotebookActionsModule = {
  runCells(notebook: JupyterLabNotebook, cells: JupyterLabCell[], sessionContext?: JupyterLabSessionContext): Promise<boolean>
}



export type JupyterLabNotebookModel = {
  sharedModel: JupyterLabNotebookSharedModel;
  cells: {
    changed: {
      connect: (slot: (sender: unknown, args: unknown) => void, context?: unknown) => void;
      disconnect: (slot: (sender: unknown, args: unknown) => void, context?: unknown) => void;
    };
  };
};

export type JupyterLabNotebookSharedModel = {
  cells: JupyterLabSharedCell[];
};

export type JupyterLabSharedCell = {
  cell_type: "code" | "raw" | "markdown";
  id: string;
  getId(): string;
  source: string;
  getSource(): string;
  setSource(value: string): void;
  updateSource(start: number, end: number, value?: string): void; // start and end are indices
};

export type JupyterLabOtherCell = {}; // markdown, raw, etc.

export function jupyterlab_cell_to_notebook_v6_cell(jl_cell: JupyterLabCell): Cell {

  if (jl_cell.model.sharedModel.cell_type !== "code") {
    throw new Error("jupyterlab_cell_to_notebook_v6_cell: we should only be given code cells");
  }

  if (!__JupyterNotebookActionsModule) {
    throw new Error("jupyterlab_cell_to_notebook_v6_cell: __JupyterNotebookActionsModule not found, it should have been set globally by the snp_jupyter.js lab extension");
  }

  const cell: Cell = {
    cell_type: jl_cell.model.sharedModel.cell_type,
    code_mirror: monkey_patch_codemirror5_on_codemirror6(jl_cell.editor!.editor),
    element: [jl_cell.node],
    get_text: () => jl_cell.model.sharedModel.source,
    get_callbacks: () => { throw new Error("snp: get_callbacks not implemented for JupyterLab cells, need to execute some other way") },
    execute: () => { __JupyterNotebookActionsModule.runCells(jl_cell.parent, [jl_cell], jl_cell.parent.parent.sessionContext); },
    kernel: undefined,
    jupyterlab_cell: jl_cell,
  };

  return cell;
}

export type Cell = {
  cell_type: string;

  code_mirror: CodeMirror.DocOrEditor;

  element: Array<HTMLElement>;

  get_text: () => string;
  get_callbacks: () => CellCallbacks;
  execute: (stop_on_error?: boolean) => void;
  kernel: Kernel | undefined;

  jupyterlab_cell: JupyterLabCell | undefined; // if a wrapper for a JupyterLab cell, this will be present.
};

export type Kernel = {
  _pending_messages: any[];
  last_msg_callbacks: undefined | { iopub_done: boolean };
  execute: (
    code: string,
    callbacks: CellCallbacks,
    options: { silent?: boolean, store_history?: boolean, stop_on_error?: boolean, user_expressions?: any } & ExecuteMetadataForTheNBExtension,
  ) => void;
};
type ExecuteMetadataForTheNBExtension = {
  cell?: Cell
  doesnt_need_snp_show_ui?: boolean
}

export type CellOutput = {
  output_type: string;
  execution_count: number;
  data: {
    "text/plain": string;
    "text/html": string;
    "image/svg+xml": string;
    "image/png": string;
    "application/json": {
      cell_lineno: number;
      provenance_is_off_by_n_lines: number;
    };
  };
};

// Cell callbacks from:
// https://github.com/thoth-station/jupyter-nbrequirements/blob/master/js/src/types/io.d.ts#L54
export interface CellCallbacks {
  iopub?: IOPubCallback;
  shell?: ShellCallback;
}

export interface IOPubCallback {
  output?: (msg: CellMessage) => any;
}

export interface ShellCallback {
  output?: (msg: CellMessage) => any;
  reply?: (msg: CellMessage) => any;
}

export interface CellMessage {
  buffers: null[] | null;
  channel: string;
  content: IOPubMessageContent;
  msg_id: string;
  msg_type: string;
  header: IOPubMessageHeader;
  parent_header: IOPubMessageHeader;
  metadata: Metadata;
}

export interface IOPubMessageContent {
  status: string;
  data: IOPubMessageData;
  name: string;
  text: string;
  metadata: any;
  execution_count?: number;
  ename?: string;
  evalue?: string;
  traceback?: string;
}

export interface IOPubMessageData {
  name: string;
  text: string;
  "text/plain": string;
  "image/png": string;
  "image/svg+xml": string;
  "application/json": string;
}

export interface IOPubMessageHeader {
  date: string;
  msg_id: string;
  msg_type: string;
  session: string;
  username: string;
  version: string;
}

export interface Metadata {
  [name: string]: any;
}
