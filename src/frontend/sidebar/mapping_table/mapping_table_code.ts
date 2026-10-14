// Pure code helpers for mapping tables (see mapping_table.ts): generating the template and
// dict code, finding and renaming Python names, and choosing names for a new table.
//
// No module-level consts: the bundle is re-injected on every cell run (see AGENTS.md).

import { MappingEntry } from "../../types";

export type TemplateParts = {
  mapping_name: string | null; // null: no dict of overrides
  index_name: string | null;   // null: no enumerate
  item_name: string;
  key_on: "item" | "index";    // "index" needs index_name
  formula_code: string;
  iterable_code: string;
};

// [F for X in E], [M.get(K, F) for X in E], [F for I, X in enumerate(E)], or [M.get(K, F) for I, X in enumerate(E)]
export function template_code(parts: TemplateParts): string {
  const formula = parts.formula_code.trim();
  const key = parts.key_on === "index" && parts.index_name ? parts.index_name : parts.item_name;
  const element = parts.mapping_name ? `${parts.mapping_name}.get(${key}, ${formula})` : formula;
  const loop = parts.index_name
    ? `${parts.index_name}, ${parts.item_name} in enumerate(${parts.iterable_code.trim()})`
    : `${parts.item_name} in ${parts.iterable_code.trim()}`;
  return `[${element} for ${loop}]`;
}

// The parts of `code` if it's one of the four forms, else null. A light parser, for code set on
// the table from outside (the full parse is Python's, at render time); a ` for ` inside the
// element would confuse it, which is fine for that use.
export function parse_template_code(code: string): TemplateParts | null {
  const name = "[\\p{L}_][\\p{L}\\p{N}_]*";
  const match = code.trim().match(new RegExp(`^\\[([\\s\\S]*?)\\s+for\\s+(?:(${name})\\s*,\\s*)?(${name})\\s+in\\s+([\\s\\S]*)\\]$`, "u"));
  if (!match) return null;
  const [, element, index_name, item_name, iter] = match;
  let iterable_code = iter.trim();
  if (has_top_level_keyword(iterable_code, ["if", "for", "async"])) return null; // [... for x in xs if x], nested fors

  if (index_name) {
    const enumerate_match = iterable_code.match(/^enumerate\s*\(([\s\S]*)\)$/);
    if (!enumerate_match || index_name === item_name) return null;
    iterable_code = enumerate_match[1].trim();
  }
  const loop_names = [item_name, index_name].filter(Boolean);
  const get_match = element.trim().match(new RegExp(`^(${name})\\s*\\.\\s*get\\s*\\(\\s*(${name})\\s*,([\\s\\S]*)\\)$`, "u"));
  if (get_match && !loop_names.includes(get_match[1]) && loop_names.includes(get_match[2])) {
    return {
      mapping_name: get_match[1],
      index_name: index_name ?? null,
      item_name,
      key_on: get_match[2] === index_name ? "index" : "item",
      formula_code: get_match[3].trim(),
      iterable_code,
    };
  }
  return { mapping_name: null, index_name: index_name ?? null, item_name, key_on: "item", formula_code: element.trim(), iterable_code };
}

// {0: 'red', 1: 'blue'} on one line if it fits, otherwise one entry per line. Entries with
// empty values are left out (an empty cell means "no override").
export function dict_code(entries: MappingEntry[], indentation: string): string {
  const items = entries
    .filter(entry => entry.value_code.trim() !== "")
    .map(entry => `${entry.key_code}: ${entry.value_code.trim()}`);
  const one_line = `{${items.join(", ")}}`;
  if (one_line.length <= 72 && !one_line.includes("\n")) return one_line;
  return `{\n${items.map(item => `${indentation}    ${item},`).join("\n")}\n${indentation}}`;
}

// Whether `code` has one of `keywords` outside any brackets and strings.
function has_top_level_keyword(code: string, keywords: string[]): boolean {
  const without_strings = code.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
  let depth = 0;
  for (const token of without_strings.matchAll(/[\[\](){}]|[\p{L}_][\p{L}\p{N}_]*/gu)) {
    const t = token[0];
    if ("([{".includes(t)) depth++;
    else if (")]}".includes(t)) depth--;
    else if (depth === 0 && keywords.includes(t)) return true;
  }
  return false;
}

// Whitespace-insensitive comparison key for code.
export function normalize_code(code: string): string {
  return code.replace(/\s+/g, "");
}

