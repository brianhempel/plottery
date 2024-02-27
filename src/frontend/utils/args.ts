import {
  Arg,
  CallInfo,
  CallWithArgs,
  CallableType,
  Model,
  Position,
  SelectableArtist,
} from "../state";
import { partition, takeWhile } from "./array";
import CodeMirror from "./codemirror";
import {
  arg_defaults_from_callee_type,
  item_to_end_pos,
  item_to_start_pos,
} from "./misc";
import { get_arg_kind_from_int } from "./types";

export function get_all_calls_and_methods(m: Model) {
  let all_calls_and_methods: {
    [key: string]: { calls: CallWithArgs[]; methods: null };
  } = {};

  m.selectable_artists.forEach(artist => {
    const artist_method_infos = m.methods.filter(method =>
      method.show_on.includes(artist.id)
    );

    const artist_call_infos = m.calls.filter(call_info =>
      call_info.show_on.includes(artist.id)
    );

    const artist_calls = get_calls(
      artist,
      artist_call_infos,
      m.cell_lineno,
      m.cell.code_mirror
    );

    all_calls_and_methods[artist.id] = {
      calls: artist_calls,
      methods: null,
    };
  });

  return all_calls_and_methods;
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
      args,
      arg => arg.name == null
    );

    const {
      missing_positional_args,
      missing_keyword_args,
      needed_positional_args,
      missing_optional_positional_args,
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
      name: given_arg.name,
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
  const arg_defaults = arg_defaults_from_callee_type(callee);

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
    )
    .filter(arg => arg.kind !== "ARG_STAR2"); // ignore **kwargs

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
  };
}
