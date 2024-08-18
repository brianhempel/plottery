import { State } from "../types";
import { create_el } from "../utils/misc";

// classes will be added both to the menu and the items holder, since the items
// holder is moved to the body when the menu is opened
export function create_menu_el(innerHTML: string, classes: string | string[], parent: HTMLElement | undefined): HTMLElement {
  if (!Array.isArray(classes)) {
    classes = [classes];
  }

  const menu = create_el("div", ["snp-menu", ...classes], parent);
  const menu_name = create_el("div", "snp-menu-name", menu);
  menu_name.innerHTML = innerHTML;

  const menu_id = menu_name + Math.random().toString() + Math.random().toString()
  const menu_items = create_el("div", ["snp-menu-items", ...classes], menu);

  // When we move the menu items to a child of the body, need to correlate back
  menu.dataset.menu_id = menu_id
  menu_items.dataset.menu_id = menu_id

  menu.addEventListener("click", _ => {
    if (menu.classList.contains("open")) { // This catches clicks from clicking menu items while the menu is open
      close_menu(menu);
    } else {
      open_menu(menu);
    }
  });

  return menu;
}

// enabled_predicate is a function that takes the menu item and state and returns whether it should be enabled
export function add_menu_item(
  menu: HTMLElement,
  innerHTML: string,
  command: string | null, // e.g. 'D' registers the shortcut cmd-D and '⇧A' registers cmd-shift-A
  action: (state: State) => void,
  enabled_predicate: (item: HTMLElement, state: State) => boolean,
  state: State
) {
  const menu_items = menu.querySelector(".snp-menu-items")!;
  const menu_item = create_el("div", "snp-menu-item", menu_items);
  menu_item.innerHTML = innerHTML;
  if (command) {
    command = command.toUpperCase();
    const command_key = window.navigator.platform.match(/Mac|iPhone/) ? "⌘" : "Ctrl+";
    menu_item.innerHTML += `<kbd>${command_key}${command}</kbd>`
    state.command_shortcuts[command] = state => { close_menu(menu); action(state) };
  }

  menu_item.addEventListener("click", _ => {
    close_menu(menu);
    action(state);
  });

  menu.addEventListener("click", _ => {
    enabled_predicate(menu_item, state) ? enable_menu_item(menu_item) : disable_menu_item(menu_item);
  })

  return menu_item;
}


export function add_submenu(
  menu: HTMLElement,
  name: string,
  enabled_predicate: (item: HTMLElement, state: State) => boolean,
  state: State
) {
  const menu_items = menu.querySelector(".snp-menu-items")!;
  const menu_item = create_el("div", ["snp-menu-item", "snp-submenu"], menu_items);

  menu.addEventListener("click", _ => {
    enabled_predicate(menu_item, state) ? enable_menu_item(menu_item) : disable_menu_item(menu_item);
  })

  menu_item.innerText = name;
  create_el("div", "snp-menu-items", menu_item);

  return menu_item;
}

export function open_menu(menu: HTMLElement) {
  const rect = menu.getBoundingClientRect();
  menu.classList.add("open");
  const overlay = create_el("div", "snp-menu-click-to-close-overlay");
  overlay.dataset.menu_id = menu.dataset.menu_id
  document.body.append(overlay);
  // menu.prepend(overlay);
  overlay.addEventListener("click", ev => {
    ev.stopPropagation();
    close_menu(menu);
  });
  const items_el = menu.querySelector(".snp-menu-items")! as HTMLElement;
  items_el.remove();
  document.body.append(items_el);
  items_el.style.position = "absolute";
  items_el.style.top = `${rect.bottom}px`;
  items_el.style.left = `${rect.left}px`;
}

export function close_menu(menu: HTMLElement) {
  // menu.querySelector(".snp-menu-click-to-close-overlay")?.remove();
  menu.classList.remove("open");
  // const items_el = document.body.querySelector(".snp-menu-items")! as HTMLElement;

  document.querySelectorAll('body > .snp-menu-click-to-close-overlay').forEach(overlay_el => {
    if ((overlay_el as HTMLElement).dataset.menu_id === menu.dataset.menu_id) {
      overlay_el.remove();
    }
  })
  document.querySelectorAll('body > .snp-menu-items').forEach(items_el => {
    if ((items_el as HTMLElement).dataset.menu_id === menu.dataset.menu_id) {
      items_el.remove();
      menu.append(items_el);
    }
  })
}

export function close_all_menus(state: State) {
  ([...state.snp_outer.querySelectorAll(".open")] as HTMLElement[]).forEach(close_menu);
}

function enable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.remove("disabled");
}

function disable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.add("disabled");
}
