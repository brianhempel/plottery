import { Arg, CallableType, Position } from "../state";
import { takeWhile } from "../utils/array";
import { arg_defaults_from_callee_type } from "../utils/misc";

export function make_call_widget(
  callee: CallableType & {
    pos: Position;
  },
  given_positional_args: Arg[],
  given_keyword_args: Arg[],
  callee_code: string,
  cm: CodeMirror.DocOrEditor,
  mark: CodeMirror.TextMarker<CodeMirror.MarkerRange>
) {
  const arg_defaults = arg_defaults_from_callee_type(callee);

  const missing_positional_args = takeWhile(
    arg_defaults.slice(given_positional_args.length),
    (arg) => arg.kind === "ARG_POS"
  );

  const missing_keyword_args = arg_defaults
    .slice(given_positional_args.length)
    .slice(missing_positional_args.length)
    .filter(
      (arg) =>
        !given_keyword_args.some((given_arg) => given_arg.name === arg.name)
    )
    .filter((arg) => arg.kind !== "ARG_STAR2"); // ignore **kwargs

  const needed_positional_args = takeWhile(
    missing_positional_args,
    (arg) => arg.kind === "ARG_POS"
  );

  const missing_optional_positional_arg_els = missing_positional_args.slice(
    needed_positional_args.length
  );
}
