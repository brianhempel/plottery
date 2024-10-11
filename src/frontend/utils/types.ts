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
};

// https://github.com/jupyterlab/jupyterlab/blob/main/packages/cells/src/widget.ts#L193
export type JupyterLabCell = {
  id: string;

  editor: { editor: CM6Editor } | null;

  // The below are things we monkey-patch on in attach_snp
  code_mirror: CodeMirror.DocOrEditor;
};

export type JupyterLabCodeCell = {
  // execute(cell: CodeCell, sessionContext: ISessionContext, metadata?: JSONObject): Promise<KernelMessage.IExecuteReplyMsg | void>;
}


// https://codemirror.net/docs/migration/#positions
// CodeMirror 6 the first line has number 1, whereas CodeMirror 5 lines started at 0.
function cm5_pos_to_offset(doc: CM6Doc, pos: CodeMirror.Position): number {
  return doc.line(pos.line + 1).from + pos.ch
}
function offset_to_cm5_pos(doc: CM6Doc, offset: number) : CodeMirror.Position {
  let line = doc.lineAt(offset)
  return {line: line.number - 1, ch: offset - line.from}
}

// These are globally exposed by our extension in snp_jupyter/snp_jupyter.js
declare const __CM6StateEffect: any;
declare const __CM6StateField: any;
declare const __CM6EditorView: any;
declare const __CM6Decoration: any

type CM5Mark = {
  mark_id: number;
  clear: () => void;
  find: () => CodeMirror.MarkerRange | undefined;
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
}
type CM5Mock = {
  getValue: () => string;
  getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => string;
  getLine: (line: number) => string;
  replaceRange: (text: string, from: CodeMirror.Position, to: CodeMirror.Position) => void;
  setValue: (text: string) => void;
  setCursor: (pos: CodeMirror.Position, options: { scroll: boolean }) => void;
  posFromIndex: (index: number) => CodeMirror.Position;
  focus: () => void;
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
  length: number;
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
  const cm6doc = cm6.state.doc;

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
  // START HERE don't add if it already exists
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
    getValue: () => (cm6 as any).state.doc.toString(),

    getRange: (from: CodeMirror.Position, to: CodeMirror.Position) => {
      const from_offset = cm5_pos_to_offset(cm6doc, from);
      const to_offset = cm5_pos_to_offset(cm6doc, to);
      return (cm6 as any).state.sliceDoc(from_offset, to_offset)
    },

    getLine: (line: number) => cm6doc.line(line + 1).text,

    replaceRange: (text: string, from: CodeMirror.Position, to: CodeMirror.Position) => {
      const from_offset = cm5_pos_to_offset(cm6doc, from);
      const to_offset = cm5_pos_to_offset(cm6doc, to);
      return cm6.dispatch({
        changes: {from: from_offset, to: to_offset, insert: text}
      });
    },

    setValue: (text: string) => {
      return cm6.dispatch({
        changes: {from: 0, to: cm6.state.doc.length, insert: text}
      });
    },

    setCursor: (pos: CodeMirror.Position, options: { scroll: boolean }) => {
      return cm6.dispatch({selection: {anchor: cm5_pos_to_offset(cm6doc, pos), scrollIntoView: options.scroll}});
    },

    posFromIndex : (index: number) => {
      return offset_to_cm5_pos(cm6doc, index);
    },

    focus: cm6.focus,

    markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: { inclusiveLeft: boolean, inclusiveRight: boolean, clearWhenEmpty: boolean }) => {
      // In our usage, clearWhenEmpty is always false, so don't bother supporting it
      if (options.clearWhenEmpty) {
        throw new Error("snp: clearWhenEmpty is not supported in our hacky monkey-patch of CodeMirror 6")
      }
      const from_offset = cm5_pos_to_offset(cm6doc, from);
      const to_offset = cm5_pos_to_offset(cm6doc, to);

      const mark_id = mark_id_counter;
      mark_id_counter += 1;

      const cm5_mark: CM5Mark = {
        mark_id: mark_id,
        clear: () => {
          cm6.dispatch({ effects: filter_marks.of((_from: number, _to: number, value: any) => value.spec.mark_id !== mark_id) })
        },
        find: () => {
          const cm6_mark = all_cm6_marks().find(({ value: deco }) => deco.spec.mark_id === mark_id)
          if (cm6_mark) {
            const range: CodeMirror.MarkerRange = {
              from: offset_to_cm5_pos(cm6doc, cm6_mark.from),
              to:   offset_to_cm5_pos(cm6doc, cm6_mark.to),
            }
            return range;
          } else {
            return undefined;
          }
        }
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

type JupyterLabSessionContext = {}

// https://github.com/jupyterlab/jupyterlab/blob/main/packages/cells/src/widget.ts#L1703
export type JupyterCodeCellModule = {
  execute(cell: JupyterLabCodeCell, sessionContext: JupyterLabSessionContext, metadata?: any): Promise<any | void>;
}



export type JupyterLabNotebookModel = {
  sharedModel: JupyterLabNotebookSharedModel;
};

export type JupyterLabNotebookSharedModel = {
  cells: JupyterLabSharedCell[];
};

export type JupyterLabSharedCell = JupyterLabSharedCodeCell | JupyterLabOtherCell;

export type JupyterLabSharedCodeCell = {
  cell_type: "code";
  id: string;
  getId(): string;
  source: string;
  getSource(): string;
  setSource(value: string): void;
  updateSource(start: number, end: number, value?: string): void; // start and end are indices
};

export type JupyterLabOtherCell = {}; // markdown, raw, etc.

export function jupyterlab_cell_to_notebook_v6_cell(jl_cell: JupyterLabCell): Cell {

  // START HERE fill in the shim for Cell
  const cell: Cell = {

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
  kernel: any;

  jupyterlab_cell: JupyterLabCell | undefined; // if a wrapper for a JupyterLab cell, this will be present.
};

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
