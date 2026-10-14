import { CallView, State } from "../types";
import "./properties_panel.css";
import { create_el, create_search_icon, get_persistent_item, set_persistent_item } from "../utils/misc";
import { debounce, log_event } from "../utils/instrumentation";

export function set_properties_panel_on({ els: { name_el, properties_el: args_el }}: CallView, state: State): void {
  const properties_el = state.properties_el;

  clear_properties_panel(state);
  properties_el.classList.remove('hidden');

  args_el.remove();
  properties_el.append(args_el);
  (properties_el.querySelector('.plottery-properties-panel-header')! as HTMLElement).innerText = `${name_el.innerText} Properties`;
  filter_properties(state);
}

function clear_properties_panel(state: State) {
  state.layers_panel.layers.forEach(layer => {
    layer.call_views.forEach(({ els: { el: view_el, properties_el: args_el }}) => {
      if (args_el.parentElement === state.properties_el) {
        args_el.remove();
        view_el.append(args_el);
        args_el.querySelectorAll(':scope > .plottery-arg-view.hidden').forEach(arg_el => arg_el.classList.remove('hidden'));
      }
    });
  });
  state.properties_el.classList.add('hidden');
}

// Search box under the panel header that filters the shown args by name (simple containment).
// The query is kept across cell reruns, which rebuild the panel.
export function create_properties_search(state: State) {
  const search_container = create_el("div", ["plottery-search-container", "plottery-properties-search-container"], state.properties_el);

  const search = create_el("input", "plottery-properties-search", search_container) as HTMLInputElement;
  search.placeholder = "Search";
  search.value = get_persistent_item(state, "properties_search") || "";

  const icon = create_search_icon();
  icon.classList.add("plottery-search-icon");
  search_container.appendChild(icon);

  const clear_button = create_el("div", "plottery-properties-search-clear", search_container);
  clear_button.innerText = "×";
  clear_button.title = "Clear search";
  clear_button.classList.toggle("hidden", search.value === "");

  const clear = () => {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  };
  clear_button.addEventListener("mousedown", ev => ev.preventDefault()); // keep focus in the search box
  clear_button.addEventListener("click", clear);

  // Don't trigger notebook actions from typing in the search
  search.addEventListener("keydown", ev => {
    ev.stopPropagation();
    if (ev.code === "Escape") { clear(); }
  });

  search.addEventListener("input", () => {
    debounce('search properties', 333, () => log_event('gui', 'search properties', {query: search.value}));
    set_persistent_item(state, "properties_search", search.value);
    clear_button.classList.toggle("hidden", search.value === "");
    filter_properties(state);
  });
}

function filter_properties(state: State) {
  const search = state.properties_el.querySelector('.plottery-properties-search') as HTMLInputElement | null;
  const query = (search?.value || "").trim().toLowerCase();
  state.properties_el.querySelectorAll(':scope > .plottery-args > .plottery-arg-view').forEach(arg_el => {
    const name = arg_el.querySelector(':scope > .plottery-arg-name')?.textContent?.toLowerCase() || "";
    arg_el.classList.toggle('hidden', !name.includes(query));
  });
}
