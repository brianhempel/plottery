import { P_stmt } from "../ast_types";
import { create_call_view } from "../sidebar/call/call";
import { CallView, CallWithArgs, State, StaticCallTypeInfo } from "../types";
import { create_el } from "../utils/misc";


export function layer_from_ast_node(calls: CallWithArgs<StaticCallTypeInfo>[], stmt: P_stmt, state: State) : HTMLElement {
  const layer_el = create_el("div", "snp-layer");

  // Find that call that matches stmt




  // Loop through and build the call views for this artist
  // const call_views: CallView[] = [];

  // calls.forEach(call => {
  //   const call_view = create_call_view(call, state);
  //   call_views.push(call_view);

  //   // Add it
  //   body_el.append(call_view.els.el);
  // });


  return layer_el;
}


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

