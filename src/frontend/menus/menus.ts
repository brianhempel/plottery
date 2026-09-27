import { State } from "../types";
import { debounce, log_event, rate_limit } from "../utils/instrumentation";
import { create_el, create_search_icon } from "../utils/misc";
import "./menus.css";

// classes will be added both to the menu and the items holder, since the items
// holder is moved to the body when the menu is opened
export function create_menu_el(innerHTML: string, classes: string | string[], parent: HTMLElement | undefined): HTMLElement {
  if (!Array.isArray(classes)) {
    classes = [classes];
  }

  const menu = create_el("div", ["plottery-menu", ...classes], parent);
  const menu_name = create_el("div", "plottery-menu-name", menu);
  menu_name.innerHTML = innerHTML;

  const menu_id = menu_name.innerText + Math.random().toString() + Math.random().toString()

  const menu_panel = create_el("div", ["plottery-menu-panel", ...classes], menu);

  create_el("div", ["plottery-menu-items", ...classes], menu_panel);

  // When we move the menu items to a child of the body, need to correlate back
  menu.dataset.menu_id = menu_id
  menu_panel.dataset.menu_id = menu_id

  menu.addEventListener("click", _ => {
    if (menu.classList.contains("open")) { // This catches clicks from clicking menu items while the menu is open
      close_menu(menu);
    } else {
      open_menu(menu);
    }
  });

  return menu;
}

export function add_search(menu: HTMLElement) {
  const menu_panel = menu.querySelector(".plottery-menu-panel")!;

  // Create a container for the search input and the icon
  const search_container = create_el("div", "plottery-search-container");

  const search = create_el("input", "plottery-menu-search", search_container) as HTMLInputElement;
  search.placeholder = "Search";

  // Add SVG magnifying glass icon
  const icon = create_search_icon();
  icon.classList.add("plottery-search-icon");
  search_container.appendChild(icon);

  // Don't trigger notebook actions from typing in the search
  menu_panel.addEventListener("keydown", ev => ev.stopPropagation());

  search.addEventListener("input", ev => {
    debounce('search menu', 333, () => log_event('gui', 'search menu', {query: search.value}));
    const query_words = search.value.toLowerCase().split(/\s+/);
    for(const item of menu_panel.querySelector(".plottery-menu-items")!.children) {
      const text = item.textContent!.toLowerCase();
      item.classList.remove("active");
      if (query_words.every(word => text.includes(word))) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    }
  });

  search.addEventListener("keydown", ev => {
    const items = [...menu_panel.querySelector(".plottery-menu-items")!.children].filter(item => !item.classList.contains("hidden")) as HTMLElement[];

    if (ev.code === "Escape") {
      if (search.value === "") {
        close_menu(menu);
      } else {
        search.value = "";
        search.dispatchEvent(new Event("input"));
      }
    } else if (ev.code === "ArrowDown" || ev.code === "ArrowUp") {
      const direction = ev.code === "ArrowDown" ? 1 : -1;
      let active_item: HTMLElement | undefined;
      for (let i = 0; i < items.length; i++) {
        if (items[i].classList.contains("active")) {
          items[i].classList.remove("active");
          active_item = items[(i + direction + items.length) % items.length];
          break;
        } else {
          items[i].classList.remove("active");
        }
      }
      if (!active_item && items.length > 0) {
        active_item = items[0]
      }
      if (active_item) {
        active_item.classList.add("active");
        active_item.scrollIntoView({block: "nearest"});
      }
      ev.stopPropagation();
      ev.preventDefault();
    } else if (ev.code === "Enter") {
      for (let i = 0; i < items.length; i++) {
        if (items[i].classList.contains("active")) {
          items[i].click();
          break;
        }
      }
    }
  });

  menu_panel.prepend(search_container);
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
  const menu_items = menu.querySelector(".plottery-menu-items")!;
  const menu_item = create_el("div", "plottery-menu-item", menu_items);
  menu_item.innerHTML = innerHTML;

  function do_action(state: State) {
    const menu_name: string = menu.querySelector(".plottery-menu-name")?.textContent || '';
    const menu_item_name: string = menu_item.innerText;
    close_menu(menu);
    action(state);
    log_event('gui', 'invoke menu item', {menu: menu_name, menu_item: menu_item_name, code: state.cell.code_mirror.getValue()});
  }

  if (command) {
    command = command.toUpperCase();
    const command_key = window.navigator.platform.match(/Mac|iPhone/) ? "⌘" : "Ctrl+";
    menu_item.innerHTML += `<kbd>${command_key}${command}</kbd>`
    state.command_shortcuts[command] = do_action;
  }

  menu_item.addEventListener("click", _ => do_action(state));

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
  const menu_items = menu.querySelector(".plottery-menu-items")!;
  const menu_item = create_el("div", ["plottery-menu-item", "plottery-submenu"], menu_items);

  menu.addEventListener("click", _ => {
    enabled_predicate(menu_item, state) ? enable_menu_item(menu_item) : disable_menu_item(menu_item);
  })

  menu_item.innerText = name;
  create_el("div", "plottery-menu-items", menu_item);

  return menu_item;
}

export function open_menu(menu: HTMLElement) {
  const menu_name: string = menu.querySelector(".plottery-menu-name")?.textContent || '';
  log_event('gui', 'open menu', {menu: menu_name});

  const rect = menu.getBoundingClientRect();
  menu.classList.add("open");
  const overlay = create_el("div", "plottery-menu-click-to-close-overlay");
  overlay.dataset.menu_id = menu.dataset.menu_id
  document.body.append(overlay);
  // menu.prepend(overlay);
  overlay.addEventListener("click", ev => {
    ev.stopPropagation();
    close_menu(menu);
  });
  const panel_el = menu.querySelector(".plottery-menu-panel")! as HTMLElement;
  panel_el.remove();
  document.body.append(panel_el);
  panel_el.style.position = "absolute";
  panel_el.style.top = `${rect.bottom}px`;
  panel_el.style.left = `${rect.left}px`;

  (panel_el.querySelector('.plottery-menu-search') as HTMLInputElement)?.focus();
}

export function close_menu(menu: HTMLElement) {
  const menu_name: string = menu.querySelector(".plottery-menu-name")?.textContent || '';
  log_event('gui', 'close menu', {menu: menu_name});

  // menu.querySelector(".plottery-menu-click-to-close-overlay")?.remove();
  menu.classList.remove("open");
  // const panel_el = document.body.querySelector(".plottery-menu-panel")! as HTMLElement;

  document.querySelectorAll('body > .plottery-menu-click-to-close-overlay').forEach(overlay_el => {
    if ((overlay_el as HTMLElement).dataset.menu_id === menu.dataset.menu_id) {
      overlay_el.remove();
    }
  })
  document.querySelectorAll('body > .plottery-menu-panel').forEach(panel_el => {
    if ((panel_el as HTMLElement).dataset.menu_id === menu.dataset.menu_id) {
      panel_el.remove();
      menu.append(panel_el);
    }

    panel_el.querySelectorAll('.plottery-menu-item.active').forEach(menu_item => {
      menu_item.classList.remove('active');
    });
  })
}

export function close_all_menus(state: State) {
  ([...state.plottery_outer.querySelectorAll(".open")] as HTMLElement[]).forEach(close_menu);
}

function enable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.remove("disabled");
}

function disable_menu_item(menu_item: HTMLElement) {
  menu_item.classList.add("disabled");
}
