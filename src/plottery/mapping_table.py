# Mapping tables: the frontend's spreadsheet editor for list comprehension arguments. Four
# forms, with or without the index, and with or without a dict of overrides:
#
#   [F for X in E]                                    [F for I, X in enumerate(E)]
#   [M.get(X, F) for X in E]                          [M.get(K, F) for I, X in enumerate(E)]  (K is I or X)
#
# e.g.
#
#   df_indicator_to_color = {0: 'red', 1: 'blue'}
#   ax.bar(..., color=[df_indicator_to_color.get(indicator, 'gray') for indicator in df['indicator']])
#
# where the dict is a literal assigned on its own line. The table edits only the
# comprehension and that dict.
#
# Two halves live here:
#
# 1. Runtime. The provenance AST transformer rewrites each such comprehension that is a
#    direct argument of a method call so every row is recorded as it actually runs (correct
#    inside loops and functions, no second evaluation of the iterable):
#
#      [M.get(X, plottery.note_mapping_row('ax.bar #1', 'color', X, M, X, lambda: F))
#       for X in plottery.mapping_table_rows('ax.bar #1', 'color', E)]
#
#    The log is keyed by (call_id, arg_key), the same key note_arg_provenance uses, and is
#    snapshotted per figure in show(). Every render class ships the snapshot to the frontend.
#
# 2. Static. GatherTypedCalls asks for each given argument's template parts, and the full
#    render lists the dicts the tables could use (mapping_dicts_json), with each editable
#    dict literal's entries and source position, so the frontend can edit it through a
#    CodeMirror mark.

import ast
import math
import re

import numpy as np
import matplotlib.colors as mcolors

from .code_helpers import char_col, _plottery_attr_call


# Shown rows (last run) and unique keys sent to the frontend, and the unique keys tracked.
ROW_CAP = 200
UNIQUE_SEND_CAP = 200
UNIQUE_TRACK_CAP = 1000
CATEGORICAL_MAX_UNIQUE = 50
REPR_MAX_LEN = 120

# Methods that only read the mapping. Calling anything else on it (update, pop, ...) means
# it's built or mutated beyond its literal, so the table shows it read-only.
READ_ONLY_DICT_METHODS = {"get", "keys", "values", "items", "copy"}


# -------------------------------------------------------- #
#                        Template                          #
# -------------------------------------------------------- #

# A list comprehension in one of the four forms above -> its parts, else None. Anything else
# (an `if`, several `for`s, other loop targets) stays an ordinary code argument, so the table
# never edits code it doesn't understand.
def match_template(node):
    if not isinstance(node, ast.ListComp) or len(node.generators) != 1:
        return None
    comprehension = node.generators[0]
    if comprehension.ifs or comprehension.is_async:
        return None

    match comprehension.target, comprehension.iter:
        case ast.Name(id=item_name), iterable:
            index_name, enumerate_call = None, None
        case ast.Tuple(elts=[ast.Name(id=index_name), ast.Name(id=item_name)]), ast.Call(func=ast.Name(id="enumerate"), args=[iterable], keywords=[]) as enumerate_call:
            if index_name == item_name:
                return None
        case _:
            return None
    if isinstance(iterable, ast.Starred):
        return None

    loop_names = {item_name, index_name} - {None}
    mapping_name, get_call, formula, key_on = None, None, node.elt, "item"
    match node.elt:
        case ast.Call(func=ast.Attribute(value=ast.Name(id=name), attr="get"), args=[ast.Name(id=key_name), default], keywords=[]) if (
            name not in loop_names and key_name in loop_names and not isinstance(default, ast.Starred)
        ):
            mapping_name, get_call, formula = name, node.elt, default
            key_on = "index" if key_name == index_name else "item"

    return {
        "mapping_name": mapping_name,
        "index_name": index_name,
        "item_name": item_name,
        "key_on": key_on,
        "listcomp": node,
        "comprehension": comprehension,
        "enumerate_call": enumerate_call,
        "get_call": get_call,
        "formula": formula,
        "iterable": iterable,
    }