export function python_keywords(): Set<string> {
  return new Set([
    "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
    "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
    "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
  ]);
}

export function is_valid_python_name(name: string): boolean {
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) && !python_keywords().has(name);
}

// Calls on_name(start, end) for each variable reference in the Python expression `code`:
// skipping keywords, strings (but not f-string replacement fields), comments, numbers,
// attribute names (x.name), and keyword-argument names (f(name=...)).
function scan_python_names(code: string, on_name: (start: number, end: number) => void) {
  const keywords = python_keywords();
  const brackets: string[] = [];

  // Returns the index just past the string starting at `i` (at its first quote).
  const skip_string = (i: number, is_f: boolean): number => {
    const quote = code[i];
    const triple = code.slice(i, i + 3) === quote.repeat(3);
    const closing = triple ? quote.repeat(3) : quote;
    let j = i + closing.length;
    while (j < code.length) {
      if (code[j] === "\\") { j += 2; continue; }
      if (code.startsWith(closing, j)) return j + closing.length;
      if (!triple && code[j] === "\n") return j; // unterminated
      if (is_f && code[j] === "{") {
        if (code[j + 1] === "{") { j += 2; continue; }
        j = scan(j + 1, true);
        continue;
      }
      j++;
    }
    return j;
  };

  // Scans code from `i`. In an f-string replacement field, stops after its closing "}"
  // (scanning nested fields in its format spec too) and returns that index.
  const scan = (i: number, in_fstring_field: boolean): number => {
    const depth_at_start = brackets.length;
    let in_format_spec = false;
    while (i < code.length) {
      const c = code[i];
      const at_field_level = in_fstring_field && brackets.length === depth_at_start;

      if (in_format_spec) {
        if (c === "{") { i = scan(i + 1, true); continue; }
        if (c === "}") return i + 1;
        i++;
        continue;
      }
      if (at_field_level && c === "}") return i + 1;
      if (at_field_level && (c === ":" || (c === "!" && code[i + 1] !== "="))) { in_format_spec = true; i++; continue; }

      if (c === "#") {
        while (i < code.length && code[i] !== "\n") i++;
        continue;
      }
      if (c === "'" || c === '"') { i = skip_string(i, false); continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
        const number = code.slice(i).match(/^(0[xXoObB][0-9a-fA-F_]+|[0-9_]*\.?[0-9_]*([eE][+-]?[0-9_]+)?[jJ]?)/)![0];
        i += Math.max(1, number.length);
        continue;
      }
      if ("([{".includes(c)) { brackets.push(c); i++; continue; }
      if (")]}".includes(c)) { brackets.pop(); i++; continue; }

      const name = code.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u)?.[0];
      if (name) {
        const after = i + name.length;
        // String prefixes: r'...', f"...", rb'...', etc.
        if (/^[rRbBuUfF]{1,2}$/.test(name) && (code[after] === "'" || code[after] === '"')) {
          i = skip_string(after, /f/i.test(name));
          continue;
        }
        const before = code.slice(0, i).trimEnd();
        const is_attribute = before.endsWith(".") && !before.endsWith("..");
        const rest = code.slice(after);
        const is_keyword_arg = brackets.at(-1) === "(" && /^\s*=(?!=)/.test(rest);
        if (!keywords.has(name) && !is_attribute && !is_keyword_arg) on_name(i, after);
        i = after;
        continue;
      }
      i++;
    }
    return i;
  };

  scan(0, false);
}

// The variable names an expression refers to.
export function python_names(code: string): Set<string> {
  const names = new Set<string>();
  scan_python_names(code, (start, end) => names.add(code.slice(start, end)));
  return names;
}

// The index just past the string literal starting at code[i] (its first quote). An unterminated
// single-quoted string ends at its line's end.
function skip_python_string(code: string, i: number): number {
  const quote = code[i];
  const closing = code.startsWith(quote.repeat(3), i) ? quote.repeat(3) : quote;
  let j = i + closing.length;
  while (j < code.length) {
    if (code[j] === "\\") { j += 2; continue; }
    if (code.startsWith(closing, j)) return j + closing.length;
    if (closing.length === 1 && code[j] === "\n") return j;
    j++;
  }
  return code.length;
}

