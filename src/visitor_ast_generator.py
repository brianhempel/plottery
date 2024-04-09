import ast
import enum
import inspect


# https://gist.github.com/jtpio/cb30bca7abeceae0234c9ef43eec28b4?permalink_comment_id=4551541#gistcomment-4551541
def allnodes():
    # Deprecated nodes are listed here:
    # https://docs.python.org/3/library/ast.html
    deprecated = [
        "Num",
        "Str",
        "Bytes",
        "NameConstant",
        "Ellipsis",
        "Index",
        "ExtSlice",
    ]
    ignore = ["AST"]
    for name in dir(ast):
        attr = getattr(ast, name)
        if not inspect.isclass(attr):
            continue
        if issubclass(attr, enum.Enum):
            continue
        if not issubclass(attr, ast.AST):
            continue
        if name in deprecated + ignore:
            continue
        yield name


def template(s):
    return f"""
    def visit_{s}(self, node: ast.{s}):
        print("AST Node not implemented!", ast.dump(node))
        return {{ "type": "{s}", "col_offset": node.col_offset, "lineno": node.lineno, "end_lineno": node.end_col_offset, "type_comment": node.type_comment }}
"""


def genvisitor(name):
    nodes = allnodes()
    code = ["class %s(ast.NodeVisitor):" % name]
    for node in nodes:
        code.append(template(node))
    return "".join(code)


print(genvisitor("MyVisitor"))
