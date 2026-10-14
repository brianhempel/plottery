// The dicts of overrides that mapping tables use (see mapping_table.ts), one per name for the
// whole cell: tables that use the same dict share its entries, and a single watcher writes it.
//
// Made from Python's list of the dicts a table could use (mapping_dicts_json in
// plottery/mapping_table.py) when the UI is attached, while its positions are current, and
// from the dicts the tables add themselves.
//
// No module-level consts: the bundle is re-injected on every cell run (see AGENTS.md).

import { MappingDict, MappingDictUser, MappingDictsInfo, MappingScope, State } from "../../types";
import { add_sync_code_on_change_watcher } from "../../code_sync/code_sync";
import { undo_group_origin } from "../../code_sync/undo_group";
import { MarkerRange, TextMarker } from "../../utils/codemirror";
import { cm_end_pos, cm_start_pos } from "../../utils/misc";
import { dict_code } from "./mapping_table_code";

// For the {...} of an editable dict: grows with edits at either end.
export function dict_mark_options() {
  return { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false };
}

export function init_mapping_dicts(state: State, info: MappingDictsInfo) {
  const cm = state.cell.code_mirror;
  state.mapping_scopes = info.scopes.map(scope => ({
    mark: cm.markText(cm_start_pos(scope.pos, state.cell_lineno), cm_end_pos(scope.pos, state.cell_lineno), { inclusiveLeft: false, inclusiveRight: false }),
    kind: scope.kind,
  }));
  state.mapping_dicts = new Map();
  for (const candidate of info.dicts) {
    let mark: TextMarker<MarkerRange> | null = null;
    if (candidate.editable) {
      mark = cm.markText(cm_start_pos(candidate.value_pos, state.cell_lineno), cm_end_pos(candidate.value_pos, state.cell_lineno), dict_mark_options());
    } else if (candidate.in_cell && candidate.assign_pos) {
      mark = cm.markText(cm_start_pos(candidate.assign_pos, state.cell_lineno), cm_end_pos(candidate.assign_pos, state.cell_lineno), { inclusiveLeft: false, inclusiveRight: false });
    }
    state.mapping_dicts.set(candidate.name, {
      name: candidate.name,
      read_only_reason: candidate.editable ? null : candidate.reason,
      in_cell: candidate.in_cell,
      mark,
      entries: candidate.editable ? candidate.entries.map(entry => ({ ...entry })) : [],
      alone: candidate.editable ? candidate.alone : false,
      external_refs: candidate.editable ? candidate.n_refs - 1 : 0, // the tables using it subtract theirs
      users: new Set(),
      preview: null,
      watching: null,
    });
  }
}

// A new, empty dict that a table just added (on its own line, `name = {}`) at `mark`.
export function add_mapping_dict(state: State, name: string, mark: TextMarker<MarkerRange>): MappingDict {
  const dict: MappingDict = {
    name,
    read_only_reason: null,
    in_cell: true,
    mark,
    entries: [],
    alone: true,
    external_refs: 0,
    users: new Set(),
    preview: null,
    watching: null,
  };
  state.mapping_dicts.set(name, dict);
  return dict;
}

// The innermost def or class that `line` is in, or undefined at the top level.
function scope_of_line(state: State, line: number): MappingScope | undefined {
  let innermost: MappingScope | undefined;
  let innermost_from = -1;
  for (const scope of state.mapping_scopes) {
    const range = scope.mark.find();
    if (range && range.from.line <= line && line <= range.to.line && range.from.line > innermost_from) {
      innermost = scope;
      innermost_from = range.from.line;
    }
  }
  return innermost;
}

// Whether code on `line` can use the dict: it's assigned on an earlier line, at the top level
// (or in another cell), or in a def the line is in, or in the class body the line is directly in.
export function is_mapping_dict_visible_at(state: State, dict: MappingDict, line: number): boolean {
  if (!dict.mark) return true;
  const range = dict.mark.find();
  if (!range || range.to.line >= line) return false;
  const dict_scope = scope_of_line(state, range.from.line);
  if (!dict_scope) return true;
  const dict_scope_range = dict_scope.mark.find();
  if (!dict_scope_range || line < dict_scope_range.from.line || line > dict_scope_range.to.line) return false;
  return dict_scope.kind === "def" || scope_of_line(state, line) === dict_scope;
}

