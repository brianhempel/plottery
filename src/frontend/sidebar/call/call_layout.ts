// The formatting around a call's arguments (line breaks, indentation, comments, trailing
// comma, keyword/star prefixes as written), captured from the source at render time so a GUI
// edit rewrites only argument values instead of flattening the call onto one line.
//
//   ax.bar(data,           head           = "ax.bar("
//     width=0.5,  # half   slots          = [{ indent: "",   prefix: "",       trail: "\n"         },
//   )                                        { indent: "  ", prefix: "width=", trail: "  # half\n" }]
//                          close_indent   = ""
//                          trailing_comma = true
//
// The layout is just the source split into pieces, so rendering the unmodified args always
// reproduces the source exactly.
export type CallLayout = {
  head: string;           // source through "(" and through the last line break before the first arg
  slots: LayoutSlot[];    // one per given arg, in source order
  close_indent: string;   // whitespace before ")"
  trailing_comma: boolean;
};

// `prefix` and `suffix` belong to the arg and move with it. `indent` and `trail` are the
// separator formatting around the arg's position, and get reassigned as args come and go.
export type LayoutSlot = {
  indent: string; // whitespace before the arg
  prefix: string; // source between the indent and the value: "", "*", "**", "width = ", or e.g. "(" if the value is parenthesized
  suffix: string; // source between the value and its comma: e.g. " " or ")"
  trail: string;  // after the comma, through the last line break before the next arg (or ")"); "" if none
};

type LayoutItem = LayoutSlot & { value: string };

// `text` is the call's full source; `callee_end` and `arg_ranges` (the given arg values, in
// source order) are offsets into it.
export function capture_call_layout(text: string, callee_end: number, arg_ranges: [number, number][]): CallLayout {
  const open_paren = callee_end + mask(text.slice(callee_end)).indexOf("(");
  const head_through_paren = text.slice(0, open_paren + 1);

  // A generator expression as the sole arg, `f(x for x in y)`, has a position spanning the
  // call's parens. Its value then includes those parens, so edits will render `f((x for x in y))`.
  if (arg_ranges.length === 1 && arg_ranges[0][0] <= open_paren) {
    return { head: head_through_paren, slots: [{ indent: "", prefix: "", suffix: "", trail: "" }], close_indent: "", trailing_comma: false };
  }

  // The gaps around the args: after "(", between each pair of args, and before ")"
  const bounds = [open_paren + 1, ...arg_ranges.flat(), text.length - 1];
  const gaps: ReturnType<typeof split_gap>[] = [];
  for (let i = 0; i < bounds.length; i += 2) {
    gaps.push(split_gap(text.slice(bounds[i], bounds[i + 1]), i === 0));
  }
  const last_gap = gaps[gaps.length - 1];

  return {
    head: head_through_paren + gaps[0].trail,
    slots: gaps.slice(1).map((gap_after, i) => ({ indent: gaps[i].indent, prefix: gaps[i].prefix, suffix: gap_after.suffix, trail: gap_after.trail })),
    close_indent: last_gap.indent,
    trailing_comma: last_gap.comma,
  };
}

// Splits the source between two args into SUFFIX [","] TRAIL INDENT PREFIX. The gap after "("
// has no suffix, and the gap before ")" has no prefix.
function split_gap(gap: string, is_after_paren: boolean) {
  const comma = mask(gap).indexOf(",");
  const suffix = comma !== -1 ? gap.slice(0, comma) : is_after_paren ? "" : strip_trailing_trivia(gap);
  const lead = gap.slice(comma !== -1 ? comma + 1 : suffix.length);
  const prefix_start = mask(lead).search(/\S|$/);
  const trail_end = lead.lastIndexOf("\n", prefix_start - 1) + 1;
  return { suffix, comma: comma !== -1, trail: lead.slice(0, trail_end), indent: lead.slice(trail_end, prefix_start), prefix: lead.slice(prefix_start) };
}

// Blanks out comments and line continuations (preserving length), so that in the source
// between args, which has no strings, any non-whitespace char is code.
function mask(str: string): string {
  return str.replace(/#.*|\\\n/g, match => " ".repeat(match.length));
}

function strip_trailing_trivia(str: string): string {
  return str.slice(0, mask(str).trimEnd().length);
}

function strip_comments(trivia: string): string {
  return trivia.replace(/[ \t]*#.*$/gm, "");
}

// Renders the call with the given args' new values in their original formatting.
//
// `given` are the (still enabled) args the call was written with, by slot index. New args
// take their formatting from their neighbors: positional ones go after the last plain
// positional arg (not a keyword, *, or ** arg), keyword ones at the end.
export function render_call_layout(
  layout: CallLayout,
  given: { slot: number; value: string }[],
  new_positional: { value: string }[],
  new_keyword: { prefix: string; value: string }[]
): string {
  const items: LayoutItem[] = given.slice().sort((a, b) => a.slot - b.slot).map(({ slot, value }) => ({ ...layout.slots[slot], value }));

  // If the first/last arg was removed, the new first/last arg takes over how it sat against the parens.
  if (items.length > 0) {
    items[0].indent = layout.slots[0].indent;
    const last = items[items.length - 1];
    if (!last.trail.includes("#")) last.trail = strip_comments(layout.slots[layout.slots.length - 1].trail);
  }

  let positional_i = 0;
  items.forEach((item, i) => { if (!/^(\*|[\p{L}_][\p{L}\p{N}_]*[\s\\]*=)/u.test(item.prefix)) positional_i = i + 1; });
  for (const { value } of new_positional) {
    insert_item(items, positional_i++, "", value, layout.head);
  }
  for (const { prefix, value } of new_keyword) {
    insert_item(items, items.length, prefix, value, layout.head);
  }

  const args_code = items.map((item, i) => {
    const has_comma = i < items.length - 1 || layout.trailing_comma;
    return item.indent + item.prefix + item.value + (has_comma ? item.suffix + "," : strip_trailing_trivia(item.suffix)) + item.trail;
  }).join("");

  return layout.head + args_code + layout.close_indent + ")";
}

// Inserts a new arg at index i, copying the style of the nearest separator between args.
function insert_item(items: LayoutItem[], i: number, prefix: string, value: string, head: string) {
  const item: LayoutItem = { indent: "", prefix, suffix: "", trail: "", value };

  if (items.length > 0) {
    const { newline, indent } = separator_style(items, i, head);
    const line_break = newline ? "\n" : "";
    if (i === 0) {
      // The new arg takes the first arg's place against "("
      item.indent = items[0].indent;
      item.trail = line_break;
      items[0].indent = indent;
    } else {
      // The new arg takes over the trail of the arg before it (minus that arg's comment),
      // which gets a fresh separator
      const prev = items[i - 1];
      item.indent = indent;
      item.trail = strip_comments(prev.trail);
      if (!prev.trail.includes("#")) prev.trail = line_break;
    }
  }

  items.splice(i, 0, item);
}

// Whether args are separated by line breaks, and how they are indented, judging by the gap
// between args nearest to index i (or, for a single arg, the gap after "(").
function separator_style(items: LayoutItem[], i: number, head: string): { newline: boolean; indent: string } {
  if (items.length === 1) {
    const newline = head.endsWith("\n");
    return { newline, indent: newline ? items[0].indent : " " };
  }
  const k = Math.min(Math.max(i, 1), items.length - 1); // the gap before items[k]
  return { newline: items[k - 1].trail.includes("\n"), indent: items[k].indent };
}
