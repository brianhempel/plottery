import {
  Arg,
  CallInfo,
  CallWithArgs,
  CallableType,
  MethodInfo,
  MethodWithArgs,
  Model,
  Position,
  SelectableArtist,
  TypeAliasType,
  TypedDictType,
} from "../state";
import { partition, takeWhile } from "./array";
import CodeMirror from "./codemirror";
import {
  arg_defaults_from_callee_type,
  item_to_end_pos,
  item_to_start_pos,
} from "./misc";
import { get_shortest_qualified_name } from "./names";
import { get_arg_kind_from_int } from "./types";

export function get_all_calls_and_methods(m: Model) {
  let all_calls_and_methods: {
    [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
  } = {};

  m.selectable_artists.forEach(artist => {
    // const artist_method_infos = m.methods.filter(method =>
    //   method.show_on.includes(artist.id)
    // );

    // const artist_call_infos = m.calls.filter(call_info =>
    //   call_info.show_on.includes(artist.id)
    // );

    const artist_call_infos = m.calls.filter(call_info => {
      return call_info.show_on.at(-1) == artist.id;
    });

    let artist_method_infos = m.methods.filter(method => {
      return method.show_on.at(-1) == artist.id;
    });

    // artist_method_infos.filter(method => {
    //   artist_call_infos.find(call => call.func_code_and_num[0] == `${method.receiver}.${method.name}`
    // })

    const artist_calls = get_calls(
      artist,
      artist_call_infos,
      m.cell_lineno,
      m.cell.code_mirror
    );

    let artist_methods = get_methods(
      artist,
      artist_method_infos,
      m.selectable_artists,
      m.cell.code_mirror
    );

    // Filter out methods that're already called
    artist_methods = artist_methods.filter(method => {
      const is_already_called = artist_calls.find(
        call =>
          call.call_info.func_code_and_num[0] ==
          `${method.receiver_name}.${method.method_info.name}`
      );

      return !(method.method_info.max_calls == 1 && is_already_called);
    });

    all_calls_and_methods[artist.id] = {
      calls: artist_calls,
      methods: artist_methods,
    };
  });

  return all_calls_and_methods;
}

export function get_methods(
  artist: SelectableArtist,
  method_infos: MethodInfo[],
  artists: SelectableArtist[],
  code_mirror: CodeMirror.DocOrEditor
): MethodWithArgs[] {
  return method_infos.map(method_info => {
    let receiver_name = get_shortest_qualified_name(
      artists.find(other_artist => other_artist.id == method_info.receiver)!
        .names || [""]
    );

    let arg_defaults = arg_defaults_from_callee_type(method_info.type);

    let [required_positional_arg, required_keyword_args] = partition(
      arg_defaults.filter(
        arg => arg.kind == "ARG_POS" || arg.kind == "ARG_NAMED"
      ),
      arg => arg.kind == "ARG_POS"
    );

    let required_positional_arg_codes = required_positional_arg.map(
      arg => arg.code
    );

    let required_keyword_arg_codes = required_keyword_args.map(
      arg => `${arg.name}=${arg.code}`
    );

    let code_prefix = `${receiver_name}.${method_info.name}`;
    let code = `${code_prefix}(${required_positional_arg_codes
      .concat(required_keyword_arg_codes)
      .join(",")})\n`;

    return {
      method_info,
      code,
      required_positional_arg,
      required_keyword_args,
      receiver_name,
    };
  });
}

export function get_calls(
  artist: SelectableArtist,
  artist_call_infos: CallInfo[],
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): CallWithArgs[] {
  return artist_call_infos.map(call_info => {
    const args = get_args(call_info, cell_lineno, code_mirror);

    const [given_positional_args, given_keyword_args] = partition(
      args.filter(arg => arg.name != "kwargs"),
      arg => arg.is_positional
    );

    const {
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args,
      kwargs,
    } = segment_args(
      call_info.callee,
      given_positional_args,
      given_keyword_args
    );

    return {
      call_info,
      given_positional_args,
      given_keyword_args,
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args,
      kwargs,
    };
  });
}

export function get_args(
  call_info: CallInfo,
  cell_lineno: number,
  code_mirror: CodeMirror.DocOrEditor
): Arg[] {
  let callee_has_self_arg = call_info.callee.def_extras.first_arg !== undefined;

  let args: Arg[] = [];

  call_info.given_args.forEach((given_arg, arg_i: number) => {
    const arg_kind = get_arg_kind_from_int(given_arg.kind);
    const arg_i_at_func_def = given_arg["name"]
      ? call_info.callee.arg_names.indexOf(given_arg.name)
      : callee_has_self_arg
      ? arg_i + 1
      : arg_i;

    const arg_val_code = code_mirror.getRange(
      item_to_start_pos(given_arg, cell_lineno),
      item_to_end_pos(given_arg, cell_lineno)
    );

    args.push({
      name: call_info.callee.arg_names[arg_i_at_func_def],
      is_positional: given_arg.name == null,
      kind: arg_kind,
      code: arg_val_code,
      type: call_info.callee.arg_types[arg_i_at_func_def],
      code_type: undefined,
      type_compatible_local_names:
        call_info.callee.arg_type_compatible_local_names[arg_i_at_func_def],
    });
  });

  return args;
}

export function segment_args(
  callee: CallableType & {
    pos: Position;
  },
  given_positional_args: Arg[],
  given_keyword_args: Arg[]
) {
  let arg_defaults = arg_defaults_from_callee_type(callee);

  const kwargs_alias = arg_defaults.find(arg => arg.name == "kwargs");

  const kwargs_items = (
    (kwargs_alias?.type as TypeAliasType)?.resolved as TypedDictType
  )?.items;

  const kwargs: Arg[] | null = kwargs_items
    ? kwargs_items.map(([name, item]) => {
        return {
          name,
          kind: "ARG_NAMED",
          code: kwargs_alias!.code,
          type: item,
          code_type: kwargs_alias!.code_type,
          type_compatible_local_names: [],
          is_positional: false,
        };
      })
    : null;

  arg_defaults = arg_defaults.filter(arg => arg.name != "kwargs");

  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    arg => arg.kind === "ARG_POS"
  ); // we could also look for arg.kind === "ARG_OPT" here,
  // but optional positional args look nicer when given as keyword args

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      arg => !given_keyword_args.some(given_arg => given_arg.name === arg.name)
    );
  // .filter(arg => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  // if used for a new call, required args need to be generated
  let needed_positional_args = takeWhile(
    missing_positional_args,
    arg => arg.kind === "ARG_POS"
  );

  let missing_optional_positional_args = missing_positional_args.slice(
    needed_positional_args.length
  );

  return {
    missing_positional_args,
    missing_keyword_args,
    needed_positional_args,
    missing_optional_positional_args,
    kwargs,
  };
}
