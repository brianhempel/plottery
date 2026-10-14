# Small source-code helpers shared by __init__.py and mapping_table.py (which __init__.py
# imports before defining its own helpers, so they can't live there).

import ast


# mypy and CPython's `ast` report columns as UTF-8 *byte* offsets, but both our slicing of
# notebook_code_lines (code_at_range) and the frontend's CodeMirror marks (ch = pos.column) treat them
# as character offsets. They agree only for ASCII; a non-ASCII character earlier on the line
# (e.g. "≥" is 3 bytes but 1 char) shifts every following offset, so arg/call source slices
# and marks land wrong and a GUI writeback corrupts the cell. Convert byte offsets to
# character (code-point) offsets against the real source line. (Astral-plane characters,
# which are 2 UTF-16 units in a CodeMirror `ch`, remain a rare edge case.)
def byte_col_to_char_col(line_str, byte_col):
    if byte_col is None or byte_col <= 0 or line_str.isascii():
        return byte_col
    return len(line_str.encode("utf-8")[:byte_col].decode("utf-8", "replace"))


# Convert a (1-based line, byte column) into a character column, guarding out-of-range lines.
def char_col(notebook_code_lines, line, byte_col):
    if line is None or byte_col is None or line < 1 or line > len(notebook_code_lines):
        return byte_col
    return byte_col_to_char_col(notebook_code_lines[line - 1], byte_col)


def _plottery_attr_call(func_name, args):
    # plottery.<func_name>(*args)
    return ast.Call(
        ast.Attribute(ast.Name('plottery', ast.Load()), func_name, ast.Load()),
        args,
        [],
    )
