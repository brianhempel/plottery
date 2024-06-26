import { create_el } from "../../../utils/misc";
import { LiteralWidget } from "../literal/literal";
import {
  Widget,
  WidgetKind,
  change_widget_code,
  clone_widget,
  get_widget_type_id,
  widget_to_code,
} from "../widget";
import "./dropdown.css";

export type DropdownWidget = Widget & {
  kind: WidgetKind.Dropdown;
  items: Widget[];
  selected_item: Widget | undefined;
  selected_item_holder_el: HTMLElement;
  drawer_el: HTMLElement;
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
    kind: WidgetKind.Dropdown,
    el,
    items: [],
    selected_item: undefined,
    selected_item_holder_el,
    drawer_el,
  };

  // Populate the dropdown
  items.forEach(item => add_item_to_dropdown_widget(dropdown, item));

  // Select the first item
  select_dropdown_item(dropdown, items[0]);

  return dropdown;
}

export function dropdown_widget_to_code(widget: DropdownWidget): string {
  return widget.selected_item ? widget_to_code(widget.selected_item) : "";
}

export function change_dropdown_widget_code(widget: DropdownWidget, new_code: string) {
  if (!widget.selected_item) throw new Error("change_dropdown_widget_code: No selected item in dropdown!");
  change_widget_code(widget.selected_item, new_code);
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
  id.innerHTML = get_widget_type_id(widget);

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
    const old_code = widget_to_code(old_selected_item);
    if (!dropdown.items.some(item => widget_to_code(item) == old_code)) {
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
  const selected_item_clone = clone_widget(new_selected_item);

  // Add clone to the dropdown selected area
  dropdown.selected_item_holder_el.append(selected_item_clone.el);
  dropdown.selected_item = selected_item_clone;
}
