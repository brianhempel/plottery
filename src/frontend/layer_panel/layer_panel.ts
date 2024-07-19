import { P_stmt } from "../ast_types";
import { add_sync_code_on_change_watcher, hard_rerun, redraw_cell } from "../code_sync/code_sync";
import { add_menu_item, add_submenu, create_menu_el } from "../menus/menus";
import { call_to_code, create_call_view } from "../sidebar/call/call";
import { open_collapsable } from "../sidebar/collapsable/collapsable";
import { compute_selected_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { add_method_call } from "../sidebar/methods/method";
import { create_arbitrary_code_widget } from "../sidebar/widgets/arbitrary_code/arbitrary_code";
import { make_widget_for_code_and_type, widget_to_code } from "../sidebar/widgets/widget";
import { CallView, CallWithArgs, DynamicCallInfo, IInstanceType, State, StaticCallTypeInfo } from "../types";
import { equalByJSON } from "../utils/array";
import { TextMarker, MarkerRange, DocOrEditor } from "../utils/codemirror";
import { create_el, cm_end_pos, cm_start_pos, add_line_of_code } from "../utils/misc";
import { ParseableComment } from "../types";


export type Layer = {
  // parents: Layer[];
  el: HTMLElement;
  mark: TextMarker<MarkerRange>;
  target_mark: TextMarker<MarkerRange>;
  calls_with_args: CallWithArgs<DynamicCallInfo>[];
  call_views: CallView[];
}

export type LayersPanel = {
  el: HTMLElement;
  layers: Layer[];
};

export function layers_from_typed_node(typed_node: any, state: State, indent_level: number = 0): Layer[] {
  const layer_el = create_el("div", "snp-layer");

  // console.log('layer typed node:', typed_node)

  const calls_with_args = state.calls_with_args;
  const calls_at_loc = calls_with_args.filter(call => call.call_info.call.pos.line === typed_node.line);

  const call_views: CallView[] =
    calls_at_loc.map(calls_with_args => create_call_view(calls_with_args, state));

  // console.log('layer call_views:', call_views)

  const sublayers: Layer[] = [];

  const cm = state.cell.code_mirror;
  const mark = cm.markText(
    cm_start_pos(typed_node, state.cell_lineno),
    cm_end_pos(typed_node, state.cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true }
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
    const iterator_widget = make_widget_for_code_and_type(iterable_code, iterable_type, state.user_iterables);

    layer_el.append(
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
      { inclusiveLeft: true, inclusiveRight: true }
    );
    const end_of_for_line = {
      line: expr_end.line,
      ch: expr_end.ch + 1000
    }
    target_mark = cm.markText(
      cm_start_pos(typed_node, state.cell_lineno),
      end_of_for_line,
      { inclusiveLeft: true, inclusiveRight: true }
    );
    add_sync_code_on_change_watcher(
      () => `${widget_to_code(pattern_widget)} in ${is_enumerate ? "enumerate(" : ""}${widget_to_code(iterator_widget)}${is_enumerate ? ")" : ""}`,
      edit_mark, state
    );
    layer_el.classList.add(`indentbelow-${indent_level+1}`)
    layer_el.classList.add(`for-loop`)

    sublayers.push(...typed_node.body.body.flatMap(node => layers_from_typed_node(node, state, indent_level + 1)));
    // sublayers.forEach(sublayer => sublayer.parents.push(layer));
  } else {
    layer_el.innerText = typed_node.unparsed;
    layer_el.classList.add("snp-code-layer");
  }
  layer_el.classList.add(`indent-${indent_level}`)

  const layer = {
    // parents: [],
    el: layer_el,
    calls_with_args: calls_at_loc,
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
    if (ev.target == layer_el) {
      select_layer(layer, state);
    }
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
    const layer_code = cm.getRange(layer_range.from, layer_range.to);

    if (!visible_checkbox.checked) {
      cm.replaceRange(layer_code.replaceAll(/^/mg, '# '), layer_range.from, layer_range.to)
    } else {
      cm.replaceRange(layer_code.replaceAll(/^# /mg, ''), layer_range.from, layer_range.to)
    }

    if (visible_checkbox.checked && hard_run_on_enable) {
      hard_rerun(state); // Layers rendered as plain text need a full rerun to generate their full UI.
    } else {
      redraw_cell(state);
    }
  })
}

export function layers_from_parseable_comment(comment: ParseableComment, state: State): Layer[] {
  const layer_el = create_el("div", "snp-layer");

  const mark = state.cell.code_mirror.markText(
    cm_start_pos(comment, state.cell_lineno),
    cm_end_pos(comment, state.cell_lineno),
    { inclusiveLeft: true, inclusiveRight: true }
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

// Remove unecessary "pass" statements
// Add missing "pass" statements
function clean_up_passes(cm: DocOrEditor) {
  let code = cm.getValue();

  cm.setValue(
    code
      .replaceAll(/(^[ \t]*)((for|def|if|elif|else|try|except)\b.*:\s*)^/mg, '$1$2$1    pass\n') // add passes everywhere...not perfect but we'll roll with it
      .replaceAll(/(^[ \t]*)pass\s*\n(\1\S)/mg,     '$2')   // remove passes with stuff after
      .replaceAll(/(^[ \t]*)(\S.*\n)\1pass.*\n?/mg, '$1$2') // remove passes with stuff before
  )
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

  const add_layer_menu = create_menu_el('<span class="snp-add-layer-button">＋ Add Layer</span>', layers_panel_heading)

  add_menu_item(
    add_layer_menu,
    'For-loop', null,
    (state => {
      const code = "for i, x in enumerate([1, 2, 3]):\n    pass\n";
      add_line_of_code(code, state);
      hard_rerun(state);
    }),
    _ => true, // Enabled?
    state
  )

  const user_iterables_menu =
    add_submenu(
      add_layer_menu,
      'For-loop over...',
      _ => true, // Enabled?
      state
    )
  state.user_iterables.forEach(iterable => {
    add_menu_item(
      user_iterables_menu,
      iterable, null,
      (state => {
        const code = `for i, x in enumerate(${iterable}):\n    pass\n`;
        add_line_of_code(code, state);
        hard_rerun(state);
      }),
      _ => true, // Enabled?
      state
    )
  });

  // Add possible method calls to the menu
  state.methods.forEach(method => {
    add_menu_item(
      add_layer_menu,
      method.receiver_dot_name, null,
      (state => add_method_call(method, state)),
      _ => true, // Enabled?
      state
    )
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
  open_collapsable(layer.el.querySelector('.snp-collapsable')!);
  compute_selected_hover_regions(state);
  save_selected_layers(state);
  // console.log(layer.el)
}

export function duplicate_selected_layers(state: State) {
  const cm = state.cell.code_mirror;
  const old_code = cm.getValue();
  selected_layers(state).forEach((layer : Layer) => {
    // Duplicate layer
    layer.call_views.forEach(call_view => {
      const insert_line = 1 + (call_view.mark.find()?.to.line || cm.getCursor().line);

      cm.replaceRange(call_to_code(call_view) + '\n', {line: insert_line, ch: 0})
    });
  });
  if(cm.getValue() !== old_code) {
    hard_rerun(state);
  }
}

// For regeneration after cell rerun
function save_selected_layers(state: State) {
  const selected_calls = state.layers_panel.layers.filter(is_layer_selected).flatMap(layer => layer.calls_with_args).map(call_with_args => call_with_args.call_info.loc_via_func_code_and_num);

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
    if (layer.calls_with_args.some(call_with_args => selected_calls.some(selected_call => equalByJSON(selected_call, call_with_args.call_info.loc_via_func_code_and_num)))) {
      select_layer(layer, state);
    }
  });
}
