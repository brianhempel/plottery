import { P_stmt } from "../ast_types";
import { create_call_view } from "../sidebar/call/call";
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

export function layer_from_typed_node(typed_node: any, state: State)
  : Layer {
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

  return {
    el: layer_el,
    calls_with_args: calls_at_loc,
    call_views,
  };
}

export function create_layers_panel(layers: Layer[]): LayersPanel {
  const layers_el = create_el("div", "snp-layers");

  layers.forEach(layer => layers_el.append(layer.el));

  return {
    el: layers_el,
    layers
  };
}

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

