import {
  SelectableArtist,
} from "../../types";
import { get_shortest_qualified_name } from "../../utils/misc";
import "./artist.css";

// /**
//  * Makes an artist in the sidebar. E.g.
//  *
//  * ax
//  *  - ax.bar
//  *  - ax.barh
//  *  ...
//  */
// export function create_artist_view(
//   artist: SelectableArtist,
//   sidebar_view: SidebarView,
//   calls_and_methods: {
//     calls: CallWithArgs[];
//     methods: MethodWithArgs[];
//   },
//   state: State
// ): ArtistView {
//   let artist_name = get_shortest_qualified_name(artist.names);

//   // Find parent element
//   let parent_el = artist.parent_id
//     ? sidebar_view.artists[artist.parent_id!].els.body_el
//     : sidebar_view.artists_el;

//   // Make artist view
//   const { el, body_el, header_el } = create_collapsable_els();
//   el.classList.add("snp-artist");
//   parent_el.append(el);

//   // Add a name
//   const name_el = create_el("div", "snp-artist-name", header_el);

//   if (parent_el != sidebar_view.artists_el) {
//     collapse_collapsable(el); // Collapse children by default
//     const end = artist_name.split(".").at(-1)!;
//     name_el.innerHTML = `${end}`; // Set name to be trimmed
//   } else {
//     name_el.innerHTML = `${artist_name}`;
//   }

//   const persistent_artists: { [name: string]: PersistantArtist } = (
//     window as any
//   )["snp_persistent_artists"];

//   // Set to the previous expanded state
//   if (persistent_artists[artist_name]) {
//     if (persistent_artists[artist_name]?.collapsed) {
//       collapse_collapsable(el);
//     } else {
//       open_collapsable(el);
//     }
//   }

//   // Loop through and build the call views for this artist
//   const call_views: CallView[] = [];
//   const calls = calls_and_methods.calls;

//   calls.forEach(call => {
//     const call_view = create_call_view(call, state);
//     call_views.push(call_view);

//     // Add it
//     body_el.append(call_view.els.el);
//   });

//   const method_views: MethodView[] = [];
//   const methods = calls_and_methods.methods;

//   methods.forEach(method => {
//     const method_view = create_method_view(method, state);
//     method_views.push(method_view);

//     // Add it
//     body_el.append(method_view.el);
//   });

//   return {
//     els: {
//       el,
//       body_el,
//       header_el,
//       name_el,
//     },
//     calls: call_views,
//     methods: method_views,
//   };
// }

export function set_artist_parent_ids(selectable_artists: SelectableArtist[]) {
  const searched: SelectableArtist[] = [];

  // Exploiting that the list is ordered from root -> root.children -> ... -> leaves
  for (const artist of selectable_artists) {
    const name = get_shortest_qualified_name(artist.names);

    // Find its parent
    for (const other of searched) {
      const other_name = get_shortest_qualified_name(other.names);

      if (name.split(".").slice(0, -1).join(".") == other_name) {
        artist.parent_id = other.id;
        break;
      }
    }

    searched.push(artist);
  }
}
