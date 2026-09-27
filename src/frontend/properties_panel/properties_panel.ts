import { CallView, State } from "../types";
import "./properties_panel.css";
// import { create_el } from "../utils/misc";

export function set_properties_panel_on({ els: { name_el, properties_el: args_el }}: CallView, state: State): void {
  const properties_el = state.properties_el;

  clear_properties_panel(state);
  properties_el.classList.remove('hidden');

  args_el.remove();
  properties_el.append(args_el);
  (properties_el.querySelector('.plottery-properties-panel-header')! as HTMLElement).innerText = `${name_el.innerText} Properties`;
}

function clear_properties_panel(state: State) {
  state.layers_panel.layers.forEach(layer => {
    layer.call_views.forEach(({ els: { el: view_el, properties_el: args_el }}) => {
      if (args_el.parentElement === state.properties_el) {
        args_el.remove();
        view_el.append(args_el);
      }
    });
  });
  state.properties_el.classList.add('hidden');
}