// The simple statements of a block of Python code, without comments: one per logical line,
// split at semicolons (so `for x in xs: y = x` stays one).
function python_statements(code: string): string[] {
  const statements: string[] = [];
  let statement = "";
  let depth = 0;
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "'" || c === '"') {
      const end = skip_python_string(code, i);
      statement += code.slice(i, end);
      i = end;
      continue;
    }
    if (c === "#") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "\\" && code[i + 1] === "\n") { statement += " "; i += 2; continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (c === "\n" || c === ";")) {
      statements.push(statement);
      statement = "";
      i++;
      continue;
    }
    statement += c;
    i++;
  }
  statements.push(statement);
  return statements.filter(statement => statement.trim() !== "");
}

// What a statement assigns to (everything left of its last top-level `=`, `+=`, etc.), or null.
function assignment_target(statement: string): string | null {
  let depth = 0;
  let last = -1;
  let i = 0;
  while (i < statement.length) {
    const c = statement[i];
    if (c === "'" || c === '"') { i = skip_python_string(statement, i); continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    if (c === "=" && depth === 0) {
      if (statement[i + 1] === "=") { i += 2; continue; } // ==
      const before = statement.slice(Math.max(0, i - 2), i);
      const is_comparison_or_walrus = /[=!<>:]$/.test(before) && !/^(<<|>>)$/.test(before); // <=, >=, !=, :=, but <<= and >>= assign
      if (!is_comparison_or_walrus) last = i;
    }
    i++;
  }
  return last === -1 ? null : statement.slice(0, last);
}

// The names a block of Python code may bind: assignment targets (augmented, annotated, and walrus
// too), for-loop targets, def and class names and parameters, imports, and `as` targets.
// Over-approximates (e.g. the names in a subscripted target, or a parameter's default), which is
// the safe side for telling whether code could change what a name means.
export function python_bound_names(code: string): Set<string> {
  const names = new Set<string>();
  const add_names = (part: string) => python_names(part).forEach(name => names.add(name));
  for (const statement of python_statements(code)) {
    const s = statement.trim();
    let match: RegExpMatchArray | null;
    if ((match = s.match(/^(?:async\s+)?for\s+([\s\S]+?)\s+in\b/))) add_names(match[1]);
    // Parameters with defaults read as keyword args to python_names, so make them plain names.
    if ((match = s.match(/^(?:async\s+)?(?:def|class)\s+([\s\S]*)/))) add_names(match[1].replace(/=/g, ","));
    if ((match = s.match(/^(?:from\s+\S+\s+)?import\s+([\s\S]*)/))) add_names(match[1]);
    for (const as_match of s.matchAll(/\bas\s+([\p{L}_][\p{L}\p{N}_]*)/gu)) names.add(as_match[1]);
    for (const walrus_match of s.matchAll(/([\p{L}_][\p{L}\p{N}_]*)\s*:=/gu)) names.add(walrus_match[1]);
    const target = assignment_target(s);
    if (target !== null) add_names(target);
  }
  return names;
}

// `code` with every reference to the variable `from` renamed to `to`.
export function rename_python_name(code: string, from: string, to: string): string {
  const spans: [number, number][] = [];
  scan_python_names(code, (start, end) => { if (code.slice(start, end) === from) spans.push([start, end]); });
  let out = code;
  for (const [start, end] of spans.reverse()) out = out.slice(0, start) + to + out.slice(end);
  return out;
}

// The identifiers and literal subscripts of an iterable expression, in order, as name parts:
// df['indicator'] -> ["df", "indicator"], np.unique(labels) -> ["np", "unique", "labels"]
function iterable_name_parts(iterable_code: string): string[] {
  const parts: string[] = [];
  for (const match of iterable_code.matchAll(/'([^'\\]*)'|"([^"\\]*)"|([\p{L}_][\p{L}\p{N}_]*)|(\d+)/gu)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    const part = raw.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (part) parts.push(part);
  }
  return parts;
}

// df['indicator'], color -> "df_indicator_to_color"
export function mapping_name_for(iterable_code: string, arg_name: string): string {
  const parts = iterable_name_parts(iterable_code).slice(-3);
  let name = `${parts.length > 0 ? parts.join("_") : "item"}_to_${arg_name}`;
  if (/^\p{N}/u.test(name)) name = "_" + name;
  return name;
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(xes|ches|shes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

// df['indicator'] -> "indicator", groups -> "group". Falls back to "item" when the singular
// isn't a usable name or is a name the iterable itself uses (for group in group).
export function item_name_for(iterable_code: string): string {
  const last = iterable_name_parts(iterable_code).at(-1);
  const name = last ? singular(last) : "item";
  if (!is_valid_python_name(name) || python_names(iterable_code).has(name)) return "item";
  return name;
}
