import { State } from "../types";
import { create_el } from "../utils/misc";


export function create_menu_el(innerHTML: string, parent: HTMLElement): HTMLElement {
  const menu = create_el("div", "snp-menu", parent);
  const menu_name = create_el("div", "snp-menu-name", menu);
  menu_name.innerHTML = innerHTML;

  create_el("div", "snp-menu-items", menu);

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
  name: string,
  command: string | null, // e.g. 'D' registers the shortcut cmd-D and '⇧A' registers cmd-shift-A
  action: (state: State) => void,
  enabled_predicate: (item: HTMLElement, state: State) => boolean,
  state: State
) {
  const menu_items = menu.querySelector(".snp-menu-items")!;
  const menu_item = create_el("div", "snp-menu-item", menu_items);
  menu_item.innerText = name;
  if (command) {
    command = command.toUpperCase();
    const command_key = window.navigator.platform.match(/Mac|iPhone/) ? "⌘" : "Ctrl+";
    menu_item.innerHTML += `<kbd>${command_key}${command}</kbd>`
    state.command_shortcuts[command] = action;
  }

  menu_item.addEventListener("click", _ => action(state));

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
  menu.classList.add("open");
  const overlay = create_el("div", "snp-menu-click-to-close-overlay");
  menu.prepend(overlay);
  overlay.addEventListener("click", ev => {
    ev.stopPropagation();
    close_menu(menu);
  });
}

export function close_menu(menu: HTMLElement) {
  menu.querySelector(".snp-menu-click-to-close-overlay")?.remove();
  menu.classList.remove("open");
}

export function close_all_menus(state: State) {
  state.snp_outer.querySelector(".snp-menu-click-to-close-overlay")?.remove();
  state.snp_outer.querySelectorAll(".open").forEach(menu => {
    menu.classList.remove("open");
  });
}

function enable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.remove("disabled");
}

function disable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.add("disabled");
}
