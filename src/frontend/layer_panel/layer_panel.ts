import { P_stmt } from "../ast_types";
import { add_sync_code_on_change_watcher, hard_rerun, redraw_cell } from "../code_sync/code_sync";
import { add_menu_item, add_submenu, create_menu_el } from "../menus/menus";
import { call_to_code, create_call_view, id_of_new_call } from "../sidebar/call/call";
import { open_collapsable } from "../sidebar/collapsable/collapsable";
import { compute_selected_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { add_method_call } from "../sidebar/methods/method";
import { create_arbitrary_code_widget } from "../sidebar/widgets/arbitrary_code/arbitrary_code";
import { make_widget_for_code_and_type } from "../sidebar/widgets/widget";
import { CallView, CallWithArgs, IInstanceType, State, CallInfo } from "../types";
import { equalByJSON, zip } from "../utils/stdlib";
import { TextMarker, MarkerRange, DocOrEditor } from "../utils/codemirror";
import { create_el, cm_end_pos, cm_start_pos, add_line_of_code, default_code_for_type, non_colliding_name } from "../utils/misc";
import { Position } from "../types";
import { set_properties_panel_on } from "../properties_panel/properties_panel";


export type Layer = {
  // parents: Layer[];
  el: HTMLElement;
  mark: TextMarker<MarkerRange>;
  target_mark: TextMarker<MarkerRange>;
  calls_with_args: CallWithArgs[];
  call_views: CallView[];
}

export type ParseableComment = Position & { uncommented: string; };

export type LayersPanel = {
  el: HTMLElement;
  layers: Layer[];
};

export function layers_from_typed_node(typed_node: any, state: State, indent_level: number = 0): Layer[] {
  const layer_el = create_el("div", "snp-layer");

  // console.log('layer typed node:', typed_node)

  const calls_with_args = state.calls_with_args;
  const calls_at_loc = calls_with_args.filter(call => call.call_info.call.pos.line === typed_node.line);

  // We only care about matplotlib calls for now
  const [mpl_calls, other_calls] = calls_at_loc.partition(call => !!call.call_info.callee.definition_fullname?.includes('matplotlib.'));
  console.log('function calls not rendered:', ...other_calls.map(call => call.call_info.func_code))

  const call_views: CallView[] = mpl_calls.map(calls_with_args => create_call_view(calls_with_args, state));

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

    sublayers.push(...typed_node.body.body.flatMap(node => layers_from_typed_node(node, state, indent_level + 1)));
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

    // Set up editable function args

    const args_unparsed = typed_node.arguments.map(arg => arg.unparsed + (arg.initializer ? '=' + arg.initializer.unparsed : '')).join(', ');
    const args_widget = create_arbitrary_code_widget(args_unparsed);

    const layer_code_line = create_el('div', [], layer_el);

    layer_code_line.append("def ", func_name_widget.el, "(", args_widget.el, "):")

    let args_start: {line: number, ch: number};
    let args_end: {line: number, ch: number};

    if (typed_node.arguments.length > 0) {
      args_start = cm_start_pos(typed_node.arguments[0], state.cell_lineno);
      const last_arg = typed_node.arguments.at(-1)!;
      args_end = cm_end_pos(last_arg.initializer || last_arg, state.cell_lineno);
    } else {
      // For zero-arg functions, this presumes the colon is on the same line because I don't want to do the math to add extra line numbers
      const func_def_parens_match = typed_node.unparsed.match(/(?<=^\s*def\s+[^:\(\n]+)\([^:\)\n]*\)/)!
      if (!func_def_parens_match) { console.error('Could not find function def parens in:', typed_node.unparsed); return [] }

      args_start = { line: func_start.line,  ch: func_start.ch + func_def_parens_match.index! + 1 }
      args_end   = { line: func_start.line,  ch: func_start.ch + func_def_parens_match.index! + func_def_parens_match[0].length - 1 }
    }
    const args_mark = cm.markText(
      args_start,
      args_end,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );
    add_sync_code_on_change_watcher(
      () => args_widget.to_code(),
      [args_mark], state
    );

    // Set up the mark for the function definition line (used for managing drag-n-drops on this layer)

    const end_of_def_line = {
      line: args_end.line,
      ch: args_end.ch + 1000
    }
    target_mark = cm.markText(
      cm_start_pos(typed_node, state.cell_lineno),
      end_of_def_line,
      { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false }
    );

    layer_el.classList.add(`indentbelow-${indent_level+1}`)
    layer_el.classList.add(`func-def`)

    sublayers.push(...typed_node.body.body.flatMap(node => layers_from_typed_node(node, state, indent_level + 1)));
  } else {
    layer_el.innerText = typed_node.unparsed;
    layer_el.classList.add("snp-code-layer");
  }
  layer_el.classList.add(`indent-${indent_level}`)

  const layer = {
    // parents: [],
    el: layer_el,
    calls_with_args: mpl_calls,
    call_views,
    mark,        // the whole AST node
    target_mark, // the displayed layer code, so that drag-dropping below e.g. a for-loop adds to beginning of loop
  }

  add_listeners_and_checkbox_to_layer(layer, state);

  return [layer, ...sublayers];
}

