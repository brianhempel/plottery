import re
import json

trivial_names = set(dir(object())) # """Returns stuff like __class__, __doc__, etc."""

def type_to_json(typ):
    # allowed = [
    # #     mypy.nodes.FuncDef,
    # #     mypy.nodes.TypeAlias,
    # #     mypy.nodes.TypeInfo,
    #     mypy.types.AnyType,
    #     mypy.types.CallableType,
    #     mypy.types.Instance,
    #     mypy.types.NoneType,
    #     mypy.types.Overloaded,
    #     mypy.types.TypeAliasType,
    #     mypy.types.TypeVarType,
    #     mypy.types.UnionType,
    # ]

    # def should_recurse(obj):
    #     if isinstance(obj, str) or isinstance(obj, float) or isinstance(obj, int) or isinstance(obj, bool) or obj is None:
    #         return True

    #     if isinstance(obj, list) or isinstance(obj, dict) or isinstance(obj, tuple):
    #         return True

    #     return any(isinstance(obj, typ) for typ in allowed)

    def extra_attrs(obj):
        return {}

    def no_nodes(obj):
        type_str = str(type(obj))
        return not 'mypy.nodes.' in type_str

    return arbitrary_to_json(typ, recurse=no_nodes, extra_attrs=extra_attrs)


# def type_node_to_json(node):

#     def extra_attrs(obj):
#         return {}

#     def no_types(obj):
#         type_str = str(type(obj))
#         return 'mypy.types.' not in type_str and 'mypy.nodes.SymbolTableNode' not in type_str and 'mypy.nodes.MypyFile' not in type_str

#     return arbitrary_to_json(node, recurse=no_types, extra_attrs=extra_attrs)


def obj_class_str(obj):
    as_str = repr(type(obj))    # "<class 'mypy.nodes.MypyFile'>"
    parts = as_str.split("'") # ['<class ', 'mypy.nodes.MypyFile', '>']

    if len(parts) == 3:
        return parts[1] # "mypy.nodes.MypyFile"
    else:
        return as_str


def arbitrary_to_json(obj, recurse=lambda obj: True, extra_attrs=lambda obj: {}):
    # Array graph: index 0 is the root; later indices are other objects in
    # discovery order. Cross-refs are integer indices (not Python id()s),
    # which keeps the JSON much smaller.
    graph = []
    id_or_str_to_index = {}
    dont_gc = [] # ensure potentially transient objects don't free up their object id's
    _arbitrary_to_json(obj, graph, id_or_str_to_index, dont_gc, recurse=recurse, extra_attrs=extra_attrs)
    return graph


def _arbitrary_to_json(obj, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs):
    obj_id = id(obj)

    if obj_id in id_or_str_to_index:
        return id_or_str_to_index[obj_id]

    index = len(graph)

    # de-duplicate strings
    if isinstance(obj, str):
        if obj in id_or_str_to_index:
            return id_or_str_to_index[obj]
        id_or_str_to_index[obj] = index
        graph.append(obj)
        return index

    id_or_str_to_index[obj_id] = index

    if isinstance(obj, int) or isinstance(obj, float) or isinstance(obj, bool) or obj is None:
        graph.append(obj)
        return index

    # Put a placeholder in the graph so we don't recurse back to us when visiting children.
    me = {}
    graph.append(me)

    if not recurse(obj):
        me['.class'] = _arbitrary_to_json(obj_class_str(obj), graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)
        return index

    if isinstance(obj, dict):
        out_dict = {key: _arbitrary_to_json(child, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs) for key, child in obj.items()}
        for key, child in extra_attrs(obj).items():
            if not (isinstance(child, str) or isinstance(child, int) or isinstance(child, float) or isinstance(child, bool) or child is None):
                dont_gc.append(child) # if child is a computed property, it could be GC'd and its index reused unless we hold a reference
            out_dict[key] = _arbitrary_to_json(child, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)
        graph[index] = out_dict
        return index

    child_dir = dir(obj)

    if "__iter__" in child_dir:
        as_list = [child for child in obj]
        dont_gc.append(as_list) # if child is a computed property, it could be GC'd and its index reused unless we hold a reference
        me = [_arbitrary_to_json(child, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs) for child in as_list]
        graph[index] = me
    else:
        me['.class'] = _arbitrary_to_json(obj_class_str(obj), graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)

        for child_name in child_dir:
            if child_name not in trivial_names and not child_name.startswith("__"):
                # Property getters may raise anything, not just AttributeError (e.g. mypy 1.16+
                # OverloadedFuncDef.setter asserts); treat any raising attribute as absent.
                try:
                    child = getattr(obj, child_name)
                except Exception:
                    me[child_name] = _arbitrary_to_json(None, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)
                    continue
                if not callable(child):
                    if not (isinstance(child, str) or isinstance(child, int) or isinstance(child, float) or isinstance(child, bool) or child is None):
                        dont_gc.append(child) # if child is a computed property, it could be GC'd and its index reused unless we hold a reference
                    # len_before = len(graph)
                    me[child_name] = _arbitrary_to_json(child, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)
                    # dlen = len(graph) - len_before
                    # if dlen > 500:
                    #     me[child_name + '_DLEN'] = _arbitrary_to_json(dlen, graph, id_or_str_to_index, recurse, extra_attrs)
                    #     print(dlen, me['.class'], child_name)

    for key, child in extra_attrs(obj).items():
        if not (isinstance(child, str) or isinstance(child, int) or isinstance(child, float) or isinstance(child, bool) or child is None):
            dont_gc.append(child) # if child is a computed property, it could be GC'd and its index reused unless we hold a reference
        me[key] = _arbitrary_to_json(child, graph, id_or_str_to_index, dont_gc, recurse, extra_attrs)

    return index




# html_chars_re = re.compile("[&<>\"']")

# def escape_html(string):
#     html_subs = {
#         "&": "&amp;",
#         "<": "&lt;",
#         ">": "&gt;",
#         '"': "&quot;",
#         "'": "&#039;",
#     }

#     return html_chars_re.sub(lambda match: html_subs[match.group(0)], string)


# def json_for_attr(x):
#     return escape_html(json.dumps(x))

# class Out:
#     def __init__(self, as_json):
#         self.json = as_json

#     def _repr_html_(self):
#         return f"""
#             hi
#             <style onload="window.last_json = {json_for_attr(self.json)}"></style>
#         """

# as_json = arbitrary_to_json(x)
# as_json = arbitrary_to_json_depth(x.defs)

# Out(as_json)

# as_json = arbitrary_to_json(my_ast)
# as_json = arbitrary_to_json(defs)
# print(len(as_json))
# exclude = set([])
# as_json = arbitrary_to_json_nocycle(my_ast, exclude=exclude)

# len(arbitrary_to_json(my_ast))
# with open("asdf.json", "w") as out:
    # out.write(json.dumps(as_json, indent=2))

# Out(as_json)