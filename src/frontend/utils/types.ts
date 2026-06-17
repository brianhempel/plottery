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
type CM5Mock = {
  getValue: () => string;
  getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => string;
  getLine: (line: number) => string;
  replaceRange: (text: string, from: CodeMirror.Position, to?: CodeMirror.Position) => void;
  setValue: (text: string) => void;
  setCursor: (line: number, ch: number, options: { scroll: boolean }) => void;
  posFromIndex: (index: number) => CodeMirror.Position;
  indexFromPos: (pos: CodeMirror.Position) => number;
  focus: (options?: { preventScroll: boolean }) => void;
  markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: { inclusiveLeft: boolean, inclusiveRight: boolean, clearWhenEmpty: boolean }) => CM5Mark;
  getAllMarks: () => CM5Mark[];

  // for debugging
  cm6: CM6Editor;
  all_cm6_marks: () => { from: number, to: number, value: any }[];
}

// https://codemirror.net/docs/migration/
type CM6Editor = {
  state: {
    doc: CM6Doc;
    field: (field: any) => any;
  };
  dispatch: (transaction: any) => void;
  focus: () => void;
};
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
  const cm6doc = cm6.state.doc; // DO NOT USE THIS. USE cm6.state.doc every time to make sure you're getting the latest version.

  // Marks based on https://codemirror.net/docs/migration/#marked-text

  // The __CM6StateEffect, __CM6StateField, __CM6EditorView, and __CM6Decoration classes are globally exposed by our extension in snp_jupyter/snp_jupyter.js

  const add_marks    = __CM6StateEffect.define()
  const filter_marks = __CM6StateEffect.define()

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

  // Add the extension
  cm6.dispatch({ effects: __CM6StateEffect.appendConfig.of(mark_handler) });

  function all_cm6_marks() : { from: number, to: number, value: CM6Deco }[] {
    let cm6_marks: any[] = [];
    cm6.state.field(mark_handler).between(0, cm6.state.doc.length, (from: number, to: number, deco: any) => {
      cm6_marks.push({ from, to, value: deco });
    });
    return cm6_marks;
  }

  let mark_id_counter = 1;

  const cm5: CM5Mock = {
    getValue: () => cm6.state.doc.toString(),

    getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => {
      const from_offset = cm5_pos_to_offset(cm6.state.doc, from);
      const to_offset = cm5_pos_to_offset(cm6.state.doc, to);
      return (cm6 as any).state.sliceDoc(from_offset, to_offset)
    },

    getLine: (line: number) => cm6.state.doc.line(line + 1).text,

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

    setCursor: (line: number, ch: number, options: { scroll: boolean }) => {
      return cm6.dispatch({selection: {anchor: cm5_pos_to_offset(cm6.state.doc, { line, ch }), scrollIntoView: options.scroll}});
    },

    posFromIndex : (index: number) => {
      return offset_to_cm5_pos(cm6.state.doc, index);
    },

    indexFromPos: (pos: CodeMirror.Position) => {
      return cm5_pos_to_offset(cm6.state.doc, pos);
    },

    focus: () => cm6.focus.apply(cm6),

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
      const deco_mark: CM6Mark = __CM6Decoration.mark({
        inclusiveStart: options.inclusiveLeft,
        inclusiveEnd:   options.inclusiveRight,
        mark_id: mark_id,
        cm5_mark: cm5_mark,
      }).range(from_offset, to_offset);

      cm6.dispatch({ effects: add_marks.of([deco_mark]) })

      return cm5_mark;
    },

    getAllMarks: () => {
      return all_cm6_marks().map(({ value: deco }) => deco.spec.cm5_mark);
    },

    // for debugging:
    cm6,
    all_cm6_marks,
  };

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
