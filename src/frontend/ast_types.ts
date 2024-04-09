export type P_expr = {
  type: "expr";
  col_offset: number;
  end_col_offset: number;
  lineno: number;
  end_lineno: number;
};

export type P_stmt = P_expr;

export type P_expr_context = {
  type: "expr_context";
};

export type P_Add = {
  type: "Add";
};

export type P_Assign = P_expr & {
  type: "Assign";
};

export type P_Attribute = P_expr & {
  type: "Attribute";
  value: P_expr;
  attr: string;
  ctx: P_expr_context;
};

export type P_AugAssign = P_expr & {
  type: "AugAssign";
  value: P_expr;
  target: P_Name | P_Attribute | P_Subscript;
  op: P_operator;
};

export type P_BinOp = P_expr & {
  type: "BinOp";
  left: P_expr;
  right: P_expr;
  op: P_operator;
};

export type P_Call = P_expr & {
  type: "Call";
  func: P_expr;
  args: P_expr[];
  keywords: P_keyword[];
};

export type P_Constant = P_expr & {
  type: "Constant";
  value: any; // @TODO: None, str, bytes, bool, int, float, complex, Ellipsis
  kind: string | null;
};

export type P_Dict = P_expr & {
  type: "Dict";
  keys: P_expr[];
  values: P_expr[];
};

export type P_Expr = P_expr & {
  type: "Expr";
  value: P_expr;
};

export type P_For = P_expr & {
  type: "For";
  target: P_expr;
  iter: P_expr;
  body: P_stmt[];
  orelse: P_stmt[];
};

export type P_Import = P_expr & {
  type: "Import";
  names: P_alias[];
};

export type P_List = P_expr & {
  type: "List";
  elts: P_expr[];
  ctx: P_expr_context;
};

export type P_Load = {
  type: "Load";
};

export type P_Module = {
  type: "Module";
  body: P_stmt[];
};

export type P_Mult = {
  type: "Mult";
};

export type P_Name = P_expr & {
  type: "Name";
  id: string;
  ctx: P_expr_context;
};

export type P_Store = {
  type: "Store";
};

export type P_Subscript = {
  type: "Subscript";
  value: P_expr;
  slice: P_expr;
  ctx: P_expr_context;
};

export type P_Tuple = P_expr & {
  type: "Tuple";
  elts: P_expr[];
  ctx: P_expr_context;
};

export type P_alias = P_expr & {
  type: "alias";
  name: string;
  asname: string | null;
};

export type P_keyword = P_expr & {
  type: "keyword";
  arg: string | null;
  value: P_expr;
};

export type P_operator = P_expr & {
  type: "operator";
};