// The dict's code as it should read now, including an edit in progress.
export function mapping_dict_code(state: State, dict: MappingDict): string {
  const cm = state.cell.code_mirror;
  const range = dict.mark?.find();
  const indentation = range ? (cm.getLine(range.from.line) ?? "").match(/^\s*/)![0] : "";
  return dict_code(dict.preview ? dict.preview() : dict.entries, indentation);
}

export function use_mapping_dict(state: State, dict: MappingDict, user: MappingDictUser) {
  dict.users.add(user);
  if (!dict.watching && dict.mark) {
    const watching = { active: true };
    dict.watching = watching;
    add_sync_code_on_change_watcher(() => mapping_dict_code(state, dict), [dict.mark], state, () => watching.active);
  }
}

// Whether only `user` (or no table) uses the dict, and nothing else in the code refers to it,
// so its keys are the table's to change.
export function is_mapping_dict_exclusive(dict: MappingDict, user: MappingDictUser): boolean {
  return dict.read_only_reason === null && dict.external_refs <= 0 && [...dict.users].every(other => other === user);
}

// Whether the dict's lines can go when `user` stops using it.
export function is_mapping_dict_deletable(dict: MappingDict, user: MappingDictUser): boolean {
  return is_mapping_dict_exclusive(dict, user) && dict.alone && !!dict.mark?.find();
}

// The other tables using the dict show its new entries.
export function notify_mapping_dict_users(dict: MappingDict, except: MappingDictUser) {
  dict.users.forEach(user => { if (user !== except) user.render(); });
}

// Rename the dict: its assignment's target, and in every table using it. Only for a dict that
// nothing but those tables refers to, assigned at the start of its line (`name = {...}`).
// Returns what's in the way, or null. The caller wraps this in an undo group.
export function rename_mapping_dict(state: State, dict: MappingDict, new_name: string): string | null {
  if (dict.read_only_reason !== null) return `\`${dict.name}\` can't be renamed here: ${dict.read_only_reason}`;
  if (dict.external_refs > 0) return `\`${dict.name}\` is used elsewhere in the code, so it can't be renamed here.`;
  if ([...dict.users].some(user => user.uses_name(new_name))) return `A table using \`${dict.name}\` already uses \`${new_name}\`.`;
  const cm = state.cell.code_mirror;
  const range = dict.mark?.find();
  if (!range) return `\`${dict.name}\` isn't in the code anymore.`;
  const escaped = dict.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const target = (cm.getLine(range.from.line) ?? "").slice(0, range.from.ch).match(new RegExp(`^(\\s*)${escaped}(?![\\p{L}\\p{N}_])`, "u"));
  if (!target) return `\`${dict.name}\` isn't assigned at the start of its line, so it can't be renamed here.`;
  const ch = target[1].length;
  cm.replaceRange(new_name, { line: range.from.line, ch }, { line: range.from.line, ch: ch + dict.name.length }, undo_group_origin(state));
  // Under its new name, in the same place in the list.
  state.mapping_dicts = new Map([...state.mapping_dicts].map(([name, other]): [string, MappingDict] => [other === dict ? new_name : name, other]));
  dict.name = new_name;
  dict.users.forEach(user => user.on_rename());
  return null;
}

// Delete the dict's lines. The caller wraps this in an undo group.
export function delete_mapping_dict(state: State, dict: MappingDict) {
  const cm = state.cell.code_mirror;
  const range = dict.mark?.find();
  if (range) {
    // A dict that was in the code at render time has its own row in the layers panel; it
    // goes with the line.
    const layers = state.layers_panel.layers;
    const doomed_layers = layers.filter(layer => {
      const layer_range = layer.mark.find();
      return layer_range && layer_range.from.line >= range.from.line && layer_range.to.line <= range.to.line;
    });
    cm.replaceRange("", { line: range.from.line, ch: 0 }, { line: range.to.line + 1, ch: 0 }, undo_group_origin(state));
    for (const layer of doomed_layers) {
      layer.el.remove();
      layer.mark.clear();
      layer.target_mark.clear();
      layers.splice(layers.indexOf(layer), 1);
    }
  }
  if (dict.watching) dict.watching.active = false;
  dict.mark?.clear();
  dict.users.clear();
  state.mapping_dicts.delete(dict.name);
}
