import { P_stmt } from "../ast_types";
import { hard_rerun } from "../code_sync/code_sync";
import { call_to_code, create_call_view } from "../sidebar/call/call";
import { open_collapsable } from "../sidebar/collapsable/collapsable";
import { compute_selected_hover_regions } from "../sidebar/hover-regions/hover_regions";
import { CallView, CallWithArgs, DynamicCallInfo, State, StaticCallTypeInfo } from "../types";
import { equalByJSON } from "../utils/array";
import { create_el } from "../utils/misc";


export type Layer = {
  parents: Layer[];
  el: HTMLElement;
  calls_with_args: CallWithArgs<DynamicCallInfo>[];
  call_views: CallView[];
}

export type LayersPanel = {
  el: HTMLElement;
  layers: Layer[];
};

export function layers_from_typed_node(typed_node: any, state: State): Layer[] {
  const layer_el = create_el("div", "snp-layer");

  // console.log('layer typed node:', typed_node)

  const calls_with_args = state.calls_with_args;
  const calls_at_loc = calls_with_args.filter(call => call.call_info.call.pos.line === typed_node.line);

  const call_views: CallView[] =
    calls_at_loc.map(calls_with_args => create_call_view(calls_with_args, state));

  // console.log('layer call_views:', call_views)

  const layer = {
    parents: [],
    el: layer_el,
    calls_with_args: calls_at_loc,
    call_views,
  }

  const sublayers: Layer[] = [];

  if (call_views.length > 0) {
    layer_el.append(...call_views.map(call_view => call_view.els.el));
  } else if (typed_node['.class'] === 'mypy.nodes.ForStmt') {
    layer_el.append(
      "for ",
      typed_node.index.unparsed.trim(),
      " in ",
      typed_node.expr.unparsed.trim(),
      ":"
    )
    sublayers.push(...typed_node.body.body.flatMap(node => layers_from_typed_node(node, state)));
    sublayers.forEach(sublayer => sublayer.parents.push(layer));
    sublayers.forEach(sublayer => sublayer.el.prepend(create_el("div", "snp-indent")));
  } else {
    layer_el.innerText = typed_node.unparsed;
    layer_el.classList.add("snp-code-layer");
  }

  layer_el.addEventListener("click", ev => {
    if (ev.target == layer_el) {
      select_layer(layer, state);
    }
  });

  return [layer, ...sublayers];
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
  const layers_panel_heading = create_el("h2", [], layers_el);
  layers_panel_heading.innerText = "Layers";

  layers.forEach(layer => layers_el.append(layer.el));

  return {
    el: layers_el,
    layers
  };
}

function deselect_layer(layer: Layer, state: State) {
  layer.el.classList.remove("selected");
  compute_selected_hover_regions(state);
  save_selected_layers(state);
}

export function deselect_all_layers(state: State) {
  state.layers_panel.layers.forEach(layer => deselect_layer(layer, state));
}

export function select_layer(layer: Layer, state: State) {
  deselect_all_layers(state);
  // console.log(layer.el)
  layer.el.classList.add("selected");
  open_collapsable(layer.el.querySelector('.snp-collapsable')!);
  compute_selected_hover_regions(state);
  save_selected_layers(state);
  // console.log(layer.el)
}

export function duplicate_selected_layers(state: State) {
  const cm = state.cell.code_mirror;
  const old_code = cm.getValue();
  selected_layers(state).forEach((layer : Layer) => {
    // Duplicate layer
    layer.call_views.forEach(call_view => {
      const insert_line = 1 + (call_view.mark.find()?.to.line || cm.getCursor().line);

      cm.replaceRange(call_to_code(call_view) + '\n', {line: insert_line, ch: 0})
    });
  });
  if(cm.getValue() !== old_code) {
    hard_rerun(state);
  }
}

// For regeneration after cell rerun
function save_selected_layers(state: State) {
  const selected_calls = state.layers_panel.layers.filter(is_layer_selected).flatMap(layer => layer.calls_with_args).map(call_with_args => call_with_args.call_info.loc_via_func_code_and_num);

  // console.log(selected_calls)

  state.persistent_dataset.selected_calls = JSON.stringify(selected_calls);

  // const selected_layers = state.layers_panel.layers.filter(is_layer_selected);
  // const selected_calls = selected_layers.map(layer => layer.calls_with_args);
  // console.log(selected_calls);

}

// For regeneration after cell rerun
export function load_selected_layers(state: State) {
  const selected_calls = JSON.parse(state.persistent_dataset.selected_calls || '[]') as [number, string][];

  deselect_all_layers(state);

  state.layers_panel.layers.forEach(layer => {
    if (layer.calls_with_args.some(call_with_args => selected_calls.some(selected_call => equalByJSON(selected_call, call_with_args.call_info.loc_via_func_code_and_num)))) {
      select_layer(layer, state);
    }
  });
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

