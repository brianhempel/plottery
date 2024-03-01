import { Ticker } from "../../../utils/Ticker";
import { create_el } from "../../../utils/misc";
import { LiteralWidget } from "../literal/literal";
import {
  Widget,
  WidgetKind,
  get_widget_type_id,
  widget_to_code,
} from "../widget";
import "./dropdown.css";

export type DropdownWidget = Widget & {
  kind: WidgetKind.Dropdown;
  items: Widget[];
  selected_item: Widget;
  selected_item_clone_el: HTMLElement;
  sync_id: string;
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
 * @param items widgets in the dropdown.
 */
export function create_dropdown_widget(items: Widget[]): DropdownWidget {
  const el = create_el("div", "snp-dropdown");

  // Put the first element as selected item
  const selected_item_holder_el = create_el(
    "div",
    "snp-dropdown-selected-item",
    el
  );
  // @TODO: Handle case where 'widgets' is empty (create a placeholder?)
  const selected_item = items[0];
  selected_item_holder_el.append(selected_item.el);

  // On clicking the selected item, open up the dropdown
  selected_item_holder_el.addEventListener("click", () => {
    el.classList.toggle("expanded");
  });

  // Close the dropdown if clicked outside
  // @TODO: I should probably clean up event
  // listeners
  document.body.addEventListener("click", e => {
    if (
      e.target != null &&
      !(e.target == el) &&
      !el.contains(e.target as HTMLElement)
    ) {
      if (el.classList.contains("expanded")) {
        el.classList.remove("expanded");
      }
    }
  });

  // Drawer items
  const drawer_el = create_el("div", "snp-dropdown-drawer", el);

  // Clone the selected item or the drawer
  const selected_item_clone = get_widget_clone(selected_item);

  // Keep them synced
  const sync_id = Ticker.instance.registerTick(
    sync_clone(selected_item, selected_item_clone)
  );

  // Create a dropdown with an empty drawer
  const dropdown: DropdownWidget = {
    kind: WidgetKind.Dropdown,
    el,
    items: [],
    selected_item,
    selected_item_clone_el: selected_item_clone,
    sync_id,
    selected_item_holder_el,
    drawer_el,
  };

  // Populate the dropdown
  add_items_to_dropdown_widget(dropdown, items);

  return dropdown;
}

export function dropdown_widget_to_code(widget: DropdownWidget): string {
  return widget_to_code(widget.selected_item);
}

/**
 * Adds items in `new_items` to the dropdown.
 */
export function add_items_to_dropdown_widget(
  dropdown: DropdownWidget,
  new_items: Widget[]
) {
  const item_holders: [HTMLElement, Widget][] = [];

  // Add items to drawer
  for (const widget of new_items) {
    const item_holder = create_el(
      "div",
      "snp-dropdown-hidden-item",
      dropdown.drawer_el
    );
    item_holders.push([item_holder, widget]);

    // Add in a clone of selected item
    if (widget == dropdown.selected_item) {
      item_holder.append(dropdown.selected_item_clone_el);
      item_holder.classList.add("selected");
    } else {
      item_holder.append(widget.el);
    }

    // The id is a thing to the right of the item, like "str", or "int"
    const id = create_el("div", "snp-widget-id", item_holder);
    id.innerHTML = get_widget_type_id(widget);
  }

  // Setup event listeners to select items in the drawer
  for (const [item_holder, widget] of item_holders) {
    item_holder.addEventListener("click", () => {
      // Close the dropdown
      dropdown.el.classList.remove("expanded");

      // Select the item in the holder
      // @TODO: This is very sketch because select_dropdown_item rebuilds
      // the dropdown so this event listener does not exist after...?
      select_dropdown_item(dropdown, widget);
    });
  }

  dropdown.items.push(...new_items);

  // Make all widget els focusable
  dropdown.items.forEach(widget => (widget.el["tabIndex"] = 0));
}

/**
 * Makes `new_selected_item` the active dropdown selection.
 */
export function select_dropdown_item(
  dropdown: DropdownWidget,
  new_selected_item: Widget
) {
  if (dropdown.selected_item == new_selected_item) return;

  // Clear out the selected item holder
  dropdown.selected_item.el.remove();

  // Add the old selected item in place of its clone
  dropdown.selected_item_clone_el.insertAdjacentElement(
    "afterend",
    dropdown.selected_item.el
  );

  // Remove the old clone
  dropdown.selected_item_clone_el.remove();

  // Remove the selected highlight from the holder
  dropdown.selected_item.el.parentElement!.classList.remove("selected");

  // Remove the old sync
  Ticker.instance.removeTickFrom(dropdown.sync_id);

  // Create a new clone
  const selected_item_clone = get_widget_clone(new_selected_item);
  dropdown.selected_item_clone_el = selected_item_clone;

  // Update the sync
  dropdown.sync_id = Ticker.instance.registerTick(
    sync_clone(new_selected_item, selected_item_clone)
  );

  // Add the clone in the same holder as the item
  new_selected_item.el.insertAdjacentElement("afterend", selected_item_clone);

  // Add the selected highlight to the holder
  new_selected_item.el.parentElement!.classList.add("selected");

  // Add the new selected item to the top
  dropdown.selected_item_holder_el.append(new_selected_item.el);
  dropdown.selected_item = new_selected_item;
}

export function get_widget_clone(widget: Widget): HTMLElement {
  if (
    widget.kind == WidgetKind.Literal &&
    (widget as LiteralWidget).type == "builtins.float"
  ) {
    const clone = widget.el.cloneNode(true) as HTMLElement;
    return clone.querySelector(".snp-slider-val")!;
  }

  return widget.el.cloneNode(true) as HTMLElement;
}

function sync_clone(widget: Widget, clone: HTMLElement) {
  if (
    widget.kind == WidgetKind.Literal &&
    (widget as LiteralWidget).type == "builtins.float"
  ) {
    return () => {
      if (
        (widget as LiteralWidget).slider?.val_el.innerHTML != clone.innerHTML
      ) {
        clone.innerHTML = (widget as LiteralWidget).slider!.val_el.innerHTML;
      }
    };
  }

  return () => {
    if (widget.el.innerHTML != clone.innerHTML) {
      clone.innerHTML = widget.el.innerHTML;
    }
  };
}
