import { Arg, ArgView, CallView, ChainLink, ProvNode, State } from "../types";
import { create_arg_view, disable_arg_view, enable_arg_view, link_arg_views, link_blocker } from "../sidebar/arg/arg";
import { DropdownWidget, committed_code, set_dropdown_code } from "../sidebar/widgets/dropdown/dropdown";
import { flush_call_view, write_calls_and_redraw } from "../sidebar/call/call";
import { is_valid_python_name, normalize_code } from "../sidebar/mapping_table/mapping_table_code";
import { in_undo_group } from "../code_sync/undo_group";
import { hard_rerun } from "../code_sync/code_sync";
import { create_chain_link_icon, create_el, non_colliding_name } from "../utils/misc";
import { log_event } from "../utils/instrumentation";
import "./multi_args.css";

// With several calls selected, the Properties panel shows one row per arg they all have (by
// name), in the first selected call's order. A row edits that arg of every selected call: it
// passes each edit (and each dropdown hover preview) on to the calls' own arg views (which stay
// in their layer rows), whose change watchers write each call's code, keeping its formatting.
//
// A row shows the value of the first selected call that has the arg set, in italics when the
// calls' values differ. Its link icon makes the calls share one variable for the arg, or, once
// they do, gives each call its own copy of the variable's value again.

type Member = { call_view: CallView; arg: Arg; view: ArgView };

// A row: its per-frame sync with the calls (`tick`), ending its preview (`stop`), and clearing
// its chain marks (`teardown`).
type Row = { el: HTMLElement; tick: () => void; stop: () => void; teardown: () => void };

// The rows of one panel, which one loop ticks every frame while `rows_active`. A row that starts
// a hard rerun (linking, unlinking) stops them all, so none writes to the cell while it reruns:
// e.g. the line linking adds moves the rows down, which can put the pointer over another row's
// link icon, whose preview would land in the code.
type Panel = { rows_active: boolean; rows: Row[] };

function stop_all_rows(panel: Panel) {
  panel.rows_active = false;
  panel.rows.forEach(row => row.stop());
}

export function create_multi_args(call_views: CallView[], state: State): { el: HTMLElement; teardown: () => void } {
  const el = create_el("div", ["plottery-args", "plottery-multi-args"]);
  const panel: Panel = { rows_active: true, rows: [] };

  const names = new Set<string>();
  call_views[0].arguments.forEach(({ arg }) => {
    // Not *args, nor a positional arg that isn't in the callee's type (they're all "unknown").
    if (names.has(arg.name) || arg.kind === "ARG_STAR" || (arg.type === null && arg.is_positional)) return;
    names.add(arg.name);

    const members = call_views.map(call_view => {
      const found = call_view.arguments.find(({ arg: call_arg }) => call_arg.name === arg.name);
      return found && { call_view, arg: found.arg, view: found.view };
    });
    if (members.some(member => member === undefined)) return;

    const row = create_multi_arg_row(members as Member[], state, panel);
    el.append(row.el);
    panel.rows.push(row);
  });

  if (panel.rows.length === 0) {
    create_el("div", "plottery-multi-args-none", el).textContent = "No properties in common";
  }

  const keep_synced = () => {
    if (!panel.rows_active || !state.is_in_dom()) return;
    panel.rows.forEach(row => row.tick());
    requestAnimationFrame(keep_synced);
  };
  requestAnimationFrame(keep_synced);

  const teardown = () => {
    stop_all_rows(panel);
    panel.rows.forEach(row => row.teardown());
    el.remove();
  };
  return { el, teardown };
}

