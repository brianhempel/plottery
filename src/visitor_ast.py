import ast


class MyVisitor(ast.NodeVisitor):
    def visit_Add(self, node: ast.Add):
        return {"type": "Add"}

    def visit_And(self, node: ast.And):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "And",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_AnnAssign(self, node: ast.AnnAssign):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AnnAssign",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Assert(self, node: ast.Assert):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Assert",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Assign(self, node: ast.Assign):
        return {
            "type": "Assign",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "value": self.visit(node.value),
            "targets": [self.visit(target) for target in node.targets],
        }

    def visit_AsyncFor(self, node: ast.AsyncFor):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AsyncFor",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AsyncFunctionDef",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_AsyncWith(self, node: ast.AsyncWith):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AsyncWith",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Attribute(self, node: ast.Attribute):
        return {
            "type": "Attribute",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "value": self.visit(node.value),
            "attr": node.attr,
            "ctx": self.visit(node.ctx),
        }

    def visit_AugAssign(self, node: ast.AugAssign):
        return {
            "type": "AugAssign",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "value": self.visit(node.value),
            "target": self.visit(node.target),
            "op": self.visit(node.op),
        }

    def visit_AugLoad(self, node: ast.AugLoad):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AugLoad",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_AugStore(self, node: ast.AugStore):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "AugStore",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Await(self, node: ast.Await):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Await",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_BinOp(self, node: ast.BinOp):
        return {
            "type": "BinOp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "left": self.visit(node.left),
            "right": self.visit(node.right),
            "op": self.visit(node.op),
        }

    def visit_BitAnd(self, node: ast.BitAnd):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "BitAnd",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_BitOr(self, node: ast.BitOr):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "BitOr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_BitXor(self, node: ast.BitXor):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "BitXor",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_BoolOp(self, node: ast.BoolOp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "BoolOp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Break(self, node: ast.Break):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Break",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Call(self, node: ast.Call):
        return {
            "type": "Call",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "func": self.visit(node.func),
            "args": [self.visit(arg) for arg in node.args],
            "keywords": [self.visit(keyword) for keyword in node.keywords],
        }

    def visit_ClassDef(self, node: ast.ClassDef):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "ClassDef",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Compare(self, node: ast.Compare):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Compare",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Constant(self, node: ast.Constant):
        return {
            "type": "Constant",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "value": node.value,
            "kind": node.kind,
        }

    def visit_Continue(self, node: ast.Continue):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Continue",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Del(self, node: ast.Del):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Del",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Delete(self, node: ast.Delete):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Delete",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Dict(self, node: ast.Dict):
        return {
            "type": "Dict",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "keys": [
                self.visit(k) if k is not None else None for k in node.keys
            ],
            "values": [self.visit(v) for v in node.values],
        }

    def visit_DictComp(self, node: ast.DictComp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "DictComp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Div(self, node: ast.Div):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Div",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Eq(self, node: ast.Eq):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Eq",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "ExceptHandler",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Expr(self, node: ast.Expr):
        return {
            "type": "Expr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "value": self.visit(node.value),
        }

    def visit_Expression(self, node: ast.Expression):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Expression",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_FloorDiv(self, node: ast.FloorDiv):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "FloorDiv",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_For(self, node: ast.For):
        return {
            "type": "For",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "target": self.visit(node.target),
            "iter": self.visit(node.iter),
            "body": [self.visit(stmt) for stmt in node.body],
            "orelse": [self.visit(stmt) for stmt in node.orelse],
        }

    def visit_FormattedValue(self, node: ast.FormattedValue):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "FormattedValue",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_FunctionDef(self, node: ast.FunctionDef):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "FunctionDef",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_FunctionType(self, node: ast.FunctionType):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "FunctionType",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_GeneratorExp(self, node: ast.GeneratorExp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "GeneratorExp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Global(self, node: ast.Global):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Global",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Gt(self, node: ast.Gt):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Gt",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_GtE(self, node: ast.GtE):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "GtE",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_If(self, node: ast.If):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "If",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_IfExp(self, node: ast.IfExp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "IfExp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Import(self, node: ast.Import):
        return {
            "type": "Import",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "names": [self.visit(name) for name in node.names],
        }

    def visit_ImportFrom(self, node: ast.ImportFrom):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "ImportFrom",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_In(self, node: ast.In):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "In",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Interactive(self, node: ast.Interactive):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Interactive",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Invert(self, node: ast.Invert):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Invert",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Is(self, node: ast.Is):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Is",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_IsNot(self, node: ast.IsNot):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "IsNot",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_JoinedStr(self, node: ast.JoinedStr):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "JoinedStr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_LShift(self, node: ast.LShift):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "LShift",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Lambda(self, node: ast.Lambda):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Lambda",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_List(self, node: ast.List):
        return {
            "type": "List",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "elts": [self.visit(expr) for expr in node.elts],
            "ctx": self.visit(node.ctx),
        }

    def visit_ListComp(self, node: ast.ListComp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "ListComp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Load(self, node: ast.Load):
        return {"type": "Load"}

    def visit_Lt(self, node: ast.Lt):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Lt",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_LtE(self, node: ast.LtE):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "LtE",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatMult(self, node: ast.MatMult):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatMult",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Match(self, node: ast.Match):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Match",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchAs(self, node: ast.MatchAs):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchAs",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchClass(self, node: ast.MatchClass):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchClass",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchMapping(self, node: ast.MatchMapping):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchMapping",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchOr(self, node: ast.MatchOr):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchOr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchSequence(self, node: ast.MatchSequence):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchSequence",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchSingleton(self, node: ast.MatchSingleton):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchSingleton",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchStar(self, node: ast.MatchStar):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchStar",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_MatchValue(self, node: ast.MatchValue):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "MatchValue",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Mod(self, node: ast.Mod):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Mod",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Module(self, node: ast.Module):
        return {
            "type": "Module",
            "body": [self.visit(stmt) for stmt in node.body],
        }

    def visit_Mult(self, node: ast.Mult):
        return {"type": "Mult"}

    def visit_Name(self, node: ast.Name):
        return {
            "type": "Name",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "id": node.id,
            "ctx": self.visit(node.ctx),
        }

    def visit_NamedExpr(self, node: ast.NamedExpr):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "NamedExpr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Nonlocal(self, node: ast.Nonlocal):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Nonlocal",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Not(self, node: ast.Not):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Not",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_NotEq(self, node: ast.NotEq):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "NotEq",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_NotIn(self, node: ast.NotIn):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "NotIn",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Or(self, node: ast.Or):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Or",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Param(self, node: ast.Param):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Param",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Pass(self, node: ast.Pass):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Pass",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Pow(self, node: ast.Pow):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Pow",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_RShift(self, node: ast.RShift):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "RShift",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Raise(self, node: ast.Raise):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Raise",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Return(self, node: ast.Return):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Return",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Set(self, node: ast.Set):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Set",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_SetComp(self, node: ast.SetComp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "SetComp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Slice(self, node: ast.Slice):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Slice",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Starred(self, node: ast.Starred):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Starred",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Store(self, node: ast.Store):
        return {
            "type": "Store",
        }

    def visit_Sub(self, node: ast.Sub):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Sub",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Subscript(self, node: ast.Subscript):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Subscript",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Suite(self, node: ast.Suite):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Suite",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Try(self, node: ast.Try):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Try",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Tuple(self, node: ast.Tuple):
        return {
            "type": "Tuple",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "elts": [self.visit(expr) for expr in node.elts],
            "ctx": self.visit(node.ctx),
        }

    def visit_TypeIgnore(self, node: ast.TypeIgnore):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "TypeIgnore",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_UAdd(self, node: ast.UAdd):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "UAdd",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_USub(self, node: ast.USub):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "USub",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_UnaryOp(self, node: ast.UnaryOp):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "UnaryOp",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_While(self, node: ast.While):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "While",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_With(self, node: ast.With):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "With",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_Yield(self, node: ast.Yield):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "Yield",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_YieldFrom(self, node: ast.YieldFrom):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "YieldFrom",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_alias(self, node: ast.alias):
        return {
            "type": "alias",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "name": node.name,
            "asname": node.asname,
        }

    def visit_arg(self, node: ast.arg):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "arg",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_arguments(self, node: ast.arguments):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "arguments",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_boolop(self, node: ast.boolop):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "boolop",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_cmpop(self, node: ast.cmpop):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "cmpop",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_comprehension(self, node: ast.comprehension):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "comprehension",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_excepthandler(self, node: ast.excepthandler):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "excepthandler",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_expr(self, node: ast.expr):
        return {
            "type": "expr",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_expr_context(self, node: ast.expr_context):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "expr_context",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_keyword(self, node: ast.keyword):
        return {
            "type": "keyword",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
            "arg": node.arg,
            "value": self.visit(node.value),
        }

    def visit_match_case(self, node: ast.match_case):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "match_case",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_mod(self, node: ast.mod):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "mod",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_operator(self, node: ast.operator):
        return {
            "type": "operator",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_pattern(self, node: ast.pattern):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "pattern",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_slice(self, node: ast.slice):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "slice",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_stmt(self, node: ast.stmt):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "stmt",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_type_ignore(self, node: ast.type_ignore):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "type_ignore",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_unaryop(self, node: ast.unaryop):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "unaryop",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }

    def visit_withitem(self, node: ast.withitem):
        print("AST Node not implemented!", ast.dump(node))
        return {
            "type": "withitem",
            "col_offset": node.col_offset,
            "lineno": node.lineno,
            "end_lineno": node.end_col_offset,
        }
