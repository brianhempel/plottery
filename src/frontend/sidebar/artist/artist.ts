import {
  AppState,
  ArtistView,
  ArtistViewEls,
  CallView,
  CallWithArgs,
  MethodView,
  MethodWithArgs,
  SelectableArtist,
  SidebarView,
} from "../../state";
import { create_dropdown_arrow, create_el } from "../../utils/misc";
import { get_shortest_qualified_name } from "../../utils/names";
import { create_call_view } from "../call/call";
import { create_method_view } from "../methods/method";
import "./artist.css";

export function create_artist_view(
  artist: SelectableArtist,
  sidebar_view: SidebarView,
  all_calls_and_methods: {
    [key: string]: { calls: CallWithArgs[]; methods: MethodWithArgs[] };
  }
): ArtistView {
  let artist_name = get_shortest_qualified_name(artist.names);

  // Find parent (@TODO: make this more robust)
  let parent_el = sidebar_view.els.artists_el;

  for (const [other_id, other_view] of Object.entries(sidebar_view.artists)) {
    const selectable_artists = AppState.model.selectable_artists;
    const other_artist = selectable_artists.find(
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

  const view = AppState.view_model;

  for (const region of view.hovered_elems) {
    const region_names: string[] = JSON.parse(
      region.getAttribute("data-artist-names")!
    );
    const region_name = get_shortest_qualified_name(region_names);

    if (region_name == artist_name) {
      artist_els.name_el.addEventListener("mouseover", () => {
        const path = region.children[0] as SVGPathElement;
        path.classList.add("hovered");
      });
      artist_els.name_el.addEventListener("mouseout", () => {
        const path = region.children[0] as SVGPathElement;
        path.classList.remove("hovered");
      });

      break;
    }
  }

  // Loop through and build the call views for this artist
  const call_views: CallView[] = [];
  const calls = all_calls_and_methods[artist.id].calls;

  calls.forEach(call => {
    if (parent_el != sidebar_view.els.artists_el) {
      // Check if the call exists in parent, if it does, just copy it over
      // @TODO: This should be pre-processed
      const call_els = [...parent_el.querySelectorAll(".snp-call")];

      for (const call_el of call_els) {
        const prefix = (call_el.querySelector(".snp-call-name") as HTMLElement)
          .innerText;
        if (prefix == call.call_info.func_code_and_num[0]) {
          artist_els.calls_el.append(call_el);
          return;
        }
      }
    }

    const call_view = create_call_view(call);
    call_views.push(call_view);

    // Add it
    artist_els.calls_el.append(call_view.els.el);
  });

  const method_views: MethodView[] = [];
  const methods = all_calls_and_methods[artist.id].methods;

  methods.forEach(method => {
    const method_prefix = `${method.receiver_name}.${method.method_info.name}`;

    if (parent_el != sidebar_view.els.artists_el) {
      // Check if the method exists in parent, if it does, just copy it over
      // @TODO: This should be pre-processed
      const method_els = [...parent_el.querySelectorAll(".snp-method-view")];

      for (const method_el of method_els) {
        const code = (method_el as HTMLElement).innerText.replaceAll("\n", "");

        if (code.startsWith(`${method_prefix}(`)) {
          artist_els.calls_el.append(method_el);
          return;
        }
      }
    }

    // Don't add a method that's already been called
    for (const call of calls) {
      if (call.call_info.func_code_and_num[0] == method_prefix) {
        return;
      }
    }

    const method_view = create_method_view(method);
    method_views.push(method_view);

    // Add it
    artist_els.calls_el.append(method_view.el);
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
