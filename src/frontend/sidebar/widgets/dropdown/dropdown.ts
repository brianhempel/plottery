import { create_el } from "../../../utils/misc";
import { Widget } from "../widget";
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
  const el = create_el("div", "snp-dropdown");

  // Put the first element as selected item
  const selected_item_holder_el = create_el(
    "div",
    "snp-dropdown-selected-item",
    el
  );

  // On clicking the selected item, open up the dropdown
  selected_item_holder_el.addEventListener("click", () => {
    el.classList.toggle("expanded");
  });

  document.body.addEventListener("click", e => {
    if (
      e.target != null &&
      !(e.target == el) &&
      !el.contains(e.target as HTMLElement)
    ) {
      el.classList.remove("expanded");
    }
  });

  // Drawer items
  const drawer_el = create_el("div", "snp-dropdown-drawer", el);


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

  drawer_el.addEventListener("mouseout", () => { dropdown.previewing_code = undefined; });

  return dropdown;
}


function add_item_to_dropdown_widget(
  dropdown: DropdownWidget,
  widget: Widget
) {
  // const item_holders: [HTMLElement, Widget][] = [];

  const item_holder = create_el(
    "div",
    "snp-dropdown-item",
    dropdown.drawer_el
  );
  item_holder.append(widget.el);
  // Make widget el focusable
  widget.el["tabIndex"] = 0

  // The id is a thing to the right of the item, like "str", or "int"
  const id = create_el("div", "snp-widget-id", item_holder);
  id.innerHTML = widget.kind_label_for_dropdown;

  item_holder.addEventListener("mouseover", () => {
    dropdown.previewing_code = widget.to_code();
  });

  item_holder.addEventListener("click", () => {
    // Close the dropdown
    dropdown.el.classList.remove("expanded");
    select_dropdown_item(dropdown, widget);
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
