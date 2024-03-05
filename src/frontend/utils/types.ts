import CodeMirror from "./codemirror";

export type JupyterType = {
  notebook: Notebook;
};

export type Notebook = {
  get_cells: () => Cell[];
};

export type Cell = {
  anchor: boolean;
  cell_id: string;
  cell_type: string;

  code_mirror: CodeMirror.DocOrEditor;

  metadata: {
    trusted: boolean;
    scrolled?: boolean;
  };
  source: string;
  execution_count: number;

  outputs: CellOutput[];

  element: Array<HTMLElement>;

  get_text: () => string;
  get_callbacks: () => CellCallbacks;
  execute: (stop_on_error?: boolean) => void;
  kernel: any;
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

export function get_arg_kind_from_int(arg_int: number) {
  const int_to_arg_kind = [
    "ARG_POS", // Positional argument
    "ARG_OPT", // Positional, optional argument (functions only, not calls)
    "ARG_STAR", // *arg argument
    "ARG_NAMED", // Keyword argument x=y in call, or keyword-only function arg
    "ARG_STAR2", // **arg argument
    "ARG_NAMED_OPT", // In an argument list, keyword-only and also optional
  ];

  return int_to_arg_kind[arg_int];
}

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
