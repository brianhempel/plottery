import { Arg, ArgView, CallView, ChainLink, LinkSuggestion, MappingTableInfo, ProvNode, State } from "../../types";
import { add_sync_code_on_change_watcher, hard_rerun } from "../../code_sync/code_sync";
import { TextMarker, MarkerRange } from "../../utils/codemirror";
import { log_event } from "../../utils/instrumentation";
import { create_el, cm_start_pos, cm_end_pos, non_colliding_name, create_red_x_button_icon, default_code_for_type, get_proper_type, is_array_like } from "../../utils/misc";
import { Widget, make_widget_for_code_and_type } from "../widgets/widget";
import { DropdownWidget, add_item_to_dropdown_widget, committed_code, decorate_dropdown_items, select_dropdown_item } from "../widgets/dropdown/dropdown";
import { create_arbitrary_code_widget } from "../widgets/arbitrary_code/arbitrary_code";
import { create_link_widget, is_link_widget } from "../widgets/link/link";
import { MappingTableView, create_mapping_table_view, create_table_icon, is_color_type, is_mapping_table_widget } from "../mapping_table/mapping_table";
import { item_name_for, normalize_code, python_names, template_code } from "../mapping_table/mapping_table_code";
import { call_to_code } from "../call/call";
import "./arg.css";

// Arg handling needs to support int versus float sliders, colors, booleans, and e.g. fontdicts.

export function create_arg_view(
  arg: Arg,
  call_docstring: string | null,
  options: { disabled: boolean },
  state?: State,
  flush_call?: () => void, // writes the call's current widget state into the cell synchronously (for breaking the first chain link, which edits the call arg)
  call_mark?: TextMarker<MarkerRange>, // the call's own mark (for locating the call when applying a link suggestion)
  table_context?: MappingTableContext // for making this arg a mapping table
): ArgView {
  const arg_el = create_el("div", "plottery-arg-view");

  // Look for '...arg_name...:' and anything following at a higher indent level
  const regex = new RegExp(`^([ \\t]*)[\\w ,]*\\b${arg.name}\\b.*:.*(\\n+\\1[ \\t].*)*`, 'm');
  const arg_docstring = (call_docstring || '').match(regex)?.at(0);

  if (window.sessionStorage.getItem('plottery_demo_mode') !== 'true') {
    // Disabling this for video recording
    arg_el.title = arg_docstring || `No documentation available for ${arg.name}`;
  }
  // For debugging:
  // arg_el.title = JSON.stringify(arg.type);

  // Prefix with the argument name
  const prefixEl = create_el("div", "plottery-arg-name", arg_el);
  prefixEl.innerText = arg.name;

  if (options.disabled && arg.required) {
    console.warn("Arg is required but disabled!", arg, options);
  }

  if (options.disabled) {
    arg_el.classList.add("plottery-arg-disabled");
  }

  // Cross-call link suggestions: dropdown items that introduce a variable shared with another
  // call site. Hover previews the linked value locally (visually identical to the linked state);
  // click applies the non-local edit. `view` is assigned below but only read at hover/click time,
  // so the forward references are safe.
  const link_widgets = state
    ? (arg.link_suggestions ?? []).map(suggestion =>
        create_link_widget(
          suggestion,
          () => live_linked_value(suggestion, state) ?? suggestion.code,
          () => apply_link_suggestion(arg, view, suggestion, state, flush_call, call_mark)
        ))
    : [];

  // A mapping table arg (see mapping_table.ts) gets the table as its dropdown's selected item.
  const table = state && flush_call && call_mark && arg.mapping_table ? create_mapping_table_view(arg, arg.mapping_table, state, flush_call, call_mark) : undefined;

  // Get the widgets based on the type
  var widget: DropdownWidget = make_widget_for_code_and_type(arg.code, arg.type, arg.default_code, arg.type_compatible_code_snippets, table ? [...link_widgets, table.chip] : link_widgets);

  arg_el.append(widget.el);

  const view: ArgView = {
    el: arg_el,
    widget,
    positional: arg.is_positional,
    disabled: options.disabled,
  }

  if (table && state) {
    attach_mapping_table(view, table, state);
  } else if (state && flush_call && call_mark && table_context && arg.element_info) {
    add_mapping_table_buttons(arg, view, state, flush_call, call_mark, table_context);
  }

  // Variable-sharing provenance: render the chain (e.g. w2 ▸ w1 ▸ 0.5) after the first widget.
  if (arg.provenance && state) {
    render_provenance_chain(arg, view, state, flush_call);
  }

  // On clicking on a hidden arg view, unhide it
  arg_el.addEventListener("mousedown", ev => {
    if (view.disabled) {
      enable_arg_view(view);
      // ev.stopPropagation();
      // ev.preventDefault();
      log_event('gui', 'inspector click arg on', {arg: arg.name, arg_code: widget.to_code()});
    }
  });

  // On clicking the arg name, hide it
  prefixEl.addEventListener("mousedown", ev => {
    if (!view.disabled && !arg.required) {
      disable_arg_view(view);
      log_event('gui', 'inspector click arg off', {arg: arg.name, arg_code: widget.to_code()});
      ev.stopPropagation();
      ev.preventDefault();
    }
  });

  const arg_name_width = 105;
  set_max_width(prefixEl, arg_name_width);

  return view;
}