// "ax.bar ×2, ax.scatter"
export function multi_call_label(call_views: CallView[]): string {
  const counts = new Map<string, number>();
  call_views.forEach(({ els: { name_el } }) => {
    const name = name_el.textContent ?? "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts].map(([name, count]) => count > 1 ? `${name} ×${count}` : name).join(", ");
}

function create_multi_arg_row(members: Member[], state: State, panel: Panel): Row {
  const name = members[0].arg.name;

  let link_previewing = false; // hovering the link icon

  // Calls whose arg is on only to show the row's preview (see show_preview).
  const on_for_preview = new Set<ArgView>();
  const is_set = (member: Member) => !member.view.disabled && !on_for_preview.has(member.view);

  // The row shows the value of the first selected call with the arg set. If none has, it's off.
  const shown_member = () => members.find(is_set);
  const is_mixed = () => new Set(members.map(member => is_set(member) ? `set ${normalize_code(committed_code(member.view.widget))}` : "off")).size > 1;

  // The variable every call's arg is, if they're all the same one.
  const shared_variable = (): string | undefined => {
    if (!members.every(is_set)) return undefined;
    const codes = new Set(members.map(member => committed_code(member.view.widget).trim()));
    const [code] = codes;
    return codes.size === 1 && is_valid_python_name(code) ? code : undefined;
  };

  const shown = shown_member() ?? members[0];
  const arg: Arg = {
    ...members[0].arg,
    code: committed_code(shown.view.widget),
    required: members.some(member => member.arg.required),
    // Only suggest the variables that would work for every call.
    type_compatible_code_snippets: (members[0].arg.type_compatible_code_snippets ?? []).filter(snippet =>
      members.every(member => (member.arg.type_compatible_code_snippets ?? []).includes(snippet))
    ),
    pos: undefined,
    code_type: undefined,
    code_is_iterable: undefined,
    provenance: shared_variable() === undefined ? undefined : shared_chain(members, state),
    // Links to other calls, and mapping tables, are for one call at a time.
    link_suggestions: undefined,
    element_info: undefined,
    mapping_table: undefined,
  };

  // Show `preview` (undefined: none) in every call, turning the arg on just for the preview in
  // calls where it's off.
  const show_preview = (preview: string | undefined) => {
    members.forEach(member => {
      if (preview !== undefined && member.view.disabled) {
        enable_arg_view(member.view);
        on_for_preview.add(member.view);
      } else if (preview === undefined && on_for_preview.has(member.view)) {
        disable_arg_view(member.view);
        on_for_preview.delete(member.view);
      }
      (member.view.widget as DropdownWidget).previewing_code = preview;
    });
  };

  const stop = () => {
    link_previewing = false;
    show_preview(undefined);
  };

  // Set every call's arg to the row's value, or turn it off in every call.
  const apply_row = () => {
    const code = committed_code(dropdown);
    members.forEach(member => {
      on_for_preview.delete(member.view);
      if (view.disabled) {
        if (!member.arg.required) disable_arg_view(member.view);
      } else {
        enable_arg_view(member.view);
        if (committed_code(member.view.widget) !== code) set_dropdown_code(member.view.widget as DropdownWidget, code);
      }
    });
  };

  // Write every call's code now, for breaking the row's variable chain at its first arrow
  // (see render_provenance_chain), which sets the row's value, calls this, and hard reruns.
  const flush_calls = () => {
    stop_all_rows(panel);
    in_undo_group(state, () => { // One undo step
      apply_row();
      members.forEach(member => flush_call_view(member.call_view, state));
    });
  };

  const view = create_arg_view(arg, { disabled: shown_member() === undefined }, state, flush_calls);
  const dropdown = view.widget as DropdownWidget;

  // Whether the row shows what the calls have (it may not after a call changes some other way,
  // e.g. by dragging its shape on the plot).
  const row_matches_calls = () => {
    const shown = shown_member();
    return shown ? !view.disabled && committed_code(shown.view.widget) === committed_code(dropdown) : view.disabled;
  };
  const show_calls_in_row = () => {
    const shown = shown_member();
    if (shown) {
      enable_arg_view(view);
      set_dropdown_code(dropdown, committed_code(shown.view.widget));
    } else {
      disable_arg_view(view);
    }
  };

  // Edits to the variable's value in the row's chain (color ▸ (0, 0, 1)) write the variable's
  // assignment through the row's own marks. Show them in each call's chain too, so they're
  // current when one call is selected (their watchers find the code already written). An edit
  // made through one call's chain instead (e.g. by dragging its shape on the plot) is shown in
  // the row and the other calls' chains, rather than undone.
  const last_chain_codes = (view.chain_links ?? []).map(link => committed_code(link.widget));
  const sync_chains = () => {
    (view.chain_links ?? []).forEach((row_link, i) => {
      if (!row_link.active) return;
      const links = members.map(member => member.view.chain_links?.[i]).filter(link => link?.active) as ChainLink[];
      let code = committed_code(row_link.widget);
      const edited_in_call = code === last_chain_codes[i] && links.find(link => committed_code(link.widget) !== code);
      if (edited_in_call) {
        code = committed_code(edited_in_call.widget);
        set_dropdown_code(row_link.widget as DropdownWidget, code);
      }
      links.forEach(link => {
        if (committed_code(link.widget) !== code) set_dropdown_code(link.widget as DropdownWidget, code);
      });
      last_chain_codes[i] = code;
    });
  };

  /* ----------------- Link icon ----------------- */

  const link_el = create_el("div", "plottery-arg-link", view.el);
  link_el.append(create_chain_link_icon());

  // Unlinking puts the variable's value in each call, so each call's chain must still know where
  // the variable's assignment is.
  const can_unlink = () => members.every(member => {
    const link = member.view.chain_links?.[0];
    return !!link?.active && !!link.mark.find();
  });

  // Why clicking the link icon wouldn't work, or null.
  const link_problem = (): string | null => {
    const variable = shared_variable();
    if (variable !== undefined) {
      return can_unlink() ? null : `Can't unlink: can't find where \`${variable}\` is set in this cell`;
    }
    return link_blocker(committed_code(dropdown).trim(), members.map(({ call_view }) => call_view), state);
  };

  // Make every call's arg one variable: an existing one if the row's value is a variable,
  // otherwise a new one assigned the row's value.
  const link = () => {
    const value = committed_code(dropdown).trim();
    const reuse = is_valid_python_name(value);
    const var_name = reuse ? value : non_colliding_name(is_valid_python_name(name) ? name : "value", state.avoid_names);
    stop_all_rows(panel);
    log_event("gui", "multi-select link", { arg: name, var_name, arg_code: value });
    link_arg_views(members.map(({ call_view, view }) => ({ call_view, arg_view: view })), var_name, reuse ? null : value, state);
  };

  // What breaking each call's variable chain at its first arrow does (see render_provenance_chain):
  // put the variable's value in each call's arg instead, keeping the variable's assignment.
  const unlink = () => {
    const cm = state.cell.code_mirror;
    const variable = shared_variable();
    stop_all_rows(panel);
    in_undo_group(state, () => { // One undo step
      members.forEach(member => {
        const range = member.view.chain_links![0].mark.find()!;
        set_dropdown_code(member.view.widget as DropdownWidget, cm.getRange(range.from, range.to));
        flush_call_view(member.call_view, state);
      });
    });
    log_event("gui", "multi-select unlink", { arg: name, var_name: variable });
    hard_rerun(state);
  };

  // Don't let the row's mousedown turn the arg on first.
  link_el.addEventListener("mousedown", ev => { ev.stopPropagation(); ev.preventDefault(); });

  let can_preview_link = false;
  link_el.addEventListener("mouseenter", () => {
    const variable = shared_variable();
    const problem = link_problem();
    link_el.classList.toggle("blocked", problem !== null);
    link_el.title = problem ?? (variable === undefined
      ? `Link: make these ${members.length} calls share one variable for ${name}`
      : `Unlink: give each call its own copy of \`${variable}\`'s value`);
    can_preview_link = problem === null && variable === undefined;
  });
  // Preview linking (every call with the row's value) once the pointer moves over the icon, not
  // when the icon lands under a still pointer (e.g. the rows of the rerun after a link).
  link_el.addEventListener("mousemove", ev => {
    if (can_preview_link && (ev.movementX !== 0 || ev.movementY !== 0)) link_previewing = true;
  });
  link_el.addEventListener("mouseleave", () => { link_previewing = false; });

  link_el.addEventListener("click", ev => {
    ev.stopPropagation();
    ev.preventDefault();
    if (!panel.rows_active || link_problem() !== null) return;
    if (shared_variable() === undefined) {
      link();
    } else {
      unlink();
    }
  });

  /* ----------------- Keeping the row and the calls in sync ----------------- */

  // The row's preview: its dropdown's hovered item, or, while hovering the link icon, its value.
  const row_preview = () => dropdown.previewing_code || (link_previewing ? committed_code(dropdown) : undefined);
  const row_state = () => ({ disabled: view.disabled, committed: committed_code(dropdown), preview: row_preview() });
  let last = row_state();

  // Run every frame by the panel (see create_multi_args).
  const tick = () => {
    const now = row_state();
    const committed_changed = now.disabled !== last.disabled || now.committed !== last.committed;
    if (committed_changed || now.preview !== last.preview) {
      in_undo_group(state, () => { // One undo step for all the calls
        if (committed_changed) apply_row();
        show_preview(now.preview);
        write_calls_and_redraw(members.map(member => member.call_view), state);
      });
    } else if (now.preview === undefined && !row_matches_calls()) {
      show_calls_in_row();
    }
    sync_chains();

    if (now.preview === undefined) view.el.classList.toggle("plottery-arg-mixed", is_mixed());
    link_el.classList.toggle("linked", shared_variable() !== undefined);

    last = row_state();
  };

  const teardown = () => {
    // The row's chain links have marks and watchers of their own.
    (view.chain_links ?? []).forEach(link => {
      link.active = false;
      link.mark.clear();
    });
  };

  return { el: view.el, tick, stop, teardown };
}

// When every call's arg is the same variable with the same assignment, that variable's chain
// (e.g. color ▸ (0, 0, 1)), at its live position: the positions from the render go stale as the
// cell is edited, but the calls' chain links track them with marks.
function shared_chain(members: Member[], state: State): ProvNode | undefined {
  const cm = state.cell.code_mirror;

  const first_link_range = (member: Member) => {
    const link = member.view.chain_links?.[0];
    const range = link?.active ? link.mark.find() : undefined;
    return range && `${cm.indexFromPos(range.from)}-${cm.indexFromPos(range.to)}`;
  };
  const ranges = members.map(first_link_range);
  if (ranges.some(range => range === undefined) || new Set(ranges).size !== 1) return undefined;

  // The first call's chain, as far as its links are still live
  const nodes: ProvNode[] = [];
  let node = members[0].arg.provenance;
  for (const link of members[0].view.chain_links!) {
    const range = link.active ? link.mark.find() : undefined;
    if (!node || !range) break;
    nodes.push({
      ...node,
      pos: { line: range.from.line + state.cell_lineno, column: range.from.ch, end_line: range.to.line + state.cell_lineno, end_column: range.to.ch },
      children: [],
    });
    node = node.children[0];
  }
  nodes.forEach((node, i) => { if (i + 1 < nodes.length) node.children = [nodes[i + 1]]; });
  return nodes[0];
}
