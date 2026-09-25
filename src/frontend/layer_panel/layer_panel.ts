import { P_stmt } from "../ast_types";
import { add_sync_code_on_change_watcher, hard_rerun, redraw_cell } from "../code_sync/code_sync";
import { add_menu_item, add_search, add_submenu, create_menu_el } from "../menus/menus";
import { call_to_code, create_call_view, id_of_new_call } from "../sidebar/call/call";
import { compute_selected_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { add_method_call } from "../sidebar/methods/method";
import { create_arbitrary_code_widget } from "../sidebar/widgets/arbitrary_code/arbitrary_code";
import { make_widget_for_code_and_type } from "../sidebar/widgets/widget";
import { CallView, CallWithArgs, IInstanceType, State, CallInfo } from "../types";
import { equalByJSON, zip } from "../utils/stdlib";
import { TextMarker, MarkerRange, DocOrEditor } from "../utils/codemirror";
import { create_el, cm_end_pos, cm_start_pos, add_line_of_code, default_code_for_type, non_colliding_name, set_persistent_item, get_persistent_item } from "../utils/misc";
import { Position } from "../types";
import { set_properties_panel_on } from "../properties_panel/properties_panel";
import { log_event } from "../utils/instrumentation";


export type Layer = {
  // parents: Layer[];
  el: HTMLElement;
  mark: TextMarker<MarkerRange>;
  target_mark: TextMarker<MarkerRange>;
  calls_with_args: CallWithArgs[];
  call_views: CallView[];
}

// `uncommented` is dedented; `indent` is the width of its first line's inferred indentation.
export type ParseableComment = Position & { uncommented: string; indent: number; };

export type LayersPanel = {
  el: HTMLElement;
  layers: Layer[];
};

export function layers_from_typed_node(typed_node: any, state: State, indent_level: number = 0): Layer[] {
  // An if/elif/else chain is a single IfStmt node but we want one independent layer
  // group per clause, so it can't use the single-layer flow below.
  if (typed_node['.class'] === 'mypy.nodes.IfStmt') return if_stmt_layers(typed_node, state, indent_level);

  const layer_el = create_el("div", "snp-layer");

  // console.log('layer typed node:', typed_node)

  const calls_with_args = state.calls_with_args;
  const calls_at_loc = calls_with_args.filter(call => call.call_info.call.pos.line === typed_node.line);

  // We only care about matplotlib and user-defined functions for now
  const [layer_calls, other_calls] = calls_at_loc.partition(call => !!call.call_info.callee.definition_fullname?.includes('matplotlib.') || !!call.call_info.callee.definition_fullname?.includes('__plottery_mypy_temp.'));
  console.log('function calls not rendered:', ...other_calls.map(call => call.call_info.func_code))

  const call_views: CallView[] = layer_calls.map(calls_with_args => create_call_view(calls_with_args, state));

  // console.log('layer call_views:', call_views)

  const sublayers: Layer[] = [];

  const cm = state.cell.code_mirror;
  const mark = cm.markText(
    cm_start_pos(typed_node, state.cell_lineno),
    cm_end_pos(typed_node, state.cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
  );
  let target_mark = mark;

  if (call_views.length > 0) {
    layer_el.append(...call_views.map(call_view => call_view.els.el));
  } else if (typed_node['.class'] === 'mypy.nodes.ForStmt') {
    // const arg_view = create_arg_view(arg, {positional, disabled: disabled});

    const pattern_code = typed_node.index.unparsed.trim();
    let iterable_code = typed_node.expr.unparsed.trim()

    const is_enumerate = typed_node.expr.callee?.name === 'enumerate' && typed_node.expr.args.length === 1;
    if (is_enumerate) {
      iterable_code = typed_node.expr.args[0].unparsed.trim()
    }

    const pattern_widget = create_arbitrary_code_widget(pattern_code);
    const iterable_type: IInstanceType = {
      ".class": "Instance",
      "type_ref": "typing.Iterable",
      "args": [{".class": "AnyType", "type_of_any": 2, "source_any": null, "missing_import_name": null}]
    }
    const iterator_widget = make_widget_for_code_and_type(iterable_code, iterable_type, null, state.user_iterables);

    const layer_code_line = create_el('div', [], layer_el);

    layer_code_line.append(
      "for ",
      pattern_widget.el,
      " in ",
      is_enumerate ? "enumerate(" : "",
      iterator_widget.el,
      is_enumerate ? ")" : "",
      ":"
    )
    const expr_end = cm_end_pos(typed_node.expr, state.cell_lineno)
    const edit_mark = cm.markText(
      cm_start_pos(typed_node.index, state.cell_lineno),
      expr_end,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );
    const end_of_for_line = {
      line: expr_end.line,
      ch: expr_end.ch + 1000
    }
    target_mark = cm.markText(
      cm_start_pos(typed_node, state.cell_lineno),
      end_of_for_line,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );
    add_sync_code_on_change_watcher(
      () => `${pattern_widget.to_code()} in ${is_enumerate ? "enumerate(" : ""}${iterator_widget.to_code()}${is_enumerate ? ")" : ""}`,
      [edit_mark], state
    );
    layer_el.classList.add(`indentbelow-${indent_level+1}`)
    layer_el.classList.add(`for-loop`)

    sublayers.push(...typed_node.body.body.flatMap((node: any) => layers_from_typed_node(node, state, indent_level + 1)));
    // sublayers.forEach(sublayer => sublayer.parents.push(layer));
  } else if (typed_node['.class'] === 'mypy.nodes.FuncDef') {
    // layer_el.append(typed_node.unparsed.split('\n')[0]);
    console.log('func def:', typed_node)

    // Set up editable function name

    const func_name_match = typed_node.unparsed.match(/(?<=^\s*def\s+)[^\(\s]+/)!
    if (!func_name_match) { console.error('Could not find function name in:', typed_node.unparsed); return [] }

    const func_name = func_name_match[0];
    const func_name_widget = create_arbitrary_code_widget(func_name);

    const func_start = cm_start_pos(typed_node, state.cell_lineno);
    const func_name_start = { line: func_start.line,  ch: func_start.ch + func_name_match.index! }
    const func_name_end   = { line: func_start.line,  ch: func_start.ch + func_name_match.index! + func_name.length }

    const func_name_mark = cm.markText(
      func_name_start,
      func_name_end,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );

    // Also mark all uses of the function name to change them
    const use_marks = []

    for (const use_match of cm.getValue().matchAll(new RegExp(`\\b${func_name_match}\\(`, 'g'))) {
      const use_start = cm.posFromIndex(use_match.index)
      if (use_start.line != func_start.line) {
        const use_end = { line: use_start.line, ch: use_start.ch + func_name.length };
        use_marks.push(cm.markText(use_start, use_end, { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }));
      }
    }
    add_sync_code_on_change_watcher(
      () => func_name_widget.to_code(),
      [func_name_mark, ...use_marks], state
    );

    // Set up editable function params

    const params_unparsed = typed_node.arguments.map((arg: any) => arg.unparsed + (arg.initializer ? '=' + arg.initializer.unparsed : '')).join(', ');
    const params_widget = create_arbitrary_code_widget(params_unparsed);

    const layer_code_line = create_el('div', [], layer_el);

    layer_code_line.append("def ", func_name_widget.el, "(", params_widget.el, "):")

    let params_start: {line: number, ch: number};
    let params_end: {line: number, ch: number};

    if (typed_node.arguments.length > 0) {
      params_start = cm_start_pos(typed_node.arguments[0], state.cell_lineno);
      const last_arg = typed_node.arguments.at(-1)!;
      params_end = cm_end_pos(last_arg.initializer || last_arg, state.cell_lineno);
    } else {
      // For zero-arg functions, this presumes the colon is on the same line because I don't want to do the math to add extra line numbers
      const func_def_parens_match = typed_node.unparsed.match(/(?<=^\s*def\s+[^:\(\n]+)\([^:\)\n]*\)/)!
      if (!func_def_parens_match) { console.error('Could not find function def parens in:', typed_node.unparsed); return [] }

      params_start = { line: func_start.line,  ch: func_start.ch + func_def_parens_match.index! + 1 }
      params_end   = { line: func_start.line,  ch: func_start.ch + func_def_parens_match.index! + func_def_parens_match[0].length - 1 }
    }
    const params_mark = cm.markText(
      params_start,
      params_end,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );
    add_sync_code_on_change_watcher(
      () => params_widget.to_code(),
      [params_mark], state
    );

    // Set up the mark for the function definition line (used for managing drag-n-drops on this layer)

    const end_of_def_line = {
      line: params_end.line,
      ch: params_end.ch + 1000
    }
    target_mark = cm.markText(
      cm_start_pos(typed_node, state.cell_lineno),
      end_of_def_line,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );

    layer_el.classList.add(`indentbelow-${indent_level+1}`)
    layer_el.classList.add(`func-def`)

    sublayers.push(...typed_node.body.body.flatMap((node: any) => layers_from_typed_node(node, state, indent_level + 1)));
  } else {
    layer_el.innerText = typed_node.unparsed;
    layer_el.classList.add("snp-code-layer");
  }
  layer_el.classList.add(`indent-${indent_level}`)

  const layer = {
    // parents: [],
    el: layer_el,
    calls_with_args: layer_calls,
    call_views,
    mark,        // the whole AST node
    target_mark, // the displayed layer code, so that drag-dropping below e.g. a for-loop adds to beginning of loop
  }

  add_listeners_and_checkbox_to_layer(layer, state);

  return [layer, ...sublayers];
}

// Render an if/elif/else chain as one independent layer group per clause. mypy (like Python's
// own ast) does NOT flatten the chain: each IfStmt holds a single `if`/`elif` clause in
// expr[0]/body[0], and any `elif`/`else` is nested as an IfStmt/Block inside else_body. So we
// walk the else_body chain to collect the sibling clauses.
function if_stmt_layers(typed_node: any, state: State, indent_level: number): Layer[] {
  const cm = state.cell.code_mirror;
  const cell_lineno = state.cell_lineno;

  // The outermost IfStmt encloses the whole chain (nested elif/else included).
  const chain_end = cm_end_pos(typed_node, cell_lineno);

  type Clause = {
    kind: 'if' | 'elif' | 'else';
    header_line: number; // editor line of the clause's header keyword
    condition?: any;     // the expr node, for if/elif
    body_block: any;     // a Block whose .body holds the clause's statements
  };

  const clauses: Clause[] = [];
  let node: any = typed_node;
  let first = true;
  while (node) {
    const condition = node.expr[0];
    clauses.push({
      kind: first ? 'if' : 'elif',
      header_line: cm_start_pos(condition, cell_lineno).line,
      condition,
      body_block: node.body[0],
    });
    first = false;

    const else_body = node.else_body;
    if (!else_body) break;

    // An `elif` is a lone nested IfStmt whose source line begins with `elif`; a real `else:`
    // (which may itself contain a nested `if`) is anything else.
    const only = else_body.body?.length === 1 ? else_body.body[0] : null;
    const is_elif = !!only && only['.class'] === 'mypy.nodes.IfStmt'
      && (cm.getLine(cm_start_pos(only, cell_lineno).line) || '').trim().startsWith('elif');
    if (is_elif) {
      node = only;
      continue;
    }

    // Real `else:` clause. It has no condition node, so find its header line by scanning upward
    // from its first statement for the nearest `else:` (Block positions aren't reliable).
    const first_else_stmt = else_body.body?.[0];
    let else_header_line = chain_end.line;
    if (first_else_stmt) {
      let scan = cm_start_pos(first_else_stmt, cell_lineno).line - 1;
      while (scan >= 0 && !/^\s*else\s*:/.test(cm.getLine(scan) || '')) scan--;
      if (scan >= 0) else_header_line = scan;
    }
    clauses.push({ kind: 'else', header_line: else_header_line, body_block: else_body });
    break;
  }

  const clause_end = (c: number) => {
    if (c < clauses.length - 1) {
      const end_line = clauses[c + 1].header_line - 1;
      return { line: end_line, ch: (cm.getLine(end_line) || '').length };
    }
    return chain_end;
  };

  const layers: Layer[] = [];

  clauses.forEach((clause, c) => {
    const layer_el = create_el("div", "snp-layer");
    const layer_code_line = create_el('div', [], layer_el);

    const header_start = { line: clause.header_line, ch: 0 };

    if (clause.kind === 'else') {
      layer_code_line.append("else:");
    } else {
      const cond_widget = create_arbitrary_code_widget(clause.condition.unparsed.trim());
      layer_code_line.append(clause.kind === 'if' ? "if " : "elif ", cond_widget.el, ":");

      const edit_mark = cm.markText(
        cm_start_pos(clause.condition, cell_lineno),
        cm_end_pos(clause.condition, cell_lineno),
        { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
      );
      add_sync_code_on_change_watcher(() => cond_widget.to_code(), [edit_mark], state);
    }

    // mark spans the whole clause (header + body): used for toggling and as the drag source.
    const mark = cm.markText(
      header_start,
      clause_end(c),
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );
    // target_mark spans the header line so dropping below a clause lands at the top of its body.
    const end_of_header_line = { line: clause.header_line, ch: (cm.getLine(clause.header_line) || '').length + 1000 };
    const target_mark = cm.markText(
      header_start,
      end_of_header_line,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );

    layer_el.classList.add(`indent-${indent_level}`);
    layer_el.classList.add(`indentbelow-${indent_level + 1}`);
    layer_el.classList.add(`if-stmt`);

    const layer: Layer = {
      el: layer_el,
      calls_with_args: [],
      call_views: [],
      mark,
      target_mark,
    };

    // Clause toggles change if/elif/else keywords (via normalize_if_chains), so always do a
    // hard rerun to rebuild the layer labels to match.
    add_listeners_and_checkbox_to_layer(layer, state, true, false, true);

    layers.push(layer);
    layers.push(...(clause.body_block.body || []).flatMap((node: any) => layers_from_typed_node(node, state, indent_level + 1)));
  });

  return layers;
}

function add_listeners_and_checkbox_to_layer(layer: Layer, state: State, checked: boolean = true, hard_run_on_enable: boolean = false, hard_run_always: boolean = false) {
  const cm = state.cell.code_mirror;
  const { el: layer_el, mark } = layer;

  layer_el.addEventListener("click", ev => {
    log_event("gui", "layers panel click-select layer", {layer: layer_el.innerText});
    select_layer(layer, state);
  });

  layer_el.draggable = true;
  layer_el.addEventListener("dragstart", ev => dragstart(ev, layer, state));
  layer_el.addEventListener("dragend", dragend);
  layer_el.addEventListener("dragover", dragover);
  layer_el.addEventListener("dragleave", dragleave);
  layer_el.addEventListener("drop", ev => drop(ev, layer, state));

  // Show/hide layers
  const visible_checkbox = create_el("input", "snp-layer-checkbox", layer_el) as HTMLInputElement;
  visible_checkbox.type = "checkbox";
  visible_checkbox.checked = checked;
  visible_checkbox.addEventListener("change", ev => {
    const layer_range = layer.mark.find()!;

    if (!visible_checkbox.checked) {
      replace_all_preserving_marks(cm, /^([ \t]*)/mg, '$1# ', (_match, start_pos, _end_pos) => start_pos.line >= layer_range.from.line && start_pos.line <= layer_range.to.line)
      log_event("gui", "layers panel layer visibility click off", {layer: layer_el.innerText, code: cm.getValue()});
    } else {
      // Uncomment every line the same way as the first, so continuation lines keep their alignment.
      const uncomment_regexp = comment_drops_space(cm.getLine(layer_range.from.line) || '') ? /^([ \t]*)# ?/mg : /^([ \t]*)#/mg;
      replace_all_preserving_marks(cm, uncomment_regexp, '$1', (_match, start_pos, _end_pos) => start_pos.line >= layer_range.from.line && start_pos.line <= layer_range.to.line)
      log_event("gui", "layers panel layer visibility click on", {layer: layer_el.innerText, code: cm.getValue()});
    }

    clean_up_passes(cm);

    if (hard_run_always || (visible_checkbox.checked && hard_run_on_enable)) {
      hard_rerun(state); // Layers rendered as plain text need a full rerun to generate their full UI.
    } else {
      redraw_cell(state);
    }
  })
  visible_checkbox.addEventListener("click", ev => ev.stopPropagation());
}

// Commented-out code comes in a few styles. The "#" may be followed by the conventional space
// ("    # code", "#     code") or may itself stand in for an indentation char ("    #code",
// "#    code"). If the whitespace around the "#" adds up to an odd width, assume the conventional
// space and drop it. Keep in sync with comment_drops_space in snp.py.
function comment_drops_space(line: string): boolean {
  const match = line.match(/^([ \t]*)#([ \t]*)/);
  if (!match) return false;
  const [, before, after] = match;
  return after.startsWith(' ') && (before.length + after.length) % 2 === 1;
}

export function layers_from_parseable_comment(comment: ParseableComment, state: State): Layer[] {
  const layer_el = create_el("div", "snp-layer");

  const mark = state.cell.code_mirror.markText(
    cm_start_pos(comment, state.cell_lineno),
    cm_end_pos(comment, state.cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
  );

  layer_el.innerText = comment.uncommented;
  // layer_el.classList.add("snp-code-layer");

  const indent_level = Math.floor(comment.indent / 4);
  layer_el.classList.add(`indent-${indent_level}`)

  const layer = {
    // parents: [],
    el: layer_el,
    calls_with_args: [],
    call_views: [],
    mark,             // the whole AST node
    target_mark: mark // the displayed layer code, so that drag-dropping below e.g. a for-loop adds to beginning of loop
  }

  add_listeners_and_checkbox_to_layer(layer, state, false, true);

  return [layer]
}

// Re-indent a (possibly multi-line) block so its first line sits at `indentation`, while
// preserving the relative indentation of the remaining lines. Dedenting by the first line's
// own indentation (rather than flattening every line to `indentation`) keeps the bodies of
// dragged multi-line constructs (for-loops, if/elif/else clauses, ...) nested correctly.
function replace_indentation(code: string, indentation: string) {
  const lines = code.split('\n');
  const first_nonblank = lines.find(line => line.trim() !== '') ?? '';
  const base = first_nonblank.match(/^[ \t]*/)![0];
  return lines
    .map(line => {
      if (line.trim() === '') return '';
      const dedented = line.startsWith(base) ? line.slice(base.length) : line.replace(/^[ \t]*/, '');
      return indentation + dedented;
    })
    .join('\n')
    .replace(/\n+$/, ''); // drop trailing blank lines
}

function drop(ev: DragEvent, target_layer: Layer, state: State) {
  ev.preventDefault();
  ev.stopImmediatePropagation();

  const drop_target = target_layer.el;

  const is_above = drop_target.classList.contains("dragover-top");

  let indent_level = 0;
  for (let i = 0; i < 10; i++) {
    if (drop_target.classList.contains(`drag-indent-${i}`)) {
      indent_level = i;
    }
  }
  const indentation = '    '.repeat(indent_level)

  const cm = state.cell.code_mirror;
  let source_code = ''
  for (const source_layer of state.dragging_layers) {
    let source_range = source_layer.mark.find()!;
    // Capture full lines (from column 0, including the first line's indentation) so
    // replace_indentation can preserve the block's relative indentation. The source is also
    // removed line-by-line below, so whole-line capture stays consistent.
    const to_line = source_range.to.line;
    const layer_code = cm.getRange({ line: source_range.from.line, ch: 0 }, { line: to_line, ch: (cm.getLine(to_line) || '').length });
    source_code += replace_indentation(layer_code, indentation) + '\n'
  }
  console.log(source_code);

  const target_range = target_layer.target_mark.find()!;
  const target_pos = {
    line: is_above ? target_range.from.line : 1 + target_range.to.line,
    ch: 0
  }

  state.layers_panel.layers.forEach(layer => {
    // this seems to work better for moving layers around.
    // otherwise a layer might be moved into another layer,
    // or into itself and deleted below.
    // hard_rerun() below will reset this.

    // console.log('layer.mark.find_cm6_mark!()!', layer.mark.find_cm6_mark!()!);
    layer.mark.inclusiveLeft = false;
    layer.target_mark.inclusiveLeft = false;
  });
  cm.replaceRange(source_code, target_pos);

  for (const source_layer of state.dragging_layers) {
    let source_range = source_layer.mark.find()!;
    cm.replaceRange('', { line: source_range.from.line, ch: 0 }, { line: source_range.to.line + 1, ch: 0 })
  }

  clean_up_passes(cm);

  log_event("gui", "layers panel layer drag end", {layer: state.dragging_layers[0].el.innerText, code: cm.getValue()});

  hard_rerun(state);
}

// The replacement here can only reference numbered (not named) capture groups.
function replace_all_preserving_marks(cm: DocOrEditor, target: RegExp, replacement: string, pred: (match: RegExpMatchArray, start_pos: CodeMirror.Position, end_pos: CodeMirror.Position) => boolean = _ => true) {
  let search_i = 0;

  // match will only give us the match index if the regexp is non-global
  let non_global_regexp = new RegExp(target.source, target.flags.replace('g', ''));

  while (search_i <= cm.getValue().length) {
    // console.log('looking for', non_global_regexp, 'in', cm.getValue());
    const match = cm.getValue().match(non_global_regexp);

    if (!match) break;

    const start_pos = cm.posFromIndex(match.index!);
    const end_pos   = cm.posFromIndex(match.index! + match[0].length);

    if (pred(match, start_pos, end_pos)) {
      // have to handle $0 $1 $2 replacement refs ourself because lookaheads/lookbehinds
      // won't match the substring if we were to dimply do match[0].replace(target, replacement)
      //
      // Only supports numbered capture groups for now
      const new_str  = replacement.replaceAll(/(?<!\\)\$(\d+)/g, (_, n) => match[parseInt(n)]);

      cm.replaceRange(new_str, start_pos, end_pos);

      search_i = match.index! + new_str.length;
    } else {
      search_i = match.index! + Math.max(1, match[0].length);
    }

    // Prepend a lookbehind to the target regexp to start the next search at the right place
    // This should allow multiline ^ and negative lookbehinds to work correctly.
    non_global_regexp = new RegExp(`(?<=[\\s\\S]{${search_i}})` + target.source, target.flags.replace('g', ''));
  }
}


// Keep if/elif/else chains syntactically valid after a clause is toggled off (commented),
// dragged out, or reordered. Promote-only and indentation-aware: a dangling `elif` (no open
// chain at its indent) becomes `if`, and a dangling `else` becomes `if True`. We never demote
// an active `if` to `elif`, so two genuinely separate `if`s are never merged. Best-effort:
// drops that would need demotion (e.g. an `elif` dragged strictly above its `if`) are left for
// the user to fix.
function normalize_if_chains(cm: DocOrEditor) {
  // open_at_indent[indent] === true when a conditional chain is currently open at that indent.
  const open_at_indent: Record<number, boolean> = {};
  const close_deeper_than = (indent: number) => {
    for (const key of Object.keys(open_at_indent)) {
      if (Number(key) >= indent) open_at_indent[Number(key)] = false;
    }
  };

  type Edit = { line: number; from_ch: number; to_ch: number; text: string };
  const edits: Edit[] = [];

  const line_count = cm.lineCount();
  for (let line = 0; line < line_count; line++) {
    const text = cm.getLine(line) || '';

    // Blank and comment-only lines don't open, continue, or break a chain.
    if (/^\s*$/.test(text) || /^\s*#/.test(text)) continue;

    const indent = text.match(/^[ \t]*/)![0].length;
    const header = text.match(/^([ \t]*)(if|elif|else)\b/);

    if (!header) {
      // A regular statement ends any chain at its own indent and deeper.
      close_deeper_than(indent);
      continue;
    }

    const kw = header[2];
    const kw_start = header[1].length;
    close_deeper_than(indent + 1); // entering any clause closes strictly-deeper chains

    if (kw === 'if') {
      open_at_indent[indent] = true;
    } else if (kw === 'elif') {
      if (!open_at_indent[indent]) {
        edits.push({ line, from_ch: kw_start, to_ch: kw_start + 'elif'.length, text: 'if' });
        open_at_indent[indent] = true;
      }
    } else { // else
      if (!open_at_indent[indent]) {
        edits.push({ line, from_ch: kw_start, to_ch: kw_start + 'else'.length, text: 'if True' });
        open_at_indent[indent] = true;
      } else {
        open_at_indent[indent] = false; // a valid else closes the chain
      }
    }
  }

  // Each edit is confined to a single line and doesn't change line numbers, so applying them
  // in order keeps every other edit's positions valid. replaceRange keeps marks adjusted.
  for (const e of edits) {
    cm.replaceRange(e.text, { line: e.line, ch: e.from_ch }, { line: e.line, ch: e.to_ch });
  }
}


// Remove unecessary "pass" statements
// Add missing "pass" statements
function clean_up_passes(cm: DocOrEditor) {
  normalize_if_chains(cm);

  // Add passes everywhere...not perfect but we'll roll with it
  replace_all_preserving_marks(cm, /(^[ \t]*)((for|def|if|elif|else|try|except)\b.*:[ \t]*\n)^/mg, '$1$2$1    pass\n')

  // Using lookahead/lookbehind so that replacements don't mess up existing layer mark ranges.
  replace_all_preserving_marks(cm, /(^[ \t]*)pass\s*\n(?=\1[^#\s])/mg,      '') // remove passes with stuff after
  replace_all_preserving_marks(cm, /(?<=(^[ \t]*)[^#\s].*\n)\1pass.*\n?/mg, '') // remove passes with stuff before
  replace_all_preserving_marks(cm, /(^[ \t]*)pass\s*\n(?=\1[^#\s])/mg,      '') // remove passes with stuff after
  replace_all_preserving_marks(cm, /(?<=(^[ \t]*)[^#\s].*\n)\1pass.*\n?/mg, '') // remove passes with stuff before
}

function dragstart(ev: DragEvent, layer: Layer, state: State) {
  state.dragging_layers = [layer];
  log_event("gui", "layers panel layer drag begin", {layer: layer.el.innerText, code: state.cell.code_mirror.getValue()});
  ev.stopImmediatePropagation();
}

function dragend(ev: DragEvent) {
  document.querySelectorAll(".dragover-top").forEach(el => el.classList.remove("dragover-top"));
  document.querySelectorAll(".dragover-bottom").forEach(el => el.classList.remove("dragover-bottom"));
  for (let i = 0; i < 10; i++) {
    document.querySelectorAll(`drag-indent-${i}`).forEach(el => el.classList.remove(`drag-indent-${i}`));
  }
  // let node = ev.currentTarget;
  ev.stopImmediatePropagation();
}

function dragover(ev: DragEvent) {
  // ev.dataTransfer.dropEffect = "copy";
  // highlightDropTarget(ev.currentTarget);

  const drop_target = ev.currentTarget! as Element;

  console.log(drop_target.classList.toString())

  const indent_class_match = drop_target.classList.toString().match(/(?:^|\s)indent-(\d+)\b/)!;
  const indent_level = parseInt(indent_class_match[1]);
  const indent_below_level = parseInt((drop_target.classList.toString().match(/(?:^|\s)indentbelow-(\d+)\b/) || indent_class_match)[1])


  const rect = drop_target.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left;
  const mouseY = ev.clientY - rect.top;
  // const relativeX = mouseX / rect.width;
  const relativeY = mouseY / rect.height;


  drop_target.classList.remove("dragover-top");
  drop_target.classList.remove("dragover-bottom");
  for (let i = 0; i < 10; i++) {
    drop_target.classList.remove(`drag-indent-${i}`);
  }

  if (relativeY < 0.5) {
    drop_target.classList.add("dragover-top");
    const drag_indent_level = Math.min(indent_level, Math.floor(mouseX / 29));
    drop_target.classList.add(`drag-indent-${drag_indent_level}`);
  } else {
    drop_target.classList.add("dragover-bottom");
    const drag_indent_level = Math.min(indent_below_level, Math.floor(mouseX / 27));
    drop_target.classList.add(`drag-indent-${drag_indent_level}`);
  }

  ev.preventDefault();
  ev.stopImmediatePropagation();
}

function dragleave(ev: DragEvent) {
  const drop_target = ev.currentTarget! as Element;
  drop_target.classList.remove("dragover-top");
  drop_target.classList.remove("dragover-bottom");
  ev.preventDefault();
  ev.stopImmediatePropagation();
}

export function is_layer_selected(layer: Layer): boolean {
  return layer.el.classList.contains("selected");
}

// Should only be 0 or 1 right now
export function selected_layers(state: State): Layer[] {
  return state.layers_panel.layers.filter(is_layer_selected);
}

export function create_layers_panel(layers: Layer[], state: State): LayersPanel {
  const layers_el = create_el("div", "snp-layers-panel");
  const layers_panel_heading = create_el("h2", [], layers_el);
  layers_panel_heading.append("Layers")

  const add_layer_menu = create_menu_el('<span class="snp-add-layer-button">＋ Add Layer</span>', 'add-layer-menu', layers_panel_heading)
  add_search(add_layer_menu);

  const default_iterable = default_code_for_type({".class": "Instance", "type_ref": "matplotlib._typing.ArrayLike", "args": []});
  const default_iterable_code = `for i, x in enumerate(${default_iterable}):\n    pass`;
  add_menu_item(
    add_layer_menu,
    'For-loop', null,
    (state => {
      add_line_of_code(default_iterable_code, state);
      hard_rerun(state);
    }),
    _ => true, // Enabled?
    state
  ).title = default_iterable_code.trim();

  const default_if_code = `if True:\n    pass`;
  add_menu_item(
    add_layer_menu,
    'If-statement', null,
    (state => {
      add_line_of_code(default_if_code, state);
      hard_rerun(state);
    }),
    _ => true, // Enabled?
    state
  ).title = default_if_code.trim();

  // const user_iterables_menu =
  //   add_submenu(
  //     add_layer_menu,
  //     'For-loop over...',
  //     _ => true, // Enabled?
  //     state
  //   );
  [default_iterable, ...state.user_iterables].forEach(iterable => {
    const code = `for i, x in enumerate(${iterable}):\n    pass`;
    add_menu_item(
      // user_iterables_menu,
      add_layer_menu,
      `For-loop over ${iterable}`, null,
      (state => {
        add_line_of_code(code, state);
        hard_rerun(state);
      }),
      _ => true, // Enabled?
      state
    ).title = code.trim()
  });

  // Add possible method calls to the menu
  state.methods_with_code.forEach(method => {
    const menu_item = add_menu_item(
      add_layer_menu,
      method.receiver_dot_name, null,
      (state => add_method_call(method, state)),
      _ => true, // Enabled?
      state
    ).title = method.method_info.docstring_first_line  || `No documenation for ${method.receiver_dot_name}`
  });

  layers.forEach(layer => layers_el.append(layer.el));

  return {
    el: layers_el,
    layers
  };
}

export function deselect_all_layers(state: State) {
  state.layers_panel.layers.forEach(layer => layer.el.classList.remove("selected"));
  compute_selected_hover_regions(state);
  highlight_lines_for_selected_layers(state);
  save_selected_layers(state);
}

export function select_layer(layer: Layer, state: State, call_view?: CallView) {
  state.layers_panel.layers.forEach(layer => layer.el.classList.remove("selected"));
  layer.el.classList.add("selected");
  if (call_view || layer.call_views[0]) {
    set_properties_panel_on(call_view || layer.call_views[0], state);
  }
  compute_selected_hover_regions(state);
  highlight_lines_for_selected_layers(state);
  scroll_selected_layer_into_view(layer, state);
  save_selected_layers(state);
  // console.log(layer.el)
}

// Scroll the selected layer's code into view (without moving the cursor) so its
// line is visible even when the editor is capped at max-height and scrolled.
// Target the start of the line (column 0) so we scroll vertically only and stay
// pinned at the left edge instead of scrolling horizontally to the call.
//
// Position the line near the bottom of the (max-height-capped) code box, leaving
// LINES_BELOW_SELECTED lines of context below it. Only the code box is scrolled —
// the browser viewport is intentionally left untouched. If the line is already
// fully visible (e.g. the user just clicked it in the editor), don't scroll.
function scroll_selected_layer_into_view(layer: Layer, state: State) {
  // Number of lines to leave visible below the selected line, so it lands as the
  // third-to-last line of the code box (instead of flush with the bottom edge).
  const LINES_BELOW_SELECTED = 2;

  const range = layer.mark.find();
  if (!range) return;
  const cm = state.cell.code_mirror as any;
  const line = range.from.line;

  // Scroll *within* the code editor so the selected line sits near the bottom.
  if (typeof cm.charCoords === "function" && typeof cm.scrollTo === "function") {
    // Real CodeMirror 5 (classic Notebook v6): position the scroller manually.
    const coords = cm.charCoords({ line, ch: 0 }, "local");
    const { top, clientHeight } = cm.getScrollInfo();
    const already_visible = coords.top >= top && coords.bottom <= top + clientHeight;
    if (already_visible) return;
    const line_height = cm.defaultTextHeight();
    cm.scrollTo(null, coords.bottom + LINES_BELOW_SELECTED * line_height - clientHeight); // CM clamps negatives to 0.
  } else {
    // CM6-backed facade (JupyterLab / Notebook v7): use its native bottom scroll.
    cm.scrollIntoView({ line, ch: 0 });
  }

  // Previously we also scrolled the browser viewport so the code box itself was
  // on screen; disabled so only the code box scrolls:
  // cm.getScrollerElement?.().scrollIntoView?.({ block: "nearest" });
}

export function select_call_view(call_view: CallView, state: State) {
  const layer = state.layers_panel.layers.find(layer => layer.call_views.includes(call_view));

  layer && select_layer(layer, state, call_view);
}

export function duplicate_selected_layers(state: State) {
  const cm = state.cell.code_mirror;
  const old_code = cm.getValue();
  selected_layers(state).forEach((layer : Layer) => {
    // Duplicate layer
    const mark = layer.mark;
    const range = mark.find()!;
    const insert_line = 1 + (range.to.line || state.plt_show_lineno_in_cell - 1);

    let code = cm.getRange(range.from, range.to);

    // Make new variable name
    let [_code, indent, orig_name, rest] = code.match(/^(\s*)(\w+)(\s*=[\S\s]*)/) || [null, null, null, null];
    if (orig_name) {
      let new_name = non_colliding_name(orig_name.replace(/_?\d+$/, ''), state.avoid_names);
      code = `${indent}${new_name}${rest}`;
    }

    cm.replaceRange(code + '\n', {line: insert_line, ch: 0})

    // Queue new layer for selection/focus after hard_rerun
    const func_code = layer.calls_with_args.at(-1)?.call_info.func_code;
    if (func_code) {
      const line = insert_line + state.cell_lineno;
      set_persistent_item(state, 'new_calls', `["${id_of_new_call(func_code, line)}"]`);
    }
  });
  if(cm.getValue() !== old_code) {
    hard_rerun(state);
  }
}

// For regeneration after cell rerun
function save_selected_layers(state: State) {
  const selected_calls = state.layers_panel.layers.filter(is_layer_selected).flatMap(layer => layer.calls_with_args).map(call_with_args => call_with_args.call_info.call_id);

  // console.log(selected_calls)

  set_persistent_item(state, 'selected_calls', JSON.stringify(selected_calls));

  // const selected_layers = state.layers_panel.layers.filter(is_layer_selected);
  // const selected_calls = selected_layers.map(layer => layer.calls_with_args);
  // console.log(selected_calls);

}

// For regeneration after cell rerun
export function load_selected_layers(state: State) {
  const selected_calls = JSON.parse(get_persistent_item(state, 'selected_calls') || '[]') as [number, string][];

  deselect_all_layers(state);

  state.layers_panel.layers.forEach(layer => {
    if (layer.calls_with_args.some(call_with_args => selected_calls.some(selected_call => equalByJSON(selected_call, call_with_args.call_info.call_id)))) {
      select_layer(layer, state);
    }
  });
}


function highlight_lines_for_selected_layers(state: State) {
  const cm = state.cell.code_mirror;
  cm.eachLine(line => {
    cm.removeLineClass(line, "gutter", "snp-line-selected");
    cm.removeLineClass(line, "background", "snp-line-selected");
  });
  state.layers_panel.layers.forEach(layer => {
    if (is_layer_selected(layer)) {
      const range = layer.mark.find()!;
      for(let i = range.from.line; i <= range.to.line; i++) {
        cm.addLineClass(i, "gutter", "snp-line-selected");
        cm.addLineClass(i, "background", "snp-line-selected");
      }
    }
  });
}