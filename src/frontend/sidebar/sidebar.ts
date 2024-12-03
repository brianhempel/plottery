import { deselect_all_layers, duplicate_selected_layers, selected_layers } from "../layer_panel/layer_panel";
import { State } from "../types";
import { create_el, set_persistent_item, snp_logo_svg_html } from "../utils/misc";
import { add_menu_item, create_menu_el } from "../menus/menus";
import { hard_rerun } from "../code_sync/code_sync";
import { log_event } from "../utils/instrumentation";


export function set_margin_right_to_width(el: HTMLElement, margin_right: number, dx: number) {
  const resizeObserver = new ResizeObserver((entries) => {
    // console.log("resizeObserver", entries);
    for (const entry of entries) {
      if (entry.borderBoxSize) {
        const width = (entry.borderBoxSize[0] || entry.borderBoxSize).inlineSize;
        el.style.marginLeft = `${-width-margin_right+dx}px`;
        el.style.marginRight = `${margin_right}px`;
      }
    }
  });
  resizeObserver.observe(el);
}


export function create_sidebar_menu_bar(state: State, fig_idx: number, fig_names: string[]) {
  const sidebar_menu_bar = create_el("div", "snp-sidebar-menu-bar");

  // Add Logo
  sidebar_menu_bar.innerHTML = snp_logo_svg_html().replace('<svg ', '<svg class="sketch-n-plot-logo" style="margin-bottom:-5px" ')

  // Add Edit menu
  const edit_menu = create_menu_el("<strong>Edit</strong>", [], sidebar_menu_bar)

  add_menu_item(
    edit_menu,
    'Duplicate', 'D',
    duplicate_selected_layers,
    (_item: HTMLElement, state: State) => selected_layers(state).length > 0, // Enabled?
    state
  )

  add_menu_item(
    edit_menu,
    'Deselect All', '⇧A',
    deselect_all_layers,
    (_item: HTMLElement, state: State) => selected_layers(state).length > 0, // Enabled?
    state
  )

  add_menu_item(
    edit_menu,
    'Save PNG Image', '⇧S',
    (state: State) => {
      const link = document.createElement('a');
      const img_name = (fig_names[fig_idx] || '').length > 0 ? fig_names[fig_idx].replace(/[^A-Za-z0-9\-]+/g, '_') : 'my_plot';
      link.download = img_name + '.png';
      link.href = state.plot_area.querySelector('img')!.src; //canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      link.click();
      link.remove();
    },
    (_item: HTMLElement, _state: State) => true, // Enabled?
    state
  )

  if (fig_names.length > 1) {
    // Add fig selector
    const fig_selector = create_el("select", "snp-fig-selector", sidebar_menu_bar) as HTMLSelectElement;

    fig_names.forEach((name, i) => {
      const option = create_el("option", [], fig_selector) as HTMLOptionElement;
      option.innerText = `Fig ${i+1} ${name}`;
      option.value = i.toString();
    })
    fig_selector.value = fig_idx.toString();

    // On fig change, set persitent_dataset.fig_idx and rerun
    fig_selector.addEventListener("change", () => {
      log_event('gui', 'change figure', {fig_idx: fig_selector.value});
      set_persistent_item(state, 'fig_idx', fig_selector.value);
      hard_rerun(state);
    })
  }

  return sidebar_menu_bar;
}
