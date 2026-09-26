import { log_event } from "../../../utils/instrumentation";
import { create_el } from "../../../utils/misc";
import { Widget } from "../widget";
import { is_link_widget } from "../link/link";
import "./dropdown.css";

export type DropdownWidget = Widget & {
  kind: "Dropdown"; // not really used
  items: Widget[];
  selected_item: Widget | undefined;
  selected_item_holder_el: HTMLElement;
  drawer_el: HTMLElement;
  previewing_code: string | undefined;
};

/**
 * Creates a dropdown widget. Looks something like:
 *
 * apple
 *  +------------+
 *  | apple*   a |
 *  | banana   b |
 *  | mango    m |
 *  +------------+
 *
 * When you select an item, the item is cloned to the selected item holder.
 * That way, the user can potentially edit the code while the original value
 * remains available in the dropdown.
 */
export function create_dropdown_widget(items: Widget[]): DropdownWidget {
  const el = create_el("div", "plottery-dropdown");

  // Put the first element as selected item
  const selected_item_holder_el = create_el(
    "div",
    "plottery-dropdown-selected-item",
    el
  );

  // On clicking the selected item, open up the dropdown
  selected_item_holder_el.addEventListener("click", () => {
    el.classList.toggle("expanded");
    if (el.classList.contains("expanded")) {
      // And hide the selected layer while previewing dropdown items
      log_event("gui", "dropdown suggestions open");
      el.closest(".plottery_outer")?.querySelector(".hover_regions")?.classList.add("hide_during_interaction");
    } else {
      log_event("gui", "dropdown suggestions close");
      el.closest(".plottery_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
    }
  });

  function deselect(e: MouseEvent) {
    if (!el.isConnected) { document.body.removeEventListener("click", deselect); return; } // Remove self once stale after rerender
    if (e.target != null && !(e.target == el) && !el.contains(e.target as HTMLElement)) {
      if (el.classList.contains("expanded")) {
        log_event("gui", "dropdown suggestions close");
        el.classList.remove("expanded");
        el.closest(".plottery_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
      }
    }
  }

  document.body.addEventListener("click", deselect);

  // Drawer items
  const drawer_el = create_el("div", "plottery-dropdown-drawer", el);


  // Create a dropdown with an empty drawer
  const dropdown: DropdownWidget = {
    kind: "Dropdown",
    el,
    kind_label_for_dropdown: "hmm shouldn't have dropdowns in dropdowns",
    does_match_arg_code: (arg_code) => { console.warn("We don't support nested arg dropdowns right now", dropdown, arg_code); return false },
    to_code:             ()         => dropdown.previewing_code || dropdown.selected_item?.to_code() || "",
    set_code:            (new_code) => { if (!dropdown.selected_item) { throw new Error("dropdown.set_code(): No selected item!") } else { dropdown.selected_item.set_code(new_code); } },
    clone:               ()         => { throw new Error("dropdown.clone(): should not be cloning dropdown widgets because we don't have nested dropdowns") },
    items: [],
    selected_item: undefined,
    selected_item_holder_el,
    drawer_el,
    previewing_code: undefined,
  };

  // Populate the dropdown
  items.forEach(item => add_item_to_dropdown_widget(dropdown, item));

  // Select the first item
  select_dropdown_item(dropdown, items[0]);

  // Collapse long runs of same-prefixed suggestions (e.g. df['a'], df['b'], …) into accordions
  group_dropdown_items(dropdown);

  drawer_el.addEventListener("mouseout", () => { dropdown.previewing_code = undefined; });

  return dropdown;
}

// Suggestions sharing a `foo.` or `foo[` prefix clutter the drawer (a wide dataframe turns
// every column into its own row). When at least GROUP_THRESHOLD items share a prefix, tuck them
// into a collapsible accordion labeled by that prefix. This is a one-shot DOM layout pass over
// the initial items; `dropdown.items` stays flat and items re-added later (e.g. an off-list
// selected value) simply land ungrouped at the top level.
// Declared inside the function: the JS bundle is re-injected on every cell run, so a
// module-scope `const` would throw "already been declared" (see AGENTS.md).
function group_dropdown_items(dropdown: DropdownWidget) {
  const GROUP_THRESHOLD = 3;
  // The prefix up to and including a `.`, `[`, or `(`, ignoring anything after a quote (so
  // `df['a']` groups by `df[` while `df.b` groups by `df.`). When several regexes match, keep
  // the longest match.
  // const PREFIX_REGEXES = [
  //   /^[^'"\[]+\[/,
  //   /^[^'"\(]+\(/,
  //   /^[^'"\.]+\./,
  // ];
  const PREFIX_REGEX = /^[^'"\(\[]+\[|^[^'"\(\[]+\(|^[^'"\.]+\./;

  const holders_by_prefix = new Map<string, HTMLElement[]>();
  for (const item of dropdown.items) {
    const holder = item.el.parentElement; // the .plottery-dropdown-item row
    if (!holder || holder.parentElement !== dropdown.drawer_el) continue;
    const prefix = item.to_code().match(PREFIX_REGEX)?.[0];
    // // When several regexes match, keep the longest match.
    // const code = item.to_code();
    // const prefix = PREFIX_REGEXES
    //   .map(re => code.match(re)?.[0] ?? "")
    //   .sort((a, b) => b.length - a.length)[0];
    if (!prefix) continue;
    (holders_by_prefix.get(prefix) ?? holders_by_prefix.set(prefix, []).get(prefix)!).push(holder);
  }

  for (const [prefix, holders] of holders_by_prefix) {
    if (holders.length < GROUP_THRESHOLD) continue;

    const group_el = create_el("div", "plottery-dropdown-group");
    const header_el = create_el("div", "plottery-dropdown-group-header", group_el);
    const chevron_el = create_el("span", "plottery-dropdown-group-chevron", header_el);
    chevron_el.textContent = "›";
    const label_el = create_el("span", "plottery-dropdown-group-label", header_el);
    label_el.textContent = `${prefix.replace('(', '').replace('[', '')}...`;
    const count_el = create_el("span", "plottery-dropdown-group-count", header_el);
    count_el.textContent = String(holders.length);

    const items_el = create_el("div", "plottery-dropdown-group-items", group_el);

    // Put the accordion where the first item was, then move all the rows inside it.
    dropdown.drawer_el.insertBefore(group_el, holders[0]);
    holders.forEach(h => items_el.append(h));

    header_el.addEventListener("click", ev => {
      const expanded = group_el.classList.toggle("expanded");
      log_event("gui", expanded ? "dropdown group open" : "dropdown group close", { prefix });
      ev.stopPropagation();
    });
  }
}


export function add_item_to_dropdown_widget(
  dropdown: DropdownWidget,
  widget: Widget
) {
  // const item_holders: [HTMLElement, Widget][] = [];

  const item_holder = create_el(
    "div",
    "plottery-dropdown-item",
    dropdown.drawer_el
  );
  item_holder.append(widget.el);
  // Make widget el focusable
  widget.el["tabIndex"] = 0

  // The id is a thing to the right of the item, like "str", or "int"
  const id = create_el("div", "plottery-widget-id", item_holder);
  id.innerHTML = widget.kind_label_for_dropdown;

  const item_overlay_el = create_el("div", "plottery-dropdown-item-overlay", item_holder);

  item_overlay_el.addEventListener("mouseover", ev => {
    // Link items preview the linked call's live value: locally previewing that value is
    // visually identical to the shared-variable state that choosing the item would create.
    const arg_code = is_link_widget(widget) ? widget.preview_code() : widget.to_code();
    log_event("gui", "dropdown suggestion preview", { arg_code });
    dropdown.previewing_code = arg_code;
    ev.stopPropagation();
    ev.preventDefault();
  });

  item_overlay_el.addEventListener("click", ev => {
    // Close the dropdown
    dropdown.el.classList.remove("expanded");
    dropdown.el.closest(".plottery_outer")?.querySelector(".hover_regions")?.classList.remove("hide_during_interaction");
    if (is_link_widget(widget)) {
      // A link item is an action (introduce a shared variable), not a selectable value.
      // Clear the hover preview so the flushed call text doesn't pick it up over the
      // committed value (to_code prefers previewing_code).
      dropdown.previewing_code = undefined;
      log_event("gui", "dropdown link suggestion choose", { arg_code: widget.preview_code(), linked_call: widget.suggestion.call_id });
      widget.on_choose();
    } else {
      log_event("gui", "dropdown suggestion choose", { arg_code: widget.to_code() });
      select_dropdown_item(dropdown, widget);
    }
    ev.stopPropagation();
    ev.preventDefault();
  });

  dropdown.items.push(widget);
}

/**
 * Clones `new_selected_item` and puts it in the selected item holder.
 *
 * If the old item is not in the list, adds it to the dropdown.
 */
export function select_dropdown_item(
  dropdown: DropdownWidget,
  new_selected_item: Widget
) {

  // If the old selected item is not in the dropdown (e.g., it
  // was a code snippet and the user changed the code) then
  // add it to the dropdown
  const old_selected_item = dropdown.selected_item;
  if (old_selected_item) {
    const old_code = old_selected_item.to_code();
    if (!dropdown.items.some(item => item.to_code() == old_code)) {
      add_item_to_dropdown_widget(dropdown, old_selected_item);
      // Move it from the last to the first in the list
      dropdown.items.unshift(dropdown.items.pop()!);
      dropdown.drawer_el.prepend(dropdown.drawer_el.lastElementChild!);
    } else {
      // If a copy exists in the list, just remove it from the item holder
      old_selected_item.el.remove();
    }
  }

  // Change the selected item highlight
  dropdown.drawer_el.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
  new_selected_item.el.parentElement!.classList.add("selected");

  // Create a new clone
  const selected_item_clone = new_selected_item.clone();

  // Add clone to the dropdown selected area
  dropdown.selected_item_holder_el.append(selected_item_clone.el);
  dropdown.selected_item = selected_item_clone;
}
