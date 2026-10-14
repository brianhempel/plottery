// The mapping table: a spreadsheet editor for list comprehension args, with an optional dict
// of overrides (see types.ts for the four code forms).
//
//   color  [… for indicator in df['indicator']]          <- the arg row: names and list editable here
//          ☑ show unique values only   ☐ indices
//                       Default     Overrides
//          indicator ▾  'gray'      df_indicator_to_color ▾
//          0           →  'red'                            <- item → its value: the override's arg
//          1           →  'gray'                              widget, else the default (click to override)
//
// With enumerate(), an index column comes first, unless the overrides are by index: then the
// key column itself shows the indices.
//
// The table only ever edits the arg's comprehension (through the arg's dropdown, whose
// selected item is the chip widget below, so the call's own watcher writes it) and the dict
// literal (through the cell's shared dicts, mapping_dicts.ts, since tables can share a dict).
// The Overrides widget names the dict: None, or any dict the call can see (one from another
// cell is read-only), and editing the name renames it. A dict of the table's own is inserted
// above the call with the first override, and deleted when the last override goes if nothing
// else uses it. The rows are kept across redraws, so the override widgets in them survive.
// The row values come from Python, which records each row as the cell runs
// (plottery/mapping_table.py), and refresh on every redraw (state.mapping_tables).

import {
  Arg,
  MappingDict,
  MappingDictUser,
  MappingEntry,
  MappingTableColumn,
  MappingTableInfo,
  MappingTableItem,
  MappingTableRow,
  MappingTableRuntime,
  MappingTableValue,
  State,
  Type,
} from "../../types";
import { begin_undo_group, end_undo_group, undo_group_origin, UndoGroup } from "../../code_sync/undo_group";
import { MarkerRange, TextMarker } from "../../utils/codemirror";
import { log_event } from "../../utils/instrumentation";
import { create_el, create_red_x_button_icon, default_code_for_type, get_persistent_item, non_colliding_name, set_persistent_item } from "../../utils/misc";
import { Widget, make_widget_for_code_and_type } from "../widgets/widget";
import { DropdownWidget, committed_code, create_dropdown_widget, select_dropdown_item, set_dropdown_code } from "../widgets/dropdown/dropdown";
import { ArbitraryCodeWidget, create_arbitrary_code_widget } from "../widgets/arbitrary_code/arbitrary_code";
import { CodeAndControlWidget } from "../widgets/code_and_control/code_and_control";
import { code_to_hex } from "../widgets/color/color";
import { is_valid_python_name, mapping_name_for, normalize_code, parse_template_code, python_names, rename_python_name, template_code } from "./mapping_table_code";
import {
  add_mapping_dict,
  delete_mapping_dict,
  dict_mark_options,
  is_mapping_dict_deletable,
  is_mapping_dict_exclusive,
  is_mapping_dict_visible_at,
  mapping_dict_code,
  notify_mapping_dict_users,
  rename_mapping_dict,
  use_mapping_dict,
} from "./mapping_dicts";
import "./mapping_table.css";

export type MappingTableWidget = Widget & {
  kind: "MappingTable";
};

export function is_mapping_table_widget(widget: Widget | undefined): widget is MappingTableWidget {
  return (widget as MappingTableWidget | undefined)?.kind === "MappingTable";
}

export type MappingTableView = {
  el: HTMLElement;          // the table, shown below the arg row
  chip: MappingTableWidget; // the arg dropdown's item for the table
  attach: (arg_dropdown: DropdownWidget) => void; // puts the name and list editors in the arg row
  set_visible: (visible: boolean) => void;
};

type Key = { key_code: string; match_id: string };

// What the table shows in one row.
type DisplayRow = {
  index: string;       // the index column: i, or the first i in unique mode
  index_title: string;
  item: MappingTableItem;
  key: Key | null;     // the dict key for this row; null if it can't have one
  formula: MappingTableValue | null;
  mapped: MappingTableValue | null; // the dict's value here, as of the last run
  not_in_data: string | null;       // for dict entries with no row: "not in data" / "not shown"
};

// One row's elements, kept across renders (see render_rows), so a redraw only refreshes the
// values from the run and the override widgets in the rows survive it.
type RowView = {
  el: HTMLElement; // display: contents, so its cells are the table grid's
  index_el: HTMLElement | null;
  key_el: HTMLElement;
  value_el: HTMLElement;
  // What value_el holds: "default", "disabled" (can't be a dict key), "readonly", "pending"
  // (an override being added), or "override:<match_id>".
  value_state: string;
  row: DisplayRow;
  widget: DropdownWidget | null; // an override's arg widget
  swatch_el: HTMLElement | null;
  note_el: HTMLElement | null;
  widget_code: string; // the widget's committed code, as last seen
  entry_code: string;  // the override's code, as last seen
};

// An override being added: the arg widget in a default cell, with its suggestions open, until
// it's committed (Enter, a suggestion, or a click elsewhere) or cancelled (Escape).
type PendingOverride = {
  view: RowView;
  key: Key;
  start_code: string; // the override is only added once its code moves off this (the default)
  // If it ends with no overrides, the dict goes if one of these (see sync_dict_presence).
  had_overrides: boolean;
  created_dict: boolean;
  widget: DropdownWidget;
  undo_group: UndoGroup;
  on_outside_mousedown: (ev: MouseEvent) => void;
};

// A small spreadsheet grid icon. Drawn at its rendered size (13px) with 1px strokes centered
// on half pixels, so the lines are crisp and the 3×3 cells are all the same size (3×2 px).
export function create_table_icon(): HTMLElement {
  const el = create_el("div", "plottery-mt-icon");
  el.innerHTML = `<svg viewBox="0 0 13 13" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1"><rect x="0.5" y="1.5" width="12" height="9" rx="1.5"/><path d="M0.5 4.5h12M0.5 7.5h12M4.5 1.5v9M8.5 1.5v9"/></svg>`;
  return el;
}

export function is_color_type(type: Type): boolean {
  if (type[".class"] === "TypeAliasType") return type.type_ref === "matplotlib._typing.ColorType";
  if (type[".class"] === "UnionType") return type.items.some(is_color_type);
  return false;
}