// Poll a widget's committed value and call on_change when it changes (mirrors the RAF loop
// in add_sync_code_on_change_watcher, but keyed on committed code rather than to_code()).
function on_committed_change(widget: Widget, state: State, on_change: () => void, is_active: () => boolean = () => true) {
  let curr = committed_code(widget);
  function loop() {
    if (!is_active()) return;
    const code = committed_code(widget);
    if (code !== curr) {
      curr = code;
      on_change();
    }
    state.is_in_dom() && is_active() && requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/* ----------------- Making mapping tables ----------------- */

// Is `code` (an arg's value) a list a mapping table could go through, or a single value?
// "unknown" when we can't tell (e.g. untyped code), so we don't guess and break the plot.
export function is_iterable_value(arg: Arg, code: string, state: State): "iterable" | "single" | "unknown" {
  // Values of the list's element type (a color tuple for `color`) are single values.
  if ((arg.element_info?.element_snippets ?? []).includes(code)) return "single";
  if (state.user_iterables.includes(code) || is_array_like(code)) return "iterable";
  if (arg.code_type && normalize_code(code) === normalize_code(arg.code)) {
    if (arg.code_is_iterable) return "iterable";
    if (get_proper_type(arg.code_type)[".class"] !== "AnyType") return "single";
  }
  if (/^(-?[0-9][0-9_]*(\.[0-9_]*)?([eE][+-]?[0-9]+)?|-?\.[0-9]+|'[^'\\\n]*'|"[^"\\\n]*"|True|False|None|\([^()]*\))$/.test(code)) return "single";
  return "unknown";
}

// The default formula for an arg that wasn't given: something that plots like the default.
function default_formula_for(arg: Arg): string {
  const element_type = arg.element_info?.element_type ?? null;
  if (element_type && is_color_type(element_type)) return "'C0'";
  if (arg.default_code && arg.default_code !== "None" && !is_array_like(arg.default_code)) return arg.default_code;
  const code = element_type ? default_code_for_type(element_type, arg.name) : "...";
  return code === "..." ? "None" : code;
}

function show_arg_note(view: ArgView, text: string) {
  view.el.querySelector(".plottery-arg-transient-note")?.remove();
  const note_el = create_el("div", "plottery-arg-transient-note", view.el);
  note_el.textContent = text;
  window.setTimeout(() => note_el.remove(), 6000);
}

export type MappingTableContext = {
  sibling_iterable_code: () => string | undefined; // another arg's list, for making a table out of a single value
  table_key: () => string; // "ax.bar #1|color", how Python keys this arg's rows (call_id|arg_key)
};

// Show `table` as the arg's value, with the table below the arg row while it's selected.
function attach_mapping_table(view: ArgView, table: MappingTableView, state: State) {
  const dropdown = view.widget as DropdownWidget;
  if (!dropdown.items.includes(table.chip)) add_item_to_dropdown_widget(dropdown, table.chip);
  if (!is_mapping_table_widget(dropdown.selected_item)) select_dropdown_item(dropdown, table.chip);
  table.attach(dropdown);
  view.el.classList.add("plottery-arg-has-table");
  view.el.append(table.el);
  on_committed_change(dropdown, state, () => table.set_visible(is_mapping_table_widget(dropdown.selected_item)));
}

// ▦ buttons that turn an arg into a mapping table: one on the arg row (shown on hover), and
// one on each dropdown suggestion that is a list.
function add_mapping_table_buttons(
  arg: Arg,
  view: ArgView,
  state: State,
  flush_call: () => void,
  call_mark: TextMarker<MarkerRange>,
  table_context: MappingTableContext
) {
  const create_button = (title: string, on_click: () => void) => {
    const button = create_el("div", "plottery-mt-convert");
    button.append(create_table_icon());
    button.title = title;
    // Don't let the row's mousedown turn a disabled arg on (and redraw) first.
    button.addEventListener("mousedown", ev => { ev.stopPropagation(); ev.preventDefault(); });
    button.addEventListener("click", ev => {
      ev.stopPropagation();
      ev.preventDefault();
      on_click();
    });
    return button;
  };
  const convert = (iterable_code: string, formula_code: string | null) =>
    convert_arg_to_mapping_table(arg, view, iterable_code, formula_code, state, flush_call, call_mark, table_context);

  view.el.append(create_button(`Choose the ${arg.name} for each item of a list, with a table`, () => {
    const code = committed_code(view.widget).trim();
    const kind = view.disabled ? "single" : is_iterable_value(arg, code, state);
    if (kind === "iterable") {
      convert(code, null);
    } else if (kind === "single") {
      // Every item starts with the current value, so the plot doesn't change.
      const iterable_code = table_context.sibling_iterable_code() ?? state.user_iterables[0];
      if (iterable_code === undefined) {
        show_arg_note(view, "There's no list to go through. Pick one from the dropdown's ▦ buttons, or define one first.");
      } else {
        convert(iterable_code, view.disabled ? default_formula_for(arg) : code);
      }
    } else {
      show_arg_note(view, `Can't tell whether \`${code}\` is a list or a single value. Pick a list from the dropdown's ▦ buttons instead.`);
    }
  }));

  const dropdown = view.widget as DropdownWidget;
  decorate_dropdown_items(dropdown, (item, item_holder) => {
    if (is_link_widget(item) || is_mapping_table_widget(item)) return;
    const code = item.to_code().trim();
    if (is_iterable_value(arg, code, state) !== "iterable") return;
    item_holder.append(create_button(`Choose the ${arg.name} for each item of ${code}, with a table`, () => {
      dropdown.el.classList.remove("expanded");
      dropdown.el.closest(".plottery_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
      dropdown.previewing_code = undefined;
      convert(code, null);
    }));
  });
}

// Make the arg the comprehension [F for item in E] over `iterable_code`, with `formula_code`
// as F (or each item itself, if null), and show its table:
//
//   ax.bar(..., color=['C0' for indicator in df['indicator']])
//
// Only the arg changes (through the call's watcher, as one undo step), so there's no rerun:
// the table's rows arrive with the redraw.
function convert_arg_to_mapping_table(
  arg: Arg,
  view: ArgView,
  iterable_code: string,
  formula_code: string | null,
  state: State,
  flush_call: () => void,
  call_mark: TextMarker<MarkerRange>,
  table_context: MappingTableContext
) {
  // The item's name only needs to stay clear of what the formula refers to.
  const formula_names = formula_code === null ? new Set<string>() : python_names(formula_code);
  let item_name = item_name_for(iterable_code);
  if (formula_names.has(item_name)) item_name = non_colliding_name(item_name, [...formula_names]);

  enable_arg_view(view);
  const info: MappingTableInfo = {
    table_key: table_context.table_key(),
    mapping_name: null,
    index_name: null,
    item_name,
    key_on: "item",
    formula_code: formula_code ?? item_name,
    iterable_code,
    runtime: null,
  };

  // It's a table now, so no more ▦ buttons.
  view.el.querySelectorAll(".plottery-mt-convert").forEach(button => button.remove());
  (view.widget as DropdownWidget).decorate_item = undefined;

  attach_mapping_table(view, create_mapping_table_view(arg, info, state, flush_call, call_mark), state);
  log_event("gui", "mapping table create", { arg: arg.name, arg_code: template_code({ ...info }) });
}

/* ----------------- Cross-call link suggestions ----------------- */

// Resolve a link suggestion's call_id + arg_name to the live CallView/ArgView. We resolve at
// hover/click time (not render time) and through marks/widgets (not serialized positions)
// because soft GUI edits rewrite the cell without a hard rerun, making baked positions stale.
function find_linked_arg_view(suggestion: LinkSuggestion, state: State): { call_view: CallView; arg_view: ArgView } | undefined {
  for (const layer of state.layers_panel.layers) {
    const i = layer.calls_with_args.findIndex(cwa => cwa.call_info.call_id === suggestion.call_id);
    if (i === -1) continue;
    const call_view = layer.call_views[i];
    const arg_and_view = call_view?.arguments.find(({ arg }) => arg.name === suggestion.arg_name);
    return arg_and_view ? { call_view, arg_view: arg_and_view.view } : undefined;
  }
  return undefined;
}

// The linked arg's current committed value (it may have been edited since the last hard rerun).
function live_linked_value(suggestion: LinkSuggestion, state: State): string | undefined {
  const linked = find_linked_arg_view(suggestion, state);
  return linked && committed_code(linked.arg_view.widget);
}

// Choosing a link suggestion: introduce a variable shared by this arg and the linked call's arg.
//
//   color2 = (0, 0, 1)
//   ax.bar(["a", "b", "c"], [1, 3, 2], color=color2)
//   ax.scatter(["a", "b", "c"], [1, 3, 2], color=color2)
//
// All edits go through the live CallViews and their marks (robust to any edits since render),
// then a hard rerun rebuilds the UI, since this is a structural, non-local change.
function apply_link_suggestion(
  arg: Arg,
  view: ArgView,
  suggestion: LinkSuggestion,
  state: State,
  flush_call?: () => void,
  call_mark?: TextMarker<MarkerRange>
) {
  const cm = state.cell.code_mirror;

  const linked = find_linked_arg_view(suggestion, state);
  const this_range = call_mark?.find();
  const linked_range = linked?.call_view.mark.find();
  if (!linked || !linked_range || !this_range) {
    console.warn("Can't apply link suggestion (no live call view/mark for it)", suggestion);
    return;
  }

  const var_name = non_colliding_name(suggestion.arg_name, state.avoid_names);
  const rhs = committed_code(linked.arg_view.widget);

  // Rewrite the linked call's arg to the shared variable and flush its text through its mark.
  set_committed_code(linked.arg_view, var_name);
  const linked_range_now = linked.call_view.mark.find();
  if (linked_range_now) cm.replaceRange(call_to_code(linked.call_view), linked_range_now.from, linked_range_now.to);

  // Same for this call's arg, enabling it if it wasn't passed before (e.g. adding color=... to
  // a call with no color argument yet).
  enable_arg_view(view);
  set_committed_code(view, var_name);
  flush_call?.();

  // Insert the shared variable's assignment above the earlier of the two calls, at its
  // indentation. This must come *after* the call flushes: the call marks are inclusiveLeft,
  // so a line inserted at a call's start gets absorbed into its mark, and a later flush
  // through that mark would overwrite the assignment.
  const insert_line = Math.min(call_mark!.find()!.from.line, linked.call_view.mark.find()!.from.line);
  const indentation = ((cm.getLine(insert_line) || "").match(/^\s*/) || [""])[0];
  cm.replaceRange(`${indentation}${var_name} = ${rhs}\n`, { line: insert_line, ch: 0 });

  log_event("gui", "link suggestion apply", { arg: arg.name, var_name, arg_code: rhs, linked_call: suggestion.call_id });
  hard_rerun(state);
}

// Commit `code` on an arg's dropdown as an arbitrary-code selection. The currently selected
// item may be a rich widget (e.g. a color picker) that can't hold a variable name, so select
// a fresh arbitrary-code item instead of calling set_code on it.
function set_committed_code(view: ArgView, code: string) {
  const dropdown = view.widget as DropdownWidget;
  if (dropdown.selected_item) {
    const code_widget = create_arbitrary_code_widget(code);
    add_item_to_dropdown_widget(dropdown, code_widget);
    select_dropdown_item(dropdown, code_widget);
  } else {
    view.widget.set_code(code);
  }
}

// Walk the provenance tree (linear for plain variables; children is a list for future
// branching) and render one editable link per node, bound to its source location via a
// CodeMirror mark + sync watcher. The call's own text is unchanged: only these marks edit
// the (possibly off-call) binding lines.
//
// Editing an upstream link makes everything downstream of it stale (e.g. changing w1 in
// `w2 ▸ w1 ▸ 0.5` means the `0.5` link, which edits w1's definition, no longer feeds this
// arg). So on a committed change to a widget we tear down all links downstream of it. This
// includes the first widget (the call arg itself, `view.widget`): changing it strands the
// whole chain.
function render_provenance_chain(arg: Arg, view: ArgView, state: State, flush_call?: () => void) {
  const cm = state.cell.code_mirror;
  const cell_lineno = state.cell_lineno;
  const links: ChainLink[] = [];

  // Remove every link from index `from` onward: pull its DOM (separator + link wrapper) and
  // clear its mark. The `active` flag stops that link's watchers (idempotent, so safe to re-call).
  const remove_downstream = (from: number) => {
    for (let k = from; k < links.length; k++) {
      const link = links[k];
      if (!link.active) continue;
      link.active = false;
      link.sep_el.remove();
      link.link_el.remove();
      link.mark.clear();
    }
  };

  // Break the chain at the arrow before links[idx]: inline links[idx]'s value one level up
  // (into the segment on the arrow's left), then re-derive the whole chain via a full rerun.
  // `w2 ▸ w1 ▸ 0`, breaking the first arrow, writes `width=w1` and re-roots to `w1 ▸ 0`.
  const break_at = (idx: number) => {
    const inline_value = committed_code(links[idx].widget);
    if (idx === 0) {
      // The left segment is the call argument itself, which has no dedicated mark.
      view.widget.set_code(inline_value);
      flush_call?.(); // synchronously write the call text before the rerun reads it
    } else {
      const range = links[idx - 1].mark.find();
      if (range) cm.replaceRange(inline_value, range.from, range.to);
    }
    log_event("gui", "chain break", { arg_code: inline_value });
    hard_rerun(state);
  };

  let node: ProvNode | undefined = arg.provenance;
  while (node) {
    const idx = links.length; // this link's index; its separator (the arrow) sits to its left
    const pos = node.pos;
    const from = cm_start_pos(pos, cell_lineno);
    const to = cm_end_pos(pos, cell_lineno);
    const link_src = cm.getRange(from, to);

    const sep_el = create_el("div", "plottery-chain-sep", view.el);
    const arrow_el = create_el("span", "plottery-chain-arrow", sep_el);
    arrow_el.innerText = "▸";

    // "×" replacing the arrow on hover: break the chain here (inline this value one level up,
    // re-rooting the chain), previewing by striking out the variable that would be dropped.
    const break_el = create_el("div", "plottery-chain-break", sep_el);
    break_el.append(create_red_x_button_icon());
    const var_name = node.var_name ?? (idx === 0 ? committed_code(view.widget) : committed_code(links[idx - 1].widget));
    break_el.title = `Stop using \`${var_name}\` and instead use just \`${link_src}\``;
    // The dropped element is the one immediately left of this arrow (it shows `var_name`).
    const dropped_el = idx === 0 ? view.widget.el : links[idx - 1].link_el;
    break_el.addEventListener("mouseenter", () => dropped_el.classList.add("plottery-chain-strike"));
    break_el.addEventListener("mouseleave", () => dropped_el.classList.remove("plottery-chain-strike"));
    break_el.addEventListener("click", ev => {
      ev.stopPropagation();
      ev.preventDefault();
      break_at(idx);
    });

    // Wrapper so chain-link sliders can be styled narrower than standalone arg sliders.
    const link_el = create_el("div", "plottery-chain-link", view.el);
    const widget = make_widget_for_code_and_type(link_src, arg.type, arg.default_code, arg.type_compatible_code_snippets);
    link_el.append(widget.el);

    const mark = cm.markText(from, to, { inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false });
    const link = { widget, mark, pos, sep_el, link_el, active: true };

    add_sync_code_on_change_watcher(() => widget.to_code(), [mark], state, () => link.active);
    on_committed_change(widget, state, () => remove_downstream(idx + 1), () => link.active);

    links.push(link);

    node = node.children[0];
  }

  if (links.length > 0) {
    view.chain_links = links;
    // Changing the call arg itself (the first widget) strands the entire chain.
    on_committed_change(view.widget, state, () => remove_downstream(0));
  }
}

// If the item name is too long (120px), make it smaller.
// But we can't do this until the actual width is known.
function set_max_width(el: HTMLElement, width_px: number) {
  el.style.minWidth = `${width_px}px`;

  const resizeObserver = new ResizeObserver((entries) => {
    // console.log("resizeObserver", entries);
    for (const entry of entries) {
      if (entry.borderBoxSize) {
        const width = (entry.borderBoxSize[0] || entry.borderBoxSize).inlineSize;
        if (width > 0) {
          if (width > width_px) {
            el.style.width = `${width_px}px`;
            const xscale = width_px / width;
            const dx     = (width - width_px) / 2;
            el.style.transform = `scale(${xscale}, 1) translate(-${dx}px, 0)`;
          }
          resizeObserver.disconnect();
          break;
        }
      }
    }
  });
  resizeObserver.observe(el);
}

export function enable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.remove("plottery-arg-disabled");
  arg_view.disabled = false;
}

function disable_arg_view(arg_view: ArgView) {
  arg_view.el.classList.add("plottery-arg-disabled");
  arg_view.disabled = true;
}

// Show the value the value of the control, but in the layer panel
// export function make_proxy_arg_el(arg : Arg, view : ArgView, state: State) : HTMLElement {
//   const proxy_arg_el = create_el("div", ["plottery-arg-view", "plottery-proxy"]);

//   const name_el = create_el("div", ["plottery-arg-name", "plottery-proxy"], proxy_arg_el);
//   const code_el = create_el("div", ["plottery-arg-value", "plottery-proxy"], proxy_arg_el);

//   name_el.innerText = arg.name;

//   const arg_name_width = 120;
//   set_max_width(name_el, arg_name_width);

//   let last_code = '';
//   let last_disabled = false;
//   function sync() {
//     if (view.widget.to_code() !== last_code) {
//       last_code = view.widget.to_code();
//       code_el.innerText = last_code;
//     }
//     if (view.disabled !== last_disabled) {
//       last_disabled = view.disabled;
//       proxy_arg_el.classList.toggle("plottery-arg-disabled", last_disabled);
//     }
//     state.is_in_dom() && requestAnimationFrame(sync);
//   }
//   sync();

//   return proxy_arg_el;
// }