# The template parts of an argument's source text, or None.
def template_parts_of_code(arg_code):
    src = f"({arg_code})" # parenthesized so a multi-line argument parses on its own
    try:
        expr = ast.parse(src, mode="eval").body
    except SyntaxError:
        return None
    parts = match_template(expr)
    if parts is None:
        return None
    formula_code = ast.get_source_segment(src, parts["formula"])
    iterable_code = ast.get_source_segment(src, parts["iterable"])
    if formula_code is None or iterable_code is None:
        return None
    return {
        "mapping_name": parts["mapping_name"],
        "index_name": parts["index_name"],
        "item_name": parts["item_name"],
        "key_on": parts["key_on"],
        "formula_code": formula_code,
        "iterable_code": iterable_code,
    }


# -------------------------------------------------------- #
#                         Values                           #
# -------------------------------------------------------- #

# numpy scalars (from iterating arrays/Series) as plain Python values, recursively in tuples.
def _plain(v):
    if isinstance(v, np.generic):
        try:
            return v.item()
        except Exception:
            return v
    if type(v) is tuple:
        return tuple(_plain(x) for x in v)
    return v


def _is_nan(v):
    try:
        return isinstance(v, (float, np.floating)) and math.isnan(v)
    except Exception:
        return False


def _short_repr(v):
    try:
        s = repr(_plain(v))
    except Exception:
        s = f"<{type(v).__name__}>"
    return s if len(s) <= REPR_MAX_LEN else s[:REPR_MAX_LEN - 1] + "…"


# Python source for v that evaluates back to an equal value, or None.
def _literal_code(v):
    v = _plain(v)
    if isinstance(v, (bool, int, float, complex, str, bytes, tuple, list, dict, set, type(None))):
        try:
            code = repr(v)
            if len(code) <= 2 * REPR_MAX_LEN and ast.literal_eval(code) == v:
                return code
        except Exception:
            pass
    return None


# A dict key literal for v (hashable and round-trippable), or None.
def _key_code(v):
    if _is_nan(v):
        return None
    try:
        hash(v)
    except Exception:
        return None
    code = _literal_code(v)
    if code is None or isinstance(ast.literal_eval(code), (list, dict, set)):
        return None
    return code