// A CSS color for a swatch: from the code itself when it's an RGB tuple or a CSS color name
// (most matplotlib names are), else from the value Python computed on the last run.
function swatch_color(code: string | null, runtime_value: MappingTableValue | null): string | null {
  if (code !== null) {
    const hex = code_to_hex(code);
    if (hex) return hex;
    const string_content = code.trim().match(/^(['"])([^'"\\]*)\1$/)?.[2];
    if (string_content && !/^\d/.test(string_content) && CSS.supports("color", string_content)) return string_content;
  }
  return runtime_value?.hex ?? null;
}

// Per-cell UI choices that aren't in the code, by table_key.
function persisted_choices<T>(state: State, key: string): { [table_key: string]: T } {
  try {
    return JSON.parse(get_persistent_item(state, key) || "{}");
  } catch {
    return {};
  }
}

function persist_choice<T>(state: State, key: string, table_key: string, value: T) {
  const choices = persisted_choices<T>(state, key);
  choices[table_key] = value;
  set_persistent_item(state, key, JSON.stringify(choices));
}

export function create_mapping_table_view(
  arg: Arg,
  info: MappingTableInfo,
  state: State,
  flush_call: () => void,           // writes the call's text right away
  call_mark: TextMarker<MarkerRange> // the call's mark, to find the statement to put the dict above
): MappingTableView {
  const cm = state.cell.code_mirror;
  const element_type = arg.element_info?.element_type ?? null;
  const element_snippets = arg.element_info?.element_snippets ?? [];
  const colorish = (element_type !== null && is_color_type(element_type)) || /color/i.test(arg.name) || arg.name === "c";

  /* ---------------- Model ---------------- */

  let mapping_name = info.mapping_name;
  let index_name = info.index_name;
  let item_name = info.item_name;
  // Without a dict the key isn't in the code, so remember a choice of the index across reruns.
  let key_on = info.key_on;
  if (!mapping_name && index_name && persisted_choices<string>(state, "mapping_table_key_on")[info.table_key] === "index") key_on = "index";
  // The dict of overrides (mapping_name), when it's one the table can edit. One it can't
  // (from another cell, or built or changed elsewhere) has its overrides shown read-only.
  let dict: MappingDict | null = null;
  let read_only_reason: string | null = null;
  const user: MappingDictUser = {
    render: () => render(),
    on_rename: () => {
      mapping_name = dict!.name;
      flush_call();
      render();
    },
    uses_name: name => table_uses_name(name),
  };
  let runtime = info.runtime;
  let runtime_code = normalize_code(arg.code); // the comprehension the runtime rows came from
  let pending: PendingOverride | null = null;
  const row_views = new Map<string, RowView>(); // by row_view_id
  let transient_note = "";
  let arg_dropdown: DropdownWidget | undefined;

  const iterable_type: Type = {
    ".class": "Instance",
    type_ref: "typing.Iterable",
    args: [{ ".class": "AnyType", type_of_any: 2, missing_import_name: null }],
  };
  const formula_widget = make_widget_for_code_and_type(info.formula_code, element_type, null, [item_name, ...element_snippets]);
  const iterable_widget = make_widget_for_code_and_type(info.iterable_code, iterable_type, null, state.user_iterables);

  const code = () => template_code({
    mapping_name,
    index_name,
    item_name,
    key_on,
    formula_code: formula_widget.to_code(),
    iterable_code: iterable_widget.to_code(),
  });

  // The committed overrides. Changing them goes through set_entries, so the other tables using
  // the dict follow along.
  const entries = (): MappingEntry[] => dict?.entries ?? [];
  const set_entries = (new_entries: MappingEntry[]) => {
    if (!dict) return;
    dict.entries = new_entries;
    notify_mapping_dict_users(dict, user);
  };
  const find_entry = (match_id: string | null) => match_id === null ? undefined : entries().find(entry => entry.match_id === match_id);

  // The overrides as they should read now: with the override widgets' dropdown hover
  // previews (to_code() includes them, so they preview on the plot), and the override being
  // added. Empty values are dropped.
  const current_entries = (): MappingEntry[] => {
    const out = entries().map(entry => ({ ...entry }));
    for (const view of row_views.values()) {
      if (!view.widget || !view.value_state.startsWith("override:")) continue;
      const code = view.widget.to_code();
      const entry = out.find(other => other.match_id === view.row.key?.match_id);
      if (entry && code.trim() !== "" && code.trim() !== view.widget_code) entry.value_code = code;
    }
    if (pending) {
      const code = pending.widget.to_code();
      const existing = out.find(entry => entry.match_id === pending!.key.match_id);
      if (existing) {
        existing.value_code = code;
      } else if (code.trim() !== pending.start_code.trim()) {
        out.push({ ...pending.key, value_code: code });
      }
    }
    return out.filter(entry => entry.value_code.trim() !== "");
  };

  /* ---------------- The dict in the code ---------------- */

  const bind_dict = (shared: MappingDict) => {
    dict = shared;
    read_only_reason = null;
    use_mapping_dict(state, shared, user);
  };

  const unbind_dict = () => {
    if (!dict) return;
    dict.users.delete(user);
    if (dict.preview === current_entries) dict.preview = null;
    dict = null;
  };

  // The first line of the statement the call is in, where a new dict goes.
  const statement_line = (): number | undefined => {
    const layer = state.layers_panel.layers.find(layer => layer.call_views.some(call_view => call_view.mark === call_mark));
    return (layer?.mark.find() ?? call_mark.find())?.from.line;
  };

  // The dict the code uses, from the cell's list of dicts (see mapping_dicts.ts).
  if (mapping_name) {
    const shared = state.mapping_dicts.get(mapping_name);
    const line = statement_line();
    if (!shared) {
      read_only_reason = `\`${mapping_name}\` isn't a dict this table can edit.`;
    } else if (shared.read_only_reason !== null) {
      read_only_reason = shared.read_only_reason;
    } else if (line === undefined || !is_mapping_dict_visible_at(state, shared, line)) {
      read_only_reason = `\`${mapping_name}\` isn't assigned above this call in this cell.`;
    } else {
      shared.external_refs--; // this table's reference to it
      bind_dict(shared);
    }
  }

  // Insert text at the start of a line without the marks that start there (the call's, its
  // layer's) swallowing it: they're inclusiveLeft, and a later write through such a mark
  // would overwrite the inserted text.
  const insert_at_line_start = (line: number, text: string) => {
    const starting_here = cm.getAllMarks().filter(mark => {
      const range = mark.find() as MarkerRange | undefined;
      return range && range.from.line === line && range.from.ch === 0;
    });
    starting_here.forEach(mark => { mark.inclusiveLeft = false; });
    cm.replaceRange(text, { line, ch: 0 }, undefined, undo_group_origin(state));
    starting_here.forEach(mark => { mark.inclusiveLeft = true; });
  };

  // Add `<iterable>_to_<arg> = {}` (or `chosen_name = {}`) above the call and make the
  // comprehension use it.
  const create_dict = (chosen_name?: string): boolean => {
    const line = statement_line();
    if (line === undefined) return false;
    const formula = formula_widget.to_code();
    const iterable = iterable_widget.to_code();
    const name = chosen_name ?? non_colliding_name(
      mapping_name_for(iterable, arg.name),
      [...state.avoid_names, ...state.mapping_dicts.keys(), ...python_names(formula), ...python_names(iterable), item_name, ...(index_name ? [index_name] : [])]
    );
    mapping_name = name;
    flush_call();
    const indentation = (cm.getLine(line) || "").match(/^\s*/)![0];
    insert_at_line_start(line, `${indentation}${name} = {}\n`);
    const ch = indentation.length + name.length + 3; // after `<indentation><name> = `
    bind_dict(add_mapping_dict(state, name, cm.markText({ line, ch }, { line, ch: ch + 2 }, dict_mark_options())));
    log_event("gui", "mapping table create dict", { name });
    return true;
  };

  // Stop using the dict of overrides: back to [F for X in E]. A dict that nothing else uses
  // goes too (its lines); any other is left as it is. Asks first if that would delete
  // overrides (when `confirm_loss`), and returns false if the user decides against it.
  // The caller wraps this in an undo group.
  const detach_dict = (confirm_loss: boolean): boolean => {
    if (!mapping_name) return true;
    const shared = dict;
    const deleting = !!shared && is_mapping_dict_deletable(shared, user);
    const n = shared ? shared.entries.length : 0;
    if (deleting && confirm_loss && n > 0 && !window.confirm(`This deletes \`${shared!.name}\` and its ${n} override${n === 1 ? "" : "s"}. Continue?`)) return false;
    const name = mapping_name;
    mapping_name = null;
    read_only_reason = null;
    flush_call();
    unbind_dict();
    if (shared && deleting) delete_mapping_dict(state, shared);
    log_event("gui", "mapping table remove dict", { name, deleted: deleting });
    return true;
  };

  // The table's own dict goes when its last override does (`removable`: there were overrides
  // before, or the dict was made for an edit that didn't happen). A dict that something else
  // uses stays, empty.
  const sync_dict_presence = (removable: boolean) => {
    if (dict && !pending && removable && current_entries().length === 0 && is_mapping_dict_deletable(dict, user)) detach_dict(false);
  };

  // Write the call and the dict into the cell right away, so a change that spans both
  // (switching the key, adding the index) never runs half-applied. The watchers then see
  // their code already in place. Callers wrap it in an undo group (groups don't nest).
  const write_now = () => {
    flush_call();
    const dict_range = dict?.mark?.find();
    if (dict && dict_range) cm.replaceRange(mapping_dict_code(state, dict), dict_range.from, dict_range.to, undo_group_origin(state));
  };

  // Use the dict `name` for the overrides, or none. Returns false if it didn't switch.
  function use_dict(name: string | null): boolean {
    if (name === mapping_name) return true;
    const target = name === null ? null : state.mapping_dicts.get(name);
    if (name !== null && !target) return false;
    const group = begin_undo_group(state);
    if (!detach_dict(true)) {
      end_undo_group(state, group);
      return false;
    }
    if (target) {
      mapping_name = target.name;
      if (target.read_only_reason === null && target.mark?.find()) {
        bind_dict(target);
      } else {
        read_only_reason = target.read_only_reason ?? `\`${target.name}\` isn't in the code anymore.`;
      }
      flush_call();
    }
    end_undo_group(state, group);
    log_event("gui", "mapping table use dict", { name });
    render();
    return true;
  }

  // The dicts the overrides could use: the ones the call can see (see
  // is_mapping_dict_visible_at), other than the loop's own names.
  const usable_dict_names = (): string[] => {
    const line = statement_line();
    if (line === undefined) return [];
    return [...state.mapping_dicts.values()]
      .filter(shared => shared.name !== item_name && shared.name !== index_name && is_mapping_dict_visible_at(state, shared, line))
      .map(shared => shared.name);
  };

  /* ---------------- The arg row: [… for X in E] ---------------- */

  const static_label = () => index_name
    ? `[… for ${index_name}, ${item_name} in enumerate(${iterable_widget.to_code().trim()})]`
    : `[… for ${item_name} in ${iterable_widget.to_code().trim()}]`;

  const chips: MappingTableWidget[] = [];
  const create_chip = (): MappingTableWidget => {
    const el = create_el("div", ["plottery-widget", "plottery-mt-chip"]);
    el.append(create_table_icon());
    // In the drawer, a static label; as the arg's value, the live editors (see place_live_editors).
    create_el("span", "plottery-mt-chip-static", el).textContent = static_label();
    create_el("span", "plottery-mt-chip-live-slot", el);
    const chip: MappingTableWidget = {
      kind: "MappingTable",
      el,
      kind_label_for_dropdown: "table",
      does_match_arg_code: arg_code => normalize_code(arg_code) === normalize_code(code()),
      to_code: code,
      set_code: set_from_code,
      clone: create_chip,
    };
    chips.push(chip);
    return chip;
  };

  // For callers that set the arg's code directly. The dict's name only changes along with the
  // dict itself, so code with a different dict is refused.
  function set_from_code(new_code: string) {
    const parts = parse_template_code(new_code);
    if (!parts || parts.mapping_name !== mapping_name) {
      console.warn("Mapping table can't take this code; keeping the table as is:", new_code);
      return;
    }
    index_name = parts.index_name;
    item_name = parts.item_name;
    key_on = parts.key_on;
    set_dropdown_code(formula_widget, parts.formula_code);
    set_dropdown_code(iterable_widget, parts.iterable_code);
    render();
  }

  const chip = create_chip();

  // Name editors commit when they lose focus (Enter blurs them), not on every keystroke:
  // typing `idx` passes through `i`, which may clash.
  const name_editor = (get: () => string, apply: (name: string) => string | null): ArbitraryCodeWidget => {
    const widget = create_arbitrary_code_widget(get());
    widget.el.addEventListener("focusout", () => {
      const name = widget.to_code().trim();
      if (name === get()) {
        widget.set_code(name);
        return;
      }
      const problem = is_valid_python_name(name) ? apply(name) : `\`${name}\` isn't a valid Python name.`;
      if (problem) {
        widget.set_code(get());
        show_transient_note(problem);
      } else {
        log_event("gui", "mapping table rename", { from: get(), to: name });
      }
    });
    return widget;
  };

  const rename_loop_name = (old_name: string, name: string): string | null => {
    if (name === item_name || name === index_name || name === mapping_name) return `\`${name}\` is already used in this table.`;
    if (python_names(formula_widget.to_code()).has(name)) return `The default formula already uses \`${name}\`.`;
    set_dropdown_code(formula_widget, rename_python_name(formula_widget.to_code(), old_name, name));
    return null;
  };

  const item_editor = name_editor(() => item_name, name => {
    const problem = rename_loop_name(item_name, name);
    if (!problem) { item_name = name; render(); }
    return problem;
  });
  const index_editor = name_editor(() => index_name ?? "", name => {
    const problem = rename_loop_name(index_name!, name);
    if (!problem) { index_name = name; render(); }
    return problem;
  });

  // Clicks on the editors are for them, not for opening the arg's dropdown around them.
  [item_editor.el, index_editor.el, iterable_widget.el].forEach(editor_el => editor_el.addEventListener("click", ev => ev.stopPropagation()));

  const live_el = create_el("span", "plottery-mt-live");
  const code_text = (text: string) => {
    const text_el = create_el("span", "plottery-mt-code-text");
    text_el.textContent = text;
    return text_el;
  };
  let live_has_index: boolean | undefined;
  const render_live_editors = () => {
    if (live_has_index === !!index_name) return; // don't rebuild under a focused editor
    live_has_index = !!index_name;
    live_el.textContent = "";
    live_el.append(code_text("[… "), create_keyword("for"), code_text(" "));
    if (index_name) live_el.append(index_editor.el, code_text(", "));
    live_el.append(item_editor.el, code_text(" "), create_keyword("in"), code_text(index_name ? " enumerate(" : " "), iterable_widget.el, code_text(index_name ? ")]" : "]"));
  };

  // The arg's selected item is a clone of the chip (see select_dropdown_item), made whenever
  // it's chosen, so keep moving the single set of live editors into whichever is current.
  const place_live_editors = () => {
    const selected = arg_dropdown?.selected_item;
    if (!selected || !chips.includes(selected as MappingTableWidget) || selected.el.contains(live_el)) return;
    selected.el.querySelector(".plottery-mt-chip-live-slot")?.append(live_el);
  };

  /* ---------------- The table ---------------- */

  const el = create_el("div", "plottery-mt");
  const top_el = create_el("div", "plottery-mt-top", el);
  const checkbox = (label: string) => {
    const label_el = create_el("label", "plottery-mt-option", top_el);
    const input = create_el("input", [], label_el) as HTMLInputElement;
    input.type = "checkbox";
    label_el.append(` ${label}`);
    return { label_el, input };
  };
  const unique = checkbox("show unique values only");
  const indices = checkbox("indices");
  indices.label_el.title = "Go through the list with enumerate(), so the index of each item is available";

  const body_el = create_el("div", "plottery-mt-body", el);
  const index_header_el = create_el("div", ["plottery-mt-cell", "plottery-mt-header", "plottery-mt-index"]);
  const key_header_el = create_el("div", ["plottery-mt-cell", "plottery-mt-header"], body_el);
  const key_select = create_el("select", ["plottery-mt-select", "plottery-mt-key-select"], key_header_el) as HTMLSelectElement;
  const key_item_option = create_el("option", [], key_select) as HTMLOptionElement;
  key_item_option.value = "item";
  const key_index_option = create_el("option", [], key_select) as HTMLOptionElement;
  key_index_option.value = "index";
  create_el("div", ["plottery-mt-cell", "plottery-mt-header"], body_el); // over the arrows
  // Over the values: the default formula, and the dict of overrides.
  const value_header_el = create_el("div", ["plottery-mt-cell", "plottery-mt-header", "plottery-mt-value-header"], body_el);
  const default_group_el = create_el("span", "plottery-mt-header-group", value_header_el);
  create_el("span", "plottery-mt-header-label", default_group_el).textContent = "Default";
  default_group_el.append(formula_widget.el);
  default_group_el.title = "The value for items without an override";
  const mapping_group_el = create_el("span", "plottery-mt-header-group", value_header_el);
  create_el("span", "plottery-mt-header-label", mapping_group_el).textContent = "Mapping";
  const dict_slot_el = create_el("span", "plottery-mt-dict-slot", mapping_group_el); // holds dict_widget
  const rows_el = create_el("div", "plottery-mt-rows", body_el);
  const notes_el = create_el("div", "plottery-mt-notes", el);

  function create_keyword(text: string) {
    const keyword_el = create_el("span", "plottery-mt-keyword");
    keyword_el.textContent = text;
    return keyword_el;
  }

  const unique_only = () => {
    if (key_on === "index") return false; // every index is unique
    return persisted_choices<boolean>(state, "mapping_table_unique")[info.table_key] ?? runtime?.categorical ?? false;
  };

  unique.input.addEventListener("change", () => {
    persist_choice(state, "mapping_table_unique", info.table_key, unique.input.checked);
    log_event("gui", "mapping table unique toggle", { checked: unique.input.checked });
    render();
  });

  indices.input.addEventListener("change", () => {
    if (!set_indices(indices.input.checked)) indices.input.checked = !!index_name;
  });

  key_select.addEventListener("change", () => {
    if (!set_key(key_select.value as "item" | "index")) key_select.value = key_on;
  });


  /* ---------------- Rows ---------------- */

  const item_of_row = (rt: MappingTableRuntime, row: MappingTableRow): MappingTableItem => {
    if (row.col !== null && row.col < rt.columns.length) return rt.columns[row.col];
    return { key_code: row.key_code ?? null, display: row.display ?? "?", match_id: row.match_id ?? null, is_nan: !!row.is_nan };
  };

  const item_key = (item: MappingTableItem): Key | null => item.key_code !== null && item.match_id !== null ? { key_code: item.key_code, match_id: item.match_id } : null;
  const index_key = (i: number): Key => ({ key_code: `${i}`, match_id: `${i}` });

  const display_rows = (unique_mode: boolean): DisplayRow[] => {
    const rt = runtime;
    const rows: DisplayRow[] = [];
    const index_label = index_name ?? "i";
    if (rt) {
      if (unique_mode) {
        rt.columns.forEach((column: MappingTableColumn) => rows.push({
          index: `${column.first_i}`,
          index_title: column.count > 1 ? `First at ${index_label}=${column.first_i}, ${column.count} times in all` : `At ${index_label}=${column.first_i}`,
          item: column,
          key: item_key(column),
          formula: column.formula,
          mapped: column.mapped,
          not_in_data: null,
        }));
      } else {
        rt.rows.forEach(row => {
          const item = item_of_row(rt, row);
          rows.push({
            index: `${row.i}`,
            index_title: `${index_label}=${row.i}`,
            item,
            key: key_on === "index" ? index_key(row.i) : item_key(item),
            formula: row.formula,
            mapped: row.mapped,
            not_in_data: null,
          });
        });
      }
    }

    // Dict entries that no row shows, so they're never silently lost.
    const shown = new Set(rows.map(row => row.key?.match_id));
    const all_items_known = !!rt && !rt.unique_capped && rt.columns.length === rt.n_unique;
    for (const entry of entries()) {
      if (shown.has(entry.match_id ?? undefined)) continue;
      let not_in_data: string;
      if (key_on === "index") {
        const i = Number(entry.match_id);
        not_in_data = rt && Number.isInteger(i) && i >= 0 && i < rt.n_rows ? "not shown" : "not in data";
      } else {
        const in_data = rt?.columns.some(column => column.match_id === entry.match_id);
        not_in_data = in_data || !all_items_known ? "not shown" : "not in data";
      }
      rows.push({
        index: "",
        index_title: "",
        item: { key_code: entry.key_code, display: entry.key_code, match_id: entry.match_id, is_nan: false },
        key: entry.match_id !== null ? { key_code: entry.key_code, match_id: entry.match_id } : null,
        formula: null,
        mapped: null,
        not_in_data,
      });
    }
    return rows;
  };

  /* ---------------- Rendering ---------------- */

  function render() {
    render_live_editors();
    if (document.activeElement !== item_editor.el) item_editor.set_code(item_name);
    if (index_name && document.activeElement !== index_editor.el) index_editor.set_code(index_name);
    chips.forEach(chip => { chip.el.querySelector(".plottery-mt-chip-static")!.textContent = static_label(); });

    const unique_mode = unique_only(); // once per render: it reads the saved choice
    unique.input.disabled = key_on === "index";
    unique.input.checked = unique_mode;
    unique.label_el.title = key_on === "index" ? `Every index is unique, so this only applies when the overrides are by ${item_name}.` : "";
    indices.input.checked = !!index_name;

    key_item_option.textContent = item_name;
    key_index_option.textContent = index_name ?? "i";
    key_select.value = key_on;
    key_select.title = `The overrides are by ${key_on === "index" ? "each item's position" : "each item's value"}`;

    // The index column, only with enumerate() (and not when the key column is the indices).
    const index_column = has_index_column();
    if (index_column && !index_header_el.isConnected) body_el.insertBefore(index_header_el, key_header_el);
    if (!index_column) index_header_el.remove();
    index_header_el.textContent = index_name ?? "";
    body_el.classList.toggle("with-index", index_column);

    render_dict_widget();

    const rows = display_rows(unique_mode);
    render_rows(rows, unique_mode);
    render_notes(rows, unique_mode);
  }

  function has_index_column() {
    return !!index_name && key_on === "item";
  }

  // Whether the row's key column shows its index. (A dict entry that no row shows has no
  // index; its item is its key.)
  const keyed_by_index = (row: DisplayRow) => key_on === "index" && !row.not_in_data;
  const row_label = (row: DisplayRow) => keyed_by_index(row) ? `${index_name ?? "i"}=${row.index}` : row.item.display;

  // A row's identity across renders: by item in unique mode, by position otherwise.
  const row_view_id = (row: DisplayRow, unique_mode: boolean): string =>
    row.not_in_data ? `entry:${row.key?.match_id ?? row.item.display}`
      : unique_mode ? `item:${row.key?.match_id ?? "@" + row.index}`
        : `row:${row.index}`;

  // Update the rows in place: keep each row's elements (and the widgets in them), add and
  // remove rows as the items change, and rebuild a value cell only when what it holds changes.
  let rows_have_index_column: boolean | undefined;
  function render_rows(rows: DisplayRow[], unique_mode: boolean) {
    // Adding or dropping the index column changes every row's cells.
    const index_column = has_index_column();
    if (index_column !== rows_have_index_column) {
      rows_have_index_column = index_column;
      [...row_views.keys()].forEach(remove_row_view);
    }
    const ids = rows.map(row => row_view_id(row, unique_mode));
    const seen = new Set<string>();
    ids.forEach((id, i) => { if (seen.has(id)) ids[i] = `${id}#${i}`; seen.add(ids[i]); }); // shouldn't happen, but ids must be unique
    const wanted = new Set(ids);
    [...row_views.keys()].filter(id => !wanted.has(id)).forEach(remove_row_view);
    rows.forEach((row, i) => {
      let view = row_views.get(ids[i]);
      if (!view) {
        view = create_row_view(row, index_column);
        row_views.set(ids[i], view);
      }
      view.row = row;
      update_row_view(view);
      // Move only rows that are out of place (moving a row blurs a widget in it).
      if (rows_el.children[i] !== view.el) rows_el.insertBefore(view.el, rows_el.children[i] ?? null);
    });
  }

  function remove_row_view(id: string) {
    const view = row_views.get(id);
    if (!view) return;
    if (pending?.view === view) resolve_pending(false, false);
    clear_value_cell(view);
    view.el.remove();
    row_views.delete(id);
  }

  function create_row_view(row: DisplayRow, index_column: boolean): RowView {
    const row_el = create_el("div", "plottery-mt-row");
    const index_el = index_column ? create_el("div", ["plottery-mt-cell", "plottery-mt-index"], row_el) : null;
    const key_el = create_el("div", ["plottery-mt-cell", "plottery-mt-item"], row_el);
    create_el("div", ["plottery-mt-cell", "plottery-mt-arrow"], row_el).textContent = "→";
    const value_el = create_el("div", ["plottery-mt-cell", "plottery-mt-value"], row_el);
    const view: RowView = {
      el: row_el, index_el, key_el, value_el, value_state: "", row,
      widget: null, swatch_el: null, note_el: null, widget_code: "", entry_code: "",
    };
    // Clicking a default value starts an override. On mousedown, not click: a pending override
    // elsewhere closes on this mousedown (see open_pending) and the rows re-render, but this
    // row's elements stay.
    value_el.addEventListener("mousedown", ev => {
      if (view.value_state !== "default") return;
      ev.stopPropagation();
      ev.preventDefault();
      open_pending(view);
      swallow_click_of_this_gesture();
    });
    return view;
  }

  function update_row_view(view: RowView) {
    const row = view.row;
    if (view.index_el) {
      view.index_el.textContent = row.index;
      view.index_el.title = row.index_title;
    }

    // The key column: the item, or its index when the overrides are by index.
    const by_index = keyed_by_index(row);
    set_cell_value(view.key_el, by_index ? row.index : row.item.display, null);
    view.key_el.title = by_index ? `${row.index_title}: ${row.item.display}` : row.item.display;
    view.key_el.classList.toggle("nan", row.item.is_nan && !by_index);
    view.key_el.classList.toggle("not-in-data", !!row.not_in_data);

    // The value: an override's widget, else the default (or, read-only, what the last run used).
    const entry = row.key ? find_entry(row.key.match_id) : undefined;
    const value_state =
      read_only_reason !== null ? "readonly"
        : !row.key ? "disabled"
          : pending?.view === view ? "pending"
            : entry ? `override:${row.key.match_id}`
              : "default";
    if (value_state !== view.value_state) build_value_cell(view, value_state, entry);

    const value_el = view.value_el;
    if (value_state === "default" || value_state === "disabled") {
      set_cell_value(value_el, row.formula?.repr ?? "", colorish ? row.formula?.hex ?? null : null);
      value_el.title = value_state === "disabled"
        ? row.item.is_nan
          ? "NaN can't be a dict key (NaN ≠ NaN). Handle it in the default formula instead."
          : `${row.item.display} can't be a dict key.`
        : `The default for ${row_label(row)}. Click to override it.`;
    } else if (value_state === "readonly") {
      const value = row.mapped ?? row.formula;
      set_cell_value(value_el, value?.repr ?? "", colorish ? value?.hex ?? null : null);
      value_el.classList.toggle("overridden", !!row.mapped);
      value_el.title = `Mapping overrides are read-only: ${read_only_reason}`;
    } else if (value_state.startsWith("override:")) {
      view.note_el!.textContent = row.not_in_data ?? "";
      view.note_el!.title = row.not_in_data === "not in data"
        ? "This key isn't any item in the list, so it does nothing."
        : row.not_in_data === "not shown" ? "This key's row isn't shown here (the list is long)." : "";
      update_override_swatch(view);
    }
  }

  // Empty a value cell, letting go of its override widget.
  function clear_value_cell(view: RowView) {
    if (view.widget?.el.classList.contains("expanded")) state.hover_regions_container.classList.remove("hide_during_interaction");
    view.widget = null;
    view.swatch_el = null;
    view.note_el = null;
    view.value_el.textContent = "";
    view.value_el.removeAttribute("title");
  }

  function build_value_cell(view: RowView, value_state: string, entry: MappingEntry | undefined) {
    clear_value_cell(view);
    view.value_state = value_state;
    const value_el = view.value_el;
    value_el.className = "plottery-mt-cell plottery-mt-value";
    if (value_state === "default") {
      value_el.classList.add("default");
    } else if (value_state === "disabled") {
      value_el.classList.add("default", "disabled");
    } else if (value_state === "readonly") {
      value_el.classList.add("readonly");
    } else if (value_state === "pending") {
      value_el.classList.add("override", "editing");
      value_el.append(pending!.widget.el);
    } else if (entry) {
      // An override: its arg widget, live like an arg's (see sync_override_widgets).
      value_el.classList.add("override");
      const widget = make_widget_for_code_and_type(entry.value_code, element_type, null, element_snippets);
      value_el.append(widget.el);
      if (colorish) view.swatch_el = create_el("span", "plottery-mt-swatch", value_el);
      view.widget = widget;
      view.widget_code = committed_code(widget).trim();
      view.entry_code = entry.value_code;
      view.note_el = create_el("span", "plottery-mt-value-note", value_el);
      const key = view.row.key!;
      const remove_el = create_el("div", "plottery-mt-remove", value_el);
      remove_el.append(create_red_x_button_icon());
      remove_el.title = `Remove this override, so ${row_label(view.row)} uses the default`;
      remove_el.addEventListener("mousedown", ev => {
        ev.stopPropagation();
        ev.preventDefault();
        const group = begin_undo_group(state);
        set_entries(entries().filter(other => other.match_id !== key.match_id));
        sync_dict_presence(true);
        write_now();
        end_undo_group(state, group);
        log_event("gui", "mapping table remove override", { key: key.key_code });
        render();
      });
    }
  }

  // The cell's swatch, after the code, unless the widget shows the color itself (a color picker).
  function update_override_swatch(view: RowView) {
    if (!view.swatch_el) return;
    const widget_shows_color = !!view.widget?.selected_item_holder_el.querySelector(".plottery-arg-color");
    const color = view.widget_code && !widget_shows_color ? swatch_color(view.widget_code, view.row.mapped) : null;
    view.swatch_el.style.background = color ?? "transparent";
    view.swatch_el.style.display = color ? "" : "none";
  }

  // The Overrides widget: the dict's name (None without one) as code you can edit, to rename
  // the dict or name a new one, with the dicts it could use as suggestions. Rebuilt when those
  // change, but not while it's in use.
  let dict_widget: DropdownWidget | null = null;
  let dict_widget_signature = "";
  let dict_widget_shown = ""; // the name it was built showing
  function render_dict_widget() {
    const names = usable_dict_names();
    if (mapping_name && !names.includes(mapping_name)) names.unshift(mapping_name);
    const choices = names.map(name => {
      const shared = state.mapping_dicts.get(name);
      const read_only = name === mapping_name ? read_only_reason !== null : !shared || shared.read_only_reason !== null;
      return { name, read_only };
    });
    const signature = JSON.stringify([mapping_name, choices]);
    const in_use = !!dict_widget && (dict_widget.el.classList.contains("expanded") || dict_widget.selected_item_holder_el.contains(document.activeElement));
    if (signature !== dict_widget_signature && !in_use) {
      dict_widget_signature = signature;
      const item = (code: string, label: string) => {
        const widget = create_arbitrary_code_widget(code);
        widget.kind_label_for_dropdown = label;
        return widget;
      };
      const items = [item("None", "none"), ...choices.map(choice => item(choice.name, choice.read_only ? "read-only" : "dict"))];
      dict_widget = create_dropdown_widget(items);
      const current = items.find(widget => widget.to_code() === (mapping_name ?? "None"));
      if (current) select_dropdown_item(dict_widget, current);
      dict_widget.el.classList.add("plottery-mt-dict-widget");
      dict_widget_shown = committed_code(dict_widget).trim();
      dict_slot_el.replaceChildren(dict_widget.el);
    }
    dict_slot_el.title = mapping_name
      ? `The overrides are in the dict \`${mapping_name}\`${read_only_reason !== null ? ` (read-only: ${read_only_reason})` : ""}. Edit the name to rename it, or choose None or another dict.`
      : "No overrides yet: click a value to add one, choose a dict of overrides you have, or type a name for a new one.";
  }

  // Apply a name chosen or typed in the Overrides widget: None stops using a dict, a dict the
  // call can use is used, and a new name renames the dict (or, without one, makes an empty one
  // by that name). Returns false (after saying why) if it didn't apply.
  function choose_dict_name(name: string): boolean {
    if (name === "" || name === "None") return use_dict(null);
    if (name === mapping_name) return true;
    if (state.mapping_dicts.has(name)) {
      if (usable_dict_names().includes(name)) return use_dict(name);
      show_transient_note(`\`${name}\` isn't assigned where this call can use it.`);
      return false;
    }
    const problem = !is_valid_python_name(name) ? `\`${name}\` isn't a valid Python name.`
      : table_uses_name(name) ? `This table already uses \`${name}\`.`
        : state.avoid_names.includes(name) ? `\`${name}\` is already a name in this notebook.`
          : mapping_name && !dict ? `\`${mapping_name}\` can't be renamed here: ${read_only_reason}`
            : null;
    if (problem) {
      show_transient_note(problem);
      return false;
    }
    const group = begin_undo_group(state);
    let rename_problem: string | null = null;
    if (!dict) {
      if (create_dict(name)) write_now();
      log_event("gui", "mapping table name dict", { name });
    } else {
      const old_name = dict.name;
      rename_problem = rename_mapping_dict(state, dict, name);
      if (!rename_problem) log_event("gui", "mapping table rename dict", { from: old_name, to: name });
    }
    end_undo_group(state, group);
    if (rename_problem) {
      show_transient_note(rename_problem);
      return false;
    }
    render();
    return true;
  }

  // Once a new name is committed in the Overrides widget (a suggestion picked, or the code box
  // left). Only the widget's own changes count: the table's dict changing (say, one made for an
  // override) re-renders it instead.
  const sync_dict_widget = () => {
    if (!dict_widget || dict_widget.selected_item_holder_el.contains(document.activeElement)) return;
    const chosen = committed_code(dict_widget).trim();
    if (chosen === dict_widget_shown) return;
    dict_widget_shown = chosen;
    if (!choose_dict_name(chosen)) {
      dict_widget_signature = ""; // back to what it was
      render_dict_widget();
    }
  };

  const table_uses_name = (name: string) =>
    name === item_name || name === index_name || python_names(formula_widget.to_code()).has(name) || python_names(iterable_widget.to_code()).has(name);

  // Text, and a color swatch after it (where a color widget has its picker).
  function set_cell_value(cell_el: HTMLElement, text: string, swatch: string | null) {
    cell_el.textContent = "";
    create_el("span", "plottery-mt-cell-text", cell_el).textContent = text;
    if (swatch) {
      const swatch_el = create_el("span", "plottery-mt-swatch", cell_el);
      swatch_el.style.background = swatch;
    }
  }

  function render_notes(rows: DisplayRow[], unique_mode: boolean) {
    notes_el.innerHTML = "";
    const note = (text: string) => {
      const note_el = create_el("div", "plottery-mt-note", notes_el);
      note_el.textContent = text;
      return note_el;
    };
    const rt = runtime;

    if (!rt) {
      note("No values yet.");
    } else {
      if (unique_mode && (rt.unique_capped || rt.columns.length < rt.n_unique)) {
        note(`Showing ${rt.columns.length} of ${rt.unique_capped ? "over " + rt.n_unique : rt.n_unique} distinct values.`);
      } else if (!unique_mode && rt.rows_capped) {
        note(`Showing the first ${rt.rows.length} of ${rt.n_rows} items.`);
      }
      if (rt.n_runs > 1) {
        note(`This line ran ${rt.n_runs} times. ${unique_mode ? "The values above are from every run." : "Showing the last run."}`);
      }
      if (rt.n_rows === 0) note("The list is empty.");
    }

    if (read_only_reason !== null) note(`Overrides are read-only: ${read_only_reason}`);

    if (key_on === "item" && rt && read_only_reason === null) {
      const has_nan = rt.columns.some(column => column.is_nan) || rows.some(row => row.item.is_nan);
      const formula = formula_widget.to_code();
      if (has_nan && !formula.includes(`${item_name} != ${item_name}`)) {
        const nan_code = colorish ? "'lightgray'" : "None";
        const note_el = note("NaN can't be a dict key (NaN ≠ NaN). Handle it in the default formula instead. ");
        const button = create_el("button", "plottery-mt-note-button", note_el);
        button.textContent = `Use ${nan_code} for NaN`;
        button.addEventListener("click", ev => {
          ev.stopPropagation();
          set_dropdown_code(formula_widget, `${nan_code} if ${item_name} != ${item_name} else ${formula_widget.to_code().trim()}`);
          log_event("gui", "mapping table nan formula");
          render();
        });
      }
      const unkeyable = rows.find(row => !row.key && !row.item.is_nan && !row.not_in_data);
      if (unkeyable) {
        const note_el = note(`Items like ${unkeyable.item.display} can't be dict keys. `);
        const button = create_el("button", "plottery-mt-note-button", note_el);
        button.textContent = "Override by index instead";
        button.addEventListener("click", ev => {
          ev.stopPropagation();
          set_key("index");
        });
      }
    }

    if (transient_note) note(transient_note).classList.add("plottery-mt-transient-note");
  }

  let transient_note_timer: number | undefined;
  function show_transient_note(text: string) {
    transient_note = text;
    window.clearTimeout(transient_note_timer);
    transient_note_timer = window.setTimeout(() => { transient_note = ""; render(); }, 5000);
    render();
  }

  /* ---------------- Adding an override ---------------- */

  // The widget opens on mousedown and takes the cell's place, so the gesture's click lands on
  // it, where it would close the suggestions it just opened. Stop that one click (and only it:
  // the listener goes once the gesture ends).
  const swallow_click_of_this_gesture = () => {
    const stop = (ev: MouseEvent) => ev.stopPropagation();
    el.addEventListener("click", stop, true);
    window.addEventListener("mouseup", () => window.setTimeout(() => el.removeEventListener("click", stop, true)), { capture: true, once: true });
  };

  // Put the arg widget in a default cell, starting at the default's value (so the plot doesn't
  // change until you change it, and sliders and color pickers start where the item is), with
  // its suggestions open. It previews on the plot, and becomes an override when committed.
  function open_pending(view: RowView) {
    if (pending) resolve_pending(true);
    if (view.value_state !== "default") return; // committing that may have given this row an override
    const row = view.row;
    const key = row.key;
    if (!key || !state.is_in_dom()) return;

    // Adding the override, including adding (and maybe removing) the dict, is one undo step.
    const undo_group = begin_undo_group(state);
    const had_overrides = entries().length > 0;
    const created_dict = !dict;
    if (created_dict && !create_dict()) {
      end_undo_group(state, undo_group);
      return;
    }

    let start_code = row.formula?.code ?? (element_type ? default_code_for_type(element_type, arg.name) : "None");
    if (start_code === "...") start_code = "None";
    const widget = make_widget_for_code_and_type(start_code, element_type, null, element_snippets);
    // So Escape cancels here, rather than JupyterLab / Notebook 7 taking it (for command mode).
    widget.el.dataset.lmSuppressShortcuts = "true";

    // Picking a suggestion commits it, unless it comes with a slider or color picker to adjust.
    // (Capture phase: the item's own click handler selects it and stops the event.)
    widget.el.addEventListener("click", ev => {
      if (!(ev.target as HTMLElement).closest(".plottery-dropdown-item-overlay")) return;
      window.setTimeout(() => {
        if (pending?.widget !== widget) return;
        const selected = widget.selected_item as CodeAndControlWidget | undefined;
        if (!(selected?.kind === "CodeAndControl" && selected.control_widget)) resolve_pending(true);
      });
    }, true);

    // Enter commits, Escape cancels. (Capture phase: the code box handles Enter itself.)
    widget.el.addEventListener("keydown", ev => {
      if (pending?.widget !== widget) return;
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
        resolve_pending(false);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        window.setTimeout(() => { if (pending?.widget === widget) resolve_pending(true); });
      }
    }, true);

    // A click anywhere else commits it (if it changed).
    const on_outside_mousedown = (ev: MouseEvent) => {
      if (!widget.el.contains(ev.target as Node)) resolve_pending(true);
    };
    document.addEventListener("mousedown", on_outside_mousedown, true);

    pending = { view, key, start_code, had_overrides, created_dict, widget, undo_group, on_outside_mousedown };
    dict!.preview = current_entries; // so the dict's code previews it
    build_value_cell(view, "pending", undefined);
    render_dict_widget(); // its name, if the dict is new

    // Open with the suggestions showing, so a value is one click away. (As when the dropdown
    // opens itself, hide the plot's hover regions so they don't cover the preview.)
    widget.el.classList.add("expanded");
    state.hover_regions_container.classList.add("hide_during_interaction");
    log_event("gui", "mapping table cell open", { key: key.key_code, arg_code: start_code });
    (widget.el.querySelector(".arbitrary-code-widget") as HTMLElement | null)?.focus();
  }

  // Commit the override being added (if its code moved off the default), or cancel it.
  function resolve_pending(commit: boolean, rerender = true) {
    const closing = pending;
    if (!closing) return;
    pending = null;
    document.removeEventListener("mousedown", closing.on_outside_mousedown, true);
    state.hover_regions_container.classList.remove("hide_during_interaction");

    const value_code = committed_code(closing.widget).trim();
    if (commit && value_code !== "" && value_code !== closing.start_code.trim()) {
      set_entries([...entries().filter(entry => entry.match_id !== closing.key.match_id), { ...closing.key, value_code }]);
      log_event("gui", "mapping table cell commit", { key: closing.key.key_code, arg_code: value_code });
    } else {
      log_event("gui", "mapping table cell cancel", { key: closing.key.key_code });
    }
    if (dict && dict.preview === current_entries) dict.preview = null;
    sync_dict_presence(closing.had_overrides || closing.created_dict);
    write_now(); // inside the undo group
    end_undo_group(state, closing.undo_group);

    // The cell shows the default again, or (on render) the new override's widget.
    closing.view.value_state = "";
    clear_value_cell(closing.view);
    if (rerender) render();
  }

  /* ---------------- Index and key ---------------- */

  // A name for enumerate()'s index that the comprehension doesn't use yet.
  function new_index_name(): string {
    const formula_names = python_names(formula_widget.to_code());
    return ["i", "j", "k", "idx"].find(name => !formula_names.has(name) && name !== item_name && name !== mapping_name)
      ?? non_colliding_name("idx", [...formula_names, item_name, ...(mapping_name ? [mapping_name] : [])]);
  }

  // Add or drop enumerate(). Returns false if it couldn't.
  function set_indices(on: boolean): boolean {
    if (on === !!index_name) return true;
    if (on) {
      index_name = new_index_name();
    } else {
      if (key_on === "index" && !set_key("item")) return false;
      if (python_names(formula_widget.to_code()).has(index_name!)) {
        show_transient_note(`The default formula uses \`${index_name}\`, so the index is still needed.`);
        return false;
      }
      index_name = null;
    }
    log_event("gui", "mapping table indices toggle", { on });
    const group = begin_undo_group(state);
    write_now();
    end_undo_group(state, group);
    render();
    return true;
  }

  // Override by each item's value or by its index (which needs enumerate()), carrying the
  // overrides over. Returns false if it didn't switch.
  function set_key(to: "item" | "index"): boolean {
    if (to === key_on) return true;
    const indices_were_on = !!index_name;
    if (to === "index" && !index_name) index_name = new_index_name();
    const had_overrides = entries().length > 0;
    let new_entries: MappingEntry[] = entries();
    // A dict that something else uses too keeps its keys as they are.
    const shared_elsewhere = !!dict && had_overrides && !is_mapping_dict_exclusive(dict, user);

    if (had_overrides && !shared_elsewhere) {
      // Carry each override over to the new keys of the rows it applied to.
      const rt = runtime;
      const out: MappingEntry[] = [];
      const used = new Set<MappingEntry>();
      let lost = 0;
      for (const row of rt?.rows ?? []) {
        const item = item_of_row(rt!, row);
        const entry = find_entry(key_on === "index" ? `${row.i}` : item.match_id);
        if (!entry) continue;
        used.add(entry);
        const new_key = to === "index" ? index_key(row.i) : item_key(item);
        if (!new_key) { lost++; continue; }
        const existing = out.find(other => other.match_id === new_key.match_id);
        if (existing) {
          if (normalize_code(existing.value_code) !== normalize_code(entry.value_code)) lost++;
          continue;
        }
        out.push({ ...new_key, value_code: entry.value_code });
      }
      lost += entries().filter(entry => !used.has(entry)).length;
      const complete = !!rt && !rt.rows_capped && rt.n_runs === 1;
      if (lost > 0 || !complete) {
        const why = !rt ? "there are no recorded values" : !complete ? "not every item was recorded" : `${lost} of them don't map over one-to-one`;
        const to_name = to === "index" ? index_name : item_name;
        if (!window.confirm(`Switching the overrides to be by ${to_name} can't carry over all ${entries().length} of them (${why}). The ones that can't will be dropped. Continue?`)) {
          if (!indices_were_on) index_name = null;
          return false;
        }
      }
      new_entries = out;
    }

    key_on = to;
    if (!shared_elsewhere) set_entries(new_entries);
    if (!mapping_name) persist_choice(state, "mapping_table_key_on", info.table_key, key_on);
    log_event("gui", "mapping table key toggle", { key_on });
    const group = begin_undo_group(state);
    write_now();
    sync_dict_presence(had_overrides); // the carried-over overrides may be none
    end_undo_group(state, group);
    if (shared_elsewhere) show_transient_note(`\`${mapping_name}\` is used elsewhere too, so its keys are left as they are.`);
    render();
    return true;
  }

  /* ---------------- Live updates ---------------- */

  state.mapping_tables.set(info.table_key, new_runtime => {
    runtime = new_runtime;
    // The rows match the current comprehension only if the cell hasn't changed since this run.
    if (state.cell.get_text() === state.last_cell_code_executed) runtime_code = normalize_code(code());
    render();
  });

  // Each override widget's code goes into the dict as it changes (as an arg widget's does into
  // its call), and a change to the override made elsewhere (by another table using the dict)
  // into the widget. The dict previews while a widget has a hover preview or one is pending.
  const sync_override_widgets = () => {
    let previewing = !!pending;
    for (const view of row_views.values()) {
      const widget = view.widget;
      const key = view.row.key;
      if (!widget || !key || !view.value_state.startsWith("override:")) continue;
      const entry = find_entry(key.match_id);
      if (!entry) continue; // the next render drops the widget
      const committed = committed_code(widget).trim();
      if (committed !== view.widget_code) {
        view.widget_code = committed;
        // An emptied code box is mid-edit, not a removal (that's the ×).
        if (committed !== "" && normalize_code(committed) !== normalize_code(entry.value_code)) {
          view.entry_code = committed;
          set_entries(entries().map(other => other === entry ? { ...other, value_code: committed } : other));
        }
        update_override_swatch(view);
      } else if (entry.value_code !== view.entry_code) {
        view.entry_code = entry.value_code;
        if (!widget.el.contains(document.activeElement)) {
          set_dropdown_code(widget, entry.value_code);
          view.widget_code = committed_code(widget).trim();
          update_override_swatch(view);
        }
      }
      if (widget.to_code().trim() !== committed) previewing = true;
    }
    if (dict) {
      if (previewing) dict.preview = current_entries;
      else if (dict.preview === current_entries) dict.preview = null;
    }
  };

  // The rows scroll, which would clip a dropdown opened in them, so an open drawer there is
  // fixed under its cell instead (following it, and hidden while the cell is scrolled away).
  let placed_drawers: HTMLElement[] = [];
  const place_drawers = () => {
    const open = [...rows_el.querySelectorAll(".plottery-dropdown.expanded > .plottery-dropdown-drawer")] as HTMLElement[];
    for (const drawer of placed_drawers) {
      if (!open.includes(drawer)) Object.assign(drawer.style, { position: "", top: "", left: "", visibility: "" });
    }
    placed_drawers = open;
    if (open.length === 0) return;
    const rows_rect = rows_el.getBoundingClientRect();
    for (const drawer of open) {
      const anchor = drawer.parentElement!.getBoundingClientRect();
      // Fixed is relative to the viewport, unless an ancestor is transformed: find its origin.
      Object.assign(drawer.style, { position: "fixed", top: "0px", left: "0px" });
      const origin = drawer.getBoundingClientRect();
      drawer.style.top = `${anchor.bottom - origin.top}px`;
      drawer.style.left = `${anchor.left - origin.left}px`;
      drawer.style.visibility = anchor.bottom > rows_rect.top && anchor.top < rows_rect.bottom ? "" : "hidden";
    }
  };

  // Gray out the values while they're from an older comprehension, keep the override widgets
  // and the dict in sync, and keep the live editors in the arg row.
  let was_stale = false;
  const keep_live = () => {
    if (!state.is_in_dom()) return;
    const stale = runtime !== null && normalize_code(code()) !== runtime_code;
    if (stale !== was_stale) {
      el.classList.toggle("plottery-mt-stale", stale);
      was_stale = stale;
    }
    sync_override_widgets();
    sync_dict_widget();
    place_drawers();
    place_live_editors();
    requestAnimationFrame(keep_live);
  };
  requestAnimationFrame(keep_live);

  render();

  return {
    el,
    chip,
    attach: dropdown => {
      arg_dropdown = dropdown;
      place_live_editors();
    },
    set_visible: visible => el.classList.toggle("hidden", !visible),
  };
}
