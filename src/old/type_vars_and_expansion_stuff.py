from mypy.expandtype import freshen_function_type_vars
from mypy.types import (
    CallableType, get_proper_type, Type, UnpackType,
)
from mypy.infer import ArgumentInferContext
import mypy.subtypes
from mypy.nodes import ArgKind, Expression
from mypy.checker import TypeChecker
from mypy.argmap import ArgTypeExpander


def is_arg_subtype(
    arg_type: Type,
    arg_index: int,
    callee: CallableType,
    chk: TypeChecker,
) -> bool:
    # Freshen any type variables in the callee
    callee = callee.with_unpacked_kwargs().with_normalized_var_args()
    callee = freshen_function_type_vars(callee)

    infer_context = ArgumentInferContext(chk.named_type("typing.Mapping"), chk.named_type("typing.Iterable"))

    proper_callee_arg_type = get_proper_type(callee.arg_types[arg_index])
    expander = ArgTypeExpander(infer_context)

    expanded_arg_type = expander.expand_actual_type(
        arg_type,
        callee.arg_kinds[arg_index],
        callee.arg_names[arg_index] if callee.arg_names else None,
        callee.arg_kinds[arg_index],
        allow_unpack=isinstance(callee.arg_types[arg_index], UnpackType),
    )

    print(expanded_arg_type,proper_callee_arg_type)

    return mypy.subtypes.is_subtype(expanded_arg_type, proper_callee_arg_type)

# ax_bar_call = snp.type_tree.defs[10].expr
# array_like = snp.mypy_result.types.get(ax_bar_call.callee).arg_types[0]
# bar_type = snp.mypy_result.types.get(ax_bar_call.callee)
# bar_type
# bar_type_unapplied = bar_type.definition.type
# bar_type_unapplied
# len(bar_type_unapplied.arg_types)
# len(bar_type_unapplied.arg_kinds)
# is_arg_subtype(my_tuple_type, 1, bar_type_unapplied, snp.type_graph['__temp'].type_checker())