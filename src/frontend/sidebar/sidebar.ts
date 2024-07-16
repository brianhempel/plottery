import { deselect_all_layers, duplicate_selected_layers, selected_layers } from "../layer_panel/layer_panel";
import { State } from "../types";
import { create_el } from "../utils/misc";
import { add_menu_item, create_menu_el } from "../menus/menus";


export function create_sidebar_menu_bar(state: State) {
  const sidebar_menu_bar = create_el("div", "snp-sidebar-menu-bar");

  const edit_menu = create_menu_el("<strong>Edit</strong>", sidebar_menu_bar)

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

  return sidebar_menu_bar;
}

// import {
//   // ArtistView,
//   DynamicCallInfo,
//   CallView,
//   CallWithArgs,
//   MethodInfo,
//   MethodView,
//   MethodWithArgs,
//   PersistantArtist,
//   PersistantCall,
//   SelectableArtist,
//   // SidebarView,
//   State,
//   StaticCallTypeInfo,
// } from "../types";
// import { MarkerRange, TextMarker } from "../utils/codemirror";
// import {
//   create_el,
//   find_call_that_satisfies,
//   get_shortest_qualified_name,
// } from "../utils/misc";
// import { CellMessage } from "../utils/types";
// import {
//   is_collapsable_collapsed,
//   open_collapsable,
// } from "./collapsable/collapsable";
// import "./sidebar.css";




// export function create_sidebar(
//   all_calls_and_methods: {
//     [key: string]: {
//       calls: CallWithArgs<DynamicCallInfo | StaticCallTypeInfo>[];
//       methods: MethodWithArgs[];
//     };
//   },
//   selectable_artists: SelectableArtist[],
//   state: State
// ): SidebarView {

//   const sidebar_el = create_el("div", "snp-sidebar");

//   const sidebar_view: SidebarView = {
//     el:         sidebar_el,
//     artists_el: create_el("div", "snp-artists", sidebar_el),
//     artists: {},
//   };

//   selectable_artists.forEach(artist => {
//     const artist_view = create_artist_view(
//       artist,
//       sidebar_view,
//       all_calls_and_methods[artist.id],
//       state
//     );

//     sidebar_view.artists[artist.id] = artist_view;
//   });

//   return sidebar_view;
// }


// export function find_artist_from_method(
//   target_method_info: MethodInfo,
//   state: State
// ): { info: SelectableArtist; view: ArtistView } | null {
//   for (const artist_info of state.selectable_artists) {
//     const artist_view = state.sidebar!.artists[artist_info.id];

//     // Each method
//     const methods = state.calls_and_methods_by_artist![artist_info.id].methods;
//     const includes = methods
//       .map(m => m.method_info)
//       .includes(target_method_info);

//     if (includes) {
//       return { info: artist_info, view: artist_view };
//     }
//   }

//   return null;
// }

// export function find_artist_from_call(
//   target_call_info: DynamicCallInfo,
//   state: State
// ): { info: SelectableArtist; view: ArtistView } | null {
//   for (const artist_info of state.selectable_artists) {
//     const artist_view = state.sidebar!.artists[artist_info.id];

//     // Each call
//     const calls = state.calls_and_methods_by_artist![artist_info.id].calls;
//     const includes = calls.map(c => c.call_info).includes(target_call_info);

//     if (includes) {
//       return { info: artist_info, view: artist_view };
//     }
//   }

//   return null;
// }

// export function open_collapsable_artist(
//   target_artist: { info: SelectableArtist; view: ArtistView },
//   state: State
// ) {
//   let curr_view: ArtistView = target_artist.view;
//   let curr_info: SelectableArtist = target_artist.info;

//   while (true) {
//     // Open it
//     open_collapsable(curr_view.els.el);

//     // Navigage up to its parent if it has one
//     if (curr_info.parent_id == null) break;

//     const id = curr_info.parent_id;
//     curr_info = state.selectable_artists.find(artist => artist.id == id)!;
//     curr_view = state.sidebar!.artists[id];
//   }
// }

// export function focus_on_call(
//   target_call_info: DynamicCallInfo,
//   target_call_view: CallView,
//   state: State
// ) {
//   const target_artist = find_artist_from_call(target_call_info, state);

//   if (target_artist == null) {
//     console.warn("[Focus on call] No artist found for call.");
//     return;
//   }

//   // Open the artist
//   // open_collapsable_artist(target_artist, state);

//   add_temporary_focus(target_call_view.els.el);
// }

// export function focus_on_method(
//   target_method_info: MethodInfo,
//   target_method_view: MethodView,
//   state: State
// ) {
//   const target_artist = find_artist_from_method(target_method_info, state);

//   if (target_artist == null) {
//     console.warn("[Focus on call] No artist found for call.");
//     return;
//   }

//   // Open the artist
//   open_collapsable_artist(target_artist, state);

//   add_temporary_focus(target_method_view.el);
// }

// export function focus_on_call_from_code(
//   target_code_and_loc: string,
//   state: State
// ) {
//   const target_call = find_call_that_satisfies((call_info, _) => {
//     const code_and_loc = get_code_and_loc_for_call(call_info);
//     return target_code_and_loc == code_and_loc;
//   }, state);

//   if (target_call != null) {
//     focus_on_call(target_call.info, target_call.view, state);
//   }
// }

// export function add_temporary_focus(el: HTMLElement) {
//   // Add focus on call view
//   el.classList.add("snp-focused");

//   // Unfocus on clicking anywhere else
//   const unfocus = () => {
//     el.classList.remove("snp-focused");
//     document.removeEventListener("mousedown", unfocus);
//   };

//   document.addEventListener("mousedown", unfocus);
// }