function add_listeners_and_checkbox_to_layer(layer: Layer, state: State, checked: boolean = true, hard_run_on_enable: boolean = false) {
  const cm = state.cell.code_mirror;
  const { el: layer_el, mark } = layer;

  layer_el.addEventListener("click", ev => {
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
    } else {
      replace_all_preserving_marks(cm, /^([ \t]*)# /mg, '$1', (_match, start_pos, _end_pos) => start_pos.line >= layer_range.from.line && start_pos.line <= layer_range.to.line)
    }

    clean_up_passes(cm);

    if (visible_checkbox.checked && hard_run_on_enable) {
      hard_rerun(state); // Layers rendered as plain text need a full rerun to generate their full UI.
    } else {
      redraw_cell(state);
    }
  })
  visible_checkbox.addEventListener("click", ev => ev.stopPropagation());
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

  const indent_level = Math.floor(comment.uncommented.match(/^ */)![0].length / 4);
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

function replace_indentation(code: string, indentation: string) {
  return code.replaceAll(/^[ \t]*/mg, indentation)
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
    const layer_code = cm.getRange(source_range.from, source_range.to);
    source_code += replace_indentation(layer_code.trim(), indentation) + '\n'
  }
  console.log(source_code);

  const target_range = target_layer.target_mark.find()!;
  const target_pos = {
    line: is_above ? target_range.from.line : 1 + target_range.to.line,
    ch: 0
  }

  state.layers_panel.layers.forEach(layer => {
    // this seems to work better for moving layers around
    // otherwise a layer might be moved into another layer,
    // or into itself and deleted below
    // hard_rerun() below will reset this.
    layer.mark.inclusiveLeft = false;
    layer.target_mark.inclusiveLeft = false;
    // layer.mark.inclusiveRight = false;
    // layer.target_mark.inclusiveRight = false;
  });
  cm.replaceRange(source_code, target_pos);

  for (const source_layer of state.dragging_layers) {
    let source_range = source_layer.mark.find()!;
    cm.replaceRange('', { line: source_range.from.line, ch: 0 }, { line: source_range.to.line + 1, ch: 0 })
  }

  clean_up_passes(cm);

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


// Remove unecessary "pass" statements
// Add missing "pass" statements
function clean_up_passes(cm: DocOrEditor) {
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

  const default_iterable = default_code_for_type({".class": "Instance", "type_ref": "matplotlib._typing.ArrayLike", "args": []});
  const default_iterable_code = `for i, x in enumerate(${default_iterable}):\n    pass\n`;
  add_menu_item(
    add_layer_menu,
    'For-loop', null,
    (state => {
      add_line_of_code(default_iterable_code, state);
      hard_rerun(state);
    }),
    _ => true, // Enabled?
    state
  ).title = default_iterable_code.trim()

  const user_iterables_menu =
    add_submenu(
      add_layer_menu,
      'For-loop over...',
      _ => true, // Enabled?
      state
    );
  [default_iterable, ...state.user_iterables].forEach(iterable => {
    const code = `for i, x in enumerate(${iterable}):\n    pass\n`;
    add_menu_item(
      user_iterables_menu,
      iterable, null,
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

function deselect_layer(layer: Layer, state: State) {
  layer.el.classList.remove("selected");
  compute_selected_hover_regions(state);
  save_selected_layers(state);
}

export function deselect_all_layers(state: State) {
  state.layers_panel.layers.forEach(layer => deselect_layer(layer, state));
}

export function select_layer(layer: Layer, state: State) {
  deselect_all_layers(state);
  // console.log(layer.el)
  layer.el.classList.add("selected");
  // open_collapsable(layer.el.querySelector('.snp-collapsable')!);
  set_properties_panel_on(layer.call_views[0], state);
  compute_selected_hover_regions(state);
  save_selected_layers(state);
  // console.log(layer.el)
}

export function duplicate_selected_layers(state: State) {
  const cm = state.cell.code_mirror;
  const old_code = cm.getValue();
  selected_layers(state).forEach((layer : Layer) => {
    // Duplicate layer
    const mark = layer.mark;
    const range = mark.find()!;
    const insert_line = 1 + (range.to.line || cm.getCursor().line);

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
      state.persistent_dataset.new_calls = `["${id_of_new_call(func_code, line)}"]`;
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

  state.persistent_dataset.selected_calls = JSON.stringify(selected_calls);

  // const selected_layers = state.layers_panel.layers.filter(is_layer_selected);
  // const selected_calls = selected_layers.map(layer => layer.calls_with_args);
  // console.log(selected_calls);

}

// For regeneration after cell rerun
export function load_selected_layers(state: State) {
  const selected_calls = JSON.parse(state.persistent_dataset.selected_calls || '[]') as [number, string][];

  deselect_all_layers(state);

  state.layers_panel.layers.forEach(layer => {
    if (layer.calls_with_args.some(call_with_args => selected_calls.some(selected_call => equalByJSON(selected_call, call_with_args.call_info.call_id)))) {
      select_layer(layer, state);
    }
  });
}

