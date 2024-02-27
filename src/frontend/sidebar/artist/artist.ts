import {
  ArtistView,
  ArtistViewEls,
  CallView,
  CallWithArgs,
  Model,
  SelectableArtist,
  SidebarView,
} from "../../state";
import { create_dropdown_arrow, create_el } from "../../utils/misc";
import { get_shortest_qualified_name } from "../../utils/names";
import { create_call_view } from "../call/call";
import "./artist.css";

export function create_artist_view(
  artist: SelectableArtist,
  sidebar_view: SidebarView,
  model: Model,
  all_calls_and_methods: {
    [key: string]: { calls: CallWithArgs[]; methods: null };
  }
): ArtistView {
  let artist_name = get_shortest_qualified_name(artist.names);

  // Find parent (@TODO: make this more robust)
  let parent_el = sidebar_view.els.artists_el;

  for (const [other_id, other_view] of Object.entries(sidebar_view.artists)) {
    const other_artist = model.selectable_artists.find(
      a => a.id == parseInt(other_id)
    )!;
    const other_name = get_shortest_qualified_name(other_artist.names);

    if (artist_name.split(".").slice(0, -1).join(".") == other_name) {
      parent_el = other_view.els.calls_el;
      // artist_name = artist_name.split(".").at(-1)!;
      break;
    }
  }

  // Make artist view
  const artist_els = create_artist_view_skeleton();
  parent_el.append(artist_els.el);

  artist_els.collapse_button_el.addEventListener("click", () => {
    artist_els.el.classList.toggle("collapsed");
  });

  if (parent_el != sidebar_view.els.artists_el) {
    artist_els.el.classList.add("collapsed"); // Collapse children by default

    // @TODO: Sanitize input
    const end = artist_name.split(".").at(-1)!;
    const rest = artist_name.split(".").slice(0, -1).join(".");
    artist_els.name_el.innerHTML = `<span class="snp-artist-name-faded">${rest}.</span>${end}`; // Set name to be faded out
  } else {
    artist_els.name_el.innerHTML = `${artist_name}`; // Set name
  }

  // Loop through and build the call views for this artist
  const call_views: CallView[] = [];
  const calls = all_calls_and_methods[artist.id].calls;

  calls.forEach(call => {
    const call_view = create_call_view(model, call, artist_name);
    call_views.push(call_view);

    // Add it
    artist_els.calls_el.append(call_view.els.el);
  });

  return {
    els: artist_els,
    is_expanded: true,
    calls: call_views,
    methods: [],
  };
}

export function create_artist_view_skeleton(): ArtistViewEls {
  // Artist container
  const el = create_el("div", "snp-artist");

  // Artist header
  const header_el = create_el("div", "snp-artist-header", el);

  // Collapse button
  const collapse_button_el = create_dropdown_arrow();
  collapse_button_el.classList.add("snp-artist-collapse-button");
  header_el.append(collapse_button_el);

  // Artist name
  const name_el = create_el("div", "snp-artist-name", header_el);

  // Artist body
  const body_el = create_el("div", "snp-artist-body", el);

  // Seperator
  const collapse_indent_el = create_el(
    "div",
    "snp-artist-collapse-indent",
    body_el
  );

  // Calls
  const calls_el = create_el("div", "snp-artist-calls", body_el);

  return {
    el,
    header_el,
    collapse_button_el,
    name_el,
    body_el,
    collapse_indent_el,
    calls_el,
  };
}