def _normalized(v):
    if isinstance(v, (bool, int, np.integer, np.bool_)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        f = float(v)
        return int(f) if f.is_integer() else f
    if isinstance(v, (str, np.str_)):
        return str(v)
    if isinstance(v, tuple):
        return tuple(_normalized(x) for x in v)
    return v


# A string that's equal for values that are equal as dict keys (so 0, 0.0, and False share
# one), letting the frontend match dict entries to columns without Python's equality rules.
def match_id_for_value(v):
    try:
        return repr(_normalized(_plain(v)))
    except Exception:
        return None


def _color_hex(v):
    v = _plain(v)
    if not isinstance(v, (str, tuple)):
        return None
    try:
        return mcolors.to_hex(v, keep_alpha=False) if mcolors.is_color_like(v) else None
    except Exception:
        return None


def _value_json(v):
    return {"repr": _short_repr(v), "hex": _color_hex(v), "code": _literal_code(v)}


def _mapped_json(mapping, key):
    if mapping is None: # no dict of overrides yet
        return None
    try:
        return _value_json(mapping[key]) if key in mapping else None
    except Exception:
        return None


# How an item shows up in a column header, and how the table can key on it.
def _item_json(item):
    key_code = _key_code(item)
    return {
        "key_code": key_code,
        "display": key_code if key_code is not None else _short_repr(item),
        "match_id": match_id_for_value(item) if key_code is not None else None,
        "is_nan": _is_nan(item),
    }


# -------------------------------------------------------- #
#                        Recorder                          #
# -------------------------------------------------------- #

class MappingTableRecorder:
    def __init__(self):
        self.n_runs = 0
        self.n_rows = 0          # rows in the last run
        self.n_rows_total = 0    # rows over all runs
        self.rows = []           # first ROW_CAP rows of the last run
        self.uniques = []        # by item, in first-seen order, merged over all runs
        self.unique_idx = {}     # hashable item -> index into uniques (dict semantics, like M.get)
        self.unique_idx_other = {} # NaN and unhashable items, by repr
        self.unique_capped = False
        self.first_item_is_stringish = None

    def _unique_index(self, i, item, mapping, key, value):
        lookup, lookup_key = self.unique_idx, item
        if _is_nan(item):
            lookup, lookup_key = self.unique_idx_other, "nan"
        else:
            try:
                hash(item)
            except Exception:
                lookup, lookup_key = self.unique_idx_other, "repr:" + _short_repr(item)

        idx = lookup.get(lookup_key)
        if idx is None:
            if len(self.uniques) >= UNIQUE_TRACK_CAP:
                self.unique_capped = True
                return None
            idx = len(self.uniques)
            lookup[lookup_key] = idx
            column = _item_json(item)
            column.update({
                "first_i": i,
                "count": 0,
                "formula": _value_json(value),
                "mapped": _mapped_json(mapping, key),
            })
            self.uniques.append(column)
        self.uniques[idx]["count"] += 1
        return idx

    # The comprehension started (again), e.g. in the next iteration of a loop.
    def start_run(self):
        self.n_runs += 1
        self.n_rows = 0
        self.rows = []

    def add(self, item, mapping, key, value):
        if self.n_runs == 0:
            self.start_run()
        i = self.n_rows
        self.n_rows += 1
        self.n_rows_total += 1
        if self.first_item_is_stringish is None:
            self.first_item_is_stringish = isinstance(_plain(item), (str, bool))

        col = self._unique_index(i, item, mapping, key, value)
        if len(self.rows) < ROW_CAP:
            row = {"i": i, "col": col, "formula": _value_json(value), "mapped": _mapped_json(mapping, key)}
            if col is None or col >= UNIQUE_SEND_CAP: # its column isn't sent, so carry the item here
                row.update(_item_json(item))
            self.rows.append(row)

    def to_json(self):
        n_unique = len(self.uniques)
        has_duplicates = self.n_rows_total > n_unique
        few_uniques = n_unique <= CATEGORICAL_MAX_UNIQUE and not self.unique_capped
        return {
            "n_runs": self.n_runs,
            "n_rows": self.n_rows,
            "rows": list(self.rows),
            "rows_capped": self.n_rows > len(self.rows),
            "columns": [dict(column) for column in self.uniques[:UNIQUE_SEND_CAP]], # copies: counts keep changing
            "n_unique": n_unique,
            "unique_capped": self.unique_capped,
            "categorical": (has_duplicates and few_uniques) or bool(self.first_item_is_stringish),
        }


# "ax.bar #1|color" -> MappingTableRecorder. Reset per cell run, snapshotted per figure in show().
mapping_rows_at_call = {}


def table_key(call_id, arg_key):
    return f"{call_id}|{arg_key}"


def reset_mapping_rows_at_call():
    mapping_rows_at_call.clear()


def snapshot_mapping_rows_at_call():
    snapshot = {}
    for key, recorder in mapping_rows_at_call.items():
        try:
            snapshot[key] = recorder.to_json()
        except Exception:
            pass
    return snapshot


def _recorder(call_id, arg_key):
    key = table_key(call_id, arg_key)
    recorder = mapping_rows_at_call.get(key)
    if recorder is None:
        recorder = mapping_rows_at_call[key] = MappingTableRecorder()
    return recorder


# Wraps the comprehension's iterable (via the AST rewrite above): each time the comprehension
# starts, a new run begins. Yields the same items, so the cell computes what it would have.
def mapping_table_rows(call_id, arg_key, iterable):
    try:
        _recorder(call_id, arg_key).start_run()
    except Exception:
        pass
    yield from iterable


# Called for each row: evaluates the default formula F, records the row, and returns F's
# value (the element itself, or the default for M.get(K, ...)), so the cell computes exactly
# what it would have without Plottery. `mapping` and `key` are None when there's no dict of
# overrides. Recording must never break user code.
def note_mapping_row(call_id, arg_key, item, mapping, key, formula_thunk):
    try:
        value = formula_thunk()
    except Exception as e:
        try:
            i = _recorder(call_id, arg_key).n_rows
            e.add_note(f"(Plottery: while computing the default for {_short_repr(item)} at index {i})")
        except Exception:
            pass
        raise

    try:
        _recorder(call_id, arg_key).add(item, mapping, key, value)
    except Exception:
        pass

    return value


# For ProvenanceTagger.visit_Call: the template comprehensions among a call's direct
# arguments, keyed like note_arg_provenance (positional index or keyword name). Matched
# before the call's children are visited, which rewrites them.
def match_table_args(call_node):
    out = []
    pos_idx = 0
    for a in call_node.args:
        if isinstance(a, ast.Starred):
            continue
        parts = match_template(a)
        if parts:
            out.append((pos_idx, parts))
        pos_idx += 1
    for kw in call_node.keywords:
        if kw.arg is None:
            continue
        parts = match_template(kw.value)
        if parts:
            out.append((kw.arg, parts))
    return out


# Does any method call in the cell have a mapping table argument? (Cheap check, so cells
# without one skip the transform on fast redraws.)
def has_table_args(tree):
    return any(
        match_table_args(node)
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    )


# Rewrite the comprehension so it records each row:
#
#   [F for X in E]            ->  [plottery.note_mapping_row(..., X, None, None, lambda: F) for X in plottery.mapping_table_rows(..., E)]
#   [M.get(K, F) for X in E]  ->  [M.get(K, plottery.note_mapping_row(..., X, M, K, lambda: F)) for X in plottery.mapping_table_rows(..., E)]
#
# (and likewise inside enumerate(...)). Runs after the call's children were visited, so F
# and E are already rewritten and our inserted calls aren't themselves tagged. The nodes in
# `parts` are the same objects after the visit; a .get call stays in place, so call
# numbering matches GatherTypedCalls.
def instrument_table_args(table_args, call_id):
    for arg_key, parts in table_args:
        def note_row(formula):
            return _plottery_attr_call("note_mapping_row", [
                ast.Constant(call_id),
                ast.Constant(arg_key),
                ast.Name(parts["item_name"], ast.Load()),
                ast.Name(parts["mapping_name"], ast.Load()) if parts["mapping_name"] else ast.Constant(None),
                ast.Name(parts["index_name"] if parts["key_on"] == "index" else parts["item_name"], ast.Load()) if parts["mapping_name"] else ast.Constant(None),
                ast.Lambda(
                    ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
                    formula,
                ),
            ])

        if parts["get_call"] is not None:
            parts["get_call"].args[1] = note_row(parts["get_call"].args[1])
        else:
            parts["listcomp"].elt = note_row(parts["listcomp"].elt)

        def rows(iterable):
            return _plottery_attr_call("mapping_table_rows", [ast.Constant(call_id), ast.Constant(arg_key), iterable])

        if parts["enumerate_call"] is not None:
            parts["enumerate_call"].args[0] = rows(parts["enumerate_call"].args[0])
        else:
            parts["comprehension"].iter = rows(parts["comprehension"].iter)


# -------------------------------------------------------- #
#                  Static: the mapping dict                #
# -------------------------------------------------------- #

# Comment out IPython magics (%..., !...) so the cell parses, keeping line numbers.
def _without_magics(code):
    return re.sub(r"^([ \t]*)[%!]", r"\1#", code, flags=re.MULTILINE)


# Does assigning to `target` (re)bind `name`, or store into it (name[k] = ..., name.a = ...)?
def _binds_or_mutates(target, name):
    match target:
        case ast.Name(id=target_name):
            return target_name == name
        case ast.Tuple(elts=elts) | ast.List(elts=elts):
            return any(_binds_or_mutates(e, name) for e in elts)
        case ast.Starred(value=value):
            return _binds_or_mutates(value, name)
        case ast.Subscript(value=ast.Name(id=target_name)) | ast.Attribute(value=ast.Name(id=target_name)):
            return target_name == name
    return False


class CellNames:
    """The current cell's Python AST, for finding a mapping's dict literal and its references."""

    def __init__(self, notebook_code_lines, cell_lineno):
        self.notebook_code_lines = notebook_code_lines
        self.cell_lineno = cell_lineno
        self.src = "\n".join(notebook_code_lines[cell_lineno - 1:])
        try:
            self.tree = ast.parse(_without_magics(self.src))
        except SyntaxError:
            self.tree = None

    # Notebook coordinates (1-based line, character column), as add_pos_json produces.
    def notebook_line_col(self, lineno, byte_col):
        line = lineno + self.cell_lineno - 1
        return line, char_col(self.notebook_code_lines, line, byte_col)

    def pos(self, node):
        line, column = self.notebook_line_col(node.lineno, node.col_offset)
        end_line, end_column = self.notebook_line_col(node.end_lineno, node.end_col_offset)
        return {"line": line, "column": column, "end_line": end_line, "end_column": end_column}

    # How the cell uses `name`: its plain assignments (statement, target Name, value), whether
    # anything else binds or changes it, and every reference to it (targets included).
    def _uses(self, name):
        assignments = []
        mutated = False
        refs = []
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == name:
                        assignments.append((node, target, node.value))
                    elif _binds_or_mutates(target, name):
                        mutated = True
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id == name:
                assignments.append((node, node.target, node.value))
            elif isinstance(node, (ast.AugAssign, ast.For, ast.comprehension, ast.NamedExpr)):
                mutated = mutated or _binds_or_mutates(node.target, name)
            elif isinstance(node, ast.Delete):
                mutated = mutated or any(_binds_or_mutates(t, name) for t in node.targets)
            elif isinstance(node, ast.With):
                mutated = mutated or any(_binds_or_mutates(item.optional_vars, name) for item in node.items if item.optional_vars)
            elif (isinstance(node, ast.Call)
                  and isinstance(node.func, ast.Attribute)
                  and isinstance(node.func.value, ast.Name)
                  and node.func.value.id == name
                  and node.func.attr not in READ_ONLY_DICT_METHODS):
                mutated = True
            if isinstance(node, ast.Name) and node.id == name:
                refs.append(node)
        assignments.sort(key=lambda a: (a[0].lineno, a[0].col_offset))
        return assignments, mutated, refs

    # The entries of the {...} literal `value` assigned to `name`, or the reason the table can't
    # edit it: (entries, None) or (None, reason).
    def _literal_entries(self, name, value):
        if not isinstance(value, ast.Dict):
            return None, f"`{name}` isn't assigned a {{...}} dict literal."
        entries = []
        for k, v in zip(value.keys, value.values):
            if k is None:
                return None, f"`{name}` unpacks another dict with **."
            key_src = ast.get_source_segment(self.src, k)
            value_src = ast.get_source_segment(self.src, v)
            try:
                key_value = ast.literal_eval(k)
                hash(key_value)
            except Exception:
                return None, f"`{name}` has a key that isn't a literal: {key_src}"
            if key_src is None or value_src is None:
                return None, "This cell couldn't be parsed."
            entries.append({"key_code": key_src, "value_code": value_src, "match_id": match_id_for_value(key_value)})
        return entries, None

    # When the last override is removed, the frontend deletes the dict's lines (from the dict's
    # first line through its last). That's only safe if its statement is alone on those lines.
    def _alone_on_its_lines(self, stmt, value):
        lines = self.src.split("\n")
        before = lines[stmt.lineno - 1].encode("utf-8")[:stmt.col_offset].decode("utf-8", "replace")
        after = lines[stmt.end_lineno - 1].encode("utf-8")[stmt.end_col_offset:].decode("utf-8", "replace")
        return (
            stmt.lineno == value.lineno
            and stmt.end_lineno == value.end_lineno
            and before.strip() == ""
            and (after.strip() == "" or after.strip().startswith("#"))
        )

    # The names this cell assigns a {...} literal to.
    def dict_literal_names(self):
        if self.tree is None:
            return set()
        names = set()
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
                names.update(t.id for t in node.targets if isinstance(t, ast.Name))
            elif isinstance(node, ast.AnnAssign) and isinstance(node.value, ast.Dict) and isinstance(node.target, ast.Name):
                names.add(node.target.id)
        return names

    # The cell's function and class definitions, for the frontend to tell which dicts a call
    # can see: a dict assigned in a def is only visible inside it, and one in a class body only
    # to code directly in that body.
    def scopes_json(self):
        if self.tree is None:
            return []
        return [
            {"pos": self.pos(node), "kind": "class" if isinstance(node, ast.ClassDef) else "def"}
            for node in ast.walk(self.tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
        ]

    # A dict a table's overrides could switch to, with no particular call in mind (the frontend
    # checks that it's assigned above the call, in a scope the call can see). One of:
    #   in another cell:          {name, in_cell: False, editable: False, reason}
    #   in this cell, read-only:  {name, in_cell: True, editable: False, reason, assign_pos (or None)}
    #   in this cell, editable:   {name, in_cell: True, editable: True, reason: None, value_pos, entries,
    #                              alone (on its lines), n_refs (references to it in the cell, its target included)}
    def cell_dict_info(self, name):
        if self.tree is None:
            return {"name": name, "in_cell": False, "editable": False, "reason": "This cell couldn't be parsed."}
        assignments, mutated, refs = self._uses(name)
        if not assignments:
            if mutated:
                return {"name": name, "in_cell": True, "editable": False, "reason": f"`{name}` is changed in this cell.", "assign_pos": None}
            return {"name": name, "in_cell": False, "editable": False, "reason": f"`{name}` is defined in another cell."}
        stmt, target, value = assignments[0]
        def read_only(reason):
            return {"name": name, "in_cell": True, "editable": False, "reason": reason, "assign_pos": self.pos(stmt)}
        if len(assignments) > 1 or mutated:
            return read_only(f"`{name}` is reassigned or changed elsewhere in this cell.")
        entries, reason = self._literal_entries(name, value)
        if reason is not None:
            return read_only(reason)
        return {
            "name": name,
            "in_cell": True,
            "editable": True,
            "reason": None,
            "value_pos": self.pos(value),
            "entries": entries,
            "alone": self._alone_on_its_lines(stmt, value),
            "n_refs": len(refs),
        }


MAX_MAPPING_DICTS = 100

# The dicts a table's overrides could use: the user's dict variables, and the dict literals
# this cell assigns (which may not have run yet). This cell's first, in order, then the rest by
# name. With the cell's scopes (see CellNames.scopes_json).
def mapping_dicts_json(locals, user_nameset, cell_names):
    names = {
        name for name, value in locals.items()
        if name in user_nameset and not name.startswith("_") and isinstance(value, dict)
    }
    names |= cell_names.dict_literal_names()
    infos = [cell_names.cell_dict_info(name) for name in names]
    def order(info):
        pos = info.get("value_pos") or info.get("assign_pos")
        return (0, pos["line"], pos["column"], info["name"]) if pos else (1, 0, 0, info["name"])
    return {"dicts": sorted(infos, key=order)[:MAX_MAPPING_DICTS], "scopes": cell_names.scopes_json()}


# The frontend's MappingTableInfo for a given argument, or None if it isn't a template.
def mapping_table_info(arg_code, call_id, arg_key, snapshot):
    if arg_code is None:
        return None
    parts = template_parts_of_code(arg_code)
    if parts is None:
        return None
    key = table_key(call_id, arg_key)
    parts["table_key"] = key
    parts["runtime"] = snapshot.get(key)
    return parts
