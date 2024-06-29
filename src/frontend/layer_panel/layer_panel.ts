import { P_stmt } from "../ast_types";
import { create_call_view } from "../sidebar/call/call";
import { compute_selected_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { CallView, CallWithArgs, DynamicCallInfo, State, StaticCallTypeInfo } from "../types";
import { create_el } from "../utils/misc";


export type Layer = {
  el: HTMLElement;
  calls_with_args: CallWithArgs<DynamicCallInfo>[];
  call_views: CallView[];
}

export type LayersPanel = {
  el: HTMLElement;
  layers: Layer[];
};

export function layer_from_typed_node(typed_node: any, state: State): Layer {
  const layer_el = create_el("div", "snp-layer");

  // console.log('layer typed node:', typed_node)

  const calls_with_args = state.calls_with_args;
  const calls_at_loc = calls_with_args.filter(call => call.call_info.call.pos.line === typed_node.line);

  const call_views: CallView[] =
    calls_at_loc.map(calls_with_args => create_call_view(calls_with_args, state));

  // console.log('layer call_views:', call_views)

  if (call_views.length > 0) {
    layer_el.append(...call_views.map(call_view => call_view.els.el));
  } else {
    layer_el.innerText = typed_node.unparsed;
  }

  const layer = {
    el: layer_el,
    calls_with_args: calls_at_loc,
    call_views,
  }

  layer_el.addEventListener("click", ev => {
    if (ev.target == layer_el) {
      select_layer(layer, state);
    }
  });

  return layer;
}

export function is_layer_selected(layer: Layer): boolean {
  return layer.el.classList.contains("selected");
}

// Should only be 0 or 1 right now
export function selected_layers(state: State): Layer[] {
  return state.layers_panel.layers.filter(is_layer_selected);
}

export function create_layers_panel(layers: Layer[]): LayersPanel {
  const layers_el = create_el("div", "snp-layer-panel");

  layers.forEach(layer => layers_el.append(layer.el));

  return {
    el: layers_el,
    layers
  };
}

function deselect_layer(layer: Layer, state: State) {
  layer.el.classList.remove("selected");
  compute_selected_hover_regions(state);
}

export function deselect_all_layers(state: State) {
  state.layers_panel.layers.forEach(layer => deselect_layer(layer, state));
}

export function select_layer(layer: Layer, state: State) {
  deselect_all_layers(state);
  layer.el.classList.add("selected");
  compute_selected_hover_regions(state);
}

// function selected_layers(state: State): Layer[] {
//   return state.layers_panel.layers.filter(is_layer_selected);
// }

// export function selected_call_locs(state: State) : [number, string][] {

// }



// export function toggle_select_layer(layer: Layer, layers_panel: LayersPanel) {
//   is_layer_selected(layer) ? deselect_layer(layer) : select_layer(layer, layers_panel);
// }


// export function layer_from_ast_node(calls: CallWithArgs<StaticCallTypeInfo>[], stmt: P_stmt, state: State) : HTMLElement {
//   const layer_el = create_el("div", "snp-layer");

//   // Find that call that matches stmt




//   // Loop through and build the call views for this artist
//   // const call_views: CallView[] = [];

//   // calls.forEach(call => {
//   //   const call_view = create_call_view(call, state);
//   //   call_views.push(call_view);

//   //   // Add it
//   //   body_el.append(call_view.els.el);
//   // });


//   return layer_el;
// }


// export function create_layers_panel(

//   ): LayersPanel {

//   const layers_el = create_el("div", "snp-layers");

//   // const sidebar_view: LayersPanel = {
//   //   el:         sidebar_el,
//   //   artists_el: create_el("div", "snp-artists", sidebar_el),
//   //   // artists: {},
//   // };

//   // selectable_artists.forEach(artist => {
//   //   const artist_view = create_artist_view(
//   //     artist,
//   //     sidebar_view,
//   //     all_calls_and_methods[artist.id],
//   //     state
//   //   );

//   //   sidebar_view.artists[artist.id] = artist_view;
//   // });

//   return layers_el;
// }

